/**
 * MCP Client Module
 * 
 * Import external data via MCP protocol (inbound).
 */

import type { EventBus } from '../../../apps/miro-app/src/core/bus/eventBus.js';
import type { MiroModule, ModuleState, ModuleStartOptions } from '../../../apps/miro-app/src/types/modules.js';

let state: ModuleState = 'registered';
let eventBus: EventBus | null = null;

export const mcpClientModule: MiroModule = {
  id: 'mcp-client',
  name: 'MCP Client',
  description: 'Import external data via MCP protocol',

  registerModule(bus: EventBus, sdk: typeof miro): void {
    eventBus = bus;
    
    bus.on('mcp-inbound', 'mcp:connected', async ({ serverId }) => {
      console.log('[MCPClient] Connected to:', serverId);
    });
  },

  async start(options?: ModuleStartOptions): Promise<void> {
    state = 'active';
    console.log('[MCPClient] Module started');
  },

  async stop(): Promise<void> {
    state = 'stopped';
    console.log('[MCPClient] Module stopped');
  },

  getState(): ModuleState {
    return state;
  },
};

export function createModule(): MiroModule {
  return mcpClientModule;
}

export default mcpClientModule;
