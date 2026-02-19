# PTY Terminal Server

A standalone PTY-based web terminal server designed for embedding in Miro boards via iframe. Sessions are keyed by board ID (sid), support signed token authentication, and persist across disconnects with automatic idle cleanup.

## Features

- **PTY-based terminal** using node-pty for true shell experience
- **WebSocket protocol** for real-time bidirectional communication
- **Session persistence** across client disconnects with 1-hour idle timeout
- **Multi-client support** - multiple clients can attach to the same session and see shared output
- **Signed token authentication** using HMAC-SHA256
- **Variable pattern highlighting** - `<...>` patterns are visually highlighted in the terminal
- **Iframe-embeddable** with no conflicts

## Installation

```bash
cd modules/terminal-server
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `SIGN_SECRET` | (required in prod) | Secret for signing authentication tokens |
| `SESSION_TIMEOUT` | `3600000` | Session idle timeout in ms (1 hour) |
| `TOKEN_TTL` | `900000` | Token validity period in ms (15 minutes) |
| `ALLOWED_ROOT` | `$HOME` | Root directory for CWD restrictions |
| `NODE_ENV` | `development` | Environment (set to `production` in prod) |

**Important:** In production, always set a strong `SIGN_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Usage

### Start the Server

```bash
npm start
# or for development with auto-reload:
npm run dev
```

### API Endpoints

#### Create/Attach to Session

```http
POST /api/pty/start
Content-Type: application/json

{
  "sid": "optional-session-id",
  "cwd": "/optional/working/directory",
  "name": "optional-terminal-name"
}
```

Response:
```json
{
  "sid": "generated-or-provided-sid",
  "url": "/terminal.html?sid=...&token=...",
  "wsUrl": "ws://host/pty?sid=...&token=..."
}
```

#### Embed URL parameters

When creating a terminal from the Miro app, you can pre-set session name and working directory via the **embed URL** so the terminal spawns with those settings without opening the in-terminal settings panel.

- **From the app panel URL:** Open the app with query params, then start the Terminal Embed module. Example:  
  `https://.../app.html?name=frontend&cwd=/app`  
  Clicking "Terminal Embed" will create an embed whose iframe loads with `name=frontend` and `cwd=/app`.
- **Parameters:**  
  - `name` – Session name (e.g. `frontend`, `backend`). Becomes part of the session ID and gives the terminal its own named session.  
  - `cwd` – Working directory for the shell (e.g. `/app`, `~/project`). Must be under `ALLOWED_ROOT`.

The terminal iframe also accepts these same query params when loaded directly; they are applied as initial settings and persisted.

#### Close Session (Optional)

```http
DELETE /api/pty/close?sid=session-id
```

#### Health Check

```http
GET /health
```

### WebSocket Protocol

Connect to `/pty?sid=<sid>&token=<token>`

#### Incoming Messages (Client → Server)

```json
{ "type": "input", "data": "ls -la\n" }
{ "type": "resize", "cols": 120, "rows": 40 }
```

#### Outgoing Messages (Server → Client)

```json
{ "type": "connected" }
{ "type": "data", "data": "terminal output..." }
{ "type": "error", "message": "error description" }
```

### Terminal UI

Access the terminal UI at:
```
/terminal.html?sid=<sid>&token=<token>
```

Or create a new session by providing only `cwd`:
```
/terminal.html?cwd=/path/to/directory
```

## Miro Integration

1. Use the board ID as the `sid` parameter
2. Call `POST /api/pty/start` with the board ID
3. Embed the returned URL in an iframe widget

Example:
```javascript
const response = await fetch('/api/pty/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    sid: boardId,
    cwd: workingDirectory 
  })
});

const { url } = await response.json();

// Create iframe widget with the URL
miro.board.createIframeWidget({
  url: `${serverBaseUrl}${url}`,
  // ... other widget options
});
```

## Security

- **Token Authentication:** All WebSocket connections require a valid signed token
- **Token Expiration:** Tokens expire after 15 minutes (configurable)
- **Path Traversal Protection:** CWD is validated against ALLOWED_ROOT
- **HMAC-SHA256:** Tokens are signed using timing-safe comparison
- **Production Requirement:** SIGN_SECRET must be set in production

## Testing Multi-Client Sessions

1. Start the server: `npm start`
2. Create a session: `curl -X POST http://localhost:3001/api/pty/start -H "Content-Type: application/json" -d '{}'`
3. Open the returned URL in multiple browser tabs
4. Type in one tab - output appears in all tabs
5. Sessions persist even when all tabs are closed (until idle timeout)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Terminal Server                       │
├─────────────────────────────────────────────────────────┤
│  Express HTTP Server                                     │
│  ├── POST /api/pty/start  → Create/attach session       │
│  ├── DELETE /api/pty/close → Close session              │
│  ├── GET /health          → Health check                │
│  └── Static files         → terminal.html, styles.css   │
├─────────────────────────────────────────────────────────┤
│  WebSocket Server (/pty)                                 │
│  ├── Token verification                                  │
│  ├── Session attachment                                  │
│  └── Bidirectional I/O                                   │
├─────────────────────────────────────────────────────────┤
│  Sessions Map                                            │
│  └── sid → { pty, clients[], lastSeen }                 │
└─────────────────────────────────────────────────────────┘
```

## License

MIT
