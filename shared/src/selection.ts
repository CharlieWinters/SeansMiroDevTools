/**
 * Selection Utilities
 * 
 * Helper functions for working with board selections.
 */

/** Selection info summary */
export interface SelectionSummary {
  count: number;
  types: Record<string, number>;
  hasStickies: boolean;
  hasFrames: boolean;
  firstItemId: string | null;
}

/**
 * Create a summary of a selection
 */
export function summarizeSelection(items: Array<{ id: string; type: string }>): SelectionSummary {
  const types: Record<string, number> = {};

  for (const item of items) {
    types[item.type] = (types[item.type] ?? 0) + 1;
  }

  return {
    count: items.length,
    types,
    hasStickies: (types['sticky_note'] ?? 0) > 0,
    hasFrames: (types['frame'] ?? 0) > 0,
    firstItemId: items[0]?.id ?? null,
  };
}

/**
 * Filter items by type
 */
export function filterByType<T extends { type: string }>(items: T[], type: string): T[] {
  return items.filter((item) => item.type === type);
}

/**
 * Get unique types from items
 */
export function getUniqueTypes(items: Array<{ type: string }>): string[] {
  return [...new Set(items.map((item) => item.type))];
}

/**
 * Check if selection contains a specific item type
 */
export function hasItemType(items: Array<{ type: string }>, type: string): boolean {
  return items.some((item) => item.type === type);
}
