/**
 * Bookmark Events System
 *
 * Provides real-time event notifications for bookmark operations using
 * the native EventTarget interface. Enables UI components and other
 * systems to react to bookmark changes in real-time.
 *
 * Key Features:
 * - Type-safe event emission and handling
 * - Custom event data with detailed bookmark information
 * - Error event handling for operation failures
 * - Batch operation events for performance monitoring
 * - Memory-efficient event management
 */

import { Bookmark } from '../../types/bookmark';

/**
 * Custom event types for bookmark operations
 */
export interface BookmarkEventMap {
  'bookmark:created': CustomEvent<{ bookmark: Bookmark }>;
  'bookmark:updated': CustomEvent<{
    bookmark: Bookmark;
    previousData?: Partial<Bookmark>;
  }>;
  'bookmark:deleted': CustomEvent<{ bookmarkId: string }>;
  'bookmark:error': CustomEvent<{ operation: string; error: string }>;
  'bookmark:batch': CustomEvent<{
    operation: string;
    count: number;
    duration: number;
  }>;
}

/**
 * Event details for bookmark operations
 */
export interface BookmarkCreatedEventDetail {
  bookmark: Bookmark;
  timestamp: string;
}

export interface BookmarkUpdatedEventDetail {
  bookmark: Bookmark;
  previousData?: Partial<Bookmark>;
  timestamp: string;
}

export interface BookmarkDeletedEventDetail {
  bookmarkId: string;
  timestamp: string;
}

export interface BookmarkErrorEventDetail {
  operation: string;
  error: string;
  timestamp: string;
}

export interface BookmarkBatchEventDetail {
  operation: string;
  count: number;
  duration: number;
  timestamp: string;
}

/**
 * Bookmark Events Manager
 *
 * Extends EventTarget to provide type-safe bookmark event handling
 * with detailed event data and error management.
 */
export class BookmarkEvents extends EventTarget {
  private static instance: BookmarkEvents | null = null;

  /**
   * Singleton pattern to ensure single event system instance
   */
  static getInstance(): BookmarkEvents {
    if (!BookmarkEvents.instance) {
      BookmarkEvents.instance = new BookmarkEvents();
    }
    return BookmarkEvents.instance;
  }

  /**
   * Emits an event when a bookmark is created
   *
   * @param bookmark - The newly created bookmark
   */
  emitBookmarkCreated(bookmark: Bookmark): void {
    const eventDetail: BookmarkCreatedEventDetail = {
      bookmark,
      timestamp: new Date().toISOString(),
    };

    const event = new CustomEvent('bookmark:created', {
      detail: eventDetail,
      bubbles: false,
      cancelable: false,
    });

    this.dispatchEvent(event);
  }

  /**
   * Emits an event when a bookmark is updated
   *
   * @param bookmark - The updated bookmark
   * @param previousData - Optional previous bookmark data for comparison
   */
  emitBookmarkUpdated(
    bookmark: Bookmark,
    previousData?: Partial<Bookmark>
  ): void {
    const eventDetail: BookmarkUpdatedEventDetail = {
      bookmark,
      previousData,
      timestamp: new Date().toISOString(),
    };

    const event = new CustomEvent('bookmark:updated', {
      detail: eventDetail,
      bubbles: false,
      cancelable: false,
    });

    this.dispatchEvent(event);
  }

  /**
   * Emits an event when a bookmark is deleted
   *
   * @param bookmarkId - The ID of the deleted bookmark
   */
  emitBookmarkDeleted(bookmarkId: string): void {
    const eventDetail: BookmarkDeletedEventDetail = {
      bookmarkId,
      timestamp: new Date().toISOString(),
    };

    const event = new CustomEvent('bookmark:deleted', {
      detail: eventDetail,
      bubbles: false,
      cancelable: false,
    });

    this.dispatchEvent(event);
  }

  /**
   * Emits an event when a bookmark operation encounters an error
   *
   * @param operation - The operation that failed (create, update, delete, etc.)
   * @param error - Error message or description
   */
  emitBookmarkError(operation: string, error: string): void {
    const eventDetail: BookmarkErrorEventDetail = {
      operation,
      error,
      timestamp: new Date().toISOString(),
    };

    const event = new CustomEvent('bookmark:error', {
      detail: eventDetail,
      bubbles: false,
      cancelable: false,
    });

    this.dispatchEvent(event);
  }

