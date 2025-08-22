/**
 * Claude Platform Adapter
 *
 * Implements Claude-specific DOM interaction patterns for the Chatmarks extension.
 * Handles message identification, content extraction, and UI integration for Claude
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
 * Claude-specific configuration with comprehensive selector strategies
 */
const CLAUDE_CONFIG: PlatformAdapterConfig = {
  platform: 'claude' as Platform,
  primarySelectors: {
    // Primary selectors based on Claude's current DOM structure (Jan 2025)
    messageContainer: '[data-testid^="chat-message"], [data-testid^="message-"], div[class*="ConversationItem"], .prose',
    messageContent: '.prose, [class*="Message_messageContent"], [class*="MessageContent"], div[class*="markdown"], [class*="text-base"]',
    userMessage: '[data-testid*="user-message"], [class*="HumanMessage"], [data-message-author="human"], [data-role="user"]',
    assistantMessage: '[data-testid*="assistant-message"], [class*="AssistantMessage"], [data-message-author="assistant"], [data-role="assistant"]',
    conversationContainer: 'main [class*="Conversation"], [data-testid="conversation-container"], div[class*="ChatContainer"], [class*="flex-col"][class*="overflow"]',
  },
  fallbackSelectors: {
    // Fallback selectors for resilience against UI changes
    messageContainer: 'div[class*="Message"], div[class*="Turn"], article[class*="message"], div[class*="group"]',
    messageContent: 'div[class*="content"] p, div[class*="text"], .message-content, div[class*="whitespace-pre-wrap"]',
    conversationContainer: 'main > div > div, [role="main"] > div, body',
  },
  urlPatterns: ['claude.ai', 'anthropic.com/claude', 'claude.anthropic.com'],
  performance: {
    detectionTimeout: 100,
    extractionTimeout: 500,
    observerDebounce: 150,
  },
};

/**
 * Claude Platform Adapter Implementation
 */
