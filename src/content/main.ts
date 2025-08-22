/**
 * Main Content Script Entry Point
 *
 * Initializes the bookmark system on supported AI platforms.
 * Detects the current platform and sets up appropriate adapters and event listeners.
 */

import './styles.css';
import { Platform, SelectionRange, TextAnchor } from '../types/bookmark';
import { MessageType, ExtensionMessage } from '../types/messages';
import { TextSelection } from './selection/TextSelection';

// Global instance for text selection management
let textSelection: TextSelection;
let currentPlatform: Platform | null = null;
let currentSelection: SelectionRange | null = null;
let floatingButtonEl: HTMLButtonElement | null = null;
let dialogContainerEl: HTMLDivElement | null = null;
let dialogOverlayEl: HTMLDivElement | null = null;

// Theme cache
let appliedAccent: string | null = null;
let appliedHighlight: string | null = null;

/**
 * Creates a basic anchor for selections without full anchor data
 */
function createBasicAnchor(selection: SelectionRange): TextAnchor {
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
 * Initialize the content script based on detected platform
 */
async function initializeContentScript(): Promise<void> {
  try {
    currentPlatform = detectCurrentPlatform();

    if (!currentPlatform) {
      // Platform not supported
      return;
    }

    // Initialize on detected platform

    // Initialize text selection manager
    textSelection = new TextSelection();

    // Set up selection event listeners
    setupSelectionListeners();

    // Set up keyboard shortcuts
    setupKeyboardShortcuts();

    // Apply theme from settings
    await applyThemeFromSettings();

    // Initialize platform-specific adapter (will be implemented in later tasks)
    // const adapter = await createPlatformAdapter(currentPlatform);

    // Notify background script that platform is ready
    chrome.runtime.sendMessage({
      type: MessageType.PLATFORM_DETECTED,
      data: { platform: currentPlatform },
    } as ExtensionMessage);
  } catch {
    // Failed to initialize content script - silent failure
  }
}

/**
 * Apply accent and highlight color from saved settings to CSS variables
 */
async function applyThemeFromSettings(): Promise<void> {
  try {
    const result = await chrome.storage.local.get('settings');
    const settings = result?.settings || {};
    const accent = (settings.accentColor as string) || '#2563eb';
    const highlight = (settings.highlightColor as string) || '#ffeb3b';

    if (accent !== appliedAccent) {
      document.documentElement.style.setProperty('--chatmarks-primary', accent);
      const darker = shadeColor(accent, -12);
      document.documentElement.style.setProperty(
        '--chatmarks-primary-hover',
        darker
      );
      appliedAccent = accent;
    }

    if (highlight !== appliedHighlight) {
      document.documentElement.style.setProperty(
        '--chatmarks-highlight',
        highlight
      );
      appliedHighlight = highlight;
    }
  } catch {
    // ignore, keep defaults defined in styles.css
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
 * Detect which AI platform the current page belongs to
 */
function detectCurrentPlatform(): Platform | null {
  const hostname = window.location.hostname;

  if (
    hostname.includes('chatgpt.com') ||
    hostname.includes('chat.openai.com')
  ) {
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
  if (!textSelection || !currentPlatform) return;

  const selectionData = textSelection.captureRange();

  if (!selectionData) {
    // Hide any visible bookmark creation UI
    hideBookmarkCreationUI();
    return;
  }

  // Text selection captured

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
    if (isEventWithinExtensionUI(event.target)) return;
    if (currentSelection && currentSelection.selectedText.trim()) {
      showBookmarkCreationUI(event);
    }
  }, 10);
}

/**
 * Show bookmark creation UI near the cursor position
 */
function showBookmarkCreationUI(event: MouseEvent): void {
  if (!floatingButtonEl) {
    floatingButtonEl = document.createElement('button');
    floatingButtonEl.textContent = 'Bookmark';
    floatingButtonEl.style.position = 'fixed';
    floatingButtonEl.style.zIndex = '2147483647';
    floatingButtonEl.style.padding = '6px 10px';
    floatingButtonEl.style.fontSize = '12px';
    floatingButtonEl.style.border = '1px solid var(--chatmarks-border)';
    floatingButtonEl.style.borderRadius = '6px';
    floatingButtonEl.style.background = 'var(--chatmarks-primary)';
    floatingButtonEl.style.color = '#fff';
    floatingButtonEl.style.boxShadow = 'var(--chatmarks-shadow)';
    floatingButtonEl.style.cursor = 'pointer';
    floatingButtonEl.style.userSelect = 'none';
    floatingButtonEl.addEventListener('mousedown', e => e.preventDefault());
    floatingButtonEl.addEventListener('click', () => {
      openBookmarkDialog();
    });
    document.body.appendChild(floatingButtonEl);
  }

  const margin = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const btnWidth = 90;
  const btnHeight = 30;
  let left = event.clientX + margin;
  let top = event.clientY + margin;
  if (left + btnWidth > vw) left = vw - btnWidth - margin;
  if (top + btnHeight > vh) top = vh - btnHeight - margin;
  floatingButtonEl.style.left = `${left}px`;
  floatingButtonEl.style.top = `${top}px`;
  floatingButtonEl.style.display = 'block';
}

/**
 * Hide bookmark creation UI
 */
function hideBookmarkCreationUI(): void {
  if (floatingButtonEl) {
    floatingButtonEl.style.display = 'none';
  }
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
      openBookmarkDialog();
    }
  }
}

