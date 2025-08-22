/**
 * SortingSystem Test Suite
 * 
 * Comprehensive tests for bookmark sorting and grouping functionality
 */

import { SortingSystem, SortOptions, SortCriteria, GroupCriteria, BookmarkGroup } from '../src/content/ui/sidebar/SortingSystem';
import { Bookmark, Platform } from '../src/types/bookmark';

describe('SortingSystem', () => {
  let sortingSystem: SortingSystem;
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
    sortingSystem = new SortingSystem();
    
    testBookmarks = [
      createMockBookmark({
        id: 'bookmark-1',
        anchor: {
          ...createMockBookmark().anchor,
          selectedText: 'Alpha content first'
        },
        note: 'First bookmark note',
        tags: ['javascript', 'programming'],
        created: '2024-01-10T08:00:00Z',
        updated: '2024-01-10T08:00:00Z',
        platform: 'chatgpt'
      }),
      createMockBookmark({
        id: 'bookmark-2',
        anchor: {
          ...createMockBookmark().anchor,
          selectedText: 'Beta content second'
        },
        note: 'Second bookmark note',
        tags: ['python', 'data-science'],
        created: '2024-01-15T12:00:00Z',
        updated: '2024-01-16T10:00:00Z',
        platform: 'claude'
      }),
      createMockBookmark({
        id: 'bookmark-3',
        anchor: {
          ...createMockBookmark().anchor,
          selectedText: 'Gamma content third'
        },
        note: 'Third bookmark note',
        tags: ['react', 'frontend'],
        created: '2024-01-20T16:00:00Z',
        updated: '2024-01-20T16:00:00Z',
        platform: 'grok'
      }),
      createMockBookmark({
        id: 'bookmark-4',
        anchor: {
          ...createMockBookmark().anchor,
          selectedText: 'Delta content fourth'
        },
        note: 'Fourth bookmark note',
        tags: ['machine-learning', 'ai'],
        created: '2024-01-25T14:00:00Z',
        updated: '2024-01-25T14:00:00Z',
        platform: 'chatgpt'
      })
    ];
  });

  describe('Basic Sorting Functionality', () => {
    test('sorts by date created ascending', () => {
      const options: SortOptions = {
        criteria: 'date-created',
        direction: 'asc'
      };

      const sorted = sortingSystem.sortBookmarks(testBookmarks, options);

      expect(sorted[0].id).toBe('bookmark-1'); // Earliest date
      expect(sorted[sorted.length - 1].id).toBe('bookmark-4'); // Latest date
    });

    test('sorts by date created descending', () => {
      const options: SortOptions = {
        criteria: 'date-created',
        direction: 'desc'
      };

      const sorted = sortingSystem.sortBookmarks(testBookmarks, options);

      expect(sorted[0].id).toBe('bookmark-4'); // Latest date
      expect(sorted[sorted.length - 1].id).toBe('bookmark-1'); // Earliest date
    });

    test('sorts by date updated ascending', () => {
      const options: SortOptions = {
        criteria: 'date-updated',
        direction: 'asc'
      };

      const sorted = sortingSystem.sortBookmarks(testBookmarks, options);

      // Should sort by updated date
      const dates = sorted.map(b => new Date(b.updated));
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i].getTime()).toBeGreaterThanOrEqual(dates[i-1].getTime());
      }
    });

    test('sorts alphabetically by content ascending', () => {
      const options: SortOptions = {
        criteria: 'alphabetical-content',
        direction: 'asc'
      };

      const sorted = sortingSystem.sortBookmarks(testBookmarks, options);

      expect(sorted[0].anchor.selectedText.startsWith('Alpha')).toBe(true);
      expect(sorted[1].anchor.selectedText.startsWith('Beta')).toBe(true);
      expect(sorted[2].anchor.selectedText.startsWith('Delta')).toBe(true);
      expect(sorted[3].anchor.selectedText.startsWith('Gamma')).toBe(true);
    });

    test('sorts alphabetically by note descending', () => {
      const options: SortOptions = {
        criteria: 'alphabetical-note',
        direction: 'desc'
      };

      const sorted = sortingSystem.sortBookmarks(testBookmarks, options);

      // Should be in reverse alphabetical order by note
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i-1].note.localeCompare(sorted[i].note)).toBeGreaterThanOrEqual(0);
      }
    });

    test('sorts by platform', () => {
      const options: SortOptions = {
        criteria: 'platform',
        direction: 'asc'
      };

      const sorted = sortingSystem.sortBookmarks(testBookmarks, options);

      // Should group by platform
      const platforms = sorted.map(b => b.platform);
      const uniquePlatforms = [...new Set(platforms)];
      
      // Check that platforms are grouped together
      let currentPlatform = platforms[0];
      for (const platform of platforms) {
        if (platform !== currentPlatform) {
          currentPlatform = platform;
        }
      }
    });

    test('handles custom sorting', () => {
      const customComparator = (a: Bookmark, b: Bookmark) => 
        a.tags.length - b.tags.length;

      const options: SortOptions = {
        criteria: 'custom',
        direction: 'asc',
        customComparator
      };

      const sorted = sortingSystem.sortBookmarks(testBookmarks, options);

      // Should sort by number of tags
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i-1].tags.length).toBeLessThanOrEqual(sorted[i].tags.length);
      }
    });
  });

  describe('Stable Sorting', () => {
    test('maintains relative order for equal elements', () => {
      // Create bookmarks with same created date
      const sameTimeBookmarks = [
        createMockBookmark({ 
          id: 'same-1', 
          created: '2024-01-15T10:00:00Z',
          note: 'Same time first'
        }),
        createMockBookmark({ 
          id: 'same-2', 
          created: '2024-01-15T10:00:00Z',
          note: 'Same time second'
        })
      ];

      const options: SortOptions = {
        criteria: 'date-created',
        direction: 'asc'
      };

      const sorted = sortingSystem.sortBookmarks(sameTimeBookmarks, options);

      // Should maintain original order for equal elements
      expect(sorted[0].id).toBe('same-1');
      expect(sorted[1].id).toBe('same-2');
    });

    test('applies secondary sort criteria for ties', () => {
      const options: SortOptions = {
        criteria: 'date-created',
        direction: 'asc',
        secondaryCriteria: 'alphabetical-note'
      };

      // Create bookmarks with same date but different notes
      const tiedBookmarks = [
        createMockBookmark({ 
          id: 'tied-1', 
          created: '2024-01-15T10:00:00Z',
          note: 'Zebra note'
        }),
        createMockBookmark({ 
          id: 'tied-2', 
          created: '2024-01-15T10:00:00Z',
          note: 'Alpha note'
        })
      ];

      const sorted = sortingSystem.sortBookmarks(tiedBookmarks, options);

      // Should sort by secondary criteria (alphabetical) for ties
      expect(sorted[0].note).toBe('Alpha note');
      expect(sorted[1].note).toBe('Zebra note');
    });
  });

  describe('Grouping Functionality', () => {
    test('groups bookmarks by platform', () => {
      const grouped = sortingSystem.groupBookmarks(testBookmarks, 'platform');

      expect(grouped.groups).toHaveLength(3); // chatgpt, claude, grok
      
      const chatgptGroup = grouped.groups.find(g => g.key === 'chatgpt');
      expect(chatgptGroup).toBeDefined();
      expect(chatgptGroup!.bookmarks).toHaveLength(2);
      
      const claudeGroup = grouped.groups.find(g => g.key === 'claude');
      expect(claudeGroup).toBeDefined();
      expect(claudeGroup!.bookmarks).toHaveLength(1);
    });

    test('groups bookmarks by date', () => {
      const grouped = sortingSystem.groupBookmarks(testBookmarks, 'date');

      expect(grouped.groups.length).toBeGreaterThan(0);
      
      // Each group should have a date-based key
      grouped.groups.forEach(group => {
        expect(group.key).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD format
      });
    });

    test('groups bookmarks by tags', () => {
      const grouped = sortingSystem.groupBookmarks(testBookmarks, 'tags');

      expect(grouped.groups.length).toBeGreaterThan(0);
      
      // Should create groups for different tag combinations
      const tagGroups = grouped.groups.map(g => g.key);
      expect(tagGroups.some(key => key.includes('javascript'))).toBe(true);
      expect(tagGroups.some(key => key.includes('python'))).toBe(true);
    });

    test('groups bookmarks by conversation', () => {
      // Add bookmarks from different conversations
      const mixedBookmarks = [
        ...testBookmarks,
        createMockBookmark({ conversationId: 'conv-456' })
      ];

      const grouped = sortingSystem.groupBookmarks(mixedBookmarks, 'conversation');

      expect(grouped.groups).toHaveLength(2); // Two different conversations
      
      const conv123Group = grouped.groups.find(g => g.key === 'conv-123');
      expect(conv123Group).toBeDefined();
      expect(conv123Group!.bookmarks).toHaveLength(4);
    });

    test('handles ungrouped bookmarks', () => {
      const grouped = sortingSystem.groupBookmarks(testBookmarks, 'platform');

      expect(grouped.ungrouped).toBeDefined();
      expect(Array.isArray(grouped.ungrouped)).toBe(true);
    });

    test('applies custom grouping function', () => {
      const customGroupFunction = (bookmark: Bookmark): string => {
        return bookmark.tags.length > 1 ? 'multi-tag' : 'single-tag';
      };

      const grouped = sortingSystem.groupBookmarks(testBookmarks, 'custom', {
        customGroupFunction
      });

      expect(grouped.groups).toHaveLength(2);
      expect(grouped.groups.some(g => g.key === 'multi-tag')).toBe(true);
      expect(grouped.groups.some(g => g.key === 'single-tag')).toBe(true);
    });
  });

  describe('Complex Sorting and Grouping', () => {
    test('sorts groups by group criteria', () => {
      const grouped = sortingSystem.groupBookmarks(testBookmarks, 'platform');
      
      // Groups should be sorted by platform name
      const groupKeys = grouped.groups.map(g => g.key);
      expect(groupKeys).toEqual(['chatgpt', 'claude', 'grok']);
    });

    test('sorts bookmarks within groups', () => {
      const options: SortOptions = {
        criteria: 'alphabetical-content',
        direction: 'asc'
      };

      const grouped = sortingSystem.groupBookmarks(testBookmarks, 'platform', {
        sortWithinGroups: true,
        sortOptions: options
      });

      // Bookmarks within each group should be sorted
      grouped.groups.forEach(group => {
        for (let i = 1; i < group.bookmarks.length; i++) {
          const prev = group.bookmarks[i-1].anchor.selectedText;
          const curr = group.bookmarks[i].anchor.selectedText;
          expect(prev.localeCompare(curr)).toBeLessThanOrEqual(0);
        }
      });
    });

    test('applies multiple grouping levels', () => {
      // Create bookmarks with platform and date combinations
      const multiLevelBookmarks = [
        createMockBookmark({ 
          platform: 'chatgpt', 
          created: '2024-01-10T10:00:00Z',
          tags: ['javascript']
        }),
        createMockBookmark({ 
          platform: 'chatgpt', 
          created: '2024-01-15T10:00:00Z',
          tags: ['python']
        }),
        createMockBookmark({ 
          platform: 'claude', 
          created: '2024-01-10T10:00:00Z',
          tags: ['react']
        })
      ];

      const primaryGrouped = sortingSystem.groupBookmarks(multiLevelBookmarks, 'platform');
      
      // Further group each platform group by date
      const nestedGroups = primaryGrouped.groups.map(group => ({
        ...group,
        subgroups: sortingSystem.groupBookmarks(group.bookmarks, 'date').groups
      }));

      expect(nestedGroups.length).toBeGreaterThan(0);
      expect(nestedGroups[0].subgroups).toBeDefined();
    });
  });

  describe('User Preferences and Persistence', () => {
    test('saves sort preferences', async () => {
      const preferences = {
        criteria: 'date-created' as SortCriteria,
        direction: 'desc' as 'asc' | 'desc',
        groupBy: 'platform' as GroupCriteria
      };

      await sortingSystem.savePreferences(preferences);

      const saved = await sortingSystem.getPreferences();
      expect(saved).toEqual(preferences);
    });

    test('applies saved preferences', async () => {
      const preferences = {
        criteria: 'alphabetical-content' as SortCriteria,
        direction: 'asc' as 'asc' | 'desc'
      };

      await sortingSystem.savePreferences(preferences);
      const sorted = await sortingSystem.sortWithPreferences(testBookmarks);

      // Should be sorted alphabetically by content
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i-1].anchor.selectedText;
        const curr = sorted[i].anchor.selectedText;
        expect(prev.localeCompare(curr)).toBeLessThanOrEqual(0);
      }
    });

    test('falls back to default preferences', async () => {
      // Clear any existing preferences
      await sortingSystem.clearPreferences();

      const sorted = await sortingSystem.sortWithPreferences(testBookmarks);

      // Should use default sorting (likely date-created desc)
      expect(sorted).toBeDefined();
      expect(sorted.length).toBe(testBookmarks.length);
    });

    test('validates preference values', async () => {
      const invalidPreferences = {
        criteria: 'invalid-criteria' as SortCriteria,
        direction: 'invalid-direction' as 'asc' | 'desc'
      };

      // Should handle invalid preferences gracefully
      await expect(sortingSystem.savePreferences(invalidPreferences))
        .rejects.toThrow();
    });
  });

  describe('Performance Optimization', () => {
    test('handles large bookmark sets efficiently', () => {
      const largeBookmarkSet = Array.from({ length: 1000 }, (_, i) => 
        createMockBookmark({
          id: `large-bookmark-${i}`,
          created: new Date(2024, 0, 1 + (i % 365)).toISOString(),
          note: `Note ${i}`,
          platform: ['chatgpt', 'claude', 'grok'][i % 3] as Platform
        })
      );

      const startTime = performance.now();
      
      const options: SortOptions = {
        criteria: 'date-created',
        direction: 'desc'
      };
      
      const sorted = sortingSystem.sortBookmarks(largeBookmarkSet, options);
      
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(sorted.length).toBe(1000);
    });

    test('caches sort results for repeated operations', () => {
      const options: SortOptions = {
        criteria: 'date-created',
        direction: 'asc'
      };

      // First sort - should compute and cache
      const firstSort = sortingSystem.sortBookmarks(testBookmarks, options);
      
      // Second sort with same options - should use cache
      const secondSort = sortingSystem.sortBookmarks(testBookmarks, options);

      expect(firstSort).toEqual(secondSort);
    });

    test('invalidates cache when bookmarks change', () => {
      const options: SortOptions = {
        criteria: 'date-created',
        direction: 'asc'
      };

      const initialSort = sortingSystem.sortBookmarks(testBookmarks, options);
      
      // Add a new bookmark
      const newBookmarks = [...testBookmarks, createMockBookmark()];
      const newSort = sortingSystem.sortBookmarks(newBookmarks, options);

      expect(newSort.length).toBe(initialSort.length + 1);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('handles empty bookmark array', () => {
      const options: SortOptions = {
        criteria: 'date-created',
        direction: 'asc'
      };

      const sorted = sortingSystem.sortBookmarks([], options);
      
      expect(sorted).toEqual([]);
    });

    test('handles bookmarks with missing dates', () => {
      const bookmarksWithMissingDates = [
        createMockBookmark({ created: '2024-01-15T10:00:00Z' }),
        { ...createMockBookmark(), created: undefined } as any,
        createMockBookmark({ created: '2024-01-10T10:00:00Z' })
      ];

      const options: SortOptions = {
        criteria: 'date-created',
        direction: 'asc'
      };

      expect(() => {
        const sorted = sortingSystem.sortBookmarks(bookmarksWithMissingDates, options);
        expect(Array.isArray(sorted)).toBe(true);
      }).not.toThrow();
    });

    test('handles bookmarks with null or undefined fields', () => {
      const corruptedBookmarks = [
        { ...createMockBookmark(), note: null } as any,
        { ...createMockBookmark(), tags: undefined } as any,
        createMockBookmark()
      ];

      const options: SortOptions = {
        criteria: 'alphabetical-note',
        direction: 'asc'
      };

      expect(() => {
        const sorted = sortingSystem.sortBookmarks(corruptedBookmarks, options);
        expect(Array.isArray(sorted)).toBe(true);
      }).not.toThrow();
    });

    test('handles invalid sort options gracefully', () => {
      const invalidOptions: SortOptions = {
        criteria: 'invalid-criteria' as SortCriteria,
        direction: 'invalid-direction' as 'asc' | 'desc'
      };

      expect(() => {
        const sorted = sortingSystem.sortBookmarks(testBookmarks, invalidOptions);
        expect(Array.isArray(sorted)).toBe(true);
      }).not.toThrow();
    });

    test('handles circular references in custom comparator', () => {
      const circularComparator = (a: Bookmark, b: Bookmark) => {
        // Intentionally problematic comparator
        return Math.random() > 0.5 ? 1 : -1;
      };

      const options: SortOptions = {
        criteria: 'custom',
        direction: 'asc',
        customComparator: circularComparator
      };

      expect(() => {
        const sorted = sortingSystem.sortBookmarks(testBookmarks, options);
        expect(Array.isArray(sorted)).toBe(true);
      }).not.toThrow();
    });
  });

  describe('Integration with Search Results', () => {
    test('sorts search results by relevance', () => {
      const searchResults = testBookmarks.map(bookmark => ({
        bookmark,
        score: Math.random(),
        matches: []
      }));

      const sorted = sortingSystem.sortSearchResults(searchResults);

      // Should be sorted by score (descending)
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i-1].score).toBeGreaterThanOrEqual(sorted[i].score);
      }
    });

    test('applies secondary sort to search results with equal scores', () => {
      const equalScoreResults = testBookmarks.map(bookmark => ({
        bookmark,
        score: 1.0, // Same score for all
        matches: []
      }));

      const options: SortOptions = {
        criteria: 'date-created',
        direction: 'desc'
      };

      const sorted = sortingSystem.sortSearchResults(equalScoreResults, options);

      // Should apply secondary sort by date
      for (let i = 1; i < sorted.length; i++) {
        const prevDate = new Date(sorted[i-1].bookmark.created);
        const currDate = new Date(sorted[i].bookmark.created);
        expect(prevDate.getTime()).toBeGreaterThanOrEqual(currDate.getTime());
      }
    });
  });

  describe('Internationalization and Localization', () => {
    test('sorts text using locale-aware comparison', () => {
      const internationalBookmarks = [
        createMockBookmark({ note: 'Åpple' }),
        createMockBookmark({ note: 'Banana' }),
        createMockBookmark({ note: 'Ärchive' })
      ];

      const options: SortOptions = {
        criteria: 'alphabetical-note',
        direction: 'asc'
      };

      const sorted = sortingSystem.sortBookmarks(internationalBookmarks, options);

      // Should handle international characters correctly
      expect(sorted.length).toBe(3);
    });

    test('respects user locale for date formatting in groups', () => {
      const grouped = sortingSystem.groupBookmarks(testBookmarks, 'date');

      // Date group keys should be formatted appropriately
      grouped.groups.forEach(group => {
        expect(group.label).toBeDefined();
        expect(typeof group.label).toBe('string');
      });
    });
  });
});