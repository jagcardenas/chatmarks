/**
 * Text Wrapper Module for Highlight Rendering System
 *
 * Handles DOM text wrapping for highlight rendering across multiple text nodes.
 * Ensures clean, reversible DOM modifications without layout shifts or content corruption.
 */

export interface WrappedElement {
  /** Original text node */
  originalNode: Text;
  /** Parent element containing the highlight */
  highlightElement: Element;
  /** Bookmark ID associated with this highlight */
  bookmarkId: string;
  /** Text content that was wrapped */
  wrappedText: string;
  /** Index within the original text node where wrapping started */
  startOffset: number;
  /** Index within the original text node where wrapping ended */
  endOffset: number;
}

export interface TextWrappingResult {
  /** Successfully wrapped elements */
  wrappedElements: WrappedElement[];
  /** Any errors encountered during wrapping */
  errors: string[];
  /** Whether the wrapping was successful */
  success: boolean;
}

/**
 * Text Wrapper for DOM manipulation and highlight rendering
 *
 * Provides methods to wrap text ranges in DOM elements with highlights,
 * handling complex scenarios like cross-node text selection and
 * maintaining DOM integrity.
 */
export class TextWrapper {
  private document: Document;
  private wrappedElements: Map<string, WrappedElement[]> = new Map();
  private readonly HIGHLIGHT_CLASS = 'chatmarks-highlight';

  constructor(document: Document) {
    this.document = document;
  }

