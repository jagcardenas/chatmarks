/**
 * PlatformUtils Module
 *
 * Provides utility functions for platform detection, conversation ID extraction,
 * and message ID generation. Centralizes platform-specific logic and URL parsing.
 */

import { Platform } from '../../types/bookmark';

/**
 * Detects which AI platform the current page belongs to.
 *
 * @returns The detected platform or null if not on a supported platform
 */
export function detectCurrentPlatform(): Platform | null {
  const hostname = window.location.hostname;

  if (
    hostname.includes('chatgpt.com') ||
    hostname.includes('chat.openai.com')
  ) {
    return 'chatgpt';
  } else if (hostname.includes('claude.ai')) {
    return 'claude';
  } else if (hostname.includes('x.com') || hostname.includes('grok.x.ai')) {
    return 'grok';
  }

  return null;
}

/**
 * Extracts conversation ID from the current URL based on platform patterns.
 * Falls back to generating an ID if extraction fails.
 *
 * @returns The extracted or generated conversation ID
 */
export function extractConversationId(): string {
  const url = window.location.href;

  // ChatGPT URL patterns: https://chatgpt.com/c/[conversation-id] or https://chat.openai.com/c/[conversation-id]
  const chatGptMatch = url.match(
    /(?:chatgpt\.com|chat\.openai\.com)\/c\/([^/?]+)/
  );
  if (chatGptMatch) return chatGptMatch[1] || '';

  // Claude URL pattern: https://claude.ai/chat/[conversation-id]
  const claudeMatch = url.match(/claude\.ai\/chat\/([^/?]+)/);
  if (claudeMatch) return claudeMatch[1] || '';

  // Grok patterns (will be refined when platform adapter is implemented)
  const grokMatch = url.match(/x\.com.*\/([^/?]+)/);
  if (grokMatch) return grokMatch[1] || '';

  // Fallback to URL hash or generate from timestamp
  return generateConversationId();
}

/**
 * Generates a conversation ID when none can be extracted from URL.
 * Uses hostname and timestamp to ensure uniqueness.
 *
 * @returns A generated conversation ID
 */
export function generateConversationId(): string {
  const hostname = window.location.hostname;
  const timestamp = Date.now();
  return `${hostname}-${timestamp}`;
}

/**
 * Generates a message ID from selection context and timestamp.
 *
 * @param textHash - Optional hash of the selected text
 * @returns A unique message ID
 */
export function generateMessageId(textHash?: string): string {
  const timestamp = Date.now();

  if (textHash) {
    return `msg-${textHash}-${timestamp}`;
  }

  return `msg-${timestamp}`;
}

/**
 * Checks if the current URL matches a conversation page pattern.
 *
 * @param platform - The platform to check for
 * @returns true if on a conversation page, false otherwise
 */
export function isConversationPage(platform: Platform): boolean {
  const url = window.location.href;

  switch (platform) {
    case 'chatgpt':
      return /(?:chatgpt\.com|chat\.openai\.com)\/c\//.test(url);
    case 'claude':
      return /claude\.ai\/chat\//.test(url);
    case 'grok':
      return /(?:x\.com|grok\.x\.ai)/.test(url);
    default:
      return false;
  }
}

/**
 * Gets the base URL for the current platform.
 *
 * @param platform - The platform to get base URL for
 * @returns The base URL string
 */
export function getPlatformBaseUrl(platform: Platform): string {
  switch (platform) {
    case 'chatgpt':
      return window.location.hostname.includes('chat.openai.com')
        ? 'https://chat.openai.com'
        : 'https://chatgpt.com';
    case 'claude':
      return 'https://claude.ai';
    case 'grok':
      return 'https://x.com';
    default:
      return window.location.origin;
  }
}

/**
 * Constructs a conversation URL for navigation.
 *
 * @param platform - The platform
 * @param conversationId - The conversation ID
 * @returns The full conversation URL
 */
export function buildConversationUrl(
  platform: Platform,
  conversationId: string
): string {
  const baseUrl = getPlatformBaseUrl(platform);

  switch (platform) {
    case 'chatgpt':
      return `${baseUrl}/c/${conversationId}`;
    case 'claude':
      return `${baseUrl}/chat/${conversationId}`;
    case 'grok':
      // Grok URL pattern to be refined
      return `${baseUrl}/${conversationId}`;
    default:
      return baseUrl;
  }
}

/**
 * Validates if a string is a valid conversation ID format.
 *
 * @param id - The ID to validate
 * @returns true if valid, false otherwise
 */
export function isValidConversationId(id: string): boolean {
  // Basic validation - non-empty and reasonable length
  if (!id || id.length < 3 || id.length > 100) {
    return false;
  }

  // Check for valid characters (alphanumeric, dash, underscore)
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

/**
 * Creates a simple hash from a string for ID generation.
 *
 * @param str - The string to hash
 * @returns A hash string
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}