/**
 * Create a bookmark from the current text selection
 * TODO: This will be implemented in Task 9 - Basic Bookmark CRUD Operations
 */
// function createBookmarkFromSelection(): void {
//   Implementation will be added in future tasks
// }

function isEventWithinExtensionUI(target: EventTarget | null): boolean {
  if (!target) return false;
  const node = target as Node;
  if (floatingButtonEl && floatingButtonEl.contains(node)) return true;
  if (dialogContainerEl && dialogContainerEl.contains(node)) return true;
  if (dialogOverlayEl && dialogOverlayEl.contains(node)) return true;
  return false;
}

function openBookmarkDialog(): void {
  if (!currentSelection || !currentPlatform) return;

  if (!dialogOverlayEl) {
    dialogOverlayEl = document.createElement('div');
    dialogOverlayEl.style.position = 'fixed';
    dialogOverlayEl.style.inset = '0';
    dialogOverlayEl.style.background = 'rgba(0,0,0,0.2)';
    dialogOverlayEl.style.zIndex = '2147483646';
    dialogOverlayEl.addEventListener('click', e => {
      if (e.target === dialogOverlayEl) closeBookmarkDialog();
    });
    document.body.appendChild(dialogOverlayEl);
  } else {
    dialogOverlayEl.style.display = 'block';
  }

  if (!dialogContainerEl) {
    dialogContainerEl = document.createElement('div');
    dialogContainerEl.style.position = 'fixed';
    dialogContainerEl.style.minWidth = '320px';
    dialogContainerEl.style.maxWidth = '480px';
    dialogContainerEl.style.background = '#ffffff';
    dialogContainerEl.style.color = 'var(--chatmarks-text)';
    dialogContainerEl.style.border = '1px solid var(--chatmarks-border)';
    dialogContainerEl.style.borderRadius = '8px';
    dialogContainerEl.style.boxShadow = 'var(--chatmarks-shadow)';
    dialogContainerEl.style.zIndex = '2147483647';
    dialogContainerEl.style.padding = '12px';
    dialogContainerEl.style.display = 'flex';
    dialogContainerEl.style.flexDirection = 'column';
    dialogContainerEl.style.gap = '8px';

    const titleEl = document.createElement('div');
    titleEl.textContent = 'Create bookmark';
    titleEl.style.fontSize = '14px';
    titleEl.style.fontWeight = '600';

    const selectedPreview = document.createElement('div');
    selectedPreview.textContent = `"${currentSelection.selectedText.slice(0, 140)}${currentSelection.selectedText.length > 140 ? '…' : ''}"`;
    selectedPreview.style.fontSize = '12px';
    selectedPreview.style.color = 'var(--chatmarks-text-secondary)';
    selectedPreview.style.background = 'var(--chatmarks-secondary)';
    selectedPreview.style.border = '1px solid var(--chatmarks-border)';
    selectedPreview.style.borderRadius = '6px';
    selectedPreview.style.padding = '8px';
    selectedPreview.style.maxHeight = '96px';
    selectedPreview.style.overflow = 'auto';

    const noteLabel = document.createElement('label');
    noteLabel.textContent = 'Note (optional)';
    noteLabel.style.fontSize = '12px';
    noteLabel.style.color = 'var(--chatmarks-text)';

    const noteInput = document.createElement('textarea');
    noteInput.placeholder = 'Add a short note';
    noteInput.style.width = '100%';
    noteInput.style.minHeight = '72px';
    noteInput.style.resize = 'vertical';
    noteInput.style.fontSize = '12px';
    noteInput.style.padding = '8px';
    noteInput.style.border = '1px solid var(--chatmarks-border)';
    noteInput.style.borderRadius = '6px';
    noteInput.style.outline = 'none';

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.justifyContent = 'flex-end';
    actions.style.gap = '8px';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.padding = '6px 10px';
    cancelBtn.style.fontSize = '12px';
    cancelBtn.style.border = '1px solid var(--chatmarks-border)';
    cancelBtn.style.borderRadius = '6px';
    cancelBtn.style.background = '#ffffff';
    cancelBtn.style.color = 'var(--chatmarks-text)';
    cancelBtn.addEventListener('click', () => closeBookmarkDialog());

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save Bookmark';
    saveBtn.style.padding = '6px 10px';
    saveBtn.style.fontSize = '12px';
    saveBtn.style.border = '1px solid var(--chatmarks-border)';
    saveBtn.style.borderRadius = '6px';
    saveBtn.style.background = 'var(--chatmarks-primary)';
    saveBtn.style.color = '#ffffff';
    saveBtn.addEventListener('click', async () => {
      await saveBookmark(noteInput.value.trim());
      closeBookmarkDialog();
      hideBookmarkCreationUI();
      clearCurrentSelection();
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);

    dialogContainerEl.appendChild(titleEl);
    dialogContainerEl.appendChild(selectedPreview);
    dialogContainerEl.appendChild(noteLabel);
    dialogContainerEl.appendChild(noteInput);
    dialogContainerEl.appendChild(actions);

    document.body.appendChild(dialogContainerEl);
  } else {
    dialogContainerEl.style.display = 'flex';
  }

  const rect = currentSelection.boundingRect;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const dlgWidth = Math.min(480, Math.max(320, Math.floor(vw * 0.35)));
  const dlgHeight = 220;
  const left = Math.min(
    Math.max(12, rect.left + rect.width / 2 - dlgWidth / 2),
    vw - dlgWidth - 12
  );
  const top = Math.min(
    Math.max(12, rect.top - dlgHeight - 12),
    vh - dlgHeight - 12
  );
  dialogContainerEl.style.width = `${dlgWidth}px`;
  dialogContainerEl.style.left = `${left}px`;
  dialogContainerEl.style.top = `${top}px`;
}

function closeBookmarkDialog(): void {
  if (dialogOverlayEl) dialogOverlayEl.style.display = 'none';
  if (dialogContainerEl) dialogContainerEl.style.display = 'none';
}

function clearCurrentSelection(): void {
  currentSelection = null;
  const sel = window.getSelection();
  if (sel) sel.removeAllRanges();
}

async function saveBookmark(note: string): Promise<void> {
  if (!currentSelection || !currentPlatform) return;
  const conversationId = extractConversationId();
  const messageId = currentSelection.anchor?.messageId || generateMessageId();
  const payload = {
    platform: currentPlatform,
    conversationId,
    messageId,
    selectedText: currentSelection.selectedText,
    note,
    anchor: currentSelection.anchor || createBasicAnchor(currentSelection),
  };

  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.CREATE_BOOKMARK,
      data: payload,
    } as ExtensionMessage);
    if (!response?.success) {
      console.warn('Chatmarks: Failed to save bookmark', response?.error);
    }
  } catch (error) {
    console.warn('Chatmarks: Error saving bookmark', error);
  }
}

