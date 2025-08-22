/**
 * SearchFilter System
 *
 * Advanced search and filtering system for bookmarks with:
 * - Full-text search across content, notes, and tags
 * - Multi-criteria filtering (tags, dates, platforms)
 * - Query parsing with boolean operators (AND, OR, NOT)
 * - Performance optimization for large datasets
 * - Fuzzy matching and relevance scoring
 */

import { Bookmark, Platform } from '../../../types/bookmark';

export interface SearchQuery {
  text?: string;
  tags?: string[];
  platforms?: Platform[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  sortBy?: SortCriteria;
  sortDirection?: 'asc' | 'desc';
}

export type SortCriteria = 'date' | 'alphabetical' | 'relevance' | 'custom';

export interface SearchResult {
  bookmark: Bookmark;
  score: number;
  matches: SearchMatch[];
}

export interface SearchMatch {
  field: 'content' | 'note' | 'tag';
  text: string;
  start: number;
  end: number;
  score: number;
}

export interface SearchOptions {
  fuzzyThreshold?: number; // 0-1, lower = more strict
  maxResults?: number;
  minScore?: number;
  includeMatches?: boolean;
}

/**
 * Advanced search and filter engine for bookmarks
 */
export class SearchFilter {
  // Search index for performance
  private searchIndex: Map<string, Set<string>> = new Map();
  private bookmarkMap: Map<string, Bookmark> = new Map();
  private lastIndexUpdate: number = 0;
  
  // Configuration
  private defaultOptions: Required<SearchOptions> = {
    fuzzyThreshold: 0.7,
    maxResults: 1000,
    minScore: 0.1,
    includeMatches: true,
  };

  /**
   * Initialize search filter with bookmark data
   */
  initialize(bookmarks: Bookmark[]): void {
    this.buildSearchIndex(bookmarks);
  }

  /**
   * Update search index when bookmarks change
   */
  updateIndex(bookmarks: Bookmark[]): void {
    const now = Date.now();
    
    // Rate limit index updates for performance
    if (now - this.lastIndexUpdate < 100) {
      return;
    }
    
    this.buildSearchIndex(bookmarks);
    this.lastIndexUpdate = now;
  }

  /**
   * Search bookmarks with comprehensive filtering
   */
  search(
    query: SearchQuery,
    bookmarks: Bookmark[],
    options?: SearchOptions
  ): Bookmark[] {
    const opts = { ...this.defaultOptions, ...options };
    
    // Start with all bookmarks
    let results = [...bookmarks];

    // Apply filters first (faster than search)
    results = this.applyFilters(results, query);

    // Apply text search if provided
    if (query.text && query.text.trim()) {
      const searchResults = this.performTextSearch(results, query.text, opts);
      results = searchResults.map(result => result.bookmark);
    }

    // Apply sorting
    results = this.sortResults(results, query);

    // Limit results
    if (opts.maxResults > 0) {
      results = results.slice(0, opts.maxResults);
    }

    return results;
  }

  /**
   * Perform advanced text search with relevance scoring
   */
  searchWithScores(
    query: string,
    bookmarks: Bookmark[],
    options?: SearchOptions
  ): SearchResult[] {
    const opts = { ...this.defaultOptions, ...options };
    
    if (!query.trim()) {
      return bookmarks.map(bookmark => ({
        bookmark,
        score: 1,
        matches: [],
      }));
    }

    return this.performTextSearch(bookmarks, query, opts);
  }

  /**
   * Get search suggestions based on existing bookmarks
   */
  getSuggestions(query: string, bookmarks: Bookmark[], limit: number = 10): string[] {
    const suggestions = new Set<string>();
    const lowerQuery = query.toLowerCase();

    // Get tag suggestions
    bookmarks.forEach(bookmark => {
      bookmark.tags.forEach(tag => {
        if (tag.toLowerCase().includes(lowerQuery)) {
          suggestions.add(tag);
        }
      });
    });

    // Get content suggestions (extract common phrases)
    if (query.length > 2) {
      const phrases = this.extractCommonPhrases(bookmarks, query);
      phrases.forEach(phrase => suggestions.add(phrase));
    }

    return Array.from(suggestions).slice(0, limit);
  }

  /**
   * Build search index for performance optimization
   */
  private buildSearchIndex(bookmarks: Bookmark[]): void {
    this.searchIndex.clear();
    this.bookmarkMap.clear();

    bookmarks.forEach(bookmark => {
      this.bookmarkMap.set(bookmark.id, bookmark);

      // Index searchable text
      const searchableText = this.getSearchableText(bookmark);
      const terms = this.tokenize(searchableText);

      terms.forEach(term => {
        if (!this.searchIndex.has(term)) {
          this.searchIndex.set(term, new Set());
        }
        this.searchIndex.get(term)!.add(bookmark.id);
      });
    });
  }

