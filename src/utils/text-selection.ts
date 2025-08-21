/**
 * Text Selection Utilities for Chatmarks Extension
 * 
 * Provides robust text selection detection and range management across different
 * AI chat platforms with multiple fallback strategies for reliable anchoring.
 */

import { TextAnchor, SelectionRange, Platform } from '../types/bookmark';

/**
 * Main class for handling text selection operations
 */
export class TextSelectionManager {
  private readonly CONTEXT_LENGTH = 50;
  private readonly MAX_XPATH_DEPTH = 10;

  /**
   * Get the current text selection with comprehensive anchoring data
   */
  getCurrentSelection(): SelectionRange | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return null;
    }

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    
    if (!selectedText) {
      return null;
    }

    return {
      text: selectedText,
      range: range.cloneRange(),
      boundingRect: range.getBoundingClientRect(),
      anchor: this.createTextAnchor(range, selectedText)
    };
  }

  /**
   * Create comprehensive text anchor with multiple positioning strategies
   */
  private createTextAnchor(range: Range, selectedText: string): TextAnchor {
    const startContainer = range.startContainer;

    // Generate XPath selector for the range
    const xpathSelector = this.generateXPathSelector(startContainer);
    
    // Calculate character offsets within the document
    const { startOffset, endOffset } = this.calculateDocumentOffsets(range);
    
    // Extract surrounding context for fuzzy matching
    const { contextBefore, contextAfter } = this.extractContext(range);
    
    // Generate message ID if within a message container
    const messageId = this.findMessageId(startContainer);
    
    // Create checksum for validation
    const checksum = this.generateChecksum(selectedText, contextBefore, contextAfter);

    return {
      selectedText,
      startOffset,
      endOffset,
      xpathSelector,
      messageId,
      contextBefore,
      contextAfter,
      checksum
    };
  }

  /**
   * Generate XPath selector for a DOM node with fallback strategies
   */
  private generateXPathSelector(node: Node): string {
    if (node.nodeType === Node.DOCUMENT_NODE) {
      return '/';
    }

    const parts: string[] = [];
    let currentNode: Node | null = node;
    let depth = 0;

    while (currentNode && currentNode.nodeType !== Node.DOCUMENT_NODE && depth < this.MAX_XPATH_DEPTH) {
      if (currentNode.nodeType === Node.ELEMENT_NODE) {
        const element = currentNode as Element;
        let selector = element.tagName.toLowerCase();
        
        // Add ID if available for more stable selection
        if (element.id) {
          selector += `[@id='${element.id}']`;
        } else {
          // Calculate position among siblings of the same type
          const parent = element.parentNode;
          if (parent) {
            const siblings = Array.from(parent.children)
              .filter(child => child.tagName === element.tagName);
            
            if (siblings.length > 1) {
              const index = siblings.indexOf(element) + 1;
              selector += `[${index}]`;
            }
          }
        }
        
        parts.unshift(selector);
      } else if (currentNode.nodeType === Node.TEXT_NODE) {
        // Handle text nodes by finding their position among text siblings
        const parent = currentNode.parentNode;
        if (parent) {
          const textSiblings = Array.from(parent.childNodes)
            .filter(child => child.nodeType === Node.TEXT_NODE);
          
          if (textSiblings.length > 1) {
            const index = textSiblings.indexOf(currentNode as ChildNode) + 1;
            parts.unshift(`text()[${index}]`);
          } else {
            parts.unshift('text()');
          }
        }
      }

      currentNode = currentNode.parentNode;
      depth++;
    }

    return '/' + parts.join('/');
  }

  /**
   * Calculate character offsets within the entire document
   */
  private calculateDocumentOffsets(range: Range): { startOffset: number; endOffset: number } {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
    );

    let charCount = 0;
    let startOffset = -1;
    let endOffset = -1;
    let node: Node | null;

    while ((node = walker.nextNode())) {
      const nodeText = node.textContent || '';
      
      if (node === range.startContainer) {
        startOffset = charCount + range.startOffset;
      }
      
      if (node === range.endContainer) {
        endOffset = charCount + range.endOffset;
        break;
      }
      
      charCount += nodeText.length;
    }

    return { startOffset, endOffset };
  }

  /**
   * Extract context text before and after selection for fuzzy matching
   */
  private extractContext(range: Range): { contextBefore: string; contextAfter: string } {
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;
    
    // Get text before selection
    let contextBefore = '';
    if (startContainer.nodeType === Node.TEXT_NODE) {
      const textBefore = startContainer.textContent?.substring(0, range.startOffset) || '';
      contextBefore = textBefore.slice(-this.CONTEXT_LENGTH);
    }

    // Get text after selection
    let contextAfter = '';
    if (endContainer.nodeType === Node.TEXT_NODE) {
      const textAfter = endContainer.textContent?.substring(range.endOffset) || '';
      contextAfter = textAfter.slice(0, this.CONTEXT_LENGTH);
    }

    return { contextBefore, contextAfter };
  }

  /**
   * Find the message ID container for the selected text
   */
  private findMessageId(node: Node): string {
    let currentElement = node.nodeType === Node.ELEMENT_NODE ? 
      node as Element : node.parentElement;

    // Look up the DOM tree for message containers with IDs or data attributes
    while (currentElement && currentElement !== document.body) {
      // Check for common message ID patterns across platforms
      if (currentElement.id) {
        return currentElement.id;
      }
      
      // Check for data attributes that might contain message IDs
      const dataId = currentElement.getAttribute('data-message-id') ||
                   currentElement.getAttribute('data-id') ||
                   currentElement.getAttribute('data-testid');
      
      if (dataId) {
        return dataId;
      }
      
      currentElement = currentElement.parentElement;
    }

    return '';
  }

  /**
   * Generate checksum for text anchor validation
   */
  private generateChecksum(text: string, before: string, after: string): string {
    const combined = before + text + after;
    let hash = 0;
    
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * Restore selection from text anchor with fallback strategies
   */
  async restoreSelection(anchor: TextAnchor): Promise<boolean> {
    // Strategy 1: Try XPath selector first
    if (await this.restoreByXPath(anchor)) {
      return true;
    }

    // Strategy 2: Try document offset restoration
    if (await this.restoreByOffset(anchor)) {
      return true;
    }

    // Strategy 3: Fuzzy text matching with context
    if (await this.restoreByFuzzyMatch(anchor)) {
      return true;
    }

    return false;
  }

  /**
   * Restore selection using XPath selector
   */
  private async restoreByXPath(anchor: TextAnchor): Promise<boolean> {
    try {
      const result = document.evaluate(
        anchor.xpathSelector,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );

      const node = result.singleNodeValue;
      if (!node) return false;

      return this.createSelectionFromNode(node, anchor.selectedText);
    } catch (error) {
      console.warn('XPath restoration failed:', error);
      return false;
    }
  }

  /**
   * Restore selection using document character offsets
   */
  private async restoreByOffset(anchor: TextAnchor): Promise<boolean> {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
    );

    let charCount = 0;
    let startNode: Node | null = null;
    let startOffset = 0;
    let endNode: Node | null = null;
    let endOffset = 0;
    let node: Node | null;

    while ((node = walker.nextNode())) {
      const nodeText = node.textContent || '';
      const nodeLength = nodeText.length;
      
      // Check if start position is in this node
      if (!startNode && charCount + nodeLength >= anchor.startOffset) {
        startNode = node;
        startOffset = anchor.startOffset - charCount;
      }
      
      // Check if end position is in this node
      if (!endNode && charCount + nodeLength >= anchor.endOffset) {
        endNode = node;
        endOffset = anchor.endOffset - charCount;
        break;
      }
      
      charCount += nodeLength;
    }

    if (startNode && endNode) {
      return this.createSelectionFromNodes(startNode, startOffset, endNode, endOffset, anchor.selectedText);
    }

    return false;
  }

  /**
   * Restore selection using fuzzy text matching
   */
  private async restoreByFuzzyMatch(anchor: TextAnchor): Promise<boolean> {
    const textContent = document.body.textContent || '';
    const searchText = anchor.contextBefore + anchor.selectedText + anchor.contextAfter;
    
    // Find the most likely position using fuzzy matching
    const index = this.fuzzyTextSearch(textContent, searchText);
    if (index === -1) return false;

    const contextStart = index + anchor.contextBefore.length;
    const contextEnd = contextStart + anchor.selectedText.length;

    return this.createSelectionFromTextPosition(contextStart, contextEnd, anchor.selectedText);
  }

  /**
   * Fuzzy text search with some tolerance for changes
   */
  private fuzzyTextSearch(haystack: string, needle: string): number {
    // Simple implementation - can be enhanced with more sophisticated fuzzy matching
    let bestMatch = -1;
    let bestScore = 0;

    for (let i = 0; i <= haystack.length - needle.length; i++) {
      const substring = haystack.substring(i, i + needle.length);
      const score = this.calculateSimilarity(needle, substring);
      
      if (score > bestScore && score > 0.8) { // 80% similarity threshold
        bestScore = score;
        bestMatch = i;
      }
    }

    return bestMatch;
  }

  /**
   * Calculate text similarity score (0-1)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    if (text1 === text2) return 1;
    
    const longer = text1.length > text2.length ? text1 : text2;
    const shorter = text1.length > text2.length ? text2 : text1;
    
    if (longer.length === 0) return 1;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => 
      Array(str1.length + 1).fill(0)
    );

    for (let i = 0; i <= str1.length; i++) matrix[0]![i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j]![0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j]![i] = Math.min(
          matrix[j]![i - 1] + 1,     // deletion
          matrix[j - 1]![i] + 1,     // insertion
          matrix[j - 1]![i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length]![str1.length]!;
  }

  /**
   * Create selection from a single node containing the target text
   */
  private createSelectionFromNode(node: Node, targetText: string): boolean {
    const text = node.textContent || '';
    const index = text.indexOf(targetText);
    
    if (index === -1) return false;

    const range = document.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + targetText.length);

    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    }

    return false;
  }

  /**
   * Create selection from start and end nodes with offsets
   */
  private createSelectionFromNodes(
    startNode: Node, 
    startOffset: number, 
    endNode: Node, 
    endOffset: number,
    expectedText: string
  ): boolean {
    try {
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);

      // Validate that the range contains the expected text
      const rangeText = range.toString();
      if (rangeText.trim() !== expectedText.trim()) {
        return false;
      }

      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
      }
    } catch (error) {
      console.warn('Failed to create selection from nodes:', error);
    }

    return false;
  }

  /**
   * Create selection from text position within document
   */
  private createSelectionFromTextPosition(startPos: number, endPos: number, expectedText: string): boolean {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
    );

    let charCount = 0;
    let startNode: Node | null = null;
    let startOffset = 0;
    let endNode: Node | null = null;
    let endOffset = 0;
    let node: Node | null;

    while ((node = walker.nextNode())) {
      const nodeText = node.textContent || '';
      const nodeLength = nodeText.length;
      
      if (!startNode && charCount + nodeLength >= startPos) {
        startNode = node;
        startOffset = startPos - charCount;
      }
      
      if (!endNode && charCount + nodeLength >= endPos) {
        endNode = node;
        endOffset = endPos - charCount;
        break;
      }
      
      charCount += nodeLength;
    }

    if (startNode && endNode) {
      return this.createSelectionFromNodes(startNode, startOffset, endNode, endOffset, expectedText);
    }

    return false;
  }

  /**
   * Clear current selection
   */
  clearSelection(): void {
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  }

  /**
   * Validate that a text anchor is still valid in the current document
   */
  validateAnchor(anchor: TextAnchor): boolean {
    // Check if the checksum still matches
    const currentChecksum = this.generateChecksum(
      anchor.selectedText, 
      anchor.contextBefore, 
      anchor.contextAfter
    );
    
    return currentChecksum === anchor.checksum;
  }
}

