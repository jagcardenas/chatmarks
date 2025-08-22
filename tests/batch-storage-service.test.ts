/**
 * Test suite for BatchStorageService
 *
 * Tests batch operations, performance optimization, and bulk data handling.
 */

import { Bookmark, Platform, TextAnchor } from '../src/types/bookmark';

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

import { BatchStorageService } from '../src/content/storage/BatchStorageService';

describe('BatchStorageService', () => {
  let batchStorageService: BatchStorageService;

  beforeEach(() => {
    batchStorageService = new BatchStorageService();
    jest.clearAllMocks();
  });

  describe('Batch Operations', () => {
    test('should save multiple bookmarks in batch within 500ms', async () => {
      // Arrange
      const bookmarks = Array.from({ length: 100 }, (_, i) => ({
        id: `batch-bookmark-${i}`,
        platform: 'chatgpt' as Platform,
        conversationId: 'conv-123',
        messageId: `msg-${i}`,
        anchor: {
          selectedText: `Selected text ${i}`,
          startOffset: 0,
          endOffset: 10,
          xpathSelector: `//div[@data-message-id="msg-${i}"]`,
          messageId: `msg-${i}`,
          contextBefore: 'context before',
          contextAfter: 'context after',
          checksum: `checksum-${i}`,
          confidence: 0.95,
          strategy: 'xpath' as const,
        } as TextAnchor,
        note: `Note ${i}`,
        tags: ['batch', 'test'],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        color: '#ffeb3b',
      }));

      mockChromeStorage.local.get.mockResolvedValue({ bookmarks: [] });
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      // Act
      const startTime = performance.now();
      const result = await batchStorageService.saveBatch(bookmarks);
      const endTime = performance.now();

      // Assert
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(500); // <500ms target for batch operations
      expect(result.successful).toHaveLength(100);
      expect(result.failed).toHaveLength(0);
      expect(mockChromeStorage.local.set).toHaveBeenCalled();
    });

    test('should delete multiple bookmarks in batch', async () => {
      // Arrange
      const bookmarksToKeep = [
        { id: 'keep-1', platform: 'chatgpt' as Platform },
        { id: 'keep-2', platform: 'claude' as Platform },
      ];
      const bookmarksToDelete = [
        { id: 'delete-1', platform: 'chatgpt' as Platform },
        { id: 'delete-2', platform: 'grok' as Platform },
      ];
      const allBookmarks = [...bookmarksToKeep, ...bookmarksToDelete];

      mockChromeStorage.local.get.mockResolvedValue({
        bookmarks: allBookmarks,
      });
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      // Act
      const result = await batchStorageService.deleteBatch([
        'delete-1',
        'delete-2',
      ]);

      // Assert
      expect(result.successful).toEqual(['delete-1', 'delete-2']);
      expect(result.failed).toHaveLength(0);
      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        bookmarks: bookmarksToKeep,
      });
    });

    test('should handle partial failures in batch operations', async () => {
      // Arrange
      const validBookmarks = [
        {
          id: 'valid-1',
          platform: 'chatgpt' as Platform,
          conversationId: 'conv-1',
          messageId: 'msg-1',
          anchor: {
            selectedText: 'text',
            startOffset: 0,
            endOffset: 4,
            xpathSelector: '//div',
            messageId: 'msg-1',
            contextBefore: '',
            contextAfter: '',
            checksum: 'abc',
            confidence: 0.9,
            strategy: 'xpath' as const,
          } as TextAnchor,
          note: '',
          tags: [],
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          color: '#ffeb3b',
        },
        {
          id: 'valid-2',
          platform: 'claude' as Platform,
          conversationId: 'conv-2',
          messageId: 'msg-2',
          anchor: {
            selectedText: 'text2',
            startOffset: 0,
            endOffset: 5,
            xpathSelector: '//div',
            messageId: 'msg-2',
            contextBefore: '',
            contextAfter: '',
            checksum: 'def',
            confidence: 0.9,
            strategy: 'xpath' as const,
          } as TextAnchor,
          note: '',
          tags: [],
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          color: '#ffeb3b',
        },
      ];
      const invalidBookmarks = [
        { id: '', platform: 'chatgpt' as Platform }, // Invalid: empty ID
      ];

      mockChromeStorage.local.get.mockResolvedValue({ bookmarks: [] });
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      // Act
      const result = await batchStorageService.saveBatch([
        ...validBookmarks,
        ...invalidBookmarks,
      ] as Bookmark[]);

      // Assert
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]?.error).toContain('ID cannot be empty');
    });

    test('should chunk large batch operations', async () => {
      // Arrange
      const largeBookmarkSet = Array.from(
        { length: 1000 },
        (_, i) =>
          ({
            id: `large-batch-${i}`,
            platform: 'chatgpt' as Platform,
            conversationId: 'conv-large',
            messageId: `msg-${i}`,
            anchor: {
              selectedText: `text-${i}`,
              startOffset: 0,
              endOffset: 5,
              xpathSelector: '//div',
              messageId: `msg-${i}`,
              contextBefore: '',
              contextAfter: '',
              checksum: `checksum-${i}`,
              confidence: 0.9,
              strategy: 'xpath' as const,
            } as TextAnchor,
            note: '',
            tags: [],
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            color: '#ffeb3b',
          }) as Bookmark
      );

      mockChromeStorage.local.get.mockResolvedValue({ bookmarks: [] });
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      // Act
      const result = await batchStorageService.saveBatch(largeBookmarkSet, {
        chunkSize: 100,
      });

      // Assert
      expect(result.successful).toHaveLength(1000);
      expect(result.chunksProcessed).toBe(10); // 1000/100 = 10 chunks
      // Should make multiple set calls for chunked operations
      expect(mockChromeStorage.local.set).toHaveBeenCalledTimes(10);
    });
  });

  describe('Performance and Statistics', () => {
    test('should provide batch operation statistics', async () => {
      // Arrange
      const bookmarks = Array.from({ length: 500 }, (_, i) => ({
        id: `bm-${i}`,
      }));
      mockChromeStorage.local.get.mockResolvedValue({ bookmarks });

      // Act
      const stats = await batchStorageService.getBatchStats();

      // Assert
      expect(stats.totalBookmarks).toBe(500);
      expect(stats.estimatedBatchTime).toBeGreaterThan(0);
      expect(stats.recommendedChunkSize).toBeGreaterThan(0);
    });
  });

  describe('IndexedDB Integration', () => {
    test('should sync to IndexedDB after batch operations', async () => {
      // Arrange
      const bookmarks = [
        { id: 'sync-1', platform: 'chatgpt' as Platform } as Bookmark,
      ];

      mockChromeStorage.local.get.mockResolvedValue({ bookmarks: [] });
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      // Mock IndexedDB operations
      const mockSyncToIndexedDB = jest.spyOn(
        batchStorageService,
        'syncToIndexedDB'
      );
      mockSyncToIndexedDB.mockResolvedValue();

      // Act
      await batchStorageService.saveBatch(bookmarks);

      // Assert
      expect(mockSyncToIndexedDB).toHaveBeenCalled();
    });
  });
});
