/**
 * Character offset-based text anchoring system
 *
 * Provides the secondary anchoring strategy using character positions within
 * container elements. This fallback method works when XPath selectors fail
 * due to DOM structure changes but text content remains similar.
 */

/**
 * Character offset anchoring implementation for text positioning
 *
 * This class provides methods to calculate and resolve character offsets
 * within DOM elements. It serves as the secondary strategy in the
 * multi-layered anchoring system, used when XPath fails.
 */
export class OffsetAnchor {
  private document: Document;

  /**
   * Initialize offset anchor with document context
   *
   * @param document - The document context for offset calculations
   */
  constructor(document: Document) {
    this.document = document;
  }

  /**
   * Calculates character offset of target text within a container element
   *
   * Traverses the container's text content to find the starting position
   * of the target text. This method handles text that spans multiple
   * DOM nodes by flattening the text content.
   *
   * @param container - Container element to search within
   * @param targetText - Text content to locate
   * @returns Character offset from container start, or -1 if not found
   */
  calculateOffset(container: Element, targetText: string): number {
    if (!container || !targetText) {
      return -1;
    }

    const normalizedTarget = this.normalizeText(targetText);
    const containerText = this.extractTextContent(container);
    const normalizedContainer = this.normalizeText(containerText);

    const offset = normalizedContainer.indexOf(normalizedTarget);

    if (offset === -1) {
      // Try with more aggressive normalization
      return this.calculateFuzzyOffset(container, targetText);
    }

    return offset;
  }

