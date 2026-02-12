/**
 * Event Bus
 * 
 * Provides typed publish/subscribe communication between modules.
 * Supports channels for logical grouping of related events.
 */

import type {
  ChannelName,
  ChannelEvents,
  EventPayload,
  ChannelEventMaps,
} from './channels.js';

/** Event handler function type */
type EventHandler<T> = (payload: T) => void | Promise<void>;

/** Subscription reference for unsubscribing */
export interface Subscription {
  unsubscribe(): void;
}

/** Internal subscription storage */
interface SubscriptionEntry {
  channel: ChannelName;
  event: string;
  handler: EventHandler<unknown>;
  once: boolean;
}

/**
 * EventBus class
 * 
 * Provides channel-based pub/sub messaging for the module system
 */
export class EventBus {
  private subscriptions: Map<string, Set<SubscriptionEntry>> = new Map();
  private readonly debug: boolean;

  constructor(options?: { debug?: boolean }) {
    this.debug = options?.debug ?? false;
  }

  /**
   * Generate a unique key for channel+event combination
   */
  private getKey(channel: ChannelName, event: string): string {
    return `${channel}:${event}`;
  }

  /**
   * Subscribe to an event on a channel
   */
  on<C extends ChannelName, E extends ChannelEvents<C>>(
    channel: C,
    event: E,
    handler: EventHandler<EventPayload<C, E>>
  ): Subscription {
    const key = this.getKey(channel, event as string);
    
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }

    const entry: SubscriptionEntry = {
      channel,
      event: event as string,
      handler: handler as EventHandler<unknown>,
      once: false,
    };

    this.subscriptions.get(key)!.add(entry);

    if (this.debug) {
      console.log(`[EventBus] Subscribed to ${key}`);
    }

    return {
      unsubscribe: () => {
        this.subscriptions.get(key)?.delete(entry);
        if (this.debug) {
          console.log(`[EventBus] Unsubscribed from ${key}`);
        }
      },
    };
  }

  /**
   * Subscribe to an event once (auto-unsubscribes after first emit)
   */
  once<C extends ChannelName, E extends ChannelEvents<C>>(
    channel: C,
    event: E,
    handler: EventHandler<EventPayload<C, E>>
  ): Subscription {
    const key = this.getKey(channel, event as string);
    
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }

    const entry: SubscriptionEntry = {
      channel,
      event: event as string,
      handler: handler as EventHandler<unknown>,
      once: true,
    };

    this.subscriptions.get(key)!.add(entry);

    return {
      unsubscribe: () => {
        this.subscriptions.get(key)?.delete(entry);
      },
    };
  }

  /**
   * Emit an event on a channel
   */
  emit<C extends ChannelName, E extends ChannelEvents<C>>(
    channel: C,
    event: E,
    payload: EventPayload<C, E>
  ): void {
    const key = this.getKey(channel, event as string);
    const entries = this.subscriptions.get(key);

    if (this.debug) {
      console.log(`[EventBus] Emitting ${key}`, payload);
    }

    if (!entries || entries.size === 0) {
      return;
    }

    const toRemove: SubscriptionEntry[] = [];

    for (const entry of entries) {
      try {
        entry.handler(payload);
        
        if (entry.once) {
          toRemove.push(entry);
        }
      } catch (error) {
        console.error(`[EventBus] Error in handler for ${key}:`, error);
      }
    }

    // Remove once handlers
    for (const entry of toRemove) {
      entries.delete(entry);
    }
  }

  /**
   * Emit an event and wait for all async handlers to complete
   */
  async emitAsync<C extends ChannelName, E extends ChannelEvents<C>>(
    channel: C,
    event: E,
    payload: EventPayload<C, E>
  ): Promise<void> {
    const key = this.getKey(channel, event as string);
    const entries = this.subscriptions.get(key);

    if (this.debug) {
      console.log(`[EventBus] Emitting async ${key}`, payload);
    }

    if (!entries || entries.size === 0) {
      return;
    }

    const toRemove: SubscriptionEntry[] = [];
    const promises: Promise<void>[] = [];

    for (const entry of entries) {
      const result = entry.handler(payload);
      
      if (result instanceof Promise) {
        promises.push(
          result.catch((error) => {
            console.error(`[EventBus] Error in async handler for ${key}:`, error);
          })
        );
      }

      if (entry.once) {
        toRemove.push(entry);
      }
    }

    await Promise.all(promises);

    // Remove once handlers
    for (const entry of toRemove) {
      entries.delete(entry);
    }
  }

  /**
   * Remove all subscriptions for a channel
   */
  clearChannel(channel: ChannelName): void {
    const prefix = `${channel}:`;
    
    for (const key of this.subscriptions.keys()) {
      if (key.startsWith(prefix)) {
        this.subscriptions.delete(key);
      }
    }

    if (this.debug) {
      console.log(`[EventBus] Cleared channel ${channel}`);
    }
  }

  /**
   * Remove all subscriptions
   */
  clearAll(): void {
    this.subscriptions.clear();
    
    if (this.debug) {
      console.log('[EventBus] Cleared all subscriptions');
    }
  }

  /**
   * Get count of subscriptions for debugging
   */
  getSubscriptionCount(channel?: ChannelName): number {
    if (channel) {
      const prefix = `${channel}:`;
      let count = 0;
      
      for (const [key, entries] of this.subscriptions) {
        if (key.startsWith(prefix)) {
          count += entries.size;
        }
      }
      
      return count;
    }

    let total = 0;
    for (const entries of this.subscriptions.values()) {
      total += entries.size;
    }
    return total;
  }
}

// Export singleton instance
export const eventBus = new EventBus({ debug: false });
