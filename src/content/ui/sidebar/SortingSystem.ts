/**
 * SortingSystem for Bookmarks
 *
 * Advanced sorting system with multiple criteria and user customization:
 * - Multiple sort criteria (date, alphabetical, relevance, custom)
 * - Custom user-defined sorting with drag-and-drop
 * - Stable sorting algorithms for consistent results
 * - Performance optimization for large datasets
 * - Sort persistence and user preferences
 * - Group-based sorting with hierarchical organization
 */

import { Bookmark, Platform } from '../../../types/bookmark';
import { SearchResult } from './SearchFilter';

export type SortCriteria = 
  | 'date-created'
  | 'date-updated'
  | 'alphabetical-note'
  | 'alphabetical-content'
  | 'platform'
  | 'relevance'
  | 'custom'
  | 'tag-count'
  | 'content-length';

export type SortDirection = 'asc' | 'desc';

export interface SortOptions {
  criteria: SortCriteria;
  direction: SortDirection;
  groupBy?: GroupCriteria;
  secondaryCriteria?: SortCriteria;
  customOrder?: string[]; // Bookmark IDs in custom order
}

export type GroupCriteria = 
  | 'none'
  | 'date'
  | 'platform'
  | 'tag'
  | 'conversation';

export interface GroupedBookmarks {
  groups: BookmarkGroup[];
  ungrouped: Bookmark[];
}

export interface BookmarkGroup {
  id: string;
  name: string;
  bookmarks: Bookmark[];
  count: number;
  metadata?: {
    date?: Date;
    platform?: Platform;
    tag?: string;
    conversationId?: string;
  };
}

export interface SortPreferences {
  defaultSort: SortOptions;
  customOrders: Map<string, string[]>; // Context-specific custom orders
  groupPreferences: {
    expandedGroups: Set<string>;
    groupSort: SortCriteria;
    groupDirection: SortDirection;
  };
}

/**
 * Advanced sorting and grouping system for bookmarks
 */
export class SortingSystem {
  private preferences: SortPreferences = {
    defaultSort: {
      criteria: 'date-created',
      direction: 'desc',
      groupBy: 'none',
    },
    customOrders: new Map(),
    groupPreferences: {
      expandedGroups: new Set(),
      groupSort: 'date-created',
      groupDirection: 'desc',
    },
  };

  private sortFunctions: Map<SortCriteria, (a: Bookmark, b: Bookmark) => number> = new Map();

  constructor() {
    this.initializeSortFunctions();
    this.loadPreferences();
  }

  /**
   * Initialize built-in sort functions
   */
  private initializeSortFunctions(): void {
    this.sortFunctions.set('date-created', (a, b) => {
      return new Date(a.created).getTime() - new Date(b.created).getTime();
    });

    this.sortFunctions.set('date-updated', (a, b) => {
      return new Date(a.updated).getTime() - new Date(b.updated).getTime();
    });

    this.sortFunctions.set('alphabetical-note', (a, b) => {
      return a.note.localeCompare(b.note, undefined, { 
        numeric: true, 
        sensitivity: 'base' 
      });
    });

    this.sortFunctions.set('alphabetical-content', (a, b) => {
      return a.anchor.selectedText.localeCompare(b.anchor.selectedText, undefined, { 
        numeric: true, 
        sensitivity: 'base' 
      });
    });

    this.sortFunctions.set('platform', (a, b) => {
      return a.platform.localeCompare(b.platform);
    });

    this.sortFunctions.set('tag-count', (a, b) => {
      return a.tags.length - b.tags.length;
    });

    this.sortFunctions.set('content-length', (a, b) => {
      return a.anchor.selectedText.length - b.anchor.selectedText.length;
    });

    this.sortFunctions.set('relevance', (a, b) => {
      // Default relevance is based on creation date (newer = more relevant)
      // This can be overridden when search results provide scores
      return new Date(b.created).getTime() - new Date(a.created).getTime();
    });

    this.sortFunctions.set('custom', (a, b) => {
      // Custom sorting handled separately
      return 0;
    });
  }

