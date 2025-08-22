/**
 * ChatGPT Platform Adapter
 *
 * Implements ChatGPT-specific DOM interaction patterns for the Chatmarks extension.
 * Handles message identification, content extraction, and UI integration for ChatGPT
 * conversations with robust fallback strategies.
 */

import {
  Platform,
  MessageElement,
  TextAnchor,
  Bookmark,
} from '../../types/bookmark';
import {
  BasePlatformAdapter,
  PlatformAdapterConfig,
  MessageExtractionResult,
} from './PlatformAdapter';

/**
 * ChatGPT-specific configuration
 */
const CHATGPT_CONFIG: PlatformAdapterConfig = {
  platform: 'chatgpt' as Platform,
  primarySelectors: {
    messageContainer: '[data-testid*="conversation-turn"]',
    messageContent: '.prose, [class*="markdown"]',
    userMessage: '[data-author="user"]',
    assistantMessage: '[data-author="assistant"]',
    conversationContainer: 'main',
  },
  fallbackSelectors: {
    messageContainer: 'div[class*="group"]',
    messageContent: 'div[class*="whitespace-pre-wrap"]',
    conversationContainer: '[role="main"]',
  },
  urlPatterns: ['chatgpt.com', 'chat.openai.com'],
  performance: {
    detectionTimeout: 100,
    extractionTimeout: 500,
    observerDebounce: 150,
  },
};

/**
 * ChatGPT Platform Adapter Implementation
 */
