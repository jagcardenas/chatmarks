/**
 * Service Worker for Chatmarks Chrome Extension
 * 
 * Handles background tasks, context menu management, and inter-context messaging.
 * Maintains minimal resource usage while providing core extension functionality.
 */

import { BookmarkMessage, MessageType } from '../types/messages';

/**
 * Initialize extension on installation
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('Chatmarks extension installed');
  
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
      'https://claude.ai/*',
      'https://x.com/*',
      'https://grok.x.ai/*'
    ]
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
      showSidebar: 'Ctrl+Shift+B'
    },
    autoSave: true,
    showMinimap: true
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
      data: { selectionText: info.selectionText }
    } as BookmarkMessage);
  }
});

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
  switch (message.type) {
    case MessageType.GET_SETTINGS:
      handleGetSettings(sendResponse);
      return true; // Keep message channel open for async response

    case MessageType.SAVE_SETTINGS:
      handleSaveSettings(message.data, sendResponse);
      return true;

    case MessageType.GET_BOOKMARKS:
      handleGetBookmarks(message.data, sendResponse);
      return true;

    default:
      console.warn('Unknown message type:', message.type);
      return false;
  }
});

/**
 * Handle settings retrieval requests
 */
async function handleGetSettings(sendResponse: (response: any) => void): Promise<void> {
  try {
    const result = await chrome.storage.local.get('settings');
    sendResponse({ success: true, data: result.settings });
  } catch (error) {
    sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Handle settings save requests
 */
async function handleSaveSettings(settings: any, sendResponse: (response: any) => void): Promise<void> {
  try {
    await chrome.storage.local.set({ settings });
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Handle bookmark retrieval requests
 */
async function handleGetBookmarks(filters: any, sendResponse: (response: any) => void): Promise<void> {
  try {
    const result = await chrome.storage.local.get('bookmarks');
    const bookmarks = result.bookmarks || [];
    
    // Apply filters if provided
    let filteredBookmarks = bookmarks;
    if (filters?.conversationId) {
      filteredBookmarks = bookmarks.filter((b: any) => b.conversationId === filters.conversationId);
    }
    
    sendResponse({ success: true, data: filteredBookmarks });
  } catch (error) {
    sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}