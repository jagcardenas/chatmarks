/**
 * MessageHandler Module
 *
 * Handles Chrome runtime messages for inter-context communication.
 * Routes messages to appropriate handlers for bookmark operations,
 * navigation, and context menu actions.
 */

import { MessageType, ExtensionMessage } from '../types/messages';
import { BookmarkOperations } from './BookmarkOperations';
import { SelectionManager } from './SelectionManager';

export class MessageHandler {
  private bookmarkOperations: BookmarkOperations | null = null;
  private selectionManager: SelectionManager | null = null;
  private messageListener: ((message: ExtensionMessage) => void) | null = null;
  private heartbeatInterval: number | null = null;

  /**
   * Sets the bookmark operations instance for message handling.
   *
   * @param bookmarkOperations - The bookmark operations instance
   */
  setBookmarkOperations(bookmarkOperations: BookmarkOperations): void {
    this.bookmarkOperations = bookmarkOperations;
  }

  /**
   * Sets the selection manager instance for message handling.
   *
   * @param selectionManager - The selection manager instance
   */
  setSelectionManager(selectionManager: SelectionManager): void {
    this.selectionManager = selectionManager;
  }

  /**
   * Initializes the message listener and heartbeat.
   */
  initialize(): void {
    this.messageListener = (message: ExtensionMessage) => {
      this.handleMessage(message);
    };

    chrome.runtime.onMessage.addListener(this.messageListener);

    // Start heartbeat to keep connection alive
    this.startHeartbeat();
  }

  /**
   * Routes messages to appropriate handlers.
   *
   * @param message - The extension message to handle
   */
  private handleMessage(message: ExtensionMessage): void {
    switch (message.type) {
      case MessageType.CREATE_BOOKMARK_FROM_CONTEXT:
        this.handleContextMenuBookmarkCreation(message.data || {});
        break;

      case MessageType.NAVIGATE_TO_BOOKMARK:
        this.handleBookmarkNavigation(message.data || {});
        break;

      case MessageType.SHOW_BOOKMARK_SIDEBAR:
        this.handleShowSidebar(message.data || {});
        break;

      case MessageType.HIDE_BOOKMARK_SIDEBAR:
        this.handleHideSidebar();
        break;

      default:
        // Unknown message type - log for debugging
        console.debug(
          'Chatmarks: Unknown message type received:',
          message.type
        );
    }
  }

  /**
   * Handles bookmark creation from context menu.
   *
   * @param data - The context menu data
   */
  private async handleContextMenuBookmarkCreation(
    data: Record<string, unknown>
  ): Promise<void> {
    if (!this.bookmarkOperations || !this.selectionManager) {
      console.warn(
        'Chatmarks: Cannot create bookmark - managers not initialized'
      );
      return;
    }

    // Get current selection
    const selection = this.selectionManager.getCurrentSelection();

    if (!selection) {
      console.warn(
        'Chatmarks: No selection available for context menu bookmark'
      );
      return;
    }

    // Extract note from context menu data if provided
    const note = (data.note as string) || '';

    // Create bookmark
    const bookmark = await this.bookmarkOperations.saveBookmark(
      selection,
      note
    );

    if (bookmark) {
      console.debug(
        'Chatmarks: Bookmark created from context menu:',
        bookmark.id
      );

      // Clear selection after successful creation
      this.selectionManager.clearCurrentSelection();
    } else {
      console.error('Chatmarks: Failed to create bookmark from context menu');
    }
  }

  /**
   * Handles navigation to a specific bookmark.
   *
   * @param data - The navigation data
   */
  private async handleBookmarkNavigation(
    data: Record<string, unknown>
  ): Promise<void> {
    if (!this.bookmarkOperations) {
      console.warn(
        'Chatmarks: Cannot navigate - bookmark operations not initialized'
      );
      return;
    }

    const bookmarkId = data.bookmarkId as string;

    if (!bookmarkId) {
      console.error('Chatmarks: No bookmark ID provided for navigation');
      return;
    }

    const success =
      await this.bookmarkOperations.navigateToBookmark(bookmarkId);

    if (success) {
      console.debug('Chatmarks: Navigated to bookmark:', bookmarkId);
    } else {
      console.error('Chatmarks: Failed to navigate to bookmark:', bookmarkId);
    }
  }

  /**
   * Handles showing the bookmark sidebar.
   * Placeholder for future implementation (Task 17).
   *
   * @param data - The sidebar configuration data
   */
  private handleShowSidebar(data: Record<string, unknown>): void {
    // TODO: Implement sidebar display (Task 17)
    console.log('Chatmarks: Show sidebar requested with data:', data);
  }

  /**
   * Handles hiding the bookmark sidebar.
   * Placeholder for future implementation (Task 17).
   */
  private handleHideSidebar(): void {
    // TODO: Implement sidebar hiding (Task 17)
    console.log('Chatmarks: Hide sidebar requested');
  }

  /**
   * Sends a message to the background script.
   *
   * @param message - The message to send
   * @returns Promise resolving to the response
   */
  async sendMessage(message: ExtensionMessage): Promise<unknown> {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      console.error('Chatmarks: Error sending message:', error);
      throw error;
    }
  }

  /**
   * Notifies the background script that a platform has been detected.
   *
   * @param platform - The detected platform
   */
  async notifyPlatformDetected(platform: string): Promise<void> {
    try {
      await this.sendMessage({
        type: MessageType.PLATFORM_DETECTED,
        data: { platform },
      });
    } catch (error) {
      console.error('Chatmarks: Failed to notify platform detection:', error);
    }
  }

  /**
   * Starts the heartbeat mechanism to keep connection alive.
   */
  private startHeartbeat(): void {
    // Send heartbeat every 25 seconds (less than the 30 second stale threshold)
    this.heartbeatInterval = window.setInterval(() => {
      this.sendHeartbeat();
    }, 25000);
  }

  /**
   * Stops the heartbeat mechanism.
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Sends a heartbeat message to the service worker.
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      await this.sendMessage({
        type: MessageType.PLATFORM_DETECTED,
        data: { heartbeat: true },
      });
    } catch (error) {
      console.debug('Chatmarks: Heartbeat failed, connection may be lost:', error);
    }
  }

  /**
   * Cleans up the message listener and heartbeat.
   */
  cleanup(): void {
    this.stopHeartbeat();

    if (this.messageListener) {
      chrome.runtime.onMessage.removeListener(this.messageListener);
      this.messageListener = null;
    }

    this.bookmarkOperations = null;
    this.selectionManager = null;
  }
}
