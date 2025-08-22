/**
 * Popup Script for Chatmarks Extension
 *
 * Handles the extension popup interface, displays bookmark summaries,
 * and provides quick access to extension features.
 */

import { MessageType, ExtensionMessage } from '../types/messages';
import { Bookmark } from '../types/bookmark';

/**
 * Initialize popup interface when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', initializePopup);

/**
 * Initialize the popup interface and load data
 */
async function initializePopup(): Promise<void> {
  try {
    // Apply theme based on saved settings
    await applyAccentFromSettings();

    // Load bookmark summary
    await loadBookmarkSummary();

    // Load recent bookmarks
    await loadRecentBookmarks();

    // Set up event listeners
    setupEventListeners();

    console.log('Chatmarks popup initialized');
  } catch (error) {
    console.error('Failed to initialize popup:', error);
    showErrorState('Failed to load bookmarks');
  }
}

/**
 * Read accent color from settings and apply CSS variables
 */
async function applyAccentFromSettings(): Promise<void> {
  try {
    const result = await chrome.storage.local.get('settings');
    const accent = result?.settings?.accentColor as string | undefined;
    if (accent) {
      document.documentElement.style.setProperty('--cm-primary', accent);
      const darker = shadeColor(accent, -12);
      document.documentElement.style.setProperty('--cm-primary-600', darker);
      const light = toRGBA(accent, 0.15);
      document.documentElement.style.setProperty('--cm-primary-100', light);
    }
  } catch {
    // no-op fallback to defaults
  }
}

function shadeColor(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  const R = Math.round((t - r) * p + r);
  const G = Math.round((t - g) * p + g);
  const B = Math.round((t - b) * p + b);
  return rgbToHex(R, G, B);
}

function toRGBA(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(
    normalized.length === 3
      ? normalized
          .split('')
          .map(c => c + c)
          .join('')
      : normalized,
    16
  );
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map(x => {
        const h = x.toString(16);
        return h.length === 1 ? '0' + h : h;
      })
      .join('')
  );
}

/**
 * Load and display bookmark summary statistics
 */
async function loadBookmarkSummary(): Promise<void> {
  try {
    const response = await sendMessageToBackground({
      type: MessageType.GET_BOOKMARKS,
      data: {},
    });

    if (response.success) {
      const bookmarks: Bookmark[] = response.data || [];

      // Update total bookmarks count
      const totalElement = document.getElementById('total-bookmarks');
      if (totalElement) {
        totalElement.textContent = bookmarks.length.toString();
      }

      // Get current tab to determine conversation context
      const currentConversationBookmarks =
        await getCurrentConversationBookmarks(bookmarks);
      const currentConversationElement = document.getElementById(
        'current-conversation'
      );
      if (currentConversationElement) {
        currentConversationElement.textContent =
          currentConversationBookmarks.length.toString();
      }
    }
  } catch (error) {
    console.error('Failed to load bookmark summary:', error);
  }
}

/**
 * Get bookmarks for the current conversation
 */
async function getCurrentConversationBookmarks(
  allBookmarks: Bookmark[]
): Promise<Bookmark[]> {
  try {
    const [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!currentTab?.url) return [];

    // Extract conversation ID from current URL (simplified version)
    const conversationId = extractConversationIdFromUrl(currentTab.url);
    if (!conversationId) return [];

    return allBookmarks.filter(
      bookmark => bookmark.conversationId === conversationId
    );
  } catch (error) {
    console.error('Failed to get current conversation bookmarks:', error);
    return [];
  }
}

/**
 * Extract conversation ID from URL (basic implementation)
 */
function extractConversationIdFromUrl(url: string): string | null {
  // ChatGPT URL patterns: https://chatgpt.com/c/[conversation-id] or https://chat.openai.com/c/[conversation-id]
  const chatGptMatch = url.match(
    /(?:chatgpt\.com|chat\.openai\.com)\/c\/([^/?]+)/
  );
  if (chatGptMatch) return chatGptMatch[1] || null;

  // Claude URL pattern: https://claude.ai/chat/[conversation-id]
  const claudeMatch = url.match(/claude\.ai\/chat\/([^/?]+)/);
  if (claudeMatch) return claudeMatch[1] || null;

  // Grok patterns will be added when platform adapter is implemented

  return null;
}

/**
 * Load and display recent bookmarks
 */
