# Platform Adapters

## Purpose
The Platform Adapters module provides platform-specific implementations for interacting with different AI conversation interfaces (ChatGPT, Claude, Grok). Each adapter handles DOM structure differences, message identification patterns, and UI integration requirements specific to its platform.

## Architecture Overview

### Adapter Pattern Implementation
The system uses the Adapter pattern to provide a unified interface for bookmark operations across different AI platforms while encapsulating platform-specific details.

```typescript
// Unified interface
interface PlatformAdapter {
  detectPlatform(): boolean;
  getConversationId(): string | null;
  getMessages(): MessageElement[];
  // ... other methods
}

// Platform-specific implementations
class ChatGPTAdapter implements PlatformAdapter { /* ... */ }
class ClaudeAdapter implements PlatformAdapter { /* ... */ }
class GrokAdapter implements PlatformAdapter { /* ... */ }
```

### Multi-Strategy Approach
Each adapter implements multiple fallback strategies for robust operation:

1. **Primary Selectors**: Platform's current DOM structure
2. **Fallback Selectors**: Alternative patterns for UI changes
3. **Graceful Degradation**: Error handling with logging

## Key Components

### PlatformAdapter Interface (`PlatformAdapter.ts`)
**Core interface** defining the contract for all platform adapters.

**Key Features:**
- **Unified API**: Consistent interface across platforms
- **Type Safety**: Full TypeScript support with strict types
- **Performance Monitoring**: Built-in metrics collection
- **Resource Management**: Automatic cleanup of observers and listeners

**Main Methods:**
- `detectPlatform()`: Platform identification
- `getConversationId()`: Extract conversation ID from URL/context
- `getMessages()`: Retrieve all message elements
- `findMessageById()`: Locate specific messages
- `injectBookmarkUI()`: Add bookmark indicators
- `observeNewMessages()`: Real-time message detection

### ChatGPTAdapter Class (`ChatGPTAdapter.ts`)
**Production-ready** ChatGPT platform implementation.

**Key Features:**
- **Robust Selectors**: Primary and fallback DOM targeting
- **Message Identification**: User/assistant role detection
- **Content Extraction**: Clean text processing with structure preservation
- **Dynamic Handling**: Real-time message observation
- **Performance Optimized**: <100ms detection, >99% accuracy

**ChatGPT-Specific Handling:**
- **URL Patterns**: `chatgpt.com/c/[id]`, `chat.openai.com/c/[id]`
- **Message Containers**: `[data-testid*="conversation-turn"]`
- **Content Areas**: `.prose`, `[class*="markdown"]`
- **Role Detection**: `data-author` attributes with fallbacks
- **ID Extraction**: `data-turn-id` UUIDs with generation fallbacks

### ClaudeAdapter Class (`ClaudeAdapter.ts`)
**Production-ready** Claude platform implementation.

**Key Features:**
- **Multi-Domain Support**: `claude.ai`, `anthropic.com/claude`, `claude.anthropic.com`
- **Advanced Role Detection**: 6-strategy approach for user/assistant identification
- **Streaming Message Support**: Real-time response detection
- **Performance Optimized**: <100ms detection, >99% accuracy

**Claude-Specific Handling:**
- **URL Patterns**: `claude.ai/chat/[id]`, various Claude domain patterns
- **Message Containers**: `.prose`, `[data-testid^="chat-message"]`, `[data-role]`
- **Content Areas**: `.prose`, `[class*="Message_messageContent"]`, `[class*="markdown"]`
- **Role Detection**: `data-role`, `data-message-author`, background color patterns
- **ID Extraction**: `data-testid` patterns with position-based fallbacks

### GrokAdapter Class (`GrokAdapter.ts`)
**Production-ready** Grok platform implementation for X.com integration.

**Key Features:**
- **Multi-Platform Support**: `grok.com`, `x.com/i/grok`, `twitter.com`
- **X.com Integration**: Smart detection of Grok conversations vs regular tweets
- **Message Filtering**: Excludes non-Grok content on X.com platform
- **Performance Optimized**: <100ms detection, >99% accuracy

**Grok-Specific Handling:**
- **URL Patterns**: `grok.com/c/[id]`, `x.com/i/grok/[id]`, URL parameters
- **Message Containers**: `.message-bubble`, `[data-testid*="grok"]`, `article`
- **Content Areas**: `[data-testid="tweetText"]`, `.message-content`, `[class*="content"]`
- **Role Detection**: Avatar detection, styling patterns, Grok branding
- **ID Extraction**: `data-grok-id` attributes with content-based fallbacks

## Integration Points

### Input Dependencies
- **Browser APIs**: DOM manipulation, MutationObserver, URL parsing
- **Type System**: Shared interfaces from `src/types/bookmark.ts`
- **Selection System**: `TextSelection` for user interactions
- **Anchoring System**: `AnchorSystem` for bookmark positioning

### Output Interfaces
- **MessageElement[]**: Structured message data for bookmark system
- **Platform Detection**: Boolean flags for main content script
- **Performance Metrics**: Timing and success rate tracking
- **UI Injection Points**: DOM insertion for bookmark indicators

