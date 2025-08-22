/**
 * SidebarManager
 *
 * Integration layer for the bookmark sidebar system that:
 * - Coordinates between sidebar components and existing UI
 * - Manages sidebar state and lifecycle
 * - Handles real-time bookmark updates and synchronization
 * - Provides keyboard shortcuts and accessibility
 * - Integrates with navigation controller and storage
 * - Optimizes performance for large bookmark collections
 */

import { Bookmark, Platform } from '../../../types/bookmark';
import { BookmarkSidebar, BookmarkSidebarCallbacks, BookmarkFilters } from './BookmarkSidebar';
import { VirtualBookmarkList, VirtualListItem, VirtualListCallbacks } from './VirtualBookmarkList';
import { SearchFilter, SearchQuery, SearchOptions } from './SearchFilter';
import { SortingSystem, SortOptions, GroupedBookmarks } from './SortingSystem';
import { StorageService } from '../../storage/StorageService';
import { NavigationController } from '../../navigation/NavigationController';

export interface SidebarManagerOptions {
  position?: 'left' | 'right';
  initialWidth?: number;
  platform?: Platform;
  storageService?: StorageService;
  navigationController?: NavigationController;
  autoLoad?: boolean;
}

export interface SidebarManagerCallbacks {
  onBookmarkNavigate?: (bookmark: Bookmark) => void;
  onBookmarkUpdate?: (bookmark: Bookmark) => void;
  onBookmarkDelete?: (bookmarkId: string) => void;
  onSidebarToggle?: (visible: boolean) => void;
  onSearchChange?: (query: string, resultCount: number) => void;
}

export interface SidebarState {
  visible: boolean;
  collapsed: boolean;
  loading: boolean;
  searchQuery: string;
  activeFilters: BookmarkFilters;
  sortOptions: SortOptions;
  selectedBookmarks: Bookmark[];
}

/**
 * Manages the bookmark sidebar and its integration with the extension
 */
export class SidebarManager {
  // Components
  private sidebar: BookmarkSidebar | null = null;
  private virtualList: VirtualBookmarkList | null = null;
  private searchFilter: SearchFilter;
  private sortingSystem: SortingSystem;

  // Services
  private storageService: StorageService | null = null;
  private navigationController: NavigationController | null = null;

  // State
  private state: SidebarState = {
    visible: false,
    collapsed: false,
    loading: false,
    searchQuery: '',
    activeFilters: {},
    sortOptions: {
      criteria: 'date-created',
      direction: 'desc',
      groupBy: 'none',
    },
    selectedBookmarks: [],
  };

  // Data
  private allBookmarks: Bookmark[] = [];
  private filteredBookmarks: Bookmark[] = [];
  private conversationId: string | null = null;

  // Configuration
  private options: SidebarManagerOptions;
  private callbacks: SidebarManagerCallbacks = {};

  // Performance optimization
  private updateDebounceTimeout: number | null = null;
  private searchDebounceTimeout: number | null = null;
  private readonly DEBOUNCE_DELAY = 300;
  private readonly SEARCH_DEBOUNCE_DELAY = 150;

  constructor(options: SidebarManagerOptions = {}) {
    this.options = {
      position: 'right',
      initialWidth: 380,
      autoLoad: true,
      ...options,
    };

    this.searchFilter = new SearchFilter();
    this.sortingSystem = new SortingSystem();
    this.storageService = options.storageService || null;
    this.navigationController = options.navigationController || null;

    this.initializeComponents();
    
    if (this.options.autoLoad) {
      this.loadBookmarks();
    }
  }

  /**
   * Initialize sidebar components
   */
  private initializeComponents(): void {
    this.createSidebar();
    this.createVirtualList();
    this.setupCallbacks();
    this.registerComponents();
  }

  /**
   * Create the main sidebar component
   */
  private createSidebar(): void {
    this.sidebar = new BookmarkSidebar();
    
    // Apply initial configuration
    this.sidebar.position = this.options.position!;
    this.sidebar.width = this.options.initialWidth!;
    
    // Set up sidebar callbacks
    const sidebarCallbacks: BookmarkSidebarCallbacks = {
      onBookmarkClick: this.handleBookmarkClick.bind(this),
      onBookmarkEdit: this.handleBookmarkEdit.bind(this),
      onBookmarkDelete: (bookmarkId: string) => this.handleBookmarkDeleteById(bookmarkId),
      onSearchChange: this.handleSearchChange.bind(this),
      onFilterChange: this.handleFilterChange.bind(this),
    };
    
    this.sidebar.setCallbacks(sidebarCallbacks);
  }