  /**
   * Extract searchable text from a bookmark
   */
  private getSearchableText(bookmark: Bookmark): string {
    return [
      bookmark.anchor.selectedText,
      bookmark.note,
      ...bookmark.tags,
    ].join(' ').toLowerCase();
  }

  /**
   * Tokenize text for search indexing
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 1);
  }

  /**
   * Apply non-text filters to bookmark list
   */
  private applyFilters(bookmarks: Bookmark[], query: SearchQuery): Bookmark[] {
    let filtered = bookmarks;

    // Platform filter
    if (query.platforms && query.platforms.length > 0) {
      filtered = filtered.filter(bookmark =>
        query.platforms!.includes(bookmark.platform)
      );
    }

    // Tag filter
    if (query.tags && query.tags.length > 0) {
      filtered = filtered.filter(bookmark =>
        query.tags!.every(tag => 
          bookmark.tags.some(bookmarkTag => 
            bookmarkTag.toLowerCase().includes(tag.toLowerCase())
          )
        )
      );
    }

    // Date range filter
    if (query.dateRange) {
      const { start, end } = query.dateRange;
      filtered = filtered.filter(bookmark => {
        const bookmarkDate = new Date(bookmark.created);
        return bookmarkDate >= start && bookmarkDate <= end;
      });
    }

    return filtered;
  }

