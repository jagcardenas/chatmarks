/**
 * Comprehensive test suite for Chrome Storage Integration (Task 8)
 *
 * Tests cover CRUD operations, error handling, performance benchmarks,
 * batch operations, and data migration functionality.
 *
 * Following TDD methodology: Tests written first to define expected behavior.
 */

import {
  Bookmark,
  BookmarkFilters,
  Platform,
  TextAnchor,
} from '../src/types/bookmark';

// Chrome API mocks
const mockChromeStorage = {
  local: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn(),
  },
};

// Setup Chrome API mock
Object.defineProperty(global, 'chrome', {
  value: {
    storage: mockChromeStorage,
  },
  writable: true,
});

// Import after Chrome mock is set up
import { StorageService } from '../src/content/storage/StorageService';

describe('StorageService', () => {
  let storageService: StorageService;

  // Define sample bookmark at the describe level so it's accessible to all tests
  const sampleBookmark: Bookmark = {
    id: 'test-bookmark-1',
    platform: 'chatgpt' as Platform,
    conversationId: 'conv-123',
    messageId: 'msg-456',
    anchor: {
      selectedText: 'Sample selected text',
      startOffset: 0,
      endOffset: 20,
      xpathSelector: '//div[@data-message-id="msg-456"]/p[1]',
      messageId: 'msg-456',
      contextBefore: 'This is context before ',
      contextAfter: ' and context after selection',
      checksum: 'abc123def456',
      confidence: 0.95,
      strategy: 'xpath' as const,
    } as TextAnchor,
    note: 'Test bookmark note',
    tags: ['test', 'sample'],
    created: '2024-01-01T00:00:00.000Z',
    updated: '2024-01-01T00:00:00.000Z',
    color: '#ffeb3b',
  };

  beforeEach(() => {
    storageService = new StorageService();
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('Basic CRUD Operations', () => {
    test('should save bookmark successfully', async () => {
      // Arrange
      mockChromeStorage.local.get.mockResolvedValue({ bookmarks: [] });
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      // Act
      await storageService.saveBookmark(sampleBookmark);

      // Assert
      expect(mockChromeStorage.local.get).toHaveBeenCalledWith('bookmarks');
      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        bookmarks: [
          expect.objectContaining({
            ...sampleBookmark,
            updated: expect.any(String), // Updated timestamp will be different
          }),
        ],
      });
    });

    test('should retrieve bookmark by ID', async () => {
      // Arrange
      mockChromeStorage.local.get.mockResolvedValue({
        bookmarks: [sampleBookmark],
      });

      // Act
      const result = await storageService.getBookmark(sampleBookmark.id);

      // Assert
      expect(result).toEqual(sampleBookmark);
      expect(mockChromeStorage.local.get).toHaveBeenCalledWith('bookmarks');
    });

    test('should return null for non-existent bookmark', async () => {
      // Arrange
      mockChromeStorage.local.get.mockResolvedValue({ bookmarks: [] });

      // Act
      const result = await storageService.getBookmark('non-existent');

      // Assert
      expect(result).toBeNull();
    });

    test('should retrieve all bookmarks', async () => {
      // Arrange
      const bookmarks = [sampleBookmark];
      mockChromeStorage.local.get.mockResolvedValue({ bookmarks });

      // Act
      const result = await storageService.getBookmarks();

      // Assert
      expect(result).toEqual(bookmarks);
      expect(mockChromeStorage.local.get).toHaveBeenCalledWith('bookmarks');
    });

    test('should update bookmark successfully', async () => {
      // Arrange
      const updatedNote = 'Updated bookmark note';
      const updatedTags = ['updated', 'test'];
      mockChromeStorage.local.get.mockResolvedValue({
        bookmarks: [sampleBookmark],
      });
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      // Act
      const result = await storageService.updateBookmark(sampleBookmark.id, {
        note: updatedNote,
        tags: updatedTags,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.bookmark?.note).toBe(updatedNote);
      expect(result.bookmark?.tags).toEqual(updatedTags);
      expect(mockChromeStorage.local.set).toHaveBeenCalled();
    });

    test('should delete bookmark successfully', async () => {
      // Arrange
      mockChromeStorage.local.get.mockResolvedValue({
        bookmarks: [sampleBookmark],
      });
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      // Act
      await storageService.deleteBookmark(sampleBookmark.id);

      // Assert
      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        bookmarks: [],
      });
    });

    test('should filter bookmarks by conversation ID', async () => {
      // Arrange
      const bookmark1 = {
        ...sampleBookmark,
        id: 'bm1',
        conversationId: 'conv-123',
      };
      const bookmark2 = {
        ...sampleBookmark,
        id: 'bm2',
        conversationId: 'conv-456',
      };
      mockChromeStorage.local.get.mockResolvedValue({
        bookmarks: [bookmark1, bookmark2],
      });

      const filters: BookmarkFilters = { conversationId: 'conv-123' };

      // Act
      const result = await storageService.getBookmarks(filters);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]?.conversationId).toBe('conv-123');
    });

    test('should filter bookmarks by platform', async () => {
      // Arrange
      const bookmark1 = {
        ...sampleBookmark,
        id: 'bm1',
        platform: 'chatgpt' as Platform,
      };
      const bookmark2 = {
        ...sampleBookmark,
        id: 'bm2',
        platform: 'claude' as Platform,
      };
      mockChromeStorage.local.get.mockResolvedValue({
        bookmarks: [bookmark1, bookmark2],
      });

      const filters: BookmarkFilters = { platform: 'claude' };

      // Act
      const result = await storageService.getBookmarks(filters);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]?.platform).toBe('claude');
    });

    test('should filter bookmarks by tags', async () => {
      // Arrange
      const bookmark1 = {
        ...sampleBookmark,
        id: 'bm1',
        tags: ['work', 'important'],
      };
      const bookmark2 = {
        ...sampleBookmark,
        id: 'bm2',
        tags: ['personal', 'notes'],
      };
      mockChromeStorage.local.get.mockResolvedValue({
        bookmarks: [bookmark1, bookmark2],
      });

      const filters: BookmarkFilters = { tags: ['work'] };

      // Act
      const result = await storageService.getBookmarks(filters);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]?.tags).toContain('work');
    });

    test('should search bookmarks by text content', async () => {
      // Arrange
      const bookmark1 = {
        ...sampleBookmark,
        id: 'bm1',
        note: 'Important machine learning concepts',
        anchor: { ...sampleBookmark.anchor, selectedText: 'neural networks' },
      };
      const bookmark2 = {
        ...sampleBookmark,
        id: 'bm2',
        note: 'Random thoughts',
        anchor: { ...sampleBookmark.anchor, selectedText: 'weather patterns' },
      };
      mockChromeStorage.local.get.mockResolvedValue({
        bookmarks: [bookmark1, bookmark2],
      });

      const filters: BookmarkFilters = { searchText: 'machine learning' };

      // Act
      const result = await storageService.getBookmarks(filters);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]?.note).toContain('machine learning');
    });
  });

  describe('Error Handling', () => {
    test('should handle Chrome storage errors gracefully', async () => {
      // Arrange
      const storageError = new Error('Storage quota exceeded');
      mockChromeStorage.local.get.mockRejectedValue(storageError);

      // Act & Assert
      await expect(storageService.getBookmarks()).rejects.toThrow(
        'Failed to retrieve bookmarks: Storage quota exceeded'
      );
    });

    test('should validate bookmark data before saving', async () => {
      // Arrange
      const invalidBookmark = { ...sampleBookmark, id: '' };

      // Act & Assert
      await expect(
        storageService.saveBookmark(invalidBookmark)
      ).rejects.toThrow('Invalid bookmark data: ID cannot be empty');
    });

    test('should handle missing bookmark for update', async () => {
      // Arrange
      mockChromeStorage.local.get.mockResolvedValue({ bookmarks: [] });

      // Act
      const result = await storageService.updateBookmark('non-existent', {
        note: 'test',
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Bookmark not found');
    });

    test('should handle concurrent modifications safely', async () => {
      // Arrange
      mockChromeStorage.local.get.mockResolvedValue({
        bookmarks: [sampleBookmark],
      });

      // Simulate concurrent modification by changing storage between get and set
      let callCount = 0;
      mockChromeStorage.local.set.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call fails due to concurrent modification
          return Promise.reject(new Error('Concurrent modification detected'));
        }
        return Promise.resolve();
      });

      // Mock saveImmediate to call chrome.storage directly for this test
      (storageService as any).saveImmediate = async (
        key: string,
        data: any
      ) => {
        await chrome.storage.local.set({ [key]: data });
      };

      // Act
      const result = await storageService.updateBookmark(sampleBookmark.id, {
        note: 'updated',
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Concurrent modification');
    });
  });

  describe('Performance Requirements', () => {
    test('should save bookmark within 100ms target', async () => {
      // Arrange
      mockChromeStorage.local.get.mockResolvedValue({ bookmarks: [] });
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      // Act
      const startTime = performance.now();
      await storageService.saveBookmark(sampleBookmark);
      const endTime = performance.now();

      // Assert
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(100); // <100ms target
    });

    test('should retrieve bookmarks within 50ms target', async () => {
      // Arrange
      const bookmarks = Array.from({ length: 100 }, (_, i) => ({
        ...sampleBookmark,
        id: `bookmark-${i}`,
      }));
      mockChromeStorage.local.get.mockResolvedValue({ bookmarks });

      // Act
      const startTime = performance.now();
      await storageService.getBookmarks();
      const endTime = performance.now();

      // Assert
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(50); // <50ms target
    });

    test('should handle large datasets efficiently (1000+ bookmarks)', async () => {
      // Arrange
      const bookmarks = Array.from({ length: 1000 }, (_, i) => ({
        ...sampleBookmark,
        id: `bookmark-${i}`,
        conversationId: `conv-${Math.floor(i / 100)}`, // 10 conversations
      }));
      mockChromeStorage.local.get.mockResolvedValue({ bookmarks });

      // Act
      const startTime = performance.now();
      const result = await storageService.getBookmarks({
        conversationId: 'conv-5',
      });
      const endTime = performance.now();

      // Assert
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(100); // Should remain fast with filtering
      expect(result).toHaveLength(100); // Should return correct filtered results
    });

    test('should maintain memory efficiency', async () => {
      // Arrange
      const initialMemory = process.memoryUsage().heapUsed;
      const bookmarks = Array.from({ length: 1000 }, (_, i) => ({
        ...sampleBookmark,
        id: `bookmark-${i}`,
      }));
      mockChromeStorage.local.get.mockResolvedValue({ bookmarks });

      // Act
      await storageService.getBookmarks();
      const finalMemory = process.memoryUsage().heapUsed;

      // Assert
      const memoryIncrease = finalMemory - initialMemory;
      const expectedMaxIncrease = 1000 * 1024; // 1KB per bookmark target
      expect(memoryIncrease).toBeLessThan(expectedMaxIncrease);
    });
  });

  describe('Data Integrity', () => {
    test('should maintain bookmark count consistency', async () => {
      // Arrange
      const initialBookmarks = [sampleBookmark];
      mockChromeStorage.local.get
        .mockResolvedValueOnce({ bookmarks: initialBookmarks })
        .mockResolvedValueOnce({ bookmarks: initialBookmarks })
        .mockResolvedValue({ bookmarks: [] });
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      // Act
      await storageService.deleteBookmark(sampleBookmark.id);

      // Assert
      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        bookmarks: [],
      });
    });

    test('should preserve bookmark timestamps on update', async () => {
      // Arrange
      const originalBookmark = { ...sampleBookmark };
      mockChromeStorage.local.get.mockResolvedValue({
        bookmarks: [originalBookmark],
      });
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      // Act
      const result = await storageService.updateBookmark(sampleBookmark.id, {
        note: 'updated note',
      });

      // Assert
      expect(result.bookmark?.created).toBe(originalBookmark.created);
      expect(result.bookmark?.updated).not.toBe(originalBookmark.updated);
      expect(new Date(result.bookmark!.updated).getTime()).toBeGreaterThan(
        new Date(originalBookmark.updated).getTime()
      );
    });

    test('should validate required bookmark fields', async () => {
      // Arrange
      const requiredFields = [
        'id',
        'platform',
        'conversationId',
        'messageId',
        'anchor',
        'created',
      ];

      // Act & Assert
      for (const field of requiredFields) {
        const invalidBookmark = { ...sampleBookmark };
        delete (invalidBookmark as any)[field];

        await expect(
          storageService.saveBookmark(invalidBookmark)
        ).rejects.toThrow('Invalid bookmark data:');
      }
    });
  });
});
