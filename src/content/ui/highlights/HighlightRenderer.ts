/**
 * Highlight Renderer for Chatmarks Extension
 *
 * Main coordinator for the highlight rendering system. Integrates with text anchoring,
 * DOM manipulation, and overlap resolution to provide robust text highlighting
 * that persists across page changes and handles complex scenarios.
 */

import { Bookmark, TextAnchor } from '../../../types/bookmark';
import { AnchorSystem } from '../anchoring/index';
import { TextWrapper, WrappedElement } from './TextWrapper';
import { OverlapManager, HighlightData } from './OverlapManager';

type PromiseSettledResult<T> = PromiseFulfilledResult<T> | PromiseRejectedResult;

export interface HighlightStyle {
  /** CSS class name for the highlight */
  className: string;
  /** Hex color code for custom highlights */
  color?: string;
  /** Priority level for overlap resolution */
  priority?: number;
  /** Additional CSS properties */
  cssProperties?: Record<string, string>;
}

export interface RenderResult {
  /** Whether the highlight was rendered successfully */
  success: boolean;
  /** Number of elements wrapped */
  elementCount: number;
  /** Any errors encountered during rendering */
  errors: string[];
  /** Range object used for highlighting (if available) */
  range?: Range;
}

export interface RestoreResult {
  /** Total bookmarks processed */
  totalProcessed: number;
  /** Number successfully restored */
  successfullyRestored: number;
  /** Number that failed to restore */
  failedToRestore: number;
  /** Errors encountered during restoration */
  errors: string[];
  /** Bookmarks that were successfully restored */
  restoredBookmarks: string[];
  /** Bookmarks that failed to restore */
  failedBookmarks: string[];
}

export interface HighlightMetrics {
  /** Total active highlights */
  totalHighlights: number;
  /** Total wrapped elements */
  totalElements: number;
  /** Memory usage estimate */
  estimatedMemoryUsage: number;
  /** Performance metrics */
  performance: {
    averageRenderTime: number;
    averageRestoreTime: number;
    lastRenderTime: number;
    lastRestoreTime: number;
  };
}

/**
 * Main Highlight Renderer
 *
 * Coordinates the entire highlight rendering pipeline:
 * 1. Anchor resolution using AnchorSystem
 * 2. Text wrapping using TextWrapper
 * 3. Overlap resolution using OverlapManager
 * 4. Performance monitoring and cleanup
 */
export class HighlightRenderer {
  private document: Document;
  private anchorSystem: AnchorSystem;
  private textWrapper: TextWrapper;
  private overlapManager: OverlapManager;
  private activeHighlights: Map<string, HighlightData> = new Map();

  // Performance tracking
  private renderTimes: number[] = [];
  private restoreTimes: number[] = [];
  private maxMetricsHistory = 100;

  // Performance optimizations
  private intersectionObserver: IntersectionObserver | null = null;
  private visibleHighlights: Set<string> = new Set();
  private pendingHighlights: Map<string, Bookmark> = new Map();
  private isRestoring = false;

  // Default styling
  private readonly DEFAULT_HIGHLIGHT_CLASS = 'chatmarks-highlight';
  private readonly FLASH_ANIMATION_CLASS = 'chatmarks-highlight-new';

  constructor(document: Document) {
    this.document = document;
    this.anchorSystem = new AnchorSystem(document);
    this.textWrapper = new TextWrapper(document);
    this.overlapManager = new OverlapManager(document);

    // Initialize performance optimizations
    this.initializeIntersectionObserver();
  }

