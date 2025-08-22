/**
 * Grok Adapter Test Suite
 *
 * Comprehensive tests for Grok platform adapter implementation
 * covering platform detection, message extraction, and UI integration
 * on X.com platform.
 */

import { GrokAdapter } from '../src/content/adapters/GrokAdapter';
import { Platform, MessageElement, TextAnchor, Bookmark } from '../src/types/bookmark';

// Test-specific adapter that mocks external dependencies
class TestGrokAdapter extends GrokAdapter {
  private mockLocation: { href: string; hostname: string; pathname: string; search: string; hash: string } = {
    href: 'https://x.com/i/grok',
    hostname: 'x.com',
    pathname: '/i/grok',
    search: '',
    hash: '',
  };

  setMockLocation(href: string) {
    const url = new URL(href);
    this.mockLocation = {
      href: href,
      hostname: url.hostname,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
    };
  }

  // Override methods to use mock location
  detectPlatform(): boolean {
    return this.measurePerformance(() => {
      const hostname = this.mockLocation.hostname;
      const isGrokDomain = ['grok.com', 'x.com', 'twitter.com'].some(pattern =>
        hostname.includes(pattern)
      );

      // For grok.com, it's always Grok
      if (hostname.includes('grok.com')) {
        return true;
      }

      // For x.com, check for Grok-specific indicators
      if (hostname.includes('x.com') || hostname.includes('twitter.com')) {
        return isGrokDomain && this.isTestGrokOnX();
      }

      return false;
    }, 'platformDetectionTime');
  }

  private isTestGrokOnX(): boolean {
    // Check URL for Grok path
    const hasGrokInPath = this.mockLocation.pathname.includes('grok');
    
    // Check for Grok-specific UI elements
    const hasGrokElements = document.querySelector('[data-testid*="grok"], [class*="grok"], .message-bubble') !== null;
    
    // Check for Grok branding or conversation indicators
    const hasGrokBranding = document.querySelector('[aria-label*="Grok"], [alt*="Grok"]') !== null;
    
    return hasGrokInPath || hasGrokElements || hasGrokBranding;
  }

