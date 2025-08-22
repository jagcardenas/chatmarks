/**
 * NavigationController Module
 *
 * Central coordinator for bookmark navigation operations.
 * Manages bookmark ordering, position tracking, and coordinates
 * with storage and UI systems for smooth navigation experience.
 */

import {
  Bookmark,
  NavigationResult,
  NavigationState,
  NavigationConfig,
  BookmarkPosition,
  NavigationDirection,
} from '../../types/bookmark';
import { StorageService } from '../storage/StorageService';
import { BookmarkOperations } from '../BookmarkOperations';
import { SmoothScroller } from './SmoothScroller';
import { URLStateManager } from './URLStateManager';

export class NavigationController {
  private storageService: StorageService;
  private bookmarkOperations: BookmarkOperations;
  private smoothScroller: SmoothScroller;
  private urlStateManager: URLStateManager;
  private conversationId: string;
  private config: NavigationConfig;

  // Navigation state
  private state: NavigationState;
  private bookmarkPositions: Map<string, BookmarkPosition> = new Map();
  private navigationInProgress: boolean = false;

  constructor(
    storageService: StorageService,
    bookmarkOperations: BookmarkOperations,
    conversationId: string,
    config: NavigationConfig = {}
  ) {
    this.storageService = storageService;
    this.bookmarkOperations = bookmarkOperations;
    this.conversationId = conversationId;

    // Set up default configuration
    this.config = {
      enableSmoothScrolling: true,
      highlightDuration: 3000,
      enableURLState: true,
      enableCrossConversation: true,
      scrollOffset: 100,
      navigationDebounce: 100,
      ...config,
    };

    // Initialize navigation state
    this.state = {
      currentConversationId: conversationId,
      bookmarks: [],
      currentIndex: -1,
      isNavigating: false,
    };

    // Initialize sub-components
    this.smoothScroller = new SmoothScroller({
      highlightDuration: this.config.highlightDuration,
      scrollOffset: this.config.scrollOffset,
    });

    this.urlStateManager = new URLStateManager({
      enabled: this.config.enableURLState,
    });

    // Set up URL change listener
    if (this.config.enableURLState) {
      this.urlStateManager.subscribeToURLChanges(
        this.handleURLBookmarkChange.bind(this)
      );
    }
  }

  /**
   * Initializes the navigation controller by loading bookmarks
   * and setting up navigation state.
   */
  async initialize(): Promise<void> {
    try {
      await this.loadBookmarksForConversation();

      // Check if URL has a bookmark fragment on load
      if (this.config.enableURLState) {
        const urlBookmarkId = this.urlStateManager.getBookmarkFromURL();
        if (urlBookmarkId) {
          await this.navigateToBookmark(urlBookmarkId);
        }
      }
    } catch (error) {
      console.error('NavigationController: Failed to initialize:', error);
    }
  }

  /**
   * Loads and orders bookmarks for the current conversation.
   */
  private async loadBookmarksForConversation(): Promise<void> {
    try {
      const bookmarks = await this.storageService.getBookmarks({
        conversationId: this.conversationId,
      });

      // Sort bookmarks by creation time (chronological order)
      this.state.bookmarks = bookmarks.sort(
        (a, b) => new Date(a.created).getTime() - new Date(b.created).getTime()
      );

      // Update bookmark positions map
      this.updateBookmarkPositions();
    } catch (error) {
      console.error('NavigationController: Failed to load bookmarks:', error);
      this.state.bookmarks = [];
    }
  }

  /**
   * Updates the bookmark positions map with current bookmark data.
   */
  private updateBookmarkPositions(): void {
    this.bookmarkPositions.clear();

    this.state.bookmarks.forEach((bookmark, index) => {
      const position: BookmarkPosition = {
        bookmark,
        index,
        element: this.findBookmarkElement(bookmark) || undefined,
      };

      this.bookmarkPositions.set(bookmark.id, position);
    });
  }

  /**
   * Finds the DOM element for a bookmark using its anchor information.
   *
   * @param bookmark - The bookmark to find
   * @returns The DOM element or null if not found
   */
  private findBookmarkElement(bookmark: Bookmark): Element | null {
    try {
      // Try XPath first (most reliable)
      if (bookmark.anchor.xpathSelector) {
        const result = document.evaluate(
          bookmark.anchor.xpathSelector,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );

        if (result.singleNodeValue) {
          return result.singleNodeValue as Element;
        }
      }

      // Fallback to message ID selector
      const messageElement = document.querySelector(
        `[data-message-id="${bookmark.messageId}"]`
      );

      if (messageElement) {
        return messageElement;
      }

      // Final fallback: search by text content
      return this.findElementByText(bookmark.anchor.selectedText);
    } catch (error) {
      console.warn(
        'NavigationController: Failed to find element for bookmark:',
        bookmark.id,
        error
      );
      return null;
    }
  }

