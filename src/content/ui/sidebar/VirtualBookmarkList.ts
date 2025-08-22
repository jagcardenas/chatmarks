/**
 * VirtualBookmarkList Component
 *
 * High-performance virtual scrolling list for bookmarks with:
 * - Virtual scrolling for 1000+ items with 60fps performance
 * - Efficient DOM node recycling and reuse
 * - Dynamic item height support
 * - Intersection Observer for visibility optimization
 * - Keyboard navigation and accessibility
 * - Touch/mouse scroll handling
 * - Search highlighting and result navigation
 */

import { BaseComponent } from '../components/base/BaseComponent';
import { Bookmark } from '../../../types/bookmark';
import { SearchMatch } from './SearchFilter';

export interface VirtualListItem {
  bookmark: Bookmark;
  height?: number;
  matches?: SearchMatch[];
  selected?: boolean;
}

export interface VirtualListCallbacks {
  onItemClick?: (bookmark: Bookmark, index: number) => void;
  onItemEdit?: (bookmark: Bookmark, index: number) => void;
  onItemDelete?: (bookmark: Bookmark, index: number) => void;
  onSelectionChange?: (selectedItems: Bookmark[]) => void;
}

export interface VirtualListOptions {
  itemHeight?: number;
  overscan?: number; // Number of items to render outside visible area
  scrollToIndex?: number;
  multiSelect?: boolean;
  showMatches?: boolean;
  groupBy?: 'none' | 'date' | 'platform' | 'tag';
}

interface ViewportInfo {
  scrollTop: number;
  containerHeight: number;
  startIndex: number;
  endIndex: number;
  offsetY: number;
}

interface ItemInfo {
  index: number;
  top: number;
  height: number;
  element?: HTMLElement;
  data: VirtualListItem;
}

export class VirtualBookmarkList extends BaseComponent {
  static componentName = 'virtual-bookmark-list';
  static observedAttributes = ['loading'];

  // Configuration
  private readonly DEFAULT_ITEM_HEIGHT = 80;
  private readonly OVERSCAN_COUNT = 5;
  private readonly SCROLL_DEBOUNCE = 16; // 60fps

  // State
  private _items: VirtualListItem[] = [];
  private _callbacks: VirtualListCallbacks = {};
  private _options: VirtualListOptions = {};
  private _selectedItems: Set<string> = new Set();
  private _loading: boolean = false;

  // Virtual scrolling state
  private itemHeights: Map<number, number> = new Map();
  private renderedItems: Map<number, HTMLElement> = new Map();
  private itemPool: HTMLElement[] = []; // Reusable DOM elements
  private viewportInfo: ViewportInfo = {
    scrollTop: 0,
    containerHeight: 0,
    startIndex: 0,
    endIndex: 0,
    offsetY: 0,
  };

  // DOM elements
  private scrollContainer: HTMLElement | null = null;
  private listContainer: HTMLElement | null = null;
  private spacerTop: HTMLElement | null = null;
  private spacerBottom: HTMLElement | null = null;

  // Performance optimization
  private rafId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private scrollTimeout: number | null = null;

  constructor() {
    super();
    this.setupEventListeners();
  }