async function loadRecentBookmarks(): Promise<void> {
  try {
    const response = await sendMessageToBackground({
      type: MessageType.GET_BOOKMARKS,
      data: {},
    });

    if (response.success) {
      const bookmarks: Bookmark[] = response.data || [];

      // Sort by creation date (most recent first) and take top 5
      const recentBookmarks = bookmarks
        .sort(
          (a, b) =>
            new Date(b.created).getTime() - new Date(a.created).getTime()
        )
        .slice(0, 5);

      displayRecentBookmarks(recentBookmarks);
    }
  } catch (error) {
    console.error('Failed to load recent bookmarks:', error);
  }
}

/**
 * Display recent bookmarks in the popup
 */
function displayRecentBookmarks(bookmarks: Bookmark[]): void {
  const listContainer = document.getElementById('recent-bookmarks-list');
  if (!listContainer) return;

  if (bookmarks.length === 0) {
    listContainer.innerHTML =
      '<p class="empty-state">No bookmarks yet. Select text on ChatGPT, Claude, or Grok to create your first bookmark.</p>';
    return;
  }

  const bookmarkElements = bookmarks.map(bookmark =>
    createBookmarkElement(bookmark)
  );
  listContainer.innerHTML = '';
  bookmarkElements.forEach(element => listContainer.appendChild(element));
}

/**
 * Create HTML element for a bookmark item
 */
function createBookmarkElement(bookmark: Bookmark): HTMLElement {
  const bookmarkItem = document.createElement('div');
  bookmarkItem.className = 'bookmark-item';
  bookmarkItem.dataset.bookmarkId = bookmark.id;

  const truncatedText =
    bookmark.anchor.selectedText.length > 50
      ? bookmark.anchor.selectedText.substring(0, 50) + '...'
      : bookmark.anchor.selectedText;

  bookmarkItem.innerHTML = `
    <div class="bookmark-text">"${truncatedText}"</div>
    <div class="bookmark-meta">
      <span class="bookmark-platform">${bookmark.platform}</span>
      <span class="bookmark-date">${formatDate(bookmark.created)}</span>
    </div>
    ${bookmark.note ? `<div class="bookmark-note">${bookmark.note}</div>` : ''}
  `;

  bookmarkItem.addEventListener('click', () => navigateToBookmark(bookmark.id));

  return bookmarkItem;
}

/**
 * Format date for display in popup
 */
function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 24) {
    return `${Math.floor(diffHours)}h ago`;
  } else {
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }
}

/**
 * Navigate to a specific bookmark
 */
async function navigateToBookmark(bookmarkId: string): Promise<void> {
  try {
    const [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (currentTab?.id) {
      await chrome.tabs.sendMessage(currentTab.id, {
        type: MessageType.NAVIGATE_TO_BOOKMARK,
        data: { bookmarkId },
      } as ExtensionMessage);
    }

    // Close popup after navigation
    window.close();
  } catch (error) {
    console.error('Failed to navigate to bookmark:', error);
  }
}

/**
 * Set up event listeners for popup interactions
 */
function setupEventListeners(): void {
  // Show sidebar button
  const showSidebarBtn = document.getElementById('show-sidebar-btn');
  showSidebarBtn?.addEventListener('click', handleShowSidebar);

  // Open options button
  const openOptionsBtn = document.getElementById('open-options-btn');
  openOptionsBtn?.addEventListener('click', handleOpenOptions);
}

/**
 * Handle show sidebar button click
 */
async function handleShowSidebar(): Promise<void> {
  try {
    const [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (currentTab?.id) {
      await chrome.tabs.sendMessage(currentTab.id, {
        type: MessageType.SHOW_BOOKMARK_SIDEBAR,
        data: {},
      } as ExtensionMessage);
    }

    window.close();
  } catch (error) {
    console.error('Failed to show sidebar:', error);
  }
}

/**
 * Handle open options button click
 */
function handleOpenOptions(): void {
  chrome.runtime.openOptionsPage();
  window.close();
}

/**
 * Send message to background script and wait for response
 */
function sendMessageToBackground(message: ExtensionMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Show error state in popup
 */
function showErrorState(message: string): void {
  const mainContainer = document.querySelector('.popup-main');
  if (mainContainer) {
    mainContainer.innerHTML = `
      <div class="error-state">
        <p>⚠️ ${message}</p>
        <button onclick="window.location.reload()">Retry</button>
      </div>
    `;
  }
}