  /**
   * Sort bookmarks with the given options
   */
  sortBookmarks(bookmarks: Bookmark[], options: SortOptions): Bookmark[] {
    if (bookmarks.length === 0) return bookmarks;

    let sorted = [...bookmarks];

    // Handle custom sorting
    if (options.criteria === 'custom' && options.customOrder) {
      return this.applyCustomSort(sorted, options.customOrder);
    }

    // Apply primary sorting
    const primarySortFn = this.sortFunctions.get(options.criteria);
    if (primarySortFn) {
      sorted = this.stableSort(sorted, primarySortFn);
    }

    // Apply secondary sorting if specified
    if (options.secondaryCriteria) {
      const secondarySortFn = this.sortFunctions.get(options.secondaryCriteria);
      if (secondarySortFn) {
        sorted = this.stableSort(sorted, (a, b) => {
          const primary = primarySortFn ? primarySortFn(a, b) : 0;
          return primary !== 0 ? primary : secondarySortFn(a, b);
        });
      }
    }

    // Apply direction
    if (options.direction === 'desc') {
      sorted.reverse();
    }

    return sorted;
  }

  /**
   * Sort bookmarks with search relevance scores
   */
  sortWithRelevance(
    results: SearchResult[], 
    options: Omit<SortOptions, 'criteria'> & { fallbackCriteria?: SortCriteria }
  ): Bookmark[] {
    if (results.length === 0) return [];

    // Sort by relevance score first
    const sortedByRelevance = [...results].sort((a, b) => b.score - a.score);

    // If fallback criteria specified, use it for items with same score
    if (options.fallbackCriteria) {
      const fallbackSortFn = this.sortFunctions.get(options.fallbackCriteria);
      if (fallbackSortFn) {
        return this.stableSort(
          sortedByRelevance,
          (a, b) => {
            const scoreDiff = b.score - a.score;
            return Math.abs(scoreDiff) < 0.001 ? 
              fallbackSortFn(a.bookmark, b.bookmark) : 
              scoreDiff;
          }
        ).map(result => result.bookmark);
      }
    }

    return sortedByRelevance.map(result => result.bookmark);
  }

  /**
   * Group bookmarks by specified criteria
   */
  groupBookmarks(bookmarks: Bookmark[], groupBy: GroupCriteria): GroupedBookmarks {
    if (groupBy === 'none') {
      return {
        groups: [],
        ungrouped: bookmarks,
      };
    }

    const groups: Map<string, BookmarkGroup> = new Map();
    const ungrouped: Bookmark[] = [];

    bookmarks.forEach(bookmark => {
      const groupKeys = this.getGroupKeys(bookmark, groupBy);

      if (groupKeys.length === 0) {
        ungrouped.push(bookmark);
        return;
      }

      groupKeys.forEach(key => {
        if (!groups.has(key)) {
          groups.set(key, this.createGroup(key, groupBy, bookmark));
        }
        groups.get(key)!.bookmarks.push(bookmark);
        groups.get(key)!.count++;
      });
    });

    // Sort groups
    const sortedGroups = Array.from(groups.values()).sort(
      this.getGroupSortFunction(groupBy)
    );

    // Sort bookmarks within each group
    const sortOptions = this.getDefaultSortForGroup(groupBy);
    sortedGroups.forEach(group => {
      group.bookmarks = this.sortBookmarks(group.bookmarks, sortOptions);
    });

    return {
      groups: sortedGroups,
      ungrouped,
    };
  }

  /**
   * Apply custom sort order
   */
  private applyCustomSort(bookmarks: Bookmark[], customOrder: string[]): Bookmark[] {
    const orderMap = new Map(customOrder.map((id, index) => [id, index]));
    
    return bookmarks.sort((a, b) => {
      const indexA = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const indexB = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      
      if (indexA === indexB) {
        // Fall back to date sorting for items not in custom order
        return new Date(b.created).getTime() - new Date(a.created).getTime();
      }
      
      return indexA - indexB;
    });
  }