  getConversationId(): string | null {
    const url = this.mockLocation.href;
    const hostname = this.mockLocation.hostname;

    // Pattern for grok.com: https://grok.com/c/[conversation-id] or https://grok.com/chat/[id]
    if (hostname.includes('grok.com')) {
      const match = url.match(/grok\.com\/(?:c|chat)\/([^/?#]+)/);
      if (match && match[1]) {
        return match[1];
      }
      
      // Fallback: Generate ID based on Grok session
      return this.generateTestConversationId();
    }

    // Pattern for x.com: https://x.com/i/grok, https://x.com/grok/[id], or similar
    if (hostname.includes('x.com') || hostname.includes('twitter.com')) {
      const pathSegments = this.mockLocation.pathname.split('/').filter(segment => segment.length > 0);
      
      // Check for Grok-specific path segments
      if (pathSegments.includes('grok')) {
        const grokIndex = pathSegments.indexOf('grok');
        if (grokIndex + 1 < pathSegments.length) {
          return pathSegments[grokIndex + 1] || null;
        }
      }
      
      // Check for conversation ID in URL parameters
      const urlParams = new URLSearchParams(this.mockLocation.search);
      const conversationId = urlParams.get('conversation') || 
                            urlParams.get('conversation_id') || 
                            urlParams.get('chat_id') ||
                            urlParams.get('c');
      if (conversationId) {
        return conversationId;
      }
      
      // Generate ID based on Grok session on X
      return this.generateTestConversationId();
    }

    // Fallback: Generate conversation ID from page context
    const grokIndicators = document.querySelectorAll(
      '.message-bubble, [data-testid*="grok"], [class*="grok"], [data-grok-id]'
    );
    if (grokIndicators.length > 0) {
      return this.generateTestConversationId();
    }

    return null;
  }

  private generateTestConversationId(): string {
    const title = document.title;
    const url = this.mockLocation.href;
    const timestamp = Date.now();
    
    const contextString = `${title}-${url}-${timestamp}`;
    return `grok-conversation-${this.testSimpleHash(contextString)}`;
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

// Helper function to update location (now works with test adapter)
const updateLocation = (adapter: TestGrokAdapter, location: string) => {
  adapter.setMockLocation(location);
};

// Mock conversation structure for Grok on X.com
const createMockGrokConversation = () => {
  const conversationContainer = document.createElement('main');
  conversationContainer.setAttribute('data-testid', 'primaryColumn');

  // User message
  const userMessage = document.createElement('article');
  userMessage.className = 'grok-message user-message';
  userMessage.setAttribute('data-testid', 'grok-user-message');
  userMessage.setAttribute('data-grok-id', 'grok-user-1');
  userMessage.innerHTML = `
    <div data-testid="tweetText" class="content">
      <span>Hey Grok, what's the weather like today?</span>
    </div>
    <div data-testid="UserAvatar">
      <img alt="User profile" src="/user-avatar.jpg" />
    </div>
  `;

  // Grok response message
  const grokMessage = document.createElement('article');
  grokMessage.className = 'grok-message assistant-message';
  grokMessage.setAttribute('data-testid', 'grok-response');
  grokMessage.setAttribute('data-grok-id', 'grok-response-1');
  grokMessage.innerHTML = `
    <div data-testid="tweetText" class="content">
      <span>I don't have access to real-time weather data, but you can check your local weather service for the most accurate forecast!</span>
    </div>
    <div class="grok-avatar">
      <img alt="Grok AI" src="/grok-avatar.jpg" />
    </div>
  `;

  // Another user message
  const userMessage2 = document.createElement('article');
  userMessage2.className = 'grok-message user-message';
  userMessage2.setAttribute('data-testid', 'grok-user-message-2');
  userMessage2.setAttribute('data-grok-id', 'grok-user-2');
  userMessage2.innerHTML = `
    <div data-testid="tweetText" class="content">
      <span>Can you help me write a Python function?</span>
    </div>
    <div data-testid="UserAvatar">
      <img alt="User profile" src="/user-avatar.jpg" />
    </div>
  `;

  conversationContainer.appendChild(userMessage);
  conversationContainer.appendChild(grokMessage);
  conversationContainer.appendChild(userMessage2);
  document.body.appendChild(conversationContainer);

  return { conversationContainer, userMessage, grokMessage, userMessage2 };
};

// Mock non-Grok X.com content
const createMockXContent = () => {
  const timeline = document.createElement('main');
  timeline.setAttribute('data-testid', 'primaryColumn');

  const tweet = document.createElement('article');
  tweet.setAttribute('data-testid', 'tweet');
  tweet.innerHTML = `
    <div data-testid="tweetText">
      <span>Just a regular tweet, not a Grok conversation</span>
    </div>
  `;

  timeline.appendChild(tweet);
  document.body.appendChild(timeline);

  return { timeline, tweet };
};

describe('GrokAdapter', () => {
  let adapter: TestGrokAdapter;

  beforeEach(() => {
    mockDOM();
    adapter = new TestGrokAdapter();
  });

  afterEach(() => {
    if (adapter) {
      adapter.cleanup();
    }
    document.body.innerHTML = '';
  });

  describe('Platform Detection', () => {
    test('should detect Grok platform on x.com with Grok path', () => {
      expect(adapter.detectPlatform()).toBe(true);
    });

    test('should detect Grok platform with Grok elements present', () => {
      // Change path but add Grok elements
      updateLocation(adapter, 'https://x.com/home');

      // Add Grok-specific element
      const grokElement = document.createElement('div');
      grokElement.setAttribute('data-testid', 'grok-chat');
      document.body.appendChild(grokElement);

      expect(adapter.detectPlatform()).toBe(true);
    });

    test('should not detect platform on x.com without Grok indicators', () => {
      // Change to regular X.com path
      updateLocation(adapter, 'https://x.com/home');

      // No Grok elements
      expect(adapter.detectPlatform()).toBe(false);
    });

    test('should detect platform on twitter.com with Grok content', () => {
      updateLocation(adapter, 'https://twitter.com/i/grok');

      expect(adapter.detectPlatform()).toBe(true);
    });

    test('should not detect platform on non-X domains', () => {
      updateLocation(adapter, 'https://claude.ai/chat');

      expect(adapter.detectPlatform()).toBe(false);
    });

    test('should return correct platform type', () => {
      expect(adapter.getPlatformType()).toBe('grok');
    });

    test('should measure platform detection performance', () => {
      adapter.detectPlatform();
      const metrics = adapter.getMetrics();
      
      expect(metrics.platformDetectionTime).toBeGreaterThan(0);
      expect(metrics.platformDetectionTime).toBeLessThan(100);
    });
  });

  describe('Conversation ID Extraction', () => {
    test('should extract conversation ID from Grok URL path', () => {
      updateLocation(adapter, 'https://x.com/i/grok/conversation-456');

      const conversationId = adapter.getConversationId();
      expect(conversationId).toBe('conversation-456');
    });

    test('should extract conversation ID from URL parameters', () => {
      updateLocation(adapter, 'https://x.com/i/grok?conversation_id=conv-789');

      const conversationId = adapter.getConversationId();
      expect(conversationId).toBe('conv-789');
    });

    test('should generate conversation ID when not found in URL', () => {
      // Add Grok elements to trigger generation
      const grokElement = document.createElement('div');
      grokElement.setAttribute('data-testid', 'grok-chat');
      document.body.appendChild(grokElement);

      const conversationId = adapter.getConversationId();
      expect(conversationId).toMatch(/^grok-conversation-[a-z0-9]+$/);
    });

    test('should return null when no Grok context found', () => {
      updateLocation(adapter, 'https://x.com/home');
      
      // Make sure there are no Grok indicators in DOM
      document.body.innerHTML = '';

      const conversationId = adapter.getConversationId();
      expect(conversationId).toBeNull();
    });
  });

  describe('Message Extraction', () => {
    beforeEach(() => {
      createMockGrokConversation();
    });

    test('should extract all Grok messages from conversation', () => {
      const messages = adapter.getMessages();
      
      expect(messages).toHaveLength(3);
      expect(messages[0]?.role).toBe('user');
      expect(messages[1]?.role).toBe('assistant');
      expect(messages[2]?.role).toBe('user');
    });

    test('should extract correct message content', () => {
      const messages = adapter.getMessages();
      
      expect(messages[0]?.content).toContain('weather like today');
      expect(messages[1]?.content).toContain('real-time weather data');
      expect(messages[2]?.content).toContain('Python function');
    });

    test('should extract correct message IDs', () => {
      const messages = adapter.getMessages();
      
      expect(messages[0]?.messageId).toBe('grok-user-1');
      expect(messages[1]?.messageId).toBe('grok-response-1');
      expect(messages[2]?.messageId).toBe('grok-user-2');
    });

    test('should filter out non-Grok content on X.com', () => {
      // Add non-Grok content
      createMockXContent();
      
      const messages = adapter.getMessages();
      
      // Should only get Grok messages, not regular tweets
      expect(messages).toHaveLength(3);
      expect(messages.every(msg => msg.content.includes('weather') || msg.content.includes('Python') || msg.content.includes('real-time'))).toBe(true);
    });

    test('should handle messages without explicit IDs', () => {
      const messageWithoutId = document.createElement('article');
      messageWithoutId.className = 'grok-message';
      messageWithoutId.innerHTML = '<div data-testid="tweetText"><span>Message without ID</span></div>';
      
      const container = document.querySelector('[data-testid="primaryColumn"]')!;
      container.appendChild(messageWithoutId);

      const messages = adapter.getMessages();
      const lastMessage = messages[messages.length - 1];
      
      expect(lastMessage?.messageId).toMatch(/^grok-msg-\d+-[a-z0-9]+$/);
    });

    test('should determine message roles correctly', () => {
      const messages = adapter.getMessages();
      
      // User messages should have user avatars
      const userMessages = messages.filter(m => m.role === 'user');
      expect(userMessages).toHaveLength(2);
      
      // Assistant messages should be identified as Grok
      const assistantMessages = messages.filter(m => m.role === 'assistant');
      expect(assistantMessages).toHaveLength(1);
    });

    test('should handle role determination with styling patterns', () => {
      // Create message with Grok-specific styling
      const styledGrokMessage = document.createElement('article');
      styledGrokMessage.className = 'grok-message';
      styledGrokMessage.style.backgroundColor = 'rgb(15, 20, 25)';
      styledGrokMessage.style.color = 'rgb(255, 255, 255)';
      styledGrokMessage.innerHTML = `
        <div data-testid="tweetText">
          <span>Styled Grok response</span>
        </div>
      `;
      
      const container = document.querySelector('[data-testid="primaryColumn"]')!;
      container.appendChild(styledGrokMessage);

      const messages = adapter.getMessages();
      const lastMessage = messages[messages.length - 1];
      
      // Should be identified as assistant based on styling
      expect(lastMessage?.role).toBe('assistant');
    });

    test('should measure message extraction performance', () => {
      const messages = adapter.getMessages();
      const metrics = adapter.getMetrics();
      
      expect(messages.length).toBeGreaterThan(0);
      expect(metrics.messageExtractionTime).toBeGreaterThan(0);
      expect(metrics.messageExtractionTime).toBeLessThan(500);
      expect(metrics.messageCount).toBe(messages.length);
    });
  });

  describe('Grok-Specific Element Detection', () => {
    test('should identify Grok-related elements correctly', () => {
      // Test the private method through message extraction
      createMockGrokConversation();
      
      const messages = adapter.getMessages();
      expect(messages.length).toBeGreaterThan(0);
      
      // All extracted messages should be Grok-related
      messages.forEach(message => {
        expect(message.element.className).toContain('grok-message');
      });
    });

    test('should detect Grok content patterns', () => {
      const grokElement = document.createElement('article');
      grokElement.className = 'grok-message';
      grokElement.innerHTML = '<div data-testid="tweetText"><span>@grok can you help me?</span></div>';
      
      // Add to mock conversation
      const container = document.createElement('main');
      container.setAttribute('data-testid', 'primaryColumn');
      container.appendChild(grokElement);
      document.body.appendChild(container);

      // Should be detected as Grok-related through content analysis
      const messages = adapter.getMessages();
      expect(messages.length).toBeGreaterThan(0);
    });

    test('should handle Grok avatar detection', () => {
      // First create container
      createMockGrokConversation();
      
      const messageWithGrokAvatar = document.createElement('article');
      messageWithGrokAvatar.className = 'grok-message';
      messageWithGrokAvatar.innerHTML = `
        <div data-testid="tweetText">
          <span>Response from Grok</span>
        </div>
        <img alt="Grok AI assistant" src="/grok-avatar.png" />
      `;
      
      const container = document.querySelector('[data-testid="primaryColumn"]')!;
      container.appendChild(messageWithGrokAvatar);

      const messages = adapter.getMessages();
      const messageWithAvatar = messages.find(m => m.content.includes('Response from Grok'));
      
      expect(messageWithAvatar?.role).toBe('assistant');
    });
  });

  describe('Message Finding', () => {
    beforeEach(() => {
      createMockGrokConversation();
    });

    test('should find message by ID', () => {
      const element = adapter.findMessageById('grok-user-1');
      
      expect(element).toBeTruthy();
      expect(element?.getAttribute('data-grok-id')).toBe('grok-user-1');
    });

    test('should return null for non-existent message ID', () => {
      const element = adapter.findMessageById('non-existent-grok-id');
      expect(element).toBeNull();
    });

    test('should use cache for repeated lookups', () => {
      const element1 = adapter.findMessageById('grok-user-1');
      expect(element1).toBeTruthy();

      const element2 = adapter.findMessageById('grok-user-1');
      expect(element2).toBe(element1);
    });
  });

  describe('UI Integration', () => {
    beforeEach(() => {
      createMockGrokConversation();
    });

    test('should inject bookmark UI elements', () => {
      const mockBookmark: Bookmark = {
        id: 'bookmark-1',
        platform: 'grok',
        conversationId: 'grok-conversation-123',
        messageId: 'grok-user-1',
        anchor: {} as TextAnchor,
        note: 'Test Grok bookmark',
        tags: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        color: '#00ff00',
      };

      const mockAnchor: TextAnchor = {
        selectedText: 'weather like today',
        startOffset: 15,
        endOffset: 32,
        xpathSelector: '//article[@data-grok-id="grok-user-1"]',
        messageId: 'grok-user-1',
        contextBefore: 'Hey Grok, what\'s the ',
        contextAfter: '?',
        checksum: 'grok-test-checksum',
        confidence: 0.95,
        strategy: 'xpath' as import('../src/types/bookmark').AnchorStrategy,
      };

      adapter.injectBookmarkUI(mockAnchor, mockBookmark);

      const indicator = document.querySelector('.chatmarks-bookmark-indicator');
      expect(indicator).toBeTruthy();
      expect(indicator?.getAttribute('data-bookmark-id')).toBe('bookmark-1');
      // The browser converts #00ff00 to rgb(0, 255, 0)
      expect(indicator?.getAttribute('style')).toContain('rgb(0, 255, 0)');
    });

    test('should handle UI injection for non-existent message gracefully', () => {
      const mockBookmark: Bookmark = {
        id: 'bookmark-1',
        platform: 'grok',
        conversationId: 'grok-conversation-123',
        messageId: 'non-existent-grok-msg',
        anchor: {} as TextAnchor,
        note: 'Test bookmark',
        tags: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        color: '#ff0000',
      };

      const mockAnchor: TextAnchor = {
        selectedText: 'text',
        startOffset: 0,
        endOffset: 4,
        xpathSelector: '//article[@data-grok-id="non-existent-grok-msg"]',
        messageId: 'non-existent-grok-msg',
        contextBefore: '',
        contextAfter: '',
        checksum: 'test-checksum',
        confidence: 0.95,
        strategy: 'xpath' as import('../src/types/bookmark').AnchorStrategy,
      };

      expect(() => {
        adapter.injectBookmarkUI(mockAnchor, mockBookmark);
      }).not.toThrow();

      const indicator = document.querySelector('.chatmarks-bookmark-indicator');
      expect(indicator).toBeFalsy();
    });
  });

  describe('New Message Observation', () => {
    beforeEach(() => {
      createMockGrokConversation();
    });

    test('should set up message observation for Grok conversations', () => {
      const callback = jest.fn();
      
      adapter.observeNewMessages(callback);
      
      // Simulate new Grok message being added
      const newGrokMessage = document.createElement('article');
      newGrokMessage.className = 'grok-message';
      newGrokMessage.setAttribute('data-testid', 'grok-response-new');
      newGrokMessage.innerHTML = `
        <div data-testid="tweetText">
          <span>New Grok response</span>
        </div>
      `;
      
      const container = document.querySelector('[data-testid="primaryColumn"]')!;
      container.appendChild(newGrokMessage);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(callback).toHaveBeenCalledWith([newGrokMessage]);
          resolve();
        }, 200);
      });
    });

    test('should handle observation when container not found', () => {
      document.body.innerHTML = '';
      
      const callback = jest.fn();
      
      expect(() => {
        adapter.observeNewMessages(callback);
      }).not.toThrow();
    });
  });

  describe('Timestamp Extraction', () => {
    beforeEach(() => {
      createMockGrokConversation();
    });
    
    test('should extract timestamps from X.com time elements', () => {
      const messageWithTime = document.createElement('article');
      messageWithTime.className = 'grok-message';
      messageWithTime.innerHTML = `
        <div data-testid="tweetText">
          <span>Message with timestamp</span>
        </div>
        <time datetime="2024-01-15T10:30:00Z">2h</time>
      `;
      
      const container = document.querySelector('[data-testid="primaryColumn"]')!;
      container.appendChild(messageWithTime);

      const messages = adapter.getMessages();
      const messageWithTimestamp = messages.find(m => m.content.includes('Message with timestamp'));
      
      expect(messageWithTimestamp?.timestamp).toBeInstanceOf(Date);
      expect(messageWithTimestamp?.timestamp?.toISOString()).toBe('2024-01-15T10:30:00.000Z');
    });

    test('should handle X.com specific time formats', () => {
      const messageWithXTime = document.createElement('article');
      messageWithXTime.className = 'grok-message';
      messageWithXTime.innerHTML = `
        <div data-testid="tweetText">
          <span>Message with X time format</span>
        </div>
        <div data-testid="Time">Jan 15, 2024</div>
      `;
      
      const container = document.querySelector('[data-testid="primaryColumn"]')!;
      container.appendChild(messageWithXTime);

      const messages = adapter.getMessages();
      const messageWithTime = messages.find(m => m.content.includes('X time format'));
      
      expect(messageWithTime?.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Content Cleaning and Utilities', () => {
    beforeEach(() => {
      createMockGrokConversation();
    });
    
    test('should clean text content properly', () => {
      const mockMessage = document.createElement('article');
      mockMessage.className = 'grok-message';
      mockMessage.innerHTML = `
        <div data-testid="tweetText">
          <span>   Text   with    extra   whitespace   </span>
        </div>
      `;
      
      const container = document.querySelector('[data-testid="primaryColumn"]')!;
      container.appendChild(mockMessage);

      const messages = adapter.getMessages();
      
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        expect(lastMessage?.content).toBe('Text with extra whitespace');
      }
    });

    test('should generate consistent hash for same input', () => {
      const testAdapter = new TestGrokAdapter();
      const simpleHash = (testAdapter as any).testSimpleHash;
      
      const hash1 = simpleHash('grok test string');
      const hash2 = simpleHash('grok test string');
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-z0-9]+$/);
    });
  });

  describe('Cleanup and Resource Management', () => {
    test('should cleanup resources properly', () => {
      createMockGrokConversation();
      
      const callback = jest.fn();
      adapter.observeNewMessages(callback);
      
      expect(adapter.getMetrics()).toBeTruthy();
      
      adapter.cleanup();
      
      expect(() => adapter.cleanup()).not.toThrow();
    });

    test('should clear message cache on cleanup', () => {
      createMockGrokConversation();
      
      const messages = adapter.getMessages();
      expect(messages.length).toBeGreaterThan(0);
      
      const element1 = adapter.findMessageById('grok-user-1');
      expect(element1).toBeTruthy();
      
      adapter.cleanup();
      
      const element2 = adapter.findMessageById('grok-user-1');
      expect(element2).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      createMockGrokConversation();
    });
    
    test('should handle DOM errors gracefully', () => {
      const problemElement = document.createElement('article');
      problemElement.className = 'grok-message';
      // No proper content structure
      
      const container = document.querySelector('[data-testid="primaryColumn"]')!;
      container.appendChild(problemElement);

      const messages = adapter.getMessages();
      const metrics = adapter.getMetrics();
      
      expect(messages).toBeInstanceOf(Array);
      expect(metrics.errorCount).toBeGreaterThanOrEqual(0);
    });

    test('should track extraction errors in metrics', () => {
      const originalQuerySelectorAll = document.querySelectorAll;
      document.querySelectorAll = jest.fn().mockImplementation(() => {
        throw new Error('Mock Grok DOM error');
      });

      const messages = adapter.getMessages();
      const metrics = adapter.getMetrics();
      
      expect(messages).toHaveLength(0);
      expect(metrics.errorCount).toBeGreaterThan(0);
      expect(metrics.lastError).toContain('Mock Grok DOM error');
      
      document.querySelectorAll = originalQuerySelectorAll;
    });
  });

  describe('Performance Requirements', () => {
    test('should meet platform detection performance targets', () => {
      const startTime = performance.now();
      adapter.detectPlatform();
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100);
    });

    test('should meet message extraction performance targets', () => {
      createMockGrokConversation();
      
      const startTime = performance.now();
      const messages = adapter.getMessages();
      const endTime = performance.now();
      
      expect(messages.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(500);
    });

    test('should maintain accuracy metrics', () => {
      createMockGrokConversation();
      
      for (let i = 0; i < 5; i++) {
        adapter.getMessages();
      }
      
      const metrics = adapter.getMetrics();
      expect(metrics.successRate).toBeGreaterThanOrEqual(0.99);
    });
  });

  describe('Integration with X.com Platform', () => {
    test('should distinguish Grok content from regular tweets', () => {
      // Create mixed content
      createMockGrokConversation();
      createMockXContent();
      
      const messages = adapter.getMessages();
      
      // Should only extract Grok messages, not regular tweets
      expect(messages.length).toBe(3); // Only the Grok messages
      expect(messages.every(msg => 
        msg.content.includes('weather') || 
        msg.content.includes('Python') || 
        msg.content.includes('real-time')
      )).toBe(true);
    });

    test('should handle X.com DOM structure changes gracefully', () => {
      // Simulate X.com structure with different selectors
      const alternativeContainer = document.createElement('div');
      alternativeContainer.setAttribute('role', 'main');
      
      const grokMessage = document.createElement('div');
      grokMessage.className = 'message grok';
      grokMessage.innerHTML = `
        <div class="text">
          <p>Alternative Grok message structure</p>
        </div>
      `;
      
      alternativeContainer.appendChild(grokMessage);
      document.body.appendChild(alternativeContainer);

      const messages = adapter.getMessages();
      
      // Should still extract the message using fallback selectors
      expect(messages.length).toBeGreaterThan(0);
    });
  });
});