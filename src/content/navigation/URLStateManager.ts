/**
 * URLStateManager Module
 *
 * Manages URL state for bookmark navigation using the History API.
 * Handles bookmark fragment identifiers, browser navigation events,
 * and provides seamless integration with browser back/forward buttons.
 */

import { URLChangeEvent } from '../../types/bookmark';

interface URLStateManagerConfig {
  /** Enable/disable URL state management */
  enabled?: boolean;

  /** Prefix for bookmark fragment identifiers */
  bookmarkPrefix?: string;

  /** Enable/disable history state management */
  useHistoryAPI?: boolean;

  /** Debounce delay for URL change events */
  debounceDelay?: number;
}

type URLChangeCallback = (bookmarkId: string | null) => void;

export class URLStateManager {
  private config: Required<URLStateManagerConfig>;
  private changeCallbacks: Set<URLChangeCallback> = new Set();
  private currentBookmarkId: string | null = null;
  private isUpdating: boolean = false;
  private debounceTimeout?: number;

  constructor(config: URLStateManagerConfig = {}) {
    this.config = {
      enabled: true,
      bookmarkPrefix: 'bookmark-',
      useHistoryAPI: true,
      debounceDelay: 100,
      ...config,
    };

    if (this.config.enabled) {
      this.setupEventListeners();
      this.currentBookmarkId = this.getBookmarkFromURL();
    }
  }

  /**
   * Sets up event listeners for URL changes.
   */
  private setupEventListeners(): void {
    // Listen for hash changes (direct URL changes)
    window.addEventListener('hashchange', this.handleHashChange.bind(this));

    // Listen for popstate events (browser back/forward)
    if (this.config.useHistoryAPI) {
      window.addEventListener('popstate', this.handlePopState.bind(this));
    }

    // Listen for programmatic history changes
    this.wrapHistoryMethods();
  }

  /**
   * Wraps history methods to detect programmatic navigation.
   */
  private wrapHistoryMethods(): void {
    if (!this.config.useHistoryAPI) return;

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      const result = originalPushState.apply(history, args);
      this.handleHistoryChange();
      return result;
    };