  /**
   * Finds an element by searching for text content.
   *
   * @param text - The text to search for
   * @returns The element containing the text or null
   */
  private findElementByText(text: string): Element | null {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
    );

    let textNode;
    while ((textNode = walker.nextNode())) {
      if (textNode.textContent?.includes(text)) {
        return textNode.parentElement;
      }
    }

    return null;
  }

  /**
   * Navigates to a specific bookmark by ID.
   *
   * @param bookmarkId - The ID of the bookmark to navigate to
   * @returns Promise resolving to navigation result
   */
  async navigateToBookmark(bookmarkId: string): Promise<boolean> {
    if (this.navigationInProgress && this.config.navigationDebounce) {
      return false;
    }

    const startTime = performance.now();
    this.navigationInProgress = true;
    this.state.isNavigating = true;

    try {
      const position = this.bookmarkPositions.get(bookmarkId);

      if (!position) {
        console.warn('NavigationController: Bookmark not found:', bookmarkId);
        return false;
      }

      // Update current index
      this.state.currentIndex = position.index;
      this.state.lastNavigationTime = Date.now();

      // Find element if not already cached
      if (!position.element) {
        position.element =
          this.findBookmarkElement(position.bookmark) || undefined;
      }

      if (!position.element) {
        console.warn(
          'NavigationController: Element not found for bookmark:',
          bookmarkId
        );
        return false;
      }

      // Perform smooth scroll
      if (this.config.enableSmoothScrolling) {
        await this.smoothScroller.scrollToElement(position.element);
        await this.smoothScroller.animateHighlight(position.element);
      } else {
        // Instant scroll fallback
        position.element.scrollIntoView({ block: 'center' });
      }

      // Update URL state
      if (this.config.enableURLState) {
        this.urlStateManager.updateURLWithBookmark(bookmarkId);
      }

      const duration = performance.now() - startTime;
      console.debug(
        'NavigationController: Navigation completed in',
        duration,
        'ms'
      );

      return true;
    } catch (error) {
      console.error('NavigationController: Navigation failed:', error);
      return false;
    } finally {
      this.navigationInProgress = false;
      this.state.isNavigating = false;
    }
  }

  /**
   * Navigates to the next bookmark in the sequence.
   *
   * @returns Promise resolving to whether navigation was successful
   */
  async navigateNext(): Promise<boolean> {
    if (this.state.bookmarks.length === 0) {
      return false;
    }

    const nextIndex = this.state.currentIndex + 1;

    if (nextIndex >= this.state.bookmarks.length) {
      console.debug('NavigationController: Already at last bookmark');
      return false;
    }

    const nextBookmark = this.state.bookmarks[nextIndex];
    if (!nextBookmark) {
      return false;
    }
    return await this.navigateToBookmark(nextBookmark.id);
  }

  /**
   * Navigates to the previous bookmark in the sequence.
   *
   * @returns Promise resolving to whether navigation was successful
   */
  async navigatePrevious(): Promise<boolean> {
    if (this.state.bookmarks.length === 0) {
      return false;
    }

    const prevIndex = this.state.currentIndex - 1;

    if (prevIndex < 0) {
      console.debug('NavigationController: Already at first bookmark');
      return false;
    }

    const prevBookmark = this.state.bookmarks[prevIndex];
    if (!prevBookmark) {
      return false;
    }
    return await this.navigateToBookmark(prevBookmark.id);
  }

  /**
   * Handles URL bookmark changes from browser navigation.
   *
   * @param bookmarkId - The bookmark ID from the URL hash
   */
  private async handleURLBookmarkChange(
    bookmarkId: string | null
  ): Promise<void> {
    if (bookmarkId && !this.navigationInProgress) {
      await this.navigateToBookmark(bookmarkId);
    }
  }

  /**
   * Gets the current bookmark index.
   *
   * @returns The index of the current bookmark (-1 if none)
   */
  getCurrentBookmarkIndex(): number {
    return this.state.currentIndex;
  }

  /**
   * Gets the current list of bookmarks.
   *
   * @returns Array of bookmarks in navigation order
   */
  getCurrentBookmarks(): Bookmark[] {
    return [...this.state.bookmarks];
  }

  /**
   * Gets the current navigation state.
   *
   * @returns Current navigation state
   */
  getNavigationState(): NavigationState {
    return {
      ...this.state,
      bookmarks: [...this.state.bookmarks],
    };
  }

  /**
   * Gets the bookmark at a specific index.
   *
   * @param index - The bookmark index
   * @returns The bookmark or null if index is invalid
   */
  getBookmarkAtIndex(index: number): Bookmark | null {
    if (index < 0 || index >= this.state.bookmarks.length) {
      return null;
    }
    return this.state.bookmarks[index] || null;
  }

  /**
   * Gets the current active bookmark.
   *
   * @returns The current bookmark or null if none active
   */
  getCurrentBookmark(): Bookmark | null {
    return this.getBookmarkAtIndex(this.state.currentIndex);
  }

  /**
   * Refreshes the bookmark list from storage.
   * Useful when bookmarks are added/removed externally.
   */
  async refreshBookmarks(): Promise<void> {
    await this.loadBookmarksForConversation();
  }

  /**
   * Updates the conversation context for navigation.
   *
   * @param conversationId - The new conversation ID
   */
  async updateConversation(conversationId: string): Promise<void> {
    if (this.conversationId === conversationId) {
      return;
    }

    this.conversationId = conversationId;
    this.state.currentConversationId = conversationId;
    this.state.currentIndex = -1;

    await this.loadBookmarksForConversation();
  }

  /**
   * Synchronous version of navigateToBookmark for testing.
   */
  navigateToBookmarkSync(bookmarkId: string): boolean {
    const position = this.bookmarkPositions.get(bookmarkId);

    if (!position) {
      return false;
    }

    this.state.currentIndex = position.index;
    this.state.lastNavigationTime = Date.now();
    return true;
  }

  /**
   * Synchronous version of navigateNext for testing.
   */
  navigateNextSync(): boolean {
    if (this.state.bookmarks.length === 0) {
      return false;
    }

    const nextIndex = this.state.currentIndex + 1;

    if (nextIndex >= this.state.bookmarks.length) {
      return false;
    }

    this.state.currentIndex = nextIndex;
    this.state.lastNavigationTime = Date.now();
    return true;
  }

  /**
   * Synchronous version of navigatePrevious for testing.
   */
  navigatePreviousSync(): boolean {
    if (this.state.bookmarks.length === 0) {
      return false;
    }

    const prevIndex = this.state.currentIndex - 1;

    if (prevIndex < 0) {
      return false;
    }

    this.state.currentIndex = prevIndex;
    this.state.lastNavigationTime = Date.now();
    return true;
  }

  /**
   * Sets the current bookmark index (for testing).
   */
  setCurrentBookmarkIndex(index: number): void {
    if (index < -1 || index >= this.state.bookmarks.length) {
      this.state.currentIndex = -1;
    } else {
      this.state.currentIndex = index;
    }
  }

  /**
   * Gets a bookmark position by ID.
   */
  getBookmarkPosition(bookmarkId: string): BookmarkPosition | null {
    return this.bookmarkPositions.get(bookmarkId) || null;
  }

  /**
   * Updates the conversation ID.
   */
  async updateConversationId(conversationId: string): Promise<void> {
    this.conversationId = conversationId;
    this.state.currentConversationId = conversationId;
    this.state.currentIndex = -1;
    this.bookmarkPositions.clear();
    await this.loadBookmarksForConversation();
  }

  /**
   * Gets the current conversation ID.
   */
  getCurrentConversationId(): string {
    return this.conversationId;
  }

  /**
   * Checks if there is a next bookmark available.
   */
  hasNext(): boolean {
    return this.state.currentIndex < this.state.bookmarks.length - 1;
  }

  /**
   * Checks if there is a previous bookmark available.
   */
  hasPrevious(): boolean {
    return this.state.currentIndex > 0;
  }

  /**
   * Gets performance metrics for navigation operations.
   *
   * @returns Navigation performance information
   */
  getPerformanceMetrics(): {
    totalBookmarks: number;
    currentIndex: number;
    lastNavigationTime?: number;
    averageNavigationTime?: number;
  } {
    return {
      totalBookmarks: this.state.bookmarks.length,
      currentIndex: this.state.currentIndex,
      lastNavigationTime: this.state.lastNavigationTime,
      // TODO: Track average navigation time across multiple navigations
      averageNavigationTime: undefined,
    };
  }

  /**
   * Cleans up resources and event listeners.
   */
  cleanup(): void {
    // Clean up sub-components
    this.smoothScroller.cleanup();
    this.urlStateManager.cleanup();

    // Clear state
    this.bookmarkPositions.clear();
    this.state.bookmarks = [];
    this.state.currentIndex = -1;
    this.navigationInProgress = false;
  }
}
