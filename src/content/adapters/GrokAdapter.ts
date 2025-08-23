/**
 * Grok Platform Adapter
 *
 * Implements Grok-specific DOM interaction patterns for the Chatmarks extension.
 * Handles message identification, content extraction, and UI integration for Grok
 * conversations on X.com platform with robust fallback strategies.
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
 * Grok-specific configuration based on research findings
 */
const GROK_CONFIG: PlatformAdapterConfig = {
  platform: 'grok' as Platform,
  primarySelectors: {
    messageContainer: '.message-bubble, .message-container, [data-testid*="grok"], [class*="grok"], [class*="message"], article',
    messageContent: '.message-content, [data-message-content], [data-testid="tweetText"], [class*="content"], [class*="text"], p',
    userMessage: '.user-message, [data-author="user"], [data-testid*="user"], [class*="user"]',
    assistantMessage: '.assistant-message, [data-author="assistant"], [data-testid*="grok"], [class*="grok"], [class*="assistant"]',
    conversationContainer: '.conversation-container, .chat-area, [data-testid="primaryColumn"], main, [role="main"]',
  },
  fallbackSelectors: {
    messageContainer: 'div[class*="group"], div[class*="message"], div[class*="tweet"], div[class*="post"], [role="article"]',
    messageContent: 'div[class*="text"], div[class*="content"], span, [class*="prose"]',
    conversationContainer: 'body',
  },
  urlPatterns: ['grok.com', 'x.com', 'twitter.com'],
  performance: {
    detectionTimeout: 100,
    extractionTimeout: 500,
    observerDebounce: 150,
  },
};

/**
 * Grok Platform Adapter Implementation
 */
export class GrokAdapter extends BasePlatformAdapter {
  private messageObserver: MutationObserver | null = null;
  private messageCache: Map<string, MessageElement> = new Map();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private urlChangeObserver: ReturnType<typeof setInterval> | null = null;
  private currentUrl: string = '';

  constructor() {
    super(GROK_CONFIG);
    this.currentUrl = window.location.href;
    this.setupUrlChangeDetection();
  }

  /**
   * Sets up detection for URL changes (SPA navigation)
   */
  private setupUrlChangeDetection(): void {
    // Listen for popstate events (back/forward navigation)
    this.addEventListener(window, 'popstate', () => {
      this.handleUrlChange();
    });

    // Periodic URL checking for SPA navigation that doesn't trigger popstate
    this.urlChangeObserver = setInterval(() => {
      const newUrl = window.location.href;
      if (newUrl !== this.currentUrl) {
        this.currentUrl = newUrl;
        this.handleUrlChange();
      }
    }, 1000);
  }

  /**
   * Handles URL changes by clearing cache and re-detecting platform
   */
  private handleUrlChange(): void {
    // Clear message cache since we're on a new page/conversation
    this.messageCache.clear();
    
    // Reset metrics for new conversation
    this.metrics.messageCount = 0;
    this.metrics.errorCount = 0;
    this.metrics.lastError = undefined;
  }

  /**
   * Detects if the current page is Grok (on grok.com or x.com)
   */
  detectPlatform(): boolean {
    return this.measurePerformance(() => {
      const hostname = window.location.hostname;
      const isGrokDomain = this.config.urlPatterns.some(pattern =>
        hostname.includes(pattern)
      );

      // For grok.com, it's always Grok
      if (hostname.includes('grok.com')) {
        return true;
      }

      // For x.com, check for Grok-specific indicators
      if (hostname.includes('x.com') || hostname.includes('twitter.com')) {
        return isGrokDomain && this.isGrokOnX();
      }

      return false;
    }, 'platformDetectionTime');
  }

  /**
   * Checks if we're in a Grok conversation on X.com
   */
  private isGrokOnX(): boolean {
    // Check URL for Grok path
    const hasGrokInPath = window.location.pathname.includes('grok');
    
    // Check for Grok-specific UI elements
    const hasGrokElements = document.querySelector('[data-testid*="grok"], [class*="grok"], .message-bubble') !== null;
    
    // Check for Grok branding or conversation indicators
    const hasGrokBranding = document.querySelector('[aria-label*="Grok"], [alt*="Grok"]') !== null;
    
    return hasGrokInPath || hasGrokElements || hasGrokBranding;
  }

