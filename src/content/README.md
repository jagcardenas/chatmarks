# Content Scripts

## Purpose
Contains all code that runs in the context of AI platform web pages, handling text selection, bookmark creation, UI injection, and platform-specific adaptations.

## Key Components
- **main.ts**: Entry point that initializes content script, detects platform, and sets up core functionality
- **adapters/**: Platform-specific implementations for ChatGPT, Claude, and Grok DOM interaction
- **anchoring/**: Text anchoring system with multiple fallback strategies for bookmark positioning
- **storage/**: Client-side storage operations and data persistence management
- **ui/**: User interface components injected into AI platform pages
- **styles.css**: Isolated CSS styles for extension UI elements

## Functionality
- **Platform Detection**: Detects ChatGPT (`chatgpt.com` and `chat.openai.com`) and Claude (`claude.ai`)
- **Text Selection Handling**: Captures user selections with robust anchoring metadata
- **UI Injection**: Shows a floating “Bookmark” button and a creation dialog with note field
- **Bookmark Management**: Sends `CREATE_BOOKMARK` message to background to persist locally
- **Keyboard Shortcuts**: Cmd/Ctrl+B opens the bookmark dialog when text is selected

## Integration Points
- **Background Script**: Communicates via chrome.runtime messaging for settings and storage
- **Platform DOMs**: Injects UI elements without conflicting with host page styles
- **Chrome Storage**: Reads/writes bookmark data and user preferences
- **Popup Interface**: Responds to navigation requests and provides bookmark data

## Performance Considerations
- Lazy loading of platform adapters to minimize initial script size
- Efficient DOM queries using cached selectors and intersection observers
- Debounced event handlers to prevent excessive processing during rapid interactions
- Memory management for UI components with proper cleanup on navigation

## Testing Approach
- Unit test platform adapters with mocked DOM structures from real AI platforms  
- Test text selection and anchoring accuracy with various DOM scenarios
- Validate UI injection and cleanup across different platform layouts
- Integration tests with real AI platform pages using browser automation