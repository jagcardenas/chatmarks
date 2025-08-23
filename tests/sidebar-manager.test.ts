/**
 * SidebarManager Test Suite
 * 
 * Comprehensive tests for sidebar integration and management functionality
 */

import { SidebarManager, SidebarManagerOptions, SidebarManagerCallbacks } from '../src/content/ui/sidebar/SidebarManager';
import { StorageService } from '../src/content/storage/StorageService';
import { NavigationController } from '../src/content/navigation/NavigationController';
import { Bookmark, Platform } from '../src/types/bookmark';

// Mock dependencies
jest.mock('../src/content/ui/sidebar/BookmarkSidebar');
jest.mock('../src/content/ui/sidebar/VirtualBookmarkList');
jest.mock('../src/content/ui/sidebar/SearchFilter');
jest.mock('../src/content/ui/sidebar/SortingSystem');

describe('SidebarManager', () => {
  let sidebarManager: SidebarManager;
  let mockStorageService: jest.Mocked<StorageService>;
  let mockNavigationController: jest.Mocked<NavigationController>;
  let mockCallbacks: SidebarManagerCallbacks;

  const createMockBookmark = (id: string = 'test-bookmark-1'): Bookmark => ({
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
    // Mock storage service
    mockStorageService = {
      getBookmarksByConversation: jest.fn(),
      getBookmarks: jest.fn(),
      removeBookmark: jest.fn()
    } as any;

    // Mock navigation controller
    mockNavigationController = {
      navigateToBookmark: jest.fn()
    } as any;

    // Mock callbacks
    mockCallbacks = {
      onBookmarkNavigate: jest.fn(),
      onBookmarkUpdate: jest.fn(),
      onBookmarkDelete: jest.fn(),
      onSidebarToggle: jest.fn(),
      onSearchChange: jest.fn()
    };

    // Mock DOM elements
    Object.defineProperty(document, 'body', {
      value: { appendChild: jest.fn(), removeChild: jest.fn() },
      writable: true
    });

    // Mock customElements
    Object.defineProperty(window, 'customElements', {
      value: {
        define: jest.fn(),
        get: jest.fn().mockReturnValue(undefined)
      },
      writable: true
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (sidebarManager) {
      sidebarManager.dispose();
    }
  });

  describe('Construction and Initialization', () => {
    test('creates instance with default options', () => {
      sidebarManager = new SidebarManager();
      
      expect(sidebarManager).toBeDefined();
      const state = sidebarManager.getState();
      expect(state.visible).toBe(false);
      expect(state.loading).toBe(false);
    });

    test('creates instance with custom options', () => {
      const options: SidebarManagerOptions = {
        position: 'left',
        initialWidth: 320,
        platform: 'claude',
        storageService: mockStorageService,
        navigationController: mockNavigationController,
        autoLoad: false
      };

      sidebarManager = new SidebarManager(options);
      
      expect(sidebarManager).toBeDefined();
      expect(mockStorageService.getBookmarks).not.toHaveBeenCalled();
    });

    test('auto-loads bookmarks when autoLoad is true', async () => {
      const bookmarks = [createMockBookmark()];
      mockStorageService.getBookmarks.mockResolvedValue(bookmarks);

      const options: SidebarManagerOptions = {
        storageService: mockStorageService,
        autoLoad: true
      };

      sidebarManager = new SidebarManager(options);
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockStorageService.getBookmarks).toHaveBeenCalled();
    });

    test('registers custom elements', () => {
      sidebarManager = new SidebarManager();
      
      expect(window.customElements.define).toHaveBeenCalledWith('bookmark-sidebar', expect.any(Function));
      expect(window.customElements.define).toHaveBeenCalledWith('virtual-bookmark-list', expect.any(Function));
    });
  });

  describe('Sidebar Visibility Management', () => {
    beforeEach(() => {
      sidebarManager = new SidebarManager({
        storageService: mockStorageService,
        autoLoad: false
      });
      sidebarManager.setCallbacks(mockCallbacks);
    });

    test('shows sidebar and triggers callback', () => {
      sidebarManager.show();
      
      const state = sidebarManager.getState();
      expect(state.visible).toBe(true);
      expect(mockCallbacks.onSidebarToggle).toHaveBeenCalledWith(true);
    });

    test('hides sidebar and triggers callback', () => {
      sidebarManager.show();
      sidebarManager.hide();
      
      const state = sidebarManager.getState();
      expect(state.visible).toBe(false);
      expect(mockCallbacks.onSidebarToggle).toHaveBeenCalledWith(false);
    });

    test('toggles sidebar visibility', () => {
      expect(sidebarManager.getState().visible).toBe(false);
      
      sidebarManager.toggle();
      expect(sidebarManager.getState().visible).toBe(true);
      
      sidebarManager.toggle();
      expect(sidebarManager.getState().visible).toBe(false);
    });

    test('loads bookmarks when showing empty sidebar with autoLoad', async () => {
      const bookmarks = [createMockBookmark()];
      mockStorageService.getBookmarks.mockResolvedValue(bookmarks);

      const options: SidebarManagerOptions = {
        storageService: mockStorageService,
        autoLoad: true
      };
      
      sidebarManager = new SidebarManager(options);
      sidebarManager.show();
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockStorageService.getBookmarks).toHaveBeenCalled();
    });
  });

  describe('Bookmark Management', () => {
    beforeEach(() => {
      sidebarManager = new SidebarManager({
        storageService: mockStorageService,
        autoLoad: false
      });
    });

    test('loads all bookmarks successfully', async () => {
      const bookmarks = [createMockBookmark('1'), createMockBookmark('2')];
      mockStorageService.getBookmarks.mockResolvedValue(bookmarks);

      await sidebarManager.loadBookmarks();
      
      expect(mockStorageService.getBookmarks).toHaveBeenCalled();
      expect(sidebarManager.getAllBookmarks()).toHaveLength(2);
    });

    test('loads bookmarks by conversation ID', async () => {
      const bookmarks = [createMockBookmark()];
      mockStorageService.getBookmarksByConversation.mockResolvedValue(bookmarks);

      sidebarManager.setConversationId('conv-123');
      await sidebarManager.loadBookmarks();
      
      expect(mockStorageService.getBookmarksByConversation).toHaveBeenCalledWith('conv-123');
    });

    test('handles bookmark loading errors gracefully', async () => {
      mockStorageService.getAllBookmarks.mockRejectedValue(new Error('Storage error'));
      console.error = jest.fn();

      await sidebarManager.loadBookmarks();
      
      expect(console.error).toHaveBeenCalledWith('SidebarManager: Failed to load bookmarks:', expect.any(Error));
    });

    test('adds new bookmark and updates display', () => {
      const bookmark = createMockBookmark();
      
      sidebarManager.addBookmark(bookmark);
      
      expect(sidebarManager.getAllBookmarks()).toContain(bookmark);
      expect(sidebarManager.getFilteredBookmarks()).toContain(bookmark);
    });

    test('updates existing bookmark', () => {
      const bookmark = createMockBookmark();
      sidebarManager.addBookmark(bookmark);

      const updatedBookmark = { ...bookmark, note: 'Updated note' };
      sidebarManager.updateBookmark(updatedBookmark);
      
      const stored = sidebarManager.getAllBookmarks().find(b => b.id === bookmark.id);
      expect(stored?.note).toBe('Updated note');
    });

    test('removes bookmark from collection', () => {
      const bookmark = createMockBookmark();
      sidebarManager.addBookmark(bookmark);
      
      sidebarManager.removeBookmark(bookmark.id);
      
      expect(sidebarManager.getAllBookmarks()).not.toContain(bookmark);
    });

    test('handles bookmark deletion with storage service', async () => {
      mockStorageService.removeBookmark.mockResolvedValue();
      sidebarManager.setCallbacks(mockCallbacks);

      const bookmark = createMockBookmark();
      sidebarManager.addBookmark(bookmark);
      
      // Simulate bookmark delete action
      await (sidebarManager as any).handleBookmarkDelete(bookmark);
      
      expect(mockStorageService.removeBookmark).toHaveBeenCalledWith(bookmark.id);
      expect(mockCallbacks.onBookmarkDelete).toHaveBeenCalledWith(bookmark.id);
    });
  });

  describe('Search and Filtering', () => {
    beforeEach(() => {
      sidebarManager = new SidebarManager({ autoLoad: false });
      sidebarManager.setCallbacks(mockCallbacks);
      
      // Add test bookmarks
      const bookmarks = [
        createMockBookmark('1'),
        { ...createMockBookmark('2'), note: 'Different content', tags: ['other'] }
      ];
      bookmarks.forEach(bookmark => sidebarManager.addBookmark(bookmark));
    });

    test('handles search query changes with debouncing', (done) => {
      (sidebarManager as any).handleSearchChange('test');
      
      // Verify debouncing
      expect(mockCallbacks.onSearchChange).not.toHaveBeenCalled();
      
      setTimeout(() => {
        expect(mockCallbacks.onSearchChange).toHaveBeenCalled();
        done();
      }, 200);
    });

    test('applies tag filters correctly', () => {
      (sidebarManager as any).handleFilterChange({
        tags: ['important']
      });
      
      // Should filter to bookmarks with 'important' tag
      const filtered = sidebarManager.getFilteredBookmarks();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].tags).toContain('important');
    });

    test('sets search query programmatically', () => {
      sidebarManager.setSearchQuery('test search');
      
      const state = sidebarManager.getState();
      expect(state.searchQuery).toBe('test search');
    });

    test('clears all filters', () => {
      sidebarManager.setSearchQuery('test');
      (sidebarManager as any).handleFilterChange({ tags: ['test'] });
      
      sidebarManager.clearFilters();
      
      const state = sidebarManager.getState();
      expect(state.searchQuery).toBe('');
      expect(state.activeFilters).toEqual({});
    });
  });

  describe('Navigation Integration', () => {
    beforeEach(() => {
      sidebarManager = new SidebarManager({
        navigationController: mockNavigationController,
        autoLoad: false
      });
      sidebarManager.setCallbacks(mockCallbacks);
    });

    test('handles bookmark click with navigation controller', () => {
      const bookmark = createMockBookmark();
      
      (sidebarManager as any).handleBookmarkClick(bookmark);
      
      expect(mockCallbacks.onBookmarkNavigate).toHaveBeenCalledWith(bookmark);
      expect(mockNavigationController.navigateToBookmark).toHaveBeenCalledWith(bookmark.id);
    });

    test('scrolls to bookmark in virtual list', () => {
      const bookmark = createMockBookmark();
      sidebarManager.addBookmark(bookmark);
      
      const mockScrollToIndex = jest.fn();
      (sidebarManager as any).virtualList = { scrollToIndex: mockScrollToIndex };
      
      sidebarManager.scrollToBookmark(bookmark.id);
      
      expect(mockScrollToIndex).toHaveBeenCalledWith(0);
    });

    test('focuses search input when sidebar is visible', () => {
      const mockFocus = jest.fn();
      const mockShadowRoot = {
        querySelector: jest.fn().mockReturnValue({ focus: mockFocus })
      };
      
      (sidebarManager as any).sidebar = {
        shadowRoot: mockShadowRoot
      };
      sidebarManager.show();
      
      sidebarManager.focusSearch();
      
      expect(mockShadowRoot.querySelector).toHaveBeenCalledWith('.search-input');
      expect(mockFocus).toHaveBeenCalled();
    });
  });

  describe('Conversation Management', () => {
    beforeEach(() => {
      sidebarManager = new SidebarManager({
        storageService: mockStorageService,
        autoLoad: true
      });
    });

    test('changes conversation ID and reloads bookmarks', async () => {
      const bookmarks = [createMockBookmark()];
      mockStorageService.getBookmarksByConversation.mockResolvedValue(bookmarks);

      sidebarManager.setConversationId('new-conversation');
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockStorageService.getBookmarksByConversation).toHaveBeenCalledWith('new-conversation');
    });

    test('skips reload if conversation ID is the same', async () => {
      mockStorageService.getBookmarksByConversation.mockClear();
      
      sidebarManager.setConversationId('conv-123');
      sidebarManager.setConversationId('conv-123');
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockStorageService.getBookmarksByConversation).toHaveBeenCalledTimes(1);
    });
  });

  describe('Options and Configuration', () => {
    test('updates sidebar position', () => {
      sidebarManager = new SidebarManager({ autoLoad: false });
      const mockSidebar = { position: 'right' };
      (sidebarManager as any).sidebar = mockSidebar;
      
      sidebarManager.updateOptions({ position: 'left' });
      
      expect(mockSidebar.position).toBe('left');
    });

    test('updates sidebar width', () => {
      sidebarManager = new SidebarManager({ autoLoad: false });
      const mockSidebar = { width: 380 };
      (sidebarManager as any).sidebar = mockSidebar;
      
      sidebarManager.updateOptions({ initialWidth: 500 });
      
      expect(mockSidebar.width).toBe(500);
    });

    test('exports bookmarks as JSON', () => {
      const bookmark = createMockBookmark();
      sidebarManager = new SidebarManager({ autoLoad: false });
      sidebarManager.addBookmark(bookmark);
      
      const exported = sidebarManager.exportBookmarks();
      const parsed = JSON.parse(exported);
      
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe(bookmark.id);
    });
  });

  describe('Performance and Memory Management', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('debounces filter updates for performance', () => {
      sidebarManager = new SidebarManager({ autoLoad: false });
      const spy = jest.spyOn(sidebarManager as any, 'performFiltersAndSort');
      
      (sidebarManager as any).applyFiltersAndSort();
      (sidebarManager as any).applyFiltersAndSort();
      (sidebarManager as any).applyFiltersAndSort();
      
      expect(spy).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(300);
      
      expect(spy).toHaveBeenCalledTimes(1);
    });

    test('debounces search input for performance', () => {
      sidebarManager = new SidebarManager({ autoLoad: false });
      const spy = jest.spyOn(sidebarManager as any, 'applyFiltersAndSort');
      
      (sidebarManager as any).handleSearchChange('a');
      (sidebarManager as any).handleSearchChange('ab');
      (sidebarManager as any).handleSearchChange('abc');
      
      expect(spy).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(150);
      
      expect(spy).toHaveBeenCalledTimes(1);
    });

    test('cleans up resources on dispose', () => {
      sidebarManager = new SidebarManager({ autoLoad: false });
      
      const mockSidebar = {
        isConnected: true,
        remove: jest.fn()
      };
      (sidebarManager as any).sidebar = mockSidebar;
      
      const mockSearchFilter = {
        clear: jest.fn()
      };
      (sidebarManager as any).searchFilter = mockSearchFilter;
      
      sidebarManager.dispose();
      
      expect(mockSidebar.remove).toHaveBeenCalled();
      expect(mockSearchFilter.clear).toHaveBeenCalled();
      expect((sidebarManager as any).sidebar).toBeNull();
      expect((sidebarManager as any).allBookmarks).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    test('handles missing storage service gracefully', async () => {
      sidebarManager = new SidebarManager({ autoLoad: false });
      console.warn = jest.fn();
      
      await sidebarManager.loadBookmarks();
      
      expect(console.warn).toHaveBeenCalledWith('SidebarManager: No storage service available');
    });

    test('handles bookmark deletion errors gracefully', async () => {
      mockStorageService.removeBookmark.mockRejectedValue(new Error('Delete failed'));
      console.error = jest.fn();
      
      sidebarManager = new SidebarManager({
        storageService: mockStorageService,
        autoLoad: false
      });
      
      const bookmark = createMockBookmark();
      await (sidebarManager as any).handleBookmarkDelete(bookmark);
      
      expect(console.error).toHaveBeenCalledWith('SidebarManager: Failed to delete bookmark:', expect.any(Error));
    });
  });

  describe('State Management', () => {
    test('returns immutable state copy', () => {
      sidebarManager = new SidebarManager({ autoLoad: false });
      
      const state1 = sidebarManager.getState();
      const state2 = sidebarManager.getState();
      
      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // Different objects
    });

    test('manages selection state correctly', () => {
      sidebarManager = new SidebarManager({ autoLoad: false });
      const bookmarks = [createMockBookmark('1'), createMockBookmark('2')];
      
      (sidebarManager as any).handleSelectionChange(bookmarks);
      
      const state = sidebarManager.getState();
      expect(state.selectedBookmarks).toHaveLength(2);
      expect(state.selectedBookmarks[0]).not.toBe(bookmarks[0]); // Should be copy
    });
  });
});