/**
 * Platform-specific text selection handlers
 */
export class PlatformTextSelection {
  private manager: TextSelectionManager;

  constructor() {
    this.manager = new TextSelectionManager();
  }

  /**
   * Get selection with platform-specific enhancements
   */
  getSelectionForPlatform(platform: Platform): SelectionRange | null {
    const baseSelection = this.manager.getCurrentSelection();
    if (!baseSelection) return null;

    // Add platform-specific metadata
    switch (platform) {
      case 'chatgpt':
        return this.enhanceForChatGPT(baseSelection);
      case 'claude':
        return this.enhanceForClaude(baseSelection);
      case 'grok':
        return this.enhanceForGrok(baseSelection);
      default:
        return baseSelection;
    }
  }

  /**
   * Enhance selection data for ChatGPT platform
   */
  private enhanceForChatGPT(selection: SelectionRange): SelectionRange {
    // ChatGPT-specific enhancements could include:
    // - Message role detection (user vs assistant)
    // - Conversation thread context
    // - Code block detection
    return selection;
  }

  /**
   * Enhance selection data for Claude platform
   */
  private enhanceForClaude(selection: SelectionRange): SelectionRange {
    // Claude-specific enhancements could include:
    // - Artifact detection
    // - Citation extraction
    // - Tool usage context
    return selection;
  }

  /**
   * Enhance selection data for Grok platform
   */
  private enhanceForGrok(selection: SelectionRange): SelectionRange {
    // Grok-specific enhancements could include:
    // - Tweet thread context
    // - Media attachment detection
    // - Real-time data integration
    return selection;
  }

  /**
   * Restore selection for specific platform
   */
  async restoreSelectionForPlatform(anchor: TextAnchor, _platform: Platform): Promise<boolean> {
    // Could add platform-specific restoration logic here
    // The _platform parameter will be used for platform-specific logic in future
    return this.manager.restoreSelection(anchor);
  }
}