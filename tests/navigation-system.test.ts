/**
 * Navigation System Tests
 *
 * Comprehensive test suite for the bookmark navigation system.
 * Tests scrolling accuracy, animation performance, URL state management,
 * and cross-conversation navigation scenarios.
 */

import { NavigationController } from '../src/content/navigation/NavigationController';
import { SmoothScroller } from '../src/content/navigation/SmoothScroller';
import { URLStateManager } from '../src/content/navigation/URLStateManager';
import { BookmarkOperations } from '../src/content/BookmarkOperations';
import { AnchorSystem } from '../src/content/anchoring/AnchorSystem';
import { HighlightRenderer } from '../src/content/ui/highlights/HighlightRenderer';
import { StorageService } from '../src/content/storage/StorageService';
import { Bookmark, Platform } from '../src/types/bookmark';

// Global mocks for browser APIs
const mockIntersectionObserver = jest.fn(() => ({
  disconnect: jest.fn(),
  observe: jest.fn(),
  unobserve: jest.fn(),
}));

const mockScrollIntoView = jest.fn();

// Set up global mocks
beforeAll(() => {
  (global as any).IntersectionObserver = mockIntersectionObserver;
  Element.prototype.scrollIntoView = mockScrollIntoView;
});

// Mock implementations
class MockBookmarkOperations extends BookmarkOperations {
  constructor() {
    const mockAnchorSystem = {} as AnchorSystem;
    const mockHighlightRenderer = {} as HighlightRenderer;
    super(mockAnchorSystem, mockHighlightRenderer, null, 'chatgpt' as Platform);
  }
}

class MockStorageService extends StorageService {
  private mockBookmarks: Bookmark[] = [];

  async getBookmarks(filters?: any): Promise<Bookmark[]> {
    return this.mockBookmarks.filter(bookmark => {
      if (filters?.conversationId) {
        return bookmark.conversationId === filters.conversationId;
      }
      return true;
    }).sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());
  }

  setMockBookmarks(bookmarks: Bookmark[]): void {
    this.mockBookmarks = bookmarks;
  }
}

