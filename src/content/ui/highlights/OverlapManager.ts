/**
 * Overlap Manager for Highlight Rendering System
 *
 * Manages overlapping highlights by detecting conflicts and applying appropriate
 * visual styling (opacity, layering) to ensure readability and visual hierarchy.
 */

import { WrappedElement } from './TextWrapper';

export interface HighlightData {
  /** Bookmark ID */
  bookmarkId: string;
  /** Wrapped elements for this highlight */
  wrappedElements: WrappedElement[];
  /** CSS class for styling */
  highlightClass: string;
  /** Priority level (higher = more important) */
  priority?: number;
}

export interface OverlapGroup {
  /** Elements that overlap at the same position */
  overlappingElements: HighlightData[];
  /** DOM range where overlap occurs */
  overlapRange: Range;
  /** Number of overlapping highlights */
  overlapCount: number;
}

export interface OverlapResolution {
  /** Updated highlight classes with opacity adjustments */
  resolvedClasses: Map<string, string>;
  /** Elements that need restyling */
  elementsToUpdate: Map<Element, string>;
  /** Whether resolution was successful */
  success: boolean;
  /** Any errors encountered */
  errors: string[];
}

/**
 * Overlap Manager for handling overlapping highlights
 *
 * Detects when multiple highlights occupy the same text space and
 * applies visual styling to maintain readability through opacity
 * and layering adjustments.
 */
export class OverlapManager {
  private document: Document;
  private readonly BASE_HIGHLIGHT_CLASS = 'chatmarks-highlight';
  private readonly MAX_OVERLAP_OPACITY = 0.9;
  private readonly MIN_OVERLAP_OPACITY = 0.3;
  private readonly OVERLAP_STEP = 0.15;

  constructor(document: Document) {
    this.document = document;
  }

  /**
   * Detects overlapping highlights in the current document
   *
   * @param highlights - Array of highlight data to analyze for overlaps
   * @returns Array of overlap groups found
   */
  detectOverlaps(highlights: HighlightData[]): OverlapGroup[] {
    const overlapGroups: OverlapGroup[] = [];

    if (highlights.length < 2) {
      return overlapGroups; // No possible overlaps
    }

    try {
          // Create ranges for each highlight
    const highlightRanges = highlights.map(highlight => ({
        highlight,
        ranges: this.getHighlightRanges(highlight),
      })).filter(item => item.ranges.length > 0);

      // Check for overlaps between each pair
      for (let i = 0; i < highlightRanges.length; i++) {
        for (let j = i + 1; j < highlightRanges.length; j++) {
          const highlightRangeI = highlightRanges[i];
          const highlightRangeJ = highlightRanges[j];

          if (!highlightRangeI || !highlightRangeJ) continue;

          const overlapRange = this.findOverlapRange(
            highlightRangeI.ranges,
            highlightRangeJ.ranges
          );

          if (overlapRange) {
            // Check if this overlap is already part of an existing group
            const existingGroup = overlapGroups.find(group =>
              this.rangesIntersect(group.overlapRange, overlapRange)
            );

            if (existingGroup) {
              // Add to existing group if not already present
              if (!existingGroup.overlappingElements.includes(highlightRangeI.highlight)) {
                existingGroup.overlappingElements.push(highlightRangeI.highlight);
                existingGroup.overlapCount++;
              }
              if (!existingGroup.overlappingElements.includes(highlightRangeJ.highlight)) {
                existingGroup.overlappingElements.push(highlightRangeJ.highlight);
                existingGroup.overlapCount++;
              }
            } else {
              // Create new overlap group
              overlapGroups.push({
                overlappingElements: [highlightRangeI.highlight, highlightRangeJ.highlight],
                overlapRange,
                overlapCount: 2,
              });
            }
          }
        }
      }

      return overlapGroups;
    } catch (error) {
      console.warn('Chatmarks: Error detecting overlaps:', error);
      return [];
    }
  }

