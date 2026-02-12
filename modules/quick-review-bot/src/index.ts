/**
 * Quick Review Bot Module
 * 
 * Fast navigation through board content.
 */

import type { EventBus } from '../../../apps/miro-app/src/core/bus/eventBus.js';
import type { MiroModule, ModuleState, ModuleStartOptions } from '../../../apps/miro-app/src/types/modules.js';

let state: ModuleState = 'registered';
let eventBus: EventBus | null = null;
let miroSdk: typeof miro | null = null;

export const quickReviewBotModule: MiroModule = {
  id: 'quick-review-bot',
  name: 'Quick Review Bot',
  description: 'Fast navigation through board content',

  registerModule(bus: EventBus, sdk: typeof miro): void {
    eventBus = bus;
    miroSdk = sdk;
    
    bus.on('review', 'navigate:tag', async ({ tag }) => {
      // TODO: Navigate to items with tag
      console.log('[ReviewBot] Navigate to tag:', tag);
    });

    bus.on('review', 'navigate:frame', async ({ frameId }) => {
      // TODO: Navigate to frame
      console.log('[ReviewBot] Navigate to frame:', frameId);
    });
  },

  async start(options?: ModuleStartOptions): Promise<void> {
    state = 'active';
    console.log('[ReviewBot] Module started');
  },

  async stop(): Promise<void> {
    state = 'stopped';
    console.log('[ReviewBot] Module stopped');
  },

  getState(): ModuleState {
    return state;
  },
};

export function createModule(): MiroModule {
  return quickReviewBotModule;
}

export default quickReviewBotModule;