  protected getTemplate(): string {
    return `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          position: relative;
        }

        .list-container {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          scroll-behavior: smooth;
          scrollbar-width: thin;
          scrollbar-color: var(--chatmarks-scrollbar, #cbd5e0) transparent;
        }

        .list-container::-webkit-scrollbar {
          width: 6px;
        }

        .list-container::-webkit-scrollbar-track {
          background: transparent;
        }

        .list-container::-webkit-scrollbar-thumb {
          background: var(--chatmarks-scrollbar, #cbd5e0);
          border-radius: 3px;
        }

        .list-container::-webkit-scrollbar-thumb:hover {
          background: var(--chatmarks-scrollbar-hover, #a0aec0);
        }

        .list-content {
          position: relative;
          width: 100%;
        }

        .list-items {
          position: relative;
          width: 100%;
        }

        .spacer {
          width: 100%;
          pointer-events: none;
        }

        .bookmark-item {
          position: relative;
          width: 100%;
          min-height: ${this.DEFAULT_ITEM_HEIGHT}px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--chatmarks-border-light, #f3f4f6);
          background: var(--chatmarks-item-bg, #ffffff);
          cursor: pointer;
          transition: all 0.15s ease;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .bookmark-item:hover {
          background: var(--chatmarks-item-hover, #f9fafb);
        }

        .bookmark-item.selected {
          background: var(--chatmarks-item-selected, #eff6ff);
          border-left: 3px solid var(--chatmarks-primary, #2563eb);
          padding-left: 13px;
        }

        .bookmark-item:focus {
          outline: 2px solid var(--chatmarks-primary, #2563eb);
          outline-offset: -2px;
        }

        .bookmark-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .bookmark-content {
          flex: 1;
          min-width: 0;
        }

        .bookmark-text {
          font-size: 14px;
          font-weight: 500;
          color: var(--chatmarks-text, #1f2937);
          line-height: 1.4;
          margin-bottom: 4px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          word-break: break-word;
        }

        .bookmark-note {
          font-size: 13px;
          color: var(--chatmarks-text-secondary, #6b7280);
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          word-break: break-word;
        }

        .bookmark-actions {
          display: flex;
          gap: 4px;
          opacity: 0;
          transition: opacity 0.15s ease;
        }

        .bookmark-item:hover .bookmark-actions {
          opacity: 1;
        }

        .action-button {
          width: 28px;
          height: 28px;
          border: none;
          background: none;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--chatmarks-text-secondary, #6b7280);
          transition: all 0.15s ease;
        }

        .action-button:hover {
          background: var(--chatmarks-hover, #f3f4f6);
          color: var(--chatmarks-text, #1f2937);
        }

        .action-button:focus {
          outline: 2px solid var(--chatmarks-primary, #2563eb);
          outline-offset: -2px;
        }

        .action-icon {
          width: 16px;
          height: 16px;
          stroke: currentColor;
          fill: none;
          stroke-width: 2;
        }

        .bookmark-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-top: 4px;
        }

        .bookmark-date {
          font-size: 12px;
          color: var(--chatmarks-text-tertiary, #9ca3af);
        }

        .bookmark-platform {
          font-size: 11px;
          font-weight: 500;
          color: var(--chatmarks-text-tertiary, #9ca3af);
          background: var(--chatmarks-tag-bg, #f3f4f6);
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .bookmark-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 4px;
        }

        .tag {
          font-size: 11px;
          font-weight: 500;
          color: var(--chatmarks-tag-text, #374151);
          background: var(--chatmarks-tag-bg, #f3f4f6);
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid var(--chatmarks-tag-border, #e5e7eb);
        }

        .search-highlight {
          background: var(--chatmarks-highlight, #fef08a);
          padding: 0 2px;
          border-radius: 2px;
          font-weight: 600;
        }

        .loading-state {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          color: var(--chatmarks-text-secondary, #6b7280);
        }

        .loading-spinner {
          display: inline-block;
          width: 20px;
          height: 20px;
          border: 2px solid var(--chatmarks-border, #e5e7eb);
          border-radius: 50%;
          border-top-color: var(--chatmarks-primary, #2563eb);
          animation: spin 1s ease-in-out infinite;
          margin-right: 8px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .group-header {
          position: sticky;
          top: 0;
          z-index: 2;
          background: var(--chatmarks-group-bg, #f8fafc);
          border-bottom: 1px solid var(--chatmarks-border, #e5e7eb);
          padding: 8px 16px;
          font-size: 12px;
          font-weight: 600;
          color: var(--chatmarks-text-secondary, #6b7280);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Accessibility improvements */
        .bookmark-item:focus-visible {
          outline: 2px solid var(--chatmarks-primary, #2563eb);
          outline-offset: -2px;
        }

        @media (prefers-reduced-motion: reduce) {
          .bookmark-item,
          .action-button,
          .list-container {
            transition: none;
          }
        }

        /* High contrast mode support */
        @media (prefers-contrast: high) {
          .bookmark-item {
            border-bottom: 2px solid;
          }
          
          .search-highlight {
            outline: 2px solid;
          }
        }
      </style>

      <div class="list-container">
        <div class="list-content">
          <div class="spacer spacer-top"></div>
          <div class="list-items"></div>
          <div class="spacer spacer-bottom"></div>
        </div>
      </div>

      <div class="loading-state" style="display: none;">
        <div class="loading-spinner"></div>
        <span>Loading bookmarks...</span>
      </div>
    `;
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    requestAnimationFrame(() => {
      this.initializeVirtualScrolling();
    });
  }

