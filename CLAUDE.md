# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Chatmarks** is a Chrome browser extension that transforms AI conversations into navigable, annotated documents. The project delivers intelligent bookmarking (V1) and conversation branching (V2) capabilities for ChatGPT, Claude, and Grok platforms.

**Current Status**: **Tasks 1-13 Complete** - Core bookmarking system fully implemented with comprehensive test coverage (412 tests passing). Architecture has been refactored into focused, modular managers. Currently at Task 14: Context Menu Integration (partially complete). Ready for navigation system implementation (Task 15).

**Core Value Proposition:**
- Zero-cost architecture (no servers, no subscriptions)
- Privacy-first design (100% local data storage; no external network calls from the extension runtime)
- Enterprise-grade reliability and performance
- Seamless integration with existing AI platforms

## Development Commands

### Essential Commands
```bash
# Initial setup
npm install

# Development workflow
npm run build          # Compile TypeScript to dist/
npm run build:watch    # Watch mode compilation
npm run typecheck      # Type checking without emit

# Quality assurance
npm run test           # Run Jest test suite
npm run test:watch     # Watch mode testing
npm run test:coverage  # Generate coverage report
npm run lint           # ESLint code analysis
npm run lint:fix       # Auto-fix linting issues

# Code formatting
npm run format         # Format all files with Prettier
npm run format:check   # Check formatting without changes

# Pre-commit validation (runs automatically via Husky)
npm run precommit      # Full validation: typecheck + lint + test
```

### Test-Specific Commands
```bash
# Run single test file
npm test -- src/path/to/test.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="bookmark creation"

# Debug tests with verbose output
npm test -- --verbose --no-cache
```

## Current Architecture - Modular Design (Tasks 1-13 Complete)

