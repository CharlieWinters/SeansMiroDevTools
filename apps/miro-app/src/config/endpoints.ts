/**
 * API Endpoints Configuration
 * 
 * Defines endpoints for MCP and other external services
 */

/** MCP server endpoint configuration */
export interface MCPEndpoint {
  name: string;
  url: string;
  description?: string;
  capabilities?: string[];
}

/** Default MCP endpoints */
export const defaultMCPEndpoints: MCPEndpoint[] = [
  {
    name: 'miro-official',
    url: 'stdio://miro-mcp-server',
    description: 'Official Miro MCP Server',
    capabilities: ['board_read', 'board_write', 'context'],
  },
];

/** Get all configured endpoints */
export function getEndpoints(): MCPEndpoint[] {
  // Could be extended to read from localStorage or config file
  return defaultMCPEndpoints;
}

/** Get endpoint by name */
export function getEndpoint(name: string): MCPEndpoint | undefined {
  return defaultMCPEndpoints.find((ep) => ep.name === name);
}