  /**
   * Initialize IntersectionObserver for viewport-based performance optimization
   */
  private initializeIntersectionObserver(): void {
    if (!('IntersectionObserver' in window)) {
      console.debug('Chatmarks: IntersectionObserver not supported, using fallback rendering');
      return;
    }

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        this.handleIntersectionChanges(entries);
      },
      {
        root: null, // viewport
        rootMargin: '50px', // Pre-load highlights 50px before they enter viewport
        threshold: [0, 0.1, 0.5, 1.0], // Multiple thresholds for fine-grained control
      }
    );
  }

  /**
   * Handle intersection observer changes for performance optimization
   */
  private handleIntersectionChanges(entries: IntersectionObserverEntry[]): void {
    const newlyVisible: string[] = [];
    const newlyHidden: string[] = [];

    for (const entry of entries) {
      const bookmarkId = (entry.target as Element).getAttribute('data-bookmark-id');
      if (!bookmarkId) continue;

      const isVisible = entry.isIntersecting && entry.intersectionRatio > 0.1;
      const wasVisible = this.visibleHighlights.has(bookmarkId);

      if (isVisible && !wasVisible) {
        newlyVisible.push(bookmarkId);
        this.visibleHighlights.add(bookmarkId);
      } else if (!isVisible && wasVisible) {
        newlyHidden.push(bookmarkId);
        this.visibleHighlights.delete(bookmarkId);
      }
    }

    // Process visibility changes
    if (newlyVisible.length > 0) {
      this.onHighlightsBecameVisible(newlyVisible);
    }

    if (newlyHidden.length > 0) {
      this.onHighlightsBecameHidden(newlyHidden);
    }
  }

  /**
   * Called when highlights become visible in viewport
   */
  private onHighlightsBecameVisible(bookmarkIds: string[]): void {
    // For now, highlights are already rendered, but we could add
    // priority-based re-rendering or pre-caching here in the future
    console.debug(`Chatmarks: ${bookmarkIds.length} highlights became visible`);
  }

  /**
   * Called when highlights leave viewport
   */
  private onHighlightsBecameHidden(bookmarkIds: string[]): void {
    // We keep highlights rendered for now, but this could be used for:
    // - Memory cleanup of off-screen highlights
    // - Reducing DOM manipulation for hidden elements
    // - Prioritizing visible highlights for updates
    console.debug(`Chatmarks: ${bookmarkIds.length} highlights became hidden`);
  }

  /**
   * Enable lazy rendering mode for better performance with many highlights
   */
  enableLazyRendering(): void {
    this.initializeIntersectionObserver();
  }

  /**
   * Disable lazy rendering (render all highlights immediately)
   */
  disableLazyRendering(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    this.visibleHighlights.clear();
  }

  /**
   * Renders a highlight for a bookmark
   *
   * Main entry point for rendering individual highlights. Uses the complete
   * pipeline: anchor resolution → text wrapping → overlap resolution.
   *
   * @param bookmark - Bookmark to render highlight for
   * @param style - Optional custom styling
   * @param flash - Whether to show flash animation
   * @returns Render result with success status and metadata
   */
  async renderHighlight(
    bookmark: Bookmark,
    style?: Partial<HighlightStyle>,
    flash: boolean = false
  ): Promise<RenderResult> {
    const startTime = performance.now();
    const errors: string[] = [];

    try {
      // Resolve anchor to get text range
      const range = this.anchorSystem.resolveAnchor(bookmark.anchor);
      if (!range) {
        errors.push(`Failed to resolve anchor for bookmark ${bookmark.id}`);
        return {
          success: false,
          elementCount: 0,
          errors,
        };
      }

      // Create highlight style
      const highlightStyle = this.createHighlightStyle(bookmark, style);

      // Wrap the text with highlight elements
      const wrapResult = this.textWrapper.wrapTextRange(
        range,
        bookmark.id,
        highlightStyle.className
      );

      if (!wrapResult.success) {
        errors.push(...wrapResult.errors);
        return {
          success: false,
          elementCount: 0,
          errors,
        };
      }

      // Create highlight data for tracking
      const highlightData: HighlightData = {
        bookmarkId: bookmark.id,
        wrappedElements: wrapResult.wrappedElements,
        highlightClass: highlightStyle.className,
        priority: highlightStyle.priority,
      };

      // Store active highlight
      this.activeHighlights.set(bookmark.id, highlightData);

      // Register with IntersectionObserver for performance optimization
      this.registerHighlightWithObserver(bookmark.id, highlightData);

      // Handle overlaps if necessary
      await this.resolveOverlaps();

      // Apply flash animation if requested
      if (flash) {
        this.applyFlashAnimation(bookmark.id);
      }

      // Apply custom styling
      if (highlightStyle.cssProperties && Object.keys(highlightStyle.cssProperties).length > 0) {
        this.applyCustomStyling(wrapResult.wrappedElements, highlightStyle);
      }

      // Record performance
      const renderTime = performance.now() - startTime;
      this.recordRenderTime(renderTime);

      return {
        success: true,
        elementCount: wrapResult.wrappedElements.length,
        errors: [],
        range,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Highlight rendering failed: ${errorMessage}`);

      // Record failed attempt
      const renderTime = performance.now() - startTime;
      this.recordRenderTime(renderTime);

      return {
        success: false,
        elementCount: 0,
        errors,
      };
    }
  }

  /**
   * Removes a highlight for a specific bookmark
   *
   * @param bookmarkId - ID of bookmark to remove highlight for
   * @returns Success status of removal operation
   */
  removeHighlight(bookmarkId: string): boolean {
    try {
      // Unregister from IntersectionObserver first
      this.unregisterHighlightFromObserver(bookmarkId);

      // Remove from text wrapper
      const removed = this.textWrapper.removeHighlights(bookmarkId);

      if (removed) {
        // Remove from active highlights
        this.activeHighlights.delete(bookmarkId);

        // Re-resolve overlaps after removal
        this.resolveOverlaps().catch(error => {
          console.warn('Chatmarks: Failed to re-resolve overlaps after removal:', error);
        });
      }

      return removed;
    } catch (error) {
      console.warn('Chatmarks: Failed to remove highlight:', bookmarkId, error);
      return false;
    }
  }

  /**
   * Updates highlight styling for a specific bookmark
   *
   * @param bookmarkId - ID of bookmark to update
   * @param style - New styling to apply
   * @returns Success status of update operation
   */
  updateHighlight(bookmarkId: string, style: Partial<HighlightStyle>): boolean {
    try {
      const highlightData = this.activeHighlights.get(bookmarkId);
      if (!highlightData) {
        return false; // Highlight not found
      }

      // Update styling in text wrapper
      const updated = this.textWrapper.updateHighlightStyling(
        bookmarkId,
        style.className || this.DEFAULT_HIGHLIGHT_CLASS
      );

      if (updated) {
        // Update stored data
        highlightData.highlightClass = style.className || highlightData.highlightClass;
        highlightData.priority = style.priority || highlightData.priority;

        // Apply custom styling
        const highlightStyle = this.createHighlightStyle(
          { id: bookmarkId } as Bookmark,
          style
        );
        this.applyCustomStyling(highlightData.wrappedElements, highlightStyle);

        // Re-resolve overlaps
        this.resolveOverlaps().catch(error => {
          console.warn('Chatmarks: Failed to re-resolve overlaps after update:', error);
        });
      }

      return updated;
    } catch (error) {
      console.warn('Chatmarks: Failed to update highlight:', bookmarkId, error);
      return false;
    }
  }

  /**
   * Restores highlights for multiple bookmarks
   *
   * Used during page load to restore existing bookmarks. Processes bookmarks
   * in batches for performance and handles failures gracefully.
   *
   * @param bookmarks - Array of bookmarks to restore
   * @param batchSize - Number of bookmarks to process in each batch
   * @returns Detailed restore result with success/failure counts
   */
  async restoreHighlights(
    bookmarks: Bookmark[],
    batchSize: number = 10
  ): Promise<RestoreResult> {
    const startTime = performance.now();
    const errors: string[] = [];
    let successfullyRestored = 0;
    let failedToRestore = 0;
    const restoredBookmarks: string[] = [];
    const failedBookmarks: string[] = [];

    try {
      // Process bookmarks in batches for performance
      for (let i = 0; i < bookmarks.length; i += batchSize) {
        const batch = bookmarks.slice(i, i + batchSize);
        const batchPromises = batch.map(bookmark =>
          this.renderHighlight(bookmark, undefined, false)
        );

        const batchResults = await Promise.allSettled(batchPromises);

        for (let j = 0; j < batch.length; j++) {
          const bookmark = batch[j]!;
          const result = batchResults[j]!;

          if (result.status === 'fulfilled' && result.value.success) {
            successfullyRestored++;
            restoredBookmarks.push(bookmark.id);
          } else {
            failedToRestore++;
            failedBookmarks.push(bookmark.id);

            const errorMessage = result.status === 'rejected'
              ? (result as PromiseRejectedResult).reason
              : (result as PromiseFulfilledResult<RenderResult>).value.errors.join(', ');
            errors.push(`Failed to restore bookmark ${bookmark.id}: ${errorMessage}`);
          }
        }

        // Yield control to prevent blocking the main thread
        if (i + batchSize < bookmarks.length) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      // Final overlap resolution
      await this.resolveOverlaps();

      // Record performance
      const restoreTime = performance.now() - startTime;
      this.recordRestoreTime(restoreTime);

      return {
        totalProcessed: bookmarks.length,
        successfullyRestored,
        failedToRestore,
        errors,
        restoredBookmarks,
        failedBookmarks,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Restore operation failed: ${errorMessage}`);

      // Record failed attempt
      const restoreTime = performance.now() - startTime;
      this.recordRestoreTime(restoreTime);

      return {
        totalProcessed: bookmarks.length,
        successfullyRestored,
        failedToRestore: bookmarks.length - successfullyRestored,
        errors,
        restoredBookmarks,
        failedBookmarks: bookmarks.filter(b => !restoredBookmarks.includes(b.id)).map(b => b.id),
      };
    }
  }

  /**
   * Gets performance and usage metrics for the highlight system
   *
   * @returns Comprehensive metrics about highlight system performance
   */
  getMetrics(): HighlightMetrics {
    const totalElements = Array.from(this.activeHighlights.values())
      .reduce((sum, highlight) => sum + highlight.wrappedElements.length, 0);

    const averageRenderTime = this.renderTimes.length > 0
      ? this.renderTimes.reduce((sum, time) => sum + time, 0) / this.renderTimes.length
      : 0;

    const averageRestoreTime = this.restoreTimes.length > 0
      ? this.restoreTimes.reduce((sum, time) => sum + time, 0) / this.restoreTimes.length
      : 0;

    // Rough memory estimate (each element ~ 100 bytes overhead)
    const estimatedMemoryUsage = this.activeHighlights.size * 200 + totalElements * 150;

    return {
      totalHighlights: this.activeHighlights.size,
      totalElements,
      estimatedMemoryUsage,
      performance: {
        averageRenderTime,
        averageRestoreTime,
        lastRenderTime: this.renderTimes[this.renderTimes.length - 1] || 0,
        lastRestoreTime: this.restoreTimes[this.restoreTimes.length - 1] || 0,
      },
    };
  }

  /**
   * Clears all active highlights
   *
   * @returns Number of highlights removed
   */
  clearAllHighlights(): number {
    const highlightCount = this.activeHighlights.size;
    const bookmarkIds = Array.from(this.activeHighlights.keys());

    // Disconnect observer temporarily to avoid unnecessary callbacks
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }

    for (const bookmarkId of bookmarkIds) {
      this.removeHighlight(bookmarkId);
    }

    // Reconnect observer if it was enabled
    if (highlightCount > 0 && !this.intersectionObserver) {
      this.initializeIntersectionObserver();
    }

    return highlightCount;
  }

  /**
   * Gets all active highlight data
   *
   * @returns Map of bookmark IDs to highlight data
   */
  getActiveHighlights(): Map<string, HighlightData> {
    return new Map(this.activeHighlights);
  }

  /**
   * Checks if a bookmark has an active highlight
   *
   * @param bookmarkId - Bookmark ID to check
   * @returns True if highlight is active
   */
  hasActiveHighlight(bookmarkId: string): boolean {
    return this.activeHighlights.has(bookmarkId);
  }

  /**
   * Register a highlight with the IntersectionObserver for performance tracking
   */
  private registerHighlightWithObserver(bookmarkId: string, highlightData: HighlightData): void {
    if (!this.intersectionObserver) {
      return;
    }

    // Register each wrapped element with the observer
    for (const wrappedElement of highlightData.wrappedElements) {
      // Only observe the first element to avoid duplicate observations
      if (wrappedElement.highlightElement && wrappedElement.highlightElement.isConnected) {
        this.intersectionObserver.observe(wrappedElement.highlightElement);
      }
    }
  }

  /**
   * Unregister a highlight from the IntersectionObserver
   */
  private unregisterHighlightFromObserver(bookmarkId: string): void {
    if (!this.intersectionObserver) {
      return;
    }

    const highlightData = this.activeHighlights.get(bookmarkId);
    if (!highlightData) {
      return;
    }

    // Unobserve all elements for this highlight
    for (const wrappedElement of highlightData.wrappedElements) {
      if (wrappedElement.highlightElement) {
        this.intersectionObserver.unobserve(wrappedElement.highlightElement);
      }
    }

    this.visibleHighlights.delete(bookmarkId);
  }

  /**
   * Cleanup method to free resources
   */
  cleanup(): void {
    // Disable lazy rendering and disconnect observer
    this.disableLazyRendering();

    // Clear all highlights
    this.clearAllHighlights();

    // Clear performance metrics
    this.renderTimes = [];
    this.restoreTimes = [];

    // Clear pending operations
    this.pendingHighlights.clear();

    // Cleanup components
    this.textWrapper.cleanup();
  }

  /**
   * Resolves overlapping highlights using the overlap manager
   */
  private async resolveOverlaps(): Promise<void> {
    try {
      if (this.activeHighlights.size < 2) {
        return; // No possible overlaps
      }

      const highlights = Array.from(this.activeHighlights.values());
      const overlapGroups = this.overlapManager.detectOverlaps(highlights);

      if (overlapGroups.length > 0) {
        const resolution = this.overlapManager.resolveOverlaps(overlapGroups);
        if (resolution.success) {
          this.overlapManager.applyResolvedClasses(resolution.elementsToUpdate);
        } else {
          console.warn('Chatmarks: Overlap resolution failed:', resolution.errors);
        }
      }
    } catch (error) {
      console.warn('Chatmarks: Overlap resolution failed:', error);
    }
  }

  /**
   * Creates a complete highlight style from bookmark and overrides
   */
  private createHighlightStyle(
    bookmark: Bookmark,
    overrides?: Partial<HighlightStyle>
  ): HighlightStyle {
    const baseStyle: HighlightStyle = {
      className: this.DEFAULT_HIGHLIGHT_CLASS,
      color: bookmark.color,
      priority: 0,
      cssProperties: {},
    };

    return { ...baseStyle, ...overrides };
  }

  /**
   * Applies flash animation to newly created highlights
   */
  private applyFlashAnimation(bookmarkId: string): void {
    const highlightData = this.activeHighlights.get(bookmarkId);
    if (!highlightData) {
      return;
    }

    // Add flash class to all wrapped elements
    for (const wrappedElement of highlightData.wrappedElements) {
      wrappedElement.highlightElement.classList.add(this.FLASH_ANIMATION_CLASS);
    }

    // Remove flash class after animation completes
    setTimeout(() => {
      const currentHighlightData = this.activeHighlights.get(bookmarkId);
      if (currentHighlightData) {
        for (const wrappedElement of currentHighlightData.wrappedElements) {
          wrappedElement.highlightElement.classList.remove(this.FLASH_ANIMATION_CLASS);
        }
      }
    }, 600); // Match CSS animation duration
  }

  /**
   * Applies custom styling properties to highlight elements
   */
  private applyCustomStyling(
    wrappedElements: WrappedElement[],
    style: HighlightStyle
  ): void {
    if (!style.cssProperties || Object.keys(style.cssProperties).length === 0) {
      return;
    }

    for (const wrappedElement of wrappedElements) {
      const element = wrappedElement.highlightElement as HTMLElement;
      if (element && element.style) {
        for (const [property, value] of Object.entries(style.cssProperties)) {
          (element.style as any)[property] = value;
        }
      }
    }
  }

  /**
   * Records render time for performance monitoring
   */
  private recordRenderTime(time: number): void {
    this.renderTimes.push(time);
    if (this.renderTimes.length > this.maxMetricsHistory) {
      this.renderTimes = this.renderTimes.slice(-this.maxMetricsHistory);
    }
  }

  /**
   * Records restore time for performance monitoring
   */
  private recordRestoreTime(time: number): void {
    this.restoreTimes.push(time);
    if (this.restoreTimes.length > this.maxMetricsHistory) {
      this.restoreTimes = this.restoreTimes.slice(-this.maxMetricsHistory);
    }
  }

  /**
   * Gets anchor system for external access (for testing/debugging)
   */
  getAnchorSystem(): AnchorSystem {
    return this.anchorSystem;
  }

  /**
   * Gets text wrapper for external access (for testing/debugging)
   */
  getTextWrapper(): TextWrapper {
    return this.textWrapper;
  }

  /**
   * Gets overlap manager for external access (for testing/debugging)
   */
  getOverlapManager(): OverlapManager {
    return this.overlapManager;
  }
}