### Project Structure (Current Implementation State)
```
chatmarks/
├── src/
│   ├── content/
│   │   ├── main.ts                      # ✅ Minimal entry point
│   │   ├── ContentScriptInitializer.ts # ✅ Main orchestrator
│   │   ├── UIManager.ts                 # ✅ Web Components coordination
│   │   ├── SelectionManager.ts          # ✅ Selection state management
│   │   ├── BookmarkOperations.ts        # ✅ Bookmark CRUD operations
│   │   ├── MessageHandler.ts            # ✅ Chrome runtime messaging
│   │   ├── ShortcutActions.ts           # ✅ Keyboard shortcut actions
│   │   ├── adapters/                    # ✅ Platform-specific implementations
│   │   │   ├── ChatGPTAdapter.ts        # ✅ ChatGPT DOM integration
│   │   │   ├── PlatformAdapter.ts       # ✅ Base adapter interface
│   │   │   └── README.md                # Platform adapter documentation
│   │   ├── anchoring/                   # ✅ Multi-strategy text anchoring
│   │   │   ├── AnchorSystem.ts          # ✅ Multi-strategy coordinator
│   │   │   ├── XPathAnchor.ts           # ✅ Primary DOM targeting
│   │   │   ├── OffsetAnchor.ts          # ✅ Character offset fallback
│   │   │   ├── FuzzyMatcher.ts          # ✅ Text similarity matching
│   │   │   └── README.md                # Anchoring system documentation
│   │   ├── bookmarks/                   # ✅ Bookmark management
│   │   │   ├── BookmarkManager.ts       # ✅ CRUD operations
│   │   │   ├── BookmarkEvents.ts        # ✅ Event system
│   │   │   └── README.md                # Bookmark system documentation
│   │   ├── keyboard/                    # ✅ Keyboard shortcuts
│   │   │   └── KeyboardManager.ts       # ✅ Customizable shortcuts
│   │   ├── selection/                   # ✅ Text selection system
│   │   │   ├── TextSelection.ts         # ✅ Range API integration
│   │   │   └── README.md                # Selection system documentation
│   │   ├── storage/                     # ✅ Persistent storage
│   │   │   ├── StorageService.ts        # ✅ Chrome storage integration
│   │   │   ├── BatchStorageService.ts   # ✅ Batch operations
│   │   │   ├── IndexedDBService.ts      # ✅ IndexedDB fallback
│   │   │   ├── Migration.ts             # ✅ Schema migration
│   │   │   └── README.md                # Storage system documentation
│   │   ├── ui/                          # ✅ Web Components UI system
│   │   │   ├── components/              # ✅ Reusable UI components
│   │   │   │   ├── FloatingActionButton.ts # ✅ Selection button
│   │   │   │   ├── BookmarkDialog.ts    # ✅ Creation dialog
│   │   │   │   ├── BookmarkForm.ts      # ✅ Form handling
│   │   │   │   └── base/                # ✅ Base component system
│   │   │   └── highlights/              # ✅ Visual highlighting
│   │   │       ├── HighlightRenderer.ts # ✅ Highlight rendering
│   │   │       ├── TextWrapper.ts       # ✅ DOM text wrapping
│   │   │       └── OverlapManager.ts    # ✅ Overlap handling
│   │   └── utils/                       # ✅ Utility modules
│   │       ├── ThemeManager.ts          # ✅ Visual styling
│   │       ├── PlatformUtils.ts         # ✅ Platform detection
│   │       └── EventTracker.ts          # ✅ Event cleanup tracking
│   ├── background/
│   │   ├── service-worker.ts            # ✅ Manifest v3 service worker
│   │   └── README.md                    # Background documentation
│   ├── popup/                           # ✅ Extension popup interface
│   │   ├── popup.ts                     # ✅ Popup functionality
│   │   ├── index.html                   # ✅ Popup HTML
│   │   └── styles.css                   # ✅ Popup styles
│   ├── options/                         # ✅ Extension options page
│   │   ├── options.ts                   # ✅ Settings management
│   │   ├── index.html                   # ✅ Options HTML
│   │   └── styles.css                   # ✅ Options styles
│   └── types/                           # ✅ TypeScript definitions
│       ├── bookmark.ts                  # ✅ Core data structures
│       └── messages.ts                  # ✅ Inter-context messaging
├── tests/                               # ✅ 412 tests passing
│   ├── integration-workflow.test.ts     # ✅ End-to-end testing
│   ├── text-selection.test.ts           # ✅ 24 tests
│   ├── text-anchoring.test.ts           # ✅ 32 tests
│   ├── storage-*.test.ts               # ✅ 45 tests
│   ├── ui-components/                   # ✅ 89 tests
│   └── chatgpt-*.test.ts               # ✅ 67 tests
├── manifest.json                        # ✅ Chrome extension manifest v3
├── vite.config.ts                      # ✅ Vite + CRXJS build system
└── jest.config.js                      # ✅ Jest testing configuration
```

### Implementation Status Summary

#### ✅ **Completed Systems (Tasks 1-13)**
- **ContentScriptInitializer**: Main orchestrator with modular manager coordination
- **Text Processing**: TextSelection + AnchorSystem with 99%+ accuracy
- **Storage & Persistence**: Chrome storage + IndexedDB with migration system
- **User Interface**: Web Components with Shadow DOM and theme system
- **Platform Integration**: ChatGPT adapter with robust DOM handling
- **Interaction Systems**: Keyboard shortcuts + context menu integration
- **Testing**: Comprehensive test suite with 412 tests passing

#### 🚧 **Partially Implemented (Task 14)**
- **Context Menu Integration**: Basic implementation exists, needs completion for selection state tracking

#### 📋 **Next Implementation Priority**
- **Task 15**: Basic Navigation System (bookmark jumping and smooth scrolling)
- **Task 16**: Claude and Grok Platform Adapters
- **Task 17**: Advanced Sidebar UI with search/filtering

### Core Systems

#### 1. Text Anchoring System
**Purpose**: Maintain bookmark positions despite dynamic content changes

**Implementation Strategy**:
- **Primary**: XPath selectors for precise DOM targeting
- **Fallback 1**: Character offset from message boundaries
- **Fallback 2**: Fuzzy text matching with context windows
- **Fallback 3**: Content checksums for drift detection

