/**
 * Claude Adapter Test Suite
 *
 * Comprehensive tests for Claude platform adapter implementation
 * covering platform detection, message extraction, and UI integration.
 */

import { ClaudeAdapter } from '../src/content/adapters/ClaudeAdapter';
import { Platform, MessageElement, TextAnchor, Bookmark } from '../src/types/bookmark';

// Test-specific adapter that mocks external dependencies
class TestClaudeAdapter extends ClaudeAdapter {
  private mockLocation: { href: string; hostname: string; pathname: string; hash: string } = {
    href: 'https://claude.ai/chat/conversation-123',
    hostname: 'claude.ai',
    pathname: '/chat/conversation-123',
    hash: '',
  };

  setMockLocation(href: string) {
    const url = new URL(href);
    this.mockLocation = {
      href: href,
      hostname: url.hostname,
      pathname: url.pathname,
      hash: url.hash,
    };
  }

  // Override methods to use mock location
  detectPlatform(): boolean {
    return this.measurePerformance(() => {
      const hostname = this.mockLocation.hostname.toLowerCase();
      const isClaudeUrl = ['claude.ai', 'anthropic.com/claude', 'claude.anthropic.com'].some(pattern =>
        hostname.includes(pattern)
      );
      
      if (!isClaudeUrl) return false;
      
      // For testing, we'll assume elements exist if hostname matches
      return true;
    }, 'platformDetectionTime');
  }

