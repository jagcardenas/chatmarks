/**
 * Core Data Structures for Bookmark System
 *
 * Defines the fundamental data types used throughout the extension for
 * bookmark creation, storage, and management.
 */

/**
 * Supported AI platforms for bookmark creation
 */
export type Platform = 'chatgpt' | 'claude' | 'grok';

/**
 * Text anchor with multiple positioning strategies for bookmark persistence
 *
 * Implements multiple fallback strategies to ensure bookmarks remain valid
 * even when platform DOM structures change or content is modified.
 */
export interface TextAnchor {
  /** The original selected text that serves as the bookmark anchor */
  selectedText: string;

  /** Character offset from the start of the message content */
  startOffset: number;

  /** Character offset for the end of the selection */
  endOffset: number;

  /** XPath selector to the text node (primary strategy) */
  xpathSelector: string;

  /** Unique identifier for the containing message */
  messageId: string;

  /** 50 characters of context before the selection (fallback strategy) */
  contextBefore: string;

  /** 50 characters of context after the selection (fallback strategy) */
  contextAfter: string;

  /** SHA-256 checksum of surrounding text for validation */
  checksum: string;

  /** Confidence score (0-1) indicating reliability of this anchor */
  confidence: number;

  /** Strategy used for this anchor ('xpath' | 'offset' | 'fuzzy') */
  strategy: AnchorStrategy;
}

/**
 * Available anchoring strategies in order of preference
 */
export type AnchorStrategy = 'xpath' | 'offset' | 'fuzzy';

/**
 * Complete bookmark data structure
 */
export interface Bookmark {
  /** Unique identifier for the bookmark */
  id: string;

  /** AI platform where this bookmark was created */
  platform: Platform;

  /** Unique identifier for the conversation */
  conversationId: string;

  /** Unique identifier for the specific message within the conversation */
  messageId: string;

  /** Text anchoring information for precise positioning */
  anchor: TextAnchor;

  /** User's note or comment about this bookmark */
  note: string;

  /** Tags for categorization and organization */
  tags: string[];

  /** Timestamp when the bookmark was created */
  created: string; // ISO8601 DateTime string

  /** Timestamp when the bookmark was last updated */
  updated: string; // ISO8601 DateTime string

  /** Hex color code for visual categorization */
  color: string;
}

/**
 * Data structure for creating a new bookmark
 */
export interface CreateBookmarkData {
  platform: Platform;
  conversationId: string;
  messageId: string;
  selectedText: string;
  note?: string;
  tags?: string[];
  color?: string;

  /** DOM element context for anchor creation */
  messageElement: Element;

  /** Selection range for precise positioning */
  selectionRange: Range;
}

/**
 * Data structure for updating an existing bookmark
 */
export interface UpdateBookmarkData {
  note?: string;
  tags?: string[];
  color?: string;
}

/**
 * Filter options for bookmark retrieval
 */
export interface BookmarkFilters {
  conversationId?: string;
  platform?: Platform;
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchText?: string;
}

/**
 * Result structure for bookmark operations
 */
export interface BookmarkOperationResult {
  success: boolean;
  bookmark?: Bookmark;
  error?: string;
}

/**
 * Validation result for bookmark data
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Selection range information captured from user interaction
 */
export interface SelectionRange {
  /** The selected text content */
  selectedText: string;

  /** The Range object from the browser's selection API */
  range: Range;

  /** Bounding rectangle for positioning UI elements */
  boundingRect: {
    top: number;
    left: number;
    width: number;
    height: number;
    bottom: number;
    right: number;
  };

  /** Context before the selection */
  contextBefore: string;

  /** Context after the selection */
  contextAfter: string;

  /** Start offset of the selection */
  startOffset: number;

  /** End offset of the selection */
  endOffset: number;

  /** Message ID where this selection was made */
  messageId: string;

  /** Conversation ID where this selection was made */
  conversationId: string;

  /** ISO timestamp when selection was captured */
  timestamp: string;

  /** Text anchor with positioning information (optional for now) */
  anchor?: TextAnchor;
}

/**
 * Message element structure for platform adapters
 */
export interface MessageElement {
  /** DOM element containing the message */
  element: Element;

  /** Unique identifier for this message */
  messageId: string;

  /** Role of the message sender ('user' or 'assistant') */
  role: 'user' | 'assistant';

  /** Plain text content of the message */
  content: string;

  /** Timestamp when the message was created (if available) */
  timestamp?: Date;
}
