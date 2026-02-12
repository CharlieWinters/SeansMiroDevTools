/**
 * MCP (Model Context Protocol) type definitions
 */

/** MCP connection status */
export type MCPConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/** MCP server configuration */
export interface MCPServerConfig {
  name: string;
  endpoint: string;
  apiKey?: string;
  capabilities?: string[];
}

/** MCP tool definition */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** MCP resource definition */
export interface MCPResource {
  uri: string;
  name: string;
  mimeType?: string;
}

/** MCP client connection */
export interface MCPConnection {
  serverId: string;
  status: MCPConnectionStatus;
  tools: MCPTool[];
  resources: MCPResource[];
  error?: string;
}

/** MCP tool call request */
export interface MCPToolCallRequest {
  serverId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

/** MCP tool call response */
export interface MCPToolCallResponse {
  success: boolean;
  result?: unknown;
  error?: string;
}

/** Schema for .miro-updates.json file */
export interface MiroUpdatesFile {
  version: '1.0';
  timestamp: string;
  updates: MiroUpdate[];
}

/** Individual update action */
export interface MiroUpdate {
  action: 'create' | 'update' | 'delete';
  itemType: string;
  itemId?: string;
  data: {
    content?: string;
    tags?: string[];
    metadata?: Record<string, string>;
    position?: { x: number; y: number };
    parentId?: string;
  };
}

/** MCP events */
export interface MCPEvents {
  'mcp:connected': { serverId: string };
  'mcp:disconnected': { serverId: string };
  'mcp:tool-called': { request: MCPToolCallRequest; response: MCPToolCallResponse };
  'mcp:error': { serverId: string; error: string };
}