  /**
   * Finds text content by character offset and length
   *
   * Creates a Range object positioned at the specified character offset
   * within the container element. Handles text that spans multiple nodes
   * by walking through the DOM tree.
   *
   * @param container - Container element containing the text
   * @param offset - Character offset from container start
   * @param length - Length of text to select (optional, defaults to 1)
   * @returns Range object for the located text or null if not found
   */
  findTextByOffset(
    container: Element,
    offset: number,
    length: number = 1
  ): Range | null {
    if (!container || offset < 0 || length <= 0) {
      return null;
    }

    try {
      const walker = this.document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null
      );

      let currentOffset = 0;
      let textNode = walker.nextNode() as Text;

      // Find the text node containing the start offset
      while (textNode) {
        const textLength = textNode.textContent?.length || 0;

        if (currentOffset + textLength > offset) {
          // Found the text node containing our offset
          const range = this.document.createRange();
          const localOffset = offset - currentOffset;

          // Set range start
          range.setStart(textNode, localOffset);

          // Calculate end position (might be in a different text node)
          const remainingLength = textLength - localOffset;

          if (remainingLength >= length) {
            // End is within the same text node
            range.setEnd(textNode, localOffset + length);
          } else {
            // End spans to other text nodes - use remaining length to find next nodes
            this.setRangeEndByOffset(range, walker, length - remainingLength);
          }

          return range;
        }

        currentOffset += textLength;
        textNode = walker.nextNode() as Text;
      }

      return null;
    } catch (error) {
      // Failed to find text by offset
      console.warn('Chatmarks: Failed to find text by offset:', error);
      return null;
    }
  }

  /**
   * Calculates offset using more flexible text matching
   *
   * Uses fuzzy matching techniques to find text that may have minor
   * differences due to whitespace or formatting changes. This provides
   * better resilience to content modifications.
   *
   * @param container - Container element to search within
   * @param targetText - Text to locate with fuzzy matching
   * @returns Character offset or -1 if not found
   */
  calculateFuzzyOffset(container: Element, targetText: string): number {
    if (!container || !targetText) {
      return -1;
    }

    const containerText = this.extractTextContent(container);
    const normalizedTarget = this.aggressiveNormalize(targetText);
    const normalizedContainer = this.aggressiveNormalize(containerText);

    // Try to find the text with aggressive normalization
    let offset = normalizedContainer.indexOf(normalizedTarget);

    if (offset === -1) {
      // Try word-by-word matching for partial matches
      offset = this.findWordSequenceOffset(
        normalizedContainer,
        normalizedTarget
      );
    }

    if (offset === -1) {
      return -1;
    }

    // Map normalized offset back to original text offset
    return this.mapNormalizedOffsetToOriginal(containerText, offset);
  }

  /**
   * Validates that an offset position is reasonable within container
   *
   * Checks that the offset falls within the bounds of the container's
   * text content and that there's sufficient text at that position
   * for the expected selection.
   *
   * @param container - Container element to validate against
   * @param offset - Character offset to validate
   * @param expectedLength - Expected length of text at offset (optional)
   * @returns True if offset is valid, false otherwise
   */
  validateOffset(
    container: Element,
    offset: number,
    expectedLength: number = 1
  ): boolean {
    if (!container || offset < 0 || expectedLength <= 0) {
      return false;
    }

    const containerText = this.extractTextContent(container);
    const maxOffset = containerText.length;

    return offset < maxOffset && offset + expectedLength <= maxOffset;
  }

  /**
   * Extracts all text content from an element, preserving structure
   *
   * Walks through all text nodes in the element to build a complete
   * text representation that maintains relative positioning of content
   * across multiple DOM nodes.
   *
   * @param element - Element to extract text from
   * @returns Complete text content of the element
   */
  private extractTextContent(element: Element): string {
    if (!element) {
      return '';
    }

    const walker = this.document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );

    let textContent = '';
    let textNode = walker.nextNode() as Text;

    while (textNode) {
      textContent += textNode.textContent || '';
      textNode = walker.nextNode() as Text;
    }

    return textContent;
  }

  /**
   * Normalizes text for consistent comparison
   *
   * Standardizes whitespace and removes formatting differences that
   * might interfere with text matching. This includes collapsing
   * multiple spaces and normalizing line breaks.
   *
   * @param text - Text to normalize
   * @returns Normalized text string
   */
  private normalizeText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Collapse multiple whitespace
      .replace(/[\r\n]/g, ' ') // Convert line breaks to spaces
      .trim();
  }

  /**
   * Applies aggressive text normalization for fuzzy matching
   *
   * Removes additional characters and formatting that might differ
   * between the original text and current DOM state, such as
   * punctuation variations and case differences.
   *
   * @param text - Text to aggressively normalize
   * @returns Heavily normalized text string
   */
  private aggressiveNormalize(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[.,;:!?()[\]{}'"]/g, '') // Remove common punctuation
      .replace(/[-–—]/g, '') // Remove dashes
      .trim();
  }

  /**
   * Finds offset using word sequence matching
   *
   * Attempts to locate text by matching sequences of words rather
   * than exact character matches. This provides resilience against
   * minor text modifications.
   *
   * @param containerText - Normalized container text
   * @param targetText - Normalized target text
   * @returns Character offset or -1 if not found
   */
  private findWordSequenceOffset(
    containerText: string,
    targetText: string
  ): number {
    const containerWords = containerText
      .split(' ')
      .filter(word => word.length > 0);
    const targetWords = targetText.split(' ').filter(word => word.length > 0);

    if (targetWords.length === 0) {
      return -1;
    }

    for (let i = 0; i <= containerWords.length - targetWords.length; i++) {
      let matches = 0;

      for (let j = 0; j < targetWords.length; j++) {
        if (containerWords[i + j] === targetWords[j]) {
          matches++;
        }
      }

      // Require at least 80% word match for fuzzy matching
      if (matches / targetWords.length >= 0.8) {
        // Calculate character offset for this word position
        return containerWords.slice(0, i).join(' ').length + (i > 0 ? 1 : 0);
      }
    }

    return -1;
  }

  /**
   * Maps normalized text offset back to original text offset
   *
   * Since normalization changes character positions, this method
   * maps an offset in normalized text back to the corresponding
   * position in the original text.
   *
   * @param originalText - Original unnormalized text
   * @param normalizedOffset - Offset in normalized text
   * @returns Corresponding offset in original text
   */
  private mapNormalizedOffsetToOriginal(
    originalText: string,
    normalizedOffset: number
  ): number {
    let originalOffset = 0;
    let normalizedCount = 0;

    for (let i = 0; i < originalText.length; i++) {
      const char = originalText[i];

      // Skip characters that would be removed in normalization
      const prevChar = i > 0 ? originalText[i - 1]! : '';
      if (!/\s/.test(char!) || (i > 0 && !/\s/.test(prevChar))) {
        if (normalizedCount === normalizedOffset) {
          return originalOffset;
        }
        normalizedCount++;
      }

      originalOffset++;
    }

    return Math.min(originalOffset, originalText.length);
  }

  /**
   * Sets the end position of a range when it spans multiple text nodes
   *
   * Helper method to complete range creation when the end position
   * extends beyond the current text node into subsequent nodes.
   *
   * @param range - Range to set end position for
   * @param walker - TreeWalker positioned after start node
   * @param remainingLength - Characters remaining to reach end
   */
  private setRangeEndByOffset(
    range: Range,
    walker: TreeWalker,
    remainingLength: number
  ): void {
    let lengthRemaining = remainingLength;
    let node = walker.nextNode();
    let textNode = node as Text;

    while (textNode && lengthRemaining > 0) {
      const textLength = textNode.textContent?.length || 0;

      if (textLength >= lengthRemaining) {
        // End position is within this text node
        range.setEnd(textNode, lengthRemaining);
        return;
      }

      lengthRemaining -= textLength;
      node = walker.nextNode();
      textNode = node as Text;
    }

    // If we get here, we couldn't find enough text - set end to last available position
    if (textNode?.textContent) {
      range.setEnd(textNode, textNode.textContent.length);
    }
  }
}
