import { logger } from "./logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => void;

/**
 * Minimal synchronous, type-safe event bus using Map<string, Set<listener>>.
 * T is a map of event-name → handler signature.
 * We intentionally bypass TypeScript's strict generic constraint issues
 * with the internal cast to AnyFunction; the public API remains fully typed.
 */
export class EventBus<T extends { [K in keyof T]: AnyFunction }> {
  private listeners = new Map<string, Set<AnyFunction>>();

  on<K extends keyof T & string>(event: K, listener: T[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as AnyFunction);
    logger.debug(`[EventBus] Subscribed to "${event}"`);
  }

  off<K extends keyof T & string>(event: K, listener: T[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener as AnyFunction);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit<K extends keyof T & string>(event: K, ...args: Parameters<T[K]>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((listener) => {
        try {
          listener(...args);
        } catch (error) {
          logger.error(`[EventBus] Listener error for "${event}"`, error);
        }
      });
    }
  }
}

export const createEventBus = <T extends { [K in keyof T]: AnyFunction }>() =>
  new EventBus<T>();
