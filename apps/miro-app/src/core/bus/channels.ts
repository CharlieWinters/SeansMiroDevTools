/**
 * Event Bus Channel Definitions
 * 
 * Defines the typed channels for inter-module communication
 */

import type { BoardState, BoardStateChangeEvent } from '../../types/board.js';
import type { ModuleRegistryEvents } from '../../types/modules.js';
import type { MCPEvents, MCPToolCallRequest, MCPToolCallResponse } from '../../types/mcp.js';

/** Board state channel events */
export interface BoardStateChannelEvents {
  'state:changed': BoardStateChangeEvent;
  'selection:changed': { itemIds: string[] };
  'item:created': { itemId: string; type: string };
  'item:updated': { itemId: string };
  'item:deleted': { itemId: string };
}

/** File system channel events */
export interface FilesChannelEvents {
  'file:opened': { path: string; content: string };
  'file:changed': { path: string };
  'file:closed': { path: string };
  'file:error': { path: string; error: string };
}

/** Terminal channel events */
export interface TerminalChannelEvents {
  'command:execute': { command: string; variables: Record<string, string> };
  'command:output': { stdout: string; stderr: string; exitCode: number };
  'command:cancel': { commandId: string };
  'embed:create': void;
  'embed:created': { sid: string; boardId: string };
  'embed:error': { error: unknown };
}

/** Review bot channel events */
export interface ReviewChannelEvents {
  'navigate:tag': { tag: string };
  'navigate:frame': { frameId: string };
  'navigate:item': { itemId: string };
  'review:next': void;
  'review:previous': void;
}

/** Sync channel events */
export interface SyncChannelEvents {
  'sync:start': { filePath: string };
  'sync:progress': { processed: number; total: number };
  'sync:complete': { summary: string };
  'sync:error': { error: string };
}

/** All channel event maps */
export interface ChannelEventMaps {
  boardState: BoardStateChannelEvents;
  files: FilesChannelEvents;
  terminal: TerminalChannelEvents;
  review: ReviewChannelEvents;
  'mcp-inbound': MCPEvents;
  'mcp-outbound': MCPEvents;
  sync: SyncChannelEvents;
  modules: ModuleRegistryEvents;
}

/** Channel names */
export type ChannelName = keyof ChannelEventMaps;

/** Get event names for a channel */
export type ChannelEvents<C extends ChannelName> = keyof ChannelEventMaps[C];

/** Get payload type for a specific event on a channel */
export type EventPayload<
  C extends ChannelName,
  E extends ChannelEvents<C>
> = ChannelEventMaps[C][E];
