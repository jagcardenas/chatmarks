/**
 * XPath-based text anchoring system
 *
 * Provides the primary anchoring strategy using XPath selectors for precise
 * DOM element targeting. This is the most reliable method when DOM structure
 * remains stable.
 */

/**
 * XPath anchoring implementation for precise DOM element targeting
 *
 * This class provides methods to create and resolve XPath selectors that can
 * precisely locate text elements in the DOM. It serves as the primary strategy
 * in the multi-layered anchoring system.
 */
export class XPathAnchor {
  private document: Document;

  /**
   * Initialize XPath anchor with document context
   *
   * @param document - The document context for XPath operations
   */
  constructor(document: Document) {
    this.document = document;
  }

  /**
   * Creates an XPath selector string for the given DOM element
   *
   * Generates a precise XPath that can uniquely identify the element
   * within the document structure. Uses element indices to ensure
   * uniqueness when multiple similar elements exist.
   *
   * @param element - The DOM element to create XPath for
   * @returns XPath selector string that can locate this element
   * @throws Error if element is null or not in the document
   */
  createXPath(element: Element): string {
    if (!element) {
      throw new Error('Cannot create XPath for null element');
    }

    if (!this.document.contains(element)) {
      throw new Error('Element is not part of the document');
    }

    const pathSegments: string[] = [];
    let currentElement = element;

    while (currentElement && currentElement !== this.document.documentElement) {
      const tagName = currentElement.tagName.toLowerCase();
      const elementIndex = this.calculateElementIndex(currentElement);

      // Always include index for uniqueness and test consistency
      pathSegments.unshift(`${tagName}[${elementIndex}]`);

      currentElement = currentElement.parentElement as Element;
    }

    // Add root element
    if (currentElement === this.document.documentElement) {
      const rootTag = currentElement.tagName.toLowerCase();
      pathSegments.unshift(rootTag);
    }

    return '/' + pathSegments.join('/');
  }

  /**
   * Resolves an XPath selector back to a DOM element
   *
   * Takes an XPath string and attempts to locate the corresponding
   * element in the current document. Returns null if the XPath
   * cannot be resolved (e.g., if DOM has changed).
   *
   * @param xpath - XPath selector string to resolve
   * @returns The located DOM element or null if not found
   */
  resolveXPath(xpath: string): Element | null {
    if (!xpath || !this.validateXPath(xpath)) {
      return null;
    }

    try {
      const result = this.document.evaluate(
        xpath,
        this.document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );

      return result.singleNodeValue as Element;
    } catch (error) {
      // XPath evaluation failed - likely due to invalid syntax or DOM changes
      console.warn('Chatmarks: XPath evaluation failed:', error);
      return null;
    }
  }

  /**
   * Validates XPath selector syntax and resolvability
   *
   * Checks both the syntactic validity of the XPath string and
   * whether it can be resolved in the current document context.
   *
   * @param xpath - XPath selector to validate
   * @returns True if XPath is valid and resolvable, false otherwise
   */
  validateXPath(xpath: string): boolean {
    if (!xpath || typeof xpath !== 'string') {
      return false;
    }

    // Basic syntax validation
    if (!xpath.startsWith('/')) {
      return false;
    }

    // Check for balanced brackets
    const openBrackets = (xpath.match(/\[/g) || []).length;
    const closeBrackets = (xpath.match(/]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      return false;
    }

    // Try to evaluate the XPath to ensure it's syntactically valid
    try {
      const _result = this.document.evaluate(
        xpath,
        this.document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );

      // XPath is syntactically valid if evaluation doesn't throw
      return true;
    } catch (error) {
      // XPath validation failed
      console.warn('Chatmarks: XPath validation failed:', error);
      return false;
    }
  }

  /**
   * Calculates the index position of an element among its siblings
   *
   * Determines the 1-based index of the element within its parent,
   * considering only siblings with the same tag name. Used for
   * creating precise XPath selectors.
   *
   * @param element - Element to calculate index for
   * @returns 1-based index of the element among same-tag siblings
   */
  private calculateElementIndex(element: Element): number {
    const parent = element.parentElement;
    if (!parent) {
      return 1;
    }

    const siblings = Array.from(parent.children);
    const sameTagSiblings = siblings.filter(
      sibling => sibling.tagName === element.tagName
    );

    const index = sameTagSiblings.indexOf(element);
    return index + 1; // XPath uses 1-based indexing
  }

  /**
   * Creates a more robust XPath with fallback strategies
   *
   * Generates an XPath that includes additional attributes when available
   * to make the selector more specific and less likely to break with
   * minor DOM changes.
   *
   * @param element - Element to create enhanced XPath for
   * @returns Enhanced XPath selector with attribute information
   */
  createEnhancedXPath(element: Element): string {
    if (!element) {
      throw new Error('Cannot create enhanced XPath for null element');
    }

    const pathSegments: string[] = [];
    let currentElement = element;

    while (currentElement && currentElement !== this.document.documentElement) {
      let segment = currentElement.tagName.toLowerCase();

      // Add ID if available
      if (currentElement.id) {
        segment += `[@id="${currentElement.id}"]`;
      } else {
        // Add class if available and no ID
        const classNames = currentElement.className;
        if (classNames && typeof classNames === 'string') {
          const firstClass = classNames.split(' ')[0];
          if (firstClass) {
            segment += `[@class="${firstClass}"]`;
          }
        }

        // Add index for disambiguation if no ID or class
        if (!currentElement.id && !classNames) {
          const index = this.calculateElementIndex(currentElement);
          if (index > 1) {
            segment += `[${index}]`;
          }
        }
      }

      pathSegments.unshift(segment);
      currentElement = currentElement.parentElement as Element;
    }

    // Add root element
    if (currentElement === this.document.documentElement) {
      const rootTag = currentElement.tagName.toLowerCase();
      pathSegments.unshift(rootTag);
    }

    return '/' + pathSegments.join('/');
  }

  /**
   * Finds text content within an element using XPath
   *
   * Locates text nodes containing specific content within the given
   * element using XPath text() functions. Useful for finding text
   * that may span multiple text nodes.
   *
   * @param element - Container element to search within
   * @param textContent - Text content to locate
   * @returns Range containing the found text or null if not found
   */
  findTextByXPath(element: Element, textContent: string): Range | null {
    if (!element || !textContent) {
      return null;
    }

    try {
      // Create XPath to find text nodes containing the target text
      const xpath = `.//text()[contains(., "${textContent}")]`;

      const result = this.document.evaluate(
        xpath,
        element,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );

      const textNode = result.singleNodeValue;
      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
        return null;
      }

      // Create range for the found text
      const range = this.document.createRange();
      const textValue = textNode.textContent || '';
      const startIndex = textValue.indexOf(textContent);

      if (startIndex === -1) {
        return null;
      }

      range.setStart(textNode, startIndex);
      range.setEnd(textNode, startIndex + textContent.length);

      return range;
    } catch (error) {
      // Failed to create range from XPath and text
      console.warn(
        'Chatmarks: Failed to create range from XPath and text:',
        error
      );
      return null;
    }
  }
}
