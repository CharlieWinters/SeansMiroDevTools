/**
 * Module Registry
 * 
 * Discovers, registers, and manages the lifecycle of modules.
 * Modules are independently runnable units that can communicate via the event bus.
 */

import { eventBus, type EventBus } from '../bus/eventBus.js';
import type {
  MiroModule,
  ModuleFactory,
  ModuleInfo,
  ModuleState,
  ModuleManifest,
  ModuleStartOptions,
} from '../../types/modules.js';

/** Module registration entry */
interface ModuleEntry {
  module: MiroModule;
  info: ModuleInfo;
  factory?: ModuleFactory;
}

/**
 * ModuleRegistry class
 * 
 * Central registry for all modules in the application
 */
export class ModuleRegistry {
  private modules: Map<string, ModuleEntry> = new Map();
  private bus: EventBus;
  private sdk: typeof miro;

  constructor(bus: EventBus, sdk: typeof miro) {
    this.bus = bus;
    this.sdk = sdk;
  }

  /**
   * Register a module instance
   */
  register(module: MiroModule): void {
    if (this.modules.has(module.id)) {
      throw new Error(`Module with id "${module.id}" is already registered`);
    }

    const info: ModuleInfo = {
      id: module.id,
      name: module.name,
      description: module.description,
      state: 'registered',
    };

    this.modules.set(module.id, { module, info });

    // Let the module register with the bus and SDK
    module.registerModule(this.bus, this.sdk);

    // Emit registration event
    this.bus.emit('modules', 'module:registered', { moduleId: module.id, info });
  }

  /**
   * Register a module factory (lazy instantiation)
   */
  registerFactory(id: string, factory: ModuleFactory, manifest?: Partial<ModuleManifest>): void {
    if (this.modules.has(id)) {
      throw new Error(`Module with id "${id}" is already registered`);
    }

    const info: ModuleInfo = {
      id,
      name: manifest?.name ?? id,
      description: manifest?.description,
      version: manifest?.version,
      state: 'registered',
    };

    // Create placeholder entry with factory
    this.modules.set(id, {
      module: null as unknown as MiroModule, // Will be instantiated on start
      info,
      factory,
    });

    this.bus.emit('modules', 'module:registered', { moduleId: id, info });
  }

  /**
   * Get module info by ID
   */
  getModuleInfo(id: string): ModuleInfo | undefined {
    return this.modules.get(id)?.info;
  }

  /**
   * Get all registered modules
   */
  getAllModules(): ModuleInfo[] {
    return Array.from(this.modules.values()).map((entry) => entry.info);
  }

  /**
   * Get modules by state
   */
  getModulesByState(state: ModuleState): ModuleInfo[] {
    return Array.from(this.modules.values())
      .filter((entry) => entry.info.state === state)
      .map((entry) => entry.info);
  }

  /**
   * Check if a module is registered
   */
  has(id: string): boolean {
    return this.modules.has(id);
  }

  /**
   * Start a module
   */
  async start(id: string, options?: ModuleStartOptions): Promise<void> {
    const entry = this.modules.get(id);
    
    if (!entry) {
      throw new Error(`Module "${id}" is not registered`);
    }

    if (entry.info.state === 'active') {
      console.warn(`Module "${id}" is already active`);
      return;
    }

    try {
      // Update state to loading
      entry.info.state = 'loading';

      // Instantiate from factory if needed
      if (entry.factory && !entry.module) {
        entry.module = entry.factory();
        entry.module.registerModule(this.bus, this.sdk);
      }

      // Start the module
      await entry.module.start(options);

      // Update state to active
      entry.info.state = 'active';
      entry.info.error = undefined;

      this.bus.emit('modules', 'module:started', { moduleId: id });
    } catch (error) {
      entry.info.state = 'error';
      entry.info.error = error instanceof Error ? error : new Error(String(error));

      this.bus.emit('modules', 'module:error', { 
        moduleId: id, 
        error: entry.info.error 
      });

      throw error;
    }
  }

  /**
   * Stop a module
   */
  async stop(id: string): Promise<void> {
    const entry = this.modules.get(id);
    
    if (!entry) {
      throw new Error(`Module "${id}" is not registered`);
    }

    if (entry.info.state !== 'active') {
      console.warn(`Module "${id}" is not active`);
      return;
    }

    try {
      await entry.module.stop();
      entry.info.state = 'stopped';
      
      this.bus.emit('modules', 'module:stopped', { moduleId: id });
    } catch (error) {
      entry.info.state = 'error';
      entry.info.error = error instanceof Error ? error : new Error(String(error));

      this.bus.emit('modules', 'module:error', { 
        moduleId: id, 
        error: entry.info.error 
      });

      throw error;
    }
  }

  /**
   * Restart a module
   */
  async restart(id: string, options?: ModuleStartOptions): Promise<void> {
    await this.stop(id);
    await this.start(id, options);
  }

  /**
   * Start all registered modules
   */
  async startAll(options?: ModuleStartOptions): Promise<void> {
    const modules = this.getAllModules();
    
    for (const info of modules) {
      if (info.state === 'registered' || info.state === 'stopped') {
        try {
          await this.start(info.id, options);
        } catch (error) {
          console.error(`Failed to start module "${info.id}":`, error);
        }
      }
    }
  }

  /**
   * Stop all active modules
   */
  async stopAll(): Promise<void> {
    const activeModules = this.getModulesByState('active');
    
    for (const info of activeModules) {
      try {
        await this.stop(info.id);
      } catch (error) {
        console.error(`Failed to stop module "${info.id}":`, error);
      }
    }
  }

  /**
   * Unregister a module (must be stopped first)
   */
  unregister(id: string): void {
    const entry = this.modules.get(id);
    
    if (!entry) {
      return;
    }

    if (entry.info.state === 'active') {
      throw new Error(`Cannot unregister active module "${id}". Stop it first.`);
    }

    this.modules.delete(id);
  }

  /**
   * Get the module instance (for advanced use cases)
   */
  getModule(id: string): MiroModule | undefined {
    return this.modules.get(id)?.module;
  }
}

/**
 * Create a base module implementation helper
 */
export function createModule(config: {
  id: string;
  name: string;
  description?: string;
  onRegister?: (bus: EventBus, sdk: typeof miro) => void;
  onStart?: (options?: ModuleStartOptions) => Promise<void>;
  onStop?: () => Promise<void>;
}): MiroModule {
  let state: ModuleState = 'registered';
  let bus: EventBus | null = null;
  let sdk: typeof miro | null = null;

  return {
    id: config.id,
    name: config.name,
    description: config.description,

    registerModule(eventBus: EventBus, miroSdk: typeof miro): void {
      bus = eventBus;
      sdk = miroSdk;
      config.onRegister?.(eventBus, miroSdk);
    },

    async start(options?: ModuleStartOptions): Promise<void> {
      if (config.onStart) {
        await config.onStart(options);
      }
      state = 'active';
    },

    async stop(): Promise<void> {
      if (config.onStop) {
        await config.onStop();
      }
      state = 'stopped';
    },

    getState(): ModuleState {
      return state;
    },
  };
}

// Factory function to create a registry instance
export function createModuleRegistry(bus: EventBus = eventBus): ModuleRegistry {
  return new ModuleRegistry(bus, miro);
}
