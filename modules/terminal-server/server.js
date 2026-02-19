const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const pty = require('node-pty');
const crypto = require('crypto');
const path = require('path');
const os = require('os');
const url = require('url');

// Configuration
const PORT = parseInt(process.env.PORT || '3001', 10);
const SIGN_SECRET = process.env.SIGN_SECRET || (process.env.NODE_ENV === 'production' ? null : 'dev-secret-change-in-production');
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT || '3600000', 10); // 1 hour default
const TOKEN_TTL = parseInt(process.env.TOKEN_TTL || '900000', 10); // 15 minutes default
const ALLOWED_ROOT = process.env.ALLOWED_ROOT || os.homedir();

if (!SIGN_SECRET && process.env.NODE_ENV === 'production') {
  console.error('SIGN_SECRET is required in production');
  process.exit(1);
}

// Sessions map: sid -> { pty, clients[], lastSeen }
const sessions = new Map();

// Context map: embedId -> { docs[], viewport?, updatedAt }
// Stores connected-doc context and viewport pushed by the Miro app panel
// so the terminal iframe can retrieve it via HTTP (they can't postMessage
// each other because they are sibling iframes under Miro's board frame).
const contextStore = new Map();

// Context requests: embedId -> timestamp when terminal asked for context.
// Miro app polls GET /api/context/requests and pushes context for these embedIds.
const CONTEXT_REQUEST_TTL_MS = 30_000;
const contextRequestTimes = new Map();

// Express app
const app = express();

// CORS middleware - allow requests from Miro and local development
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Allow Miro origins and local development
  if (origin && (origin.includes('miro.com') || origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// HTTP server
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocketServer({ noServer: true });

// Utility functions
function generateSid() {
  return crypto.randomBytes(16).toString('hex');
}

function safeJoin(root, userPath) {
  const resolved = path.resolve(root, userPath);
  if (!resolved.startsWith(path.resolve(root))) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}

function createToken(sid) {
  const exp = Date.now() + TOKEN_TTL;
  const payload = `pty:${sid}|${exp}`;
  const hmac = crypto.createHmac('sha256', SIGN_SECRET);
  hmac.update(payload);
  const signature = hmac.digest('hex');
  return `${exp}.${signature}`;
}

function verifyToken(sid, token) {
  if (!token || !sid) return false;
  
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  
  const [expStr, signature] = parts;
  const exp = parseInt(expStr, 10);
  
  // Check expiration
  if (isNaN(exp) || exp < Date.now()) {
    return false;
  }
  
  // Verify signature
  const payload = `pty:${sid}|${exp}`;
  const hmac = crypto.createHmac('sha256', SIGN_SECRET);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

function getShell() {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe';
  }
  // Use user's default shell from environment, or fallback to /bin/sh
  return process.env.SHELL || '/bin/sh';
}

function getCwd(requestedCwd) {
  if (!requestedCwd) {
    return process.platform === 'win32' 
      ? process.env.USERPROFILE 
      : process.env.HOME || os.homedir();
  }
  
  try {
    return safeJoin(ALLOWED_ROOT, requestedCwd);
  } catch (e) {
    console.warn('Invalid cwd requested, using default:', e.message);
    return os.homedir();
  }
}

function createSession(sid, cwd, name) {
  const shell = getShell();
  const workingDir = getCwd(cwd);
  
  const ptyProcess = pty.spawn(shell, [], {
    name: name || 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: workingDir,
    env: process.env
  });
  
  const session = {
    pty: ptyProcess,
    clients: [],
    lastSeen: Date.now(),
    name: name || 'terminal'
  };
  
  // Broadcast PTY output to all connected clients
  ptyProcess.onData((data) => {
    session.lastSeen = Date.now();
    const message = JSON.stringify({ type: 'data', data });
    session.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  });
  
  // Handle PTY exit
  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log(`PTY ${sid} exited with code ${exitCode}, signal ${signal}`);
    const message = JSON.stringify({ 
      type: 'error', 
      message: `Terminal exited with code ${exitCode}` 
    });
    session.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(message);
        client.close();
      }
    });
    sessions.delete(sid);
  });
  
  sessions.set(sid, session);
  return session;
}

function cleanupIdleSessions() {
  const now = Date.now();
  for (const [sid, session] of sessions) {
    if (now - session.lastSeen > SESSION_TIMEOUT) {
      console.log(`Cleaning up idle session: ${sid}`);
      session.pty.kill();
      sessions.delete(sid);
    }
  }
}

// Run cleanup every minute
setInterval(cleanupIdleSessions, 60000);

// API Routes
app.post('/api/pty/start', (req, res) => {
  const { sid: requestedSid, cwd, name } = req.body;
  
  let sid = requestedSid;
  let session = sid ? sessions.get(sid) : null;
  
  if (!session) {
    sid = sid || generateSid();
    session = createSession(sid, cwd, name);
    console.log(`Created new session: ${sid}`);
  } else {
    session.lastSeen = Date.now();
    console.log(`Reusing existing session: ${sid}`);
  }
  
  const token = createToken(sid);
  const wsProtocol = req.secure ? 'wss' : 'ws';
  const host = req.get('host');
  
  res.json({
    sid,
    url: `/terminal.html?sid=${encodeURIComponent(sid)}&token=${encodeURIComponent(token)}`,
    wsUrl: `${wsProtocol}://${host}/pty?sid=${encodeURIComponent(sid)}&token=${encodeURIComponent(token)}`
  });
});

