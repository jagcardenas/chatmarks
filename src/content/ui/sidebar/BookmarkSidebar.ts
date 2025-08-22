/**
 * BookmarkSidebar Web Component
 *
 * A resizable sidebar for bookmark management with the following features:
 * - Responsive design that adapts to different platforms
 * - Resizable with drag handles and user preferences
 * - Search and filter capabilities
 * - Virtual scrolling for performance with large datasets
 * - Keyboard navigation and accessibility
 * - Theme integration with platform-specific styling
 */

import { BaseComponent } from '../components/base/BaseComponent';
import { Bookmark, Platform } from '../../../types/bookmark';

export interface BookmarkSidebarOptions {
  platform?: Platform;
  initialWidth?: number;
  collapsible?: boolean;
  position?: 'left' | 'right';
}

export interface BookmarkSidebarCallbacks {
  onBookmarkClick?: (bookmark: Bookmark) => void;
  onBookmarkEdit?: (bookmark: Bookmark) => void;
  onBookmarkDelete?: (bookmarkId: string) => void;
  onSearchChange?: (query: string) => void;
  onFilterChange?: (filters: BookmarkFilters) => void;
}

export interface BookmarkFilters {
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  platforms?: Platform[];
  sortBy?: 'date' | 'alphabetical' | 'relevance' | 'custom';
  sortDirection?: 'asc' | 'desc';
}

export class BookmarkSidebar extends BaseComponent {
  static componentName = 'bookmark-sidebar';
  static observedAttributes = ['visible', 'position', 'width', 'collapsed'];

  // State
  private _visible: boolean = false;
  private _collapsed: boolean = false;
  private _position: 'left' | 'right' = 'right';
  private _width: number = 380;
  private _minWidth: number = 300;
  private _maxWidth: number = 600;
  private _isResizing: boolean = false;

  // Data
  private _bookmarks: Bookmark[] = [];
  private _filteredBookmarks: Bookmark[] = [];
  private _currentFilters: BookmarkFilters = {};
  private _searchQuery: string = '';

  // Callbacks
  private _callbacks: BookmarkSidebarCallbacks = {};

  // DOM Elements (cached for performance)
  private _resizeHandle: HTMLElement | null = null;
  private _searchInput: HTMLInputElement | null = null;
  private _bookmarkList: HTMLElement | null = null;

  constructor() {
    super();
    this.setupEventListeners();
  }

