/**
 * Bookmark Manager - High-Level CRUD Coordinator
 *
 * Orchestrates bookmark operations by coordinating between the TextSelection,
 * AnchorSystem, and StorageService to provide a unified interface for
 * bookmark lifecycle management.
 *
 * Key Features:
 * - Creates bookmarks from text selections with anchor generation
 * - Manages bookmark lifecycle with validation and error handling
 * - Emits real-time events for UI synchronization
 * - Integrates with existing storage and anchoring systems
 * - Handles concurrent operations safely
 */

import {
  Bookmark,
  CreateBookmarkData,
  UpdateBookmarkData,
  BookmarkFilters,
  BookmarkOperationResult,
  ValidationResult,
} from '../../types/bookmark';
import { StorageService } from '../storage/StorageService';
import { AnchorSystem } from '../anchoring/AnchorSystem';
import { TextSelection } from '../selection/TextSelection';
import { BookmarkEvents } from './BookmarkEvents';

export class BookmarkManager {
  private storageService: StorageService;
  private anchorSystem: AnchorSystem;
  private textSelection: TextSelection;
  private eventSystem: BookmarkEvents;

  constructor(
    storageService?: StorageService,
    anchorSystem?: AnchorSystem,
    textSelection?: TextSelection
  ) {
    this.storageService = storageService || new StorageService();
    this.anchorSystem = anchorSystem || new AnchorSystem(document);
    this.textSelection = textSelection || new TextSelection();
    this.eventSystem = new BookmarkEvents();
  }

