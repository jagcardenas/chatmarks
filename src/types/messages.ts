/**
 * Message Types and Interfaces for Chrome Extension Inter-Context Communication
 *
 * Defines the structure for messages passed between service worker, content scripts,
 * and popup components. Ensures type safety and clear communication protocols.
 */

/**
 * Enumeration of all message types used in the extension
 * Note: Many enum values are reserved for future implementation phases
 */
export enum MessageType {
  // Bookmark operations
  CREATE_BOOKMARK = 'CREATE_BOOKMARK',
  CREATE_BOOKMARK_FROM_CONTEXT = 'CREATE_BOOKMARK_FROM_CONTEXT',
  UPDATE_BOOKMARK = 'UPDATE_BOOKMARK',
  DELETE_BOOKMARK = 'DELETE_BOOKMARK',
  GET_BOOKMARKS = 'GET_BOOKMARKS',

  // Navigation operations
  NAVIGATE_TO_BOOKMARK = 'NAVIGATE_TO_BOOKMARK',
  SHOW_BOOKMARK_SIDEBAR = 'SHOW_BOOKMARK_SIDEBAR',
  HIDE_BOOKMARK_SIDEBAR = 'HIDE_BOOKMARK_SIDEBAR',

  // Settings operations
  GET_SETTINGS = 'GET_SETTINGS',
  SAVE_SETTINGS = 'SAVE_SETTINGS',

  // Branching operations (V2)
  CREATE_BRANCH = 'CREATE_BRANCH',
  GET_BRANCHES = 'GET_BRANCHES',

  // Platform detection
  DETECT_PLATFORM = 'DETECT_PLATFORM',
  PLATFORM_DETECTED = 'PLATFORM_DETECTED',
}

/**
 * Base interface for all extension messages
 */
export interface BaseMessage {
  type: MessageType;
  data?: Record<string, unknown>;
  requestId?: string;
}

/**
 * Message interface for bookmark-related operations
 */
export interface BookmarkMessage extends BaseMessage {
  type:
    | MessageType.CREATE_BOOKMARK
    | MessageType.CREATE_BOOKMARK_FROM_CONTEXT
    | MessageType.UPDATE_BOOKMARK
    | MessageType.DELETE_BOOKMARK
    | MessageType.GET_BOOKMARKS;
  data: {
    bookmarkId?: string;
    selectionText?: string;
    note?: string;
    conversationId?: string;
    anchor?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

/**
 * Message interface for navigation operations
 */
export interface NavigationMessage extends BaseMessage {
  type:
    | MessageType.NAVIGATE_TO_BOOKMARK
    | MessageType.SHOW_BOOKMARK_SIDEBAR
    | MessageType.HIDE_BOOKMARK_SIDEBAR;
  data: {
    bookmarkId?: string;
    position?: { x: number; y: number };
  };
}

/**
 * Message interface for settings operations
 */
export interface SettingsMessage extends BaseMessage {
  type: MessageType.GET_SETTINGS | MessageType.SAVE_SETTINGS;
  data?: {
    settings?: Record<string, unknown>;
  };
}

/**
 * Response interface for message handling
 */
export interface MessageResponse {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Union type for all possible message types
 */
export type ExtensionMessage =
  | BookmarkMessage
  | NavigationMessage
  | SettingsMessage
  | BaseMessage;
