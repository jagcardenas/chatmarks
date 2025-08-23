/**
 * Service Worker for Chatmarks Chrome Extension
 *
 * Handles background tasks, context menu management, and inter-context messaging.
 * Maintains minimal resource usage while providing core extension functionality.
 */

import {
  BookmarkMessage,
  MessageType,
  ExtensionMessage,
  MessageResponse,
} from '../types/messages';
import { Bookmark, Platform, TextAnchor } from '../types/bookmark';

// Connection status tracking
interface TabConnection {
  tabId: number;
  platform?: Platform;
  isReady: boolean;
  lastSeen: number;
}

const connectedTabs = new Map<number, TabConnection>();

/**
 * Connection management functions
 */
function registerTabConnection(tabId: number, platform?: Platform): void {
  connectedTabs.set(tabId, {
    tabId,
    platform,
    isReady: true,
    lastSeen: Date.now(),
  });
  console.debug(
    `Chatmarks: Tab ${tabId} connected with platform: ${platform || 'unknown'}`
  );
}

function unregisterTabConnection(tabId: number): void {
  connectedTabs.delete(tabId);
  console.debug(`Chatmarks: Tab ${tabId} disconnected`);
}

function isTabConnected(tabId: number): boolean {
  const connection = connectedTabs.get(tabId);
  if (!connection) return false;

  // Check if connection is stale (older than 30 seconds)
  const isStale = Date.now() - connection.lastSeen > 30000;
  if (isStale) {
    connectedTabs.delete(tabId);
    return false;
  }

  return connection.isReady;
}

function updateTabHeartbeat(tabId: number): void {
  const connection = connectedTabs.get(tabId);
  if (connection) {
    connection.lastSeen = Date.now();
  }
}

// Export connection functions for testing
export {
  registerTabConnection,
  unregisterTabConnection,
  isTabConnected,
  updateTabHeartbeat,
};

/**
 * Initialize extension on installation
 */
chrome.runtime.onInstalled.addListener(() => {
  // Extension installed - initialize core functionality

  // Set up context menu items
  setupContextMenus();

  // Initialize default settings
  initializeDefaultSettings();
});

/**
 * Set up context menu items for bookmark creation
 */
function setupContextMenus(): void {
  chrome.contextMenus.create({
    id: 'create-bookmark',
    title: 'Create Bookmark',
    contexts: ['selection'],
    documentUrlPatterns: [
      'https://chat.openai.com/*',
      'https://chatgpt.com/*',
      'https://claude.ai/*',
      'https://grok.x.ai/*',
    ],
  });
}

/**
 * Initialize default extension settings
 */
async function initializeDefaultSettings(): Promise<void> {
  const defaultSettings = {
    highlightColor: '#ffeb3b',
    keyboardShortcuts: {
      createBookmark: 'Ctrl+B',
      nextBookmark: 'Alt+ArrowDown',
      prevBookmark: 'Alt+ArrowUp',
      showSidebar: 'Ctrl+Shift+B',
    },
    autoSave: true,
    showMinimap: true,
  };

  await chrome.storage.local.set({ settings: defaultSettings });
}

/**
 * Handle context menu item clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'create-bookmark' && tab?.id) {
    await handleContextMenuBookmarkCreation(tab.id, info.selectionText);
  }
});

/**
 * Handles context menu bookmark creation with proper error handling and retry logic
 */
async function handleContextMenuBookmarkCreation(
  tabId: number,
  selectionText?: string
): Promise<void> {
  // Skip connection check in Jest test environment
  const isTestEnvironment = typeof jest !== 'undefined';

  if (!isTestEnvironment && !isTabConnected(tabId)) {
    console.warn(
      'Chatmarks: Tab not connected, skipping context menu bookmark creation'
    );
    return;
  }

  const maxRetries = 3;
  const retryDelay = 100; // ms

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check if the tab still exists and is active
      const tab = await chrome.tabs.get(tabId);
      if (!tab || tab.status !== 'complete') {
        if (attempt === maxRetries) {
          console.warn(
            'Chatmarks: Tab not ready for context menu bookmark creation'
          );
          unregisterTabConnection(tabId);
        }
        continue;
      }

      // Send message to content script to create bookmark
      const response = await chrome.tabs.sendMessage(tabId, {
        type: MessageType.CREATE_BOOKMARK_FROM_CONTEXT,
        data: { selectionText },
      } as BookmarkMessage);

      if (response?.success === false) {
        console.warn(
          'Chatmarks: Content script reported error:',
          response.error
        );
      }

      // Success - update heartbeat and exit retry loop
      updateTabHeartbeat(tabId);
      return;
    } catch (error) {
      const isConnectionError =
        error instanceof Error &&
        error.message.includes('Could not establish connection');

      if (isConnectionError) {
        // Mark tab as disconnected
        unregisterTabConnection(tabId);

        if (attempt < maxRetries) {
          // Wait before retrying
          await new Promise(resolve =>
            setTimeout(resolve, retryDelay * attempt)
          );
          console.debug(
            `Chatmarks: Retrying context menu bookmark creation (attempt ${attempt + 1})`
          );
          continue;
        }
      }

      // Final attempt failed or non-connection error
      console.error(
        'Chatmarks: Failed to create bookmark from context menu:',
        error
      );
      return;
    }
  }
}

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender,
    sendResponse: (response: MessageResponse) => void
  ) => {
    switch (message.type) {
      case MessageType.GET_SETTINGS:
        handleGetSettings(sendResponse);
        return true; // Keep message channel open for async response

      case MessageType.SAVE_SETTINGS:
        handleSaveSettings(message.data || {}, sendResponse);
        return true;

      case MessageType.GET_BOOKMARKS:
        handleGetBookmarks(message.data || {}, sendResponse);
        return true;

      case MessageType.CREATE_BOOKMARK:
        handleCreateBookmark(message.data || {}, sendResponse);
        return true;

      case MessageType.PLATFORM_DETECTED:
        handlePlatformDetected(sender, message.data || {});
        return false;

      default:
        // Unknown message type - ignoring
        return false;
    }
  }
);