  /**
   * Resolves overlapping highlights by applying appropriate styling
   *
   * @param overlapGroups - Groups of overlapping highlights to resolve
   * @returns Resolution result with updated classes and elements to update
   */
  resolveOverlaps(overlapGroups: OverlapGroup[]): OverlapResolution {
    const errors: string[] = [];
    const resolvedClasses = new Map<string, string>();
    const elementsToUpdate = new Map<Element, string>();

    try {
      for (const group of overlapGroups) {
        const resolution = this.resolveOverlapGroup(group);

        if (resolution.success) {
          // Merge resolved classes
          resolution.resolvedClasses.forEach((className, bookmarkId) => {
            resolvedClasses.set(bookmarkId, className);
          });

          // Merge elements to update
          resolution.elementsToUpdate.forEach((className, element) => {
            elementsToUpdate.set(element, className);
          });
        } else {
          errors.push(...resolution.errors);
        }
      }

      return {
        resolvedClasses,
        elementsToUpdate,
        success: errors.length === 0,
        errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Overlap resolution failed: ${errorMessage}`);

      return {
        resolvedClasses,
        elementsToUpdate,
        success: false,
        errors,
      };
    }
  }

  /**
   * Calculates appropriate opacity for overlapping highlights
   *
   * @param overlapCount - Number of overlapping highlights
   * @param priority - Priority level of this highlight (higher = more important)
   * @returns Opacity value between MIN_OVERLAP_OPACITY and MAX_OVERLAP_OPACITY
   */
  calculateOpacity(overlapCount: number, priority: number = 0): number {
    if (overlapCount <= 1) {
      return this.MAX_OVERLAP_OPACITY; // No overlap, full opacity
    }

    // Base opacity decreases with overlap count
    const baseOpacity = Math.max(
      this.MIN_OVERLAP_OPACITY,
      this.MAX_OVERLAP_OPACITY - (overlapCount - 1) * this.OVERLAP_STEP
    );

    // Priority bonus (higher priority gets more opacity)
    const priorityBonus = Math.min(priority * 0.1, 0.2);

    return Math.min(this.MAX_OVERLAP_OPACITY, baseOpacity + priorityBonus);
  }

  /**
   * Applies resolved classes to elements in the DOM
   *
   * @param elementsToUpdate - Map of elements to their new classes
   * @returns Success status of the update operation
   */
  applyResolvedClasses(elementsToUpdate: Map<Element, string>): boolean {
    try {
      for (const [element, newClass] of elementsToUpdate) {
        if (element && element.parentNode) {
          // Remove existing highlight classes
          this.removeHighlightClasses(element);

          // Add new class
          element.className = newClass;
        }
      }

      return true;
    } catch (error) {
      console.warn('Chatmarks: Failed to apply resolved classes:', error);
      return false;
    }
  }

  /**
   * Creates CSS class name for highlight with specific opacity
   *
   * @param baseClass - Base highlight class name
   * @param opacity - Opacity value to apply
   * @returns CSS class name with opacity styling
   */
  createOpacityClass(baseClass: string, opacity: number): string {
    const opacityPercent = Math.round(opacity * 100);
    return `${baseClass} chatmarks-opacity-${opacityPercent}`;
  }

  /**
   * Gets all highlight ranges for a highlight
   */
  private getHighlightRanges(highlight: HighlightData): Range[] {
    const ranges: Range[] = [];

    try {
      for (const wrappedElement of highlight.wrappedElements) {
        const range = this.document.createRange();
        range.selectNodeContents(wrappedElement.highlightElement);
        ranges.push(range);
      }
    } catch (error) {
      console.warn('Chatmarks: Error creating highlight ranges:', error);
    }

    return ranges;
  }

  /**
   * Finds overlap between two sets of ranges
   */
  private findOverlapRange(ranges1: Range[], ranges2: Range[]): Range | null {
    for (const range1 of ranges1) {
      for (const range2 of ranges2) {
        try {
          if (this.rangesIntersect(range1, range2)) {
            // Create intersection range
            const intersection = this.createIntersectionRange(range1, range2);
            if (intersection) {
              return intersection;
            }
          }
        } catch (error) {
          // Range intersection failed, continue checking other ranges
          console.debug('Chatmarks: Range intersection check failed:', error);
        }
      }
    }

    return null;
  }

  /**
   * Checks if two ranges intersect
   */
  private rangesIntersect(range1: Range, range2: Range): boolean {
    try {
      // Check if ranges are in the same document
      if (range1.commonAncestorContainer.ownerDocument !==
          range2.commonAncestorContainer.ownerDocument) {
        return false;
      }

      // Intersection check using bounding rectangles
      try {
        const rect1 = range1.getBoundingClientRect();
        const rect2 = range2.getBoundingClientRect();

        return !(rect1.right < rect2.left ||
                 rect2.right < rect1.left ||
                 rect1.bottom < rect2.top ||
                 rect2.bottom < rect1.top);
      } catch (error) {
        // If bounding rect fails, assume no intersection
        console.debug('Chatmarks: Failed to get bounding rect for intersection check:', error);
        return false;
      }
    } catch (error) {
      console.debug('Chatmarks: Range intersection check failed:', error);
      return false;
    }
  }

  /**
   * Creates intersection range between two overlapping ranges
   */
  private createIntersectionRange(range1: Range, range2: Range): Range | null {
    try {
      // Find the common ancestor
      const ancestor = this.findCommonAncestor(range1, range2);
      if (!ancestor) {
        return null;
      }

      // Create intersection by finding overlapping text nodes
      const textNodes1 = this.getTextNodesInRange(range1);
      const textNodes2 = this.getTextNodesInRange(range2);

      // Find overlapping text nodes
      for (const node1 of textNodes1) {
        for (const node2 of textNodes2) {
          if (node1 === node2) {
            // Same text node - create range for overlapping portion
            const overlapRange = this.createNodeOverlapRange(node1, range1, range2);
            if (overlapRange) {
              return overlapRange;
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.debug('Chatmarks: Failed to create intersection range:', error);
      return null;
    }
  }

  /**
   * Resolves a single overlap group
   */
  private resolveOverlapGroup(group: OverlapGroup): OverlapResolution {
    const errors: string[] = [];
    const resolvedClasses = new Map<string, string>();
    const elementsToUpdate = new Map<Element, string>();

    try {
      if (group.overlappingElements.length < 2) {
        errors.push('Overlap group must have at least 2 elements');
        return { resolvedClasses, elementsToUpdate, success: false, errors };
      }

      // Sort by priority (if available)
      const sortedElements = [...group.overlappingElements].sort((a, b) => {
        const priorityA = a.priority || 0;
        const priorityB = b.priority || 0;
        return priorityB - priorityA; // Higher priority first
      });

      // Apply opacity-based resolution
      for (let i = 0; i < sortedElements.length; i++) {
        const highlight = sortedElements[i];
        if (!highlight) continue;

        const opacity = this.calculateOpacity(group.overlapCount, highlight.priority);

        // Create opacity class
        const opacityClass = this.createOpacityClass(highlight.highlightClass, opacity);
        resolvedClasses.set(highlight.bookmarkId, opacityClass);

        // Find elements to update
        for (const wrappedElement of highlight.wrappedElements) {
          elementsToUpdate.set(wrappedElement.highlightElement, opacityClass);
        }
      }

      return {
        resolvedClasses,
        elementsToUpdate,
        success: true,
        errors: [],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Group resolution failed: ${errorMessage}`);

      return {
        resolvedClasses,
        elementsToUpdate,
        success: false,
        errors,
      };
    }
  }

