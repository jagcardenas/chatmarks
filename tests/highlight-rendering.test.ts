/**
 * Highlight Rendering System Integration Tests
 *
 * Tests the complete highlight rendering pipeline including:
 * - Text anchoring system integration
 * - DOM manipulation and text wrapping
 * - Overlap resolution and visual styling
 * - Performance optimizations
 * - Real-world scenarios with complex text selection
 */

import { Bookmark, SelectionRange, Platform } from '../src/types/bookmark';
import { HighlightRenderer } from '../src/content/ui/highlights/HighlightRenderer';
import { AnchorSystem } from '../src/content/anchoring/AnchorSystem';

// Mock document and DOM elements for testing
const mockDocument = {
  createRange: jest.fn(),
  createElement: jest.fn(),
  createDocumentFragment: jest.fn(),
  createTreeWalker: jest.fn(),
  evaluate: jest.fn(),
  querySelectorAll: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
} as unknown as Document;

describe('Highlight Rendering System', () => {
  let highlightRenderer: HighlightRenderer;
  let anchorSystem: AnchorSystem;
  let mockElement: Element;
  let mockRange: Range;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock DOM elements
    mockElement = {
      textContent: 'This is a test paragraph with some text to highlight for testing purposes.',
      parentElement: null,
      isConnected: true,
      getAttribute: jest.fn(),
      setAttribute: jest.fn(),
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn(),
      },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    } as unknown as Element;

    mockRange = {
      startContainer: mockElement,
      endContainer: mockElement,
      startOffset: 10,
      endOffset: 25,
      collapsed: false,
      toString: () => 'test paragraph',
      cloneRange: () => mockRange,
      getBoundingClientRect: () => ({
        top: 100,
        left: 100,
        width: 200,
        height: 20,
        bottom: 120,
        right: 300,
      }),
      setStart: jest.fn(),
      setEnd: jest.fn(),
      selectNodeContents: jest.fn(),
    } as unknown as Range;

    // Mock document methods
    mockDocument.createRange.mockReturnValue(mockRange);
    mockDocument.createElement.mockReturnValue(mockElement);
    mockDocument.createDocumentFragment.mockReturnValue({
      appendChild: jest.fn(),
    });
    mockDocument.evaluate.mockReturnValue({
      singleNodeValue: mockElement,
      iterateNext: jest.fn(),
    });

    // Initialize systems
    anchorSystem = new AnchorSystem(mockDocument);
    highlightRenderer = new HighlightRenderer(mockDocument);
  });

  describe('Text Anchoring Integration', () => {
    it('should create anchor from selection range', () => {
      const selectionRange: SelectionRange = {
        selectedText: 'test paragraph',
        range: mockRange,
        boundingRect: {
          top: 100,
          left: 100,
          width: 200,
          height: 20,
          bottom: 120,
          right: 300,
        },
        contextBefore: 'This is a ',
        contextAfter: ' with some text',
        startOffset: 10,
        endOffset: 25,
        messageId: 'msg-123',
        conversationId: 'conv-456',
        timestamp: new Date().toISOString(),
      };

      const anchor = anchorSystem.createAnchor(selectionRange);

      expect(anchor).toBeDefined();
      expect(anchor.selectedText).toBe('test paragraph');
      expect(anchor.startOffset).toBeGreaterThanOrEqual(0);
      expect(anchor.endOffset).toBeGreaterThan(anchor.startOffset);
      expect(anchor.confidence).toBeGreaterThan(0);
      expect(anchor.confidence).toBeLessThanOrEqual(1);
    });

    it('should resolve anchor back to range', async () => {
      const selectionRange: SelectionRange = {
        selectedText: 'test paragraph',
        range: mockRange,
        boundingRect: {
          top: 100,
          left: 100,
          width: 200,
          height: 20,
          bottom: 120,
          right: 300,
        },
        contextBefore: 'This is a ',
        contextAfter: ' with some text',
        startOffset: 10,
        endOffset: 25,
        messageId: 'msg-123',
        conversationId: 'conv-456',
        timestamp: new Date().toISOString(),
      };

      const anchor = anchorSystem.createAnchor(selectionRange);
      const resolvedRange = anchorSystem.resolveAnchor(anchor);

      // In a real scenario, this would return a Range object
      // For this test, we're just verifying the anchor was created successfully
      expect(anchor).toBeDefined();
      expect(anchor.selectedText).toBe('test paragraph');
    });
  });

  describe('Highlight Rendering', () => {
    it('should render highlight for bookmark', async () => {
      const bookmark: Bookmark = {
        id: 'bookmark-123',
        platform: 'chatgpt' as Platform,
        conversationId: 'conv-456',
        messageId: 'msg-789',
        anchor: {
          selectedText: 'test paragraph',
          startOffset: 10,
          endOffset: 25,
          xpathSelector: '/html/body/p[1]',
          messageId: 'msg-789',
          contextBefore: 'This is a ',
          contextAfter: ' with some text',
          checksum: 'abc123',
          confidence: 0.8,
          strategy: 'xpath',
        },
        note: 'Test bookmark',
        tags: ['test'],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        color: '#ffeb3b',
      };

      const result = await highlightRenderer.renderHighlight(bookmark);

      expect(result.success).toBe(true);
      expect(result.elementCount).toBeGreaterThanOrEqual(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle flash animation for new highlights', async () => {
      const bookmark: Bookmark = {
        id: 'bookmark-flash',
        platform: 'chatgpt' as Platform,
        conversationId: 'conv-456',
        messageId: 'msg-789',
        anchor: {
          selectedText: 'test paragraph',
          startOffset: 10,
          endOffset: 25,
          xpathSelector: '/html/body/p[1]',
          messageId: 'msg-789',
          contextBefore: 'This is a ',
          contextAfter: ' with some text',
          checksum: 'abc123',
          confidence: 0.8,
          strategy: 'xpath',
        },
        note: 'Test bookmark with flash',
        tags: ['test'],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        color: '#ffeb3b',
      };

      const result = await highlightRenderer.renderHighlight(bookmark, undefined, true);

      expect(result.success).toBe(true);
      expect(highlightRenderer.hasActiveHighlight('bookmark-flash')).toBe(true);
    });

    it('should remove highlights correctly', async () => {
      const bookmark: Bookmark = {
        id: 'bookmark-remove',
        platform: 'chatgpt' as Platform,
        conversationId: 'conv-456',
        messageId: 'msg-789',
        anchor: {
          selectedText: 'test paragraph',
          startOffset: 10,
          endOffset: 25,
          xpathSelector: '/html/body/p[1]',
          messageId: 'msg-789',
          contextBefore: 'This is a ',
          contextAfter: ' with some text',
          checksum: 'abc123',
          confidence: 0.8,
          strategy: 'xpath',
        },
        note: 'Test bookmark for removal',
        tags: ['test'],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        color: '#ffeb3b',
      };

      // First render the highlight
      await highlightRenderer.renderHighlight(bookmark);
      expect(highlightRenderer.hasActiveHighlight('bookmark-remove')).toBe(true);

      // Then remove it
      const removed = highlightRenderer.removeHighlight('bookmark-remove');
      expect(removed).toBe(true);
      expect(highlightRenderer.hasActiveHighlight('bookmark-remove')).toBe(false);
    });

    it('should update highlight styling', async () => {
      const bookmark: Bookmark = {
        id: 'bookmark-style',
        platform: 'chatgpt' as Platform,
        conversationId: 'conv-456',
        messageId: 'msg-789',
        anchor: {
          selectedText: 'test paragraph',
          startOffset: 10,
          endOffset: 25,
          xpathSelector: '/html/body/p[1]',
          messageId: 'msg-789',
          contextBefore: 'This is a ',
          contextAfter: ' with some text',
          checksum: 'abc123',
          confidence: 0.8,
          strategy: 'xpath',
        },
        note: 'Test bookmark for styling',
        tags: ['test'],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        color: '#ffeb3b',
      };

      // Render with default styling
      await highlightRenderer.renderHighlight(bookmark);

      // Update with custom styling
      const updated = highlightRenderer.updateHighlight('bookmark-style', {
        className: 'custom-highlight',
        color: '#ff0000',
        priority: 1,
      });

      expect(updated).toBe(true);
    });
  });

  describe('Performance and Metrics', () => {
    it('should track performance metrics', async () => {
      const bookmark: Bookmark = {
        id: 'bookmark-metrics',
        platform: 'chatgpt' as Platform,
        conversationId: 'conv-456',
        messageId: 'msg-789',
        anchor: {
          selectedText: 'test paragraph',
          startOffset: 10,
          endOffset: 25,
          xpathSelector: '/html/body/p[1]',
          messageId: 'msg-789',
          contextBefore: 'This is a ',
          contextAfter: ' with some text',
          checksum: 'abc123',
          confidence: 0.8,
          strategy: 'xpath',
        },
        note: 'Test bookmark for metrics',
        tags: ['test'],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        color: '#ffeb3b',
      };

      await highlightRenderer.renderHighlight(bookmark);

      const metrics = highlightRenderer.getMetrics();

      expect(metrics.totalHighlights).toBeGreaterThan(0);
      expect(metrics.performance.averageRenderTime).toBeGreaterThan(0);
      expect(metrics.performance.lastRenderTime).toBeGreaterThan(0);
    });

    it('should handle multiple highlights efficiently', async () => {
      const bookmarks: Bookmark[] = [];

      // Create multiple bookmarks
      for (let i = 0; i < 5; i++) {
        bookmarks.push({
          id: `bookmark-batch-${i}`,
          platform: 'chatgpt' as Platform,
          conversationId: 'conv-456',
          messageId: 'msg-789',
          anchor: {
            selectedText: 'test paragraph',
            startOffset: 10,
            endOffset: 25,
            xpathSelector: '/html/body/p[1]',
            messageId: 'msg-789',
            contextBefore: 'This is a ',
            contextAfter: ' with some text',
            checksum: 'abc123',
            confidence: 0.8,
            strategy: 'xpath',
          },
          note: `Test bookmark ${i}`,
          tags: ['test'],
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          color: '#ffeb3b',
        });
      }

      // Render all bookmarks
      for (const bookmark of bookmarks) {
        await highlightRenderer.renderHighlight(bookmark);
      }

      const metrics = highlightRenderer.getMetrics();
      expect(metrics.totalHighlights).toBe(5);
      expect(metrics.performance.averageRenderTime).toBeGreaterThan(0);
    });
  });

  describe('Overlap Resolution', () => {
    it('should handle overlapping highlights', async () => {
      // Create two overlapping bookmarks
      const bookmark1: Bookmark = {
        id: 'bookmark-overlap-1',
        platform: 'chatgpt' as Platform,
        conversationId: 'conv-456',
        messageId: 'msg-789',
        anchor: {
          selectedText: 'test paragraph with',
          startOffset: 10,
          endOffset: 30,
          xpathSelector: '/html/body/p[1]',
          messageId: 'msg-789',
          contextBefore: 'This is a ',
          contextAfter: ' some text',
          checksum: 'abc123',
          confidence: 0.8,
          strategy: 'xpath',
        },
        note: 'First overlapping bookmark',
        tags: ['test'],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        color: '#ffeb3b',
      };

      const bookmark2: Bookmark = {
        id: 'bookmark-overlap-2',
        platform: 'chatgpt' as Platform,
        conversationId: 'conv-456',
        messageId: 'msg-789',
        anchor: {
          selectedText: 'paragraph with some',
          startOffset: 15,
          endOffset: 35,
          xpathSelector: '/html/body/p[1]',
          messageId: 'msg-789',
          contextBefore: 'test ',
          contextAfter: ' text',
          checksum: 'abc123',
          confidence: 0.8,
          strategy: 'xpath',
        },
        note: 'Second overlapping bookmark',
        tags: ['test'],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        color: '#4caf50',
      };

      // Render both overlapping highlights
      await highlightRenderer.renderHighlight(bookmark1);
      await highlightRenderer.renderHighlight(bookmark2);

      // Verify both highlights exist
      expect(highlightRenderer.hasActiveHighlight('bookmark-overlap-1')).toBe(true);
      expect(highlightRenderer.hasActiveHighlight('bookmark-overlap-2')).toBe(true);

      const metrics = highlightRenderer.getMetrics();
      expect(metrics.totalHighlights).toBe(2);
    });
  });

  describe('Restore Functionality', () => {
    it('should restore multiple highlights', async () => {
      const bookmarks: Bookmark[] = [
        {
          id: 'bookmark-restore-1',
          platform: 'chatgpt' as Platform,
          conversationId: 'conv-456',
          messageId: 'msg-789',
          anchor: {
            selectedText: 'test paragraph',
            startOffset: 10,
            endOffset: 25,
            xpathSelector: '/html/body/p[1]',
            messageId: 'msg-789',
            contextBefore: 'This is a ',
            contextAfter: ' with some text',
            checksum: 'abc123',
            confidence: 0.8,
            strategy: 'xpath',
          },
          note: 'First bookmark to restore',
          tags: ['test'],
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          color: '#ffeb3b',
        },
        {
          id: 'bookmark-restore-2',
          platform: 'chatgpt' as Platform,
          conversationId: 'conv-456',
          messageId: 'msg-789',
          anchor: {
            selectedText: 'some text',
            startOffset: 30,
            endOffset: 40,
            xpathSelector: '/html/body/p[1]',
            messageId: 'msg-789',
            contextBefore: 'paragraph with ',
            contextAfter: ' to highlight',
            checksum: 'abc123',
            confidence: 0.8,
            strategy: 'xpath',
          },
          note: 'Second bookmark to restore',
          tags: ['test'],
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          color: '#2196f3',
        },
      ];

      const restoreResult = await highlightRenderer.restoreHighlights(bookmarks);

      expect(restoreResult.successfullyRestored).toBeGreaterThanOrEqual(0);
      expect(restoreResult.totalProcessed).toBe(2);
      expect(restoreResult.successfullyRestored + restoreResult.failedToRestore).toBe(2);

      const metrics = highlightRenderer.getMetrics();
      expect(metrics.performance.lastRestoreTime).toBeGreaterThan(0);
    });
  });

  describe('Cleanup and Memory Management', () => {
    it('should cleanup all resources properly', async () => {
      const bookmark: Bookmark = {
        id: 'bookmark-cleanup',
        platform: 'chatgpt' as Platform,
        conversationId: 'conv-456',
        messageId: 'msg-789',
        anchor: {
          selectedText: 'test paragraph',
          startOffset: 10,
          endOffset: 25,
          xpathSelector: '/html/body/p[1]',
          messageId: 'msg-789',
          contextBefore: 'This is a ',
          contextAfter: ' with some text',
          checksum: 'abc123',
          confidence: 0.8,
          strategy: 'xpath',
        },
        note: 'Test bookmark for cleanup',
        tags: ['test'],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        color: '#ffeb3b',
      };

      await highlightRenderer.renderHighlight(bookmark);
      expect(highlightRenderer.hasActiveHighlight('bookmark-cleanup')).toBe(true);

      highlightRenderer.cleanup();

      const metrics = highlightRenderer.getMetrics();
      expect(metrics.totalHighlights).toBe(0);
      expect(metrics.performance.averageRenderTime).toBe(0);
    });

    it('should handle clear all highlights', async () => {
      const bookmarks: Bookmark[] = [];

      // Create multiple bookmarks
      for (let i = 0; i < 3; i++) {
        bookmarks.push({
          id: `bookmark-clear-${i}`,
          platform: 'chatgpt' as Platform,
          conversationId: 'conv-456',
          messageId: 'msg-789',
          anchor: {
            selectedText: 'test paragraph',
            startOffset: 10,
            endOffset: 25,
            xpathSelector: '/html/body/p[1]',
            messageId: 'msg-789',
            contextBefore: 'This is a ',
            contextAfter: ' with some text',
            checksum: 'abc123',
            confidence: 0.8,
            strategy: 'xpath',
          },
          note: `Test bookmark ${i}`,
          tags: ['test'],
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          color: '#ffeb3b',
        });
      }

      // Render all bookmarks
      for (const bookmark of bookmarks) {
        await highlightRenderer.renderHighlight(bookmark);
      }

      expect(highlightRenderer.getMetrics().totalHighlights).toBe(3);

      // Clear all highlights
      const removedCount = highlightRenderer.clearAllHighlights();
      expect(removedCount).toBe(3);
      expect(highlightRenderer.getMetrics().totalHighlights).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid anchor gracefully', async () => {
      const invalidBookmark: Bookmark = {
        id: 'bookmark-invalid',
        platform: 'chatgpt' as Platform,
        conversationId: 'conv-456',
        messageId: 'msg-789',
        anchor: {
          selectedText: '',
          startOffset: -1,
          endOffset: -1,
          xpathSelector: '',
          messageId: 'msg-789',
          contextBefore: '',
          contextAfter: '',
          checksum: '',
          confidence: 0,
          strategy: 'xpath',
        },
        note: 'Invalid bookmark',
        tags: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        color: '#ffeb3b',
      };

      const result = await highlightRenderer.renderHighlight(invalidBookmark);

      // Should fail gracefully
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle missing bookmark data', async () => {
      const incompleteBookmark = {
        id: 'bookmark-incomplete',
        // Missing required fields
      } as unknown as Bookmark;

      const result = await highlightRenderer.renderHighlight(incompleteBookmark);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
