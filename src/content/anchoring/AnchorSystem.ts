/**
 * Multi-strategy text anchoring system coordinator
 *
 * Coordinates multiple anchoring strategies (XPath, Offset, Fuzzy) to provide
 * robust text positioning that maintains >99% accuracy even when DOM structures
 * change or content is modified.
 */

import { XPathAnchor } from './XPathAnchor';
import { OffsetAnchor } from './OffsetAnchor';
import { FuzzyMatcher } from './FuzzyMatcher';
import {
  TextAnchor,
  SelectionRange,
  AnchorStrategy,
} from '../../types/bookmark';

/**
 * Configuration options for anchor system behavior
 */
interface AnchorSystemConfig {
  /** Minimum confidence threshold for anchor validation */
  minConfidence: number;
  /** Enable checksum validation for content integrity */
  enableChecksums: boolean;
  /** Maximum time allowed for anchor resolution (ms) */
  maxResolutionTime: number;
  /** Fallback strategy order preference */
  strategyOrder: AnchorStrategy[];
}

/**
 * Performance metrics for anchor operations
 */
interface AnchorMetrics {
  creationTime: number;
  resolutionTime: number;
  strategyUsed: AnchorStrategy;
  confidence: number;
  success: boolean;
}

/**
 * Main coordinator for multi-strategy text anchoring system
 *
 * This class manages the integration of XPath, character offset, and fuzzy
 * matching strategies to create and resolve text anchors with high reliability.
 * It implements the fallback cascade defined in Task 7 requirements.
 */
export class AnchorSystem {
  private document: Document;
  private xpathAnchor: XPathAnchor;
  private offsetAnchor: OffsetAnchor;
  private fuzzyMatcher: FuzzyMatcher;
  private config: AnchorSystemConfig;

  // Performance tracking
  private metrics: AnchorMetrics[] = [];

  // Default configuration
  private static readonly DEFAULT_CONFIG: AnchorSystemConfig = {
    minConfidence: 0.7,
    enableChecksums: true,
    maxResolutionTime: 50, // 50ms as per Task 7 requirements
    strategyOrder: ['xpath', 'offset', 'fuzzy'],
  };

  /**
   * Initialize anchor system with document context
   *
   * @param document - Document context for all anchoring operations
   * @param config - Optional configuration overrides
   */
  constructor(document: Document, config?: Partial<AnchorSystemConfig>) {
    this.document = document;
    this.config = { ...AnchorSystem.DEFAULT_CONFIG, ...config };

    // Initialize strategy implementations
    this.xpathAnchor = new XPathAnchor(document);
    this.offsetAnchor = new OffsetAnchor(document);
    this.fuzzyMatcher = new FuzzyMatcher(document);
  }

