/**
 * Main entry point for the Chatmarks browser extension
 */

export interface BookmarkData {
  id: string;
  text: string;
  note: string;
  timestamp: Date;
}

/**
 * Creates a new bookmark for selected text
 */
export function createBookmark(
  selectedText: string,
  note?: string
): BookmarkData {
  return {
    id: crypto.randomUUID(),
    text: selectedText,
    note: note || '',
    timestamp: new Date(),
  };
}

/**
 * Validates bookmark data
 */
export function validateBookmark(bookmark: BookmarkData): boolean {
  return Boolean(
    bookmark.id && bookmark.text && bookmark.timestamp instanceof Date
  );
}
