/**
 * App Shell
 * 
 * Main UI shell for the Miro IDE panel.
 * Displays registered modules and provides navigation.
 */

import { eventBus } from '../core/bus/eventBus.js';
import { createModuleRegistry } from '../core/discovery/moduleRegistry.js';
import { createModuleLoader, BUILT_IN_MODULES } from '../core/discovery/moduleLoader.js';
import { logger } from '../utils/logger.js';
import type { ModuleInfo } from '../types/modules.js';

const log = logger.child('AppShell');

/** App Shell state */
interface AppShellState {
  modules: ModuleInfo[];
  activeModule: string | null;
  loading: boolean;
}

/**
 * AppShell class
 * 
 * Manages the main application UI and module lifecycle
 */
class AppShell {
  private container: HTMLElement | null = null;
  private registry = createModuleRegistry(eventBus);
  private loader = createModuleLoader(this.registry);
  private state: AppShellState = {
    modules: [],
    activeModule: null,
    loading: true,
  };

  /**
   * Initialize the app shell
   */
  async init(containerId: string): Promise<void> {
    this.container = document.getElementById(containerId);
    
    if (!this.container) {
      throw new Error(`Container element "${containerId}" not found`);
    }

    // Subscribe to module events
    eventBus.on('modules', 'module:registered', ({ info }) => {
      this.state.modules = this.registry.getAllModules();
      this.render();
    });

    eventBus.on('modules', 'module:started', ({ moduleId }) => {
      this.state.activeModule = moduleId;
      this.render();
    });

    eventBus.on('modules', 'module:stopped', ({ moduleId }) => {
      if (this.state.activeModule === moduleId) {
        this.state.activeModule = null;
      }
      this.render();
    });

    // Initial render
    this.render();

    // Load built-in modules
    await this.loadBuiltInModules();
  }

  /**
   * Load built-in modules
   */
  private async loadBuiltInModules(): Promise<void> {
    this.state.loading = true;
    this.render();

    try {
      log.info('Loading built-in modules:', BUILT_IN_MODULES.length);
      
      // Actually load the modules using the loader
      await this.loader.loadModules(BUILT_IN_MODULES);
      
      // Get the registered modules from the registry
      this.state.modules = this.registry.getAllModules();
      
      log.info('Modules loaded successfully');
    } catch (error) {
      log.error('Failed to load modules:', error);
      // Fallback to showing module manifests if loading fails
      this.state.modules = BUILT_IN_MODULES.map((manifest) => ({
        id: manifest.name,
        name: manifest.name,
        description: manifest.description,
        version: manifest.version,
        state: 'registered' as const,
      }));
    } finally {
      this.state.loading = false;
      this.render();
    }
  }

  /**
   * Render the app shell
   */
  private render(): void {
    if (!this.container) return;

    if (this.state.loading) {
      this.container.innerHTML = `
        <div class="app-shell">
          <header class="app-header">
            <h2>Miro IDE</h2>
          </header>
          <main class="app-content">
            <div class="loading">Loading modules...</div>
          </main>
        </div>
      `;
      return;
    }

    this.container.innerHTML = `
      <div class="app-shell">
        <header class="app-header">
          <h2>Miro IDE</h2>
          <p class="app-subtitle">Modular development environment</p>
        </header>
        
        <main class="app-content">
          <section class="module-section">
            <h3>Modules</h3>
            <div class="module-list">
              ${this.renderModuleList()}
            </div>
          </section>
          
          <section class="status-section">
            <h3>Status</h3>
            <div class="status-info">
              <div class="status-item">
                <span class="status-label">Registered:</span>
                <span class="status-value">${this.state.modules.length}</span>
              </div>
              <div class="status-item">
                <span class="status-label">Active:</span>
                <span class="status-value">${this.state.activeModule ?? 'None'}</span>
              </div>
            </div>
          </section>
        </main>
        
        <footer class="app-footer">
          <small>v0.1.0 - Board is control plane</small>
        </footer>
      </div>
    `;

    // Attach event listeners
    this.attachEventListeners();
  }

  /**
   * Render the module list
   */
  private renderModuleList(): string {
    if (this.state.modules.length === 0) {
      return '<p class="no-modules">No modules registered</p>';
    }

    return this.state.modules
      .map((module) => `
        <div class="module-item" data-module-id="${module.id}">
          <div class="module-info">
            <span class="status-indicator ${module.state === 'active' ? 'active' : 'inactive'}"></span>
            <div class="module-details">
              <span class="module-item-name">${module.name}</span>
              <span class="module-item-description">${module.description ?? ''}</span>
            </div>
          </div>
          <span class="module-state">${module.state}</span>
        </div>
      `)
      .join('');
  }

  /**
   * Attach event listeners to rendered elements
   */
  private attachEventListeners(): void {
    const moduleItems = this.container?.querySelectorAll('.module-item');
    
    moduleItems?.forEach((item) => {
      item.addEventListener('click', async (event) => {
        const moduleId = (item as HTMLElement).dataset.moduleId;
        if (moduleId) {
          await this.handleModuleClick(moduleId);
        }
      });
    });
  }

  /**
   * Handle module item click
   */
  private async handleModuleClick(moduleId: string): Promise<void> {
    log.info(`Module clicked: ${moduleId}`);
    
    const moduleInfo = this.state.modules.find((m) => m.id === moduleId);
    
    if (!moduleInfo) {
      log.error(`Module not found: ${moduleId}`);
      return;
    }

    try {
      if (moduleInfo.state === 'active') {
        // Stop the module if it's already active
        log.info(`Stopping module: ${moduleId}`);
        await this.registry.stop(moduleId);
        miro.board.notifications.showInfo(`Stopped: ${moduleInfo.name}`);
      } else {
        // Start the module
        log.info(`Starting module: ${moduleId}`);
        await this.registry.start(moduleId);
        miro.board.notifications.showInfo(`Started: ${moduleInfo.name}`);
      }
      
      // Update module list from registry
      this.state.modules = this.registry.getAllModules();
      this.render();
    } catch (error) {
      log.error(`Failed to toggle module ${moduleId}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      miro.board.notifications.showError(`Error: ${errorMessage}`);
    }
  }
}

// Initialize when DOM is ready
const appShell = new AppShell();

document.addEventListener('DOMContentLoaded', () => {
  appShell.init('app-shell').catch(console.error);
});

export { appShell };