export class ClaudeAdapter extends BasePlatformAdapter {
  private messageObserver: MutationObserver | null = null;
  private messageCache: Map<string, MessageElement> = new Map();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super(CLAUDE_CONFIG);
  }

  /**
   * Detects if the current page is Claude with multiple verification strategies
   */
  detectPlatform(): boolean {
    return this.measurePerformance(() => {
      // Check URL patterns
      const hostname = window.location.hostname.toLowerCase();
      const isClaudeUrl = this.config.urlPatterns.some(pattern =>
        hostname.includes(pattern)
      );
      
      if (!isClaudeUrl) return false;
      
      // Verify Claude-specific DOM elements
      const hasClaudeElements = !!(
        document.querySelector('[data-testid*="claude"]') ||
        document.querySelector('[class*="Claude"]') ||
        document.querySelector('[class*="Anthropic"]') ||
        document.querySelector('meta[content*="Claude"]') ||
        document.querySelector('title:has-text("Claude")')
      );
      
      // Check for Claude-specific global objects
      const hasClaudeGlobals = !!(
        (window as any).__CLAUDE__ ||
        (window as any).Claude ||
        document.documentElement.getAttribute('data-claude-app')
      );
      
      return hasClaudeElements || hasClaudeGlobals;
    }, 'platformDetectionTime');
  }

  /**
   * Extracts conversation ID from Claude URL or DOM with multiple strategies
   */
  getConversationId(): string | null {
    try {
      // Primary: Extract from URL path (format: /chat/[conversation-id])
      const urlMatch = window.location.pathname.match(/\/chat\/([a-zA-Z0-9-_]+)/);
      if (urlMatch && urlMatch[1]) {
        return urlMatch[1];
      }
      
      // Fallback: Look for conversation ID in data attributes
      const conversationElement = document.querySelector(
        '[data-conversation-id], [data-chat-id], [data-testid*="conversation-"]'
      );
      
      if (conversationElement) {
        const dataId = 
          conversationElement.getAttribute('data-conversation-id') ||
          conversationElement.getAttribute('data-chat-id') ||
          conversationElement.getAttribute('data-testid')?.match(/conversation-([a-zA-Z0-9-_]+)/)?.[1];
        
        if (dataId) return dataId;
      }
      
      // Check for conversation ID in React props or internal state
      const reactPropsElement = document.querySelector('[data-react-props*="conversationId"]');
      if (reactPropsElement) {
        const propsStr = reactPropsElement.getAttribute('data-react-props');
        if (propsStr) {
          try {
            const props = JSON.parse(propsStr);
            if (props.conversationId) return props.conversationId;
          } catch (_) {
            // Invalid JSON, continue to next strategy
          }
        }
      }
      
      // Generate conversation ID from page context if no ID found
      const conversationIndicators = document.querySelectorAll(
        '[data-testid*="conversation"], [class*="conversation"], [class*="chat"]'
      );
      if (conversationIndicators.length > 0) {
        return this.generateConversationId();
      }
      
      return null;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[ClaudeAdapter] Error getting conversation ID:', error);
      }
      return null;
    }
  }

  /**
   * Retrieves all message elements from the current Claude conversation
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
   * Injects bookmark UI elements into the Claude interface
   */
  injectBookmarkUI(anchor: TextAnchor, bookmark: Bookmark): void {
    const messageElement = this.findMessageById(anchor.messageId);
    if (!messageElement) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          'ClaudeAdapter: Could not find message element for bookmark injection'
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
          'ClaudeAdapter: Could not find conversation container for observation'
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
    const elements = Array.from(
      document.querySelectorAll(this.config.primarySelectors.messageContainer)
    );

    // Always try fallback selectors and combine results to handle mixed scenarios
    const fallbackElements = Array.from(
      document.querySelectorAll(this.config.fallbackSelectors.messageContainer)
    );

    // Combine and deduplicate elements
    const allElements = [...elements];
    for (const fallbackElement of fallbackElements) {
      if (!elements.includes(fallbackElement)) {
        allElements.push(fallbackElement);
      }
    }

    // Filter out elements that are too small or don't contain meaningful content
    return allElements.filter(element => {
      const text = element.textContent?.trim() || '';
      return text.length > 10; // Basic content filter
    });
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
        console.warn('ClaudeAdapter: Error extracting message data:', error);
      }
      return null;
    }
  }

  /**
   * Extracts a unique message ID from the message element with multiple strategies
   */
  private extractMessageId(element: Element): string {
    // Strategy 1: Try data-testid patterns
    const testId = element.getAttribute('data-testid');
    if (testId) {
      // Extract ID from patterns like "chat-message-123" or "message-abc"
      const match = testId.match(/(?:chat-)?message[_-]?([a-zA-Z0-9-]+)/);
      if (match && match[1]) {
        return match[1];
      }
      // Use full testid if it contains message
      if (testId.includes('message')) {
        return testId;
      }
    }
    
    // Strategy 2: Try standard ID attributes
    const dataId = element.getAttribute('data-message-id') || 
                   element.getAttribute('data-id') ||
                   element.getAttribute('id');
    if (dataId) {
      return dataId;
    }
    
    // Strategy 3: Look for React key or internal ID
    const reactKey = element.getAttribute('data-react-key') || 
                     element.getAttribute('data-key');
    if (reactKey && reactKey.includes('message')) {
      return reactKey;
    }
    
    // Strategy 4: Try to find ID in parent elements
    let parent = element.parentElement;
    let depth = 0;
    while (parent && parent !== document.body && depth < 5) {
      const parentId = parent.getAttribute('data-message-id') || 
                       parent.getAttribute('data-testid') ||
                       parent.getAttribute('data-id') ||
                       parent.getAttribute('id');
      if (parentId && (parentId.includes('message') || parentId.includes('turn'))) {
        return `${parentId}-child-${depth}`;
      }
      parent = parent.parentElement;
      depth++;
    }
    
    // Strategy 5: Generate stable ID from element position and content
    const allMessages = document.querySelectorAll(this.config.primarySelectors.messageContainer);
    const messageIndex = Array.from(allMessages).indexOf(element);
    const contentPreview = this.extractMessageContent(element).slice(0, 100);
    const contentHash = this.simpleHash(contentPreview);
    const conversationId = this.getConversationId() || 'unknown';
    
    return `claude-msg-${conversationId}-${messageIndex}-${contentHash}`;
  }

  /**
   * Determines if a message is from user or assistant with comprehensive checks
   */
  private determineMessageRole(element: Element): 'user' | 'assistant' {
    // Strategy 1: Check data attributes
    const role = element.getAttribute('data-role');
    if (role === 'user' || role === 'human') return 'user';
    if (role === 'assistant' || role === 'claude') return 'assistant';
    
    const messageAuthor = element.getAttribute('data-message-author');
    if (messageAuthor === 'human' || messageAuthor === 'user') return 'user';
    if (messageAuthor === 'assistant' || messageAuthor === 'claude') return 'assistant';
    
    // Strategy 2: Check against configured selectors
    if (element.matches(this.config.primarySelectors.userMessage)) {
      return 'user';
    }
    if (element.matches(this.config.primarySelectors.assistantMessage)) {
      return 'assistant';
    }
    
    // Strategy 3: Check class names for role indicators
    const className = element.className.toLowerCase();
    if (className.includes('human') || className.includes('user')) {
      return 'user';
    }
    if (className.includes('assistant') || className.includes('claude') || className.includes('ai')) {
      return 'assistant';
    }
    
    // Strategy 4: Check for avatar or icon indicators
    const hasUserAvatar = !!element.querySelector('[class*="user-avatar"], [class*="human-avatar"], [alt*="User"]');
    const hasAssistantAvatar = !!element.querySelector('[class*="claude-avatar"], [class*="assistant-avatar"], [alt*="Claude"]');
    
    if (hasUserAvatar) return 'user';
    if (hasAssistantAvatar) return 'assistant';
    
    // Strategy 5: Check background color or styling patterns
    const computedStyle = window.getComputedStyle(element);
    const bgColor = computedStyle.backgroundColor;
    
    // Claude often uses different background colors for user/assistant
    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
      // Check if this element has a distinct background from its siblings
      const siblings = Array.from(element.parentElement?.children || []);
      const index = siblings.indexOf(element);
      
      // Alternating pattern detection
      if (index > 0) {
        const prevSibling = siblings[index - 1];
        if (prevSibling) {
          const prevBgColor = window.getComputedStyle(prevSibling).backgroundColor;
          if (prevBgColor !== bgColor) {
            // Different background suggests alternating roles
            return index % 2 === 0 ? 'user' : 'assistant';
          }
        }
      }
    }
    
    // Strategy 6: Position-based heuristic
    const allMessages = document.querySelectorAll(this.config.primarySelectors.messageContainer);
    const messageIndex = Array.from(allMessages).indexOf(element);
    
    // Claude typically starts with user message
    return messageIndex % 2 === 0 ? 'user' : 'assistant';
  }

  /**
   * Helper method to get role from element attributes/classes
   */
  private getElementRole(element: Element): 'user' | 'assistant' | null {
    const role = element.getAttribute('data-role');
    if (role === 'user' || role === 'assistant') {
      return role;
    }

    const className = element.className.toLowerCase();
    if (className.includes('user')) {
      return 'user';
    }
    if (className.includes('assistant') || className.includes('claude')) {
      return 'assistant';
    }

    return null;
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
   * Generates a conversation ID from page context
   */
  private generateConversationId(): string {
    // Try to find a unique identifier in the page
    const title = document.title;
    const url = window.location.href;
    const timestamp = Date.now();
    
    const contextString = `${title}-${url}-${timestamp}`;
    return `claude-conversation-${this.simpleHash(contextString)}`;
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