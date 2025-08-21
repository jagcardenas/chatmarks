# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Chatmarks** is a Chrome browser extension that transforms AI conversations into navigable, annotated documents. The project delivers intelligent bookmarking (V1) and conversation branching (V2) capabilities for ChatGPT, Claude, and Grok platforms.

**Current Status**: **Task 6 Complete** - Text Selection and Range API implementation finished with comprehensive test coverage. Currently implementing Task 7: Text Anchoring System with fallback strategies. Core bookmark functionality foundation is established.

**Core Value Proposition:**
- Zero-cost architecture (no servers, no subscriptions)
- Privacy-first design (100% local data storage)
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

## Current Architecture

### Project Structure (Current State)
```
chatmarks/
├── src/
│   ├── content/
│   │   ├── main.ts              # Main content script entry point
│   │   └── selection/           # ✅ COMPLETE: Text Selection System
│   │       ├── TextSelection.ts # Core selection handling (Task 6)
│   │       └── README.md        # Module documentation
│   ├── options/
│   │   └── options.ts           # Extension options page
│   ├── types/
│   │   └── bookmark.ts          # Updated type definitions
│   └── utils/
│       ├── selection-test.ts    # Selection testing utilities
│       └── text-selection.ts    # Legacy compatibility layer
├── tests/
│   ├── text-selection.test.ts   # ✅ 24 tests, all passing (Task 6)
│   └── setup.ts                 # Jest configuration
├── manifest.json                # Chrome extension manifest
├── package.json                 # Dependencies and scripts
├── tsconfig.json                # TypeScript configuration
├── jest.config.js               # Jest testing configuration
├── eslint.config.js             # ESLint rules and configuration
└── TASKS.md                     # Detailed 40-task implementation plan
```

### Next Implementation Phase
Currently implementing Task 7 - Text Anchoring System:
```
src/content/anchoring/           # 🚧 IN PROGRESS: Task 7 Implementation
├── XPathAnchor.ts              # Primary DOM targeting strategy
├── OffsetAnchor.ts             # Character offset fallback
├── FuzzyMatcher.ts             # Text similarity matching
├── AnchorSystem.ts             # Multi-strategy coordinator
└── README.md                   # Anchoring system documentation
```

### Planned Chrome Extension Structure
Future structure for remaining tasks:
```
src/
├── background/
│   └── service-worker.ts       # Background service worker
├── content/
│   ├── adapters/               # Platform-specific implementations (ChatGPT/Claude/Grok)
│   ├── anchoring/              # ✅ Text anchoring system (Task 7)
│   ├── selection/              # ✅ Text selection system (Task 6)
│   ├── storage/                # Chrome storage + IndexedDB persistence
│   └── ui/                     # Web Components for bookmark interface
├── popup/                      # Extension popup interface
└── types/                      # Shared TypeScript definitions
```

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
- **Minimal permissions**: Only `storage`, `activeTab`, `scripting`
- **Content Security Policy**: Prevent XSS attacks
- **No external requests**: 100% offline operation
- **Local data encryption**: Via chrome.storage native encryption

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