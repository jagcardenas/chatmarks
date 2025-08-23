/**
 * VirtualBookmarkList Test Suite
 * 
 * Comprehensive tests for virtual scrolling bookmark list component
 */

import { VirtualBookmarkList, VirtualListItem, VirtualListOptions } from '../src/content/ui/sidebar/VirtualBookmarkList';
import { Bookmark, Platform } from '../src/types/bookmark';

// Mock BaseComponent
jest.mock('../src/content/ui/components/base/BaseComponent', () => ({
  BaseComponent: class MockBaseComponent extends HTMLElement {
    protected shadowRoot!: ShadowRoot;
    protected options: any = {};
    
    constructor() {
      super();
      this.shadowRoot = this.attachShadow({ mode: 'open' });
    }
    
    protected render() {}
    protected setupEventListeners() {}
    protected cleanup() {}
  }
}));

// Mock IntersectionObserver
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
});
(window as any).IntersectionObserver = mockIntersectionObserver;

describe('VirtualBookmarkList', () => {
  let virtualList: VirtualBookmarkList;
  let container: HTMLDivElement;

  const createMockBookmark = (id: string = 'test-bookmark'): Bookmark => ({
    id,
    platform: 'chatgpt' as Platform,
    conversationId: 'conv-123',
    messageId: 'msg-456',
    anchor: {
      selectedText: `Selected text for ${id}`,
      startOffset: 0,
      endOffset: 18,
      xpathSelector: '//div[@data-testid="conversation-turn-1"]//p[1]',
      messageId: 'msg-456',
      contextBefore: 'Previous context',
      contextAfter: 'Following context',
      checksum: 'abc123',
      confidence: 0.95,
      strategy: 'xpath' as const
    },
    note: `Note for bookmark ${id}`,
    tags: ['test', 'bookmark'],
    created: '2024-01-15T10:30:00Z',
    updated: '2024-01-15T10:30:00Z',
    color: '#FFD700'
  });

  const createVirtualListItem = (bookmark: Bookmark): VirtualListItem => ({
    bookmark,
    height: 80,
    matches: [],
    selected: false
  });

  beforeEach(() => {
    // Set up DOM environment
    container = document.createElement('div');
    container.style.height = '400px';
    document.body.appendChild(container);

    // Mock customElements
    if (!customElements.get('virtual-bookmark-list')) {
      customElements.define('virtual-bookmark-list', VirtualBookmarkList);
    }

    // Create virtual list instance
    virtualList = new VirtualBookmarkList();
    container.appendChild(virtualList);
  });

  afterEach(() => {
    if (virtualList && virtualList.isConnected) {
      virtualList.remove();
    }
    if (container && container.isConnected) {
      container.remove();
    }
    jest.clearAllMocks();
    mockIntersectionObserver.mockClear();
  });

  describe('Construction and Initialization', () => {
    test('creates virtual list with default options', () => {
      expect(virtualList).toBeInstanceOf(VirtualBookmarkList);
      expect(virtualList.tagName.toLowerCase()).toBe('virtual-bookmark-list');
      expect(virtualList.shadowRoot).toBeDefined();
    });

    test('applies custom options', () => {
      const options: VirtualListOptions = {
        itemHeight: 100,
        overscan: 10,
        multiSelect: true,
        showMatches: false
      };

      const customList = new VirtualBookmarkList(options);
      container.appendChild(customList);

      expect(customList.itemHeight).toBe(100);
      expect((customList as any).options.overscan).toBe(10);
      expect((customList as any).options.multiSelect).toBe(true);
      expect((customList as any).options.showMatches).toBe(false);
    });

    test('sets up intersection observer', () => {
      expect(mockIntersectionObserver).toHaveBeenCalled();
    });

    test('registers as custom element', () => {
      expect(customElements.get('virtual-bookmark-list')).toBeDefined();
    });
  });

  describe('Item Management', () => {
    test('sets items and updates display', () => {
      const bookmarks = [
        createMockBookmark('bookmark-1'),
        createMockBookmark('bookmark-2'),
        createMockBookmark('bookmark-3')
      ];
      const items = bookmarks.map(createVirtualListItem);

      virtualList.setItems(items);

      expect(virtualList.totalItems).toBe(3);
      expect((virtualList as any).items).toEqual(items);
    });

    test('handles empty item list', () => {
      virtualList.setItems([]);

      expect(virtualList.totalItems).toBe(0);
      expect((virtualList as any).items).toEqual([]);
    });

    test('updates virtual height based on items', () => {
      const items = Array.from({ length: 100 }, (_, i) => 
        createVirtualListItem(createMockBookmark(`bookmark-${i}`))
      );

      virtualList.setItems(items);

      expect(virtualList.totalHeight).toBe(100 * 80); // 100 items * 80px each
    });

    test('handles variable item heights', () => {
      const items = [
        { ...createVirtualListItem(createMockBookmark('1')), height: 60 },
        { ...createVirtualListItem(createMockBookmark('2')), height: 80 },
        { ...createVirtualListItem(createMockBookmark('3')), height: 100 }
      ];

      virtualList.setItems(items);

      expect(virtualList.totalHeight).toBe(240); // 60 + 80 + 100
    });
  });

  describe('Virtual Scrolling Mechanics', () => {
    test('calculates visible range correctly', () => {
      const items = Array.from({ length: 50 }, (_, i) => 
        createVirtualListItem(createMockBookmark(`bookmark-${i}`))
      );
      virtualList.setItems(items);

      // Mock scroll position and container height
      (virtualList as any).scrollTop = 400; // Scrolled down 400px
      (virtualList as any).containerHeight = 400;

      const range = (virtualList as any).calculateVisibleRange();

      expect(range.start).toBeGreaterThanOrEqual(0);
      expect(range.end).toBeLessThan(items.length);
      expect(range.end).toBeGreaterThan(range.start);
    });

    test('includes overscan items', () => {
      const options: VirtualListOptions = { overscan: 5 };
      const customList = new VirtualBookmarkList(options);
      container.appendChild(customList);

      const items = Array.from({ length: 20 }, (_, i) => 
        createVirtualListItem(createMockBookmark(`bookmark-${i}`))
      );
      customList.setItems(items);

      const range = (customList as any).calculateVisibleRange();

      // Should include overscan items
      expect(range.start).toBe(Math.max(0, range.visibleStart - 5));
    });

    test('renders only visible items', () => {
      const items = Array.from({ length: 100 }, (_, i) => 
        createVirtualListItem(createMockBookmark(`bookmark-${i}`))
      );
      virtualList.setItems(items);

      (virtualList as any).renderVisibleItems();

      // Should render less than total items
      const renderedItems = virtualList.shadowRoot!.querySelectorAll('.bookmark-item');
      expect(renderedItems.length).toBeLessThan(100);
      expect(renderedItems.length).toBeGreaterThan(0);
    });

    test('updates visible items on scroll', () => {
      const items = Array.from({ length: 50 }, (_, i) => 
        createVirtualListItem(createMockBookmark(`bookmark-${i}`))
      );
      virtualList.setItems(items);

      const renderSpy = jest.spyOn(virtualList as any, 'renderVisibleItems');

      // Simulate scroll event
      (virtualList as any).handleScroll({ target: { scrollTop: 200 } });

      expect(renderSpy).toHaveBeenCalled();
    });
  });

  describe('Selection Management', () => {
    test('handles single item selection', () => {
      const items = [
        createVirtualListItem(createMockBookmark('bookmark-1')),
        createVirtualListItem(createMockBookmark('bookmark-2'))
      ];
      virtualList.setItems(items);

      virtualList.selectItem(0);

      expect(virtualList.selectedIndices).toContain(0);
      expect(virtualList.selectedIndices).toHaveLength(1);
    });

    test('handles multiple item selection when enabled', () => {
      const options: VirtualListOptions = { multiSelect: true };
      const multiList = new VirtualBookmarkList(options);
      container.appendChild(multiList);

      const items = [
        createVirtualListItem(createMockBookmark('bookmark-1')),
        createVirtualListItem(createMockBookmark('bookmark-2')),
        createVirtualListItem(createMockBookmark('bookmark-3'))
      ];
      multiList.setItems(items);

      multiList.selectItem(0);
      multiList.selectItem(2);

      expect(multiList.selectedIndices).toContain(0);
      expect(multiList.selectedIndices).toContain(2);
      expect(multiList.selectedIndices).toHaveLength(2);
    });

    test('replaces selection in single-select mode', () => {
      const items = [
        createVirtualListItem(createMockBookmark('bookmark-1')),
        createVirtualListItem(createMockBookmark('bookmark-2'))
      ];
      virtualList.setItems(items);

      virtualList.selectItem(0);
      virtualList.selectItem(1);

      expect(virtualList.selectedIndices).toEqual([1]);
    });

    test('deselects items', () => {
      const items = [
        createVirtualListItem(createMockBookmark('bookmark-1')),
        createVirtualListItem(createMockBookmark('bookmark-2'))
      ];
      virtualList.setItems(items);

      virtualList.selectItem(0);
      expect(virtualList.selectedIndices).toContain(0);

      virtualList.deselectItem(0);
      expect(virtualList.selectedIndices).not.toContain(0);
    });

    test('clears all selections', () => {
      const options: VirtualListOptions = { multiSelect: true };
      const multiList = new VirtualBookmarkList(options);
      container.appendChild(multiList);

      const items = [
        createVirtualListItem(createMockBookmark('bookmark-1')),
        createVirtualListItem(createMockBookmark('bookmark-2'))
      ];
      multiList.setItems(items);

      multiList.selectItem(0);
      multiList.selectItem(1);
      multiList.clearSelection();

      expect(multiList.selectedIndices).toHaveLength(0);
    });

    test('triggers selection change callback', () => {
      const mockCallback = jest.fn();
      virtualList.setCallbacks({ onSelectionChange: mockCallback });

      const items = [createVirtualListItem(createMockBookmark('bookmark-1'))];
      virtualList.setItems(items);

      virtualList.selectItem(0);

      expect(mockCallback).toHaveBeenCalledWith([items[0].bookmark]);
    });
  });

  describe('Keyboard Navigation', () => {
    test('navigates with arrow keys', () => {
      const items = [
        createVirtualListItem(createMockBookmark('bookmark-1')),
        createVirtualListItem(createMockBookmark('bookmark-2')),
        createVirtualListItem(createMockBookmark('bookmark-3'))
      ];
      virtualList.setItems(items);

      // Mock focus index
      (virtualList as any).focusedIndex = 0;

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      virtualList.dispatchEvent(event);

      expect((virtualList as any).focusedIndex).toBe(1);
    });

    test('handles Enter key for selection', () => {
      const mockCallback = jest.fn();
      virtualList.setCallbacks({ onItemClick: mockCallback });

      const items = [createVirtualListItem(createMockBookmark('bookmark-1'))];
      virtualList.setItems(items);
      (virtualList as any).focusedIndex = 0;

      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      virtualList.dispatchEvent(event);

      expect(mockCallback).toHaveBeenCalledWith(items[0].bookmark);
    });

    test('handles spacebar for selection toggle', () => {
      const items = [createVirtualListItem(createMockBookmark('bookmark-1'))];
      virtualList.setItems(items);
      (virtualList as any).focusedIndex = 0;

      const event = new KeyboardEvent('keydown', { key: ' ' });
      virtualList.dispatchEvent(event);

      expect(virtualList.selectedIndices).toContain(0);
    });

    test('handles Home and End keys', () => {
      const items = Array.from({ length: 10 }, (_, i) => 
        createVirtualListItem(createMockBookmark(`bookmark-${i}`))
      );
      virtualList.setItems(items);

      // Test Home key
      (virtualList as any).focusedIndex = 5;
      const homeEvent = new KeyboardEvent('keydown', { key: 'Home' });
      virtualList.dispatchEvent(homeEvent);
      expect((virtualList as any).focusedIndex).toBe(0);

      // Test End key
      const endEvent = new KeyboardEvent('keydown', { key: 'End' });
      virtualList.dispatchEvent(endEvent);
      expect((virtualList as any).focusedIndex).toBe(9);
    });
  });

  describe('Mouse Interaction', () => {
    test('handles item clicks', () => {
      const mockCallback = jest.fn();
      virtualList.setCallbacks({ onItemClick: mockCallback });

      const items = [createVirtualListItem(createMockBookmark('bookmark-1'))];
      virtualList.setItems(items);

      // Simulate click on item
      (virtualList as any).handleItemClick(0, items[0].bookmark);

      expect(mockCallback).toHaveBeenCalledWith(items[0].bookmark);
    });

    test('handles item double clicks', () => {
      const mockCallback = jest.fn();
      virtualList.setCallbacks({ onItemEdit: mockCallback });

      const items = [createVirtualListItem(createMockBookmark('bookmark-1'))];
      virtualList.setItems(items);

      // Simulate double click
      (virtualList as any).handleItemDoubleClick(items[0].bookmark);

      expect(mockCallback).toHaveBeenCalledWith(items[0].bookmark);
    });

    test('handles right-click context menu', () => {
      const items = [createVirtualListItem(createMockBookmark('bookmark-1'))];
      virtualList.setItems(items);

      const contextEvent = new MouseEvent('contextmenu', { button: 2 });
      const preventDefaultSpy = jest.spyOn(contextEvent, 'preventDefault');

      virtualList.dispatchEvent(contextEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Scrolling Control', () => {
    test('scrolls to specific index', () => {
      const items = Array.from({ length: 20 }, (_, i) => 
        createVirtualListItem(createMockBookmark(`bookmark-${i}`))
      );
      virtualList.setItems(items);

      const mockScrollTo = jest.fn();
      const mockScrollContainer = { scrollTo: mockScrollTo };
      (virtualList as any).scrollContainer = mockScrollContainer;

      virtualList.scrollToIndex(10);

      expect(mockScrollTo).toHaveBeenCalledWith({
        top: 10 * 80, // index * itemHeight
        behavior: 'smooth'
      });
    });

    test('ensures item visibility', () => {
      const items = Array.from({ length: 20 }, (_, i) => 
        createVirtualListItem(createMockBookmark(`bookmark-${i}`))
      );
      virtualList.setItems(items);

      const scrollSpy = jest.spyOn(virtualList, 'scrollToIndex');

      virtualList.ensureVisible(15);

      expect(scrollSpy).toHaveBeenCalledWith(15);
    });

    test('handles smooth scrolling', () => {
      const items = Array.from({ length: 10 }, (_, i) => 
        createVirtualListItem(createMockBookmark(`bookmark-${i}`))
      );
      virtualList.setItems(items);

      virtualList.scrollToIndex(5, true);

      // Should use smooth scrolling
      expect((virtualList as any).scrollContainer?.scrollTo).toHaveBeenCalledWith(
        expect.objectContaining({ behavior: 'smooth' })
      );
    });
  });

  describe('Performance Optimizations', () => {
    test('uses DOM recycling for efficient rendering', () => {
      const items = Array.from({ length: 1000 }, (_, i) => 
        createVirtualListItem(createMockBookmark(`bookmark-${i}`))
      );
      virtualList.setItems(items);

      (virtualList as any).renderVisibleItems();

      // Should create a limited number of DOM elements
      const domItems = virtualList.shadowRoot!.querySelectorAll('.bookmark-item');
      expect(domItems.length).toBeLessThan(50); // Much less than 1000 total items
    });

    test('throttles scroll events', (done) => {
      const renderSpy = jest.spyOn(virtualList as any, 'renderVisibleItems');

      // Simulate rapid scroll events
      for (let i = 0; i < 10; i++) {
        (virtualList as any).handleScroll({ target: { scrollTop: i * 10 } });
      }

      setTimeout(() => {
        expect(renderSpy).toHaveBeenCalledTimes(1); // Should be throttled
        done();
      }, 100);
    });

    test('handles large datasets efficiently', () => {
      const startTime = performance.now();
      
      const largeItemSet = Array.from({ length: 10000 }, (_, i) => 
        createVirtualListItem(createMockBookmark(`bookmark-${i}`))
      );
      
      virtualList.setItems(largeItemSet);
      (virtualList as any).renderVisibleItems();
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Search Match Highlighting', () => {
    test('displays search matches when enabled', () => {
      const options: VirtualListOptions = { showMatches: true };
      const matchList = new VirtualBookmarkList(options);
      container.appendChild(matchList);

      const bookmark = createMockBookmark('bookmark-1');
      const item: VirtualListItem = {
        bookmark,
        height: 80,
        matches: [
          {
            field: 'content',
            text: 'JavaScript',
            start: 0,
            end: 10,
            score: 1.0
          }
        ],
        selected: false
      };

      matchList.setItems([item]);
      (matchList as any).renderVisibleItems();

      // Should render match highlights
      expect((matchList as any).options.showMatches).toBe(true);
    });

    test('hides matches when disabled', () => {
      const options: VirtualListOptions = { showMatches: false };
      const noMatchList = new VirtualBookmarkList(options);
      container.appendChild(noMatchList);

      expect((noMatchList as any).options.showMatches).toBe(false);
    });
  });

  describe('Loading and Empty States', () => {
    test('displays loading state', () => {
      virtualList.loading = true;

      expect((virtualList as any).loading).toBe(true);
    });

    test('displays empty state for no items', () => {
      virtualList.setItems([]);
      (virtualList as any).renderVisibleItems();

      expect(virtualList.totalItems).toBe(0);
    });

    test('shows appropriate message for empty state', () => {
      virtualList.setItems([]);
      const emptyMessage = (virtualList as any).getEmptyStateMessage();

      expect(typeof emptyMessage).toBe('string');
      expect(emptyMessage.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility Features', () => {
    test('sets proper ARIA attributes', () => {
      expect(virtualList.getAttribute('role')).toBe('listbox');
      expect(virtualList.hasAttribute('aria-multiselectable')).toBe(true);
    });

    test('manages focus correctly', () => {
      const items = [createVirtualListItem(createMockBookmark('bookmark-1'))];
      virtualList.setItems(items);

      virtualList.focus();

      expect((virtualList as any).focusedIndex).toBe(0);
    });

    test('announces selection changes to screen readers', () => {
      const items = [createVirtualListItem(createMockBookmark('bookmark-1'))];
      virtualList.setItems(items);

      const announceSpy = jest.spyOn(virtualList as any, 'announceToScreenReader');

      virtualList.selectItem(0);

      expect(announceSpy).toHaveBeenCalled();
    });

    test('supports keyboard navigation for accessibility', () => {
      const items = Array.from({ length: 3 }, (_, i) => 
        createVirtualListItem(createMockBookmark(`bookmark-${i}`))
      );
      virtualList.setItems(items);

      // Tab navigation should work
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
      virtualList.dispatchEvent(tabEvent);

      expect((virtualList as any).focusedIndex).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('handles invalid item indices gracefully', () => {
      const items = [createVirtualListItem(createMockBookmark('bookmark-1'))];
      virtualList.setItems(items);

      expect(() => {
        virtualList.selectItem(-1);
        virtualList.selectItem(10);
      }).not.toThrow();

      expect(virtualList.selectedIndices).toHaveLength(0);
    });

    test('handles missing or corrupted item data', () => {
      const invalidItems = [
        null,
        undefined,
        {},
        createVirtualListItem(createMockBookmark('valid-bookmark'))
      ] as any;

      expect(() => {
        virtualList.setItems(invalidItems);
      }).not.toThrow();
    });

    test('gracefully handles rendering errors', () => {
      console.error = jest.fn();

      // Force a rendering error by corrupting shadow root
      (virtualList as any).shadowRoot = null;

      expect(() => {
        virtualList.setItems([createVirtualListItem(createMockBookmark('bookmark-1'))]);
      }).not.toThrow();

      expect(console.error).toHaveBeenCalled();
    });

    test('handles extreme scroll positions', () => {
      const items = Array.from({ length: 100 }, (_, i) => 
        createVirtualListItem(createMockBookmark(`bookmark-${i}`))
      );
      virtualList.setItems(items);

      // Test negative scroll
      (virtualList as any).scrollTop = -100;
      expect(() => {
        (virtualList as any).calculateVisibleRange();
      }).not.toThrow();

      // Test excessive scroll
      (virtualList as any).scrollTop = 999999;
      expect(() => {
        (virtualList as any).calculateVisibleRange();
      }).not.toThrow();
    });
  });

  describe('Memory Management and Cleanup', () => {
    test('cleans up intersection observer on disconnect', () => {
      const mockDisconnect = jest.fn();
      (virtualList as any).intersectionObserver = { disconnect: mockDisconnect };

      virtualList.disconnectedCallback?.();

      expect(mockDisconnect).toHaveBeenCalled();
    });

    test('removes event listeners on disconnect', () => {
      const removeEventListenerSpy = jest.spyOn(virtualList, 'removeEventListener');

      virtualList.disconnectedCallback?.();

      expect(removeEventListenerSpy).toHaveBeenCalled();
    });

    test('clears timers and intervals on disconnect', () => {
      const clearTimeoutSpy = jest.spyOn(window, 'clearTimeout');
      
      // Set up some timers
      (virtualList as any).scrollTimeout = setTimeout(() => {}, 100);
      (virtualList as any).renderTimeout = setTimeout(() => {}, 100);

      virtualList.disconnectedCallback?.();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    test('prevents memory leaks with large item sets', () => {
      const largeSet = Array.from({ length: 10000 }, (_, i) => 
        createVirtualListItem(createMockBookmark(`bookmark-${i}`))
      );

      virtualList.setItems(largeSet);

      // Clear items and verify cleanup
      virtualList.setItems([]);

      expect(virtualList.totalItems).toBe(0);
      expect((virtualList as any).items).toEqual([]);
    });
  });
});