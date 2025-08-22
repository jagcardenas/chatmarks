/**
 * BookmarkSidebar Test Suite
 * 
 * Comprehensive tests for the main sidebar web component
 */

import { BookmarkSidebar, BookmarkSidebarOptions, BookmarkFilters } from '../src/content/ui/sidebar/BookmarkSidebar';
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

describe('BookmarkSidebar', () => {
  let sidebar: BookmarkSidebar;
  let container: HTMLDivElement;

  const createMockBookmark = (id: string = 'test-bookmark'): Bookmark => ({
    id,
    platform: 'chatgpt' as Platform,
    conversationId: 'conv-123',
    messageId: 'msg-456',
    anchor: {
      selectedText: 'Test selected text',
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
    note: 'Test bookmark note',
    tags: ['test', 'important'],
    created: '2024-01-15T10:30:00Z',
    updated: '2024-01-15T10:30:00Z',
    color: '#FFD700'
  });

  beforeEach(() => {
    // Set up DOM environment
    container = document.createElement('div');
    document.body.appendChild(container);

    // Mock customElements
    if (!customElements.get('bookmark-sidebar')) {
      customElements.define('bookmark-sidebar', BookmarkSidebar);
    }

    // Create sidebar instance
    sidebar = new BookmarkSidebar();
    container.appendChild(sidebar);
  });

  afterEach(() => {
    if (sidebar && sidebar.isConnected) {
      sidebar.remove();
    }
    if (container && container.isConnected) {
      container.remove();
    }
    jest.clearAllMocks();
  });

  describe('Construction and Initialization', () => {
    test('creates sidebar with default options', () => {
      expect(sidebar).toBeInstanceOf(BookmarkSidebar);
      expect(sidebar.tagName.toLowerCase()).toBe('bookmark-sidebar');
      expect(sidebar.shadowRoot).toBeDefined();
    });

    test('applies initial configuration options', () => {
      const options: BookmarkSidebarOptions = {
        position: 'left',
        width: 320,
        collapsible: true,
        resizable: false,
        showSearch: true,
        showFilters: true,
        maxHeight: 800,
        theme: 'dark'
      };

      const customSidebar = new BookmarkSidebar();
      container.appendChild(customSidebar);

      expect(customSidebar).toBeDefined();
      expect(customSidebar.tagName.toLowerCase()).toBe('bookmark-sidebar');
    });

    test('registers as custom element', () => {
      expect(customElements.get('bookmark-sidebar')).toBeDefined();
    });
  });

  describe('Visibility Management', () => {
    test('shows sidebar with animation', async () => {
      sidebar.hide(); // Start hidden
      
      sidebar.show();
      
      expect(sidebar.classList.contains('visible')).toBe(true);
    });

    test('hides sidebar with animation', async () => {
      sidebar.show(); // Start visible
      
      sidebar.hide();
      
      expect(sidebar.classList.contains('visible')).toBe(false);
    });

    test('toggles visibility state', () => {
      expect(sidebar.classList.contains('visible')).toBe(false);
      
      sidebar.toggle();
      expect(sidebar.classList.contains('visible')).toBe(true);
      
      sidebar.toggle();
      expect(sidebar.classList.contains('visible')).toBe(false);
    });

    test('respects collapsed state', () => {
      sidebar.collapsed = true;
      sidebar.show();
      
      expect(sidebar.classList.contains('collapsed')).toBe(true);
    });
  });

  describe('Bookmark Management', () => {
    test('updates bookmark list display', () => {
      const bookmarks = [
        createMockBookmark('1'),
        createMockBookmark('2')
      ];
      
      sidebar.updateBookmarkList(bookmarks);
      
      // Verify internal state update
      expect((sidebar as any).bookmarks).toHaveLength(2);
    });

    test('handles empty bookmark list', () => {
      sidebar.updateBookmarkList([]);
      
      expect((sidebar as any).bookmarks).toHaveLength(0);
    });

    test('maintains bookmark order', () => {
      const bookmarks = [
        createMockBookmark('first'),
        createMockBookmark('second'),
        createMockBookmark('third')
      ];
      
      sidebar.updateBookmarkList(bookmarks);
      
      const stored = (sidebar as any).bookmarks;
      expect(stored[0].id).toBe('first');
      expect(stored[1].id).toBe('second');
      expect(stored[2].id).toBe('third');
    });
  });

  describe('Search Functionality', () => {
    test('handles search input changes', () => {
      const mockCallback = jest.fn();
      sidebar.setCallbacks({ onSearchChange: mockCallback });
      
      // Simulate search input
      (sidebar as any).handleSearchInput({ target: { value: 'test query' } });
      
      expect(mockCallback).toHaveBeenCalledWith('test query');
    });

    test('debounces search input for performance', (done) => {
      const mockCallback = jest.fn();
      sidebar.setCallbacks({ onSearchChange: mockCallback });
      
      // Rapid search inputs
      (sidebar as any).handleSearchInput({ target: { value: 'a' } });
      (sidebar as any).handleSearchInput({ target: { value: 'ab' } });
      (sidebar as any).handleSearchInput({ target: { value: 'abc' } });
      
      // Should not call immediately
      expect(mockCallback).not.toHaveBeenCalled();
      
      // Should call after debounce delay
      setTimeout(() => {
        expect(mockCallback).toHaveBeenCalledTimes(1);
        expect(mockCallback).toHaveBeenCalledWith('abc');
        done();
      }, 200);
    });

    test('clears search when clear button is clicked', () => {
      const mockCallback = jest.fn();
      sidebar.setCallbacks({ onSearchChange: mockCallback });
      
      (sidebar as any).handleClearSearch();
      
      expect(mockCallback).toHaveBeenCalledWith('');
    });

    test('hides search when showSearch is false', () => {
      const options: BookmarkSidebarOptions = {
        showSearch: false
      };
      
      const customSidebar = new BookmarkSidebar(options);
      container.appendChild(customSidebar);
      
      expect((customSidebar as any).options.showSearch).toBe(false);
    });
  });

  describe('Filter Management', () => {
    test('applies filter changes', () => {
      const mockCallback = jest.fn();
      sidebar.setCallbacks({ onFilterChange: mockCallback });
      
      const filters: BookmarkFilters = {
        tags: ['important'],
        platforms: ['chatgpt'],
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        }
      };
      
      sidebar.setFilters(filters);
      
      expect(mockCallback).toHaveBeenCalledWith(filters);
    });

    test('handles tag filter selection', () => {
      const mockCallback = jest.fn();
      sidebar.setCallbacks({ onFilterChange: mockCallback });
      
      // Mock tag selection event
      const mockEvent = {
        target: { checked: true, value: 'important' }
      };
      
      (sidebar as any).handleTagFilter(mockEvent);
      
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['important']
        })
      );
    });

    test('handles platform filter selection', () => {
      const mockCallback = jest.fn();
      sidebar.setCallbacks({ onFilterChange: mockCallback });
      
      const mockEvent = {
        target: { checked: true, value: 'claude' }
      };
      
      (sidebar as any).handlePlatformFilter(mockEvent);
      
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          platforms: ['claude']
        })
      );
    });

    test('clears all active filters', () => {
      const mockCallback = jest.fn();
      sidebar.setCallbacks({ onFilterChange: mockCallback });
      
      // Set some filters first
      sidebar.setFilters({ tags: ['test'], platforms: ['chatgpt'] });
      
      // Clear filters
      (sidebar as any).handleClearFilters();
      
      expect(mockCallback).toHaveBeenLastCalledWith({});
    });
  });

  describe('Responsive Design', () => {
    test('adjusts layout for narrow widths', () => {
      sidebar.width = 200;
      (sidebar as any).updateResponsiveLayout();
      
      expect(sidebar.classList.contains('narrow')).toBe(true);
    });

    test('shows full layout for wide widths', () => {
      sidebar.width = 400;
      (sidebar as any).updateResponsiveLayout();
      
      expect(sidebar.classList.contains('narrow')).toBe(false);
    });

    test('handles window resize events', () => {
      const spy = jest.spyOn(sidebar as any, 'updateResponsiveLayout');
      
      // Simulate window resize
      window.dispatchEvent(new Event('resize'));
      
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Resizing Functionality', () => {
    test('enables resize when resizable is true', () => {
      const options: BookmarkSidebarOptions = {
        resizable: true
      };
      
      const resizableSidebar = new BookmarkSidebar(options);
      container.appendChild(resizableSidebar);
      
      expect((resizableSidebar as any).options.resizable).toBe(true);
    });

    test('disables resize when resizable is false', () => {
      const options: BookmarkSidebarOptions = {
        resizable: false
      };
      
      const nonResizableSidebar = new BookmarkSidebar(options);
      container.appendChild(nonResizableSidebar);
      
      expect((nonResizableSidebar as any).options.resizable).toBe(false);
    });

    test('handles resize drag events', () => {
      const options: BookmarkSidebarOptions = {
        resizable: true,
        minWidth: 200,
        maxWidth: 600
      };
      
      const resizableSidebar = new BookmarkSidebar(options);
      container.appendChild(resizableSidebar);
      
      const initialWidth = resizableSidebar.width;
      
      // Simulate resize drag
      const mockEvent = {
        clientX: 350,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      };
      
      (resizableSidebar as any).startResize = true;
      (resizableSidebar as any).startX = 300;
      (resizableSidebar as any).startWidth = initialWidth;
      
      (resizableSidebar as any).handleResizing(mockEvent);
      
      expect(resizableSidebar.width).toBe(initialWidth + 50);
    });

    test('respects minimum and maximum width constraints', () => {
      const options: BookmarkSidebarOptions = {
        resizable: true,
        minWidth: 250,
        maxWidth: 500
      };
      
      const resizableSidebar = new BookmarkSidebar(options);
      container.appendChild(resizableSidebar);
      
      // Test minimum width constraint
      resizableSidebar.width = 100;
      (resizableSidebar as any).enforceWidthConstraints();
      expect(resizableSidebar.width).toBe(250);
      
      // Test maximum width constraint
      resizableSidebar.width = 700;
      (resizableSidebar as any).enforceWidthConstraints();
      expect(resizableSidebar.width).toBe(500);
    });
  });

  describe('Keyboard Navigation', () => {
    test('handles arrow key navigation', () => {
      const bookmarks = [createMockBookmark('1'), createMockBookmark('2')];
      sidebar.updateBookmarkList(bookmarks);
      
      const mockEvent = {
        key: 'ArrowDown',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      };
      
      (sidebar as any).handleKeydown(mockEvent);
      
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    test('handles Enter key for bookmark selection', () => {
      const mockCallback = jest.fn();
      sidebar.setCallbacks({ onBookmarkClick: mockCallback });
      
      const bookmarks = [createMockBookmark()];
      sidebar.updateBookmarkList(bookmarks);
      (sidebar as any).selectedIndex = 0;
      
      const mockEvent = {
        key: 'Enter',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      };
      
      (sidebar as any).handleKeydown(mockEvent);
      
      expect(mockCallback).toHaveBeenCalledWith(bookmarks[0]);
    });

    test('handles Escape key to close sidebar', () => {
      sidebar.show();
      
      const mockEvent = {
        key: 'Escape',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      };
      
      (sidebar as any).handleKeydown(mockEvent);
      
      expect(sidebar.classList.contains('visible')).toBe(false);
    });
  });

  describe('Theme Integration', () => {
    test('applies light theme', () => {
      sidebar.theme = 'light';
      
      expect(sidebar.classList.contains('theme-light')).toBe(true);
    });

    test('applies dark theme', () => {
      sidebar.theme = 'dark';
      
      expect(sidebar.classList.contains('theme-dark')).toBe(true);
    });

    test('applies auto theme based on system preference', () => {
      // Mock system preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-color-scheme: dark)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        }))
      });
      
      sidebar.theme = 'auto';
      (sidebar as any).updateTheme();
      
      expect(sidebar.classList.contains('theme-dark')).toBe(true);
    });
  });

  describe('Accessibility Features', () => {
    test('sets proper ARIA attributes', () => {
      expect(sidebar.getAttribute('role')).toBe('complementary');
      expect(sidebar.getAttribute('aria-label')).toContain('Bookmark sidebar');
    });

    test('manages focus correctly when shown', () => {
      const mockFocus = jest.fn();
      const mockSearchInput = { focus: mockFocus };
      
      jest.spyOn(sidebar.shadowRoot!, 'querySelector').mockReturnValue(mockSearchInput as any);
      
      sidebar.show();
      (sidebar as any).focusSearchInput();
      
      expect(mockFocus).toHaveBeenCalled();
    });

    test('announces state changes to screen readers', () => {
      const mockAnnounce = jest.spyOn(sidebar as any, 'announceToScreenReader');
      
      sidebar.show();
      
      expect(mockAnnounce).toHaveBeenCalledWith('Sidebar opened');
    });
  });

  describe('Performance Optimization', () => {
    test('uses virtual scrolling for large bookmark lists', () => {
      const manyBookmarks = Array.from({ length: 1000 }, (_, i) => 
        createMockBookmark(`bookmark-${i}`)
      );
      
      sidebar.updateBookmarkList(manyBookmarks);
      
      // Should enable virtual scrolling
      expect((sidebar as any).useVirtualScrolling).toBe(true);
    });

    test('debounces filter updates', (done) => {
      const mockCallback = jest.fn();
      sidebar.setCallbacks({ onFilterChange: mockCallback });
      
      // Rapid filter changes
      sidebar.setFilters({ tags: ['a'] });
      sidebar.setFilters({ tags: ['ab'] });
      sidebar.setFilters({ tags: ['abc'] });
      
      setTimeout(() => {
        expect(mockCallback).toHaveBeenCalledTimes(1);
        done();
      }, 100);
    });
  });

  describe('Error Handling', () => {
    test('handles rendering errors gracefully', () => {
      console.error = jest.fn();
      
      // Force a rendering error
      (sidebar as any).shadowRoot = null;
      
      expect(() => {
        sidebar.updateBookmarkList([createMockBookmark()]);
      }).not.toThrow();
      
      expect(console.error).toHaveBeenCalled();
    });

    test('handles invalid bookmark data', () => {
      console.warn = jest.fn();
      
      const invalidBookmarks = [
        null,
        undefined,
        {},
        createMockBookmark()
      ] as any;
      
      sidebar.updateBookmarkList(invalidBookmarks);
      
      expect(console.warn).toHaveBeenCalled();
      expect((sidebar as any).bookmarks).toHaveLength(1); // Only valid bookmark
    });
  });

  describe('Cleanup and Memory Management', () => {
    test('removes event listeners on disconnect', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      
      sidebar.disconnectedCallback?.();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    test('clears timers on disconnect', () => {
      const clearTimeoutSpy = jest.spyOn(window, 'clearTimeout');
      
      // Set up some timers
      (sidebar as any).searchDebounceTimeout = setTimeout(() => {}, 100);
      (sidebar as any).filterDebounceTimeout = setTimeout(() => {}, 100);
      
      sidebar.disconnectedCallback?.();
      
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
    });
  });
});