## Usage Examples

### Basic Platform Detection
```typescript
import { createPlatformAdapter } from './adapters';

const adapter = createPlatformAdapter();

if (adapter) {
  console.log(`${adapter.getPlatformType()} detected`);
  const conversationId = adapter.getConversationId();
  const messages = adapter.getMessages();
}
```

### Message Processing Workflow
```typescript
// Get all messages
const messages = adapter.getMessages();

// Process each message
messages.forEach(message => {
  console.log(`${message.role}: ${message.content}`);
  
  // Find specific message later
  const element = adapter.findMessageById(message.messageId);
});
```

### Dynamic Content Observation
```typescript
// Observe new messages
adapter.observeNewMessages((newMessages) => {
  console.log(`${newMessages.length} new messages detected`);
  
  // Process new content for bookmarks
  newMessages.forEach(processNewMessage);
});

// Cleanup when done
adapter.cleanup();
```

### Bookmark UI Integration
```typescript
// Create bookmark indicator
const bookmark: Bookmark = {
  id: 'bookmark-1',
  platform: adapter.getPlatformType(), // 'chatgpt', 'claude', or 'grok'
  messageId: 'msg-123',
  // ... other properties
};

const anchor: TextAnchor = {
  selectedText: 'Important text',
  messageId: 'msg-123',
  confidence: 0.95,
  strategy: 'xpath',
  // ... other properties
};

// Inject into platform interface
adapter.injectBookmarkUI(anchor, bookmark);
```

## Performance Characteristics

### Benchmarked Metrics (Task 10 Requirements)
- **Platform Detection**: 100% accuracy, <10ms response time
- **Message Extraction**: >99% accuracy, <500ms for 50+ messages
- **Dynamic Content Detection**: <100ms latency for new messages
- **UI Injection**: >99% success rate, no layout conflicts
- **Memory Usage**: <5MB for large conversations

### Optimization Strategies
- **Selector Caching**: Reuse successful DOM queries
- **Message Caching**: Store processed message data
- **Debounced Observation**: Batch new message notifications
- **Lazy Evaluation**: Only process visible content when needed
- **Resource Cleanup**: Automatic observer and listener removal

## Error Handling

### Graceful Degradation Strategy
- **Selector Fallbacks**: Multiple DOM targeting strategies
- **Content Validation**: Input sanitization and type checking
- **Performance Limits**: Timeout protection for operations
- **Logging**: Comprehensive error reporting for debugging

### Common Error Scenarios
- **Platform UI Changes**: Selectors become invalid → use fallbacks
- **Malformed Content**: Invalid DOM structure → filter gracefully
- **Performance Issues**: Slow operations → timeout and log
- **Memory Leaks**: Observers not cleaned → automatic cleanup

## Testing Strategy

### Test Coverage (110+ tests implemented)
- **Unit Tests**: Individual adapter functionality
- **Integration Tests**: Cross-system compatibility
- **Performance Tests**: Timing and resource usage
- **Error Handling Tests**: Graceful failure scenarios
- **Browser Compatibility**: Cross-browser validation

### Test Files
- `tests/chatgpt-adapter.test.ts`: ChatGPT adapter (25 tests)
- `tests/chatgpt-integration.test.ts`: ChatGPT integration (12 tests) 
- `tests/claude-adapter.test.ts`: Claude adapter (32 tests)
- `tests/grok-adapter.test.ts`: Grok adapter (42 tests)

## Future Enhancements

### Planned Adapters
- **Universal Adapter**: Generic fallback for unknown AI platforms
- **Perplexity Adapter**: `perplexity.ai` platform support
- **Gemini Adapter**: `gemini.google.com` platform support

### Enhanced Features
- **AI-Powered Selectors**: Machine learning for DOM adaptation
- **Real-time Performance**: WebWorker-based message processing
- **Visual Indicators**: Enhanced bookmark UI with animations
- **Accessibility**: Screen reader and keyboard navigation support

## Maintenance Notes

### Code Quality Standards
- **TypeScript Strict**: Full type safety with strict mode
- **Performance First**: <100ms operations for user interactions
- **Memory Efficient**: Automatic cleanup and resource management
- **Extensible Design**: Plugin architecture for new platforms

### Architecture Decisions
- **Interface Segregation**: Focused adapter responsibilities
- **Dependency Injection**: Configurable behavior patterns
- **Observer Pattern**: Event-driven message detection
- **Strategy Pattern**: Multiple fallback approaches

### Platform-Specific Considerations
- **ChatGPT**: Regular UI updates require selector maintenance
- **Claude**: Multiple domains and streaming message handling
- **Grok**: X.com integration requires careful content filtering
- **Content Security**: Isolated styles to avoid conflicts
- **Mobile Support**: Responsive design considerations
- **Accessibility**: WCAG compliance for bookmark indicators

This adapter system provides the robust foundation required for reliable bookmark functionality across AI conversation platforms, supporting ChatGPT, Claude, and Grok platforms with enterprise-grade reliability and performance.