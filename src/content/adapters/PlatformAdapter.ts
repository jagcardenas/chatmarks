/**
 * Platform Adapter Interface
 *
 * Defines the contract that all platform-specific adapters must implement
 * to provide consistent bookmark functionality across ChatGPT, Claude, and Grok.
 */

import { Platform, MessageElement, TextAnchor, Bookmark } from '../../types/bookmark';

/**
 * Platform adapter interface for AI conversation platforms
 */
export interface PlatformAdapter {
  /**
   * Detects if the current page belongs to this platform
   */
  detectPlatform(): boolean;

  /**
   * Extracts the current conversation ID from the page
   */
  getConversationId(): string | null;

  /**
   * Retrieves all message elements from the current conversation
   */
  getMessages(): MessageElement[];

  /**
   * Finds a specific message element by its ID
   */
  findMessageById(messageId: string): Element | null;

  /**
   * Injects bookmark UI elements into the platform interface
   */
  injectBookmarkUI(anchor: TextAnchor, bookmark: Bookmark): void;

  /**
   * Sets up observation for new messages appearing in the conversation
   */
  observeNewMessages(callback: (messages: Element[]) => void): void;

  /**
   * Cleanup method to remove observers and event listeners
   */
  cleanup(): void;

  /**
   * Gets the platform type this adapter handles
   */
  getPlatformType(): Platform;
}

/**
 * Configuration interface for platform adapters
 */
export interface PlatformAdapterConfig {
  /**
   * Platform type this adapter handles
   */
  platform: Platform;

  /**
   * Primary CSS selectors for reliable element identification
   */
  primarySelectors: {
    messageContainer: string;
    messageContent: string;
    userMessage: string;
    assistantMessage: string;
    conversationContainer: string;
  };

  /**
   * Fallback selectors in case primary selectors fail
   */
  fallbackSelectors: {
    messageContainer: string;
    messageContent: string;
    conversationContainer: string;
  };

  /**
   * URL patterns for platform detection
   */
  urlPatterns: string[];

  /**
   * Performance thresholds for this platform
   */
  performance: {
    detectionTimeout: number;
    extractionTimeout: number;
    observerDebounce: number;
  };
}

/**
 * Result interface for message extraction operations
 */
export interface MessageExtractionResult {
  success: boolean;
  messages: MessageElement[];
  error?: string;
  extractionTime: number;
}

/**
 * Performance metrics for platform adapter operations
 */
export interface PlatformAdapterMetrics {
  platformDetectionTime: number;
  messageExtractionTime: number;
  messageCount: number;
  successRate: number;
  errorCount: number;
  lastError?: string;
}

/**
 * Base abstract class providing common functionality for platform adapters
 */
export abstract class BasePlatformAdapter implements PlatformAdapter {
  protected config: PlatformAdapterConfig;
  protected metrics: PlatformAdapterMetrics;
  protected observers: MutationObserver[] = [];
  protected eventListeners: Array<{
    target: EventTarget;
    type: string;
    listener: (event: Event) => void;
  }> = [];

  constructor(config: PlatformAdapterConfig) {
    this.config = config;
    this.metrics = {
      platformDetectionTime: 0,
      messageExtractionTime: 0,
      messageCount: 0,
      successRate: 1.0,
      errorCount: 0,
    };
  }

  abstract detectPlatform(): boolean;
  abstract getConversationId(): string | null;
  abstract getMessages(): MessageElement[];
  abstract findMessageById(messageId: string): Element | null;
  abstract injectBookmarkUI(anchor: TextAnchor, bookmark: Bookmark): void;
  abstract observeNewMessages(callback: (messages: Element[]) => void): void;

  /**
   * Gets the platform type this adapter handles
   */
  getPlatformType(): Platform {
    return this.config.platform;
  }

  /**
   * Gets current performance metrics
   */
  getMetrics(): PlatformAdapterMetrics {
    return { ...this.metrics };
  }

  /**
   * Helper method to add tracked event listeners
   */
  protected addEventListener(
    target: EventTarget,
    type: string,
    listener: (event: Event) => void,
    options?: boolean | AddEventListenerOptions
  ): void {
    target.addEventListener(type, listener, options);
    this.eventListeners.push({ target, type, listener });
  }

  /**
   * Helper method to create and track MutationObserver
   */
  protected createObserver(
    callback: (mutations: MutationRecord[], observer: MutationObserver) => void,
    _options?: MutationObserverInit
  ): MutationObserver {
    const observer = new MutationObserver(callback);
    this.observers.push(observer);
    return observer;
  }

  /**
   * Helper method to measure operation performance
   */
  protected measurePerformance<T>(
    operation: () => T,
    metricName: keyof PlatformAdapterMetrics
  ): T {
    const startTime = performance.now();
    try {
      const result = operation();
      const endTime = performance.now();
      
      if (typeof this.metrics[metricName] === 'number') {
        (this.metrics as unknown as Record<string, unknown>)[metricName] = endTime - startTime;
      }
      
      return result;
    } catch (error) {
      this.metrics.errorCount++;
      this.metrics.lastError = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  /**
   * Cleanup method to remove all observers and event listeners
   */
  cleanup(): void {
    // Disconnect all observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];

    // Remove all event listeners
    this.eventListeners.forEach(({ target, type, listener }) => {
      target.removeEventListener(type, listener);
    });
    this.eventListeners = [];
  }
}