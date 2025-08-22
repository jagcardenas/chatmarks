/**
 * Main entry point for the Chatmarks browser extension
 *
 * This file serves as the main entry point and re-exports key types and functions
 * from the core modules for external use.
 */

// Re-export core types for external consumers
export type {
  Bookmark,
  Platform,
  TextAnchor,
  CreateBookmarkData,
  UpdateBookmarkData,
  BookmarkFilters,
  SelectionRange,
  MessageElement,
} from './types/bookmark';

// Re-export message types
export type { ExtensionMessage, MessageResponse } from './types/messages';

// Note: The main functionality is now properly implemented in the specialized modules:
// - BookmarkManager for bookmark operations
// - StorageService for data persistence
// - TextSelection for text capture
// - AnchorSystem for robust text anchoring
