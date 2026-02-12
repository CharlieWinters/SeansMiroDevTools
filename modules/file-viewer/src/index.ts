/**
 * File Viewer Module
 * 
 * Read-only code preview with syntax highlighting.
 */

import type { EventBus } from '../../../apps/miro-app/src/core/bus/eventBus.js';
import type { MiroModule, ModuleState, ModuleStartOptions } from '../../../apps/miro-app/src/types/modules.js';

let state: ModuleState = 'registered';
let eventBus: EventBus | null = null;

export const fileViewerModule: MiroModule = {
  id: 'file-viewer',
  name: 'File Viewer',
  description: 'Read-only code preview with syntax highlighting',

  registerModule(bus: EventBus, sdk: typeof miro): void {
    eventBus = bus;
    
    bus.on('files', 'file:opened', async ({ path, content }) => {
      // TODO: Implement file display
      console.log('[FileViewer] Opened:', path);
    });
  },

  async start(options?: ModuleStartOptions): Promise<void> {
    state = 'active';
    console.log('[FileViewer] Module started');
  },

  async stop(): Promise<void> {
    state = 'stopped';
    console.log('[FileViewer] Module stopped');
  },

  getState(): ModuleState {
    return state;
  },
};

export function createModule(): MiroModule {
  return fileViewerModule;
}

export default fileViewerModule;