  /**
   * Wraps a text range with highlight elements
   *
   * Handles complex text selection scenarios including:
   * - Text spanning multiple DOM nodes
   * - Partial node wrapping
   * - Nested element structures
   *
   * @param range - Range object representing selected text
   * @param bookmarkId - Unique identifier for the bookmark
   * @param highlightClass - CSS class for the highlight (defaults to 'chatmarks-highlight')
   * @returns Result object with wrapped elements and success status
   */
  wrapTextRange(
    range: Range,
    bookmarkId: string,
    highlightClass: string = this.HIGHLIGHT_CLASS
  ): TextWrappingResult {
    const errors: string[] = [];
    const wrappedElements: WrappedElement[] = [];

    try {
      // Validate input
      if (!range || !bookmarkId) {
        errors.push('Invalid range or bookmark ID');
        return { wrappedElements, errors, success: false };
      }

      if (range.collapsed) {
        errors.push('Range is collapsed (no text selected)');
        return { wrappedElements, errors, success: false };
      }

      // Clone the range to avoid modifying the original
      const workingRange = range.cloneRange();

      // Extract text content for validation
      const selectedText = workingRange.toString().trim();
      if (!selectedText) {
        errors.push('Range contains no text content');
        return { wrappedElements, errors, success: false };
      }

      // Handle single-node text selection
      if (this.isSingleNodeRange(workingRange)) {
        const result = this.wrapSingleNodeRange(workingRange, bookmarkId, highlightClass);
        if (result.success) {
          wrappedElements.push(...result.wrappedElements);
        } else {
          errors.push(...result.errors);
        }
      } else {
        // Handle multi-node text selection
        const result = this.wrapMultiNodeRange(workingRange, bookmarkId, highlightClass);
        if (result.success) {
          wrappedElements.push(...result.wrappedElements);
        } else {
          errors.push(...result.errors);
        }
      }

      // Store wrapped elements for cleanup
      if (wrappedElements.length > 0) {
        this.wrappedElements.set(bookmarkId, wrappedElements);
      }

      return {
        wrappedElements,
        errors,
        success: errors.length === 0,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Text wrapping failed: ${errorMessage}`);

      return {
        wrappedElements,
        errors,
        success: false,
      };
    }
  }

  /**
   * Removes highlight elements for a specific bookmark
   *
   * @param bookmarkId - Bookmark ID to remove highlights for
   * @returns Success status of the removal operation
   */
  removeHighlights(bookmarkId: string): boolean {
    try {
      const wrapped = this.wrappedElements.get(bookmarkId);
      if (!wrapped) {
        return true; // Nothing to remove
      }

      for (const wrappedElement of wrapped) {
        this.unwrapElement(wrappedElement);
      }

      this.wrappedElements.delete(bookmarkId);
      return true;
    } catch (error) {
      console.warn('Chatmarks: Failed to remove highlights for bookmark:', bookmarkId, error);
      return false;
    }
  }

  /**
   * Updates highlight styling for a specific bookmark
   *
   * @param bookmarkId - Bookmark ID to update
   * @param newClass - New CSS class for the highlight
   * @returns Success status of the update operation
   */
  updateHighlightStyling(bookmarkId: string, newClass: string): boolean {
    try {
      const wrapped = this.wrappedElements.get(bookmarkId);
      if (!wrapped) {
        return false; // Nothing to update
      }

      for (const wrappedElement of wrapped) {
        // Remove old highlight class
        wrappedElement.highlightElement.classList.remove(this.HIGHLIGHT_CLASS);

        // Add new class
        wrappedElement.highlightElement.classList.add(newClass);
      }

      return true;
    } catch (error) {
      console.warn('Chatmarks: Failed to update highlight styling:', bookmarkId, error);
      return false;
    }
  }

  /**
   * Merges adjacent highlight elements to prevent visual gaps
   *
   * @param bookmarkId - Bookmark ID to merge highlights for
   * @returns Number of merges performed
   */
  mergeAdjacentHighlights(bookmarkId: string): number {
    const wrapped = this.wrappedElements.get(bookmarkId);
    if (!wrapped || wrapped.length < 2) {
      return 0;
    }

    let mergeCount = 0;

    // Sort by DOM position for proper merging
    const sortedWrapped = [...wrapped].sort((a, b) => {
      const posA = this.getElementPosition(a.highlightElement);
      const posB = this.getElementPosition(b.highlightElement);
      return posA - posB;
    });

    for (let i = 0; i < sortedWrapped.length - 1; i++) {
      const current = sortedWrapped[i];
      const next = sortedWrapped[i + 1];

      if (current && next && this.areElementsAdjacent(current.highlightElement, next.highlightElement)) {
        // Merge the elements
        this.mergeHighlightElements(current, next);
        mergeCount++;
      }
    }

    return mergeCount;
  }

  /**
   * Gets all wrapped elements for a bookmark
   *
   * @param bookmarkId - Bookmark ID to get elements for
   * @returns Array of wrapped elements or empty array if none found
   */
  getWrappedElements(bookmarkId: string): WrappedElement[] {
    return this.wrappedElements.get(bookmarkId) || [];
  }

  /**
   * Cleans up all wrapped elements (call on page unload)
   */
  cleanup(): void {
    for (const [bookmarkId] of this.wrappedElements) {
      this.removeHighlights(bookmarkId);
    }
    this.wrappedElements.clear();
  }

  /**
   * Checks if a range spans only a single text node
   */
  private isSingleNodeRange(range: Range): boolean {
    return range.startContainer === range.endContainer &&
           range.startContainer.nodeType === Node.TEXT_NODE;
  }

  /**
   * Wraps text in a single-node range
   */
  private wrapSingleNodeRange(
    range: Range,
    bookmarkId: string,
    highlightClass: string
  ): TextWrappingResult {
    const errors: string[] = [];
    const wrappedElements: WrappedElement[] = [];

    try {
      const textNode = range.startContainer as Text;
      const parentElement = textNode.parentElement;

      if (!parentElement) {
        errors.push('Text node has no parent element');
        return { wrappedElements, errors, success: false };
      }

      const fullText = textNode.textContent || '';
      const startOffset = range.startOffset;
      const endOffset = range.endOffset;
      const selectedText = fullText.substring(startOffset, endOffset);

      if (!selectedText.trim()) {
        errors.push('No text content to wrap');
        return { wrappedElements, errors, success: false };
      }

      // Create highlight element
      const highlightElement = this.createHighlightElement(
        selectedText,
        highlightClass,
        bookmarkId
      );

      // Split the text node and insert highlight
      const beforeText = fullText.substring(0, startOffset);
      const afterText = fullText.substring(endOffset);

      // Create text nodes for before and after
      const beforeNode = beforeText ? this.document.createTextNode(beforeText) : null;
      const afterNode = afterText ? this.document.createTextNode(afterText) : null;

      // Replace the original text node
      const fragment = this.document.createDocumentFragment();

      if (beforeNode) fragment.appendChild(beforeNode);
      fragment.appendChild(highlightElement);
      if (afterNode) fragment.appendChild(afterNode);

      parentElement.replaceChild(fragment, textNode);

      // Track the wrapped element
      const wrappedElement: WrappedElement = {
        originalNode: textNode,
        highlightElement,
        bookmarkId,
        wrappedText: selectedText,
        startOffset,
        endOffset,
      };

      wrappedElements.push(wrappedElement);

      return { wrappedElements, errors, success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Single-node wrapping failed: ${errorMessage}`);
      return { wrappedElements, errors, success: false };
    }
  }