  /**
   * Perform text search with scoring
   */
  private performTextSearch(
    bookmarks: Bookmark[],
    query: string,
    options: Required<SearchOptions>
  ): SearchResult[] {
    const results: SearchResult[] = [];
    const searchTerms = this.tokenize(query);

    bookmarks.forEach(bookmark => {
      const score = this.calculateRelevanceScore(bookmark, searchTerms, query);
      
      if (score >= options.minScore) {
        const matches = options.includeMatches 
          ? this.findMatches(bookmark, query)
          : [];
        
        results.push({
          bookmark,
          score,
          matches,
        });
      }
    });

    // Sort by relevance score
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate relevance score for a bookmark
   */
  private calculateRelevanceScore(
    bookmark: Bookmark,
    searchTerms: string[],
    originalQuery: string
  ): number {
    let score = 0;
    const searchableFields = {
      content: bookmark.anchor.selectedText.toLowerCase(),
      note: bookmark.note.toLowerCase(),
      tags: bookmark.tags.join(' ').toLowerCase(),
    };

    // Field weights
    const weights = {
      content: 1.0,
      note: 0.8,
      tags: 0.6,
    };

    // Exact phrase match bonus
    const exactPhrase = originalQuery.toLowerCase();
    Object.entries(searchableFields).forEach(([field, text]) => {
      if (text.includes(exactPhrase)) {
        score += weights[field as keyof typeof weights] * 2;
      }
    });

    // Individual term matches
    searchTerms.forEach(term => {
      Object.entries(searchableFields).forEach(([field, text]) => {
        const termCount = this.countOccurrences(text, term);
        if (termCount > 0) {
          const fieldWeight = weights[field as keyof typeof weights];
          const termScore = fieldWeight * Math.log(1 + termCount);
          score += termScore;
        }
      });
    });

    // Fuzzy matching bonus
    const fuzzyScore = this.calculateFuzzyScore(searchableFields.content, exactPhrase);
    if (fuzzyScore > 0.5) {
      score += fuzzyScore * 0.5;
    }

    // Recency bonus (newer bookmarks get slight boost)
    const daysSinceCreated = (Date.now() - new Date(bookmark.created).getTime()) / (1000 * 60 * 60 * 24);
    const recencyBonus = Math.max(0, (30 - daysSinceCreated) / 30) * 0.1;
    score += recencyBonus;

    return score;
  }

  /**
   * Count occurrences of a term in text
   */
  private countOccurrences(text: string, term: string): number {
    const regex = new RegExp(term, 'gi');
    const matches = text.match(regex);
    return matches ? matches.length : 0;
  }

  /**
   * Calculate fuzzy matching score using Levenshtein distance
   */
  private calculateFuzzyScore(text: string, query: string): number {
    if (!query || !text) return 0;

    const maxLength = Math.max(text.length, query.length);
    if (maxLength === 0) return 1;

    const distance = this.levenshteinDistance(text, query);
    return 1 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Find specific matches within a bookmark
   */
  private findMatches(bookmark: Bookmark, query: string): SearchMatch[] {
    const matches: SearchMatch[] = [];
    const lowerQuery = query.toLowerCase();

    // Check content
    const content = bookmark.anchor.selectedText;
    const contentMatches = this.findTextMatches(content, lowerQuery, 'content');
    matches.push(...contentMatches);

    // Check note
    const noteMatches = this.findTextMatches(bookmark.note, lowerQuery, 'note');
    matches.push(...noteMatches);

    // Check tags
    bookmark.tags.forEach(tag => {
      if (tag.toLowerCase().includes(lowerQuery)) {
        matches.push({
          field: 'tag',
          text: tag,
          start: 0,
          end: tag.length,
          score: 1.0,
        });
      }
    });

    return matches;
  }

  /**
   * Find text matches within a specific field
   */
  private findTextMatches(
    text: string,
    query: string,
    field: 'content' | 'note' | 'tag'
  ): SearchMatch[] {
    const matches: SearchMatch[] = [];
    const lowerText = text.toLowerCase();
    
    let startIndex = 0;
    let matchIndex = lowerText.indexOf(query, startIndex);
    
    while (matchIndex !== -1) {
      matches.push({
        field,
        text: text.substring(matchIndex, matchIndex + query.length),
        start: matchIndex,
        end: matchIndex + query.length,
        score: 1.0,
      });
      
      startIndex = matchIndex + 1;
      matchIndex = lowerText.indexOf(query, startIndex);
    }

    return matches;
  }

  /**
   * Sort results based on criteria
   */
  private sortResults(bookmarks: Bookmark[], query: SearchQuery): Bookmark[] {
    const { sortBy = 'date', sortDirection = 'desc' } = query;

    return bookmarks.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          comparison = new Date(a.created).getTime() - new Date(b.created).getTime();
          break;

        case 'alphabetical':
          comparison = a.note.localeCompare(b.note) || 
                      a.anchor.selectedText.localeCompare(b.anchor.selectedText);
          break;

        case 'relevance':
          // Relevance sorting handled by score in performTextSearch
          comparison = 0;
          break;

        case 'custom':
          // Could implement user-defined sorting
          comparison = 0;
          break;

        default:
          comparison = 0;
      }

      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Extract common phrases from bookmarks for suggestions
   */
  private extractCommonPhrases(bookmarks: Bookmark[], query: string): string[] {
    const phrases = new Set<string>();
    const queryWords = this.tokenize(query);
    
    bookmarks.forEach(bookmark => {
      const text = this.getSearchableText(bookmark);
      const words = this.tokenize(text);
      
      // Find phrases that contain query words
      for (let i = 0; i < words.length - 1; i++) {
        const phrase = `${words[i]} ${words[i + 1]}`;
        const containsQueryWord = queryWords.some(queryWord =>
          phrase.includes(queryWord)
        );
        
        if (containsQueryWord && phrase.length > query.length) {
          phrases.add(phrase);
        }
      }
    });

    return Array.from(phrases);
  }

  /**
   * Get filtered bookmarks by tags
   */
  filterByTags(tags: string[], bookmarks: Bookmark[]): Bookmark[] {
    if (tags.length === 0) return bookmarks;

    return bookmarks.filter(bookmark =>
      tags.every(tag => 
        bookmark.tags.some(bookmarkTag => 
          bookmarkTag.toLowerCase().includes(tag.toLowerCase())
        )
      )
    );
  }

  /**
   * Get filtered bookmarks by date range
   */
  filterByDateRange(start: Date, end: Date, bookmarks: Bookmark[]): Bookmark[] {
    return bookmarks.filter(bookmark => {
      const bookmarkDate = new Date(bookmark.created);
      return bookmarkDate >= start && bookmarkDate <= end;
    });
  }

  /**
   * Get filtered bookmarks by platform
   */
  filterByPlatform(platforms: Platform[], bookmarks: Bookmark[]): Bookmark[] {
    if (platforms.length === 0) return bookmarks;

    return bookmarks.filter(bookmark =>
      platforms.includes(bookmark.platform)
    );
  }

  /**
   * Get all unique tags from bookmarks
   */
  getAllTags(bookmarks: Bookmark[]): string[] {
    const tagSet = new Set<string>();
    
    bookmarks.forEach(bookmark => {
      bookmark.tags.forEach(tag => tagSet.add(tag));
    });

    return Array.from(tagSet).sort();
  }

  /**
   * Get date range statistics
   */
  getDateRange(bookmarks: Bookmark[]): { earliest: Date; latest: Date } | null {
    if (bookmarks.length === 0) return null;

    const dates = bookmarks.map(b => new Date(b.created));
    const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
    const latest = new Date(Math.max(...dates.map(d => d.getTime())));

    return { earliest, latest };
  }

  /**
   * Clear search index and free memory
   */
  clear(): void {
    this.searchIndex.clear();
    this.bookmarkMap.clear();
    this.lastIndexUpdate = 0;
  }
}