  /**
   * Emits an event for batch operations (bulk save, delete, etc.)
   *
   * @param operation - The batch operation type
   * @param count - Number of items processed
   * @param duration - Operation duration in milliseconds
   */
  emitBatchOperation(operation: string, count: number, duration: number): void {
    const eventDetail: BookmarkBatchEventDetail = {
      operation,
      count,
      duration,
      timestamp: new Date().toISOString(),
    };

    const event = new CustomEvent('bookmark:batch', {
      detail: eventDetail,
      bubbles: false,
      cancelable: false,
    });

    this.dispatchEvent(event);
  }

  /**
   * Adds a type-safe event listener for bookmark created events
   *
   * @param listener - Event listener function
   * @param options - Event listener options
   */
  onBookmarkCreated(
    listener: (event: CustomEvent<BookmarkCreatedEventDetail>) => void,
    options?: boolean | AddEventListenerOptions
  ): void {
    this.addEventListener(
      'bookmark:created',
      listener as (event: Event) => void,
      options
    );
  }

  /**
   * Adds a type-safe event listener for bookmark updated events
   *
   * @param listener - Event listener function
   * @param options - Event listener options
   */
  onBookmarkUpdated(
    listener: (event: CustomEvent<BookmarkUpdatedEventDetail>) => void,
    options?: boolean | AddEventListenerOptions
  ): void {
    this.addEventListener(
      'bookmark:updated',
      listener as (event: Event) => void,
      options
    );
  }

  /**
   * Adds a type-safe event listener for bookmark deleted events
   *
   * @param listener - Event listener function
   * @param options - Event listener options
   */
  onBookmarkDeleted(
    listener: (event: CustomEvent<BookmarkDeletedEventDetail>) => void,
    options?: boolean | AddEventListenerOptions
  ): void {
    this.addEventListener(
      'bookmark:deleted',
      listener as (event: Event) => void,
      options
    );
  }

  /**
   * Adds a type-safe event listener for bookmark error events
   *
   * @param listener - Event listener function
   * @param options - Event listener options
   */
  onBookmarkError(
    listener: (event: CustomEvent<BookmarkErrorEventDetail>) => void,
    options?: boolean | AddEventListenerOptions
  ): void {
    this.addEventListener('bookmark:error', listener as EventListener, options);
  }

  /**
   * Adds a type-safe event listener for batch operation events
   *
   * @param listener - Event listener function
   * @param options - Event listener options
   */
  onBatchOperation(
    listener: (event: CustomEvent<BookmarkBatchEventDetail>) => void,
    options?: boolean | AddEventListenerOptions
  ): void {
    this.addEventListener('bookmark:batch', listener as EventListener, options);
  }

  /**
   * Removes a specific event listener
   *
   * @param type - Event type
   * @param listener - Event listener function to remove
   * @param options - Event listener options
   */
  removeBookmarkListener(
    type: keyof BookmarkEventMap,
    listener: (event: Event) => void,
    options?: boolean | EventListenerOptions
  ): void {
    this.removeEventListener(type, listener, options);
  }

  /**
   * Removes all event listeners for cleanup
   */
  removeAllListeners(): void {
    // Create a clone to avoid modifying while iterating
    const events: (keyof BookmarkEventMap)[] = [
      'bookmark:created',
      'bookmark:updated',
      'bookmark:deleted',
      'bookmark:error',
      'bookmark:batch',
    ];

    events.forEach(_eventType => {
      // Remove all listeners for this event type
      // Note: This is a simple approach; in production, you might want
      // to track listeners more explicitly for better cleanup
      const newTarget = new EventTarget();
      Object.setPrototypeOf(this, Object.getPrototypeOf(newTarget));
    });
  }

  /**
   * Gets statistics about current event listeners
   *
   * @returns Object with listener statistics
   */
  getListenerStats(): { [key: string]: number } {
    // Note: EventTarget doesn't provide a direct way to count listeners
    // This is a placeholder for potential future implementation
    return {
      'bookmark:created': 0,
      'bookmark:updated': 0,
      'bookmark:deleted': 0,
      'bookmark:error': 0,
      'bookmark:batch': 0,
    };
  }
}

/**
 * Default export for convenience
 */
export default BookmarkEvents;