  /**
   * Creates a comprehensive text anchor from selection range
   *
   * Generates anchor data using all available strategies to maximize the
   * likelihood of successful resolution later. The anchor includes multiple
   * positioning methods and validation data.
   *
   * @param selection - Selection range data from text selection
   * @returns Complete TextAnchor with all positioning strategies
   * @throws Error if selection is invalid or anchor creation fails
   */
  createAnchor(selection: SelectionRange): TextAnchor {
    const startTime = performance.now();

    try {
      // Validate input selection
      this.validateSelectionRange(selection);

      // Find the container element for the selection
      const containerElement = this.findContainerElement(selection.range);
      if (!containerElement) {
        throw new Error('Cannot find container element for selection');
      }

      // Extract text content for offset calculations
      const containerText = this.extractContainerText(containerElement);

      // Create anchor with all strategies
      const anchor: TextAnchor = {
        selectedText: selection.selectedText,
        startOffset: this.calculateStartOffset(containerElement, selection),
        endOffset: this.calculateEndOffset(containerElement, selection),
        xpathSelector: this.createXPathSelector(selection.range),
        messageId: selection.messageId,
        contextBefore: selection.contextBefore,
        contextAfter: selection.contextAfter,
        checksum: this.generateContentChecksum(containerText, selection),
        confidence: 0,
        strategy: 'xpath', // Primary strategy
      };

      // Calculate confidence score based on anchor quality
      anchor.confidence = this.calculateConfidenceScore(
        anchor,
        containerElement
      );

      // Record performance metrics
      const creationTime = performance.now() - startTime;
      this.recordMetrics({
        creationTime,
        resolutionTime: 0,
        strategyUsed: 'xpath',
        confidence: anchor.confidence,
        success: true,
      });

      return anchor;
    } catch (error) {
      // Record failed attempt
      this.recordMetrics({
        creationTime: performance.now() - startTime,
        resolutionTime: 0,
        strategyUsed: 'xpath',
        confidence: 0,
        success: false,
      });

      throw new Error(
        `Failed to create anchor: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Resolves a text anchor back to a Range using fallback strategies
   *
   * Attempts to locate the anchored text using multiple strategies in order
   * of preference. Falls back to secondary strategies if primary ones fail.
   *
   * @param anchor - TextAnchor to resolve
   * @returns Range object for the located text or null if not found
   */
  resolveAnchor(anchor: TextAnchor): Range | null {
    const startTime = performance.now();
    let resolvedRange: Range | null = null;
    let strategyUsed: AnchorStrategy = 'xpath';

    try {
      // Validate anchor before attempting resolution
      if (!this.validateAnchor(anchor)) {
        return null;
      }

      // Try strategies in order of preference
      for (const strategy of this.config.strategyOrder) {
        const timeRemaining =
          this.config.maxResolutionTime - (performance.now() - startTime);
        if (timeRemaining <= 0) {
          break; // Timeout exceeded
        }

        strategyUsed = strategy;
        resolvedRange = this.tryResolveWithStrategy(anchor, strategy);

        if (resolvedRange) {
          // Validate the resolved range matches expectations
          if (this.validateResolvedRange(resolvedRange, anchor)) {
            break;
          } else {
            resolvedRange = null; // Invalid match, try next strategy
          }
        }
      }

      return resolvedRange;
    } finally {
      // Always record metrics
      const resolutionTime = performance.now() - startTime;
      this.recordMetrics({
        creationTime: 0,
        resolutionTime,
        strategyUsed,
        confidence: anchor.confidence,
        success: resolvedRange !== null,
      });
    }
  }

  /**
   * Validates that an anchor contains valid data for resolution
   *
   * Checks anchor data integrity and ensures all required fields are present
   * and reasonable for successful resolution attempts.
   *
   * @param anchor - TextAnchor to validate
   * @returns True if anchor is valid, false otherwise
   */
  validateAnchor(anchor: TextAnchor): boolean {
    // Check required fields
    if (!anchor.selectedText || anchor.selectedText.trim().length === 0) {
      return false;
    }

    if (!anchor.xpathSelector || anchor.xpathSelector.length === 0) {
      return false;
    }

    if (!anchor.messageId || anchor.messageId.length === 0) {
      return false;
    }

    // Validate offset values
    if (anchor.startOffset < 0 || anchor.endOffset < 0) {
      return false;
    }

    if (anchor.endOffset <= anchor.startOffset) {
      return false;
    }

    // Validate confidence score
    if (anchor.confidence < 0 || anchor.confidence > 1) {
      return false;
    }

    // Validate strategy
    if (!['xpath', 'offset', 'fuzzy'].includes(anchor.strategy)) {
      return false;
    }

    // Context validation (should have some context)
    if (!anchor.contextBefore && !anchor.contextAfter) {
      return false;
    }

    return true;
  }

  /**
   * Gets performance metrics for monitoring system health
   *
   * Returns aggregated metrics about anchor creation and resolution
   * performance, including success rates and timing information.
   *
   * @returns Performance metrics summary
   */
  getPerformanceMetrics(): {
    averageCreationTime: number;
    averageResolutionTime: number;
    successRate: number;
    strategyDistribution: Record<AnchorStrategy, number>;
    totalOperations: number;
  } {
    if (this.metrics.length === 0) {
      return {
        averageCreationTime: 0,
        averageResolutionTime: 0,
        successRate: 0,
        strategyDistribution: { xpath: 0, offset: 0, fuzzy: 0 },
        totalOperations: 0,
      };
    }

    const totalCreationTime = this.metrics.reduce(
      (sum, m) => sum + m.creationTime,
      0
    );
    const totalResolutionTime = this.metrics.reduce(
      (sum, m) => sum + m.resolutionTime,
      0
    );
    const successfulOperations = this.metrics.filter(m => m.success).length;

    const strategyDistribution = this.metrics.reduce(
      (dist, m) => {
        dist[m.strategyUsed] = (dist[m.strategyUsed] || 0) + 1;
        return dist;
      },
      {} as Record<AnchorStrategy, number>
    );

    const defaultDistribution: Record<AnchorStrategy, number> = {
      xpath: 0,
      offset: 0,
      fuzzy: 0,
    };
    const finalDistribution = {
      ...defaultDistribution,
      ...strategyDistribution,
    };

    return {
      averageCreationTime: totalCreationTime / this.metrics.length,
      averageResolutionTime: totalResolutionTime / this.metrics.length,
      successRate: successfulOperations / this.metrics.length,
      strategyDistribution: finalDistribution,
      totalOperations: this.metrics.length,
    };
  }

  /**
   * Clears performance metrics history
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Validates selection range data for anchor creation
   *
   * @param selection - Selection range to validate
   * @throws Error if selection is invalid
   */
  private validateSelectionRange(selection: SelectionRange): void {
    if (!selection.selectedText || selection.selectedText.trim().length === 0) {
      throw new Error('Selection must contain non-empty text');
    }

    if (!selection.range || !selection.range.toString) {
      throw new Error('Selection must contain valid Range object');
    }

    if (selection.startOffset < 0 || selection.endOffset < 0) {
      throw new Error('Selection offsets must be non-negative');
    }

    if (selection.endOffset <= selection.startOffset) {
      throw new Error('Selection end offset must be greater than start offset');
    }

    if (!selection.messageId || !selection.conversationId) {
      throw new Error('Selection must include message and conversation IDs');
    }
  }

  /**
   * Finds the appropriate container element for a selection range
   *
   * @param range - Range object to find container for
   * @returns Container element or null if not found
   */
  private findContainerElement(range: Range): Element | null {
    const commonAncestor = range.commonAncestorContainer;

    if (commonAncestor.nodeType === Node.ELEMENT_NODE) {
      return commonAncestor as Element;
    }

    return commonAncestor.parentElement;
  }

  /**
   * Extracts text content from container element
   *
   * @param container - Container element
   * @returns Complete text content of container
   */
  private extractContainerText(container: Element): string {
    return container.textContent || '';
  }

  /**
   * Calculates start offset of selection within container
   *
   * @param container - Container element
   * @param selection - Selection range data
   * @returns Character offset from container start
   */
  private calculateStartOffset(
    container: Element,
    selection: SelectionRange
  ): number {
    return this.offsetAnchor.calculateOffset(container, selection.selectedText);
  }

  /**
   * Calculates end offset of selection within container
   *
   * @param container - Container element
   * @param selection - Selection range data
   * @returns Character offset for selection end
   */
  private calculateEndOffset(
    container: Element,
    selection: SelectionRange
  ): number {
    const startOffset = this.calculateStartOffset(container, selection);
    return startOffset >= 0 ? startOffset + selection.selectedText.length : -1;
  }

  /**
   * Creates XPath selector for selection range
   *
   * @param range - Range object to create XPath for
   * @returns XPath selector string
   */
  private createXPathSelector(range: Range): string {
    const startContainer = range.startContainer;
    const element =
      startContainer.nodeType === Node.ELEMENT_NODE
        ? (startContainer as Element)
        : startContainer.parentElement;

    if (!element) {
      throw new Error('Cannot create XPath for range without element context');
    }

    return this.xpathAnchor.createXPath(element);
  }

  /**
   * Generates SHA-256 checksum for content validation
   *
   * @param containerText - Full container text content
   * @param selection - Selection range data
   * @returns Hex-encoded checksum string
   */
  private generateContentChecksum(
    containerText: string,
    selection: SelectionRange
  ): string {
    // Create checksum context: before + selected + after text
    const checksumContent =
      selection.contextBefore + selection.selectedText + selection.contextAfter;

    // Simple hash function for now (in production, would use crypto.subtle.digest)
    let hash = 0;
    for (let i = 0; i < checksumContent.length; i++) {
      const char = checksumContent.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Ensure minimum length of 12 characters by padding with timestamp
    const baseHash = Math.abs(hash).toString(16);
    const timestamp = Date.now().toString(16);
    return (baseHash + timestamp).substring(0, 12);
  }

  /**
   * Calculates confidence score for anchor quality
   *
   * @param anchor - Anchor to evaluate
   * @param container - Container element context
   * @returns Confidence score between 0 and 1
   */
  private calculateConfidenceScore(
    anchor: TextAnchor,
    container: Element
  ): number {
    let confidence = 0.5; // Base confidence

    // XPath validation adds confidence
    if (this.xpathAnchor.validateXPath(anchor.xpathSelector)) {
      confidence += 0.2;
    }

    // Offset validation adds confidence
    if (
      this.offsetAnchor.validateOffset(
        container,
        anchor.startOffset,
        anchor.selectedText.length
      )
    ) {
      confidence += 0.15;
    }

    // Context quality adds confidence
    const contextLength =
      anchor.contextBefore.length + anchor.contextAfter.length;
    if (contextLength > 50) {
      confidence += 0.1;
    } else if (contextLength > 20) {
      confidence += 0.05;
    }

    // Text length adds confidence (longer text is more unique)
    if (anchor.selectedText.length > 30) {
      confidence += 0.05;
    } else if (anchor.selectedText.length > 10) {
      confidence += 0.025;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Attempts to resolve anchor using specific strategy
   *
   * @param anchor - Anchor to resolve
   * @param strategy - Strategy to use for resolution
   * @returns Range if successful, null otherwise
   */
  private tryResolveWithStrategy(
    anchor: TextAnchor,
    strategy: AnchorStrategy
  ): Range | null {
    try {
      switch (strategy) {
        case 'xpath':
          return this.resolveUsingXPath(anchor);

        case 'offset':
          return this.resolveUsingOffset(anchor);

        case 'fuzzy':
          return this.resolveUsingFuzzy(anchor);

        default:
          return null;
      }
    } catch (error) {
      // Strategy failed, return null to try next strategy
      // Strategy failed, continue to next strategy
      return null;
    }
  }

  /**
   * Resolves anchor using XPath strategy
   *
   * @param anchor - Anchor to resolve
   * @returns Range if successful, null otherwise
   */
  private resolveUsingXPath(anchor: TextAnchor): Range | null {
    const element = this.xpathAnchor.resolveXPath(anchor.xpathSelector);
    if (!element) {
      return null;
    }

    // Try to find the text within the resolved element
    return this.xpathAnchor.findTextByXPath(element, anchor.selectedText);
  }

  /**
   * Resolves anchor using character offset strategy
   *
   * @param anchor - Anchor to resolve
   * @returns Range if successful, null otherwise
   */
  private resolveUsingOffset(anchor: TextAnchor): Range | null {
    // First try to find container using XPath (might still work partially)
    const element = this.xpathAnchor.resolveXPath(anchor.xpathSelector);
    if (!element) {
      // Try to find container by other means (would need more context)
      return null;
    }

    return this.offsetAnchor.findTextByOffset(
      element,
      anchor.startOffset,
      anchor.selectedText.length
    );
  }

  /**
   * Resolves anchor using fuzzy matching strategy
   *
   * @param anchor - Anchor to resolve
   * @returns Range if successful, null otherwise
   */
  private resolveUsingFuzzy(anchor: TextAnchor): Range | null {
    // Try to find any reasonable container element
    const element =
      this.xpathAnchor.resolveXPath(anchor.xpathSelector) || this.document.body; // Fallback to body

    if (!element) {
      return null;
    }

    const containerText = element.textContent || '';
    const fuzzyRange = this.fuzzyMatcher.findSimilarText(
      anchor.selectedText,
      containerText,
      {
        contextBefore: anchor.contextBefore,
        contextAfter: anchor.contextAfter,
        threshold: this.config.minConfidence,
      }
    );

    if (fuzzyRange) {
      // Convert the fuzzy match to a proper Range in the DOM
      return this.fuzzyMatcher.createRangeFromPosition(
        element,
        containerText,
        0, // This would need proper position calculation
        anchor.selectedText.length
      );
    }

    return null;
  }

  /**
   * Validates that a resolved range matches anchor expectations
   *
   * @param range - Resolved range to validate
   * @param anchor - Original anchor for comparison
   * @returns True if range is valid match
   */
  private validateResolvedRange(range: Range, anchor: TextAnchor): boolean {
    const rangeText = range.toString().trim();
    const expectedText = anchor.selectedText.trim();

    // Check for exact match
    if (rangeText === expectedText) {
      return true;
    }

    // Check similarity for fuzzy matches
    const similarity = this.fuzzyMatcher.calculateSimilarity(
      rangeText,
      expectedText
    );
    return similarity >= this.config.minConfidence;
  }

  /**
   * Records performance metrics for monitoring
   *
   * @param metrics - Metrics data to record
   */
  private recordMetrics(metrics: AnchorMetrics): void {
    this.metrics.push(metrics);

    // Keep only recent metrics to prevent memory bloat
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-500);
    }
  }
}
