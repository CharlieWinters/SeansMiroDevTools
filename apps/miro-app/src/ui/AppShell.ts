/**
 * App Shell
 *
 * Miro IDE panel: Terminal options and Create terminal button.
 * Only the terminal-embed module is loaded; UI shows options + button.
 */

import { eventBus } from '../core/bus/eventBus.js';
import { createModuleRegistry } from '../core/discovery/moduleRegistry.js';
import { createModuleLoader, BUILT_IN_MODULES } from '../core/discovery/moduleLoader.js';
import { logger } from '../utils/logger.js';

const log = logger.child('AppShell');

/** App Shell state */
interface AppShellState {
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
      log.info('Modules loaded successfully');
    } catch (error) {
      log.error('Failed to load modules:', error);
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
          <section class="terminal-options-section" id="terminal-options-section">
            <h3>Terminal options</h3>
            <p class="terminal-options-desc">Optional: set a session name and start folder for the new terminal.</p>
            <div class="terminal-options-fields">
              <div class="terminal-option-field">
                <label for="terminal-opt-name">Session name</label>
                <input type="text" id="terminal-opt-name" placeholder="e.g. frontend, backend" />
              </div>
              <div class="terminal-option-field">
                <label for="terminal-opt-cwd">Working directory</label>
                <input type="text" id="terminal-opt-cwd" placeholder="e.g. /app, ~/project" />
              </div>
            </div>
            <button type="button" id="create-terminal-btn" class="btn-create-terminal">Create terminal</button>
          </section>
        </main>

        <footer class="app-footer">
          <small>v0.1.0 - Board is control plane</small>
        </footer>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    const btn = this.container?.querySelector('#create-terminal-btn');
    btn?.addEventListener('click', () => this.handleCreateTerminal());
  }

  /**
   * Create terminal embed on the board using form options
   */
  private async handleCreateTerminal(): Promise<void> {
    const nameEl = document.getElementById('terminal-opt-name') as HTMLInputElement | null;
    const cwdEl = document.getElementById('terminal-opt-cwd') as HTMLInputElement | null;
    let sessionName = nameEl?.value?.trim() || undefined;
    let cwd = cwdEl?.value?.trim() || undefined;
    if (!sessionName && !cwd) {
      const p = new URLSearchParams(window.location.search);
      sessionName = p.get('name') ?? undefined;
      cwd = p.get('cwd') ?? undefined;
    }
    const startOptions =
      sessionName ?? cwd ? { config: { sessionName, cwd } } : undefined;

    try {
      log.info('Creating terminal embed', startOptions ?? {});
      await this.registry.start('terminal-embed', startOptions);
      miro.board.notifications.showInfo('Terminal created on board');
    } catch (error) {
      log.error('Failed to create terminal:', error);
      const message = error instanceof Error ? error.message : String(error);
      miro.board.notifications.showError(`Error: ${message}`);
    }
  }
}

// Initialize when DOM is ready
const appShell = new AppShell();

document.addEventListener('DOMContentLoaded', () => {
  appShell.init('app-shell').catch(console.error);
});

export { appShell };