    history.replaceState = (...args) => {
      const result = originalReplaceState.apply(history, args);
      this.handleHistoryChange();
      return result;
    };
  }

  /**
   * Handles hash change events.
   *
   * @param event - The hash change event
   */
  private handleHashChange(event: HashChangeEvent): void {
    if (this.isUpdating) {
      return;
    }

    const bookmarkId = this.getBookmarkFromURL();
    this.notifyCallbacks(bookmarkId, {
      url: window.location.href,
      hash: window.location.hash,
      programmatic: false,
    });
  }

  /**
   * Handles popstate events (browser navigation).
   *
   * @param event - The popstate event
   */
  private handlePopState(event: PopStateEvent): void {
    if (this.isUpdating) {
      return;
    }

    const bookmarkId = this.getBookmarkFromURL();
    this.notifyCallbacks(bookmarkId, {
      url: window.location.href,
      hash: window.location.hash,
      programmatic: false,
    });
  }

  /**
   * Handles programmatic history changes.
   */
  private handleHistoryChange(): void {
    if (this.isUpdating) {
      return;
    }

    // Small delay to allow URL to update
    setTimeout(() => {
      const bookmarkId = this.getBookmarkFromURL();
      this.notifyCallbacks(bookmarkId, {
        url: window.location.href,
        hash: window.location.hash,
        programmatic: true,
      });
    }, 10);
  }

  /**
   * Notifies all registered callbacks of URL changes.
   *
   * @param bookmarkId - The bookmark ID from the URL
   * @param eventData - Additional event data
   */
  private notifyCallbacks(
    bookmarkId: string | null,
    eventData: Partial<URLChangeEvent>
  ): void {
    if (this.currentBookmarkId === bookmarkId) {
      return; // No change
    }

    this.currentBookmarkId = bookmarkId;

    // Debounce callback notifications
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    this.debounceTimeout = window.setTimeout(() => {
      const urlChangeEvent: URLChangeEvent = {
        bookmarkId,
        url: window.location.href,
        hash: window.location.hash,
        programmatic: false,
        ...eventData,
      };

      this.changeCallbacks.forEach(callback => {
        try {
          callback(bookmarkId);
        } catch (error) {
          console.error('URLStateManager: Callback error:', error);
        }
      });
    }, this.config.debounceDelay);
  }

  /**
   * Updates the URL with a bookmark ID.
   *
   * @param bookmarkId - The bookmark ID to add to the URL
   */
  updateURLWithBookmark(bookmarkId: string): void {
    if (!this.config.enabled) {
      return;
    }

    this.isUpdating = true;

    try {
      const hash = `#${this.config.bookmarkPrefix}${bookmarkId}`;

      if (window.location.hash !== hash) {
        if (this.config.useHistoryAPI) {
          // Use pushState to add to browser history
          const url = `${window.location.pathname}${window.location.search}${hash}`;
          history.pushState({ bookmarkId }, '', url);
        } else {
          // Direct hash update (no history entry)
          window.location.hash = hash;
        }

        this.currentBookmarkId = bookmarkId;
      }
    } catch (error) {
      console.error('URLStateManager: Failed to update URL:', error);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Extracts bookmark ID from the current URL hash.
   *
   * @returns The bookmark ID or null if not found
   */
  getBookmarkFromURL(): string | null {
    const hash = window.location.hash;

    if (!hash || !hash.startsWith('#')) {
      return null;
    }

    const fragment = hash.substring(1);

    if (fragment.startsWith(this.config.bookmarkPrefix)) {
      return fragment.substring(this.config.bookmarkPrefix.length);
    }

    return null;
  }

  /**
   * Clears the bookmark from the URL.
   */
  clearBookmarkFromURL(): void {
    if (!this.config.enabled) {
      return;
    }

    this.isUpdating = true;

    try {
      if (window.location.hash) {
        if (this.config.useHistoryAPI) {
          const url = `${window.location.pathname}${window.location.search}`;
          history.pushState({}, '', url);
        } else {
          window.location.hash = '';
        }

        this.currentBookmarkId = null;
      }
    } catch (error) {
      console.error('URLStateManager: Failed to clear URL:', error);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Subscribes to URL change events.
   *
   * @param callback - Function to call when URL changes
   * @returns Unsubscribe function
   */
  subscribeToURLChanges(callback: URLChangeCallback): () => void {
    this.changeCallbacks.add(callback);

    // Immediately notify with current state
    if (this.currentBookmarkId) {
      callback(this.currentBookmarkId);
    }

    // Return unsubscribe function
    return () => {
      this.changeCallbacks.delete(callback);
    };
  }

  /**
   * Replaces the current URL state without adding to history.
   *
   * @param bookmarkId - The bookmark ID to set
   */
  replaceURLWithBookmark(bookmarkId: string): void {
    if (!this.config.enabled || !this.config.useHistoryAPI) {
      return this.updateURLWithBookmark(bookmarkId);
    }

    this.isUpdating = true;

    try {
      const hash = `#${this.config.bookmarkPrefix}${bookmarkId}`;
      const url = `${window.location.pathname}${window.location.search}${hash}`;

      history.replaceState({ bookmarkId }, '', url);
      this.currentBookmarkId = bookmarkId;
    } catch (error) {
      console.error('URLStateManager: Failed to replace URL:', error);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Navigates back to the previous URL in history.
   */
  navigateBack(): void {
    if (this.config.useHistoryAPI && window.history.length > 1) {
      history.back();
    }
  }

  /**
   * Navigates forward to the next URL in history.
   */
  navigateForward(): void {
    if (this.config.useHistoryAPI) {
      history.forward();
    }
  }

  /**
   * Gets the current bookmark ID from internal state.
   *
   * @returns The current bookmark ID or null
   */
  getCurrentBookmarkId(): string | null {
    return this.currentBookmarkId;
  }

  /**
   * Checks if a bookmark ID is currently active in the URL.
   *
   * @param bookmarkId - The bookmark ID to check
   * @returns True if the bookmark is active
   */
  isBookmarkActive(bookmarkId: string): boolean {
    return this.currentBookmarkId === bookmarkId;
  }

  /**
   * Gets the full bookmark URL for sharing.
   *
   * @param bookmarkId - The bookmark ID
   * @returns The complete URL with bookmark fragment
   */
  getBookmarkURL(bookmarkId: string): string {
    const baseUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    const hash = `#${this.config.bookmarkPrefix}${bookmarkId}`;
    return `${baseUrl}${hash}`;
  }

  /**
   * Validates that a URL hash represents a valid bookmark.
   *
   * @param hash - The URL hash to validate
   * @returns True if the hash represents a bookmark
   */
  isValidBookmarkHash(hash: string): boolean {
    if (!hash || !hash.startsWith('#')) {
      return false;
    }

    const fragment = hash.substring(1);
    return (
      fragment.startsWith(this.config.bookmarkPrefix) &&
      fragment.length > this.config.bookmarkPrefix.length
    );
  }

  /**
   * Extracts bookmark ID from the current URL hash.
   * Alias for getBookmarkFromURL() for test compatibility.
   *
   * @returns The bookmark ID without prefix or null if not found
   */
  extractBookmarkIdFromURL(): string | null {
    return this.getBookmarkFromURL();
  }

  /**
   * Unsubscribes a callback from URL change events.
   *
   * @param callback - The callback to remove
   */
  unsubscribeFromURLChanges(callback: URLChangeCallback): void {
    this.changeCallbacks.delete(callback);
  }

  /**
   * Gets the number of active subscribers.
   *
   * @returns Number of subscribed callbacks
   */
  getSubscriberCount(): number {
    return this.changeCallbacks.size;
  }

  /**
   * Gets URL state information for debugging.
   *
   * @returns Current URL state details
   */
  getURLState(): {
    enabled: boolean;
    currentURL: string;
    currentHash: string;
    currentBookmarkId: string | null;
    isUpdating: boolean;
    callbackCount: number;
  } {
    return {
      enabled: this.config.enabled,
      currentURL: window.location.href,
      currentHash: window.location.hash,
      currentBookmarkId: this.currentBookmarkId,
      isUpdating: this.isUpdating,
      callbackCount: this.changeCallbacks.size,
    };
  }

  /**
   * Updates the configuration dynamically.
   *
   * @param newConfig - The new configuration options
   */
  updateConfig(newConfig: Partial<URLStateManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Re-read current state if enabling
    if (newConfig.enabled && !this.config.enabled) {
      this.currentBookmarkId = this.getBookmarkFromURL();
    }
  }

  /**
   * Cleans up event listeners and resources.
   */
  cleanup(): void {
    // Clear debounce timeout
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    // Clear all callbacks
    this.changeCallbacks.clear();

    // Remove event listeners
    window.removeEventListener('hashchange', this.handleHashChange.bind(this));
    window.removeEventListener('popstate', this.handlePopState.bind(this));

    // Note: We don't restore wrapped history methods as they might be used elsewhere
    // In a real implementation, we might want to track and restore original methods
  }
}
