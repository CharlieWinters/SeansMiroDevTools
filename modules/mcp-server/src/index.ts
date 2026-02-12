/**
 * MCP Server Module
 * 
 * Expose board data to coding agents (outbound).
 */

import type { EventBus } from '../../../apps/miro-app/src/core/bus/eventBus.js';
import type { MiroModule, ModuleState, ModuleStartOptions } from '../../../apps/miro-app/src/types/modules.js';

let state: ModuleState = 'registered';
let eventBus: EventBus | null = null;

export const mcpServerModule: MiroModule = {
  id: 'mcp-server',
  name: 'MCP Server',
  description: 'Expose board data to coding agents',

  registerModule(bus: EventBus, sdk: typeof miro): void {
    eventBus = bus;
    
    bus.on('mcp-outbound', 'mcp:tool-called', async ({ request, response }) => {
      console.log('[MCPServer] Tool called:', request.toolName);
    });
  },

  async start(options?: ModuleStartOptions): Promise<void> {
    state = 'active';
    console.log('[MCPServer] Module started');
  },

  async stop(): Promise<void> {
    state = 'stopped';
    console.log('[MCPServer] Module stopped');
  },

  getState(): ModuleState {
    return state;
  },
};

export function createModule(): MiroModule {
  return mcpServerModule;
}

export default mcpServerModule;