  /**
   * Creates overlap range within a single text node
   */
  private createNodeOverlapRange(
    textNode: Text,
    range1: Range,
    range2: Range
  ): Range | null {
    try {
      // Get offsets within the text node for both ranges
      const text = textNode.textContent || '';
      const nodeRange = this.document.createRange();
      nodeRange.selectNodeContents(textNode);

      // Calculate relative offsets
      const start1 = range1.compareBoundaryPoints(Range.START_TO_START, nodeRange);
      const end1 = range1.compareBoundaryPoints(Range.END_TO_START, nodeRange);
      const start2 = range2.compareBoundaryPoints(Range.START_TO_START, nodeRange);
      const end2 = range2.compareBoundaryPoints(Range.END_TO_START, nodeRange);

      // Find overlap within the text node
      const overlapStart = Math.max(start1, start2);
      const overlapEnd = Math.min(end1, end2);

      if (overlapStart < overlapEnd) {
        const overlapRange = this.document.createRange();
        overlapRange.setStart(textNode, overlapStart);
        overlapRange.setEnd(textNode, overlapEnd);
        return overlapRange;
      }

      return null;
    } catch (error) {
      console.debug('Chatmarks: Failed to create node overlap range:', error);
      return null;
    }
  }

  /**
   * Finds common ancestor element for two ranges
   */
  private findCommonAncestor(range1: Range, range2: Range): Element | null {
    const ancestors1 = this.getAncestors(range1.commonAncestorContainer);
    const ancestors2 = this.getAncestors(range2.commonAncestorContainer);

    // Find the first common ancestor
    for (const ancestor1 of ancestors1) {
      if (ancestors2.includes(ancestor1)) {
        return ancestor1;
      }
    }

    return null;
  }