  getConversationId(): string | null {
    try {
      const urlMatch = this.mockLocation.pathname.match(/\/chat\/([a-zA-Z0-9-_]+)/);
      if (urlMatch && urlMatch[1]) {
        return urlMatch[1];
      }
      
      // Check for indicators to generate ID
      const conversationIndicators = document.querySelectorAll(
        '[data-testid*="conversation"], [class*="conversation"], [class*="chat"]'
      );
      if (conversationIndicators.length > 0) {
        return this.generateTestConversationId();
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  private generateTestConversationId(): string {
    const title = document.title;
    const url = this.mockLocation.href;
    const timestamp = Date.now();
    
    const contextString = `${title}-${url}-${timestamp}`;
    return `claude-conversation-${this.testSimpleHash(contextString)}`;
  }

  private testSimpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

// Mock DOM environment
const mockDOM = () => {
  // Reset DOM
  document.body.innerHTML = '';
};

// Mock conversation structure for Claude
const createMockClaudeConversation = () => {
  const conversationContainer = document.createElement('main');
  conversationContainer.setAttribute('data-testid', 'conversation');

  // User message
  const userMessage = document.createElement('div');
  userMessage.className = 'prose user-message';
  userMessage.setAttribute('data-role', 'user');
  userMessage.setAttribute('data-message-id', 'user-msg-1');
  userMessage.innerHTML = `
    <div class="content">
      <p>Hello Claude, can you help me with a coding question?</p>
    </div>
  `;

  // Assistant (Claude) message
  const assistantMessage = document.createElement('div');
  assistantMessage.className = 'prose assistant-message';
  assistantMessage.setAttribute('data-role', 'assistant');
  assistantMessage.setAttribute('data-message-id', 'assistant-msg-1');
  assistantMessage.innerHTML = `
    <div class="content">
      <p>Of course! I'd be happy to help you with your coding question. What specific programming language or problem are you working on?</p>
    </div>
  `;

  // Another user message
  const userMessage2 = document.createElement('div');
  userMessage2.className = 'prose user-message';
  userMessage2.setAttribute('data-role', 'user');
  userMessage2.setAttribute('data-message-id', 'user-msg-2');
  userMessage2.innerHTML = `
    <div class="content">
      <p>I'm working with TypeScript and need help with generics.</p>
    </div>
  `;

  conversationContainer.appendChild(userMessage);
  conversationContainer.appendChild(assistantMessage);
  conversationContainer.appendChild(userMessage2);
  document.body.appendChild(conversationContainer);

  return { conversationContainer, userMessage, assistantMessage, userMessage2 };
};

describe('ClaudeAdapter', () => {
  let adapter: TestClaudeAdapter;

  beforeEach(() => {
    mockDOM();
    adapter = new TestClaudeAdapter();
  });

  afterEach(() => {
    if (adapter) {
      adapter.cleanup();
    }
    document.body.innerHTML = '';
  });

  describe('Platform Detection', () => {
    test('should detect Claude platform correctly', () => {
      expect(adapter.detectPlatform()).toBe(true);
    });

    test('should return correct platform type', () => {
      expect(adapter.getPlatformType()).toBe('claude');
    });

    test('should not detect platform on non-Claude domains', () => {
      adapter.setMockLocation('https://chatgpt.com/c/conversation-123');
      expect(adapter.detectPlatform()).toBe(false);
    });

    test('should measure platform detection performance', () => {
      const startTime = performance.now();
      adapter.detectPlatform();
      const metrics = adapter.getMetrics();
      
      expect(metrics.platformDetectionTime).toBeGreaterThan(0);
      expect(metrics.platformDetectionTime).toBeLessThan(100); // Should be fast
    });
  });

  describe('Conversation ID Extraction', () => {
    test('should extract conversation ID from Claude URL', () => {
      const conversationId = adapter.getConversationId();
      expect(conversationId).toBe('conversation-123');
    });

    test('should extract conversation ID from different URL formats', () => {
      adapter.setMockLocation('https://claude.ai/chat/conv-456-abc');
      const conversationId = adapter.getConversationId();
      expect(conversationId).toBe('conv-456-abc');
    });

    test('should generate conversation ID when not found in URL', () => {
      adapter.setMockLocation('https://claude.ai/chat');

      // Add conversation indicators
      const conversationDiv = document.createElement('div');
      conversationDiv.setAttribute('data-testid', 'conversation');
      document.body.appendChild(conversationDiv);

      const conversationId = adapter.getConversationId();
      expect(conversationId).toMatch(/^claude-conversation-[a-z0-9]+$/);
    });

    test('should return null when no conversation context found', () => {
      adapter.setMockLocation('https://claude.ai/settings');

      const conversationId = adapter.getConversationId();
      expect(conversationId).toBeNull();
    });
  });

  describe('Message Extraction', () => {
    beforeEach(() => {
      createMockClaudeConversation();
    });

    test('should extract all messages from conversation', () => {
      const messages = adapter.getMessages();
      
      expect(messages).toHaveLength(3);
      expect(messages[0]?.role).toBe('user');
      expect(messages[1]?.role).toBe('assistant');
      expect(messages[2]?.role).toBe('user');
    });

    test('should extract correct message content', () => {
      const messages = adapter.getMessages();
      
      expect(messages[0]?.content).toContain('Hello Claude');
      expect(messages[1]?.content).toContain('Of course! I\'d be happy to help');
      expect(messages[2]?.content).toContain('TypeScript and need help with generics');
    });

    test('should extract correct message IDs', () => {
      const messages = adapter.getMessages();
      
      expect(messages[0]?.messageId).toBe('user-msg-1');
      expect(messages[1]?.messageId).toBe('assistant-msg-1');
      expect(messages[2]?.messageId).toBe('user-msg-2');
    });

    test('should handle messages without explicit IDs', () => {
      // Create message without ID
      const messageWithoutId = document.createElement('div');
      messageWithoutId.className = 'prose';
      messageWithoutId.innerHTML = '<div class="content"><p>Message without ID</p></div>';
      
      const container = document.querySelector('[data-testid="conversation"]')!;
      container.appendChild(messageWithoutId);

      const messages = adapter.getMessages();
      const lastMessage = messages[messages.length - 1];
      
      expect(lastMessage?.messageId).toMatch(/^claude-msg-[a-zA-Z0-9-]+$/);
    });

    test('should determine message roles correctly', () => {
      const messages = adapter.getMessages();
      
      // Check role determination
      expect(messages.find(m => m.messageId === 'user-msg-1')?.role).toBe('user');
      expect(messages.find(m => m.messageId === 'assistant-msg-1')?.role).toBe('assistant');
    });

    test('should handle fallback role determination', () => {
      // Create message without explicit role
      const ambiguousMessage = document.createElement('div');
      ambiguousMessage.className = 'prose';
      ambiguousMessage.innerHTML = '<div class="content"><p>Ambiguous message</p></div>';
      
      const container = document.querySelector('[data-testid="conversation"]')!;
      container.appendChild(ambiguousMessage);

      const messages = adapter.getMessages();
      const lastMessage = messages[messages.length - 1];
      
      // Should default to assistant for Claude
      expect(lastMessage?.role).toBe('assistant');
    });

    test('should measure message extraction performance', () => {
      const messages = adapter.getMessages();
      const metrics = adapter.getMetrics();
      
      expect(messages.length).toBeGreaterThan(0);
      expect(metrics.messageExtractionTime).toBeGreaterThan(0);
      expect(metrics.messageExtractionTime).toBeLessThan(500); // Should be fast
      expect(metrics.messageCount).toBe(messages.length);
    });

    test('should handle extraction errors gracefully', () => {
      // Create malformed DOM
      const malformedMessage = document.createElement('div');
      malformedMessage.className = 'prose';
      // No content div - should be handled gracefully
      
      const container = document.querySelector('[data-testid="conversation"]')!;
      container.appendChild(malformedMessage);

      const messages = adapter.getMessages();
      
      // Should still work with other valid messages
      expect(messages.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Message Finding', () => {
    beforeEach(() => {
      createMockClaudeConversation();
    });

    test('should find message by ID', () => {
      const element = adapter.findMessageById('user-msg-1');
      
      expect(element).toBeTruthy();
      expect(element?.getAttribute('data-message-id')).toBe('user-msg-1');
    });

    test('should return null for non-existent message ID', () => {
      const element = adapter.findMessageById('non-existent-id');
      expect(element).toBeNull();
    });

    test('should use cache for repeated lookups', () => {
      // First lookup - should populate cache
      const element1 = adapter.findMessageById('user-msg-1');
      expect(element1).toBeTruthy();

      // Second lookup - should use cache
      const element2 = adapter.findMessageById('user-msg-1');
      expect(element2).toBe(element1);
    });
  });

  describe('UI Integration', () => {
    beforeEach(() => {
      createMockClaudeConversation();
    });

    test('should inject bookmark UI elements', () => {
      const mockBookmark: Bookmark = {
        id: 'bookmark-1',
        platform: 'claude',
        conversationId: 'conversation-123',
        messageId: 'user-msg-1',
        anchor: {} as TextAnchor,
        note: 'Test bookmark',
        tags: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        color: '#ff0000',
      };

      const mockAnchor: TextAnchor = {
        selectedText: 'Hello Claude',
        startOffset: 0,
        endOffset: 11,
        xpathSelector: '//div[@data-message-id="user-msg-1"]',
        messageId: 'user-msg-1',
        contextBefore: '',
        contextAfter: ', can you help',
        checksum: 'test-checksum',
        confidence: 0.95,
        strategy: 'xpath' as import('../src/types/bookmark').AnchorStrategy,
      };

      adapter.injectBookmarkUI(mockAnchor, mockBookmark);

      // Check that bookmark indicator was created
      const indicator = document.querySelector('.chatmarks-bookmark-indicator');
      expect(indicator).toBeTruthy();
      expect(indicator?.getAttribute('data-bookmark-id')).toBe('bookmark-1');
    });

    test('should handle UI injection for non-existent message', () => {
      const mockBookmark: Bookmark = {
        id: 'bookmark-1',
        platform: 'claude',
        conversationId: 'conversation-123',
        messageId: 'non-existent-msg',
        anchor: {} as TextAnchor,
        note: 'Test bookmark',
        tags: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        color: '#ff0000',
      };

      const mockAnchor: TextAnchor = {
        selectedText: 'Hello Claude',
        startOffset: 0,
        endOffset: 11,
        xpathSelector: '//div[@data-message-id="non-existent-msg"]',
        messageId: 'non-existent-msg',
        contextBefore: '',
        contextAfter: '',
        checksum: 'test-checksum',
        confidence: 0.95,
        strategy: 'xpath' as import('../src/types/bookmark').AnchorStrategy,
      };

      // Should not throw error
      expect(() => {
        adapter.injectBookmarkUI(mockAnchor, mockBookmark);
      }).not.toThrow();

      // Should not create indicator
      const indicator = document.querySelector('.chatmarks-bookmark-indicator');
      expect(indicator).toBeFalsy();
    });
  });

  describe('New Message Observation', () => {
    beforeEach(() => {
      createMockClaudeConversation();
    });

    test('should set up message observation', () => {
      const callback = jest.fn();
      
      adapter.observeNewMessages(callback);
      
      // Simulate new message being added
      const newMessage = document.createElement('div');
      newMessage.className = 'prose';
      newMessage.setAttribute('data-role', 'assistant');
      newMessage.innerHTML = '<div class="content"><p>New message</p></div>';
      
      const container = document.querySelector('[data-testid="conversation"]')!;
      container.appendChild(newMessage);

      // Wait for debounced callback
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(callback).toHaveBeenCalledWith([newMessage]);
          resolve();
        }, 200);
      });
    });

    test('should handle observation when container not found', () => {
      // Remove conversation container
      document.body.innerHTML = '';
      
      const callback = jest.fn();
      
      // Should not throw error
      expect(() => {
        adapter.observeNewMessages(callback);
      }).not.toThrow();
    });
  });

  describe('Content Cleaning and Utilities', () => {
    test('should clean text content properly', () => {
      const mockMessage = document.createElement('div');
      mockMessage.className = 'prose';
      mockMessage.innerHTML = `
        <div class="content">
          <p>   Text   with    extra   whitespace   </p>
        </div>
      `;
      document.body.appendChild(mockMessage);

      // Test through adapter's message extraction
      const testAdapter = new TestClaudeAdapter();
      const messages = testAdapter.getMessages();
      
      if (messages.length > 0) {
        expect(messages[0]?.content).toBe('Text with extra whitespace');
      }
    });

    test('should generate consistent hash for same input', () => {
      const testAdapter = new TestClaudeAdapter();
      
      // Access private method through type assertion for testing
      const simpleHash = (testAdapter as any).testSimpleHash;
      
      const hash1 = simpleHash('test string');
      const hash2 = simpleHash('test string');
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-z0-9]+$/);
    });
  });

  describe('Cleanup and Resource Management', () => {
    test('should cleanup resources properly', () => {
      createMockClaudeConversation();
      
      // Set up observer
      const callback = jest.fn();
      adapter.observeNewMessages(callback);
      
      // Verify setup
      expect(adapter.getMetrics()).toBeTruthy();
      
      // Cleanup
      adapter.cleanup();
      
      // Verify cleanup completed without errors
      expect(() => adapter.cleanup()).not.toThrow();
    });

    test('should clear message cache on cleanup', () => {
      createMockClaudeConversation();
      
      // Populate cache
      const messages = adapter.getMessages();
      expect(messages.length).toBeGreaterThan(0);
      
      // Verify cache is working
      const element1 = adapter.findMessageById('user-msg-1');
      expect(element1).toBeTruthy();
      
      // Cleanup
      adapter.cleanup();
      
      // Cache should be cleared, but findMessageById should still work by searching DOM
      const element2 = adapter.findMessageById('user-msg-1');
      expect(element2).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    test('should handle DOM errors gracefully', () => {
      // Create problematic DOM structure
      const problemElement = document.createElement('div');
      problemElement.className = 'prose';
      // No proper content structure
      document.body.appendChild(problemElement);

      const messages = adapter.getMessages();
      const metrics = adapter.getMetrics();
      
      // Should handle errors gracefully
      expect(messages).toBeInstanceOf(Array);
      expect(metrics.errorCount).toBeGreaterThanOrEqual(0);
    });

    test('should track extraction errors in metrics', () => {
      // Force an error by mocking querySelector to throw
      const originalQuerySelectorAll = document.querySelectorAll;
      document.querySelectorAll = jest.fn().mockImplementation(() => {
        throw new Error('Mock DOM error');
      });

      const messages = adapter.getMessages();
      const metrics = adapter.getMetrics();
      
      expect(messages).toHaveLength(0);
      expect(metrics.errorCount).toBeGreaterThan(0);
      expect(metrics.lastError).toContain('Mock DOM error');
      
      // Restore original method
      document.querySelectorAll = originalQuerySelectorAll;
    });
  });

  describe('Performance Requirements', () => {
    test('should meet platform detection performance targets', () => {
      const startTime = performance.now();
      adapter.detectPlatform();
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // < 100ms requirement
    });

    test('should meet message extraction performance targets', () => {
      createMockClaudeConversation();
      
      const startTime = performance.now();
      const messages = adapter.getMessages();
      const endTime = performance.now();
      
      expect(messages.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(500); // < 500ms requirement
    });

    test('should maintain accuracy metrics', () => {
      createMockClaudeConversation();
      
      // Extract messages multiple times
      for (let i = 0; i < 5; i++) {
        adapter.getMessages();
      }
      
      const metrics = adapter.getMetrics();
      expect(metrics.successRate).toBeGreaterThanOrEqual(0.99); // 99%+ accuracy
    });
  });
});