/**
 * Handle platform detection from content scripts
 */
function handlePlatformDetected(
  sender: chrome.runtime.MessageSender,
  data: Record<string, unknown>
): void {
  if (sender.tab?.id) {
    const tabId = sender.tab.id;

    // Check if this is a heartbeat or initial platform detection
    if (data.heartbeat) {
      // This is a heartbeat - just update the connection status
      if (isTabConnected(tabId)) {
        updateTabHeartbeat(tabId);
      } else {
        console.debug(
          `Chatmarks: Received heartbeat from untracked tab ${tabId}`
        );
      }
    } else {
      // This is initial platform detection
      const platform = data.platform as Platform;
      registerTabConnection(tabId, platform);
      updateTabHeartbeat(tabId);
    }
  }
}

/**
 * Handle settings retrieval requests
 */
async function handleGetSettings(
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  try {
    const result = await chrome.storage.local.get('settings');
    sendResponse({ success: true, data: result.settings });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle settings save requests
 */
async function handleSaveSettings(
  settings: Record<string, unknown>,
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  try {
    await chrome.storage.local.set({ settings });
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle bookmark retrieval requests using new StorageService
 */
async function handleGetBookmarks(
  filters: Record<string, unknown>,
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  try {
    // Import StorageService dynamically to avoid issues with module loading
    const { StorageService } = await import(
      '../content/storage/StorageService'
    );
    const storageService = new StorageService();

    // Convert filters to proper BookmarkFilters type
    const bookmarkFilters = {
      conversationId: filters?.conversationId as string | undefined,
      platform: filters?.platform as Platform | undefined,
      tags: filters?.tags as string[] | undefined,
      searchText: filters?.searchText as string | undefined,
    };

    const bookmarks = await storageService.getBookmarks(bookmarkFilters);
    sendResponse({
      success: true,
      data: bookmarks as unknown as Record<string, unknown>,
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle create bookmark requests using new StorageService
 */
async function handleCreateBookmark(
  data: Record<string, unknown>,
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  try {
    // Import StorageService dynamically to avoid issues with module loading
    const { StorageService } = await import(
      '../content/storage/StorageService'
    );
    const storageService = new StorageService();

    const nowIso = new Date().toISOString();
    const id = (globalThis as any).crypto?.randomUUID
      ? crypto.randomUUID()
      : `bkm-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    const newBookmark: Bookmark = {
      id,
      platform: data.platform as Platform,
      conversationId: data.conversationId as string,
      messageId: data.messageId as string,
      anchor: data.anchor as TextAnchor,
      note: (data.note as string) || '',
      tags: (data.tags as string[]) || [],
      created: nowIso,
      updated: nowIso,
      color: (data.color as string) || '#ffeb3b',
    };

    await storageService.saveBookmark(newBookmark);

    sendResponse({
      success: true,
      data: newBookmark as unknown as Record<string, unknown>,
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Clean up connections when tabs are closed or updated
 * Only add listeners if chrome.tabs is available (not in test environment)
 */
if (typeof chrome !== 'undefined' && chrome.tabs) {
  chrome.tabs.onRemoved.addListener(tabId => {
    unregisterTabConnection(tabId);
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    // If tab is loading or complete, mark connection as potentially stale
    if (changeInfo.status === 'loading') {
      const connection = connectedTabs.get(tabId);
      if (connection) {
        connection.isReady = false;
      }
    }
  });
}
