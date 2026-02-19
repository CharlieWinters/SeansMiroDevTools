/**
 * Terminal Embed Module
 * 
 * Embeds a persistent terminal session on the Miro board.
 * Each board gets its own terminal session keyed by board ID.
 * 
 * Supports <input> variable expansion with Miro item links for
 * items connected to the terminal embed via connectors.
 */

import type { EventBus } from '../../../apps/miro-app/src/core/bus/eventBus.js';
import type { MiroModule, ModuleState } from '../../../apps/miro-app/src/types/modules.js';

// Declare the global miro SDK type from @mirohq/websdk-types
declare const miro: import('@mirohq/websdk-types').Miro;

/** Terminal server configuration */
const TERMINAL_SERVER_URL = 'http://localhost:3001';

/** Response from POST /api/pty/start */
interface PtyStartResponse {
  sid: string;
  url: string;
  wsUrl?: string;
}

/** Connected document info */
interface ConnectedDoc {
  id: string;
  content: string;
  type: string;
}

let state: ModuleState = 'registered';
let eventBus: EventBus | null = null;
let miroSdk: typeof miro | null = null;

/** Map of embedId → Miro widget ID for looking up which embed sent a message */
const embedIdToWidgetId = new Map<string, string>();

/** Interval handle for periodic context refresh */
let contextRefreshInterval: ReturnType<typeof setInterval> | null = null;
const CONTEXT_REFRESH_MS = 10_000; // refresh connected docs every 10s

/** Interval for polling context requests (terminal asked for viewport/context) */
let contextRequestPollInterval: ReturnType<typeof setInterval> | null = null;
const CONTEXT_REQUEST_POLL_MS = 2_000;

/**
 * Start or connect to a terminal session for the given board ID
 */