  /**
   * Create the virtual list component
   */
  private createVirtualList(): void {
    this.virtualList = new VirtualBookmarkList();
    
    // Set up virtual list callbacks
    const listCallbacks: VirtualListCallbacks = {
      onItemClick: this.handleBookmarkClick.bind(this),
      onItemEdit: this.handleBookmarkEdit.bind(this),
      onItemDelete: (bookmark: Bookmark) => this.handleBookmarkDelete(bookmark),
      onSelectionChange: this.handleSelectionChange.bind(this),
    };
    
    this.virtualList.setCallbacks(listCallbacks);
    this.virtualList.setOptions({
      itemHeight: 80,
      overscan: 5,
      multiSelect: false,
      showMatches: true,
    });
  }

  /**
   * Set up internal callbacks
   */
  private setupCallbacks(): void {
    // Listen for storage changes
    if (this.storageService) {
      // Note: Would need to add event emitter to StorageService
      // this.storageService.on('bookmarksChanged', this.handleStorageChange.bind(this));
    }

    // Listen for navigation changes
    if (this.navigationController) {
      // Note: Would need to add event emitter to NavigationController
      // this.navigationController.on('conversationChanged', this.handleConversationChange.bind(this));
    }
  }

  /**
   * Register components with the custom elements registry
   */
  private registerComponents(): void {
    if (!customElements.get('bookmark-sidebar')) {
      customElements.define('bookmark-sidebar', BookmarkSidebar);
    }

    if (!customElements.get('virtual-bookmark-list')) {
      customElements.define('virtual-bookmark-list', VirtualBookmarkList);
    }
  }

  /**
   * Show the sidebar
   */
  show(): void {
    if (!this.sidebar) return;

    this.sidebar.show();
    this.state.visible = true;
    this.callbacks.onSidebarToggle?.(true);

    // Ensure sidebar is attached to DOM
    if (!this.sidebar.isConnected) {
      document.body.appendChild(this.sidebar);
    }

    // Load bookmarks if not already loaded
    if (this.allBookmarks.length === 0 && this.options.autoLoad) {
      this.loadBookmarks();
    }
  }

  /**
   * Hide the sidebar
   */
  hide(): void {
    if (!this.sidebar) return;

    this.sidebar.hide();
    this.state.visible = false;
    this.callbacks.onSidebarToggle?.(false);
  }