  protected getTemplate(): string {
    return `
      <style>
        :host {
          position: fixed;
          top: 0;
          ${this._position}: 0;
          bottom: 0;
          width: ${this._width}px;
          min-width: ${this._minWidth}px;
          max-width: ${this._maxWidth}px;
          z-index: 2147483640;
          font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
          font-size: 14px;
          line-height: 1.5;
          transform: translateX(${this._position === 'right' ? '100%' : '-100%'});
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-sizing: border-box;
          display: none;
        }

        :host([visible]) {
          display: flex;
          flex-direction: column;
        }

        :host([visible]:not([collapsed])) {
          transform: translateX(0);
        }

        :host([collapsed]) {
          width: 60px !important;
          min-width: 60px !important;
        }

        .sidebar-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--chatmarks-sidebar-bg, #ffffff);
          border-${this._position === 'right' ? 'left' : 'right'}: 1px solid var(--chatmarks-border, #e5e7eb);
          box-shadow: ${this._position === 'right' ? '-4px' : '4px'} 0 12px -4px rgba(0, 0, 0, 0.1);
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 16px 8px 16px;
          border-bottom: 1px solid var(--chatmarks-border, #e5e7eb);
          background: var(--chatmarks-secondary, #f9fafb);
          min-height: 60px;
          box-sizing: border-box;
        }

        .sidebar-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--chatmarks-text, #1f2937);
          margin: 0;
          opacity: 1;
          transition: opacity 0.2s ease;
        }

        :host([collapsed]) .sidebar-title {
          opacity: 0;
        }

        .header-actions {
          display: flex;
          gap: 4px;
        }

        .header-button {
          background: none;
          border: none;
          width: 32px;
          height: 32px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--chatmarks-text-secondary, #6b7280);
          transition: all 0.15s ease;
        }

        .header-button:hover {
          background: var(--chatmarks-hover, #f3f4f6);
          color: var(--chatmarks-text, #1f2937);
        }

        .header-button:focus {
          outline: 2px solid var(--chatmarks-primary, #2563eb);
          outline-offset: -2px;
        }

        .header-icon {
          width: 18px;
          height: 18px;
          stroke: currentColor;
          fill: none;
          stroke-width: 2;
        }

        .search-section {
          padding: 12px 16px;
          border-bottom: 1px solid var(--chatmarks-border, #e5e7eb);
          opacity: 1;
          transition: opacity 0.2s ease;
        }

        :host([collapsed]) .search-section {
          opacity: 0;
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          padding: 8px 12px 8px 36px;
          border: 1px solid var(--chatmarks-border, #e5e7eb);
          border-radius: 8px;
          background: var(--chatmarks-input-bg, #ffffff);
          color: var(--chatmarks-text, #1f2937);
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s ease;
          box-sizing: border-box;
        }

        .search-input:focus {
          border-color: var(--chatmarks-primary, #2563eb);
          box-shadow: 0 0 0 3px var(--chatmarks-primary-alpha, rgba(37, 99, 235, 0.1));
        }

        .search-input::placeholder {
          color: var(--chatmarks-text-secondary, #6b7280);
        }

        .search-wrapper {
          position: relative;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 16px;
          height: 16px;
          color: var(--chatmarks-text-secondary, #6b7280);
          stroke: currentColor;
          fill: none;
          stroke-width: 2;
        }

        .filters-section {
          padding: 12px 16px;
          border-bottom: 1px solid var(--chatmarks-border, #e5e7eb);
          opacity: 1;
          transition: opacity 0.2s ease;
        }

        :host([collapsed]) .filters-section {
          opacity: 0;
          pointer-events: none;
        }

        .filter-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .filter-row:last-child {
          margin-bottom: 0;
        }

        .filter-select {
          flex: 1;
          padding: 6px 8px;
          border: 1px solid var(--chatmarks-border, #e5e7eb);
          border-radius: 6px;
          background: var(--chatmarks-input-bg, #ffffff);
          color: var(--chatmarks-text, #1f2937);
          font-size: 12px;
          outline: none;
          box-sizing: border-box;
        }

        .filter-select:focus {
          border-color: var(--chatmarks-primary, #2563eb);
        }

        .bookmarks-section {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .bookmarks-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px 8px 16px;
          background: var(--chatmarks-secondary, #f9fafb);
          border-bottom: 1px solid var(--chatmarks-border, #e5e7eb);
          opacity: 1;
          transition: opacity 0.2s ease;
        }

        :host([collapsed]) .bookmarks-header {
          opacity: 0;
        }

        .bookmarks-count {
          font-size: 12px;
          color: var(--chatmarks-text-secondary, #6b7280);
          font-weight: 500;
        }

        .sort-dropdown {
          padding: 4px 8px;
          border: 1px solid var(--chatmarks-border, #e5e7eb);
          border-radius: 4px;
          background: var(--chatmarks-input-bg, #ffffff);
          color: var(--chatmarks-text, #1f2937);
          font-size: 11px;
          cursor: pointer;
          outline: none;
        }

        .bookmarks-list {
          flex: 1;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: var(--chatmarks-scrollbar, #cbd5e0) transparent;
        }

        .bookmarks-list::-webkit-scrollbar {
          width: 6px;
        }

        .bookmarks-list::-webkit-scrollbar-track {
          background: transparent;
        }

        .bookmarks-list::-webkit-scrollbar-thumb {
          background: var(--chatmarks-scrollbar, #cbd5e0);
          border-radius: 3px;
        }

        .bookmarks-list::-webkit-scrollbar-thumb:hover {
          background: var(--chatmarks-scrollbar-hover, #a0aec0);
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
          color: var(--chatmarks-text-secondary, #6b7280);
          opacity: 1;
          transition: opacity 0.2s ease;
        }

        :host([collapsed]) .empty-state {
          opacity: 0;
        }

        .empty-icon {
          width: 48px;
          height: 48px;
          margin-bottom: 12px;
          stroke: currentColor;
          fill: none;
          stroke-width: 1.5;
        }

        .empty-title {
          font-size: 16px;
          font-weight: 500;
          margin-bottom: 4px;
          color: var(--chatmarks-text, #1f2937);
        }

        .empty-description {
          font-size: 14px;
          line-height: 1.4;
        }

        .resize-handle {
          position: absolute;
          ${this._position === 'right' ? 'left' : 'right'}: -4px;
          top: 0;
          bottom: 0;
          width: 8px;
          cursor: col-resize;
          background: transparent;
          z-index: 10;
        }

        .resize-handle:hover {
          background: var(--chatmarks-primary-alpha, rgba(37, 99, 235, 0.1));
        }

        .resize-handle:active {
          background: var(--chatmarks-primary-alpha, rgba(37, 99, 235, 0.2));
        }

        /* Responsive behavior */
        @media (max-width: 768px) {
          :host {
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
          }

          :host([collapsed]) {
            width: 100% !important;
            transform: translateX(${this._position === 'right' ? '100%' : '-100%'}) !important;
          }

          .resize-handle {
            display: none;
          }
        }

        /* Loading state */
        .loading-spinner {
          display: inline-block;
          width: 20px;
          height: 20px;
          border: 2px solid var(--chatmarks-border, #e5e7eb);
          border-radius: 50%;
          border-top-color: var(--chatmarks-primary, #2563eb);
          animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>

      <div class="sidebar-container">
        <div class="resize-handle"></div>

        <div class="sidebar-header">
          <h2 class="sidebar-title">Bookmarks</h2>
          <div class="header-actions">
            <button class="header-button" type="button" data-action="collapse" aria-label="Toggle sidebar">
              <svg class="header-icon" viewBox="0 0 24 24">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            <button class="header-button" type="button" data-action="close" aria-label="Close sidebar">
              <svg class="header-icon" viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="search-section">
          <div class="search-wrapper">
            <svg class="search-icon" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            <input 
              type="text" 
              class="search-input" 
              placeholder="Search bookmarks..."
              aria-label="Search bookmarks"
            />
          </div>
        </div>

        <div class="filters-section">
          <div class="filter-row">
            <select class="filter-select" data-filter="sort" aria-label="Sort by">
              <option value="date-desc">Recent first</option>
              <option value="date-asc">Oldest first</option>
              <option value="alphabetical-asc">A to Z</option>
              <option value="alphabetical-desc">Z to A</option>
            </select>
          </div>
        </div>

        <div class="bookmarks-section">
          <div class="bookmarks-header">
            <span class="bookmarks-count">0 bookmarks</span>
          </div>

          <div class="bookmarks-list">
            <div class="empty-state">
              <svg class="empty-icon" viewBox="0 0 24 24">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                <polyline points="17,21 17,13 7,13 7,21"/>
                <polyline points="7,3 7,8 15,8"/>
              </svg>
              <div class="empty-title">No bookmarks yet</div>
              <div class="empty-description">
                Select text in a conversation and create your first bookmark.
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Set up event listeners for sidebar interaction
   */
  private setupEventListeners(): void {
    requestAnimationFrame(() => {
      this.addSidebarEventListeners();
    });
  }

  /**
   * Add event listeners after DOM is constructed
   */
  private addSidebarEventListeners(): void {
    // Cache DOM elements for performance
    this._resizeHandle = this.$('.resize-handle') as HTMLElement | null;
    this._searchInput = this.$('.search-input') as HTMLInputElement;
    this._bookmarkList = this.$('.bookmarks-list') as HTMLElement | null;

    // Header actions
    const collapseButton = this.$('[data-action="collapse"]');
    const closeButton = this.$('[data-action="close"]');

    collapseButton?.addEventListener('click', () => {
      this.toggleCollapsed();
    });

    closeButton?.addEventListener('click', () => {
      this.hide();
    });

    // Search input
    if (this._searchInput) {
      this._searchInput.addEventListener('input', this.handleSearchInput.bind(this));
      this._searchInput.addEventListener('keydown', this.handleSearchKeydown.bind(this));
    }

    // Sort dropdown
    const sortSelect = this.$('[data-filter="sort"]') as HTMLSelectElement;
    sortSelect?.addEventListener('change', this.handleSortChange.bind(this));

    // Resize handle
    if (this._resizeHandle) {
      this._resizeHandle.addEventListener('mousedown', this.handleResizeStart.bind(this));
    }

    // Keyboard navigation
    this.addEventListener('keydown', this.handleKeydown.bind(this));

    // Global mouse events for resizing
    document.addEventListener('mousemove', this.handleResizeMove.bind(this));
    document.addEventListener('mouseup', this.handleResizeEnd.bind(this));
  }

  /**
   * Handle search input changes
   */
  private handleSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this._searchQuery = input.value;
    
    // Debounced search
    this.debounceSearch();
    
    // Emit search change event
    this._callbacks.onSearchChange?.(this._searchQuery);
  }

  /**
   * Handle search input keyboard events
   */
  private handleSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this._searchInput) {
        this._searchInput.value = '';
        this._searchQuery = '';
        this.filterBookmarks();
      }
    }
  }

  /**
   * Debounced search implementation
   */
  private searchTimeout: number | null = null;
  private debounceSearch(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    this.searchTimeout = window.setTimeout(() => {
      this.filterBookmarks();
    }, 150);
  }

  /**
   * Handle sort selection change
   */
  private handleSortChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const [sortBy, direction] = select.value.split('-') as [string, 'asc' | 'desc'];
    
    this._currentFilters.sortBy = sortBy as any;
    this._currentFilters.sortDirection = direction;
    
    this.filterBookmarks();
    this._callbacks.onFilterChange?.(this._currentFilters);
  }

  /**
   * Handle resize start
   */
  private handleResizeStart(event: MouseEvent): void {
    event.preventDefault();
    this._isResizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  /**
   * Handle resize move
   */
  private handleResizeMove(event: MouseEvent): void {
    if (!this._isResizing) return;

    const rect = this.getBoundingClientRect();
    let newWidth: number;

    if (this._position === 'right') {
      newWidth = window.innerWidth - event.clientX;
    } else {
      newWidth = event.clientX;
    }

    // Constrain width
    newWidth = Math.max(this._minWidth, Math.min(newWidth, this._maxWidth));

    this.width = newWidth;
  }

  /**
   * Handle resize end
   */
  private handleResizeEnd(): void {
    if (!this._isResizing) return;

    this._isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Save width preference
    this.saveWidthPreference();
  }

  /**
   * Handle keyboard events for accessibility
   */
  private handleKeydown(event: KeyboardEvent): void {
    if (!this._visible) return;

    switch (event.key) {
      case 'Escape':
        if (this._searchInput && document.activeElement === this._searchInput) {
          // Let search input handle escape
          return;
        }
        event.preventDefault();
        this.hide();
        break;
    }
  }

  /**
   * Show the sidebar
   */
  show(): void {
    this.visible = true;
    this._event('show');
    
    // Focus search input for better UX
    requestAnimationFrame(() => {
      this._searchInput?.focus();
    });
  }

  /**
   * Hide the sidebar
   */
  hide(): void {
    this.visible = false;
    this._event('hide');
  }

  /**
   * Toggle sidebar visibility
   */
  toggleVisibility(): void {
    if (this._visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Toggle collapsed state
   */
  toggleCollapsed(): void {
    this.collapsed = !this._collapsed;
  }

  /**
   * Update the bookmark list
   */
  updateBookmarkList(bookmarks: Bookmark[]): void {
    this._bookmarks = [...bookmarks];
    this.filterBookmarks();
    this.renderBookmarks();
  }

  /**
   * Filter bookmarks based on current search and filters
   */
  private filterBookmarks(): void {
    let filtered = [...this._bookmarks];

    // Apply search filter
    if (this._searchQuery.trim()) {
      const query = this._searchQuery.toLowerCase().trim();
      filtered = filtered.filter(bookmark => 
        bookmark.note.toLowerCase().includes(query) ||
        bookmark.anchor.selectedText.toLowerCase().includes(query) ||
        bookmark.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply tag filters
    if (this._currentFilters.tags && this._currentFilters.tags.length > 0) {
      filtered = filtered.filter(bookmark =>
        this._currentFilters.tags!.some(tag => bookmark.tags.includes(tag))
      );
    }

    // Apply date range filter
    if (this._currentFilters.dateRange) {
      const { start, end } = this._currentFilters.dateRange;
      filtered = filtered.filter(bookmark => {
        const bookmarkDate = new Date(bookmark.created);
        return bookmarkDate >= start && bookmarkDate <= end;
      });
    }

    // Apply platform filter
    if (this._currentFilters.platforms && this._currentFilters.platforms.length > 0) {
      filtered = filtered.filter(bookmark =>
        this._currentFilters.platforms!.includes(bookmark.platform)
      );
    }

    // Apply sorting
    this.sortBookmarks(filtered);

    this._filteredBookmarks = filtered;
  }

  /**
   * Sort bookmarks based on current sort settings
   */
  private sortBookmarks(bookmarks: Bookmark[]): void {
    const { sortBy = 'date', sortDirection = 'desc' } = this._currentFilters;

    bookmarks.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          comparison = new Date(a.created).getTime() - new Date(b.created).getTime();
          break;
        case 'alphabetical':
          comparison = a.note.localeCompare(b.note);
          break;
        case 'relevance':
          // Could implement relevance scoring based on search query
          comparison = 0;
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Render bookmarks in the list
   */
  private renderBookmarks(): void {
    if (!this._bookmarkList) return;

    // Update count
    const countElement = this.$('.bookmarks-count');
    if (countElement) {
      const count = this._filteredBookmarks.length;
      countElement.textContent = `${count} bookmark${count !== 1 ? 's' : ''}`;
    }

    // Show empty state or bookmarks
    if (this._filteredBookmarks.length === 0) {
      this.renderEmptyState();
    } else {
      this.renderBookmarkItems();
    }
  }

  /**
   * Render empty state
   */
  private renderEmptyState(): void {
    if (!this._bookmarkList) return;

    const emptyState = this._searchQuery.trim() ? 
      this.createNoResultsState() : 
      this.createEmptyBookmarksState();

    this._bookmarkList.innerHTML = '';
    this._bookmarkList.appendChild(emptyState);
  }

  /**
   * Create no search results state
   */
  private createNoResultsState(): HTMLElement {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = `
      <svg class="empty-icon" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8"/>
        <path d="M21 21l-4.35-4.35"/>
      </svg>
      <div class="empty-title">No results found</div>
      <div class="empty-description">
        Try a different search term or clear your filters.
      </div>
    `;
    return div;
  }

  /**
   * Create empty bookmarks state
   */
  private createEmptyBookmarksState(): HTMLElement {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = `
      <svg class="empty-icon" viewBox="0 0 24 24">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
        <polyline points="17,21 17,13 7,13 7,21"/>
        <polyline points="7,3 7,8 15,8"/>
      </svg>
      <div class="empty-title">No bookmarks yet</div>
      <div class="empty-description">
        Select text in a conversation and create your first bookmark.
      </div>
    `;
    return div;
  }

  /**
   * Render bookmark items (will be enhanced with virtual scrolling)
   */
  private renderBookmarkItems(): void {
    if (!this._bookmarkList) return;

    this._bookmarkList.innerHTML = '';
    
    // For now, render all items (will optimize with virtual scrolling later)
    this._filteredBookmarks.forEach(bookmark => {
      const item = this.createBookmarkItem(bookmark);
      if (this._bookmarkList) {
        this._bookmarkList.appendChild(item);
      }
    });
  }

  /**
   * Create a bookmark item element
   */
  private createBookmarkItem(bookmark: Bookmark): HTMLElement {
    const item = document.createElement('div');
    item.className = 'bookmark-item';
    item.setAttribute('data-bookmark-id', bookmark.id);
    
    // For now, simple implementation (will enhance later)
    item.innerHTML = `
      <div class="bookmark-content">
        <div class="bookmark-text">${this.escapeHtml(bookmark.anchor.selectedText)}</div>
        <div class="bookmark-note">${this.escapeHtml(bookmark.note)}</div>
        <div class="bookmark-meta">
          <span class="bookmark-date">${this.formatDate(new Date(bookmark.created))}</span>
        </div>
      </div>
    `;

    // Add click handler
    item.addEventListener('click', () => {
      this._callbacks.onBookmarkClick?.(bookmark);
    });

    return item;
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  /**
   * Save width preference to storage
   */
  private saveWidthPreference(): void {
    try {
      localStorage.setItem('chatmarks-sidebar-width', this._width.toString());
    } catch (error) {
      console.warn('Failed to save sidebar width preference:', error);
    }
  }

  /**
   * Load width preference from storage
   */
  private loadWidthPreference(): void {
    try {
      const saved = localStorage.getItem('chatmarks-sidebar-width');
      if (saved) {
        const width = parseInt(saved, 10);
        if (width >= this._minWidth && width <= this._maxWidth) {
          this._width = width;
        }
      }
    } catch (error) {
      console.warn('Failed to load sidebar width preference:', error);
    }
  }

  /**
   * Set callbacks for sidebar events
   */
  setCallbacks(callbacks: BookmarkSidebarCallbacks): void {
    this._callbacks = { ...callbacks };
  }

  // Property getters and setters
  get visible(): boolean {
    return this._visible;
  }

  set visible(value: boolean) {
    if (this._visible === value) return;
    this._visible = value;
    
    if (value) {
      this.setAttribute('visible', '');
    } else {
      this.removeAttribute('visible');
    }
  }

  get collapsed(): boolean {
    return this._collapsed;
  }

  set collapsed(value: boolean) {
    if (this._collapsed === value) return;
    this._collapsed = value;
    
    if (value) {
      this.setAttribute('collapsed', '');
    } else {
      this.removeAttribute('collapsed');
    }
  }

  get position(): 'left' | 'right' {
    return this._position;
  }

  set position(value: 'left' | 'right') {
    if (this._position === value) return;
    this._position = value;
    this.setAttribute('position', value);
    
    // Update template when position changes
    this.updatePositionStyles();
  }

  get width(): number {
    return this._width;
  }

  set width(value: number) {
    const constrainedWidth = Math.max(this._minWidth, Math.min(value, this._maxWidth));
    if (this._width === constrainedWidth) return;
    
    this._width = constrainedWidth;
    this.setAttribute('width', constrainedWidth.toString());
    
    // Update CSS custom property
    this.style.setProperty('width', `${constrainedWidth}px`);
  }

  /**
   * Update position-related styles
   */
  private updatePositionStyles(): void {
    // This would need template re-rendering in a full implementation
    // For now, just update the transform
    const container = this.$('.sidebar-container');
    if (container) {
      // Update positioning logic
    }
  }

  /**
   * Handle attribute changes
   */
  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    super.attributeChangedCallback(name, oldValue, newValue);

    switch (name) {
      case 'visible':
        this._visible = newValue !== null;
        break;
      case 'collapsed':
        this._collapsed = newValue !== null;
        break;
      case 'position':
        if (newValue === 'left' || newValue === 'right') {
          this._position = newValue;
          this.updatePositionStyles();
        }
        break;
      case 'width':
        if (newValue !== null) {
          const width = parseInt(newValue, 10);
          if (!isNaN(width)) {
            this._width = Math.max(this._minWidth, Math.min(width, this._maxWidth));
          }
        }
        break;
    }
  }

  /**
   * Initialize component
   */
  connectedCallback(): void {
    super.connectedCallback();
    this.loadWidthPreference();
  }

  /**
   * Cleanup when component is removed
   */
  protected cleanup(): void {
    super.cleanup();

    // Clear any timeouts
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Clean up global event listeners
    document.removeEventListener('mousemove', this.handleResizeMove.bind(this));
    document.removeEventListener('mouseup', this.handleResizeEnd.bind(this));
  }
}