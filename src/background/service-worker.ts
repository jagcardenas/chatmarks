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

/**
 * Initialize extension on installation
 */
chrome.runtime.onInstalled.addListener(() => {
  // Extension installed - initialize core functionality

  // Set up context menu items
  setupContextMenus();

  // Initialize default settings
  initializeDefaultSettings(); //TODO: Check if await need or why async is needed here
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
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'create-bookmark' && tab?.id) {
    // Send message to content script to create bookmark
    chrome.tabs.sendMessage(tab.id, {
      type: MessageType.CREATE_BOOKMARK_FROM_CONTEXT,
      data: { selectionText: info.selectionText },
    } as BookmarkMessage);
  }
});

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

      default:
        // Unknown message type - ignoring
        return false;
    }
  }
);

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
 * Handle bookmark retrieval requests
 */
async function handleGetBookmarks(
  filters: Record<string, unknown>,
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  try {
    const result = await chrome.storage.local.get('bookmarks');
    const bookmarks = result.bookmarks || [];

    // Apply filters if provided
    let filteredBookmarks = bookmarks;
    if (filters?.conversationId) {
      filteredBookmarks = bookmarks.filter(
        (b: Bookmark) => b.conversationId === filters.conversationId
      );
    }

    sendResponse({ success: true, data: filteredBookmarks });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle create bookmark requests (mocked persistence in chrome.storage.local)
 */
async function handleCreateBookmark(
  data: Record<string, unknown>,
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  try {
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

    const existing = await chrome.storage.local.get('bookmarks');
    const bookmarks: Bookmark[] = existing.bookmarks || [];
    bookmarks.push(newBookmark);
    await chrome.storage.local.set({ bookmarks });

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
