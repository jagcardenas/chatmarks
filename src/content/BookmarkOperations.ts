/**
 * BookmarkOperations Module
 *
 * Handles bookmark CRUD operations, anchor generation, and highlight rendering.
 * Coordinates with the background script for persistence and manages
 * bookmark restoration on page load.
 */

import {
  Platform,
  SelectionRange,
  TextAnchor,
  Bookmark,
  NavigationResult,
} from '../types/bookmark';
import { MessageType, ExtensionMessage } from '../types/messages';
import { AnchorSystem } from './anchoring/AnchorSystem';
import { HighlightRenderer } from './ui/highlights/HighlightRenderer';
import { ChatGPTAdapter } from './adapters';
import {
  extractConversationId,
  generateMessageId,
} from './utils/PlatformUtils';

export class BookmarkOperations {
  private anchorSystem: AnchorSystem;
  private highlightRenderer: HighlightRenderer;
  private platformAdapter: ChatGPTAdapter | null;
  private currentPlatform: Platform;
  
  // Navigation controller will be set by ContentScriptInitializer
  private navigationController: any = null;

  constructor(
    anchorSystem: AnchorSystem,
    highlightRenderer: HighlightRenderer,
    platformAdapter: ChatGPTAdapter | null,
    currentPlatform: Platform
  ) {
    this.anchorSystem = anchorSystem;
    this.highlightRenderer = highlightRenderer;
    this.platformAdapter = platformAdapter;
    this.currentPlatform = currentPlatform;
  }

  /**
   * Creates a basic anchor for selections without full anchor data.
   * Used as a fallback when anchor system fails.
   *
   * @param selection - The selection range
   * @returns A basic text anchor
   */
  private createBasicAnchor(selection: SelectionRange): TextAnchor {
    return {
      selectedText: selection.selectedText,
      startOffset: selection.startOffset,
      endOffset: selection.endOffset,
      xpathSelector: '',
      messageId: generateMessageId(),
      contextBefore: selection.contextBefore,
      contextAfter: selection.contextAfter,
      checksum: '',
      confidence: 0.5,
      strategy: 'xpath',
    };
  }

