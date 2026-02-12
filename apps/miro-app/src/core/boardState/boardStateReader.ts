/**
 * Board State Reader
 * 
 * Reads and parses board state from the Miro SDK, including:
 * - Current selection
 * - Items by tag
 * - Item metadata
 * - Frame hierarchies
 */

import type {
  BoardItem,
  BoardState,
  BoardSelection,
  BoardQueryOptions,
  ItemTag,
  ItemMetadata,
} from '../../types/board.js';

/** Tag pattern: #tagname at start or in content */
const TAG_PATTERN = /#(ready|in-progress|implemented|needs-review|blocked|bug)\b/gi;

/** Metadata pattern: @key=value or @key="value with spaces" */
const METADATA_PATTERN = /@(\w+)=(?:"([^"]+)"|(\S+))/g;

/**
 * Parse tags from item content
 */
function parseTags(content: string): ItemTag[] {
  const tags: ItemTag[] = [];
  let match: RegExpExecArray | null;
  
  TAG_PATTERN.lastIndex = 0;
  while ((match = TAG_PATTERN.exec(content)) !== null) {
    const tag = match[1].toLowerCase() as ItemTag;
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  }
  
  return tags;
}

/**
 * Parse metadata from item content
 */
function parseMetadata(content: string): ItemMetadata {
  const metadata: ItemMetadata = {};
  let match: RegExpExecArray | null;
  
  METADATA_PATTERN.lastIndex = 0;
  while ((match = METADATA_PATTERN.exec(content)) !== null) {
    const key = match[1];
    const value = match[2] ?? match[3]; // Quoted or unquoted
    metadata[key] = value;
  }
  
  return metadata;
}

/**
 * Strip HTML tags from content
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Convert a Miro SDK item to our BoardItem format
 */
function convertToBoardItem(item: unknown): BoardItem {
  const miroItem = item as {
    id: string;
    type: string;
    content?: string;
    parentId?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  
  const rawContent = miroItem.content ?? '';
  const content = stripHtml(rawContent);
  
  return {
    id: miroItem.id,
    type: miroItem.type,
    content,
    tags: parseTags(content),
    metadata: parseMetadata(content),
    parentId: miroItem.parentId,
    position: {
      x: miroItem.x ?? 0,
      y: miroItem.y ?? 0,
    },
    geometry: miroItem.width && miroItem.height
      ? { width: miroItem.width, height: miroItem.height }
      : undefined,
  };
}

/**
 * BoardStateReader class
 * 
 * Provides methods to read and query the current board state
 */
export class BoardStateReader {
  private cachedState: BoardState | null = null;
  private cacheTimestamp = 0;
  private readonly cacheTtlMs = 1000; // 1 second cache

  /**
   * Get the current board selection
   */
  async getSelection(): Promise<BoardSelection> {
    const selected = await miro.board.getSelection();
    const items = selected.map(convertToBoardItem);
    
    return {
      items,
      count: items.length,
    };
  }

  /**
   * Get all items on the board
   */
  async getAllItems(): Promise<BoardItem[]> {
    const items = await miro.board.get();
    return items.map(convertToBoardItem);
  }

  /**
   * Get items matching specific tags
   */
  async getItemsByTag(tag: ItemTag): Promise<BoardItem[]> {
    const allItems = await this.getAllItems();
    return allItems.filter((item) => item.tags.includes(tag));
  }

  /**
   * Get items by type (sticky_note, shape, frame, etc.)
   */
  async getItemsByType(type: string): Promise<BoardItem[]> {
    const items = await miro.board.get({ type: [type] as never });
    return items.map(convertToBoardItem);
  }

  /**
   * Get all frames on the board
   */
  async getFrames(): Promise<BoardItem[]> {
    return this.getItemsByType('frame');
  }

  /**
   * Get items within a specific frame
   */
  async getItemsInFrame(frameId: string): Promise<BoardItem[]> {
    const allItems = await this.getAllItems();
    return allItems.filter((item) => item.parentId === frameId);
  }

  /**
   * Get a single item by ID
   */
  async getItemById(id: string): Promise<BoardItem | null> {
    try {
      const item = await miro.board.getById(id);
      return item ? convertToBoardItem(item) : null;
    } catch {
      return null;
    }
  }

  /**
   * Query items with flexible options
   */
  async queryItems(options: BoardQueryOptions): Promise<BoardItem[]> {
    let items = await this.getAllItems();

    // Filter by frame
    if (options.frameId) {
      if (options.includeChildren) {
        items = items.filter((item) => item.parentId === options.frameId);
      } else {
        items = items.filter((item) => item.id === options.frameId);
      }
    }

    // Filter by types
    if (options.types && options.types.length > 0) {
      items = items.filter((item) => options.types!.includes(item.type));
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      items = items.filter((item) =>
        options.tags!.some((tag) => item.tags.includes(tag))
      );
    }

    return items;
  }

  /**
   * Get complete board state snapshot
   */
  async getBoardState(forceRefresh = false): Promise<BoardState> {
    const now = Date.now();
    
    // Return cached state if still valid
    if (!forceRefresh && this.cachedState && (now - this.cacheTimestamp) < this.cacheTtlMs) {
      return this.cachedState;
    }

    const [selection, allItems, frames] = await Promise.all([
      this.getSelection(),
      this.getAllItems(),
      this.getFrames(),
    ]);

    // Build lookup maps
    const itemsByTag = new Map<ItemTag, BoardItem[]>();
    const itemsById = new Map<string, BoardItem>();

    for (const item of allItems) {
      itemsById.set(item.id, item);
      
      for (const tag of item.tags) {
        const existing = itemsByTag.get(tag) ?? [];
        existing.push(item);
        itemsByTag.set(tag, existing);
      }
    }

    const state: BoardState = {
      selection,
      itemsByTag,
      itemsById,
      frames,
      allItems,
      timestamp: now,
    };

    // Update cache
    this.cachedState = state;
    this.cacheTimestamp = now;

    return state;
  }

  /**
   * Invalidate the cache (call when board changes are detected)
   */
  invalidateCache(): void {
    this.cachedState = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Get content from selected items joined by newlines
   */
  async getSelectedContent(): Promise<string> {
    const selection = await this.getSelection();
    return selection.items.map((item) => item.content).join('\n');
  }

  /**
   * Get metadata value from selected item (first item if multiple)
   */
  async getSelectedMetadata(key: string): Promise<string | undefined> {
    const selection = await this.getSelection();
    if (selection.items.length === 0) return undefined;
    return selection.items[0].metadata[key];
  }

  /**
   * Get all tags from selected items
   */
  async getSelectedTags(): Promise<ItemTag[]> {
    const selection = await this.getSelection();
    const allTags = selection.items.flatMap((item) => item.tags);
    return [...new Set(allTags)];
  }
}

// Export singleton instance
export const boardStateReader = new BoardStateReader();