  /**
   * Extracts conversation ID from Grok URL or generates one
   */
  getConversationId(): string | null {
    const url = window.location.href;
    const hostname = window.location.hostname;

    // Pattern for grok.com: https://grok.com/c/[conversation-id] or https://grok.com/chat/[id]
    if (hostname.includes('grok.com')) {
      const match = url.match(/grok\.com\/(?:c|chat)\/([^/?#]+)/);
      if (match && match[1]) {
        return match[1];
      }
      
      // Only generate ID if we have legitimate Grok indicators
      if (this.hasLegitimateGrokIndicators()) {
        return this.generateConversationId();
      }
      return null;
    }

    // Pattern for x.com: https://x.com/i/grok, https://x.com/grok/[id], or similar
    if (hostname.includes('x.com') || hostname.includes('twitter.com')) {
      const pathSegments = window.location.pathname.split('/').filter(segment => segment.length > 0);
      
      // Check for Grok-specific path segments
      if (pathSegments.includes('grok')) {
        const grokIndex = pathSegments.indexOf('grok');
        if (grokIndex + 1 < pathSegments.length) {
          return pathSegments[grokIndex + 1] || null;
        }
        // If we have /grok in path but no specific ID, still generate one
        return this.generateConversationId();
      }
      
      // Check for conversation ID in URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const conversationId = urlParams.get('conversation') || 
                            urlParams.get('conversation_id') || 
                            urlParams.get('chat_id') ||
                            urlParams.get('c');
      if (conversationId) {
        return conversationId;
      }
      
      // Only generate ID if we have legitimate Grok indicators
      if (this.hasLegitimateGrokIndicators()) {
        return this.generateConversationId();
      }
      return null;
    }

    // For other domains, only return ID if we have clear Grok indicators
    if (this.hasLegitimateGrokIndicators()) {
      return this.generateConversationId();
    }

    return null;
  }

  /**
   * Retrieves all message elements from the current Grok conversation
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
   * Injects bookmark UI elements into the Grok interface
   */
  injectBookmarkUI(anchor: TextAnchor, bookmark: Bookmark): void {
    const messageElement = this.findMessageById(anchor.messageId);
    if (!messageElement) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          'GrokAdapter: Could not find message element for bookmark injection'
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
          'GrokAdapter: Could not find conversation container for observation'
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

    // Filter out elements that are not Grok-related or too small
    return allElements.filter(element => {
      const text = element.textContent?.trim() || '';
      const isGrokRelated = this.isGrokRelatedElement(element);
      return text.length > 10 && isGrokRelated;
    });
  }

  /**
   * Checks if an element is related to Grok conversation
   */
  private isGrokRelatedElement(element: Element): boolean {
    // Check for strong Grok-specific attributes or classes
    const hasGrokAttributes = element.getAttribute('data-testid')?.includes('grok') ||
                             element.className.includes('grok') ||
                             element.getAttribute('data-grok-id') !== null;

    // Check if element is within Grok conversation area
    const grokContainer = element.closest('[data-testid*="grok"], [class*="grok"]');
    
    // Strong indicator: Grok-specific selectors
    if (hasGrokAttributes || grokContainer !== null) {
      return true;
    }

    // Check for legitimate Grok conversation patterns in content
    const content = element.textContent?.toLowerCase() || '';
    const hasGrokMention = content.includes('@grok');
    const hasGrokAvatar = element.querySelector('[alt*="grok" i]') !== null;
    
    // Be more restrictive: require specific Grok indicators, not just "grok" in text
    // This prevents regular tweets that happen to mention "grok" from being included
    const hasStrongGrokIndicators = hasGrokMention || hasGrokAvatar;
    
    // Additional check: ensure this is in a conversation context, not a regular tweet
    const isInConversationContext = element.closest('.message-bubble, .message-container') !== null ||
                                   element.matches('.message-bubble, .message-container');
    
    return hasStrongGrokIndicators && isInConversationContext;
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

    return containers.filter(container => this.isGrokRelatedElement(container));
  }

  /**
   * Checks if an element is a message container
   */
  private isMessageContainer(element: Element): boolean {
    // Check against primary selectors
    if (element.matches?.(this.config.primarySelectors.messageContainer)) {
      return this.isGrokRelatedElement(element);
    }

    // Check against fallback selectors
    if (element.matches?.(this.config.fallbackSelectors.messageContainer)) {
      return this.isGrokRelatedElement(element);
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
        console.warn('GrokAdapter: Error extracting message data:', error);
      }
      return null;
    }
  }

  /**
   * Extracts a unique message ID from the message element
   */
  private extractMessageId(element: Element): string {
    // Try to get data attributes first
    const dataId = element.getAttribute('data-grok-id') ||
                   element.getAttribute('data-testid') ||
                   element.getAttribute('data-tweet-id') ||
                   element.getAttribute('id');
    if (dataId) {
      return dataId;
    }

    // Try to find ID in parent elements
    let parent = element.parentElement;
    while (parent && parent !== document.body) {
      const parentId = parent.getAttribute('data-grok-id') ||
                       parent.getAttribute('data-testid') ||
                       parent.getAttribute('data-tweet-id') ||
                       parent.getAttribute('id');
      if (parentId && (parentId.includes('grok') || parentId.includes('message'))) {
        return parentId;
      }
      parent = parent.parentElement;
    }

    // Fallback: Generate ID from element position and content
    const siblings = Array.from(element.parentElement?.children || []);
    const index = siblings.indexOf(element);
    const contentPreview = this.extractMessageContent(element).slice(0, 50);
    const contentHash = this.simpleHash(contentPreview);

    return `grok-msg-${index}-${contentHash}`;
  }

  /**
   * Determines if a message is from user or assistant (Grok)
   */
  private determineMessageRole(element: Element): 'user' | 'assistant' {
    // Check data attributes
    const author = element.getAttribute('data-author') ||
                   element.getAttribute('data-role');
    if (author === 'user') return 'user';
    if (author === 'assistant' || author === 'grok') return 'assistant';

    // Check for user/assistant specific selectors
    if (element.matches(this.config.primarySelectors.userMessage)) {
      return 'user';
    }
    if (element.matches(this.config.primarySelectors.assistantMessage)) {
      return 'assistant';
    }

    // Check class names for role indicators
    const className = element.className.toLowerCase();
    if (className.includes('user')) {
      return 'user';
    }
    if (className.includes('grok') || className.includes('assistant')) {
      return 'assistant';
    }

    // Check for Grok-specific visual indicators
    const hasGrokAvatar = element.querySelector('[alt*="grok" i], [src*="grok" i]') !== null;
    if (hasGrokAvatar) {
      return 'assistant';
    }

    // Check content patterns for Grok identification
    const content = this.extractMessageContent(element).toLowerCase();
    if (content.includes('grok:') || content.includes('@grok')) {
      return 'assistant';
    }
    if (content.includes('you:') || content.includes('user:')) {
      return 'user';
    }

    // Check for X.com/Twitter-specific user indicators
    const hasUserAvatar = element.querySelector('[data-testid*="UserAvatar"], [alt*="profile" i]') !== null;
    if (hasUserAvatar && !hasGrokAvatar) {
      return 'user';
    }

    // Analyze message positioning (Grok messages typically have different styling)
    const hasGrokStyling = this.hasGrokMessageStyling(element);
    if (hasGrokStyling) {
      return 'assistant';
    }

    // Ultimate fallback: Assume user if we can't determine (X.com is user-centric)
    return 'user';
  }

  /**
   * Checks if element has Grok-specific message styling
   */
  private hasGrokMessageStyling(element: Element): boolean {
    // Look for common Grok styling patterns
    const computedStyle = window.getComputedStyle(element);
    const hasDistinctBackground = computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                                 computedStyle.backgroundColor !== 'transparent';
    
    // Check for Grok branding colors or distinctive styling
    const hasGrokColors = computedStyle.backgroundColor.includes('rgb(') && 
                         (computedStyle.color.includes('rgb(') || 
                          element.querySelector('[style*="color"]') !== null);

    return hasDistinctBackground && hasGrokColors;
  }

  /**
   * Extracts text content from a message element using Grok-specific patterns
   */
  private extractMessageContent(element: Element): string {
    // Try primary content selectors
    const contentElement = element.querySelector(
      this.config.primarySelectors.messageContent
    );
    if (contentElement) {
      return this.cleanTextContent(contentElement.textContent || '');
    }

    // Extract text while excluding div elements (UI components pattern from research)
    let text = '';
    element.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE && 
                node.nodeName.toLowerCase() !== 'div') {
        text += node.textContent;
      }
    });