  /**
   * Toggle sidebar visibility
   */
  toggle(): void {
    if (this.state.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Load bookmarks from storage
   */
  async loadBookmarks(): Promise<void> {
    if (!this.storageService) {
      console.warn('SidebarManager: No storage service available');
      return;
    }

    this.setLoading(true);

    try {
      // Load bookmarks for current conversation or all bookmarks
      let bookmarks: Bookmark[];
      
      if (this.conversationId) {
        const filters = { conversationId: this.conversationId };
        bookmarks = await this.storageService.getBookmarks(filters);
      } else {
        bookmarks = await this.storageService.getBookmarks();
      }

      this.setBookmarks(bookmarks);
      
    } catch (error) {
      console.error('SidebarManager: Failed to load bookmarks:', error);
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Set bookmarks and update display
   */
  setBookmarks(bookmarks: Bookmark[]): void {
    this.allBookmarks = [...bookmarks];
    this.searchFilter.initialize(bookmarks);
    this.applyFiltersAndSort();
  }

  /**
   * Add a new bookmark
   */
  addBookmark(bookmark: Bookmark): void {
    this.allBookmarks.push(bookmark);
    this.searchFilter.updateIndex(this.allBookmarks);
    this.applyFiltersAndSort();
  }

  /**
   * Update an existing bookmark
   */
  updateBookmark(bookmark: Bookmark): void {
    const index = this.allBookmarks.findIndex(b => b.id === bookmark.id);
    if (index >= 0) {
      this.allBookmarks[index] = bookmark;
      this.searchFilter.updateIndex(this.allBookmarks);
      this.applyFiltersAndSort();
    }
  }

  /**
   * Remove a bookmark
   */
  removeBookmark(bookmarkId: string): void {
    this.allBookmarks = this.allBookmarks.filter(b => b.id !== bookmarkId);
    this.searchFilter.updateIndex(this.allBookmarks);
    this.applyFiltersAndSort();
  }

  /**
   * Set current conversation ID
   */
  setConversationId(conversationId: string): void {
    if (this.conversationId === conversationId) return;

    this.conversationId = conversationId;
    
    if (this.options.autoLoad) {
      this.loadBookmarks();
    }
  }

  /**
   * Apply current filters and sorting
   */
  private applyFiltersAndSort(): void {
    // Clear any pending updates
    if (this.updateDebounceTimeout) {
      clearTimeout(this.updateDebounceTimeout);
    }

    this.updateDebounceTimeout = window.setTimeout(() => {
      this.performFiltersAndSort();
    }, this.DEBOUNCE_DELAY);
  }

  /**
   * Perform the actual filtering and sorting
   */
  private performFiltersAndSort(): void {
    const searchQuery: SearchQuery = {
      text: this.state.searchQuery,
      tags: this.state.activeFilters.tags,
      platforms: this.state.activeFilters.platforms,
      dateRange: this.state.activeFilters.dateRange,
      sortBy: this.state.sortOptions.criteria as any,
      sortDirection: this.state.sortOptions.direction,
    };

    // Apply search and filters
    this.filteredBookmarks = this.searchFilter.search(
      searchQuery,
      this.allBookmarks,
      {
        fuzzyThreshold: 0.7,
        maxResults: 1000,
        includeMatches: true,
      }
    );

    // Apply grouping if specified
    if (this.state.sortOptions.groupBy && this.state.sortOptions.groupBy !== 'none') {
      const grouped = this.sortingSystem.groupBookmarks(
        this.filteredBookmarks,
        this.state.sortOptions.groupBy
      );
      
      // Flatten grouped results for virtual list
      // In a full implementation, this would support group headers
      this.filteredBookmarks = [
        ...grouped.ungrouped,
        ...grouped.groups.flatMap(group => group.bookmarks)
      ];
    }

    this.updateVirtualList();
    this.updateSidebarState();

    // Emit search change callback
    this.callbacks.onSearchChange?.(
      this.state.searchQuery,
      this.filteredBookmarks.length
    );
  }

  /**
   * Update the virtual list component
   */
  private updateVirtualList(): void {
    if (!this.virtualList) return;

    // Convert bookmarks to virtual list items
    const listItems: VirtualListItem[] = this.filteredBookmarks.map(bookmark => ({
      bookmark,
      height: 80, // Could be dynamic based on content
      matches: [], // Would include search matches here
      selected: this.state.selectedBookmarks.some(b => b.id === bookmark.id),
    }));

    this.virtualList.setItems(listItems);
  }

  /**
   * Update sidebar display state
   */
  private updateSidebarState(): void {
    if (!this.sidebar) return;

    this.sidebar.updateBookmarkList(this.filteredBookmarks);
  }

  /**
   * Set loading state
   */
  private setLoading(loading: boolean): void {
    this.state.loading = loading;
    
    if (this.virtualList) {
      this.virtualList.loading = loading;
    }
  }

  /**
   * Handle bookmark click
   */
  private handleBookmarkClick(bookmark: Bookmark): void {
    this.callbacks.onBookmarkNavigate?.(bookmark);
    
    // Navigate using navigation controller if available
    if (this.navigationController) {
      this.navigationController.navigateToBookmark(bookmark.id);
    }
  }

  /**
   * Handle bookmark edit
   */
  private handleBookmarkEdit(bookmark: Bookmark): void {
    this.callbacks.onBookmarkUpdate?.(bookmark);
  }

  /**
   * Handle bookmark delete by ID
   */
  private async handleBookmarkDeleteById(bookmarkId: string): Promise<void> {
    const bookmark = this.allBookmarks.find(b => b.id === bookmarkId);
    if (bookmark) {
      await this.handleBookmarkDelete(bookmark);
    }
  }

  /**
   * Handle bookmark delete
   */
  private async handleBookmarkDelete(bookmark: Bookmark): Promise<void> {
    if (!this.storageService) return;

    try {
      await this.storageService.deleteBookmark(bookmark.id);
      this.removeBookmark(bookmark.id);
      this.callbacks.onBookmarkDelete?.(bookmark.id);
    } catch (error) {
      console.error('SidebarManager: Failed to delete bookmark:', error);
    }
  }

  /**
   * Handle search input change
   */
  private handleSearchChange(query: string): void {
    this.state.searchQuery = query;

    // Debounced search
    if (this.searchDebounceTimeout) {
      clearTimeout(this.searchDebounceTimeout);
    }

    this.searchDebounceTimeout = window.setTimeout(() => {
      this.applyFiltersAndSort();
    }, this.SEARCH_DEBOUNCE_DELAY);
  }

  /**
   * Handle filter change
   */
  private handleFilterChange(filters: BookmarkFilters): void {
    this.state.activeFilters = { ...filters };
    
    // Update sort options if they're included in filters
    if (filters.sortBy) {
      this.state.sortOptions.criteria = filters.sortBy as any;
    }
    if (filters.sortDirection) {
      this.state.sortOptions.direction = filters.sortDirection;
    }

    this.applyFiltersAndSort();
  }

  /**
   * Handle selection change from virtual list
   */
  private handleSelectionChange(selectedBookmarks: Bookmark[]): void {
    this.state.selectedBookmarks = [...selectedBookmarks];
  }

  /**
   * Handle storage changes
   */
  private handleStorageChange(): void {
    // Reload bookmarks when storage changes
    this.loadBookmarks();
  }

  /**
   * Handle conversation changes
   */
  private handleConversationChange(conversationId: string): void {
    this.setConversationId(conversationId);
  }

  // Public API

  /**
   * Get current sidebar state
   */
  getState(): SidebarState {
    return { ...this.state };
  }

  /**
   * Set callbacks for sidebar events
   */
  setCallbacks(callbacks: SidebarManagerCallbacks): void {
    this.callbacks = { ...callbacks };
  }

  /**
   * Update sidebar options
   */
  updateOptions(options: Partial<SidebarManagerOptions>): void {
    this.options = { ...this.options, ...options };

    // Apply position changes
    if (options.position && this.sidebar) {
      this.sidebar.position = options.position;
    }

    // Apply width changes
    if (options.initialWidth && this.sidebar) {
      this.sidebar.width = options.initialWidth;
    }
  }

  /**
   * Clear search and filters
   */
  clearFilters(): void {
    this.state.searchQuery = '';
    this.state.activeFilters = {};
    this.applyFiltersAndSort();
  }

  /**
   * Set search query programmatically
   */
  setSearchQuery(query: string): void {
    this.state.searchQuery = query;
    this.applyFiltersAndSort();
  }

  /**
   * Get filtered bookmarks
   */
  getFilteredBookmarks(): Bookmark[] {
    return [...this.filteredBookmarks];
  }

  /**
   * Get all bookmarks
   */
  getAllBookmarks(): Bookmark[] {
    return [...this.allBookmarks];
  }

  /**
   * Focus search input
   */
  focusSearch(): void {
    if (this.sidebar && this.state.visible) {
      // Focus the search input
      const searchInput = this.sidebar.shadowRoot?.querySelector('.search-input') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
    }
  }

  /**
   * Scroll to bookmark
   */
  scrollToBookmark(bookmarkId: string): void {
    if (!this.virtualList) return;

    const index = this.filteredBookmarks.findIndex(b => b.id === bookmarkId);
    if (index >= 0) {
      this.virtualList.scrollToIndex(index);
    }
  }

  /**
   * Export bookmarks
   */
  exportBookmarks(): string {
    return JSON.stringify(this.filteredBookmarks, null, 2);
  }

  /**
   * Get sidebar element
   */
  getSidebarElement(): BookmarkSidebar | null {
    return this.sidebar;
  }

  /**
   * Cleanup and dispose
   */
  dispose(): void {
    // Clear timeouts
    if (this.updateDebounceTimeout) {
      clearTimeout(this.updateDebounceTimeout);
    }
    if (this.searchDebounceTimeout) {
      clearTimeout(this.searchDebounceTimeout);
    }

    // Clean up search filter
    this.searchFilter.clear();

    // Remove sidebar from DOM
    if (this.sidebar && this.sidebar.isConnected) {
      this.sidebar.remove();
    }

    // Clean up references
    this.sidebar = null;
    this.virtualList = null;
    this.allBookmarks = [];
    this.filteredBookmarks = [];
    this.callbacks = {};
  }
}