  /**
   * Stable sort implementation
   */
  private stableSort<T>(arr: T[], compareFn: (a: T, b: T) => number): T[] {
    return arr
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const result = compareFn(a.item, b.item);
        return result !== 0 ? result : a.index - b.index;
      })
      .map(({ item }) => item);
  }

  /**
   * Get group keys for a bookmark
   */
  private getGroupKeys(bookmark: Bookmark, groupBy: GroupCriteria): string[] {
    switch (groupBy) {
      case 'date':
        return [this.getDateGroupKey(new Date(bookmark.created))];

      case 'platform':
        return [bookmark.platform];

      case 'tag':
        return bookmark.tags.length > 0 ? bookmark.tags : ['untagged'];

      case 'conversation':
        return [bookmark.conversationId || 'unknown'];

      default:
        return [];
    }
  }

  /**
   * Create a group object
   */
  private createGroup(key: string, groupBy: GroupCriteria, bookmark: Bookmark): BookmarkGroup {
    const group: BookmarkGroup = {
      id: `${groupBy}-${key}`,
      name: this.getGroupDisplayName(key, groupBy),
      bookmarks: [],
      count: 0,
      metadata: {},
    };

    // Add metadata based on group type
    switch (groupBy) {
      case 'date':
        group.metadata!.date = this.parseGroupDateKey(key);
        break;
      case 'platform':
        group.metadata!.platform = key as Platform;
        break;
      case 'tag':
        group.metadata!.tag = key;
        break;
      case 'conversation':
        group.metadata!.conversationId = key;
        break;
    }

    return group;
  }

  /**
   * Get display name for a group
   */
  private getGroupDisplayName(key: string, groupBy: GroupCriteria): string {
    switch (groupBy) {
      case 'date':
        return this.formatDateGroupName(key);

      case 'platform':
        return key.charAt(0).toUpperCase() + key.slice(1);

      case 'tag':
        return key === 'untagged' ? 'Untagged' : key;

      case 'conversation':
        return key === 'unknown' ? 'Unknown Conversation' : `Conversation ${key.slice(0, 8)}...`;

      default:
        return key;
    }
  }

  /**
   * Get date group key (groups by day/week/month)
   */
  private getDateGroupKey(date: Date): string {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'today';
    } else if (diffDays === 1) {
      return 'yesterday';
    } else if (diffDays < 7) {
      return 'this-week';
    } else if (diffDays < 30) {
      return 'this-month';
    } else if (diffDays < 365) {
      return date.toISOString().slice(0, 7); // YYYY-MM format
    } else {
      return date.getFullYear().toString();
    }
  }

  /**
   * Parse date group key back to date
   */
  private parseGroupDateKey(key: string): Date {
    const now = new Date();
    
    switch (key) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday;
      case 'this-week':
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - now.getDay());
        return weekStart;
      case 'this-month':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      default:
        if (key.match(/^\d{4}-\d{2}$/)) {
          const [year, month] = key.split('-').map(Number);
          return new Date(year, month - 1, 1);
        } else if (key.match(/^\d{4}$/)) {
          return new Date(Number(key), 0, 1);
        }
        return now;
    }
  }

  /**
   * Format date group name for display
   */
  private formatDateGroupName(key: string): string {
    switch (key) {
      case 'today':
        return 'Today';
      case 'yesterday':
        return 'Yesterday';
      case 'this-week':
        return 'This Week';
      case 'this-month':
        return 'This Month';
      default:
        if (key.match(/^\d{4}-\d{2}$/)) {
          const [year, month] = key.split('-').map(Number);
          const date = new Date(year, month - 1);
          return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
        } else if (key.match(/^\d{4}$/)) {
          return key;
        }
        return key;
    }
  }

  /**
   * Get sort function for groups
   */
  private getGroupSortFunction(groupBy: GroupCriteria): (a: BookmarkGroup, b: BookmarkGroup) => number {
    switch (groupBy) {
      case 'date':
        return (a, b) => {
          const dateA = a.metadata?.date || new Date(0);
          const dateB = b.metadata?.date || new Date(0);
          return dateB.getTime() - dateA.getTime(); // Newer first
        };

      case 'platform':
        return (a, b) => a.name.localeCompare(b.name);

      case 'tag':
        return (a, b) => {
          // Untagged last, then alphabetical
          if (a.name === 'Untagged') return 1;
          if (b.name === 'Untagged') return -1;
          return a.name.localeCompare(b.name);
        };

      case 'conversation':
        return (a, b) => b.count - a.count; // Most bookmarks first

      default:
        return (a, b) => a.name.localeCompare(b.name);
    }
  }

  /**
   * Get default sort options for a group type
   */
  private getDefaultSortForGroup(groupBy: GroupCriteria): SortOptions {
    switch (groupBy) {
      case 'date':
        return { criteria: 'date-created', direction: 'desc' };
      case 'platform':
        return { criteria: 'date-created', direction: 'desc' };
      case 'tag':
        return { criteria: 'alphabetical-note', direction: 'asc' };
      case 'conversation':
        return { criteria: 'date-created', direction: 'asc' };
      default:
        return this.preferences.defaultSort;
    }
  }

  /**
   * Save custom order for a context
   */
  saveCustomOrder(context: string, bookmarkIds: string[]): void {
    this.preferences.customOrders.set(context, [...bookmarkIds]);
    this.savePreferences();
  }

  /**
   * Get custom order for a context
   */
  getCustomOrder(context: string): string[] | null {
    return this.preferences.customOrders.get(context) || null;
  }

  /**
   * Update sort preferences
   */
  updatePreferences(updates: Partial<SortPreferences>): void {
    this.preferences = { ...this.preferences, ...updates };
    this.savePreferences();
  }

  /**
   * Get current preferences
   */
  getPreferences(): SortPreferences {
    return { ...this.preferences };
  }

  /**
   * Get available sort options
   */
  getAvailableSortOptions(): Array<{ value: SortCriteria; label: string; description: string }> {
    return [
      {
        value: 'date-created',
        label: 'Date Created',
        description: 'Sort by when bookmark was created'
      },
      {
        value: 'date-updated',
        label: 'Date Updated',
        description: 'Sort by when bookmark was last modified'
      },
      {
        value: 'alphabetical-note',
        label: 'Note (A-Z)',
        description: 'Sort by bookmark note alphabetically'
      },
      {
        value: 'alphabetical-content',
        label: 'Content (A-Z)',
        description: 'Sort by bookmarked text alphabetically'
      },
      {
        value: 'platform',
        label: 'Platform',
        description: 'Group by AI platform (ChatGPT, Claude, Grok)'
      },
      {
        value: 'relevance',
        label: 'Relevance',
        description: 'Sort by search relevance (when searching)'
      },
      {
        value: 'custom',
        label: 'Custom Order',
        description: 'Use your custom drag-and-drop order'
      },
      {
        value: 'tag-count',
        label: 'Tag Count',
        description: 'Sort by number of tags'
      },
      {
        value: 'content-length',
        label: 'Content Length',
        description: 'Sort by length of bookmarked text'
      }
    ];
  }

  /**
   * Get available group options
   */
  getAvailableGroupOptions(): Array<{ value: GroupCriteria; label: string; description: string }> {
    return [
      {
        value: 'none',
        label: 'No Grouping',
        description: 'Show all bookmarks in a flat list'
      },
      {
        value: 'date',
        label: 'Group by Date',
        description: 'Group bookmarks by creation date'
      },
      {
        value: 'platform',
        label: 'Group by Platform',
        description: 'Group by AI platform (ChatGPT, Claude, Grok)'
      },
      {
        value: 'tag',
        label: 'Group by Tags',
        description: 'Group bookmarks by their tags'
      },
      {
        value: 'conversation',
        label: 'Group by Conversation',
        description: 'Group bookmarks by conversation thread'
      }
    ];
  }

  /**
   * Load preferences from storage
   */
  private loadPreferences(): void {
    try {
      const saved = localStorage.getItem('chatmarks-sort-preferences');
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // Restore custom orders
        if (parsed.customOrders) {
          this.preferences.customOrders = new Map(parsed.customOrders);
        }
        
        // Restore expanded groups
        if (parsed.groupPreferences?.expandedGroups) {
          this.preferences.groupPreferences.expandedGroups = new Set(parsed.groupPreferences.expandedGroups);
        }
        
        // Restore other preferences
        this.preferences = {
          ...this.preferences,
          ...parsed,
          customOrders: this.preferences.customOrders,
          groupPreferences: {
            ...this.preferences.groupPreferences,
            ...parsed.groupPreferences,
            expandedGroups: this.preferences.groupPreferences.expandedGroups,
          },
        };
      }
    } catch (error) {
      console.warn('Failed to load sort preferences:', error);
    }
  }

  /**
   * Save preferences to storage
   */
  private savePreferences(): void {
    try {
      const toSave = {
        ...this.preferences,
        customOrders: Array.from(this.preferences.customOrders.entries()),
        groupPreferences: {
          ...this.preferences.groupPreferences,
          expandedGroups: Array.from(this.preferences.groupPreferences.expandedGroups),
        },
      };
      
      localStorage.setItem('chatmarks-sort-preferences', JSON.stringify(toSave));
    } catch (error) {
      console.warn('Failed to save sort preferences:', error);
    }
  }

  /**
   * Clear all preferences
   */
  clearPreferences(): void {
    try {
      localStorage.removeItem('chatmarks-sort-preferences');
      this.preferences = {
        defaultSort: {
          criteria: 'date-created',
          direction: 'desc',
          groupBy: 'none',
        },
        customOrders: new Map(),
        groupPreferences: {
          expandedGroups: new Set(),
          groupSort: 'date-created',
          groupDirection: 'desc',
        },
      };
    } catch (error) {
      console.warn('Failed to clear sort preferences:', error);
    }
  }
}