    if (text.trim()) {
      return this.cleanTextContent(text);
    }

    // Try fallback content selectors
    const fallbackContentElement = element.querySelector(
      this.config.fallbackSelectors.messageContent
    );
    if (fallbackContentElement) {
      return this.cleanTextContent(fallbackContentElement.textContent || '');
    }

    // Final fallback: Use element's full text content
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

    // Look for X.com/Twitter-specific time formats
    const timeText = element.querySelector('[data-testid="Time"]')?.textContent;
    if (timeText) {
      const parsed = Date.parse(timeText);
      if (!isNaN(parsed)) {
        return new Date(parsed);
      }
    }

    // Look for timestamp data attributes
    const timestamp = element.getAttribute('data-timestamp') ||
                     element.getAttribute('data-time');
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
   * Checks for legitimate Grok indicators on the page
   */
  private hasLegitimateGrokIndicators(): boolean {
    // Strong indicators of Grok presence
    const hasGrokElements = document.querySelector('[data-testid*="grok"], [class*="grok"], .message-bubble') !== null;
    const hasGrokBranding = document.querySelector('[aria-label*="Grok"], [alt*="Grok"]') !== null;
    
    // Only check for @grok mentions in the body content, not the entire document
    // This prevents false positives from page titles or meta tags
    const bodyTextContent = document.body?.textContent || '';
    const hasGrokMentions = bodyTextContent.includes('@grok');
    
    // Require strong evidence of Grok conversation, not just the word "grok"
    return hasGrokElements || hasGrokBranding || hasGrokMentions;
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
    return `grok-conversation-${this.simpleHash(contextString)}`;
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
   * Cleanup method to remove observers, timers, and cached data
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

    if (this.urlChangeObserver) {
      clearInterval(this.urlChangeObserver);
      this.urlChangeObserver = null;
    }

    this.messageCache.clear();
  }
}