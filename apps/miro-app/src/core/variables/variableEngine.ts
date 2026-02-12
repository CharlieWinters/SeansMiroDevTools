/**
 * Variable Engine
 * 
 * Expands placeholders in strings with values from:
 * - Board selection content
 * - Item tags and metadata
 * - User-defined variables
 * - Environment variables
 */

import { boardStateReader } from '../boardState/boardStateReader.js';
import type { BoardItem, ItemMetadata } from '../../types/board.js';

/** Built-in variable names */
export type BuiltInVariable =
  | 'selection'
  | 'selection.content'
  | 'selection.tags'
  | 'selection.id'
  | 'selection.ids'
  | 'metadata.*'
  | 'tag.*'
  | 'frame'
  | 'frame.name'
  | 'board.id';

/** Variable placeholder pattern: ${varname} or $varname */
const VARIABLE_PATTERN = /\$\{([^}]+)\}|\$([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)/g;

/** Result of variable expansion */
export interface ExpansionResult {
  /** The expanded string */
  expanded: string;
  /** Variables that were found and expanded */
  resolved: Record<string, string>;
  /** Variables that could not be resolved */
  unresolved: string[];
  /** Whether all variables were resolved */
  complete: boolean;
}

/** Options for variable expansion */
export interface ExpansionOptions {
  /** Custom variables to include */
  variables?: Record<string, string>;
  /** Whether to throw on unresolved variables */
  strict?: boolean;
  /** Placeholder for unresolved variables */
  unresolvedPlaceholder?: string;
}

/**
 * VariableEngine class
 * 
 * Handles variable expansion with support for board state and custom variables
 */
export class VariableEngine {
  private customVariables: Map<string, string> = new Map();

  /**
   * Set a custom variable
   */
  setVariable(name: string, value: string): void {
    this.customVariables.set(name, value);
  }

  /**
   * Remove a custom variable
   */
  removeVariable(name: string): void {
    this.customVariables.delete(name);
  }

  /**
   * Get a custom variable value
   */
  getVariable(name: string): string | undefined {
    return this.customVariables.get(name);
  }

  /**
   * Set multiple variables at once
   */
  setVariables(variables: Record<string, string>): void {
    for (const [name, value] of Object.entries(variables)) {
      this.customVariables.set(name, value);
    }
  }

  /**
   * Clear all custom variables
   */
  clearVariables(): void {
    this.customVariables.clear();
  }

  /**
   * Get all current custom variables
   */
  getAllVariables(): Record<string, string> {
    return Object.fromEntries(this.customVariables);
  }

  /**
   * Resolve a single variable name to its value
   */
  private async resolveVariable(
    name: string,
    selection: BoardItem[],
    options: ExpansionOptions
  ): Promise<string | undefined> {
    // Check custom variables from options first
    if (options.variables && name in options.variables) {
      return options.variables[name];
    }

    // Check instance custom variables
    if (this.customVariables.has(name)) {
      return this.customVariables.get(name);
    }

    // Handle built-in variables
    const lowerName = name.toLowerCase();

    // Selection content
    if (lowerName === 'selection' || lowerName === 'selection.content') {
      return selection.map((item) => item.content).join('\n');
    }

    // Selection ID (first item)
    if (lowerName === 'selection.id') {
      return selection[0]?.id ?? '';
    }

    // All selection IDs
    if (lowerName === 'selection.ids') {
      return selection.map((item) => item.id).join(',');
    }

    // Selection tags
    if (lowerName === 'selection.tags') {
      const allTags = selection.flatMap((item) => item.tags);
      return [...new Set(allTags)].join(',');
    }

    // Metadata from selection (metadata.key format)
    if (lowerName.startsWith('metadata.')) {
      const key = name.substring(9); // Remove 'metadata.'
      const firstItem = selection[0];
      return firstItem?.metadata[key] ?? '';
    }

    // Tag check (tag.tagname returns 'true' if any selected item has the tag)
    if (lowerName.startsWith('tag.')) {
      const tagName = name.substring(4); // Remove 'tag.'
      const hasTag = selection.some((item) =>
        item.tags.some((t) => t.toLowerCase() === tagName.toLowerCase())
      );
      return hasTag ? 'true' : 'false';
    }

    // Frame name (if selection is in a frame)
    if (lowerName === 'frame' || lowerName === 'frame.name') {
      const firstItem = selection[0];
      if (firstItem?.parentId) {
        const frame = await boardStateReader.getItemById(firstItem.parentId);
        return frame?.content ?? '';
      }
      return '';
    }

    // Board ID
    if (lowerName === 'board.id') {
      const info = await miro.board.getInfo();
      return info.id;
    }

    // Environment variable fallback (for $HOME, $PATH, etc.)
    // Note: Won't work in browser, but useful for CLI/Node contexts
    if (typeof process !== 'undefined' && process.env && name in process.env) {
      return process.env[name];
    }

    return undefined;
  }

  /**
   * Find all variables in a string
   */
  findVariables(input: string): string[] {
    const variables: string[] = [];
    let match: RegExpExecArray | null;

    VARIABLE_PATTERN.lastIndex = 0;
    while ((match = VARIABLE_PATTERN.exec(input)) !== null) {
      const varName = match[1] ?? match[2];
      if (!variables.includes(varName)) {
        variables.push(varName);
      }
    }

    return variables;
  }

  /**
   * Check if a string contains variables
   */
  hasVariables(input: string): boolean {
    VARIABLE_PATTERN.lastIndex = 0;
    return VARIABLE_PATTERN.test(input);
  }

  /**
   * Expand all variables in a string
   */
  async expand(input: string, options: ExpansionOptions = {}): Promise<ExpansionResult> {
    const selection = await boardStateReader.getSelection();
    const resolved: Record<string, string> = {};
    const unresolved: string[] = [];

    // Find all variables first
    const variables = this.findVariables(input);

    // Resolve each variable
    for (const varName of variables) {
      const value = await this.resolveVariable(varName, selection.items, options);
      
      if (value !== undefined) {
        resolved[varName] = value;
      } else {
        unresolved.push(varName);
      }
    }

    // Build expanded string
    let expanded = input;
    VARIABLE_PATTERN.lastIndex = 0;

    expanded = input.replace(VARIABLE_PATTERN, (match, braced, plain) => {
      const varName = braced ?? plain;
      
      if (varName in resolved) {
        return resolved[varName];
      }
      
      if (options.strict) {
        throw new Error(`Unresolved variable: ${varName}`);
      }
      
      return options.unresolvedPlaceholder ?? match;
    });

    return {
      expanded,
      resolved,
      unresolved,
      complete: unresolved.length === 0,
    };
  }

  /**
   * Preview expansion without actually resolving (shows what would be replaced)
   */
  async preview(input: string, options: ExpansionOptions = {}): Promise<{
    original: string;
    preview: string;
    variables: Array<{ name: string; value: string | null }>;
  }> {
    const selection = await boardStateReader.getSelection();
    const variables: Array<{ name: string; value: string | null }> = [];

    for (const varName of this.findVariables(input)) {
      const value = await this.resolveVariable(varName, selection.items, options);
      variables.push({ name: varName, value: value ?? null });
    }

    // Build preview with highlights
    let preview = input;
    VARIABLE_PATTERN.lastIndex = 0;
    
    preview = input.replace(VARIABLE_PATTERN, (match, braced, plain) => {
      const varName = braced ?? plain;
      const varInfo = variables.find((v) => v.name === varName);
      
      if (varInfo?.value !== null) {
        return `[${varName}=${varInfo.value}]`;
      }
      
      return `[${varName}=?]`;
    });

    return {
      original: input,
      preview,
      variables,
    };
  }

  /**
   * Validate that all variables in a string can be resolved
   */
  async validate(input: string, options: ExpansionOptions = {}): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const result = await this.expand(input, options);
    
    return {
      valid: result.complete,
      errors: result.unresolved.map((v) => `Unresolved variable: ${v}`),
    };
  }
}

// Export singleton instance
export const variableEngine = new VariableEngine();
