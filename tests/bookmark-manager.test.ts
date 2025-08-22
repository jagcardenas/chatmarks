/**
 * BookmarkManager Test Suite
 *
 * Comprehensive tests for the BookmarkManager class following TDD methodology.
 * Tests the coordination between TextSelection, AnchorSystem, and StorageService
 * with complete coverage of CRUD operations, validation, and error handling.
 */

import { BookmarkManager } from '../src/content/bookmarks/BookmarkManager';
import { BookmarkEvents } from '../src/content/bookmarks/BookmarkEvents';
import { StorageService } from '../src/content/storage/StorageService';
import { AnchorSystem } from '../src/content/anchoring/AnchorSystem';
import { TextSelection } from '../src/content/selection/TextSelection';
import {
  Bookmark,
  CreateBookmarkData,
  UpdateBookmarkData,
  BookmarkFilters,
  Platform,
  TextAnchor,
} from '../src/types/bookmark';

// Mock Chrome APIs
const mockChromeStorage = {
  local: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn(),
  },
};

(global as any).chrome = {
  storage: mockChromeStorage,
};

describe('BookmarkManager', () => {
  let bookmarkManager: BookmarkManager;
  let mockStorageService: jest.Mocked<StorageService>;
  let mockAnchorSystem: jest.Mocked<AnchorSystem>;
  let mockTextSelection: jest.Mocked<TextSelection>;
  let mockEventSystem: jest.Mocked<BookmarkEvents>;

  // Sample test data
  const sampleAnchor: TextAnchor = {
    selectedText: 'sample text',
    startOffset: 0,
    endOffset: 11,
    xpathSelector: '//div[@id="message1"]/p[1]/text()[1]',
    messageId: 'msg-123',
    contextBefore: 'This is ',
    contextAfter: ' content',
    checksum: 'abc123',
    confidence: 0.95,
    strategy: 'xpath',
  };

  const sampleBookmark: Bookmark = {
    id: 'bookmark-123',
    platform: 'chatgpt' as Platform,
    conversationId: 'conv-456',
    messageId: 'msg-123',
    anchor: sampleAnchor,
    note: 'Important point',
    tags: ['important', 'ai'],
    created: '2024-01-01T00:00:00.000Z',
    updated: '2024-01-01T00:00:00.000Z',
    color: '#ffeb3b',
  };

  const sampleRange = {
    toString: () => 'sample text',
    getBoundingClientRect: () => ({
      top: 100,
      left: 50,
      width: 200,
      height: 20,
      bottom: 120,
      right: 250,
    }),
    commonAncestorContainer: {
      textContent: 'This is sample text content',
    },
  } as Range;

  const sampleCreateData: CreateBookmarkData = {
    platform: 'chatgpt' as Platform,
    conversationId: 'conv-456',
    messageId: 'msg-123',
    selectedText: 'sample text',
    selectionRange: sampleRange,
    messageElement: document.createElement('div'),
    note: 'Test note',
    tags: ['test'],
    color: '#ffeb3b',
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock StorageService
    mockStorageService = {
      saveBookmark: jest.fn(),
      getBookmark: jest.fn(),
      getBookmarks: jest.fn(),
      updateBookmark: jest.fn(),
      deleteBookmark: jest.fn(),
      getBookmarkCount: jest.fn(),
      clearAllBookmarks: jest.fn(),
      validateBookmark: jest.fn(),
      getSchemaVersion: jest.fn(),
      updateSchemaVersion: jest.fn(),
    } as any;

    // Mock AnchorSystem
    mockAnchorSystem = {
      createAnchor: jest.fn(),
      resolveAnchor: jest.fn(),
      validateAnchor: jest.fn(),
      getPerformanceMetrics: jest.fn(),
    } as any;

    // Mock TextSelection
    mockTextSelection = {
      validateSelection: jest.fn(),
      captureRange: jest.fn(),
      normalizeText: jest.fn(),
      getSelectionContext: jest.fn(),
    } as any;

    // Mock BookmarkEvents
    mockEventSystem = {
      emitBookmarkCreated: jest.fn(),
      emitBookmarkUpdated: jest.fn(),
      emitBookmarkDeleted: jest.fn(),
      emitBookmarkError: jest.fn(),
      emitBatchOperation: jest.fn(),
    } as any;

    // Create BookmarkManager with mocked dependencies
    bookmarkManager = new BookmarkManager(
      mockStorageService,
      mockAnchorSystem,
      mockTextSelection
    );

    // Replace event system with mock
    (bookmarkManager as any).eventSystem = mockEventSystem;

    // Setup default mock returns
    mockTextSelection.validateSelection.mockReturnValue(true);
    mockAnchorSystem.createAnchor.mockReturnValue(sampleAnchor);
    mockStorageService.saveBookmark.mockResolvedValue(undefined);
    mockStorageService.updateBookmark.mockResolvedValue({
      success: true,
      bookmark: sampleBookmark,
    });
  });

  describe('Constructor', () => {
    it('should create BookmarkManager with default dependencies', () => {
      const manager = new BookmarkManager();
      expect(manager).toBeInstanceOf(BookmarkManager);
    });

    it('should create BookmarkManager with custom dependencies', () => {
      const manager = new BookmarkManager(
        mockStorageService,
        mockAnchorSystem,
        mockTextSelection
      );
      expect(manager).toBeInstanceOf(BookmarkManager);
    });
  });

  describe('createBookmark', () => {
    it('should create bookmark with valid data', async () => {
      // Mock crypto.randomUUID
      const mockUUID = 'test-uuid-123';
      Object.defineProperty(global, 'crypto', {
        value: { randomUUID: () => mockUUID },
        writable: true,
      });

      const result = await bookmarkManager.createBookmark(sampleCreateData);

      expect(mockTextSelection.validateSelection).toHaveBeenCalledWith(
        sampleRange
      );
      expect(mockAnchorSystem.createAnchor).toHaveBeenCalled();
      expect(mockStorageService.saveBookmark).toHaveBeenCalled();
      expect(mockEventSystem.emitBookmarkCreated).toHaveBeenCalledWith(result);
      expect(result.id).toBe(mockUUID);
      expect(result.anchor.selectedText).toBe('sample text');
    });

    it('should validate selection before creating bookmark', async () => {
      mockTextSelection.validateSelection.mockReturnValue(false);

      await expect(
        bookmarkManager.createBookmark(sampleCreateData)
      ).rejects.toThrow('Invalid selection range provided');

      expect(mockTextSelection.validateSelection).toHaveBeenCalledWith(
        sampleRange
      );
      expect(mockAnchorSystem.createAnchor).not.toHaveBeenCalled();
      expect(mockStorageService.saveBookmark).not.toHaveBeenCalled();
    });

    it('should handle anchor creation errors', async () => {
      mockAnchorSystem.createAnchor.mockImplementation(() => {
        throw new Error('Anchor creation failed');
      });

      await expect(
        bookmarkManager.createBookmark(sampleCreateData)
      ).rejects.toThrow('Failed to create bookmark: Anchor creation failed');

      expect(mockEventSystem.emitBookmarkError).toHaveBeenCalledWith(
        'create',
        'Anchor creation failed'
      );
    });

    it('should handle storage errors during bookmark creation', async () => {
      mockStorageService.saveBookmark.mockRejectedValue(
        new Error('Storage failed')
      );

      await expect(
        bookmarkManager.createBookmark(sampleCreateData)
      ).rejects.toThrow('Failed to create bookmark: Storage failed');

      expect(mockEventSystem.emitBookmarkError).toHaveBeenCalledWith(
        'create',
        'Storage failed'
      );
    });

    it('should set default values for optional fields', async () => {
      const minimalData: CreateBookmarkData = {
        platform: 'chatgpt' as Platform,
        conversationId: 'conv-456',
        messageId: 'msg-123',
        selectedText: 'sample text',
        selectionRange: sampleRange,
        messageElement: document.createElement('div'),
      };

      const result = await bookmarkManager.createBookmark(minimalData);

      expect(result.note).toBe('');
      expect(result.tags).toEqual([]);
      expect(result.color).toBe('#ffeb3b');
      expect(result.created).toBeDefined();
      expect(result.updated).toBeDefined();
    });

    it('should create anchor with correct selection range data', async () => {
      await bookmarkManager.createBookmark(sampleCreateData);

      expect(mockAnchorSystem.createAnchor).toHaveBeenCalledWith({
        selectedText: 'sample text',
        range: sampleRange,
        boundingRect: sampleRange.getBoundingClientRect(),
        contextBefore: 'This is ',
        contextAfter: ' content',
        startOffset: 0,
        endOffset: 11,
        messageId: 'msg-123',
        conversationId: 'conv-456',
        timestamp: expect.any(String),
      });
    });
  });

  describe('updateBookmark', () => {
    const updateData: UpdateBookmarkData = {
      note: 'Updated note',
      tags: ['updated', 'test'],
      color: '#ff9800',
    };

    it('should update bookmark with valid data', async () => {
      mockStorageService.getBookmark.mockResolvedValue(sampleBookmark);

      const result = await bookmarkManager.updateBookmark(
        'bookmark-123',
        updateData
      );

      expect(mockStorageService.getBookmark).toHaveBeenCalledWith(
        'bookmark-123'
      );
      expect(mockStorageService.updateBookmark).toHaveBeenCalledWith(
        'bookmark-123',
        updateData
      );
      expect(mockEventSystem.emitBookmarkUpdated).toHaveBeenCalledWith(result);
      expect(result).toBe(sampleBookmark);
    });

    it('should throw error if bookmark not found', async () => {
      mockStorageService.getBookmark.mockResolvedValue(null);

      await expect(
        bookmarkManager.updateBookmark('nonexistent', updateData)
      ).rejects.toThrow('Bookmark with ID nonexistent not found');

      expect(mockStorageService.updateBookmark).not.toHaveBeenCalled();
      expect(mockEventSystem.emitBookmarkError).toHaveBeenCalledWith(
        'update',
        'Bookmark with ID nonexistent not found'
      );
    });

    it('should handle storage update failures', async () => {
      mockStorageService.getBookmark.mockResolvedValue(sampleBookmark);
      mockStorageService.updateBookmark.mockResolvedValue({
        success: false,
        error: 'Update failed',
      });

      await expect(
        bookmarkManager.updateBookmark('bookmark-123', updateData)
      ).rejects.toThrow('Failed to update bookmark: Update failed');

      expect(mockEventSystem.emitBookmarkError).toHaveBeenCalledWith(
        'update',
        'Update failed'
      );
    });

    it('should handle storage errors during update', async () => {
      mockStorageService.getBookmark.mockRejectedValue(
        new Error('Storage error')
      );

      await expect(
        bookmarkManager.updateBookmark('bookmark-123', updateData)
      ).rejects.toThrow('Failed to update bookmark: Storage error');

      expect(mockEventSystem.emitBookmarkError).toHaveBeenCalledWith(
        'update',
        'Storage error'
      );
    });
  });

  describe('deleteBookmark', () => {
    it('should delete existing bookmark', async () => {
      mockStorageService.getBookmark.mockResolvedValue(sampleBookmark);
      mockStorageService.deleteBookmark.mockResolvedValue(undefined);

      await bookmarkManager.deleteBookmark('bookmark-123');

      expect(mockStorageService.getBookmark).toHaveBeenCalledWith(
        'bookmark-123'
      );
      expect(mockStorageService.deleteBookmark).toHaveBeenCalledWith(
        'bookmark-123'
      );
      expect(mockEventSystem.emitBookmarkDeleted).toHaveBeenCalledWith(
        'bookmark-123'
      );
    });

    it('should throw error if bookmark not found for deletion', async () => {
      mockStorageService.getBookmark.mockResolvedValue(null);

      await expect(
        bookmarkManager.deleteBookmark('nonexistent')
      ).rejects.toThrow('Bookmark with ID nonexistent not found');

      expect(mockStorageService.deleteBookmark).not.toHaveBeenCalled();
      expect(mockEventSystem.emitBookmarkError).toHaveBeenCalledWith(
        'delete',
        'Bookmark with ID nonexistent not found'
      );
    });

    it('should handle storage errors during deletion', async () => {
      mockStorageService.getBookmark.mockResolvedValue(sampleBookmark);
      mockStorageService.deleteBookmark.mockRejectedValue(
        new Error('Delete failed')
      );

      await expect(
        bookmarkManager.deleteBookmark('bookmark-123')
      ).rejects.toThrow('Failed to delete bookmark: Delete failed');

      expect(mockEventSystem.emitBookmarkError).toHaveBeenCalledWith(
        'delete',
        'Delete failed'
      );
    });
  });

  describe('getBookmark', () => {
    it('should retrieve existing bookmark', async () => {
      mockStorageService.getBookmark.mockResolvedValue(sampleBookmark);

      const result = await bookmarkManager.getBookmark('bookmark-123');

      expect(mockStorageService.getBookmark).toHaveBeenCalledWith(
        'bookmark-123'
      );
      expect(result).toBe(sampleBookmark);
    });

    it('should return null for non-existent bookmark', async () => {
      mockStorageService.getBookmark.mockResolvedValue(null);

      const result = await bookmarkManager.getBookmark('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle storage errors during retrieval', async () => {
      mockStorageService.getBookmark.mockRejectedValue(
        new Error('Storage error')
      );

      await expect(bookmarkManager.getBookmark('bookmark-123')).rejects.toThrow(
        'Failed to retrieve bookmark: Storage error'
      );

      expect(mockEventSystem.emitBookmarkError).toHaveBeenCalledWith(
        'get',
        'Storage error'
      );
    });
  });

  describe('listBookmarks', () => {
    const sampleBookmarks = [sampleBookmark];
    const filters: BookmarkFilters = {
      conversationId: 'conv-456',
      platform: 'chatgpt' as Platform,
    };

    it('should list all bookmarks without filters', async () => {
      mockStorageService.getBookmarks.mockResolvedValue(sampleBookmarks);

      const result = await bookmarkManager.listBookmarks();

      expect(mockStorageService.getBookmarks).toHaveBeenCalledWith(undefined);
      expect(result).toBe(sampleBookmarks);
    });

    it('should list bookmarks with filters', async () => {
      mockStorageService.getBookmarks.mockResolvedValue(sampleBookmarks);

      const result = await bookmarkManager.listBookmarks(filters);

      expect(mockStorageService.getBookmarks).toHaveBeenCalledWith(filters);
      expect(result).toBe(sampleBookmarks);
    });

    it('should handle storage errors during listing', async () => {
      mockStorageService.getBookmarks.mockRejectedValue(
        new Error('Storage error')
      );

      await expect(bookmarkManager.listBookmarks()).rejects.toThrow(
        'Failed to list bookmarks: Storage error'
      );

      expect(mockEventSystem.emitBookmarkError).toHaveBeenCalledWith(
        'list',
        'Storage error'
      );
    });
  });

  describe('getBookmarkCount', () => {
    it('should return bookmark count', async () => {
      mockStorageService.getBookmarkCount.mockResolvedValue(42);

      const result = await bookmarkManager.getBookmarkCount();

      expect(mockStorageService.getBookmarkCount).toHaveBeenCalled();
      expect(result).toBe(42);
    });

    it('should handle storage errors during count', async () => {
      mockStorageService.getBookmarkCount.mockRejectedValue(
        new Error('Storage error')
      );

      await expect(bookmarkManager.getBookmarkCount()).rejects.toThrow(
        'Failed to get bookmark count: Storage error'
      );

      expect(mockEventSystem.emitBookmarkError).toHaveBeenCalledWith(
        'count',
        'Storage error'
      );
    });
  });

  describe('validateCreationData', () => {
    it('should validate complete valid data', () => {
      const result = bookmarkManager.validateCreationData(sampleCreateData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidData = {
        ...sampleCreateData,
        platform: undefined as any,
        conversationId: '',
        selectedText: '',
      };

      const result = bookmarkManager.validateCreationData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Platform is required');
      expect(result.errors).toContain('Conversation ID is required');
      expect(result.errors).toContain('Selected text cannot be empty');
    });

    it('should detect missing range and element', () => {
      const invalidData = {
        ...sampleCreateData,
        selectionRange: undefined as any,
        messageElement: undefined as any,
      };

      const result = bookmarkManager.validateCreationData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Selection range is required');
      expect(result.errors).toContain('Message element is required');
    });

    it('should generate warnings for edge cases', () => {
      const dataWithWarnings = {
        ...sampleCreateData,
        note: 'x'.repeat(1001), // Very long note
        tags: Array(11).fill('tag'), // Many tags
      };

      const result = bookmarkManager.validateCreationData(dataWithWarnings);

      expect(result.isValid).toBe(true); // Still valid, just warnings
      expect(result.warnings).toContain('Note is very long (>1000 characters)');
      expect(result.warnings).toContain('Many tags specified (>10)');
    });
  });

  describe('getEventSystem', () => {
    it('should return event system instance', () => {
      const eventSystem = bookmarkManager.getEventSystem();
      expect(eventSystem).toBe(mockEventSystem);
    });
  });

  describe('Context Extraction', () => {
    it('should extract context before selection', async () => {
      const range = {
        toString: () => 'selected',
        getBoundingClientRect: () => ({
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          bottom: 0,
          right: 0,
        }),
        commonAncestorContainer: {
          textContent: 'This is the selected text content',
        },
      } as Range;

      const createData = {
        ...sampleCreateData,
        selectionRange: range,
        selectedText: 'selected',
      };

      await bookmarkManager.createBookmark(createData);

      const anchorCall = mockAnchorSystem.createAnchor.mock.calls[0]?.[0];
      expect(anchorCall?.contextBefore).toBe('This is the ');
      expect(anchorCall?.contextAfter).toBe(' text content');
    });

    it('should handle context extraction errors gracefully', async () => {
      const range = {
        toString: () => 'selected',
        getBoundingClientRect: () => ({
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          bottom: 0,
          right: 0,
        }),
        commonAncestorContainer: {
          textContent: null, // Will cause error
        },
      } as Range;

      const createData = {
        ...sampleCreateData,
        selectionRange: range,
      };

      // Should not throw error, just return empty context
      await bookmarkManager.createBookmark(createData);

      const anchorCall = mockAnchorSystem.createAnchor.mock.calls[0]?.[0];
      expect(anchorCall?.contextBefore).toBe('');
      expect(anchorCall?.contextAfter).toBe('');
    });
  });

  describe('Performance Requirements', () => {
    it('should create bookmarks within 100ms target', async () => {
      const startTime = performance.now();

      await bookmarkManager.createBookmark(sampleCreateData);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Note: This is testing the manager overhead, not storage performance
      expect(duration).toBeLessThan(50); // Manager should be very fast
    });

    it('should handle concurrent bookmark operations safely', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        bookmarkManager.createBookmark({
          ...sampleCreateData,
          selectedText: `text ${i}`,
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(mockStorageService.saveBookmark).toHaveBeenCalledTimes(5);
      expect(mockEventSystem.emitBookmarkCreated).toHaveBeenCalledTimes(5);
    });
  });
});
