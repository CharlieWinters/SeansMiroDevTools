/**
 * Shared Constants
 */

/** Valid item tags */
export const VALID_TAGS = [
  'ready',
  'in-progress',
  'implemented',
  'needs-review',
  'blocked',
  'bug',
] as const;

export type ValidTag = (typeof VALID_TAGS)[number];

/** Tag colors for visual display */
export const TAG_COLORS: Record<ValidTag, string> = {
  'ready': '#adf0c7',
  'in-progress': '#fff6b6',
  'implemented': '#a0d9ef',
  'needs-review': '#f5d1f7',
  'blocked': '#f5c8c8',
  'bug': '#ffcdd2',
};

/** Metadata keys with special meaning */
export const RESERVED_METADATA_KEYS = [
  'status',
  'file',
  'last_modified',
  'assigned_to',
] as const;

/** Event bus channel names */
export const CHANNELS = {
  BOARD_STATE: 'boardState',
  FILES: 'files',
  TERMINAL: 'terminal',
  REVIEW: 'review',
  MCP_INBOUND: 'mcp-inbound',
  MCP_OUTBOUND: 'mcp-outbound',
  SYNC: 'sync',
  MODULES: 'modules',
} as const;

/** Default file paths */
export const DEFAULT_PATHS = {
  UPDATES_FILE: '.miro-updates.json',
  CONFIG_FILE: '.miro-ide.json',
} as const;