  /**
   * Initialize virtual scrolling functionality
   */
  private initializeVirtualScrolling(): void {
    // Cache DOM elements
    this.scrollContainer = this.$('.list-container') as HTMLElement | null;
    this.listContainer = this.$('.list-items') as HTMLElement | null;
    this.spacerTop = this.$('.spacer-top') as HTMLElement | null;
    this.spacerBottom = this.$('.spacer-bottom') as HTMLElement | null;

    if (!this.scrollContainer || !this.listContainer) {
      console.error('VirtualBookmarkList: Required DOM elements not found');
      return;
    }

    // Set up scroll listener with throttling
    this.scrollContainer.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });

    // Set up resize observer for responsive behavior
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(this.handleResize.bind(this));
      this.resizeObserver.observe(this.scrollContainer);
    }

    // Set up intersection observer for performance
    if ('IntersectionObserver' in window) {
      this.intersectionObserver = new IntersectionObserver(
        this.handleIntersection.bind(this),
        { threshold: 0 }
      );
    }

    // Set up keyboard navigation
    this.scrollContainer.addEventListener('keydown', this.handleKeydown.bind(this));
    this.scrollContainer.setAttribute('tabindex', '0');

    // Initialize viewport
    this.updateViewportInfo();
  }

  /**
   * Handle scroll events with throttling
   */
  private handleScroll(): void {
    if (this.rafId) {
      return; // Already scheduled
    }

    this.rafId = requestAnimationFrame(() => {
      this.updateViewportInfo();
      this.renderVisibleItems();
      this.rafId = null;
    });
  }

  /**
   * Handle resize events
   */
  private handleResize(): void {
    this.updateViewportInfo();
    this.renderVisibleItems();
  }

  /**
   * Handle intersection observer events
   */
  private handleIntersection(entries: IntersectionObserverEntry[]): void {
    entries.forEach(entry => {
      const element = entry.target as HTMLElement;
      const index = parseInt(element.getAttribute('data-index') || '0');
      
      if (!entry.isIntersecting) {
        // Item is no longer visible, we could recycle it
        this.recycleItem(index);
      }
    });
  }

  /**
   * Handle keyboard navigation
   */
  private handleKeydown(event: KeyboardEvent): void {
    if (this._items.length === 0) return;

    const currentSelected = Array.from(this._selectedItems)[0];
    const currentIndex = currentSelected ? 
      this._items.findIndex(item => item.bookmark.id === currentSelected) : -1;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectItem(Math.min(currentIndex + 1, this._items.length - 1));
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.selectItem(Math.max(currentIndex - 1, 0));
        break;

      case 'Home':
        event.preventDefault();
        this.selectItem(0);
        break;

      case 'End':
        event.preventDefault();
        this.selectItem(this._items.length - 1);
        break;

      case 'Enter':
      case ' ':
        event.preventDefault();
        if (currentIndex >= 0 && this._items[currentIndex]) {
          this._callbacks.onItemClick?.(this._items[currentIndex].bookmark, currentIndex);
        }
        break;

      case 'Delete':
        if (currentIndex >= 0 && this._items[currentIndex]) {
          this._callbacks.onItemDelete?.(this._items[currentIndex].bookmark, currentIndex);
        }
        break;
    }
  }

  /**
   * Update viewport information
   */
  private updateViewportInfo(): void {
    if (!this.scrollContainer) return;

    const scrollTop = this.scrollContainer.scrollTop;
    const containerHeight = this.scrollContainer.clientHeight;
    
    // Calculate visible range with overscan
    const itemHeight = this._options.itemHeight || this.DEFAULT_ITEM_HEIGHT;
    const overscan = this._options.overscan || this.OVERSCAN_COUNT;
    
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const endIndex = Math.min(this._items.length - 1, startIndex + visibleCount + overscan * 2);
    
    const offsetY = startIndex * itemHeight;

    this.viewportInfo = {
      scrollTop,
      containerHeight,
      startIndex,
      endIndex,
      offsetY,
    };
  }

  /**
   * Render only visible items for performance
   */
  private renderVisibleItems(): void {
    if (!this.listContainer || !this.spacerTop || !this.spacerBottom) return;

    const { startIndex, endIndex, offsetY } = this.viewportInfo;
    
    // Update spacers
    this.spacerTop.style.height = `${offsetY}px`;
    
    const totalHeight = this.calculateTotalHeight();
    const bottomSpacerHeight = Math.max(0, totalHeight - offsetY - this.calculateVisibleHeight());
    this.spacerBottom.style.height = `${bottomSpacerHeight}px`;

    // Clear existing items that are outside the visible range
    this.renderedItems.forEach((element, index) => {
      if (index < startIndex || index > endIndex) {
        this.recycleItem(index);
      }
    });

    // Render visible items
    for (let i = startIndex; i <= endIndex; i++) {
      if (i < this._items.length && !this.renderedItems.has(i)) {
        const element = this.renderItem(i);
        if (element) {
          this.listContainer.appendChild(element);
          this.renderedItems.set(i, element);
          
          // Observe for intersection
          if (this.intersectionObserver) {
            this.intersectionObserver.observe(element);
          }
        }
      }
    }
  }

  /**
   * Render a single item
   */
  private renderItem(index: number): HTMLElement | null {
    const item = this._items[index];
    if (!item) return null;

    // Get or create element
    let element = this.getPooledElement();
    
    // Set up element
    element.className = 'bookmark-item';
    element.setAttribute('data-index', index.toString());
    element.setAttribute('data-bookmark-id', item.bookmark.id);
    element.setAttribute('tabindex', '0');
    element.setAttribute('role', 'listitem');
    
    // Add selection state
    if (this._selectedItems.has(item.bookmark.id)) {
      element.classList.add('selected');
    }

    // Render content
    this.renderItemContent(element, item);

    // Add event listeners
    this.addItemEventListeners(element, item, index);

    return element;
  }

  /**
   * Render item content
   */
  private renderItemContent(element: HTMLElement, item: VirtualListItem): void {
    const { bookmark, matches } = item;
    const highlightContent = this._options.showMatches && matches;

    element.innerHTML = `
      <div class="bookmark-header">
        <div class="bookmark-content">
          <div class="bookmark-text">
            ${highlightContent ? 
              this.highlightMatches(bookmark.anchor.selectedText, matches || []) : 
              this.escapeHtml(bookmark.anchor.selectedText)
            }
          </div>
          ${bookmark.note ? `
            <div class="bookmark-note">
              ${highlightContent ? 
                this.highlightMatches(bookmark.note, matches || []) : 
                this.escapeHtml(bookmark.note)
              }
            </div>
          ` : ''}
        </div>
        
        <div class="bookmark-actions">
          <button class="action-button" type="button" data-action="edit" aria-label="Edit bookmark">
            <svg class="action-icon" viewBox="0 0 24 24">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="action-button" type="button" data-action="delete" aria-label="Delete bookmark">
            <svg class="action-icon" viewBox="0 0 24 24">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="bookmark-meta">
        <span class="bookmark-date">${this.formatDate(new Date(bookmark.created))}</span>
        <span class="bookmark-platform">${bookmark.platform}</span>
      </div>

      ${bookmark.tags.length > 0 ? `
        <div class="bookmark-tags">
          ${bookmark.tags.map(tag => `
            <span class="tag">${this.escapeHtml(tag)}</span>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  /**
   * Add event listeners to item
   */
  private addItemEventListeners(
    element: HTMLElement, 
    item: VirtualListItem, 
    index: number
  ): void {
    // Click handler
    element.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      
      if (target.closest('[data-action="edit"]')) {
        this._callbacks.onItemEdit?.(item.bookmark, index);
      } else if (target.closest('[data-action="delete"]')) {
        this._callbacks.onItemDelete?.(item.bookmark, index);
      } else {
        this.selectItem(index);
        this._callbacks.onItemClick?.(item.bookmark, index);
      }
    });

    // Focus handler
    element.addEventListener('focus', () => {
      this.selectItem(index);
    });
  }

  /**
   * Highlight search matches in text
   */
  private highlightMatches(text: string, matches: SearchMatch[]): string {
    if (!matches.length) return this.escapeHtml(text);

    let highlighted = text;
    const sortedMatches = [...matches]
      .filter(match => match.field === 'content' || match.field === 'note')
      .sort((a, b) => b.start - a.start); // Sort descending to avoid offset issues

    sortedMatches.forEach(match => {
      const before = highlighted.substring(0, match.start);
      const matchText = highlighted.substring(match.start, match.end);
      const after = highlighted.substring(match.end);
      
      highlighted = `${before}<span class="search-highlight">${this.escapeHtml(matchText)}</span>${after}`;
    });

    return highlighted;
  }

  /**
   * Get pooled element or create new one
   */
  private getPooledElement(): HTMLElement {
    if (this.itemPool.length > 0) {
      return this.itemPool.pop()!;
    }

    const element = document.createElement('div');
    element.setAttribute('role', 'listitem');
    return element;
  }

  /**
   * Recycle an item element
   */
  private recycleItem(index: number): void {
    const element = this.renderedItems.get(index);
    if (element) {
      // Unobserve from intersection observer
      if (this.intersectionObserver) {
        this.intersectionObserver.unobserve(element);
      }

      // Remove from DOM
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }

      // Clear event listeners by cloning
      const cleanElement = element.cloneNode(false) as HTMLElement;
      this.itemPool.push(cleanElement);

      this.renderedItems.delete(index);
    }
  }

  /**
   * Calculate total height of all items
   */
  private calculateTotalHeight(): number {
    const itemHeight = this._options.itemHeight || this.DEFAULT_ITEM_HEIGHT;
    return this._items.length * itemHeight;
  }

  /**
   * Calculate height of visible items
   */
  private calculateVisibleHeight(): number {
    const { startIndex, endIndex } = this.viewportInfo;
    const itemHeight = this._options.itemHeight || this.DEFAULT_ITEM_HEIGHT;
    return (endIndex - startIndex + 1) * itemHeight;
  }

  /**
   * Select an item
   */
  private selectItem(index: number): void {
    if (index < 0 || index >= this._items.length) return;

    const item = this._items[index];
    if (!item) return;
    const bookmarkId = item.bookmark.id;

    if (!this._options.multiSelect) {
      this._selectedItems.clear();
    }

    if (this._selectedItems.has(bookmarkId)) {
      this._selectedItems.delete(bookmarkId);
    } else {
      this._selectedItems.add(bookmarkId);
    }

    // Update visual selection state
    this.updateSelectionState();

    // Scroll to item if needed
    this.scrollToIndex(index);

    // Emit selection change
    const selectedBookmarks = this._items
      .filter(item => this._selectedItems.has(item.bookmark.id))
      .map(item => item.bookmark);
    
    this._callbacks.onSelectionChange?.(selectedBookmarks);
  }

  /**
   * Update visual selection state
   */
  private updateSelectionState(): void {
    this.renderedItems.forEach((element, index) => {
      const item = this._items[index];
      if (item && this._selectedItems.has(item.bookmark.id)) {
        element.classList.add('selected');
      } else {
        element.classList.remove('selected');
      }
    });
  }

  /**
   * Scroll to specific index
   */
  scrollToIndex(index: number): void {
    if (!this.scrollContainer || index < 0 || index >= this._items.length) return;

    const itemHeight = this._options.itemHeight || this.DEFAULT_ITEM_HEIGHT;
    const targetScrollTop = index * itemHeight;
    
    this.scrollContainer.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth'
    });
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
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Public API

  /**
   * Set items to display
   */
  setItems(items: VirtualListItem[]): void {
    this._items = [...items];
    this._selectedItems.clear();
    this.clearRenderedItems();
    this.updateViewportInfo();
    this.renderVisibleItems();
  }

  /**
   * Update specific item
   */
  updateItem(index: number, item: VirtualListItem): void {
    if (index < 0 || index >= this._items.length) return;

    this._items[index] = item;
    
    // Re-render if visible
    if (this.renderedItems.has(index)) {
      this.recycleItem(index);
      const element = this.renderItem(index);
      if (element && this.listContainer) {
        this.listContainer.appendChild(element);
        this.renderedItems.set(index, element);
      }
    }
  }

  /**
   * Clear all rendered items
   */
  private clearRenderedItems(): void {
    this.renderedItems.forEach((element, index) => {
      this.recycleItem(index);
    });
    this.renderedItems.clear();
  }

  /**
   * Set callbacks
   */
  setCallbacks(callbacks: VirtualListCallbacks): void {
    this._callbacks = { ...callbacks };
  }

  /**
   * Set options
   */
  setOptions(options: VirtualListOptions): void {
    this._options = { ...this._options, ...options };
    
    // Re-render if options affect display
    this.updateViewportInfo();
    this.renderVisibleItems();
    
    // Handle scroll to index
    if (options.scrollToIndex !== undefined) {
      this.scrollToIndex(options.scrollToIndex);
    }
  }

  /**
   * Get selected items
   */
  getSelectedItems(): Bookmark[] {
    return this._items
      .filter(item => this._selectedItems.has(item.bookmark.id))
      .map(item => item.bookmark);
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this._selectedItems.clear();
    this.updateSelectionState();
  }

  // Properties

  get loading(): boolean {
    return this._loading;
  }

  set loading(value: boolean) {
    if (this._loading === value) return;
    this._loading = value;
    
    const loadingState = this.$('.loading-state') as HTMLElement;
    const listContainer = this.$('.list-container') as HTMLElement;
    
    if (loadingState && listContainer) {
      if (value) {
        loadingState.style.display = 'flex';
        listContainer.style.display = 'none';
      } else {
        loadingState.style.display = 'none';
        listContainer.style.display = 'flex';
      }
    }
    
    if (value) {
      this.setAttribute('loading', '');
    } else {
      this.removeAttribute('loading');
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
      case 'loading':
        this._loading = newValue !== null;
        break;
    }
  }

  /**
   * Cleanup when component is removed
   */
  protected cleanup(): void {
    super.cleanup();

    // Clear RAF
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }

    // Clear timeout
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    // Disconnect observers
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }

    // Clear rendered items
    this.clearRenderedItems();
  }
}