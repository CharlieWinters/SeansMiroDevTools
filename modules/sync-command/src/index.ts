/**
 * Sync Command Module
 * 
 * Apply agent changes to board via .miro-updates.json file.
 */

import type { EventBus } from '../../../apps/miro-app/src/core/bus/eventBus.js';
import type { MiroModule, ModuleState, ModuleStartOptions } from '../../../apps/miro-app/src/types/modules.js';

let state: ModuleState = 'registered';
let eventBus: EventBus | null = null;

export const syncCommandModule: MiroModule = {
  id: 'sync-command',
  name: 'Sync Command',
  description: 'Apply agent changes to board via .miro-updates.json',

  registerModule(bus: EventBus, sdk: typeof miro): void {
    eventBus = bus;
    
    bus.on('sync', 'sync:start', async ({ filePath }) => {
      // TODO: Implement sync logic
      console.log('[Sync] Starting sync from:', filePath);
    });
  },

  async start(options?: ModuleStartOptions): Promise<void> {
    state = 'active';
    console.log('[Sync] Module started');
  },

  async stop(): Promise<void> {
    state = 'stopped';
    console.log('[Sync] Module stopped');
  },

  getState(): ModuleState {
    return state;
  },
};

export function createModule(): MiroModule {
  return syncCommandModule;
}

export default syncCommandModule;