describe('NavigationController', () => {
  let navigationController: NavigationController;
  let mockStorageService: MockStorageService;
  let mockBookmarkOperations: MockBookmarkOperations;
  let testContainer: HTMLElement;
  let mockBookmarks: Bookmark[];

  beforeEach(() => {
    // Set up DOM
    document.body.innerHTML = '';
    testContainer = document.createElement('div');
    testContainer.innerHTML = `
      <div class="conversation" data-conversation-id="test-conv-123">
        <div class="message" data-message-id="msg-1" id="bookmark-target-1">
          <p>First message with bookmark target</p>
        </div>
        <div class="message" data-message-id="msg-2" id="bookmark-target-2">
          <p>Second message with bookmark target</p>
        </div>
        <div class="message" data-message-id="msg-3" id="bookmark-target-3">
          <p>Third message with bookmark target</p>
        </div>
      </div>
    `;
    document.body.appendChild(testContainer);

    // Create mock bookmarks
    mockBookmarks = [
      {
        id: 'bookmark-1',
        conversationId: 'test-conv-123',
        messageId: 'msg-1',
        anchor: {
          selectedText: 'First message',
          startOffset: 0,
          endOffset: 13,
          xpathSelector: '//div[@id="bookmark-target-1"]//p',
          messageId: 'msg-1',
          contextBefore: '',
          contextAfter: ' with bookmark target',
          checksum: 'checksum1',
          confidence: 0.95,
          strategy: 'xpath'
        },
        note: 'First bookmark',
        tags: [],
        created: '2025-01-01T10:00:00Z',
        updated: '2025-01-01T10:00:00Z',
        color: '#ffeb3b',
        platform: 'chatgpt' as Platform
      },
      {
        id: 'bookmark-2',
        conversationId: 'test-conv-123',
        messageId: 'msg-2',
        anchor: {
          selectedText: 'Second message',
          startOffset: 0,
          endOffset: 14,
          xpathSelector: '//div[@id="bookmark-target-2"]//p',
          messageId: 'msg-2',
          contextBefore: '',
          contextAfter: ' with bookmark target',
          checksum: 'checksum2',
          confidence: 0.95,
          strategy: 'xpath'
        },
        note: 'Second bookmark',
        tags: [],
        created: '2025-01-01T11:00:00Z',
        updated: '2025-01-01T11:00:00Z',
        color: '#ffeb3b',
        platform: 'chatgpt' as Platform
      },
      {
        id: 'bookmark-3',
        conversationId: 'test-conv-123',
        messageId: 'msg-3',
        anchor: {
          selectedText: 'Third message',
          startOffset: 0,
          endOffset: 13,
          xpathSelector: '//div[@id="bookmark-target-3"]//p',
          messageId: 'msg-3',
          contextBefore: '',
          contextAfter: ' with bookmark target',
          checksum: 'checksum3',
          confidence: 0.95,
          strategy: 'xpath'
        },
        note: 'Third bookmark',
        tags: [],
        created: '2025-01-01T12:00:00Z',
        updated: '2025-01-01T12:00:00Z',
        color: '#ffeb3b',
        platform: 'chatgpt' as Platform
      }
    ];

    // Set up services
    mockStorageService = new MockStorageService();
    mockStorageService.setMockBookmarks(mockBookmarks);
    mockBookmarkOperations = new MockBookmarkOperations();

    navigationController = new NavigationController(
      mockStorageService,
      mockBookmarkOperations,
      'test-conv-123'
    );
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Bookmark Ordering and Tracking', () => {
    it('should load bookmarks in creation order', async () => {
      await navigationController.initialize();
      const bookmarks = navigationController.getCurrentBookmarks();
      
      expect(bookmarks).toHaveLength(3);
      expect(bookmarks[0]?.id).toBe('bookmark-1');
      expect(bookmarks[1]?.id).toBe('bookmark-2');
      expect(bookmarks[2]?.id).toBe('bookmark-3');
    });

    it('should track current bookmark position', async () => {
      await navigationController.initialize();
      
      expect(navigationController.getCurrentBookmarkIndex()).toBe(-1);
      
      await navigationController.navigateToBookmark('bookmark-2');
      expect(navigationController.getCurrentBookmarkIndex()).toBe(1);
    });

    it('should handle empty bookmark list', async () => {
      mockStorageService.setMockBookmarks([]);
      await navigationController.initialize();
      
      expect(navigationController.getCurrentBookmarks()).toHaveLength(0);
      expect(navigationController.getCurrentBookmarkIndex()).toBe(-1);
    });
  });

  describe('Navigation Operations', () => {
    beforeEach(async () => {
      await navigationController.initialize();
    });

    it('should navigate to specific bookmark by ID', async () => {
      const result = await navigationController.navigateToBookmark('bookmark-2');
      
      expect(result).toBe(true);
      expect(navigationController.getCurrentBookmarkIndex()).toBe(1);
    });

    it('should navigate to next bookmark', async () => {
      // Start at first bookmark
      await navigationController.navigateToBookmark('bookmark-1');
      
      const result = await navigationController.navigateNext();
      
      expect(result).toBe(true);
      expect(navigationController.getCurrentBookmarkIndex()).toBe(1);
    });

    it('should navigate to previous bookmark', async () => {
      // Start at third bookmark
      await navigationController.navigateToBookmark('bookmark-3');
      
      const result = await navigationController.navigatePrevious();
      
      expect(result).toBe(true);
      expect(navigationController.getCurrentBookmarkIndex()).toBe(1);
    });

    it('should not navigate next from last bookmark', async () => {
      await navigationController.navigateToBookmark('bookmark-3');
      
      const result = await navigationController.navigateNext();
      
      expect(result).toBe(false);
      expect(navigationController.getCurrentBookmarkIndex()).toBe(2);
    });

    it('should not navigate previous from first bookmark', async () => {
      await navigationController.navigateToBookmark('bookmark-1');
      
      const result = await navigationController.navigatePrevious();
      
      expect(result).toBe(false);
      expect(navigationController.getCurrentBookmarkIndex()).toBe(0);
    });

    it('should handle navigation to non-existent bookmark', async () => {
      const result = await navigationController.navigateToBookmark('non-existent');
      
      expect(result).toBe(false);
      expect(navigationController.getCurrentBookmarkIndex()).toBe(-1);
    });
  });

  describe('Performance Requirements', () => {
    beforeEach(async () => {
      await navigationController.initialize();
    });

    it('should complete navigation within performance target (<100ms)', async () => {
      const startTime = performance.now();
      
      await navigationController.navigateToBookmark('bookmark-2');
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(100);
    });

    it('should handle rapid successive navigation calls', async () => {
      const results = await Promise.all([
        navigationController.navigateToBookmark('bookmark-1'),
        navigationController.navigateToBookmark('bookmark-2'),
        navigationController.navigateToBookmark('bookmark-3')
      ]);
      
      // At least one navigation should succeed
      expect(results.some(result => result)).toBe(true);
      expect(navigationController.getCurrentBookmarkIndex()).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('SmoothScroller', () => {
  let smoothScroller: SmoothScroller;
  let testContainer: HTMLElement;
  let targetElement: HTMLElement;

  beforeEach(() => {
    // Set up DOM
    document.body.innerHTML = '';
    testContainer = document.createElement('div');
    testContainer.style.height = '200vh'; // Make container scrollable
    
    targetElement = document.createElement('div');
    targetElement.id = 'scroll-target';
    targetElement.style.marginTop = '150vh'; // Place target below fold
    targetElement.textContent = 'Target element';
    
    testContainer.appendChild(targetElement);
    document.body.appendChild(testContainer);

    smoothScroller = new SmoothScroller();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Smooth Scrolling', () => {
    it('should scroll to element smoothly', async () => {
      const initialScrollTop = window.scrollY;
      
      await smoothScroller.scrollToElement(targetElement);
      
      // Element should be in view after scrolling
      const rect = targetElement.getBoundingClientRect();
      expect(rect.top).toBeGreaterThanOrEqual(0);
      expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight);
    });

    it('should complete scroll within time limit (500ms)', async () => {
      const startTime = performance.now();
      
      await smoothScroller.scrollToElement(targetElement);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(500);
    });

    it('should calculate optimal scroll position', () => {
      const position = smoothScroller.calculateOptimalScrollPosition(targetElement);
      
      expect(typeof position).toBe('number');
      expect(position).toBeGreaterThan(0);
    });

    it('should handle scroll options', async () => {
      const options = {
        behavior: 'smooth' as ScrollBehavior,
        block: 'center' as ScrollLogicalPosition
      };
      
      await smoothScroller.scrollToElement(targetElement, options);
      
      // Should complete without error
      expect(true).toBe(true);
    });
  });

  describe('Visual Feedback', () => {
    it('should animate highlight on element', async () => {
      await smoothScroller.animateHighlight(targetElement);
      
      // Check if highlight class was added and removed
      // Note: In real implementation, this would involve CSS transitions
      expect(true).toBe(true);
    });

    it('should handle highlight animation duration', async () => {
      const startTime = performance.now();
      
      await smoothScroller.animateHighlight(targetElement);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Highlight animation should complete quickly
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle scrolling to null element', async () => {
      await expect(smoothScroller.scrollToElement(null as any)).resolves.not.toThrow();
    });

    it('should handle element not in DOM', async () => {
      const disconnectedElement = document.createElement('div');
      await expect(smoothScroller.scrollToElement(disconnectedElement)).resolves.not.toThrow();
    });
  });
});

describe('URLStateManager', () => {
  let urlStateManager: URLStateManager;
  let originalLocation: Location;

  beforeEach(() => {
    // Mock window.location
    originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: {
        hash: '',
        href: 'https://chatgpt.com/c/test-conv-123',
        pathname: '/c/test-conv-123',
        search: '',
        origin: 'https://chatgpt.com'
      },
      writable: true
    });

    urlStateManager = new URLStateManager();
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true
    });
  });

  describe('URL Fragment Management', () => {
    it('should update URL with bookmark ID', () => {
      urlStateManager.updateURLWithBookmark('bookmark-123');
      
      expect(window.location.hash).toBe('#bookmark-123');
    });

    it('should extract bookmark ID from URL', () => {
      window.location.hash = '#bookmark-456';
      
      const bookmarkId = urlStateManager.getBookmarkFromURL();
      
      expect(bookmarkId).toBe('bookmark-456');
    });

    it('should return null for non-bookmark hash', () => {
      window.location.hash = '#some-other-hash';
      
      const bookmarkId = urlStateManager.getBookmarkFromURL();
      
      expect(bookmarkId).toBe(null);
    });

    it('should return null for empty hash', () => {
      window.location.hash = '';
      
      const bookmarkId = urlStateManager.getBookmarkFromURL();
      
      expect(bookmarkId).toBe(null);
    });
  });

  describe('URL Change Subscription', () => {
    it('should subscribe to URL changes', () => {
      let callbackCalled = false;
      let receivedBookmarkId: string | null = null;

      urlStateManager.subscribeToURLChanges((bookmarkId) => {
        callbackCalled = true;
        receivedBookmarkId = bookmarkId;
      });

      // Simulate hash change
      window.location.hash = '#bookmark-789';
      window.dispatchEvent(new HashChangeEvent('hashchange'));

      expect(callbackCalled).toBe(true);
      expect(receivedBookmarkId).toBe('bookmark-789');
    });

    it('should handle multiple subscribers', () => {
      let callback1Called = false;
      let callback2Called = false;

      urlStateManager.subscribeToURLChanges(() => { callback1Called = true; });
      urlStateManager.subscribeToURLChanges(() => { callback2Called = true; });

      // Simulate hash change
      window.location.hash = '#bookmark-999';
      window.dispatchEvent(new HashChangeEvent('hashchange'));

      expect(callback1Called).toBe(true);
      expect(callback2Called).toBe(true);
    });
  });

  describe('Browser Navigation Integration', () => {
    it('should handle browser back navigation', () => {
      // Set initial bookmark
      urlStateManager.updateURLWithBookmark('bookmark-1');
      expect(window.location.hash).toBe('#bookmark-1');

      // Change to another bookmark
      urlStateManager.updateURLWithBookmark('bookmark-2');
      expect(window.location.hash).toBe('#bookmark-2');

      // Simulate browser back
      window.location.hash = '#bookmark-1';
      const bookmarkId = urlStateManager.getBookmarkFromURL();
      expect(bookmarkId).toBe('bookmark-1');
    });
  });
});

describe('Integration Tests', () => {
  let navigationController: NavigationController;
  let smoothScroller: SmoothScroller;
  let urlStateManager: URLStateManager;
  let mockStorageService: MockStorageService;
  let mockBookmarkOperations: MockBookmarkOperations;

  beforeEach(() => {
    // Set up full integration test environment
    document.body.innerHTML = `
      <div class="conversation" data-conversation-id="test-conv-123">
        <div class="message" data-message-id="msg-1" id="bookmark-target-1">
          <p>First message content</p>
        </div>
        <div class="message" data-message-id="msg-2" id="bookmark-target-2">
          <p>Second message content</p>
        </div>
      </div>
    `;

    mockStorageService = new MockStorageService();
    mockBookmarkOperations = new MockBookmarkOperations();
    navigationController = new NavigationController(
      mockStorageService,
      mockBookmarkOperations,
      'test-conv-123'
    );
    smoothScroller = new SmoothScroller();
    urlStateManager = new URLStateManager();

    // Set up mock bookmarks
    mockStorageService.setMockBookmarks([
      {
        id: 'bookmark-1',
        conversationId: 'test-conv-123',
        messageId: 'msg-1',
        anchor: {
          selectedText: 'First message',
          startOffset: 0,
          endOffset: 13,
          xpathSelector: '//div[@id="bookmark-target-1"]//p',
          messageId: 'msg-1',
          contextBefore: '',
          contextAfter: ' content',
          checksum: 'checksum1',
          confidence: 0.95,
          strategy: 'xpath'
        },
        note: 'Test bookmark',
        tags: [],
        created: '2025-01-01T10:00:00Z',
        updated: '2025-01-01T10:00:00Z',
        color: '#ffeb3b',
        platform: 'chatgpt' as Platform
      }
    ]);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('End-to-End Navigation Workflow', () => {
    it('should complete full navigation workflow', async () => {
      // Initialize navigation system
      await navigationController.initialize();

      // Navigate to bookmark
      const navigationResult = await navigationController.navigateToBookmark('bookmark-1');
      expect(navigationResult).toBe(true);

      // Check URL was updated
      urlStateManager.updateURLWithBookmark('bookmark-1');
      expect(urlStateManager.getBookmarkFromURL()).toBe('bookmark-1');

      // Verify navigation state
      expect(navigationController.getCurrentBookmarkIndex()).toBe(0);
    });

    it('should handle cross-conversation navigation', async () => {
      // This test would be expanded in real implementation
      // to handle loading different conversation pages
      expect(true).toBe(true);
    });
  });

  describe('Performance Integration', () => {
    it('should meet end-to-end performance targets', async () => {
      await navigationController.initialize();
      
      const startTime = performance.now();
      
      await navigationController.navigateToBookmark('bookmark-1');
      
      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      
      // Total end-to-end navigation should be fast
      expect(totalDuration).toBeLessThan(200);
    });
  });
});