```typescript
interface TextAnchor {
  selectedText: string;
  startOffset: number;
  endOffset: number;
  xpathSelector: string;
  messageId: string;
  contextBefore: string; // 50 chars
  contextAfter: string;  // 50 chars
  checksum: string;      // SHA-256 of surrounding text
}
```

#### 2. Storage Architecture
**Primary**: `chrome.storage.local` (unlimited quota, encrypted)
**Backup**: IndexedDB for complex queries and relationships

```typescript
interface BookmarkSchema {
  id: string;                    // UUID
  platform: 'chatgpt'|'claude'|'grok';
  conversationId: string;
  messageId: string;
  anchor: TextAnchor;
  note: string;
  tags: string[];
  created: ISO8601DateTime;
  updated: ISO8601DateTime;
  color: string;                 // Hex color code
}
```

#### 3. Platform Adapters
**Pattern**: Adapter pattern for platform-specific implementations

**ChatGPT Adapter**:
- Selector: `[data-testid*="conversation-turn"]`
- Message ID: Extract from `data-testid`
- Conversation ID: Parse from URL `/c/[id]`

**Claude Adapter**:
- Selector: `.prose`, `[class*="message"]`
- Message ID: Content hash generation
- Conversation ID: URL parsing or generation

**Grok Adapter**:
- Selector: TBD (requires DOM inspection)
- Integration with X.com platform considerations

### Development Guidelines

#### Performance Requirements
- **Bookmark creation**: < 100ms
- **Text selection response**: < 50ms  
- **Navigation jumps**: < 200ms
- **Memory usage**: < 50MB for 1000+ bookmarks
- **Zero impact** on host platform performance

#### Security & Privacy
- **Manifest V3 compliance**: Enhanced security model
- **Minimal permissions**: Only `storage`, `activeTab`, `scripting`, `contextMenus`
- **Content Security Policy**: Prevent XSS attacks
- **No external requests**: 100% offline operation; any future platform integrations must avoid direct API calls from the extension
- **Local data at rest**: Stored in `chrome.storage.local` and IndexedDB. Note: Chrome may encrypt at the profile level; the extension does not add application-layer encryption.

#### Browser Compatibility
- **Primary target**: Chrome 88+ (Manifest V3)
- **Secondary**: Edge 88+, Firefox (with manifest adaptation)

## Implementation Methodology

### TDD Approach
All development follows Test-Driven Development as outlined in `TASKS.md`:
1. **Write tests first** - Define expected behavior before implementation
2. **Minimal implementation** - Write just enough code to make tests pass
3. **Refactor** - Improve code quality while maintaining test coverage
4. **Performance validation** - Each task has specific performance targets

### Function Documentation Standards
- **Descriptive names**: All functions must have clear, descriptive names that indicate their purpose
- **Complex functions**: Any function with business logic, multiple parameters, or non-obvious behavior must include JSDoc documentation above the function definition
- **Documentation format**:
  ```typescript
  /**
   * Creates a text anchor with multiple fallback strategies for bookmark positioning.
   * 
   * Uses XPath as primary method, character offset as fallback, and fuzzy matching
   * as final fallback to ensure bookmark persistence across DOM changes.
   * 
   * @param selectedRange - The Range object representing selected text
   * @param messageElement - The DOM element containing the message
   * @returns TextAnchor object with multiple positioning strategies
   * @throws Error if selectedRange is invalid or contains no text
   */
  ```

### Folder Documentation Requirements
Each subfolder in `src/` must contain a `README.md` with:
- **Purpose**: What functionality this folder provides
- **Key components**: Brief description of main files/classes
- **Integration points**: How it connects to other parts of the system
- **Performance considerations**: Any specific optimization notes
- **Testing approach**: How components in this folder should be tested

### Current Technology Stack
```json
// Current dependencies (package.json)
{
  "typescript": "^5.9.2",        // Type safety and modern JS features
  "jest": "^30.0.5",             // Testing framework
  "@types/jest": "^30.0.0",      // TypeScript support for Jest
  "eslint": "^9.33.0",           // Code quality and style enforcement
  "prettier": "^3.6.2",          // Code formatting
  "husky": "^9.1.7"              // Git hooks for quality gates
}
```

