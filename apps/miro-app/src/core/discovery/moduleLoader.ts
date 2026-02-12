/**
 * Module Loader
 * 
 * Loads modules from static imports (Vite-compatible).
 * Uses a module map for reliable bundling.
 */

import type { ModuleManifest, ModuleFactory, MiroModule } from '../../types/modules.js';
import { ModuleRegistry } from './moduleRegistry.js';

// Static imports for all built-in modules (using Vite aliases)
import { createModule as createTerminalEmbed } from '@miro-ide/terminal-embed';
import { createModule as createSyncCommand } from '@miro-ide/sync-command';
import { createModule as createMcpClient } from '@miro-ide/mcp-client';
import { createModule as createMcpServer } from '@miro-ide/mcp-server';
import { createModule as createFileViewer } from '@miro-ide/file-viewer';
import { createModule as createQuickReviewBot } from '@miro-ide/quick-review-bot';

/** Static module factory map */
const MODULE_FACTORIES: Record<string, ModuleFactory> = {
  'terminal-embed': createTerminalEmbed,
  'sync-command': createSyncCommand,
  'mcp-client': createMcpClient,
  'mcp-server': createMcpServer,
  'file-viewer': createFileViewer,
  'quick-review-bot': createQuickReviewBot,
};

/** Module discovery result */
export interface DiscoveredModule {
  manifest: ModuleManifest;
  path: string;
}

/**
 * ModuleLoader class
 * 
 * Handles module loading using static imports
 */
export class ModuleLoader {
  private registry: ModuleRegistry;
  private loadedModules: Map<string, MiroModule> = new Map();

  constructor(registry: ModuleRegistry) {
    this.registry = registry;
  }

  /**
   * Load a module by its manifest
   */
  async loadModule(manifest: ModuleManifest): Promise<void> {
    if (this.loadedModules.has(manifest.name)) {
      console.warn(`Module "${manifest.name}" is already loaded`);
      return;
    }

    try {
      // Get the factory from the static map
      const factory = MODULE_FACTORIES[manifest.name];

      if (typeof factory !== 'function') {
        throw new Error(
          `Module "${manifest.name}" not found in module factory map`
        );
      }

      // Register the factory with the registry
      this.registry.registerFactory(manifest.name, factory, manifest);
      
      // Store the module instance
      const module = factory();
      this.loadedModules.set(manifest.name, module);

      console.log(`Loaded module: ${manifest.name}`);
    } catch (error) {
      console.error(`Failed to load module "${manifest.name}":`, error);
      throw error;
    }
  }

  /**
   * Load multiple modules from manifests
   */
  async loadModules(manifests: ModuleManifest[]): Promise<void> {
    for (const manifest of manifests) {
      try {
        await this.loadModule(manifest);
      } catch (error) {
        console.error(`Skipping module "${manifest.name}" due to error:`, error);
      }
    }
  }

  /**
   * Get list of loaded module names
   */
  getLoadedModules(): string[] {
    return Array.from(this.loadedModules.keys());
  }

  /**
   * Check if a module is loaded
   */
  isLoaded(name: string): boolean {
    return this.loadedModules.has(name);
  }
}

/**
 * Built-in module manifests
 * These are the modules defined in the project structure
 */
export const BUILT_IN_MODULES: ModuleManifest[] = [
  {
    name: 'terminal-embed',
    entry: '@miro-ide/terminal-embed',
    description: 'Execute commands with variable replacement',
  },
  {
    name: 'sync-command',
    entry: '@miro-ide/sync-command',
    description: 'Apply agent changes to board via .miro-updates.json',
  },
  {
    name: 'mcp-client',
    entry: '@miro-ide/mcp-client',
    description: 'Import external data via MCP protocol',
  },
  {
    name: 'mcp-server',
    entry: '@miro-ide/mcp-server',
    description: 'Expose board data to coding agents',
  },
  {
    name: 'file-viewer',
    entry: '@miro-ide/file-viewer',
    description: 'Read-only code preview with syntax highlighting',
  },
  {
    name: 'quick-review-bot',
    entry: '@miro-ide/quick-review-bot',
    description: 'Fast navigation through board content',
  },
];

/**
 * Create a module loader instance
 */
export function createModuleLoader(registry: ModuleRegistry): ModuleLoader {
  return new ModuleLoader(registry);
}
