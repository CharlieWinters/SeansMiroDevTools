/**
 * Board state and item type definitions
 */

/** Standard tags for board items */
export type ItemTag =
  | 'ready'
  | 'in-progress'
  | 'implemented'
  | 'needs-review'
  | 'blocked'
  | 'bug';

/** Metadata that can be attached to board items */
export interface ItemMetadata {
  status?: string;
  file?: string;
  last_modified?: string;
  assigned_to?: string;
  [key: string]: string | undefined;
}

/** Parsed representation of a board item */
export interface BoardItem {
  id: string;
  type: string;
  content: string;
  tags: ItemTag[];
  metadata: ItemMetadata;
  parentId?: string;
  position: {
    x: number;
    y: number;
  };
  geometry?: {
    width: number;
    height: number;
  };
}

/** Board selection state */
export interface BoardSelection {
  items: BoardItem[];
  count: number;
}

/** Aggregated board state snapshot */
export interface BoardState {
  selection: BoardSelection;
  itemsByTag: Map<ItemTag, BoardItem[]>;
  itemsById: Map<string, BoardItem>;
  frames: BoardItem[];
  allItems: BoardItem[];
  timestamp: number;
}

/** Event payload for board state changes */
export interface BoardStateChangeEvent {
  previousState: BoardState | null;
  currentState: BoardState;
  changedItems: string[];
}

/** Options for board state queries */
export interface BoardQueryOptions {
  tags?: ItemTag[];
  types?: string[];
  frameId?: string;
  includeChildren?: boolean;
}
