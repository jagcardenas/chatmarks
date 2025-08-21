/**
 * Text Selection Implementation
 *
 * Core module for handling text selection and Range API operations
 * in AI chat interfaces. Provides robust text capture with high accuracy.
 */

import { SelectionRange } from '../../types/bookmark';

/**
 * Main class for text selection operations
 */
export class TextSelection {
  private selectionListeners: Set<(_selection: SelectionRange | null) => void>;
  private debounceTimer: ReturnType<typeof setTimeout> | null;
  private readonly DEBOUNCE_DELAY = 50;
  private readonly CONTEXT_LENGTH = 50;

  constructor() {
    this.selectionListeners = new Set();
    this.debounceTimer = null;
  }

  /**
   * Captures the current selection range with all necessary data
   */
  captureRange(): SelectionRange | null {
    const selection = window?.getSelection?.();

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return null;
    }

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();

    if (!selectedText) {
      return null;
    }

    // Get bounding rectangle for positioning
    // Handle both real browser and test environment
    const boundingRect = range.getBoundingClientRect?.() || {
      top: 0,
      left: 0,
      width: 0,
      height: 0,
      bottom: 0,
      right: 0,
    };

    // Extract context around selection
    const { contextBefore, contextAfter } = this.extractContext(range);

    return {
      selectedText: this.normalizeText(selection.toString()),
      range: range.cloneRange(),
      boundingRect: {
        top: boundingRect.top,
        left: boundingRect.left,
        width: boundingRect.width,
        height: boundingRect.height,
        bottom: boundingRect.bottom,
        right: boundingRect.right,
      },
      contextBefore,
      contextAfter,
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      messageId: 'temp-message-id', // TODO: Get from platform adapter
      conversationId: 'temp-conversation-id', // TODO: Get from platform adapter
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Normalizes text by removing excessive whitespace
   */
  normalizeText(text: string): string {
    return text
      .replace(/[\r\n\t]+/g, ' ') // Replace newlines and tabs with space
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim(); // Remove leading/trailing whitespace
  }

  /**
   * Validates if a range contains valid selectable content
   */
  validateSelection(range: Range): boolean {
    // Check if range is collapsed
    if (range.collapsed) {
      return false;
    }

    // Check if range contains any text
    const text = range.toString().trim();
    if (!text) {
      return false;
    }

    return true;
  }

  /**
   * Extracts context before and after the selection
   */
  private extractContext(range: Range): {
    contextBefore: string;
    contextAfter: string;
  } {
    const container = range.commonAncestorContainer;

    // Get the selected text position within the container
    const tempRange = document.createRange();
    tempRange.selectNodeContents(container);
    tempRange.setEnd(range.startContainer, range.startOffset);
    const textBefore = tempRange.toString();

    tempRange.selectNodeContents(container);
    tempRange.setStart(range.endContainer, range.endOffset);
    const textAfter = tempRange.toString();

    // Extract context with proper length limits
    const contextBefore = this.extractContextSegment(
      textBefore,
      this.CONTEXT_LENGTH,
      false
    );
    const contextAfter = this.extractContextSegment(
      textAfter,
      this.CONTEXT_LENGTH,
      true
    );

    return { contextBefore, contextAfter };
  }

  /**
   * Gets text content from a node, handling various node types
   */
  private getTextContent(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      return (node as Element).textContent || '';
    }

    return '';
  }

  /**
   * Extracts a context segment with proper boundaries
   */
  private extractContextSegment(
    text: string,
    maxLength: number,
    fromStart: boolean
  ): string {
    const normalized = this.normalizeText(text);

    if (normalized.length <= maxLength) {
      return normalized;
    }

    if (fromStart) {
      // Extract from the beginning
      const segment = normalized.substring(0, maxLength);
      const lastSpace = segment.lastIndexOf(' ');
      return lastSpace > 0 ? segment.substring(0, lastSpace) : segment;
    } else {
      // Extract from the end
      const segment = normalized.substring(normalized.length - maxLength);
      const firstSpace = segment.indexOf(' ');
      return firstSpace > 0 ? segment.substring(firstSpace + 1) : segment;
    }
  }

  /**
   * Adds a listener for selection change events with debouncing
   */
  addSelectionChangeListener(
    listener: (_selection: SelectionRange | null) => void
  ): () => void {
    this.selectionListeners.add(listener);

    const handleSelectionChange = (): void => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(() => {
        const selection = this.captureRange();
        this.selectionListeners.forEach(l => l(selection));
      }, this.DEBOUNCE_DELAY);
    };

    document.addEventListener('selectionchange', handleSelectionChange);

    // Return cleanup function
    return () => {
      this.selectionListeners.delete(listener);
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
    };
  }

  /**
   * Clears the current selection
   */
  clearSelection(): void {
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  }

  /**
   * Restores a selection from a saved range
   */
  restoreSelection(range: Range): void {
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}