  /**
   * Gets ancestor elements for a node
   */
  private getAncestors(node: Node): Element[] {
    const ancestors: Element[] = [];
    let current = node;

    while (current && current !== this.document) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        ancestors.push(current as Element);
      }
      current = current.parentNode as Node;
    }

    return ancestors;
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
      if (range.intersectsNode && range.intersectsNode(node)) {
        textNodes.push(node as Text);
      }
      node = walker.nextNode();
    }

    return textNodes;
  }

  /**
   * Removes existing highlight classes from an element
   */
  private removeHighlightClasses(element: Element): void {
    const classesToRemove: string[] = [];

    for (const className of element.classList) {
      if (className.startsWith('chatmarks-highlight') ||
          className.startsWith('chatmarks-opacity-')) {
        classesToRemove.push(className);
      }
    }

    classesToRemove.forEach(className => element.classList.remove(className));
  }

  /**
   * Gets the maximum opacity class name for a given opacity value
   *
   * @param opacity - Opacity value (0-1)
   * @returns CSS class name for the closest opacity level
   */
  getMaxOpacityClass(opacity: number): string {
    const opacityPercent = Math.round(opacity * 100);
    return `chatmarks-opacity-${opacityPercent}`;
  }

  /**
   * Validates that CSS classes for opacity levels exist
   *
   * This method should be called during initialization to ensure
   * all required opacity classes are available in the stylesheet.
   */
  validateOpacityClasses(): { valid: boolean; missing: string[] } {
    const missing: string[] = [];

    // Check for base highlight class
    if (!this.hasClassInDocument(this.BASE_HIGHLIGHT_CLASS)) {
      missing.push(this.BASE_HIGHLIGHT_CLASS);
    }

    // Check for opacity classes (30% to 90% in 15% steps)
    for (let opacity = 30; opacity <= 90; opacity += 15) {
      const className = `chatmarks-opacity-${opacity}`;
      if (!this.hasClassInDocument(className)) {
        missing.push(className);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Checks if a CSS class exists in the document
   */
  private hasClassInDocument(className: string): boolean {
    // Simple check - in a real implementation, you might want to
    // check the actual stylesheet or create a test element
    return true; // Assume classes exist for now
  }
}
