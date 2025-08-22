/**
 * EventTracker Module
 *
 * Manages event listeners for proper cleanup and memory leak prevention.
 * Tracks all registered event listeners and provides utilities for
 * type-safe event handling and bulk cleanup operations.
 */

export interface TrackedEventListener {
  target: EventTarget;
  type: string;
  listener: (event: Event) => void;
}

export class EventTracker {
  private eventListeners: TrackedEventListener[] = [];

  /**
   * Adds an event listener and tracks it for cleanup.
   *
   * @param target - The EventTarget to attach the listener to
   * @param type - The event type to listen for
   * @param listener - The event listener function
   * @param options - Optional addEventListener options
   */
  addTrackedEventListener(
    target: EventTarget,
    type: string,
    listener: (event: Event) => void,
    options?: boolean | AddEventListenerOptions
  ): void {
    target.addEventListener(type, listener, options);
    this.eventListeners.push({ target, type, listener });
  }

  /**
   * Type-safe helper for specific event types.
   * Provides better TypeScript support for event handling.
   *
   * @param target - The EventTarget to attach the listener to
   * @param type - The event type to listen for
   * @param listener - The typed event listener function
   * @param options - Optional addEventListener options
   */
  addTrackedTypedEventListener<T extends Event>(
    target: EventTarget,
    type: string,
    listener: (event: T) => void,
    options?: boolean | AddEventListenerOptions
  ): void {
    const genericListener = listener as EventListener;
    this.addTrackedEventListener(target, type, genericListener, options);
  }

  /**
   * Removes all tracked event listeners.
   * Should be called during cleanup to prevent memory leaks.
   */
  removeAllTrackedListeners(): void {
    this.eventListeners.forEach(({ target, type, listener }) => {
      target.removeEventListener(type, listener);
    });
    this.eventListeners = [];
  }

  /**
   * Gets the count of currently tracked listeners.
   * Useful for debugging and monitoring.
   */
  getTrackedListenerCount(): number {
    return this.eventListeners.length;
  }

  /**
   * Removes a specific tracked listener.
   *
   * @param target - The EventTarget the listener is attached to
   * @param type - The event type
   * @param listener - The listener function to remove
   * @returns true if the listener was found and removed, false otherwise
   */
  removeTrackedListener(
    target: EventTarget,
    type: string,
    listener: (event: Event) => void
  ): boolean {
    const index = this.eventListeners.findIndex(
      tracked =>
        tracked.target === target &&
        tracked.type === type &&
        tracked.listener === listener
    );

    if (index !== -1) {
      this.eventListeners.splice(index, 1);
      target.removeEventListener(type, listener);
      return true;
    }

    return false;
  }

  /**
   * Clears all tracked listeners and resets the tracker.
   * Alias for removeAllTrackedListeners for semantic clarity.
   */
  cleanup(): void {
    this.removeAllTrackedListeners();
  }
}
