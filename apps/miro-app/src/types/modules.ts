/**
 * Module system type definitions
 */

import type { EventBus } from '../core/bus/eventBus.js';

/** Module manifest from package.json */
export interface ModuleManifest {
  name: string;
  entry: string;
  description?: string;
  version?: string;
  dependencies?: string[];
}

/** Module lifecycle states */
export type ModuleState = 'registered' | 'loading' | 'active' | 'error' | 'stopped';

/** Module registration info */
export interface ModuleInfo {
  id: string;
  name: string;
  description?: string;
  version?: string;
  state: ModuleState;
  error?: Error;
}

/** Options passed to module start */
export interface ModuleStartOptions {
  config?: Record<string, unknown>;
  containerId?: string;
}

/** Module interface that all modules must implement */
export interface MiroModule {
  /** Unique module identifier */
  readonly id: string;

  /** Human-readable module name */
  readonly name: string;

  /** Optional description */
  readonly description?: string;

  /** Register the module with the app */
  registerModule(bus: EventBus, sdk: typeof miro): void;

  /** Start the module (can be called for standalone run) */
  start(options?: ModuleStartOptions): Promise<void>;

  /** Stop the module */
  stop(): Promise<void>;

  /** Get current module state */
  getState(): ModuleState;
}

/** Module factory function type */
export type ModuleFactory = () => MiroModule;

/** Module registry events */
export interface ModuleRegistryEvents {
  'module:registered': { moduleId: string; info: ModuleInfo };
  'module:started': { moduleId: string };
  'module:stopped': { moduleId: string };
  'module:error': { moduleId: string; error: Error };
}
