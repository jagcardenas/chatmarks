/**
 * Platform Adapters Module Exports
 *
 * Provides centralized exports for all platform adapter implementations
 * and related types, interfaces, and utilities.
 */

// Core interfaces and base classes
export {
  PlatformAdapter,
  BasePlatformAdapter,
  PlatformAdapterConfig,
  MessageExtractionResult,
  PlatformAdapterMetrics,
} from './PlatformAdapter';

// Platform-specific implementations
export { ChatGPTAdapter } from './ChatGPTAdapter';
import { ChatGPTAdapter } from './ChatGPTAdapter';

// Re-export related types from bookmark types
export type {
  Platform,
  MessageElement,
  TextAnchor,
  Bookmark,
} from '../../types/bookmark';

/**
 * Factory function to create the appropriate platform adapter
 * based on the current page context
 */
export function createPlatformAdapter(): ChatGPTAdapter | null {
  const hostname = window.location.hostname;

  // ChatGPT detection
  if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
    return new ChatGPTAdapter();
  }

  // Claude detection (placeholder for future implementation)
  if (hostname.includes('claude.ai')) {
    // return new ClaudeAdapter();
    if (process.env.NODE_ENV === 'development') {
      console.warn('Claude adapter not yet implemented');
    }
    return null;
  }

  // Grok detection (placeholder for future implementation)
  if (hostname.includes('x.com') || hostname.includes('grok.x.ai')) {
    // return new GrokAdapter();
    if (process.env.NODE_ENV === 'development') {
      console.warn('Grok adapter not yet implemented');
    }
    return null;
  }

  // No supported platform detected
  return null;
}

/**
 * Utility function to detect the current platform without creating an adapter
 */
export function detectCurrentPlatform(): import('../../types/bookmark').Platform | null {
  const hostname = window.location.hostname;

  if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
    return 'chatgpt';
  }
  
  if (hostname.includes('claude.ai')) {
    return 'claude';
  }
  
  if (hostname.includes('x.com') || hostname.includes('grok.x.ai')) {
    return 'grok';
  }

  return null;
}

/**
 * Configuration constants for all platform adapters
 */
export const PLATFORM_CONFIGS = {
  chatgpt: {
    urlPatterns: ['chatgpt.com', 'chat.openai.com'],
    conversationUrlPattern: /(?:chatgpt\.com|chat\.openai\.com)\/c\/([^/?#]+)/,
    name: 'ChatGPT',
  },
  claude: {
    urlPatterns: ['claude.ai'],
    conversationUrlPattern: /claude\.ai\/chat\/([^/?#]+)/,
    name: 'Claude',
  },
  grok: {
    urlPatterns: ['x.com', 'grok.x.ai'],
    conversationUrlPattern: /(?:x\.com|grok\.x\.ai).*\/([^/?#]+)/,
    name: 'Grok',
  },
} as const;

/**
 * Performance thresholds for platform adapters
 */
export const PERFORMANCE_TARGETS = {
  platformDetection: 100, // ms
  messageExtraction: 500, // ms
  uiInjection: 50, // ms
  observerDebounce: 150, // ms
  minAccuracy: 0.99, // 99% success rate
} as const;

/**
 * Common CSS class names used across platform adapters
 */
export const ADAPTER_CSS_CLASSES = {
  bookmarkIndicator: 'chatmarks-bookmark-indicator',
  bookmarkHighlight: 'chatmarks-bookmark-highlight',
  bookmarkSidebar: 'chatmarks-bookmark-sidebar',
  extensionRoot: 'chatmarks-extension-root',
} as const;

/**
 * Utility type guards for platform detection
 */
export function isChatGPTPage(): boolean {
  const hostname = window.location.hostname;
  return hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com');
}

export function isClaudePage(): boolean {
  const hostname = window.location.hostname;
  return hostname.includes('claude.ai');
}

export function isGrokPage(): boolean {
  const hostname = window.location.hostname;
  return hostname.includes('x.com') || hostname.includes('grok.x.ai');
}

/**
 * Utility function to validate adapter configuration
 */
export function validateAdapterConfig(config: import('./PlatformAdapter').PlatformAdapterConfig): boolean {
  // Check required fields
  if (!config.platform || !config.primarySelectors || !config.fallbackSelectors) {
    return false;
  }

  // Check selector completeness
  const requiredSelectors = [
    'messageContainer',
    'messageContent',
    'userMessage',
    'assistantMessage',
    'conversationContainer',
  ];

  const hasAllPrimarySelectors = requiredSelectors.every(
    selector => selector in config.primarySelectors
  );

  const hasAllFallbackSelectors = [
    'messageContainer',
    'messageContent',
    'conversationContainer',
  ].every(selector => selector in config.fallbackSelectors);

  if (!hasAllPrimarySelectors || !hasAllFallbackSelectors) {
    return false;
  }

  // Check URL patterns
  if (!Array.isArray(config.urlPatterns) || config.urlPatterns.length === 0) {
    return false;
  }

  // Check performance thresholds
  if (!config.performance || 
      typeof config.performance.detectionTimeout !== 'number' ||
      typeof config.performance.extractionTimeout !== 'number' ||
      typeof config.performance.observerDebounce !== 'number') {
    return false;
  }

  return true;
}

/**
 * Debug utility to log adapter performance metrics
 */
export function logAdapterMetrics(adapter: import('./PlatformAdapter').PlatformAdapter): void {
  if (process.env.NODE_ENV === 'development') {
    const metrics = (adapter as unknown as { getMetrics?: () => any }).getMetrics?.();
    if (metrics) {
      // eslint-disable-next-line no-console
      console.group(`[Chatmarks] ${adapter.getPlatformType().toUpperCase()} Adapter Metrics`);
      // eslint-disable-next-line no-console
      console.log('Platform Detection Time:', `${metrics.platformDetectionTime.toFixed(2)}ms`);
      // eslint-disable-next-line no-console
      console.log('Message Extraction Time:', `${metrics.messageExtractionTime.toFixed(2)}ms`);
      // eslint-disable-next-line no-console
      console.log('Message Count:', metrics.messageCount);
      // eslint-disable-next-line no-console
      console.log('Success Rate:', `${(metrics.successRate * 100).toFixed(1)}%`);
      // eslint-disable-next-line no-console
      console.log('Error Count:', metrics.errorCount);
      if (metrics.lastError) {
        // eslint-disable-next-line no-console
        console.warn('Last Error:', metrics.lastError);
      }
      // eslint-disable-next-line no-console
      console.groupEnd();
    }
  }
}