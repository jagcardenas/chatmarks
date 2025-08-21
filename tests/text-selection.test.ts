/**
 * Text Selection Test Suite
 *
 * Comprehensive tests for text selection and Range API implementation
 * following TDD methodology for Task 6.
 */

import { TextSelection } from '../src/content/selection/TextSelection';

describe('TextSelection', () => {
  let textSelection: TextSelection;
  let mockRange: Range;
  let mockSelection: {
    _rangeCount: number;
    _isCollapsed: boolean;
    rangeCount: number;
    isCollapsed: boolean;
    getRangeAt: jest.Mock;
    toString: jest.Mock;
    removeAllRanges: jest.Mock;
    addRange: jest.Mock;
  };

  beforeEach(function (): void {
    textSelection = new TextSelection();

    // Mock DOM setup
    document.body.innerHTML = `
      <div id="test-container">
        <p id="para1">This is the first paragraph with some text.</p>
        <p id="para2">This is the <span>second paragraph</span> with nested elements.</p>
        <div id="complex">
          <div>Nested <strong>bold text</strong> and <em>italic text</em></div>
        </div>
      </div>
    `;

    // Mock Range object
    mockRange = document.createRange();

    // Mock Selection object with getter/setter support
    mockSelection = {
      _rangeCount: 1,
      _isCollapsed: false,
      get rangeCount() {
        return this._rangeCount;
      },
      get isCollapsed() {
        return this._isCollapsed;
      },
      getRangeAt: jest.fn(() => mockRange),
      toString: jest.fn(() => 'selected text'),
      removeAllRanges: jest.fn(),
      addRange: jest.fn(),
    };

    // Mock window.getSelection
    Object.defineProperty(window, 'getSelection', {
      value: jest.fn(() => mockSelection),
      writable: true,
    });
  });

  afterEach(function (): void {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('captureRange', () => {
    it('should capture selection range accurately', () => {
      const para1 = document.getElementById('para1')!;
      const textNode = para1.firstChild as Text;

      mockRange.setStart(textNode, 5);
      mockRange.setEnd(textNode, 10);
      mockSelection.toString = jest.fn(() => 'is th');

      const result = textSelection.captureRange();

      expect(result).toBeDefined();
      expect(result?.text).toBe('is th');
      expect(result?.range).toBeDefined();
      expect(result?.boundingRect).toBeDefined();
    });

    it('should handle cross-node selections', () => {
      const para1 = document.getElementById('para1')!;
      const para2 = document.getElementById('para2')!;

      mockRange.setStart(para1.firstChild!, 35);
      mockRange.setEnd(para2.firstChild!, 10);
      mockSelection.toString = jest.fn(() => 'some text.\nThis is th');

      const result = textSelection.captureRange();

      expect(result).toBeDefined();
      expect(result?.text).toBe('some text. This is th');
      expect(result?.range).toBeDefined();
    });

    it('should return null for collapsed selections', () => {
      mockSelection._isCollapsed = true;

      const result = textSelection.captureRange();

      expect(result).toBeNull();
    });

    it('should return null for empty selections', () => {
      mockSelection.toString = jest.fn(() => '');

      const result = textSelection.captureRange();

      expect(result).toBeNull();
    });

    it('should handle selections with only whitespace', () => {
      mockSelection.toString = jest.fn(() => '   \n\t  ');

      const result = textSelection.captureRange();

      expect(result).toBeNull();
    });

    it('should capture selection with nested elements', () => {
      const complex = document.getElementById('complex')!;
      const boldText = complex.querySelector('strong')!;

      mockRange.selectNodeContents(boldText);
      mockSelection.toString = jest.fn(() => 'bold text');

      const result = textSelection.captureRange();

      expect(result).toBeDefined();
      expect(result?.text).toBe('bold text');
    });
  });

  describe('normalizeText', () => {
    it('should normalize whitespace correctly', () => {
      const input = '  This   has\n\nmultiple   spaces  ';
      const expected = 'This has multiple spaces';

      const result = textSelection.normalizeText(input);

      expect(result).toBe(expected);
    });

    it('should preserve single spaces between words', () => {
      const input = 'This is normal text';
      const expected = 'This is normal text';

      const result = textSelection.normalizeText(input);

      expect(result).toBe(expected);
    });

    it('should handle newlines and tabs', () => {
      const input = 'Line1\nLine2\tTabbed\r\nLine3';
      const expected = 'Line1 Line2 Tabbed Line3';

      const result = textSelection.normalizeText(input);

      expect(result).toBe(expected);
    });

    it('should handle empty strings', () => {
      const result = textSelection.normalizeText('');

      expect(result).toBe('');
    });

    it('should handle strings with only whitespace', () => {
      const input = '   \n\t  ';
      const expected = '';

      const result = textSelection.normalizeText(input);

      expect(result).toBe(expected);
    });
  });

  describe('validateSelection', () => {
    it('should validate a valid selection', () => {
      const para1 = document.getElementById('para1')!;
      const textNode = para1.firstChild as Text;

      mockRange.setStart(textNode, 5);
      mockRange.setEnd(textNode, 10);

      const result = textSelection.validateSelection(mockRange);

      expect(result).toBe(true);
    });

    it('should invalidate collapsed ranges', () => {
      const para1 = document.getElementById('para1')!;
      const textNode = para1.firstChild as Text;

      mockRange.setStart(textNode, 5);
      mockRange.setEnd(textNode, 5);

      const result = textSelection.validateSelection(mockRange);

      expect(result).toBe(false);
    });

    it('should invalidate ranges with no text content', () => {
      const emptyDiv = document.createElement('div');
      document.body.appendChild(emptyDiv);

      mockRange.selectNodeContents(emptyDiv);

      const result = textSelection.validateSelection(mockRange);

      expect(result).toBe(false);
    });

    it('should validate ranges across multiple nodes', () => {
      const para1 = document.getElementById('para1')!;
      const para2 = document.getElementById('para2')!;

      mockRange.setStart(para1.firstChild!, 0);
      mockRange.setEnd(para2.firstChild!, 5);

      const result = textSelection.validateSelection(mockRange);

      expect(result).toBe(true);
    });
  });

  describe('getSelectionContext', () => {
    it('should extract context around selection', () => {
      const para1 = document.getElementById('para1')!;
      const textNode = para1.firstChild as Text;

      mockRange.setStart(textNode, 17);
      mockRange.setEnd(textNode, 26);
      mockSelection.toString = jest.fn(() => 'paragraph');

      const result = textSelection.captureRange();

      expect(result).toBeDefined();
      expect(result?.contextBefore).toContain('first');
      expect(result?.contextAfter).toContain('with');
    });

    it('should handle context at text boundaries', () => {
      const para1 = document.getElementById('para1')!;
      const textNode = para1.firstChild as Text;

      mockRange.setStart(textNode, 0);
      mockRange.setEnd(textNode, 4);
      mockSelection.toString = jest.fn(() => 'This');

      const result = textSelection.captureRange();

      expect(result).toBeDefined();
      expect(result?.contextBefore).toBe('');
      expect(result?.contextAfter).toContain('is the');
    });
  });

  describe('performance', () => {
    it('should capture selection in less than 10ms', () => {
      const para1 = document.getElementById('para1')!;
      const textNode = para1.firstChild as Text;

      mockRange.setStart(textNode, 5);
      mockRange.setEnd(textNode, 10);
      mockSelection.toString = jest.fn(() => 'is th');

      const startTime = performance.now();
      textSelection.captureRange();
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(10);
    });

    it('should handle large selections efficiently', () => {
      // Create a large text content
      const largeText = 'Lorem ipsum '.repeat(1000);
      const largeDiv = document.createElement('div');
      largeDiv.textContent = largeText;
      document.body.appendChild(largeDiv);

      mockRange.selectNodeContents(largeDiv);
      mockSelection.toString = jest.fn(() => largeText);

      const startTime = performance.now();
      const result = textSelection.captureRange();
      const endTime = performance.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(50);
    });
  });

  describe('event handling', () => {
    it('should handle selectionchange events', () => {
      const listener = jest.fn();
      textSelection.addSelectionChangeListener(listener);

      // Trigger selection change event
      const event = new Event('selectionchange');
      document.dispatchEvent(event);

      // Wait for debounce
      setTimeout(() => {
        expect(listener).toHaveBeenCalled();
      }, 100);
    });

    it('should debounce rapid selection changes', () => {
      const listener = jest.fn();
      textSelection.addSelectionChangeListener(listener);

      // Trigger multiple rapid selection changes
      for (let i = 0; i < 10; i++) {
        const event = new Event('selectionchange');
        document.dispatchEvent(event);
      }

      // Wait for debounce
      setTimeout(() => {
        expect(listener).toHaveBeenCalledTimes(1);
      }, 200);
    });

    it('should clean up event listeners', () => {
      const listener = jest.fn();
      const cleanup = textSelection.addSelectionChangeListener(listener);

      cleanup();

      const event = new Event('selectionchange');
      document.dispatchEvent(event);

      setTimeout(() => {
        expect(listener).not.toHaveBeenCalled();
      }, 100);
    });
  });

  describe('browser compatibility', () => {
    it('should handle missing getSelection gracefully', () => {
      Object.defineProperty(window, 'getSelection', {
        value: undefined,
        writable: true,
      });

      const result = textSelection.captureRange();

      expect(result).toBeNull();
    });

    it('should handle selection with no ranges', () => {
      mockSelection._rangeCount = 0;

      const result = textSelection.captureRange();

      expect(result).toBeNull();
    });
  });
});
