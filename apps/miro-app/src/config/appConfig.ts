/**
 * Application Configuration
 * 
 * Central configuration for the Miro IDE application
 */

export interface AppConfig {
  /** Application name */
  name: string;
  
  /** Application version */
  version: string;
  
  /** Debug mode */
  debug: boolean;
  
  /** Module configuration */
  modules: {
    /** Auto-start modules on load */
    autoStart: boolean;
    /** Module load timeout in ms */
    loadTimeout: number;
  };
  
  /** Board state configuration */
  boardState: {
    /** Cache TTL in ms */
    cacheTtl: number;
    /** Polling interval for updates in ms */
    pollInterval: number;
  };
  
  /** Variable engine configuration */
  variables: {
    /** Strict mode (throw on unresolved) */
    strict: boolean;
    /** Placeholder for unresolved variables */
    unresolvedPlaceholder: string;
  };
  
  /** MCP configuration */
  mcp: {
    /** Default server timeout in ms */
    serverTimeout: number;
  };
}

/** Default configuration */
export const defaultConfig: AppConfig = {
  name: 'Miro IDE',
  version: '0.1.0',
  debug: import.meta.env?.DEV ?? false,
  
  modules: {
    autoStart: false,
    loadTimeout: 10000,
  },
  
  boardState: {
    cacheTtl: 1000,
    pollInterval: 5000,
  },
  
  variables: {
    strict: false,
    unresolvedPlaceholder: '${?}',
  },
  
  mcp: {
    serverTimeout: 30000,
  },
};

/** Current configuration (can be overridden) */
let currentConfig: AppConfig = { ...defaultConfig };

/**
 * Get current configuration
 */
export function getConfig(): AppConfig {
  return currentConfig;
}

/**
 * Update configuration
 */
export function updateConfig(updates: Partial<AppConfig>): void {
  currentConfig = {
    ...currentConfig,
    ...updates,
    modules: {
      ...currentConfig.modules,
      ...updates.modules,
    },
    boardState: {
      ...currentConfig.boardState,
      ...updates.boardState,
    },
    variables: {
      ...currentConfig.variables,
      ...updates.variables,
    },
    mcp: {
      ...currentConfig.mcp,
      ...updates.mcp,
    },
  };
}

/**
 * Reset to default configuration
 */
export function resetConfig(): void {
  currentConfig = { ...defaultConfig };
}