  /**
   * Wraps text spanning multiple DOM nodes
   */
  private wrapMultiNodeRange(
    range: Range,
    bookmarkId: string,
    highlightClass: string
  ): TextWrappingResult {
    const errors: string[] = [];
    const wrappedElements: WrappedElement[] = [];

    try {
      // Get all text nodes in the range
      const textNodes = this.getTextNodesInRange(range);

      if (textNodes.length === 0) {
        errors.push('No text nodes found in range');
        return { wrappedElements, errors, success: false };
      }

      // Process each text node
      for (let i = 0; i < textNodes.length; i++) {
        const textNode = textNodes[i];
        const isFirst = i === 0;
        const isLast = i === textNodes.length - 1;

        const startOffset = isFirst ? range.startOffset : 0;
        const endOffset = isLast ? range.endOffset : textNode?.textContent?.length || 0;

        if (textNode) {
          const result = this.wrapTextInNode(
            textNode,
            startOffset,
            endOffset,
            bookmarkId,
            highlightClass
          );

          if (result.success && result.wrappedElement) {
            wrappedElements.push(result.wrappedElement);
          } else if (result.errors.length > 0) {
            errors.push(...result.errors);
          }
        }
      }

      return { wrappedElements, errors, success: errors.length === 0 };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Multi-node wrapping failed: ${errorMessage}`);
      return { wrappedElements, errors, success: false };
    }
  }

  /**
   * Wraps text within a specific text node
   */
  private wrapTextInNode(
    textNode: Text,
    startOffset: number,
    endOffset: number,
    bookmarkId: string,
    highlightClass: string
  ): { success: boolean; wrappedElement?: WrappedElement; errors: string[] } {
    const errors: string[] = [];

    try {
      const parentElement = textNode.parentElement;
      if (!parentElement) {
        errors.push('Text node has no parent element');
        return { success: false, errors };
      }

      const fullText = textNode.textContent || '';
      const selectedText = fullText.substring(startOffset, endOffset);

          if (!selectedText.trim()) {
      return { success: true, errors: [] }; // No text to wrap, not an error
    }

      // Create highlight element
      const highlightElement = this.createHighlightElement(
        selectedText,
        highlightClass,
        bookmarkId
      );

      // Split the text node
      const beforeText = fullText.substring(0, startOffset);
      const afterText = fullText.substring(endOffset);

      const beforeNode = beforeText ? this.document.createTextNode(beforeText) : null;
      const afterNode = afterText ? this.document.createTextNode(afterText) : null;

      // Replace the text node
      const fragment = this.document.createDocumentFragment();
      if (beforeNode) fragment.appendChild(beforeNode);
      fragment.appendChild(highlightElement);
      if (afterNode) fragment.appendChild(afterNode);

      parentElement.replaceChild(fragment, textNode);

      const wrappedElement: WrappedElement = {
        originalNode: textNode,
        highlightElement,
        bookmarkId,
        wrappedText: selectedText,
        startOffset,
        endOffset,
      };

      return { success: true, wrappedElement, errors: [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Node wrapping failed: ${errorMessage}`);
      return { success: false, errors };
    }
  }

  /**
   * Creates a highlight element with proper styling and attributes
   */
  private createHighlightElement(
    text: string,
    highlightClass: string,
    bookmarkId: string
  ): Element {
    const highlightElement = this.document.createElement('span');
    highlightElement.className = highlightClass;
    highlightElement.textContent = text;
    highlightElement.setAttribute('data-bookmark-id', bookmarkId);
    highlightElement.setAttribute('data-chatmarks-highlight', 'true');

    return highlightElement;
  }

  /**
   * Gets all text nodes within a range
   */
  private getTextNodesInRange(range: Range): Text[] {
    const textNodes: Text[] = [];
    const walker = this.document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node = walker.nextNode();
    while (node) {
      if (range.intersectsNode(node)) {
        textNodes.push(node as Text);
      }
      node = walker.nextNode();
    }

    return textNodes;
  }

  /**
   * Unwraps a single wrapped element
   */
  private unwrapElement(wrappedElement: WrappedElement): void {
    try {
      const { originalNode, highlightElement, wrappedText } = wrappedElement;
      const parent = highlightElement.parentElement;

      if (!parent) {
        return; // Already unwrapped or orphaned
      }

      // Get the full text content from the highlight
      const highlightText = highlightElement.textContent || '';

      // Create new text node with original content
      const newTextNode = this.document.createTextNode(highlightText);

      // Replace highlight with text node
      parent.replaceChild(newTextNode, highlightElement);
    } catch (error) {
      console.warn('Chatmarks: Failed to unwrap element:', error);
    }
  }

  /**
   * Checks if two highlight elements are adjacent
   */
  private areElementsAdjacent(element1: Element, element2: Element): boolean {
    const parent1 = element1.parentElement;
    const parent2 = element2.parentElement;

    if (parent1 !== parent2) {
      return false;
    }

    const siblings = Array.from(parent1?.children || []);
    const index1 = siblings.indexOf(element1);
    const index2 = siblings.indexOf(element2);

    return Math.abs(index1 - index2) === 1;
  }

  /**
   * Merges two adjacent highlight elements
   */
  private mergeHighlightElements(element1: WrappedElement, element2: WrappedElement): void {
    const text1 = element1.highlightElement.textContent || '';
    const text2 = element2.highlightElement.textContent || '';

    // Combine text content
    element1.highlightElement.textContent = text1 + text2;

    // Remove the second element
    element2.highlightElement.remove();

    // Update tracking
    element1.wrappedText += element2.wrappedText;
    element1.endOffset = element2.endOffset;
  }

  /**
   * Gets the DOM position of an element for sorting
   */
  private getElementPosition(element: Element): number {
    let position = 0;
    let current = element;

    while (current.previousSibling) {
      position++;
      current = current.previousSibling as Element;
    }

    return position;
  }
}