/**
 * Listen for messages from background script and popup
 */
chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  switch (message.type) {
    case MessageType.CREATE_BOOKMARK_FROM_CONTEXT:
      handleContextMenuBookmarkCreation(message.data || {});
      break;

    case MessageType.NAVIGATE_TO_BOOKMARK:
      handleBookmarkNavigation(message.data || {});
      break;

    default:
    // Unknown message type - ignoring
  }
});

/**
 * Handle bookmark creation from context menu
 */
function handleContextMenuBookmarkCreation(
  _data: Record<string, unknown>
): void {
  // Placeholder for context menu bookmark creation (Task 14)
  // Context menu bookmark creation (placeholder)
}

/**
 * Handle navigation to a specific bookmark
 */
function handleBookmarkNavigation(_data: Record<string, unknown>): void {
  // Placeholder for bookmark navigation (Task 15)
  // Bookmark navigation (placeholder)
}

/**
 * Extract conversation ID from current URL
 */
function extractConversationId(): string {
  const url = window.location.href;

  // ChatGPT URL patterns: https://chatgpt.com/c/[conversation-id] or https://chat.openai.com/c/[conversation-id]
  const chatGptMatch = url.match(
    /(?:chatgpt\.com|chat\.openai\.com)\/c\/([^/?]+)/
  );
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
    const textHash = currentSelection.anchor?.checksum || '';
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