  /**
   * Saves a bookmark from the current selection.
   *
   * @param selection - The text selection to bookmark
   * @param note - Optional note for the bookmark
   * @returns The created bookmark or null if failed
   */
  async saveBookmark(
    selection: SelectionRange,
    note: string = ''
  ): Promise<Bookmark | null> {
    const conversationId =
      this.platformAdapter?.getConversationId() || extractConversationId();
    const messageId = selection.anchor?.messageId || generateMessageId();

    // Prefer robust anchor generation via AnchorSystem
    let anchorToUse: TextAnchor =
      selection.anchor || this.createBasicAnchor(selection);

    try {
      const selectionData: SelectionRange = {
        ...selection,
        messageId,
        conversationId,
        timestamp: new Date().toISOString(),
      };
      anchorToUse = this.anchorSystem.createAnchor(selectionData);
    } catch (error) {
      console.warn(
        'Chatmarks: Failed to create robust anchor, using basic anchor',
        error
      );
    }

    const payload = {
      platform: this.currentPlatform,
      conversationId,
      messageId,
      selectedText: selection.selectedText,
      note,
      anchor: anchorToUse,
    };

    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.CREATE_BOOKMARK,
        data: payload,
      } as ExtensionMessage);

      if (response?.success && response.data) {
        // Create bookmark object from response
        const createdBookmark: Bookmark = {
          id: response.data.id,
          platform: this.currentPlatform,
          conversationId,
          messageId,
          anchor: anchorToUse,
          note,
          tags: response.data.tags || [],
          created: response.data.created || new Date().toISOString(),
          updated: response.data.updated || new Date().toISOString(),
          color: response.data.color || '#ffeb3b',
        };

        // Render highlight with flash animation
        await this.highlightRenderer.renderHighlight(
          createdBookmark,
          undefined,
          true
        );

        return createdBookmark;
      } else {
        console.warn('Chatmarks: Failed to save bookmark', response?.error);
        return null;
      }
    } catch (error) {
      console.error('Chatmarks: Error saving bookmark', error);
      return null;
    }
  }

  /**
   * Updates an existing bookmark.
   *
   * @param bookmarkId - The ID of the bookmark to update
   * @param updates - The fields to update
   * @returns true if successful, false otherwise
   */
  async updateBookmark(
    bookmarkId: string,
    updates: Partial<Omit<Bookmark, 'id' | 'platform' | 'created'>>
  ): Promise<boolean> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.UPDATE_BOOKMARK,
        data: {
          bookmarkId,
          ...updates,
        },
      } as ExtensionMessage);

      if (response?.success) {
        // Update highlight if visible
        const bookmarks = await this.getBookmarksForConversation();
        const bookmark = bookmarks.find(b => b.id === bookmarkId);

        if (bookmark) {
          const updatedBookmark = { ...bookmark, ...updates };
          await this.highlightRenderer.renderHighlight(updatedBookmark);
        }

        return true;
      }

      return false;
    } catch (error) {
      console.error('Chatmarks: Error updating bookmark', error);
      return false;
    }
  }

  /**
   * Deletes a bookmark.
   *
   * @param bookmarkId - The ID of the bookmark to delete
   * @returns true if successful, false otherwise
   */
  async deleteBookmark(bookmarkId: string): Promise<boolean> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.DELETE_BOOKMARK,
        data: { bookmarkId },
      } as ExtensionMessage);

      if (response?.success) {
        // Remove highlight
        this.highlightRenderer.removeHighlight(bookmarkId);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Chatmarks: Error deleting bookmark', error);
      return false;
    }
  }

  /**
   * Gets bookmarks for the current conversation.
   *
   * @param conversationId - Optional specific conversation ID
   * @returns Array of bookmarks
   */
  async getBookmarksForConversation(
    conversationId?: string
  ): Promise<Bookmark[]> {
    const convId = conversationId || extractConversationId();

    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.GET_BOOKMARKS,
        data: {
          conversationId: convId,
          platform: this.currentPlatform,
        },
      } as ExtensionMessage);

      if (response?.success && response.data && Array.isArray(response.data)) {
        return response.data as Bookmark[];
      }

      return [];
    } catch (error) {
      console.error('Chatmarks: Error fetching bookmarks', error);
      return [];
    }
  }

  /**
   * Restores existing highlights for the current conversation.
   * Uses requestIdleCallback for non-blocking restoration.
   */
  async restoreExistingHighlights(): Promise<void> {
    try {
      const conversationId = extractConversationId();
      const bookmarks = await this.getBookmarksForConversation(conversationId);

      if (bookmarks.length === 0) {
        console.debug('Chatmarks: No bookmarks found for current conversation');
        return;
      }

      console.debug(
        `Chatmarks: Restoring ${bookmarks.length} highlights for conversation ${conversationId}`
      );

      // Use requestIdleCallback for non-blocking restoration
      if ('requestIdleCallback' in window) {
        requestIdleCallback(async () => {
          await this.performHighlightRestoration(bookmarks);
        });
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(async () => {
          await this.performHighlightRestoration(bookmarks);
        }, 100);
      }
    } catch (error) {
      console.warn('Chatmarks: Failed to restore existing highlights:', error);
    }
  }

  /**
   * Performs the actual highlight restoration.
   *
   * @param bookmarks - The bookmarks to restore highlights for
   */
  private async performHighlightRestoration(
    bookmarks: Bookmark[]
  ): Promise<void> {
    try {
      const restoreResult =
        await this.highlightRenderer.restoreHighlights(bookmarks);

      console.debug(
        'Chatmarks: Highlight restoration completed:',
        restoreResult
      );

      if (restoreResult.failedToRestore > 0) {
        console.warn(
          'Chatmarks: Some highlights failed to restore:',
          restoreResult.errors
        );
      }
    } catch (error) {
      console.warn('Chatmarks: Error during highlight restoration:', error);
    }
  }

  /**
   * Sets the navigation controller for enhanced navigation features.
   *
   * @param navigationController - The navigation controller instance
   */
  setNavigationController(navigationController: any): void {
    this.navigationController = navigationController;
  }

  /**
   * Navigates to a specific bookmark using the enhanced navigation system.
   *
   * @param bookmarkId - The ID of the bookmark to navigate to
   * @returns Navigation result with success status and timing
   */
  async navigateToBookmark(bookmarkId: string): Promise<NavigationResult> {
    const startTime = performance.now();
    
    try {
      // Use NavigationController if available for enhanced navigation
      if (this.navigationController) {
        const success = await this.navigationController.navigateToBookmark(bookmarkId);
        const duration = performance.now() - startTime;
        
        return {
          success,
          duration,
          error: success ? undefined : 'Navigation controller failed to navigate',
        };
      }

      // Fallback to legacy navigation
      const success = await this.legacyNavigateToBookmark(bookmarkId);
      const duration = performance.now() - startTime;
      
      return {
        success,
        duration,
        error: success ? undefined : 'Legacy navigation failed',
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error('Chatmarks: Error navigating to bookmark', error);
      
      return {
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown navigation error',
      };
    }
  }

  /**
   * Legacy navigation method (kept for backward compatibility).
   *
   * @param bookmarkId - The ID of the bookmark to navigate to
   * @returns true if successful, false otherwise
   */
  private async legacyNavigateToBookmark(bookmarkId: string): Promise<boolean> {
    try {
      const bookmarks = await this.getBookmarksForConversation();
      const bookmark = bookmarks.find(b => b.id === bookmarkId);

      if (!bookmark) {
        console.warn('Chatmarks: Bookmark not found for navigation');
        return false;
      }

      // Try to restore the bookmark position
      const range = this.anchorSystem.resolveAnchor(bookmark.anchor);

      if (range) {
        // Scroll to the bookmark
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);

          // Scroll into view
          const rect = range.getBoundingClientRect();
          window.scrollTo({
            top: window.scrollY + rect.top - 100,
            behavior: 'smooth',
          });
        }

        // Flash the highlight using HighlightRenderer
        const bookmark = bookmarks.find(b => b.id === bookmarkId);
        if (bookmark) {
          await this.highlightRenderer.renderHighlight(bookmark, undefined, true);
        }

        return true;
      }

      console.warn('Chatmarks: Could not restore bookmark position');
      return false;
    } catch (error) {
      console.error('Chatmarks: Error in legacy navigation', error);
      return false;
    }
  }

  /**
   * Navigates to the next bookmark in the conversation.
   *
   * @returns Navigation result with success status
   */
  async navigateToNextBookmark(): Promise<NavigationResult> {
    const startTime = performance.now();
    
    if (this.navigationController) {
      try {
        const success = await this.navigationController.navigateNext();
        const duration = performance.now() - startTime;
        
        return {
          success,
          duration,
          error: success ? undefined : 'No next bookmark available',
        };
      } catch (error) {
        const duration = performance.now() - startTime;
        return {
          success: false,
          duration,
          error: error instanceof Error ? error.message : 'Next navigation failed',
        };
      }
    }
    
    return {
      success: false,
      duration: performance.now() - startTime,
      error: 'Navigation controller not available',
    };
  }

  /**
   * Navigates to the previous bookmark in the conversation.
   *
   * @returns Navigation result with success status
   */
  async navigateToPreviousBookmark(): Promise<NavigationResult> {
    const startTime = performance.now();
    
    if (this.navigationController) {
      try {
        const success = await this.navigationController.navigatePrevious();
        const duration = performance.now() - startTime;
        
        return {
          success,
          duration,
          error: success ? undefined : 'No previous bookmark available',
        };
      } catch (error) {
        const duration = performance.now() - startTime;
        return {
          success: false,
          duration,
          error: error instanceof Error ? error.message : 'Previous navigation failed',
        };
      }
    }
    
    return {
      success: false,
      duration: performance.now() - startTime,
      error: 'Navigation controller not available',
    };
  }

  /**
   * Gets the current navigation state.
   *
   * @returns Current navigation information
   */
  getNavigationState(): {
    hasNavigationController: boolean;
    currentIndex?: number;
    totalBookmarks?: number;
  } {
    if (this.navigationController) {
      return {
        hasNavigationController: true,
        currentIndex: this.navigationController.getCurrentBookmarkIndex(),
        totalBookmarks: this.navigationController.getCurrentBookmarks().length,
      };
    }
    
    return {
      hasNavigationController: false,
    };
  }

  /**
   * Gets statistics about bookmarks in the current conversation.
   *
   * @returns Object with bookmark statistics
   */
  async getBookmarkStats(): Promise<{
    total: number;
    withNotes: number;
    byMessageId: Map<string, number>;
  }> {
    const bookmarks = await this.getBookmarksForConversation();

    const stats = {
      total: bookmarks.length,
      withNotes: bookmarks.filter(b => b.note && b.note.trim()).length,
      byMessageId: new Map<string, number>(),
    };

    bookmarks.forEach(bookmark => {
      const messageId = bookmark.messageId;
      stats.byMessageId.set(
        messageId,
        (stats.byMessageId.get(messageId) || 0) + 1
      );
    });

    return stats;
  }

  /**
   * Exports bookmarks for the current conversation.
   *
   * @param format - The export format (json, markdown, etc.)
   * @returns The exported data as a string
   */
  async exportBookmarks(format: 'json' | 'markdown' = 'json'): Promise<string> {
    const bookmarks = await this.getBookmarksForConversation();

    if (format === 'json') {
      return JSON.stringify(bookmarks, null, 2);
    } else if (format === 'markdown') {
      let markdown = `# Bookmarks for Conversation\n\n`;

      bookmarks.forEach(bookmark => {
        markdown += `## "${bookmark.anchor.selectedText}"\n`;
        if (bookmark.note) {
          markdown += `**Note:** ${bookmark.note}\n`;
        }
        markdown += `*Created: ${new Date(bookmark.created).toLocaleString()}*\n\n`;
      });

      return markdown;
    }

    return '';
  }
}
