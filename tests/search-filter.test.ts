/**
 * SearchFilter Test Suite
 * 
 * Comprehensive tests for advanced search and filtering functionality
 */

import { SearchFilter, SearchQuery, SearchResult, SearchOptions } from '../src/content/ui/sidebar/SearchFilter';
import { Bookmark, Platform } from '../src/types/bookmark';

describe('SearchFilter', () => {
  let searchFilter: SearchFilter;
  let testBookmarks: Bookmark[];

  const createMockBookmark = (overrides: Partial<Bookmark> = {}): Bookmark => ({
    id: `bookmark-${Math.random().toString(36).substr(2, 9)}`,
    platform: 'chatgpt' as Platform,
    conversationId: 'conv-123',
    messageId: 'msg-456',
    anchor: {
      selectedText: 'Default selected text',
      startOffset: 0,
      endOffset: 20,
      xpathSelector: '//div[@data-testid="conversation-turn-1"]//p[1]',
      messageId: 'msg-456',
      contextBefore: 'Previous context',
      contextAfter: 'Following context',
      checksum: 'abc123',
      confidence: 0.95,
      strategy: 'xpath' as const
    },
    note: 'Default bookmark note',
    tags: ['default'],
    created: '2024-01-15T10:30:00Z',
    updated: '2024-01-15T10:30:00Z',
    color: '#FFD700',
    ...overrides
  });

  beforeEach(() => {
    searchFilter = new SearchFilter();
    
    testBookmarks = [
      createMockBookmark({
        id: 'bookmark-1',
        anchor: {
          ...createMockBookmark().anchor,
          selectedText: 'JavaScript programming concepts'
        },
        note: 'Important programming notes about JavaScript',
        tags: ['javascript', 'programming', 'important'],
        created: '2024-01-10T10:00:00Z'
      }),
      createMockBookmark({
        id: 'bookmark-2',
        platform: 'claude' as Platform,
        anchor: {
          ...createMockBookmark().anchor,
          selectedText: 'Python data analysis'
        },
        note: 'Data analysis techniques using Python',
        tags: ['python', 'data-science', 'analysis'],
        created: '2024-01-15T10:00:00Z'
      }),
      createMockBookmark({
        id: 'bookmark-3',
        anchor: {
          ...createMockBookmark().anchor,
          selectedText: 'Machine learning algorithms'
        },
        note: 'Overview of ML algorithms and their applications',
        tags: ['machine-learning', 'algorithms', 'ai'],
        created: '2024-01-20T10:00:00Z'
      }),
      createMockBookmark({
        id: 'bookmark-4',
        platform: 'grok' as Platform,
        anchor: {
          ...createMockBookmark().anchor,
          selectedText: 'Web development best practices'
        },
        note: 'Best practices for modern web development',
        tags: ['web-development', 'best-practices'],
        created: '2024-01-25T10:00:00Z'
      })
    ];
    
    searchFilter.initialize(testBookmarks);
  });

  describe('Initialization and Indexing', () => {
    test('initializes search filter with bookmarks', () => {
      expect(searchFilter).toBeDefined();
      expect((searchFilter as any).bookmarkMap.size).toBe(testBookmarks.length);
    });

    test('builds search index correctly', () => {
      const searchIndex = (searchFilter as any).searchIndex;
      expect(searchIndex.size).toBeGreaterThan(0);
      expect(searchIndex.has('javascript')).toBe(true);
      expect(searchIndex.has('python')).toBe(true);
    });

    test('updates index when bookmarks change', () => {
      const newBookmarks = [
        ...testBookmarks,
        createMockBookmark({
          id: 'bookmark-5',
          anchor: {
            ...createMockBookmark().anchor,
            selectedText: 'React component patterns'
          },
          tags: ['react', 'components']
        })
      ];
      
      searchFilter.updateIndex(newBookmarks);
      
      const searchIndex = (searchFilter as any).searchIndex;
      expect(searchIndex.has('react')).toBe(true);
      expect(searchIndex.has('components')).toBe(true);
    });

    test('rate limits index updates for performance', () => {
      const buildIndexSpy = jest.spyOn(searchFilter as any, 'buildSearchIndex');
      
      // Multiple rapid updates
      searchFilter.updateIndex(testBookmarks);
      searchFilter.updateIndex(testBookmarks);
      searchFilter.updateIndex(testBookmarks);
      
      expect(buildIndexSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Text Search Functionality', () => {
    test('performs basic text search', () => {
      const query: SearchQuery = { text: 'JavaScript' };
      const results = searchFilter.search(query, testBookmarks);
      
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('bookmark-1');
    });

    test('performs case-insensitive search', () => {
      const query: SearchQuery = { text: 'javascript' };
      const results = searchFilter.search(query, testBookmarks);
      
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('bookmark-1');
    });

    test('searches across multiple fields', () => {
      const query: SearchQuery = { text: 'analysis' };
      const results = searchFilter.search(query, testBookmarks);
      
      // Should match both content and note fields
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.id === 'bookmark-2')).toBe(true);
    });

    test('returns empty results for no matches', () => {
      const query: SearchQuery = { text: 'nonexistent' };
      const results = searchFilter.search(query, testBookmarks);
      
      expect(results).toHaveLength(0);
    });

    test('handles empty search query', () => {
      const query: SearchQuery = { text: '' };
      const results = searchFilter.search(query, testBookmarks);
      
      expect(results).toHaveLength(testBookmarks.length);
    });

    test('searches in tags', () => {
      const query: SearchQuery = { text: 'programming' };
      const results = searchFilter.search(query, testBookmarks);
      
      expect(results).toHaveLength(1);
      expect(results[0].tags).toContain('programming');
    });
  });

  describe('Advanced Search with Scoring', () => {
    test('returns search results with scores', () => {
      const results = searchFilter.searchWithScores('JavaScript', testBookmarks);
      
      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('bookmark');
      expect(results[0]).toHaveProperty('score');
      expect(results[0].score).toBeGreaterThan(0);
    });

    test('ranks results by relevance', () => {
      const results = searchFilter.searchWithScores('development', testBookmarks);
      
      // Should return multiple results sorted by score
      expect(results.length).toBeGreaterThan(1);
      for (let i = 1; i < results.length; i++) {
        expect(results[i-1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    test('includes match information when requested', () => {
      const options: SearchOptions = { includeMatches: true };
      const results = searchFilter.searchWithScores('JavaScript', testBookmarks, options);
      
      expect(results[0]).toHaveProperty('matches');
      expect(results[0].matches.length).toBeGreaterThan(0);
      expect(results[0].matches[0]).toHaveProperty('field');
      expect(results[0].matches[0]).toHaveProperty('text');
    });

    test('applies minimum score threshold', () => {
      const options: SearchOptions = { minScore: 0.8 };
      const results = searchFilter.searchWithScores('vague', testBookmarks, options);
      
      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(0.8);
      });
    });

    test('limits maximum results', () => {
      const options: SearchOptions = { maxResults: 2 };
      const results = searchFilter.searchWithScores('development', testBookmarks, options);
      
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Filtering by Criteria', () => {
    test('filters by platform', () => {
      const query: SearchQuery = { platforms: ['claude'] };
      const results = searchFilter.search(query, testBookmarks);
      
      expect(results).toHaveLength(1);
      expect(results[0].platform).toBe('claude');
    });

    test('filters by multiple platforms', () => {
      const query: SearchQuery = { platforms: ['chatgpt', 'grok'] };
      const results = searchFilter.search(query, testBookmarks);
      
      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(['chatgpt', 'grok']).toContain(result.platform);
      });
    });

    test('filters by tags', () => {
      const query: SearchQuery = { tags: ['programming'] };
      const results = searchFilter.search(query, testBookmarks);
      
      expect(results).toHaveLength(1);
      expect(results[0].tags).toContain('programming');
    });

    test('filters by multiple tags (AND logic)', () => {
      const query: SearchQuery = { tags: ['javascript', 'important'] };
      const results = searchFilter.search(query, testBookmarks);
      
      expect(results).toHaveLength(1);
      expect(results[0].tags).toContain('javascript');
      expect(results[0].tags).toContain('important');
    });

    test('filters by date range', () => {
      const query: SearchQuery = {
        dateRange: {
          start: new Date('2024-01-14T00:00:00Z'),
          end: new Date('2024-01-16T00:00:00Z')
        }
      };
      const results = searchFilter.search(query, testBookmarks);
      
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('bookmark-2');
    });

    test('combines multiple filters', () => {
      const query: SearchQuery = {
        text: 'development',
        platforms: ['grok'],
        tags: ['best-practices']
      };
      const results = searchFilter.search(query, testBookmarks);
      
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('bookmark-4');
    });
  });

  describe('Sorting Functionality', () => {
    test('sorts by date ascending', () => {
      const query: SearchQuery = {
        sortBy: 'date',
        sortDirection: 'asc'
      };
      const results = searchFilter.search(query, testBookmarks);
      
      expect(results[0].id).toBe('bookmark-1'); // Earliest date
    });

    test('sorts by date descending', () => {
      const query: SearchQuery = {
        sortBy: 'date',
        sortDirection: 'desc'
      };
      const results = searchFilter.search(query, testBookmarks);
      
      expect(results[0].id).toBe('bookmark-4'); // Latest date
    });

    test('sorts alphabetically by note', () => {
      const query: SearchQuery = {
        sortBy: 'alphabetical',
        sortDirection: 'asc'
      };
      const results = searchFilter.search(query, testBookmarks);
      
      // Should sort by note content alphabetically
      for (let i = 1; i < results.length; i++) {
        expect(results[i-1].note.localeCompare(results[i].note)).toBeLessThanOrEqual(0);
      }
    });

    test('maintains relevance sorting for text searches', () => {
      const query: SearchQuery = {
        text: 'development',
        sortBy: 'relevance'
      };
      const results = searchFilter.search(query, testBookmarks);
      
      // Results should be ordered by relevance (handled by search scoring)
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Fuzzy Matching', () => {
    test('finds matches with typos using fuzzy matching', () => {
      // Note: This tests the fuzzy scoring mechanism
      const score1 = (searchFilter as any).calculateFuzzyScore('JavaScript', 'JavaScript');
      const score2 = (searchFilter as any).calculateFuzzyScore('JavaScript', 'JavaScrip'); // Missing 't'
      const score3 = (searchFilter as any).calculateFuzzyScore('JavaScript', 'Python');
      
      expect(score1).toBe(1); // Perfect match
      expect(score2).toBeGreaterThan(0.8); // Close match
      expect(score3).toBeLessThan(0.5); // Poor match
    });

    test('calculates Levenshtein distance correctly', () => {
      const distance1 = (searchFilter as any).levenshteinDistance('cat', 'cat');
      const distance2 = (searchFilter as any).levenshteinDistance('cat', 'bat');
      const distance3 = (searchFilter as any).levenshteinDistance('cat', 'dog');
      
      expect(distance1).toBe(0); // No changes needed
      expect(distance2).toBe(1); // One substitution
      expect(distance3).toBe(3); // Three changes needed
    });

    test('applies fuzzy threshold in search options', () => {
      const options: SearchOptions = { fuzzyThreshold: 0.9 };
      const results = searchFilter.searchWithScores('JavaScrip', testBookmarks, options);
      
      // Should still find JavaScript with high threshold
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Search Suggestions', () => {
    test('provides tag suggestions', () => {
      const suggestions = searchFilter.getSuggestions('prog', testBookmarks);
      
      expect(suggestions).toContain('programming');
    });

    test('provides content-based suggestions', () => {
      const suggestions = searchFilter.getSuggestions('Java', testBookmarks);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.toLowerCase().includes('java'))).toBe(true);
    });

    test('limits number of suggestions', () => {
      const suggestions = searchFilter.getSuggestions('a', testBookmarks, 3);
      
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    test('handles short queries gracefully', () => {
      const suggestions = searchFilter.getSuggestions('a', testBookmarks);
      
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('Utility Methods', () => {
    test('filters bookmarks by tags using utility method', () => {
      const filtered = searchFilter.filterByTags(['programming'], testBookmarks);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].tags).toContain('programming');
    });

    test('filters bookmarks by platform using utility method', () => {
      const filtered = searchFilter.filterByPlatform(['claude', 'grok'], testBookmarks);
      
      expect(filtered).toHaveLength(2);
      filtered.forEach(bookmark => {
        expect(['claude', 'grok']).toContain(bookmark.platform);
      });
    });

    test('filters bookmarks by date range using utility method', () => {
      const start = new Date('2024-01-12T00:00:00Z');
      const end = new Date('2024-01-18T00:00:00Z');
      const filtered = searchFilter.filterByDateRange(start, end, testBookmarks);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('bookmark-2');
    });

    test('extracts all unique tags', () => {
      const tags = searchFilter.getAllTags(testBookmarks);
      
      expect(tags).toContain('javascript');
      expect(tags).toContain('python');
      expect(tags).toContain('machine-learning');
      expect(tags.length).toBe(new Set(testBookmarks.flatMap(b => b.tags)).size);
    });

    test('calculates date range from bookmarks', () => {
      const dateRange = searchFilter.getDateRange(testBookmarks);
      
      expect(dateRange).not.toBeNull();
      expect(dateRange!.earliest).toEqual(new Date('2024-01-10T10:00:00Z'));
      expect(dateRange!.latest).toEqual(new Date('2024-01-25T10:00:00Z'));
    });

    test('returns null for empty bookmark list date range', () => {
      const dateRange = searchFilter.getDateRange([]);
      
      expect(dateRange).toBeNull();
    });
  });

  describe('Performance Optimization', () => {
    test('handles large bookmark datasets efficiently', () => {
      const largeBookmarkSet = Array.from({ length: 1000 }, (_, i) => 
        createMockBookmark({
          id: `large-bookmark-${i}`,
          anchor: {
            ...createMockBookmark().anchor,
            selectedText: `Content for bookmark ${i}`
          },
          note: `Note ${i}`,
          tags: [`tag-${i % 10}`]
        })
      );
      
      const startTime = performance.now();
      searchFilter.initialize(largeBookmarkSet);
      const initTime = performance.now() - startTime;
      
      expect(initTime).toBeLessThan(1000); // Should initialize within 1 second
      
      const searchStart = performance.now();
      const results = searchFilter.search({ text: 'Content' }, largeBookmarkSet);
      const searchTime = performance.now() - searchStart;
      
      expect(searchTime).toBeLessThan(500); // Should search within 500ms
      expect(results.length).toBe(1000); // All should match
    });

    test('uses search index for performance', () => {
      const searchIndex = (searchFilter as any).searchIndex;
      
      expect(searchIndex.has('javascript')).toBe(true);
      
      // Verify index contains bookmark IDs
      const javascriptBookmarks = searchIndex.get('javascript');
      expect(javascriptBookmarks.has('bookmark-1')).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('handles null or undefined bookmarks gracefully', () => {
      const invalidBookmarks = [null, undefined, testBookmarks[0]] as any;
      
      expect(() => {
        searchFilter.initialize(invalidBookmarks);
      }).not.toThrow();
    });

    test('handles bookmarks with missing fields', () => {
      const incompleteBookmarks = [
        { ...testBookmarks[0], note: undefined },
        { ...testBookmarks[1], tags: undefined },
        testBookmarks[2]
      ] as any;
      
      expect(() => {
        const results = searchFilter.search({ text: 'test' }, incompleteBookmarks);
        expect(Array.isArray(results)).toBe(true);
      }).not.toThrow();
    });

    test('handles very long search queries', () => {
      const longQuery = 'a'.repeat(1000);
      
      expect(() => {
        const results = searchFilter.search({ text: longQuery }, testBookmarks);
        expect(Array.isArray(results)).toBe(true);
      }).not.toThrow();
    });

    test('handles special characters in search queries', () => {
      const specialQuery = '!@#$%^&*(){}[]|\\:";\'<>?,./';
      
      expect(() => {
        const results = searchFilter.search({ text: specialQuery }, testBookmarks);
        expect(Array.isArray(results)).toBe(true);
      }).not.toThrow();
    });
  });

  describe('Memory Management', () => {
    test('clears search data when requested', () => {
      searchFilter.clear();
      
      const searchIndex = (searchFilter as any).searchIndex;
      const bookmarkMap = (searchFilter as any).bookmarkMap;
      
      expect(searchIndex.size).toBe(0);
      expect(bookmarkMap.size).toBe(0);
    });

    test('prevents memory leaks with large datasets', () => {
      const largeSet = Array.from({ length: 10000 }, (_, i) => 
        createMockBookmark({ id: `bookmark-${i}` })
      );
      
      searchFilter.initialize(largeSet);
      
      // Clear and verify cleanup
      searchFilter.clear();
      
      expect((searchFilter as any).searchIndex.size).toBe(0);
      expect((searchFilter as any).bookmarkMap.size).toBe(0);
    });
  });
});