/**
 * ChatGPT Adapter Integration Test Suite
 *
 * Integration tests for ChatGPT adapter with existing systems
 * (TextSelection, AnchorSystem, BookmarkManager)
 */

import { ChatGPTAdapter } from '../src/content/adapters/ChatGPTAdapter';
import { TextSelection } from '../src/content/selection/TextSelection';
import { AnchorSystem } from '../src/content/anchoring/AnchorSystem';
import { Platform, SelectionRange, TextAnchor } from '../src/types/bookmark';

describe('ChatGPT Adapter Integration', () => {
  let adapter: ChatGPTAdapter;
  let textSelection: TextSelection;
  let anchorSystem: AnchorSystem;
  let originalLocation: Location;

  beforeEach(() => {
    adapter = new ChatGPTAdapter();
    textSelection = new TextSelection();
    anchorSystem = new AnchorSystem(document);
    
    // Mock window.location for ChatGPT
    originalLocation = window.location;
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      hostname: 'chatgpt.com',
      href: 'https://chatgpt.com/c/integration-test-conversation',
    } as Location;

    // Set up realistic ChatGPT DOM structure
    document.body.innerHTML = `
      <main>
        <div data-testid="conversation-turn-0" data-author="user" data-turn-id="user-integration-1">
          <div class="prose">
            <p>What are the main benefits of using TypeScript in large-scale applications?</p>
          </div>
        </div>
        <div data-testid="conversation-turn-1" data-author="assistant" data-turn-id="assistant-integration-1">
          <div class="prose">
            <p>TypeScript offers several key benefits for large-scale applications:</p>
            <ol>
              <li><strong>Type Safety:</strong> Static type checking catches errors at compile time</li>
              <li><strong>Better IDE Support:</strong> Enhanced autocomplete and refactoring capabilities</li>
              <li><strong>Improved Code Documentation:</strong> Types serve as inline documentation</li>
              <li><strong>Easier Refactoring:</strong> Confident large-scale code changes</li>
            </ol>
            <p>These features significantly improve developer productivity and code quality in complex projects.</p>
          </div>
        </div>
      </main>
    `;

    // Mock getSelection for text selection tests
    const mockSelection = {
      toString: () => 'Type Safety: Static type checking catches errors at compile time',
      rangeCount: 1,
      isCollapsed: false,
      getRangeAt: (index: number) => {
        const range = document.createRange();
        const liElement = document.querySelector('li strong');
        if (liElement?.nextSibling) {
          range.setStart(liElement, 0);
          range.setEnd(liElement.nextSibling, 50);
        }
        return range;
      },
      removeAllRanges: jest.fn(),
      addRange: jest.fn(),
    };

    Object.defineProperty(window, 'getSelection', {
      value: () => mockSelection,
      writable: true,
    });
  });

  afterEach(() => {
    adapter.cleanup();
    textSelection.cleanup();
    window.location = originalLocation;
    jest.restoreAllMocks();
  });

  describe('Platform Detection Integration', () => {
    it('should work with main content script platform detection', () => {
      // Simulate main.ts platform detection logic
      const hostname = window.location.hostname;
      const isChatGPT = hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com');
      
      expect(isChatGPT).toBe(true);
      expect(adapter.detectPlatform()).toBe(true);
    });

    it('should provide conversation ID for bookmark storage', () => {
      const conversationId = adapter.getConversationId();
      expect(conversationId).toBe('integration-test-conversation');
      
      // Verify it matches the pattern expected by storage systems
      expect(conversationId).toMatch(/^[a-zA-Z0-9-]+$/);
    });
  });

  describe('Text Selection Integration', () => {
    it('should work with TextSelection system for bookmark creation', () => {
      // Capture selection using TextSelection
      const selectionRange = textSelection.captureRange();
      
      expect(selectionRange).toBeTruthy();
      expect(selectionRange?.selectedText).toContain('Type Safety');
      
      // Verify adapter can find the message containing this selection
      const messages = adapter.getMessages();
      const targetMessage = messages.find(msg => 
        msg.content.includes('Type Safety')
      );
      
      expect(targetMessage).toBeTruthy();
      expect(targetMessage?.role).toBe('assistant');
    });

    it('should provide message context for text selection', () => {
      const messages = adapter.getMessages();
      const assistantMessage = messages.find(msg => msg.role === 'assistant');
      
      expect(assistantMessage?.content).toContain('TypeScript offers several key benefits');
      expect(assistantMessage?.content).toContain('Type Safety');
      expect(assistantMessage?.content).toContain('Better IDE Support');
      
      // Verify the content structure is preserved for anchor creation
      expect(assistantMessage?.element.querySelector('ol li')).toBeTruthy();
    });
  });

  describe('Anchor System Integration', () => {
    it('should create anchors for ChatGPT message content', () => {
      const selectionRange = textSelection.captureRange();
      if (!selectionRange) {
        throw new Error('Failed to capture selection range');
      }

      // Update selection range with ChatGPT-specific IDs
      const messages = adapter.getMessages();
      const targetMessage = messages.find(msg => msg.content.includes('Type Safety'));
      
      if (targetMessage) {
        selectionRange.messageId = targetMessage.messageId;
        selectionRange.conversationId = adapter.getConversationId() || 'fallback-id';
      }

      // Create anchor using AnchorSystem
      const anchor = anchorSystem.createAnchor(selectionRange);
      
      expect(anchor).toBeTruthy();
      expect(anchor.selectedText).toContain('Type Safety');
      expect(anchor.messageId).toBe(targetMessage?.messageId);
      expect(anchor.confidence).toBeGreaterThan(0.5);
    });

    it('should resolve anchors back to ChatGPT message elements', () => {
      const selectionRange = textSelection.captureRange();
      if (!selectionRange) {
        throw new Error('Failed to capture selection range');
      }

      const messages = adapter.getMessages();
      const targetMessage = messages.find(msg => msg.content.includes('Type Safety'));
      
      if (targetMessage) {
        selectionRange.messageId = targetMessage.messageId;
        selectionRange.conversationId = adapter.getConversationId() || 'fallback-id';
      }

      const anchor = anchorSystem.createAnchor(selectionRange);
      const resolvedRange = anchorSystem.resolveAnchor(anchor);
      
      expect(resolvedRange).toBeTruthy();
      
      // Verify the resolved range is within the correct message
      const messageElement = adapter.findMessageById(anchor.messageId);
      expect(messageElement).toBeTruthy();
      expect(messageElement?.contains(resolvedRange?.commonAncestorContainer)).toBe(true);
    });
  });

  describe('Bookmark Creation Workflow', () => {
    it('should support complete bookmark creation workflow', () => {
      // Step 1: Text selection
      const selectionRange = textSelection.captureRange();
      expect(selectionRange).toBeTruthy();

      // Step 2: Get message context from adapter
      const messages = adapter.getMessages();
      const targetMessage = messages.find(msg => msg.content.includes('Type Safety'));
      expect(targetMessage).toBeTruthy();

      // Step 3: Update selection with platform-specific IDs
      if (selectionRange && targetMessage) {
        selectionRange.messageId = targetMessage.messageId;
        selectionRange.conversationId = adapter.getConversationId() || 'fallback-id';
      }

      // Step 4: Create anchor
      const anchor = anchorSystem.createAnchor(selectionRange!);
      expect(anchor.confidence).toBeGreaterThan(0.8);

      // Step 5: Verify bookmark data structure
      const bookmarkData = {
        platform: adapter.getPlatformType(),
        conversationId: adapter.getConversationId(),
        messageId: targetMessage!.messageId,
        selectedText: selectionRange!.selectedText,
        anchor,
      };

      expect(bookmarkData.platform).toBe('chatgpt');
      expect(bookmarkData.conversationId).toBe('integration-test-conversation');
      expect(bookmarkData.messageId).toBe('assistant-integration-1');
      expect(bookmarkData.selectedText).toContain('Type Safety');
    });
  });

  describe('Dynamic Content Handling', () => {
    it('should detect new messages and integrate with selection system', (done) => {
      const newMessageCallback = jest.fn((messages) => {
        expect(messages).toHaveLength(1);
        expect(messages[0].getAttribute('data-testid')).toBe('conversation-turn-2');
        
        // Verify new message is accessible through adapter
        const allMessages = adapter.getMessages();
        expect(allMessages).toHaveLength(3);
        
        done();
      });

      adapter.observeNewMessages(newMessageCallback);

      // Simulate new message appearing
      setTimeout(() => {
        const newMessage = document.createElement('div');
        newMessage.setAttribute('data-testid', 'conversation-turn-2');
        newMessage.setAttribute('data-author', 'user');
        newMessage.setAttribute('data-turn-id', 'user-integration-2');
        newMessage.innerHTML = `
          <div class="prose">
            <p>Can you provide examples of TypeScript interfaces?</p>
          </div>
        `;
        
        document.querySelector('main')?.appendChild(newMessage);
      }, 50);
    });
  });

  describe('UI Integration', () => {
    it('should inject bookmark indicators without breaking ChatGPT layout', () => {
      const mockBookmark = {
        id: 'integration-bookmark-1',
        platform: 'chatgpt' as Platform,
        conversationId: 'integration-test-conversation',
        messageId: 'assistant-integration-1',
        anchor: {
          selectedText: 'Type Safety',
          messageId: 'assistant-integration-1',
        } as TextAnchor,
        note: 'Important TypeScript concept',
        tags: ['typescript', 'development'],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        color: '#4f46e5',
      };

      const mockAnchor: TextAnchor = {
        selectedText: 'Type Safety',
        startOffset: 0,
        endOffset: 11,
        xpathSelector: '',
        messageId: 'assistant-integration-1',
        contextBefore: '',
        contextAfter: ': Static type checking',
        checksum: '',
        confidence: 0.95,
        strategy: 'xpath',
      };

      // Inject bookmark UI
      adapter.injectBookmarkUI(mockAnchor, mockBookmark);

      // Verify indicator was added
      const indicator = document.querySelector('.chatmarks-bookmark-indicator');
      expect(indicator).toBeTruthy();
      
      // Verify it doesn't break ChatGPT's layout
      const messageElement = adapter.findMessageById('assistant-integration-1');
      expect(messageElement?.querySelector('.prose')).toBeTruthy();
      
      // Verify styling is isolated
      const indicatorStyle = window.getComputedStyle(indicator as Element);
      expect(indicatorStyle.position).toBe('absolute');
      expect(indicatorStyle.zIndex).toBe('1000');
    });
  });

  describe('Performance Integration', () => {
    it('should meet performance targets in realistic scenarios', () => {
      const startTime = performance.now();
      
      // Full workflow performance test
      const platform = adapter.detectPlatform();
      const conversationId = adapter.getConversationId();
      const messages = adapter.getMessages();
      const selectionRange = textSelection.captureRange();
      
      if (selectionRange && messages.length > 0) {
        selectionRange.messageId = messages[0].messageId;
        selectionRange.conversationId = conversationId || 'fallback';
        const anchor = anchorSystem.createAnchor(selectionRange);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should complete full workflow under 100ms (bookmark creation target)
      expect(totalTime).toBeLessThan(100);
      expect(platform).toBe(true);
      expect(messages.length).toBeGreaterThan(0);
    });

    it('should handle large conversations efficiently', () => {
      // Create a large conversation with 50 messages
      const largeConversation = Array.from({ length: 50 }, (_, i) => `
        <div data-testid="conversation-turn-${i}" data-author="${i % 2 === 0 ? 'user' : 'assistant'}" data-turn-id="msg-${i}">
          <div class="prose">
            <p>Message content ${i}: ${new Array(100).fill(`word${i}`).join(' ')}</p>
          </div>
        </div>
      `).join('');

      document.querySelector('main')!.innerHTML = largeConversation;

      const startTime = performance.now();
      const messages = adapter.getMessages();
      const endTime = performance.now();

      expect(messages).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(500); // Still under 500ms target
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle malformed DOM gracefully', () => {
      // Create malformed ChatGPT structure
      document.body.innerHTML = `
        <main>
          <div data-testid="conversation-turn-0">
            <!-- Missing required attributes and content -->
          </div>
          <div class="some-unknown-structure">
            <span>Unexpected content</span>
          </div>
        </main>
      `;

      // Should not throw errors
      expect(() => {
        const platform = adapter.detectPlatform();
        const messages = adapter.getMessages();
        const conversationId = adapter.getConversationId();
      }).not.toThrow();

      // Should handle gracefully
      expect(adapter.detectPlatform()).toBe(true);
      expect(adapter.getMessages()).toHaveLength(0);
      expect(adapter.getConversationId()).toBe('integration-test-conversation');
    });

    it('should integrate with anchor system error recovery', () => {
      const selectionRange = textSelection.captureRange();
      if (!selectionRange) {
        throw new Error('Failed to capture selection range');
      }

      // Create invalid message ID
      selectionRange.messageId = 'non-existent-message';
      selectionRange.conversationId = adapter.getConversationId() || 'fallback';

      // Anchor system should handle gracefully
      const anchor = anchorSystem.createAnchor(selectionRange);
      expect(anchor).toBeTruthy();
      expect(anchor.confidence).toBeLessThan(0.9); // Lower confidence for problematic cases
    });
  });
});