### Planned Chrome Extension Stack
Will be added during Task 1 implementation:
```typescript
// Future dependencies for Chrome extension
"@crxjs/vite-plugin": "^2.0.0",  // HMR for extensions
"vite": "^5.0.0",                // Build tool replacing TypeScript compiler
"@types/chrome": "^0.0.258",     // Chrome extension API types

// Runtime: Zero external dependencies
// Use only Chrome APIs + native browser features for performance and privacy
```

### Implementation Phases

#### Phase 1: Core Bookmarking 
**MVP Features**:
- Text selection and highlighting
- Basic bookmark creation/storage
- Simple navigation between bookmarks
- ChatGPT platform support

**Deliverables**:
- Working extension for ChatGPT
- Basic UI components
- Core storage system
- Text anchoring foundation

#### Phase 2: Multi-Platform & Polish
**Extended Features**:
- Claude and Grok platform support
- Advanced UI (sidebar, search, filtering)
- Performance optimizations
- Cross-conversation navigation

#### Phase 3: Conversation Branching
**V2 Features**:
- Context assembly system
- New thread creation
- Branch relationship tracking
- Token management for context limits

### Testing Strategy

#### Unit Testing
- Text anchoring accuracy: >99%
- Storage operations: <100ms
- Memory leak prevention
- Cross-platform selector reliability

#### Integration Testing
- End-to-end bookmark workflows
- Platform-specific DOM handling
- Dynamic content adaptation
- Performance benchmarking

#### Manual Testing
- Real-world AI conversation scenarios
- Cross-browser compatibility
- Extension lifecycle events
- User experience validation

## Key Architecture Patterns

### Text Anchoring Strategy
The core challenge is maintaining bookmark positions across dynamic DOM changes. The system uses multiple fallback strategies:

1. **XPath Selectors** (Primary): Precise DOM path targeting
2. **Character Offsets** (Fallback 1): Position relative to message boundaries  
3. **Fuzzy Text Matching** (Fallback 2): Content-based positioning with context windows
4. **Checksum Validation** (Fallback 3): Content integrity verification

This multi-layered approach ensures >99% bookmark position accuracy even with platform UI changes.

### Platform Adapter Pattern  
Each AI platform (ChatGPT, Claude, Grok) has unique DOM structures and interaction patterns. The adapter pattern isolates platform-specific code:

- **ChatGPT**: `[data-testid*="conversation-turn"]` selectors, URL-based conversation IDs
- **Claude**: `.prose` selectors, content hash message IDs
- **Grok**: X.com integration considerations, platform-specific APIs

### Storage Architecture
Dual storage approach for performance and reliability:
- **Primary**: `chrome.storage.local` (unlimited quota, encrypted, fast)
- **Secondary**: IndexedDB (complex queries, relationships, offline capability)

### Chrome Extension Development Workflow (Future)
```bash
# Development (after Task 1 completion)
npm run dev          # Start development with HMR
npm run build        # Production extension build
npm run build:dev    # Development build with source maps

# Extension-specific commands
npm run pack         # Create .crx package for distribution  
npm run load         # Load unpacked extension in Chrome for testing
npm run test:e2e     # End-to-end extension testing with Playwright
```

### Code Quality Standards

#### TypeScript Configuration
- **Strict mode enabled**: No implicit any, strict null checks
- **Target ES2020**: Modern browser features
- **Module resolution**: Node.js style imports
- **Declaration files**: Generate .d.ts for public APIs

#### Code Style
- **No runtime dependencies**: Pure Chrome APIs only
- **Functional programming**: Prefer pure functions
- **Error handling**: Comprehensive try-catch with fallbacks
- **Performance first**: Lazy loading, efficient DOM queries
- **Memory management**: Proper cleanup, WeakMap usage

#### Security Checklist
- [ ] No eval() or innerHTML usage
- [ ] Content Security Policy compliant
- [ ] Input sanitization for user notes
- [ ] Secure inter-context messaging
- [ ] Principle of least privilege for permissions

This repository is architected for enterprise-grade reliability while maintaining zero operational costs through a pure client-side implementation.