/**
 * Main Content Script Entry Point
 * 
 * Initializes the bookmark system on supported AI platforms.
 * Detects the current platform and sets up appropriate adapters and event listeners.
 */

import './styles.css';
import { Platform, SelectionRange } from '../types/bookmark';
import { MessageType, ExtensionMessage } from '../types/messages';
import { TextSelectionManager, PlatformTextSelection } from '../utils/text-selection';

// Global instances for text selection management
let selectionManager: TextSelectionManager;
let platformSelection: PlatformTextSelection;
let currentPlatform: Platform | null = null;
let currentSelection: SelectionRange | null = null;

/**
 * Initialize the content script based on detected platform
 */
async function initializeContentScript(): Promise<void> {
  try {
    currentPlatform = detectCurrentPlatform();
    
    if (!currentPlatform) {
      console.log('Chatmarks: Platform not supported');
      return;
    }

    console.log(`Chatmarks: Initializing on ${currentPlatform} platform`);
    
    // Initialize text selection managers
    selectionManager = new TextSelectionManager();
    platformSelection = new PlatformTextSelection();
    
    // Set up selection event listeners
    setupSelectionListeners();
    
    // Set up keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Initialize platform-specific adapter (will be implemented in later tasks)
    // const adapter = await createPlatformAdapter(currentPlatform);
    
    // Notify background script that platform is ready
    chrome.runtime.sendMessage({
      type: MessageType.PLATFORM_DETECTED,
      data: { platform: currentPlatform }
    } as ExtensionMessage);
    
  } catch (error) {
    console.error('Chatmarks: Failed to initialize content script:', error);
  }
}

/**
 * Detect which AI platform the current page belongs to
 */
function detectCurrentPlatform(): Platform | null {
  const hostname = window.location.hostname;
  
  if (hostname.includes('chat.openai.com')) {
    return 'chatgpt';
  } else if (hostname.includes('claude.ai')) {
    return 'claude';
  } else if (hostname.includes('x.com') || hostname.includes('grok.x.ai')) {
    return 'grok';
  }
  
  return null;
}

/**
 * Set up event listeners for text selection
 */
function setupSelectionListeners(): void {
  document.addEventListener('selectionchange', handleSelectionChange);
  document.addEventListener('mouseup', handleMouseUp);
}

/**
 * Handle text selection changes with comprehensive selection capture
 */
function handleSelectionChange(): void {
  if (!selectionManager || !currentPlatform) return;

  const selectionData = platformSelection.getSelectionForPlatform(currentPlatform);
  
  if (!selectionData) {
    // Hide any visible bookmark creation UI
    hideBookmarkCreationUI();
    return;
  }

  // Log detailed selection information for development
  console.log('Chatmarks: Text selected:', {
    text: selectionData.text,
    anchor: selectionData.anchor,
    platform: currentPlatform,
    boundingRect: selectionData.boundingRect
  });

  // Store current selection for bookmark creation
  storeCurrentSelection(selectionData);
}

/**
 * Store current selection data for bookmark creation
 */
function storeCurrentSelection(selectionData: SelectionRange): void {
  currentSelection = selectionData;
}

/**
 * Handle mouse up events for selection completion
 */
function handleMouseUp(event: MouseEvent): void {
  // Small delay to ensure selection is finalized
  setTimeout(() => {
    if (currentSelection && currentSelection.text.trim()) {
      showBookmarkCreationUI(event);
    }
  }, 10);
}

/**
 * Show bookmark creation UI near the cursor position
 */
function showBookmarkCreationUI(event: MouseEvent): void {
  // Placeholder for bookmark creation UI (Task 11)
  console.log('Chatmarks: Would show bookmark creation UI at:', event.clientX, event.clientY);
}

/**
 * Hide bookmark creation UI
 */
function hideBookmarkCreationUI(): void {
  // Placeholder for hiding UI (Task 11)
  console.log('Chatmarks: Would hide bookmark creation UI');
}

/**
 * Set up keyboard shortcuts for bookmark operations
 */
function setupKeyboardShortcuts(): void {
  document.addEventListener('keydown', handleKeyboardShortcut);
}

/**
 * Handle keyboard shortcut events
 */
function handleKeyboardShortcut(event: KeyboardEvent): void {
  // Handle Ctrl+B (or Cmd+B on Mac) for bookmark creation
  if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      event.preventDefault();
      createBookmarkFromSelection();
    }
  }
}

/**
 * Create a bookmark from the current text selection
 */
function createBookmarkFromSelection(): void {
  if (!currentSelection || !currentPlatform) {
    console.warn('Chatmarks: No selection or platform available for bookmark creation');
    return;
  }

  // Extract conversation and message IDs from current page
  const conversationId = extractConversationId();
  const messageId = currentSelection.anchor.messageId || generateMessageId();

  console.log('Chatmarks: Creating bookmark with data:', {
    platform: currentPlatform,
    conversationId,
    messageId,
    selectedText: currentSelection.text,
    anchor: currentSelection.anchor
  });

  // Placeholder for actual bookmark creation (Task 9)
  // This will send the bookmark data to background script for storage
}

/**
 * Listen for messages from background script and popup
 */
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  switch (message.type) {
    case MessageType.CREATE_BOOKMARK_FROM_CONTEXT:
      handleContextMenuBookmarkCreation(message.data);
      break;
      
    case MessageType.NAVIGATE_TO_BOOKMARK:
      handleBookmarkNavigation(message.data);
      break;
      
    default:
      console.warn('Chatmarks: Unknown message type:', message.type);
  }
});

/**
 * Handle bookmark creation from context menu
 */
function handleContextMenuBookmarkCreation(data: any): void {
  // Placeholder for context menu bookmark creation (Task 14)
  console.log('Chatmarks: Would create bookmark from context menu:', data.selectionText);
}

/**
 * Handle navigation to a specific bookmark
 */
function handleBookmarkNavigation(data: any): void {
  // Placeholder for bookmark navigation (Task 15)
  console.log('Chatmarks: Would navigate to bookmark:', data.bookmarkId);
}

/**
 * Extract conversation ID from current URL
 */
function extractConversationId(): string {
  const url = window.location.href;
  
  // ChatGPT URL pattern: https://chat.openai.com/c/[conversation-id]
  const chatGptMatch = url.match(/chat\.openai\.com\/c\/([^/?]+)/);
  if (chatGptMatch) return chatGptMatch[1] || '';
  
  // Claude URL pattern: https://claude.ai/chat/[conversation-id]
  const claudeMatch = url.match(/claude\.ai\/chat\/([^/?]+)/);
  if (claudeMatch) return claudeMatch[1] || '';
  
  // Grok patterns (will be refined when platform adapter is implemented)
  const grokMatch = url.match(/x\.com.*\/([^/?]+)/);
  if (grokMatch) return grokMatch[1] || '';
  
  // Fallback to URL hash or generate from timestamp
  return generateConversationId();
}

/**
 * Generate a conversation ID when none can be extracted from URL
 */
function generateConversationId(): string {
  // Use a combination of hostname and timestamp
  const hostname = window.location.hostname;
  const timestamp = Date.now();
  return `${hostname}-${timestamp}`;
}

/**
 * Generate a message ID from selection context
 */
function generateMessageId(): string {
  // Use current selection and timestamp to create a unique message ID
  if (currentSelection) {
    const textHash = currentSelection.anchor.checksum;
    const timestamp = Date.now();
    return `msg-${textHash}-${timestamp}`;
  }
  
  return `msg-${Date.now()}`;
}

// Initialize the content script when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  initializeContentScript();
}