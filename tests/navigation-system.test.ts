/**
 * Navigation System Tests
 *
 * Unit tests focused on core navigation logic without external dependencies.
 * Tests bookmark ordering, state management, and navigation workflows.
 */

import { NavigationController } from '../src/content/navigation/NavigationController';
import { SmoothScroller } from '../src/content/navigation/SmoothScroller';
import { URLStateManager } from '../src/content/navigation/URLStateManager';
import {
  Bookmark,
  Platform,
  BookmarkOperationResult,
} from '../src/types/bookmark';
import { StorageService } from '../src/content/storage/StorageService';

// Mock IntersectionObserver globally
global.IntersectionObserver = jest.fn().mockImplementation(callback => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock window.history globally
Object.defineProperty(window, 'history', {
  value: {
    pushState: jest.fn(),
    replaceState: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  },
  writable: true,
});

// Mock storage service for testing
class MockStorageService extends StorageService {
  private mockBookmarks: Bookmark[] = [];

  constructor() {
    super();
  }

  async getBookmarks(): Promise<Bookmark[]> {
    return [...this.mockBookmarks].sort(
      (a, b) => new Date(a.created).getTime() - new Date(b.created).getTime()
    );
  }

  setMockBookmarks(bookmarks: Bookmark[]): void {
    this.mockBookmarks = bookmarks;
  }

  // Override other methods to avoid chrome.storage calls
  async saveBookmark(bookmark: Bookmark): Promise<void> {
    this.mockBookmarks.push(bookmark);
  }

  async deleteBookmark(bookmarkId: string): Promise<void> {
    const index = this.mockBookmarks.findIndex(b => b.id === bookmarkId);
    if (index >= 0) {
      this.mockBookmarks.splice(index, 1);
    }
  }
}

// Mock bookmark operations - simple mock for testing
const mockBookmarkOperations = {
  getBookmarksForConversation: async (): Promise<Bookmark[]> => [],
} as any;

// Create test bookmarks
const createTestBookmarks = (): Bookmark[] => [
  {
    id: 'bookmark-1',
    conversationId: 'test-conv-123',
    messageId: 'msg-1',
    platform: 'chatgpt' as Platform,
    anchor: {
      selectedText: 'First bookmark',
      startOffset: 0,
      endOffset: 14,
      xpathSelector: '//div[@id="msg-1"]',
      messageId: 'msg-1',
      contextBefore: '',
      contextAfter: '',
      checksum: 'hash1',
      confidence: 1.0,
      strategy: 'xpath' as const,
    },
    note: 'First test bookmark',
    tags: [],
    created: '2023-01-01T10:00:00Z',
    updated: '2023-01-01T10:00:00Z',
    color: '#ffeb3b',
  },
  {
    id: 'bookmark-2',
    conversationId: 'test-conv-123',
    messageId: 'msg-2',
    platform: 'chatgpt' as Platform,
    anchor: {
      selectedText: 'Second bookmark',
      startOffset: 0,
      endOffset: 15,
      xpathSelector: '//div[@id="msg-2"]',
      messageId: 'msg-2',
      contextBefore: '',
      contextAfter: '',
      checksum: 'hash2',
      confidence: 1.0,
      strategy: 'xpath' as const,
    },
    note: 'Second test bookmark',
    tags: [],
    created: '2023-01-01T11:00:00Z',
    updated: '2023-01-01T11:00:00Z',
    color: '#4caf50',
  },
  {
    id: 'bookmark-3',
    conversationId: 'test-conv-123',
    messageId: 'msg-3',
    platform: 'chatgpt' as Platform,
    anchor: {
      selectedText: 'Third bookmark',
      startOffset: 0,
      endOffset: 14,
      xpathSelector: '//div[@id="msg-3"]',
      messageId: 'msg-3',
      contextBefore: '',
      contextAfter: '',
      checksum: 'hash3',
      confidence: 1.0,
      strategy: 'xpath' as const,
    },
    note: 'Third test bookmark',
    tags: [],
    created: '2023-01-01T12:00:00Z',
    updated: '2023-01-01T12:00:00Z',
    color: '#2196f3',
  },
];

describe('NavigationController', () => {
  let navigationController: NavigationController;
  let mockStorageService: MockStorageService;
  let testBookmarks: Bookmark[];

  beforeEach(() => {
    mockStorageService = new MockStorageService();
    testBookmarks = createTestBookmarks();
    mockStorageService.setMockBookmarks(testBookmarks);

    navigationController = new NavigationController(
      mockStorageService,
      mockBookmarkOperations,
      'test-conv-123',
      {
        enableSmoothScrolling: false, // Disable for unit tests
        highlightDuration: 0,
        enableURLState: false, // Disable URL state for unit tests
        enableCrossConversation: false,
        scrollOffset: 0,
        navigationDebounce: 0,
      }
    );
  });

  describe('Bookmark Loading and Ordering', () => {
    it('should load bookmarks in chronological order', async () => {
      await navigationController.initialize();
      const bookmarks = navigationController.getCurrentBookmarks();

      expect(bookmarks).toHaveLength(3);
      expect(bookmarks[0]!.id).toBe('bookmark-1');
      expect(bookmarks[1]!.id).toBe('bookmark-2');
      expect(bookmarks[2]!.id).toBe('bookmark-3');
    });

    it('should handle empty bookmark list', async () => {
      mockStorageService.setMockBookmarks([]);
      await navigationController.initialize();

      const bookmarks = navigationController.getCurrentBookmarks();
      expect(bookmarks).toHaveLength(0);
      expect(navigationController.getCurrentBookmarkIndex()).toBe(-1);
    });

    it('should find bookmark position by ID', async () => {
      await navigationController.initialize();

      const position1 = navigationController.getBookmarkPosition('bookmark-1');
      const position2 = navigationController.getBookmarkPosition('bookmark-2');
      const position3 = navigationController.getBookmarkPosition('bookmark-3');
      const positionInvalid =
        navigationController.getBookmarkPosition('invalid-id');

      expect(position1?.index).toBe(0);
      expect(position2?.index).toBe(1);
      expect(position3?.index).toBe(2);
      expect(positionInvalid).toBeNull();
    });
  });

  describe('Navigation State Management', () => {
    beforeEach(async () => {
      await navigationController.initialize();
    });

    it('should track current bookmark index', () => {
      expect(navigationController.getCurrentBookmarkIndex()).toBe(-1);

      navigationController.setCurrentBookmarkIndex(0);
      expect(navigationController.getCurrentBookmarkIndex()).toBe(0);

      navigationController.setCurrentBookmarkIndex(1);
      expect(navigationController.getCurrentBookmarkIndex()).toBe(1);
    });

    it('should validate bookmark index bounds', () => {
      navigationController.setCurrentBookmarkIndex(-5);
      expect(navigationController.getCurrentBookmarkIndex()).toBe(-1);

      navigationController.setCurrentBookmarkIndex(10);
      expect(navigationController.getCurrentBookmarkIndex()).toBe(-1);

      navigationController.setCurrentBookmarkIndex(2);
      expect(navigationController.getCurrentBookmarkIndex()).toBe(2);
    });

    it('should determine next/previous availability', () => {
      navigationController.setCurrentBookmarkIndex(0);
      expect(navigationController.hasNext()).toBe(true);
      expect(navigationController.hasPrevious()).toBe(false);

      navigationController.setCurrentBookmarkIndex(1);
      expect(navigationController.hasNext()).toBe(true);
      expect(navigationController.hasPrevious()).toBe(true);

      navigationController.setCurrentBookmarkIndex(2);
      expect(navigationController.hasNext()).toBe(false);
      expect(navigationController.hasPrevious()).toBe(true);
    });
  });

  describe('Navigation Operations', () => {
    beforeEach(async () => {
      await navigationController.initialize();
    });

    it('should navigate to specific bookmark by ID', () => {
      const result = navigationController.navigateToBookmarkSync('bookmark-2');

      expect(result).toBe(true);
      expect(navigationController.getCurrentBookmarkIndex()).toBe(1);
    });

    it('should handle navigation to non-existent bookmark', () => {
      const result =
        navigationController.navigateToBookmarkSync('invalid-bookmark');

      expect(result).toBe(false);
      expect(navigationController.getCurrentBookmarkIndex()).toBe(-1);
    });

    it('should navigate to next bookmark', () => {
      navigationController.setCurrentBookmarkIndex(0);

      const result = navigationController.navigateNextSync();
      expect(result).toBe(true);
      expect(navigationController.getCurrentBookmarkIndex()).toBe(1);
    });

    it('should navigate to previous bookmark', () => {
      navigationController.setCurrentBookmarkIndex(2);

      const result = navigationController.navigatePreviousSync();
      expect(result).toBe(true);
      expect(navigationController.getCurrentBookmarkIndex()).toBe(1);
    });

    it('should not navigate next from last bookmark', () => {
      navigationController.setCurrentBookmarkIndex(2);

      const result = navigationController.navigateNextSync();
      expect(result).toBe(false);
      expect(navigationController.getCurrentBookmarkIndex()).toBe(2);
    });

    it('should not navigate previous from first bookmark', () => {
      navigationController.setCurrentBookmarkIndex(0);

      const result = navigationController.navigatePreviousSync();
      expect(result).toBe(false);
      expect(navigationController.getCurrentBookmarkIndex()).toBe(0);
    });

    it('should handle navigation when no bookmarks are loaded', () => {
      mockStorageService.setMockBookmarks([]);
      const emptyController = new NavigationController(
        mockStorageService,
        mockBookmarkOperations,
        'empty-conv',
        {}
      );

      expect(emptyController.navigateNextSync()).toBe(false);
      expect(emptyController.navigatePreviousSync()).toBe(false);
      expect(emptyController.navigateToBookmarkSync('any-id')).toBe(false);
    });
  });

  describe('Conversation Management', () => {
    it('should get current conversation ID', () => {
      expect(navigationController.getCurrentConversationId()).toBe(
        'test-conv-123'
      );
    });

    it('should update conversation ID', async () => {
      await navigationController.updateConversationId('new-conv-456');
      expect(navigationController.getCurrentConversationId()).toBe(
        'new-conv-456'
      );
    });

    it('should reset state when conversation changes', async () => {
      navigationController.setCurrentBookmarkIndex(1);

      await navigationController.updateConversationId('new-conv-456');
      expect(navigationController.getCurrentBookmarkIndex()).toBe(-1);
    });
  });
});

describe('SmoothScroller', () => {
  let smoothScroller: SmoothScroller;
  let mockElement: HTMLElement;

  beforeEach(() => {
    // Mock window properties for scroll calculations
    Object.defineProperty(window, 'pageYOffset', {
      value: 0,
      writable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 1000,
      writable: true,
    });
    Object.defineProperty(document, 'documentElement', {
      value: {
        scrollTop: 0,
      },
      writable: true,
    });
    Object.defineProperty(document, 'body', {
      value: {
        scrollHeight: 2000,
      },
      writable: true,
    });

    // Create mock element
    mockElement = document.createElement('div');
    mockElement.getBoundingClientRect = jest.fn(
      () =>
        ({
          top: 100,
          left: 0,
          width: 200,
          height: 50,
          bottom: 150,
          right: 200,
          x: 0,
          y: 100,
          toJSON: () => ({}),
        }) as DOMRect
    );

    smoothScroller = new SmoothScroller({
      enableSmoothScrolling: true,
      highlightDuration: 1000,
      scrollOffset: 100,
    });
  });

  describe('Scroll Position Calculation', () => {
    it('should calculate optimal scroll position', () => {
      const position =
        smoothScroller.calculateOptimalScrollPosition(mockElement);

      // scrollTop(0) + rect.top(100) - innerHeight/2(500) + scrollOffset(100) = -300 -> Math.max(0, -300) = 0
      expect(position).toBe(0);
    });

    it('should handle null element', () => {
      const position = smoothScroller.calculateOptimalScrollPosition(null);
      expect(position).toBe(0);
    });

    it('should apply scroll offset correctly', () => {
      const scrollerWithOffset = new SmoothScroller({
        scrollOffset: 50,
      });

      const position =
        scrollerWithOffset.calculateOptimalScrollPosition(mockElement);
      // scrollTop(0) + rect.top(100) - innerHeight/2(500) + scrollOffset(50) = -350 -> Math.max(0, -350) = 0
      expect(position).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should handle smooth scrolling configuration', () => {
      const smoothScroller = new SmoothScroller({
        enableSmoothScrolling: true,
        highlightDuration: 1000,
        scrollOffset: 50,
      });

      expect(smoothScroller).toBeDefined();
    });

    it('should handle disabled smooth scrolling configuration', () => {
      const instantScroller = new SmoothScroller({
        enableSmoothScrolling: false,
      });

      expect(instantScroller).toBeDefined();
    });
  });
});

describe('URLStateManager', () => {
  let urlStateManager: URLStateManager;

  beforeEach(() => {
    // Create URLStateManager with disabled config for testing
    urlStateManager = new URLStateManager({
      enabled: false, // Disable to avoid browser API calls
    });
  });

  describe('URL Fragment Management', () => {
    it('should handle disabled state', () => {
      // When disabled, URLStateManager should not throw errors
      expect(() => {
        urlStateManager.updateURLWithBookmark('bookmark-123');
        urlStateManager.clearBookmarkFromURL();
      }).not.toThrow();
    });

    it('should return null when disabled', () => {
      const bookmarkId = urlStateManager.extractBookmarkIdFromURL();
      expect(bookmarkId).toBeNull();
    });

    it('should manage configuration', () => {
      const state = urlStateManager.getURLState();
      expect(state.enabled).toBe(false);
    });
  });

  describe('Event Management', () => {
    it('should manage URL change subscribers', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      urlStateManager.subscribeToURLChanges(callback1);
      urlStateManager.subscribeToURLChanges(callback2);

      expect(urlStateManager.getSubscriberCount()).toBe(2);

      urlStateManager.unsubscribeFromURLChanges(callback1);
      expect(urlStateManager.getSubscriberCount()).toBe(1);
    });

    it('should handle multiple identical subscribers', () => {
      const callback = jest.fn();

      urlStateManager.subscribeToURLChanges(callback);
      urlStateManager.subscribeToURLChanges(callback);

      // Should only add once (Set behavior)
      expect(urlStateManager.getSubscriberCount()).toBe(1);
    });
  });
});