  /**
   * Creates a bookmark from text selection data with anchor generation
   *
   * Integrates the complete workflow: selection → anchor → storage → events
   *
   * @param data - CreateBookmarkData with selection range and metadata
   * @returns Promise resolving to the created bookmark
   * @throws Error if selection is invalid or storage operation fails
   */
  async createBookmark(data: CreateBookmarkData): Promise<Bookmark> {
    try {
      // Validate the selection range
      if (!this.textSelection.validateSelection(data.selectionRange)) {
        throw new Error('Invalid selection range provided');
      }

      // Create anchor from the selection range using the anchoring system
      // Get bounding rect safely (JSDOM may not support this)
      let boundingRect;
      try {
        boundingRect = data.selectionRange.getBoundingClientRect();
      } catch (error) {
        // Fallback for test environments
        boundingRect = {
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          bottom: 0,
          right: 0,
        };
      }

      const selectionRange = {
        selectedText: data.selectedText,
        range: data.selectionRange,
        boundingRect,
        contextBefore: this.extractContextBefore(data.selectionRange),
        contextAfter: this.extractContextAfter(data.selectionRange),
        startOffset: 0, // Will be calculated by anchor system
        endOffset: data.selectedText.length,
        messageId: data.messageId,
        conversationId: data.conversationId,
        timestamp: new Date().toISOString(),
      };

      const anchor = this.anchorSystem.createAnchor(selectionRange);

      // Generate unique bookmark with all required fields
      const bookmark: Bookmark = {
        id: crypto.randomUUID(),
        platform: data.platform,
        conversationId: data.conversationId,
        messageId: data.messageId,
        anchor,
        note: data.note || '',
        tags: data.tags || [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        color: data.color || '#ffeb3b', // Default yellow color
      };

      // Save bookmark using the storage service
      await this.storageService.saveBookmark(bookmark);

      // Emit bookmark creation event for real-time UI updates
      this.eventSystem.emitBookmarkCreated(bookmark);

      return bookmark;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.eventSystem.emitBookmarkError('create', errorMessage);
      throw new Error(`Failed to create bookmark: ${errorMessage}`);
    }
  }

  /**
   * Updates an existing bookmark with new data
   *
   * @param id - Bookmark ID to update
   * @param data - UpdateBookmarkData with fields to modify
   * @returns Promise resolving to the updated bookmark
   * @throws Error if bookmark not found or update fails
   */
  async updateBookmark(
    id: string,
    data: UpdateBookmarkData
  ): Promise<Bookmark> {
    try {
      // Get existing bookmark to ensure it exists
      const existingBookmark = await this.storageService.getBookmark(id);
      if (!existingBookmark) {
        throw new Error(`Bookmark with ID ${id} not found`);
      }

      // Use storage service to perform the update
      const result = await this.storageService.updateBookmark(id, data);
      if (!result.success || !result.bookmark) {
        throw new Error(result.error || 'Update operation failed');
      }

      // Emit bookmark update event
      this.eventSystem.emitBookmarkUpdated(result.bookmark);

      return result.bookmark;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.eventSystem.emitBookmarkError('update', errorMessage);
      throw new Error(`Failed to update bookmark: ${errorMessage}`);
    }
  }

  /**
   * Deletes a bookmark by ID
   *
   * @param id - Bookmark ID to delete
   * @returns Promise that resolves when deletion is complete
   * @throws Error if bookmark not found or deletion fails
   */
  async deleteBookmark(id: string): Promise<void> {
    try {
      // Verify bookmark exists before deletion
      const existingBookmark = await this.storageService.getBookmark(id);
      if (!existingBookmark) {
        throw new Error(`Bookmark with ID ${id} not found`);
      }

      // Delete using storage service
      await this.storageService.deleteBookmark(id);

      // Emit bookmark deletion event
      this.eventSystem.emitBookmarkDeleted(id);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.eventSystem.emitBookmarkError('delete', errorMessage);
      throw new Error(`Failed to delete bookmark: ${errorMessage}`);
    }
  }

  /**
   * Retrieves a bookmark by ID
   *
   * @param id - Bookmark ID to retrieve
   * @returns Promise resolving to bookmark or null if not found
   */
  async getBookmark(id: string): Promise<Bookmark | null> {
    try {
      return await this.storageService.getBookmark(id);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.eventSystem.emitBookmarkError('get', errorMessage);
      throw new Error(`Failed to retrieve bookmark: ${errorMessage}`);
    }
  }

  /**
   * Lists bookmarks with optional filtering
   *
   * @param filters - Optional filters to apply
   * @returns Promise resolving to array of bookmarks
   */
  async listBookmarks(filters?: BookmarkFilters): Promise<Bookmark[]> {
    try {
      return await this.storageService.getBookmarks(filters);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.eventSystem.emitBookmarkError('list', errorMessage);
      throw new Error(`Failed to list bookmarks: ${errorMessage}`);
    }
  }

  /**
   * Gets total bookmark count
   *
   * @returns Promise resolving to total number of bookmarks
   */
  async getBookmarkCount(): Promise<number> {
    try {
      return await this.storageService.getBookmarkCount();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.eventSystem.emitBookmarkError('count', errorMessage);
      throw new Error(`Failed to get bookmark count: ${errorMessage}`);
    }
  }

  /**
   * Validates bookmark creation data
   *
   * @param data - CreateBookmarkData to validate
   * @returns ValidationResult with validation status and errors
   */
  validateCreationData(data: CreateBookmarkData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!data.platform) {
      errors.push('Platform is required');
    }

    if (!data.conversationId) {
      errors.push('Conversation ID is required');
    }

    if (!data.messageId) {
      errors.push('Message ID is required');
    }

    if (!data.selectedText || data.selectedText.trim().length === 0) {
      errors.push('Selected text cannot be empty');
    }

    if (!data.selectionRange) {
      errors.push('Selection range is required');
    }

    if (!data.messageElement) {
      errors.push('Message element is required');
    }

    // Validate optional fields
    if (data.note && data.note.length > 1000) {
      warnings.push('Note is very long (>1000 characters)');
    }

    if (data.tags && data.tags.length > 10) {
      warnings.push('Many tags specified (>10)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Gets the event system for subscribing to bookmark events
   *
   * @returns BookmarkEvents instance
   */
  getEventSystem(): BookmarkEvents {
    return this.eventSystem;
  }

  /**
   * Extracts context text before the selection
   *
   * @param range - Selection range
   * @returns Context text before selection (up to 50 characters)
   */
  private extractContextBefore(range: Range): string {
    try {
      const container = range.commonAncestorContainer;
      const containerText = container.textContent || '';
      const rangeText = range.toString();
      const rangeStart = containerText.indexOf(rangeText);

      if (rangeStart > 0) {
        const contextStart = Math.max(0, rangeStart - 50);
        return containerText.slice(contextStart, rangeStart);
      }

      return '';
    } catch (error) {
      return '';
    }
  }

  /**
   * Extracts context text after the selection
   *
   * @param range - Selection range
   * @returns Context text after selection (up to 50 characters)
   */
  private extractContextAfter(range: Range): string {
    try {
      const container = range.commonAncestorContainer;
      const containerText = container.textContent || '';
      const rangeText = range.toString();
      const rangeStart = containerText.indexOf(rangeText);

      if (rangeStart >= 0) {
        const rangeEnd = rangeStart + rangeText.length;
        const contextEnd = Math.min(containerText.length, rangeEnd + 50);
        return containerText.slice(rangeEnd, contextEnd);
      }

      return '';
    } catch (error) {
      return '';
    }
  }
}
