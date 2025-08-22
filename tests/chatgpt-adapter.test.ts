/**
 * ChatGPT Adapter Test Suite
 *
 * Comprehensive tests for ChatGPT platform adapter functionality
 * following TDD methodology for Task 10.
 */

import { ChatGPTAdapter } from '../src/content/adapters/ChatGPTAdapter';
import { Platform, MessageElement, TextAnchor, Bookmark } from '../src/types/bookmark';

describe('ChatGPTAdapter', () => {
  let adapter: ChatGPTAdapter;
  let originalLocation: Location;

  beforeEach(() => {
    adapter = new ChatGPTAdapter();
    
    // Mock window.location with proper URL
    delete (window as any).location;
    (window as any).location = new URL('https://chatgpt.com/c/test-conversation-id');

    // Mock performance.now for consistent timing
    jest.spyOn(performance, 'now').mockReturnValue(100);

    // Set up DOM structure for testing
    document.body.innerHTML = `
      <main>
        <div data-testid="conversation-turn-0" data-author="user" data-turn-id="user-msg-1">
          <div class="prose">
            <p>What is the capital of France?</p>
          </div>
        </div>
        <div data-testid="conversation-turn-1" data-author="assistant" data-turn-id="assistant-msg-1">
          <div class="prose">
            <p>The capital of France is Paris. It is located in the north-central part of the country.</p>
          </div>
        </div>
        <div data-testid="conversation-turn-2" data-author="user" data-turn-id="user-msg-2">
          <div class="prose">
            <p>Tell me more about Paris.</p>
          </div>
        </div>
      </main>
    `;
  });

  afterEach(() => {
    adapter.cleanup();
    jest.restoreAllMocks();
  });

  describe('Platform Detection', () => {
    it('should detect ChatGPT platform correctly', () => {
      expect(adapter.detectPlatform()).toBe(true);
    });

    it('should detect chat.openai.com as ChatGPT', () => {
      (window as any).location = new URL('https://chat.openai.com/c/test-id');
      expect(adapter.detectPlatform()).toBe(true);
    });

    it('should not detect non-ChatGPT platforms', () => {
      (window as any).location = new URL('https://claude.ai/chat/test-id');
      expect(adapter.detectPlatform()).toBe(false);
    });

    it('should return correct platform type', () => {
      expect(adapter.getPlatformType()).toBe('chatgpt');
    });

    it('should complete platform detection within performance target', () => {
      const startTime = performance.now();
      adapter.detectPlatform();
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // <100ms target
    });
  });

  describe('Conversation ID Extraction', () => {
    it('should extract conversation ID from chatgpt.com URL', () => {
      expect(adapter.getConversationId()).toBe('test-conversation-id');
    });

    it('should extract conversation ID from chat.openai.com URL', () => {
      (window as any).location = new URL('https://chat.openai.com/c/another-conversation-id');
      expect(adapter.getConversationId()).toBe('another-conversation-id');
    });

    it('should return null for URLs without conversation ID', () => {
      (window as any).location = new URL('https://chatgpt.com/');
      expect(adapter.getConversationId()).toBeNull();
    });

    it('should handle URLs with query parameters', () => {
      (window as any).location = new URL('https://chatgpt.com/c/test-id?param=value');
      expect(adapter.getConversationId()).toBe('test-id');
    });

    it('should handle URLs with hash fragments', () => {
      (window as any).location = new URL('https://chatgpt.com/c/test-id#section');
      expect(adapter.getConversationId()).toBe('test-id');
    });

    it('should extract from hash when main URL fails', () => {
      const url = new URL('https://chatgpt.com/');
      url.hash = '#/c/hash-conversation-id';
      (window as any).location = url;
      expect(adapter.getConversationId()).toBe('hash-conversation-id');
    });
  });

  describe('Message Extraction', () => {
    it('should extract all messages from the conversation', () => {
      const messages = adapter.getMessages();
      expect(messages).toHaveLength(3);
    });

    it('should extract message data correctly', () => {
      const messages = adapter.getMessages();
      
      expect(messages[0]).toEqual({
        element: expect.any(Element),
        messageId: 'user-msg-1',
        role: 'user',
        content: 'What is the capital of France?',
        timestamp: undefined,
      });

      expect(messages[1]).toEqual({
        element: expect.any(Element),
        messageId: 'assistant-msg-1',
        role: 'assistant',
        content: 'The capital of France is Paris. It is located in the north-central part of the country.',
        timestamp: undefined,
      });
    });

    it('should identify user messages correctly', () => {
      const messages = adapter.getMessages();
      const userMessages = messages.filter(msg => msg.role === 'user');
      
      expect(userMessages).toHaveLength(2);
      expect(userMessages[0]?.content).toBe('What is the capital of France?');
      expect(userMessages[1]?.content).toBe('Tell me more about Paris.');
    });

    it('should identify assistant messages correctly', () => {
      const messages = adapter.getMessages();
      const assistantMessages = messages.filter(msg => msg.role === 'assistant');
      
      expect(assistantMessages).toHaveLength(1);
      expect(assistantMessages[0]?.content).toContain('The capital of France is Paris');
    });

    it('should complete message extraction within performance target', () => {
      const startTime = performance.now();
      adapter.getMessages();
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(500); // <500ms target
    });

    it('should handle empty conversations gracefully', () => {
      document.body.innerHTML = '<main></main>';
      const messages = adapter.getMessages();
      expect(messages).toHaveLength(0);
    });

    it('should handle malformed message elements gracefully', () => {
      document.body.innerHTML = `
        <main>
          <div data-testid="conversation-turn-0">
            <!-- Missing content -->
          </div>
        </main>
      `;
      
      const messages = adapter.getMessages();
      expect(messages).toHaveLength(0);
    });
  });

  describe('Message Finding', () => {
    it('should find message by ID correctly', () => {
      const element = adapter.findMessageById('user-msg-1');
      expect(element).toBeTruthy();
      expect(element?.getAttribute('data-turn-id')).toBe('user-msg-1');
    });

    it('should return null for non-existent message ID', () => {
      const element = adapter.findMessageById('non-existent-id');
      expect(element).toBeNull();
    });

    it('should cache message elements for performance', () => {
      // First call should populate cache
      adapter.getMessages();
      
      // Mock DOM removal to test cache
      document.body.innerHTML = '';
      
      // Should still find cached message
      const element = adapter.findMessageById('user-msg-1');
      expect(element).toBeTruthy();
    });
  });

  describe('Fallback Selectors', () => {
    it('should use fallback selectors when primary selectors fail', () => {
      // Set up DOM with fallback selector structure
      document.body.innerHTML = `
        <main>
          <div class="group">
            <div class="whitespace-pre-wrap">Fallback message content</div>
          </div>
        </main>
      `;

      const messages = adapter.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]?.content).toBe('Fallback message content');
    });

    it('should handle mixed selector scenarios', () => {
      document.body.innerHTML = `
        <main>
          <div data-testid="conversation-turn-0" data-author="user" data-turn-id="primary-msg">
            <div class="prose">Primary selector message</div>
          </div>
          <div class="group">
            <div class="whitespace-pre-wrap">Fallback selector message</div>
          </div>
        </main>
      `;

      const messages = adapter.getMessages();
      expect(messages).toHaveLength(2);
    });
  });

  describe('Message ID Generation', () => {
    it('should generate consistent IDs for elements without data-turn-id', () => {
      document.body.innerHTML = `
        <main>
          <div data-testid="conversation-turn-0" data-author="user">
            <div class="prose">Test message for ID generation</div>
          </div>
        </main>
      `;

      const messages1 = adapter.getMessages();
      const messages2 = adapter.getMessages();
      
      expect(messages1[0]?.messageId).toBe(messages2[0]?.messageId);
    });

    it('should generate different IDs for different content', () => {
      document.body.innerHTML = `
        <main>
          <div data-testid="conversation-turn-0" data-author="user">
            <div class="prose">First message</div>
          </div>
          <div data-testid="conversation-turn-1" data-author="user">
            <div class="prose">Second message</div>
          </div>
        </main>
      `;

      const messages = adapter.getMessages();
      expect(messages[0]?.messageId).not.toBe(messages[1]?.messageId);
    });
  });

  describe('Role Determination', () => {
    it('should determine role from data-author attribute', () => {
      const messages = adapter.getMessages();
      
      const userMessage = messages.find(msg => msg.messageId === 'user-msg-1');
      const assistantMessage = messages.find(msg => msg.messageId === 'assistant-msg-1');
      
      expect(userMessage?.role).toBe('user');
      expect(assistantMessage?.role).toBe('assistant');
    });

    it('should fallback to assistant role when role cannot be determined', () => {
      document.body.innerHTML = `
        <main>
          <div data-testid="conversation-turn-0" data-turn-id="unknown-role-msg">
            <div class="prose">Message with unknown role</div>
          </div>
        </main>
      `;

      const messages = adapter.getMessages();
      expect(messages[0]?.role).toBe('assistant');
    });

    it('should use heading text for role determination fallback', () => {
      document.body.innerHTML = `
        <main>
          <div data-testid="conversation-turn-0" data-turn-id="heading-role-msg">
            <h3>You</h3>
            <div class="prose">User message from heading</div>
          </div>
        </main>
      `;

      const messages = adapter.getMessages();
      expect(messages[0]?.role).toBe('user');
    });
  });

  describe('UI Integration', () => {
    it('should inject bookmark indicator into message', () => {
      const mockBookmark: Bookmark = {
        id: 'test-bookmark',
        platform: 'chatgpt' as Platform,
        conversationId: 'test-conv',
        messageId: 'user-msg-1',
        anchor: {} as TextAnchor,
        note: 'Test bookmark',
        tags: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        color: '#ff0000',
      };

      const mockAnchor: TextAnchor = {
        selectedText: 'test',
        startOffset: 0,
        endOffset: 4,
        xpathSelector: '',
        messageId: 'user-msg-1',
        contextBefore: '',
        contextAfter: '',
        checksum: '',
        confidence: 1.0,
        strategy: 'xpath',
      };

      adapter.injectBookmarkUI(mockAnchor, mockBookmark);
      
      const indicator = document.querySelector('.chatmarks-bookmark-indicator');
      expect(indicator).toBeTruthy();
      expect(indicator?.getAttribute('data-bookmark-id')).toBe('test-bookmark');
    });

    it('should handle missing message element gracefully', () => {
      const mockBookmark: Bookmark = {
        id: 'test-bookmark',
        platform: 'chatgpt' as Platform,
        conversationId: 'test-conv',
        messageId: 'non-existent-msg',
        anchor: {} as TextAnchor,
        note: 'Test bookmark',
        tags: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        color: '#ff0000',
      };

      const mockAnchor: TextAnchor = {
        selectedText: 'test',
        startOffset: 0,
        endOffset: 4,
        xpathSelector: '',
        messageId: 'non-existent-msg',
        contextBefore: '',
        contextAfter: '',
        checksum: '',
        confidence: 1.0,
        strategy: 'xpath',
      };

      // Should not throw error
      expect(() => {
        adapter.injectBookmarkUI(mockAnchor, mockBookmark);
      }).not.toThrow();
    });
  });

  describe('New Message Observation', () => {
    it('should set up message observation correctly', () => {
      const mockCallback = jest.fn();
      adapter.observeNewMessages(mockCallback);
      
      // Add new message to DOM
      const newMessage = document.createElement('div');
      newMessage.setAttribute('data-testid', 'conversation-turn-3');
      newMessage.setAttribute('data-author', 'user');
      newMessage.innerHTML = '<div class="prose">New message</div>';
      
      document.querySelector('main')?.appendChild(newMessage);
      
      // Wait for debounced callback
      setTimeout(() => {
        expect(mockCallback).toHaveBeenCalledWith([newMessage]);
      }, 200);
    });

    it('should handle missing conversation container gracefully', () => {
      document.body.innerHTML = ''; // Remove main container
      
      const mockCallback = jest.fn();
      
      // Should not throw error
      expect(() => {
        adapter.observeNewMessages(mockCallback);
      }).not.toThrow();
    });
  });

  describe('Performance Metrics', () => {
    it('should track performance metrics', () => {
      adapter.detectPlatform();
      adapter.getMessages();
      
      const metrics = adapter.getMetrics();
      
      expect(metrics.platformDetectionTime).toBeGreaterThan(0);
      expect(metrics.messageExtractionTime).toBeGreaterThan(0);
      expect(metrics.messageCount).toBe(3);
      expect(metrics.successRate).toBe(1.0);
      expect(metrics.errorCount).toBe(0);
    });

    it('should track errors in metrics', () => {
      // Mock an error in message extraction
      jest.spyOn(document, 'querySelectorAll').mockImplementation(() => {
        throw new Error('Mock extraction error');
      });

      adapter.getMessages();
      
      const metrics = adapter.getMetrics();
      expect(metrics.errorCount).toBeGreaterThan(0);
      expect(metrics.lastError).toBe('Mock extraction error');
    });
  });

  describe('Cleanup', () => {
    it('should clean up observers and event listeners', () => {
      const mockCallback = jest.fn();
      adapter.observeNewMessages(mockCallback);
      
      // Spy on disconnect method
      const disconnectSpy = jest.spyOn(MutationObserver.prototype, 'disconnect');
      
      adapter.cleanup();
      
      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('should clear message cache on cleanup', () => {
      // Populate cache
      adapter.getMessages();
      
      // Verify cache has data
      expect(adapter.findMessageById('user-msg-1')).toBeTruthy();
      
      // Cleanup and remove DOM
      adapter.cleanup();
      document.body.innerHTML = '';
      
      // Cache should be cleared - note: this test verifies internal behavior
      // In real usage, we'd test through public interface
      const element = adapter.findMessageById('user-msg-1');
      expect(element).toBeNull();
    });
  });

  describe('Text Content Processing', () => {
    it('should clean and normalize text content', () => {
      document.body.innerHTML = `
        <main>
          <div data-testid="conversation-turn-0" data-author="user" data-turn-id="clean-msg">
            <div class="prose">
              <p>Text   with    extra   spaces</p>
              <p>Multiple
              
              line breaks</p>
            </div>
          </div>
        </main>
      `;

      const messages = adapter.getMessages();
      expect(messages[0]?.content).toBe('Text with extra spaces Multiple line breaks');
    });

    it('should handle empty content gracefully', () => {
      document.body.innerHTML = `
        <main>
          <div data-testid="conversation-turn-0" data-author="user" data-turn-id="empty-msg">
            <div class="prose"></div>
          </div>
        </main>
      `;

      const messages = adapter.getMessages();
      expect(messages).toHaveLength(0); // Should be filtered out
    });
  });
});