describe('Navigation Integration', () => {
  let navigationController: NavigationController;
  let mockStorageService: MockStorageService;

  beforeEach(async () => {
    mockStorageService = new MockStorageService();
    mockStorageService.setMockBookmarks(createTestBookmarks());

    navigationController = new NavigationController(
      mockStorageService,
      mockBookmarkOperations,
      'test-conv-123',
      {
        enableSmoothScrolling: false,
        enableURLState: false,
        enableCrossConversation: false,
      }
    );

    await navigationController.initialize();
  });

  it('should complete full navigation workflow', () => {
    // Start navigation
    expect(navigationController.getCurrentBookmarkIndex()).toBe(-1);

    // Navigate to specific bookmark
    const result1 = navigationController.navigateToBookmarkSync('bookmark-2');
    expect(result1).toBe(true);
    expect(navigationController.getCurrentBookmarkIndex()).toBe(1);

    // Navigate next
    const result2 = navigationController.navigateNextSync();
    expect(result2).toBe(true);
    expect(navigationController.getCurrentBookmarkIndex()).toBe(2);

    // Navigate previous
    const result3 = navigationController.navigatePreviousSync();
    expect(result3).toBe(true);
    expect(navigationController.getCurrentBookmarkIndex()).toBe(1);
  });

  it('should handle bookmark list updates', async () => {
    expect(navigationController.getCurrentBookmarks()).toHaveLength(3);

    // Add more bookmarks
    const newBookmark: Bookmark = {
      id: 'bookmark-4',
      conversationId: 'test-conv-123',
      messageId: 'msg-4',
      platform: 'chatgpt' as Platform,
      anchor: {
        selectedText: 'Fourth bookmark',
        startOffset: 0,
        endOffset: 14,
        xpathSelector: '//div[@id="msg-4"]',
        messageId: 'msg-4',
        contextBefore: '',
        contextAfter: '',
        checksum: 'hash4',
        confidence: 1.0,
        strategy: 'xpath' as const,
      },
      note: 'Fourth test bookmark',
      tags: [],
      created: '2023-01-01T13:00:00Z',
      updated: '2023-01-01T13:00:00Z',
      color: '#ff5722',
    };
    const newBookmarks: Bookmark[] = [...createTestBookmarks(), newBookmark];

    mockStorageService.setMockBookmarks(newBookmarks);
    await navigationController.refreshBookmarks();

    expect(navigationController.getCurrentBookmarks()).toHaveLength(4);
  });

  it('should maintain state across bookmark refreshes', async () => {
    navigationController.setCurrentBookmarkIndex(1);

    await navigationController.refreshBookmarks();

    // Index should be preserved if bookmark still exists
    expect(navigationController.getCurrentBookmarkIndex()).toBe(1);
  });
});
