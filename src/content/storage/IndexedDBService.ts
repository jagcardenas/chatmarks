/**
 * IndexedDB Service for Complex Queries and Secondary Storage
 *
 * Provides advanced querying capabilities, full-text search, and offline
 * functionality as a secondary storage layer to chrome.storage.local.
 *
 * Key Features:
 * - Full-text search across bookmark content
 * - Complex filtering and sorting
 * - Relationship queries for conversation branching
 * - Offline capability and sync mechanisms
 * - Performance optimization for large datasets
 */

import { Bookmark, BookmarkFilters } from '../../types/bookmark';

export class IndexedDBService {
  private static readonly DB_NAME = 'ChatmarksDB';
  private static readonly DB_VERSION = 1;
  private static readonly BOOKMARK_STORE = 'bookmarks';

  private db: IDBDatabase | null = null;

  /**
   * Initializes the IndexedDB database
   *
   * @returns Promise that resolves when DB is ready
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(
        IndexedDBService.DB_NAME,
        IndexedDBService.DB_VERSION
      );

      request.onerror = () => {
        reject(
          new Error(`Failed to open IndexedDB: ${request.error?.message}`)
        );
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create bookmark store
        const bookmarkStore = db.createObjectStore(
          IndexedDBService.BOOKMARK_STORE,
          {
            keyPath: 'id',
          }
        );

        // Create indexes for efficient queries
        bookmarkStore.createIndex('platform', 'platform', { unique: false });
        bookmarkStore.createIndex('conversationId', 'conversationId', {
          unique: false,
        });
        bookmarkStore.createIndex('created', 'created', { unique: false });
        bookmarkStore.createIndex('tags', 'tags', {
          unique: false,
          multiEntry: true,
        });
        bookmarkStore.createIndex('note', 'note', { unique: false });
      };
    });
  }

  /**
   * Syncs data from chrome.storage.local to IndexedDB
   *
   * @param bookmarks - Bookmarks to sync
   * @returns Promise that resolves when sync is complete
   */
  async syncFromChromeStorage(bookmarks: Bookmark[]): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    const transaction = this.db!.transaction(
      [IndexedDBService.BOOKMARK_STORE],
      'readwrite'
    );
    const store = transaction.objectStore(IndexedDBService.BOOKMARK_STORE);

    // Clear existing data
    await new Promise<void>((resolve, reject) => {
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    });

    // Add all bookmarks
    for (const bookmark of bookmarks) {
      await new Promise<void>((resolve, reject) => {
        const addRequest = store.add(bookmark);
        addRequest.onsuccess = () => resolve();
        addRequest.onerror = () => reject(addRequest.error);
      });
    }
  }

  /**
   * Performs full-text search across bookmark content
   *
   * @param searchTerm - Term to search for
   * @returns Promise resolving to matching bookmarks
   */
  async fullTextSearch(searchTerm: string): Promise<Bookmark[]> {
    if (!this.db) {
      await this.initialize();
    }

    const transaction = this.db!.transaction(
      [IndexedDBService.BOOKMARK_STORE],
      'readonly'
    );
    const store = transaction.objectStore(IndexedDBService.BOOKMARK_STORE);

    return new Promise((resolve, reject) => {
      const results: Bookmark[] = [];
      const searchLower = searchTerm.toLowerCase();

      const cursorRequest = store.openCursor();

      cursorRequest.onsuccess = event => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor) {
          const bookmark: Bookmark = cursor.value;

          // Search in note, selected text, and tags
          if (
            bookmark.note.toLowerCase().includes(searchLower) ||
            bookmark.anchor.selectedText.toLowerCase().includes(searchLower) ||
            bookmark.tags.some(tag => tag.toLowerCase().includes(searchLower))
          ) {
            results.push(bookmark);
          }

          cursor.continue();
        } else {
          resolve(results);
        }
      };

      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
  }

  /**
   * Gets bookmarks with complex filtering and sorting
   *
   * @param filters - Advanced filters to apply
   * @returns Promise resolving to filtered bookmarks
   */
  async getBookmarksAdvanced(
    filters: BookmarkFilters & {
      sortBy?: 'created' | 'updated' | 'note';
      sortOrder?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
    }
  ): Promise<Bookmark[]> {
    if (!this.db) {
      await this.initialize();
    }

    const transaction = this.db!.transaction(
      [IndexedDBService.BOOKMARK_STORE],
      'readonly'
    );
    const store = transaction.objectStore(IndexedDBService.BOOKMARK_STORE);

    let request: IDBRequest;

    // Use index if filtering by specific field
    if (filters.conversationId) {
      const index = store.index('conversationId');
      request = index.getAll(filters.conversationId);
    } else if (filters.platform) {
      const index = store.index('platform');
      request = index.getAll(filters.platform);
    } else {
      request = store.getAll();
    }

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        let results: Bookmark[] = request.result;

        // Apply additional filters
        if (filters.tags && filters.tags.length > 0) {
          results = results.filter(b =>
            filters.tags!.some(tag => b.tags.includes(tag))
          );
        }

        if (filters.dateRange) {
          const { start, end } = filters.dateRange;
          results = results.filter(b => {
            const bookmarkDate = new Date(b.created);
            return bookmarkDate >= start && bookmarkDate <= end;
          });
        }

        // Sort results
        if (filters.sortBy) {
          results.sort((a, b) => {
            const aValue = a[filters.sortBy!];
            const bValue = b[filters.sortBy!];
            const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            return filters.sortOrder === 'desc' ? -comparison : comparison;
          });
        }

        // Apply pagination
        if (filters.offset || filters.limit) {
          const start = filters.offset || 0;
          const end = filters.limit ? start + filters.limit : undefined;
          results = results.slice(start, end);
        }

        resolve(results);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Gets conversation statistics
   *
   * @returns Promise resolving to conversation stats
   */
  async getConversationStats(): Promise<
    Array<{
      conversationId: string;
      bookmarkCount: number;
      platform: string;
      lastActivity: string;
    }>
  > {
    if (!this.db) {
      await this.initialize();
    }

    const transaction = this.db!.transaction(
      [IndexedDBService.BOOKMARK_STORE],
      'readonly'
    );
    const store = transaction.objectStore(IndexedDBService.BOOKMARK_STORE);

    return new Promise((resolve, reject) => {
      const stats = new Map<
        string,
        {
          conversationId: string;
          bookmarkCount: number;
          platform: string;
          lastActivity: string;
        }
      >();

      const cursorRequest = store.openCursor();

      cursorRequest.onsuccess = event => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor) {
          const bookmark: Bookmark = cursor.value;
          const key = bookmark.conversationId;

          if (stats.has(key)) {
            const existing = stats.get(key)!;
            existing.bookmarkCount++;
            if (bookmark.updated > existing.lastActivity) {
              existing.lastActivity = bookmark.updated;
            }
          } else {
            stats.set(key, {
              conversationId: bookmark.conversationId,
              bookmarkCount: 1,
              platform: bookmark.platform,
              lastActivity: bookmark.updated,
            });
          }

          cursor.continue();
        } else {
          resolve(Array.from(stats.values()));
        }
      };

      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
  }

  /**
   * Closes the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