export class ChatGPTAdapter extends BasePlatformAdapter {
  private messageObserver: MutationObserver | null = null;
  private messageCache: Map<string, MessageElement> = new Map();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super(CHATGPT_CONFIG);
  }

  /**
   * Detects if the current page is ChatGPT
   */
  detectPlatform(): boolean {
    return this.measurePerformance(() => {
      const hostname = window.location.hostname;
      return this.config.urlPatterns.some(pattern =>
        hostname.includes(pattern)
      );
    }, 'platformDetectionTime');
  }

  /**
   * Extracts conversation ID from ChatGPT URL
   */
  getConversationId(): string | null {
    const url = window.location.href;

    // ChatGPT URL patterns: https://chatgpt.com/c/[conversation-id] or https://chat.openai.com/c/[conversation-id]
    const match = url.match(/(?:chatgpt\.com|chat\.openai\.com)\/c\/([^/?#]+)/);
    if (match && match[1]) {
      return match[1];
    }

    // Fallback: Check for URL hash or generate from page context
    if (window.location.hash) {
      const hashMatch = window.location.hash.match(/#\/c\/([^/?#]+)/);
      if (hashMatch && hashMatch[1]) {
        return hashMatch[1];
      }
    }

    return null;
  }

  /**
   * Retrieves all message elements from the current ChatGPT conversation
   */
  getMessages(): MessageElement[] {
    return this.measurePerformance(() => {
      const result = this.extractMessages();
      this.metrics.messageCount = result.messages.length;

      if (!result.success) {
        this.metrics.errorCount++;
        this.metrics.lastError = result.error;
        return [];
      }

      return result.messages;
    }, 'messageExtractionTime');
  }

  /**
   * Finds a specific message element by its ID
   */
  findMessageById(messageId: string): Element | null {
    // Check cache first
    const cachedMessage = this.messageCache.get(messageId);
    if (cachedMessage) {
      return cachedMessage.element;
    }

    // Search in DOM
    const messages = this.getMessages();
    const targetMessage = messages.find(msg => msg.messageId === messageId);
    return targetMessage?.element || null;
  }

  /**
   * Injects bookmark UI elements into the ChatGPT interface
   */
  injectBookmarkUI(anchor: TextAnchor, bookmark: Bookmark): void {
    const messageElement = this.findMessageById(anchor.messageId);
    if (!messageElement) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          'ChatGPTAdapter: Could not find message element for bookmark injection'
        );
      }
      return;
    }

    // Create bookmark indicator
    const bookmarkIndicator = this.createBookmarkIndicator(bookmark);

    // Position relative to message content
    const contentElement = this.findMessageContent(messageElement);
    if (contentElement) {
      this.injectBookmarkIndicator(contentElement, bookmarkIndicator, anchor);
    }
  }

  /**
   * Sets up observation for new messages appearing in the conversation
   */
  observeNewMessages(callback: (messages: Element[]) => void): void {
    const conversationContainer = this.findConversationContainer();
    if (!conversationContainer) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          'ChatGPTAdapter: Could not find conversation container for observation'
        );
      }
      return;
    }

    // Create debounced callback to avoid excessive updates
    const debouncedCallback = (messages: Element[]) => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(() => {
        callback(messages);
      }, this.config.performance.observerDebounce);
    };

    this.messageObserver = this.createObserver(mutations => {
      const newMessages: Element[] = [];

      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;

            // Check if this is a message container
            if (this.isMessageContainer(element)) {
              newMessages.push(element);
            }

            // Check for message containers within the added node
            const messageContainers = this.findMessageContainers(element);
            newMessages.push(...messageContainers);
          }
        });
      });

      if (newMessages.length > 0) {
        debouncedCallback(newMessages);
      }
    });

    this.messageObserver.observe(conversationContainer, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Extracts messages from the current page
   */
  private extractMessages(): MessageExtractionResult {
    const startTime = performance.now();

    try {
      const messageElements = this.findAllMessageContainers();
      const messages: MessageElement[] = [];

      for (const element of messageElements) {
        const messageData = this.extractMessageData(element);
        if (messageData) {
          messages.push(messageData);
          // Update cache
          this.messageCache.set(messageData.messageId, messageData);
        }
      }

      const extractionTime = performance.now() - startTime;

      return {
        success: true,
        messages,
        extractionTime,
      };
    } catch (error) {
      const extractionTime = performance.now() - startTime;

      return {
        success: false,
        messages: [],
        error:
          error instanceof Error ? error.message : 'Unknown extraction error',
        extractionTime,
      };
    }
  }

  /**
   * Finds all message containers using primary and fallback selectors
   */
  private findAllMessageContainers(): Element[] {
    // Try primary selectors first
    let elements = Array.from(
      document.querySelectorAll(this.config.primarySelectors.messageContainer)
    );

    // Always try fallback selectors and combine results to handle mixed scenarios
    const fallbackElements = Array.from(
      document.querySelectorAll(this.config.fallbackSelectors.messageContainer)
    );

    // Combine and deduplicate elements (avoid duplicates if same element matches both selectors)
    const allElements = [...elements];
    for (const fallbackElement of fallbackElements) {
      if (!elements.includes(fallbackElement)) {
        allElements.push(fallbackElement);
      }
    }

    return allElements;
  }

  /**
   * Finds message containers within a given element
   */
  private findMessageContainers(element: Element): Element[] {
    const containers: Element[] = [];

    // Check primary selectors
    const primaryMatches = element.querySelectorAll(
      this.config.primarySelectors.messageContainer
    );
    containers.push(...Array.from(primaryMatches));

    // Check fallback selectors if no primary matches
    if (containers.length === 0) {
      const fallbackMatches = element.querySelectorAll(
        this.config.fallbackSelectors.messageContainer
      );
      containers.push(...Array.from(fallbackMatches));
    }

    return containers;
  }

  /**
   * Checks if an element is a message container
   */
  private isMessageContainer(element: Element): boolean {
    // Check against primary selectors
    if (element.matches?.(this.config.primarySelectors.messageContainer)) {
      return true;
    }

    // Check against fallback selectors
    if (element.matches?.(this.config.fallbackSelectors.messageContainer)) {
      return true;
    }

    return false;
  }

  /**
   * Extracts message data from a message container element
   */
  private extractMessageData(element: Element): MessageElement | null {
    try {
      // Extract message ID
      const messageId = this.extractMessageId(element);
      if (!messageId) {
        return null;
      }

      // Determine message role (user or assistant)
      const role = this.determineMessageRole(element);

      // Extract content
      const content = this.extractMessageContent(element);
      if (!content) {
        return null;
      }

      // Extract timestamp if available
      const timestamp = this.extractMessageTimestamp(element);

      return {
        element,
        messageId,
        role,
        content,
        timestamp,
      };
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('ChatGPTAdapter: Error extracting message data:', error);
      }
      return null;
    }
  }

  /**
   * Extracts a unique message ID from the message element
   */
  private extractMessageId(element: Element): string {
    // Try to get data-turn-id UUID (most reliable)
    const turnId = element.getAttribute('data-turn-id');
    if (turnId) {
      return turnId;
    }

    // Try data-testid pattern
    const testId = element.getAttribute('data-testid');
    if (testId && testId.includes('conversation-turn')) {
      return testId;
    }

    // Fallback: Generate ID from element position and content
    const siblings = Array.from(element.parentElement?.children || []);
    const index = siblings.indexOf(element);
    const contentPreview = this.extractMessageContent(element).slice(0, 50);
    const contentHash = this.simpleHash(contentPreview);

    return `chatgpt-msg-${index}-${contentHash}`;
  }

  /**
   * Determines if a message is from user or assistant
   */
  private determineMessageRole(element: Element): 'user' | 'assistant' {
    // Check data-author attribute
    const author = element.getAttribute('data-author');
    if (author === 'user') return 'user';
    if (author === 'assistant') return 'assistant';

    // Check for user/assistant specific selectors
    if (element.matches(this.config.primarySelectors.userMessage)) {
      return 'user';
    }
    if (element.matches(this.config.primarySelectors.assistantMessage)) {
      return 'assistant';
    }

    // Fallback: Use heading text or structure analysis
    const headingElement = element.querySelector('h1, h2, h3, h4, h5, h6');
    if (headingElement) {
      const headingText = headingElement.textContent?.toLowerCase() || '';
      if (headingText.includes('you') || headingText.includes('user')) {
        return 'user';
      }
      if (
        headingText.includes('chatgpt') ||
        headingText.includes('assistant')
      ) {
        return 'assistant';
      }
    }

    // Ultimate fallback: Assume assistant if we can't determine
    return 'assistant';
  }

  /**
   * Extracts text content from a message element
   */
  private extractMessageContent(element: Element): string {
    // Try primary content selectors
    const contentElement = element.querySelector(
      this.config.primarySelectors.messageContent
    );
    if (contentElement) {
      return this.cleanTextContent(contentElement.textContent || '');
    }

    // Try fallback content selectors
    const fallbackContentElement = element.querySelector(
      this.config.fallbackSelectors.messageContent
    );
    if (fallbackContentElement) {
      return this.cleanTextContent(fallbackContentElement.textContent || '');
    }

    // Fallback: Use element's direct text content
    return this.cleanTextContent(element.textContent || '');
  }

  /**
   * Finds the content element within a message container
   */
  private findMessageContent(element: Element): Element | null {
    // Try primary content selectors
    const contentElement = element.querySelector(
      this.config.primarySelectors.messageContent
    );
    if (contentElement) {
      return contentElement;
    }

    // Try fallback content selectors
    const fallbackContentElement = element.querySelector(
      this.config.fallbackSelectors.messageContent
    );
    if (fallbackContentElement) {
      return fallbackContentElement;
    }

    return null;
  }

  /**
   * Extracts timestamp from message element if available
   */
  private extractMessageTimestamp(element: Element): Date | undefined {
    // Look for time elements or timestamp attributes
    const timeElement = element.querySelector('time[datetime]');
    if (timeElement) {
      const datetime = timeElement.getAttribute('datetime');
      if (datetime) {
        return new Date(datetime);
      }
    }

    // Look for timestamp data attributes
    const timestamp = element.getAttribute('data-timestamp');
    if (timestamp) {
      const ts = parseInt(timestamp, 10);
      if (!isNaN(ts)) {
        return new Date(ts);
      }
    }

    return undefined;
  }

  /**
   * Finds the main conversation container
   */
  private findConversationContainer(): Element | null {
    // Try primary selector
    const primary = document.querySelector(
      this.config.primarySelectors.conversationContainer
    );
    if (primary) return primary;

    // Try fallback selector
    const fallback = document.querySelector(
      this.config.fallbackSelectors.conversationContainer
    );
    if (fallback) return fallback;

    return null;
  }

  /**
   * Creates a bookmark indicator element
   */
  private createBookmarkIndicator(bookmark: Bookmark): HTMLElement {
    const indicator = document.createElement('div');
    indicator.className = 'chatmarks-bookmark-indicator';
    indicator.style.cssText = `
      position: absolute;
      top: 0;
      right: 8px;
      width: 8px;
      height: 8px;
      background-color: ${bookmark.color};
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.8);
      cursor: pointer;
      z-index: 1000;
    `;
    indicator.title = bookmark.note || 'Bookmark';
    indicator.setAttribute('data-bookmark-id', bookmark.id);

    return indicator;
  }

  /**
   * Injects bookmark indicator into the message content
   */
  private injectBookmarkIndicator(
    contentElement: Element,
    indicator: HTMLElement,
    _anchor: TextAnchor
  ): void {
    // Ensure the content element has relative positioning
    const computedStyle = window.getComputedStyle(contentElement);
    if (computedStyle.position === 'static') {
      (contentElement as HTMLElement).style.position = 'relative';
    }

    contentElement.appendChild(indicator);
  }

  /**
   * Cleans and normalizes text content
   */
  private cleanTextContent(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Simple hash function for generating consistent IDs
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Cleanup method to remove observers and cached data
   */
  cleanup(): void {
    super.cleanup();

    if (this.messageObserver) {
      this.messageObserver.disconnect();
      this.messageObserver = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.messageCache.clear();
  }
}