app.delete('/api/pty/close', (req, res) => {
  const { sid } = req.query;
  
  if (!sid) {
    return res.status(400).json({ error: 'sid is required' });
  }
  
  const session = sessions.get(sid);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  // Close all clients
  session.clients.forEach(client => {
    if (client.readyState === 1) {
      client.close();
    }
  });
  
  // Kill PTY
  session.pty.kill();
  sessions.delete(sid);
  
  console.log(`Closed session: ${sid}`);
  res.json({ success: true });
});

// ── Context endpoints ─────────────────────────────────────────────────
// The Miro app panel pushes connected-doc context here so the terminal
// iframe (which lives in a separate Miro iframe) can fetch it via HTTP.

// Store / update context for an embed (docs + optional viewport)
app.post('/api/context/:embedId', (req, res) => {
  const { embedId } = req.params;
  const { docs, viewport } = req.body;

  if (!Array.isArray(docs)) {
    return res.status(400).json({ error: 'docs must be an array' });
  }

  const viewportData = viewport && typeof viewport === 'object' && Number.isFinite(viewport.x) && Number.isFinite(viewport.y) && Number.isFinite(viewport.width) && Number.isFinite(viewport.height)
    ? { x: viewport.x, y: viewport.y, width: viewport.width, height: viewport.height }
    : null;

  contextStore.set(embedId, { docs, viewport: viewportData, updatedAt: Date.now() });
  console.log(`[context] POST embedId=${embedId} stored ${docs.length} doc(s)`, viewportData ? ', viewport' : '');
  res.json({ ok: true, count: docs.length });
});

// Miro app polls this to see which embedIds need context, then pushes for each.
// Must be registered before /api/context/:embedId so "requests" is not treated as an embedId.
app.get('/api/context/requests', (req, res) => {
  const now = Date.now();
  const embedIds = [];
  for (const [id, at] of contextRequestTimes.entries()) {
    if (now - at < CONTEXT_REQUEST_TTL_MS) embedIds.push(id);
    else contextRequestTimes.delete(id);
  }
  res.json({ embedIds });
});

// Retrieve context for an embed
app.get('/api/context/:embedId', (req, res) => {
  const { embedId } = req.params;
  const ctx = contextStore.get(embedId);

  if (!ctx) {
    console.log(`[context] GET embedId=${embedId} → no context (empty)`);
    return res.json({ docs: [], viewport: null, updatedAt: null });
  }

  console.log(`[context] GET embedId=${embedId} → ${ctx.docs.length} doc(s)`);
  res.json(ctx);
});

// Terminal signals "I need context for this embed" (e.g. user typed <viewport>).
// Miro app polls GET /api/context/requests and pushes context for requested embedIds.
app.post('/api/context/:embedId/request', (req, res) => {
  const { embedId } = req.params;
  contextRequestTimes.set(embedId, Date.now());
  console.log(`[context] request embedId=${embedId}`);
  res.json({ ok: true });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    sessions: sessions.size,
    uptime: process.uptime()
  });
});

// WebSocket upgrade handling
server.on('upgrade', (request, socket, head) => {
  const { pathname, query } = url.parse(request.url, true);
  
  if (pathname === '/pty') {
    const { sid, token } = query;
    
    if (!sid || !token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    
    if (!verifyToken(sid, token)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, sid);
    });
  } else {
    socket.destroy();
  }
});

// WebSocket connection handling
wss.on('connection', (ws, request, sid) => {
  const session = sessions.get(sid);
  
  if (!session) {
    ws.send(JSON.stringify({ type: 'error', message: 'Session not found' }));
    ws.close();
    return;
  }
  
  // Add client to session
  session.clients.push(ws);
  session.lastSeen = Date.now();
  
  console.log(`Client connected to session ${sid}, total clients: ${session.clients.length}`);
  
  // Send connected message
  ws.send(JSON.stringify({ type: 'connected' }));
  
  // Handle incoming messages
  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message.toString());
      session.lastSeen = Date.now();
      
      switch (msg.type) {
        case 'input':
          if (typeof msg.data === 'string') {
            session.pty.write(msg.data);
          }
          break;
          
        case 'resize':
          if (typeof msg.cols === 'number' && typeof msg.rows === 'number') {
            session.pty.resize(msg.cols, msg.rows);
          }
          break;
          
        default:
          console.warn(`Unknown message type: ${msg.type}`);
      }
    } catch (e) {
      console.error('Error processing message:', e);
    }
  });
  
  // Handle client disconnect
  ws.on('close', () => {
    const index = session.clients.indexOf(ws);
    if (index > -1) {
      session.clients.splice(index, 1);
    }
    console.log(`Client disconnected from session ${sid}, remaining clients: ${session.clients.length}`);
  });
  
  ws.on('error', (err) => {
    console.error(`WebSocket error for session ${sid}:`, err);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Terminal server running on http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/pty`);
  console.log(`Session timeout: ${SESSION_TIMEOUT}ms`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...');
  
  // Close all sessions
  for (const [sid, session] of sessions) {
    session.pty.kill();
  }
  sessions.clear();
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
