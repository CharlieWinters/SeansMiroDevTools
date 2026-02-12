/**
 * Command History
 * 
 * Manages history of terminal commands for recall and persistence.
 */

export interface HistoryEntry {
  command: string;
  timestamp: number;
  exitCode?: number;
}

export class CommandHistory {
  private history: HistoryEntry[] = [];
  private position = -1;
  private readonly maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  /**
   * Add a command to history
   */
  push(command: string, exitCode?: number): void {
    // Don't add duplicates of the last command
    if (this.history.length > 0 && this.history[this.history.length - 1].command === command) {
      return;
    }

    this.history.push({
      command,
      timestamp: Date.now(),
      exitCode,
    });

    // Trim if exceeds max size
    if (this.history.length > this.maxSize) {
      this.history.shift();
    }

    // Reset position to end
    this.position = this.history.length;
  }

  /**
   * Get previous command (up arrow)
   */
  previous(): string | null {
    if (this.position > 0) {
      this.position--;
      return this.history[this.position].command;
    }
    return this.history[0]?.command ?? null;
  }

  /**
   * Get next command (down arrow)
   */
  next(): string | null {
    if (this.position < this.history.length - 1) {
      this.position++;
      return this.history[this.position].command;
    }
    this.position = this.history.length;
    return null;
  }

  /**
   * Reset position to end
   */
  resetPosition(): void {
    this.position = this.history.length;
  }

  /**
   * Get all history entries
   */
  getAll(): HistoryEntry[] {
    return [...this.history];
  }

  /**
   * Search history for commands matching pattern
   */
  search(pattern: string): HistoryEntry[] {
    const regex = new RegExp(pattern, 'i');
    return this.history.filter((entry) => regex.test(entry.command));
  }

  /**
   * Clear history
   */
  clear(): void {
    this.history = [];
    this.position = -1;
  }

  /**
   * Serialize for persistence
   */
  serialize(): string {
    return JSON.stringify(this.history);
  }

  /**
   * Load from serialized data
   */
  load(data: string): void {
    try {
      this.history = JSON.parse(data);
      this.position = this.history.length;
    } catch {
      this.history = [];
      this.position = -1;
    }
  }
}