async function startTerminalSession(boardId: string): Promise<PtyStartResponse> {
  const response = await fetch(`${TERMINAL_SERVER_URL}/api/pty/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sid: boardId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to start terminal session: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * Get all items connected to a widget via connectors
 */
async function getConnectedItems(widgetId: string): Promise<string[]> {
  if (!miroSdk) {
    throw new Error('Miro SDK not initialized');
  }

  // First, get the terminal embed widget itself so we can use its connectorIds
  const embedItems = await miroSdk.board.get({ id: widgetId });
  if (!embedItems.length) {
    console.warn('[Terminal] getConnectedItems: no item found for widgetId', widgetId);
    return [];
  }

  const embedWidget = embedItems[0] as { id: string; type: string; connectorIds?: string[] };
  const connectorIds = embedWidget.connectorIds || [];
  console.log('[Terminal] Connector lookup (via widget.connectorIds): widgetId=', widgetId, 'type=', embedWidget.type, 'connectorIds=', connectorIds);

  if (!connectorIds.length) {
    console.warn('[Terminal] getConnectedItems: widget has no connectorIds');
    return [];
  }

  // Load just the connectors attached to this widget
  const connectorItems = await miroSdk.board.get({ id: connectorIds });
  const connectors = connectorItems as Array<{
    id: string;
    type: 'connector';
    start?: { item?: string; [k: string]: unknown };
    end?: { item?: string; [k: string]: unknown };
  }>;

  console.log('[Terminal] Loaded connectors for widget:', connectors.map(c => ({ id: c.id, start: c.start, end: c.end })));

  // Find connectors where our widget is either the start or end
  const connectedItemIds: string[] = [];
  for (const connector of connectors) {
    const startItem = connector.start?.item;
    const endItem = connector.end?.item;
    if (startItem === widgetId && endItem) {
      connectedItemIds.push(endItem);
    } else if (endItem === widgetId && startItem) {
      connectedItemIds.push(startItem);
    } else {
      console.log('[Terminal] Connector does not directly attach to this widgetId:', {
        connectorId: connector.id,
        startItem,
        endItem,
        widgetId,
      });
    }
  }

  if (!connectedItemIds.length) {
    console.warn('[Terminal] getConnectedItems: no connected items found for widgetId', widgetId);
  } else {
    console.log('[Terminal] Found connected items for widget', widgetId, ':', connectedItemIds);
  }
  return connectedItemIds;
}

/**
 * Build the Miro "move to widget" link for an item on the current board.
 * Format: https://miro.com/app/board/{boardId}/?moveToWidget={itemId}&cot=14
 */
function buildItemLink(boardId: string, itemId: string): string {
  const base = `https://miro.com/app/board/${boardId}/`;
  const params = new URLSearchParams({ moveToWidget: itemId, cot: '14' });
  return `${base}?${params.toString()}`;
}

/**
 * Fetch connected items and return each as an item link (no content fetch).
 * The Web SDK returns type "unsupported" for documents, so we don't rely on
 * item type or content — we just return one link per connected item.
 */
async function fetchConnectedDocs(widgetId: string): Promise<ConnectedDoc[]> {
  if (!miroSdk) {
    throw new Error('Miro SDK not initialized');
  }

  const [connectedItemIds, boardInfo] = await Promise.all([
    getConnectedItems(widgetId),
    miroSdk.board.getInfo(),
  ]);
  const boardId = (boardInfo as { id: string }).id;

  const docs: ConnectedDoc[] = connectedItemIds.map((itemId) => ({
    id: itemId,
    content: buildItemLink(boardId, itemId),
    type: 'link',
  }));

  console.log('[Terminal] Fetched', docs.length, 'connected item links');
  return docs;
}

/**
 * Push connected docs to the terminal server so the terminal iframe
 * can fetch them via HTTP.
 *
 * The terminal iframe and the app panel live in separate Miro iframes,
 * so postMessage between them doesn't work. We use the terminal server
 * as a relay instead.
 */
async function pushContextToServer(embedId: string, widgetId: string): Promise<void> {
  try {
    console.log('[Terminal] Pushing context: embedId=', embedId, 'widgetId (terminal embed)=', widgetId);
    const [docs, viewport] = await Promise.all([
      fetchConnectedDocs(widgetId),
      miroSdk!.board.viewport.get(),
    ]);
    const response = await fetch(`${TERMINAL_SERVER_URL}/api/context/${encodeURIComponent(embedId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docs, viewport }),
    });

    if (!response.ok) {
      console.error('[Terminal] Failed to push context:', response.status, await response.text());
    } else {
      console.log('[Terminal] Pushed context for embed', embedId, ':', docs.length, 'doc(s)', docs.length ? docs.map((d) => d.id) : '');
    }
  } catch (error) {
    console.error('[Terminal] Error pushing context to server:', error);
  }
}

/**
 * Poll terminal server for "context requested" (e.g. user typed <viewport> in terminal).
 * When our embedIds are requested, push context so the terminal gets viewport/docs.
 */
async function pollContextRequests(): Promise<void> {
  if (embedIdToWidgetId.size === 0) return;
  try {
    const res = await fetch(`${TERMINAL_SERVER_URL}/api/context/requests`);
    if (!res.ok) return;
    const { embedIds } = (await res.json()) as { embedIds: string[] };
    if (!Array.isArray(embedIds) || embedIds.length === 0) return;
    for (const embId of embedIds) {
      const widId = embedIdToWidgetId.get(embId);
      if (widId) {
        await pushContextToServer(embId, widId);
      }
    }
  } catch (err) {
    console.error('[Terminal] Context request poll error:', err);
  }
}

/**
 * Start a periodic refresh loop that keeps the terminal server's
 * context store up-to-date with the latest connected docs and viewport.
 * Also polls for context requests so when the terminal needs viewport,
 * we push it on demand.
 */
function startContextRefresh(): void {
  stopContextRefresh();

  contextRefreshInterval = setInterval(() => {
    for (const [embId, widId] of embedIdToWidgetId.entries()) {
      pushContextToServer(embId, widId).catch((err) =>
        console.error('[Terminal] Context refresh error:', err),
      );
    }
  }, CONTEXT_REFRESH_MS);

  contextRequestPollInterval = setInterval(() => {
    pollContextRequests();
  }, CONTEXT_REQUEST_POLL_MS);

  console.log('[Terminal] Context refresh started (every', CONTEXT_REFRESH_MS, 'ms), request poll every', CONTEXT_REQUEST_POLL_MS, 'ms');
}

/**
 * Stop the periodic context refresh and request poll.
 */
function stopContextRefresh(): void {
  if (contextRefreshInterval !== null) {
    clearInterval(contextRefreshInterval);
    contextRefreshInterval = null;
  }
  if (contextRequestPollInterval !== null) {
    clearInterval(contextRequestPollInterval);
    contextRequestPollInterval = null;
  }
}

/**
 * Generate a unique embed ID
 */
function generateEmbedId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Optional settings to apply via embed URL (session name, start folder, etc.) */
export interface TerminalEmbedOptions {
  /** Named session (e.g. "frontend", "backend") – becomes part of session ID */
  sessionName?: string;
  /** Working directory for the terminal (e.g. "/app", "~/project") */
  cwd?: string;
}

/**
 * Create the terminal embed widget on the board
 */
async function createTerminalEmbed(
  terminalUrl: string,
  boardId: string,
  boardName: string,
  embedOptions?: TerminalEmbedOptions
): Promise<void> {
  if (!miroSdk) {
    throw new Error('Miro SDK not initialized');
  }

  // Generate a unique ID for this embed (used for isolated settings storage and message correlation)
  const embedId = generateEmbedId();

  // Build the full URL for the embed, including board info for variable expansion
  const baseUrl = `${TERMINAL_SERVER_URL}${terminalUrl}`;
  const url = new URL(baseUrl);
  url.searchParams.set('embedId', embedId);
  url.searchParams.set('boardId', boardId);
  url.searchParams.set('boardName', boardName);
  // Optional: pre-define session name and cwd via URL so terminal spawns with these settings
  if (embedOptions?.sessionName != null && embedOptions.sessionName !== '') {
    url.searchParams.set('name', embedOptions.sessionName);
  }
  if (embedOptions?.cwd != null && embedOptions.cwd !== '') {
    url.searchParams.set('cwd', embedOptions.cwd);
  }
  const fullUrl = url.toString();

  // Create the embed widget
  const embed = await miroSdk.board.createEmbed({
    url: fullUrl,
    x: 0,
    y: 0,
    width: 800,
    height: 600,
  });

  console.log('[Terminal] Created embed widget:', embed.id);

  // Store the mapping from embedId to Miro widget ID
  // This allows us to look up which widget a message came from
  embedIdToWidgetId.set(embedId, embed.id);
  console.log('[Terminal] Mapped embedId', embedId, '→ widgetId', embed.id);

  // Push the initial connected-doc context to the terminal server
  // so the terminal iframe can fetch it via HTTP.
  await pushContextToServer(embedId, embed.id);

  // Start periodic context refresh (keeps connected docs fresh)
  startContextRefresh();

  // Optionally zoom to the new widget
  await miroSdk.board.viewport.zoomTo(embed);
}

export const terminalEmbedModule: MiroModule = {
  id: 'terminal-embed',
  name: 'Terminal Embed',
  description: 'Embed a persistent terminal session on the Miro board',

  registerModule(bus: EventBus, sdk: typeof miro): void {
    eventBus = bus;
    miroSdk = sdk;

    // Expose debug helper in browser console: run __terminalEmbedDebug() to inspect connectors
    if (typeof globalThis !== 'undefined') {
      (globalThis as Record<string, unknown>).__terminalEmbedDebug = async function terminalEmbedDebug() {
        console.group('[Terminal] 🔍 Connector debug');
        console.log('embedId → widgetId map:', Array.from(embedIdToWidgetId.entries()));
        if (!miroSdk) {
          console.warn('miroSdk not ready');
          console.groupEnd();
          return;
        }
        if (embedIdToWidgetId.size === 0) {
          console.warn('No terminal embeds in map – create a terminal from the app first.');
          console.groupEnd();
          return;
        }
        const rawConnectors = await miroSdk.board.get({ type: 'connector' });
        console.log('All connectors on board:', rawConnectors.length, rawConnectors);
        for (const [embId, widId] of embedIdToWidgetId.entries()) {
          console.group(`embedId=${embId} widgetId (terminal)=${widId}`);
          const connected = await getConnectedItems(widId);
          console.log('Connected item IDs for this terminal:', connected);
          console.log('Match check: connectors with this widget at start/end:', rawConnectors.map((c: { start?: { item?: string }; end?: { item?: string } }) => ({
            startItem: c.start?.item,
            endItem: c.end?.item,
            matchesStart: c.start?.item === widId,
            matchesEnd: c.end?.item === widId,
          })));
          console.groupEnd();
        }
        console.log('Tip: Run __terminalEmbedDebugPush() to push context now and see result.');
        console.groupEnd();
      };
      (globalThis as Record<string, unknown>).__terminalEmbedDebugPush = async function terminalEmbedDebugPush() {
        console.group('[Terminal] 🔍 Push context now');
        if (embedIdToWidgetId.size === 0) {
          console.warn('No terminal embeds in map.');
          console.groupEnd();
          return;
        }
        for (const [embId, widId] of embedIdToWidgetId.entries()) {
          await pushContextToServer(embId, widId);
        }
        console.groupEnd();
      };
    }

    // Subscribe to terminal events
    bus.on('terminal', 'command:execute', async ({ command, variables }) => {
      console.log('[Terminal] Execute:', command, variables);
    });

    // Subscribe to request to create terminal embed
    bus.on('terminal', 'embed:create', async () => {
      try {
        await terminalEmbedModule.start();
      } catch (error) {
        console.error('[Terminal] Failed to create embed:', error);
        bus.emit('terminal', 'embed:error', { error });
      }
    });
  },

  async start(options?: { config?: { sessionName?: string; cwd?: string } }): Promise<void> {
    state = 'active';
    console.log('[Terminal] Module starting...');

    const embedOptions: TerminalEmbedOptions | undefined =
      options?.config?.sessionName != null || options?.config?.cwd != null
        ? {
            sessionName: options.config.sessionName,
            cwd: options.config.cwd,
          }
        : undefined;
    if (embedOptions) {
      console.log('[Terminal] Embed URL params:', embedOptions);
    }

    try {
      // Get the current board ID and name
      const boardInfo = await miro.board.getInfo();
      const boardId = boardInfo.id;
      const boardName = (boardInfo as { id: string; title?: string }).title || boardId;
      console.log('[Terminal] Board ID:', boardId, 'Name:', boardName);

      // Start or connect to the terminal session
      const ptyResponse = await startTerminalSession(boardId);
      console.log('[Terminal] PTY session started:', ptyResponse.sid);

      // Create the embed widget on the board with board info and optional URL params
      await createTerminalEmbed(ptyResponse.url, boardId, boardName, embedOptions);
      console.log('[Terminal] Terminal embed created successfully');

      // Emit success event
      if (eventBus) {
        eventBus.emit('terminal', 'embed:created', {
          sid: ptyResponse.sid,
          boardId,
        });
      }
    } catch (error) {
      state = 'error';
      console.error('[Terminal] Failed to start terminal embed:', error);

      // Emit error event
      if (eventBus) {
        eventBus.emit('terminal', 'embed:error', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      throw error;
    }
  },

  async stop(): Promise<void> {
    stopContextRefresh();
    state = 'stopped';
    console.log('[Terminal] Module stopped');
  },

  getState(): ModuleState {
    return state;
  },
};

export function registerModule(): MiroModule {
  return terminalEmbedModule;
}

export function createModule(): MiroModule {
  return terminalEmbedModule;
}

export default terminalEmbedModule;
