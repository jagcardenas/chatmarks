# NoteAI - Project Specification Document

**Version:** 1.0  
**Date:** January 2025  
**Status:** Draft

---

## Executive Summary

NoteAI is a browser extension that enhances AI chat platforms (ChatGPT, Claude, Grok) with advanced note-taking and conversation management capabilities. The project will be delivered in two major versions: V1 focusing on intelligent bookmarking with text highlighting, and V2 introducing conversation branching through context-aware thread creation.

---

## Version 1.0 - Intelligent Bookmarking System

### 1.1 Core Concept

Transform AI conversations into navigable documents with persistent, text-anchored bookmarks that maintain their position relative to the source content and enable instant navigation to specific conversation points.

### 1.2 Functional Requirements

#### 1.2.1 Text Selection & Highlighting
- **FR-1.1:** Users can select any text within AI messages (both user and assistant messages)
- **FR-1.2:** Selected text becomes the "anchor" for the bookmark
- **FR-1.3:** Highlighted text receives persistent visual indication (yellow background by default)
- **FR-1.4:** Multiple text selections per message are supported
- **FR-1.5:** Overlapping selections are handled gracefully with opacity layering

#### 1.2.2 Bookmark Creation
- **FR-2.1:** Bookmarks are created via:
  - Right-click context menu on selected text
  - Keyboard shortcut (Ctrl/Cmd + B)
  - Floating action button on text selection
- **FR-2.2:** Each bookmark includes:
  - Selected text (anchor)
  - User note/comment
  - Timestamp
  - Conversation ID
  - Message ID
  - Character offset position
- **FR-2.3:** Bookmarks auto-save without user intervention

#### 1.2.3 Bookmark Persistence & Scrolling
- **FR-3.1:** Bookmarks maintain position relative to their anchor text
- **FR-3.2:** Bookmark indicators scroll with the conversation
- **FR-3.3:** Bookmarks persist across:
  - Page refreshes
  - Browser restarts
  - Conversation navigation
- **FR-3.4:** Bookmarks remain valid even if surrounding text changes

#### 1.2.4 Navigation System
- **FR-4.1:** Bookmark sidebar showing all bookmarks for current conversation
- **FR-4.2:** Global bookmark panel accessible via extension popup
- **FR-4.3:** Click-to-jump functionality:
  - Smooth scroll to bookmark position
  - Highlight animation on arrival
  - URL updates with bookmark hash
- **FR-4.4:** Cross-conversation navigation:
  - Jump to different conversation if needed
  - Auto-load conversation before scrolling
- **FR-4.5:** Keyboard navigation (Alt + ↑/↓ between bookmarks)

#### 1.2.5 Visual Indicators
- **FR-5.1:** Inline bookmark indicators in chat stream
- **FR-5.2:** Margin indicators showing bookmark density
- **FR-5.3:** Minimap with bookmark positions
- **FR-5.4:** Color coding for bookmark categories/tags

### 1.3 Technical Requirements

#### 1.3.1 Text Anchoring System
```javascript
// Bookmark anchor structure
{
  anchorType: "text-position",
  selectedText: "original selected text",
  startOffset: 245,
  endOffset: 312,
  xpathSelector: "/div[2]/div[1]/p[3]",
  parentMessageId: "msg_abc123",
  checksum: "sha256_hash_of_surrounding_text"
}
```

**Implementation Approach:**
- Use `Range` API for precise text selection
- Store multiple anchor strategies for resilience:
  - Character offset from message start
  - XPath to text node
  - Surrounding text context (50 chars before/after)
  - Fuzzy matching fallback

#### 1.3.2 Position Tracking
```javascript
// Scroll synchronization
class BookmarkTracker {
  constructor() {
    this.intersectionObserver = new IntersectionObserver(
      this.updateVisibleBookmarks,
      { threshold: [0, 0.5, 1] }
    );
  }
  
  trackBookmark(element, bookmarkId) {
    element.dataset.bookmarkId = bookmarkId;
    this.intersectionObserver.observe(element);
  }
}
```

#### 1.3.3 Storage Schema
```javascript
// IndexedDB schema for bookmarks
{
  bookmarks: {
    id: "uuid",
    platform: "chatgpt|claude|grok",
    conversationId: "conv_123",
    messageId: "msg_456",
    anchor: {
      text: "selected text",
      startOffset: 100,
      endOffset: 150,
      xpath: "...",
      context: { before: "...", after: "..." }
    },
    note: "User's annotation",
    tags: ["important", "todo"],
    created: "2025-01-20T10:30:00Z",
    updated: "2025-01-20T11:00:00Z",
    color: "#ffeb3b"
  }
}
```

### 1.4 Platform-Specific Implementations

#### 1.4.1 ChatGPT
- **Selector:** `[data-testid*="conversation-turn"]`
- **Message ID:** Extract from `data-testid` attribute
- **Conversation ID:** Parse from URL `/c/[id]`
- **Challenges:** React virtual scrolling, dynamic content loading

#### 1.4.2 Claude
- **Selector:** `.prose` or `[class*="message"]`
- **Message ID:** Generate from content hash
- **Conversation ID:** Parse from URL or generate
- **Challenges:** Different DOM structure, frequent updates

#### 1.4.3 Grok
- **Selector:** To be determined based on DOM inspection
- **Message ID:** Extract from data attributes
- **Conversation ID:** Parse from X.com URL structure
- **Challenges:** Integration with X.com platform, real-time updates

### 1.5 User Interface Components

#### 1.5.1 Bookmark Sidebar
```html
<div class="noteai-sidebar">
  <div class="sidebar-header">
    <input type="search" placeholder="Search bookmarks...">
    <button class="filter-btn">Filter</button>
  </div>
  <div class="bookmark-list">
    <div class="bookmark-item" data-bookmark-id="...">
      <div class="bookmark-preview">Selected text...</div>
      <div class="bookmark-note">User note</div>
      <div class="bookmark-meta">
        <span class="timestamp">2 hours ago</span>
        <span class="tags">#important</span>
      </div>
    </div>
  </div>
</div>
```

#### 1.5.2 Inline Bookmark Indicator
```html
<span class="noteai-highlight" data-bookmark-id="...">
  <span class="highlighted-text">Original selected text</span>
  <span class="bookmark-indicator">📌</span>
  <div class="bookmark-tooltip">
    <div class="tooltip-note">User's note</div>
    <div class="tooltip-actions">
      <button>Edit</button>
      <button>Delete</button>
      <button>Jump to</button>
    </div>
  </div>
</span>
```

### 1.6 Performance Requirements

- **Text selection response:** < 50ms
- **Bookmark creation:** < 100ms
- **Navigation jump:** < 200ms
- **Storage operations:** < 100ms
- **Memory usage:** < 50MB for 1000 bookmarks
- **No impact on chat platform performance**

---

## Version 2.0 - Conversation Branching

### 2.1 Core Concept

Enable users to create new conversation threads from any bookmarked point, using all previous conversation context up to that point as the foundation for a new chat session.

### 2.2 Functional Requirements

#### 2.2.1 Branch Creation
- **FR-6.1:** "Branch from here" action on any bookmark
- **FR-6.2:** Capture all conversation history up to bookmark point
- **FR-6.3:** Include both user and assistant messages
- **FR-6.4:** Preserve message order and role attribution

#### 2.2.2 Context Preparation
- **FR-7.1:** Format conversation history as context
- **FR-7.2:** Add system prompt explaining the branch
- **FR-7.3:** Allow user to add branch intention/question
- **FR-7.4:** Handle token limit constraints intelligently

#### 2.2.3 New Thread Initialization
- **FR-8.1:** Programmatically create new chat session
- **FR-8.2:** Inject prepared context as first message
- **FR-8.3:** Maintain link between parent and branch
- **FR-8.4:** Visual indication of branching relationship

### 2.3 Technical Implementation

#### 2.3.1 Context Assembly
```javascript
class ConversationBrancher {
  async branchFromBookmark(bookmarkId) {
    const bookmark = await this.getBookmark(bookmarkId);
    const messages = await this.getMessagesUntil(bookmark.messageId);
    
    const context = this.assembleContext(messages);
    const prompt = this.createBranchPrompt(context, bookmark);
    
    return this.initializeNewChat(prompt);
  }
  
  assembleContext(messages) {
    return messages.map(msg => ({
      role: msg.role, // 'user' or 'assistant'
      content: msg.content,
      timestamp: msg.timestamp
    }));
  }
  
  createBranchPrompt(context, bookmark) {
    return `
      [CONVERSATION BRANCH]
      This is a new conversation thread branched from a previous discussion.
      
      PREVIOUS CONTEXT (up to bookmarked point):
      ${this.formatContext(context)}
      
      BOOKMARKED POINT:
      "${bookmark.anchor.text}"
      
      USER'S NOTE AT BRANCH POINT:
      "${bookmark.note}"
      
      Please continue the conversation with this context in mind.
      The user may want to explore an alternative direction or 
      dive deeper into the bookmarked topic.
      
      [END CONTEXT - New conversation begins below]
    `;
  }
}
```

#### 2.3.2 Platform-Specific Branching

**ChatGPT Approach:**
```javascript
async function createChatGPTBranch(contextPrompt) {
  // Method 1: Use URL manipulation
  window.location.href = 'https://chat.openai.com/?model=gpt-4';
  
  // Wait for page load
  await waitForElement('textarea');
  
  // Insert context prompt
  const textarea = document.querySelector('textarea');
  textarea.value = contextPrompt;
  
  // Trigger input event
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  
  // Optional: Auto-submit
  const submitButton = document.querySelector('[data-testid="send-button"]');
  submitButton.click();
}
```

**Claude Approach (No direct API calls):**
```javascript
async function createClaudeBranch(contextPrompt) {
  // Open a new Claude tab and inject the prepared context into the composer
  // Note: Avoid direct API calls from the extension to preserve privacy policy.
  window.open('https://claude.ai/new', '_blank');
  // The content script in the new tab would wait for the input area and insert contextPrompt.
}
```

**Grok Approach:**
```javascript
async function createGrokBranch(contextPrompt) {
  // Similar to ChatGPT, with X.com specific handling
  // Details TBD based on Grok's API availability
}
```

#### 2.3.3 Branch Tracking
```javascript
// Branch relationship storage
{
  branches: {
    id: "branch_uuid",
    parentConversationId: "conv_123",
    parentBookmarkId: "bookmark_456",
    childConversationId: "conv_789",
    createdAt: "2025-01-20T12:00:00Z",
    branchPoint: {
      messageId: "msg_101",
      messagePreview: "...",
      contextLength: 1500 // tokens
    },
    metadata: {
      purpose: "explore_alternative",
      userNote: "What if we tried a different approach?"
    }
  }
}
```

### 2.4 User Experience Flow

1. **Initiation:**
   - User hovers over bookmark → sees "Branch from here" option
   - Clicks branch action → opens branch dialog

2. **Configuration:**
   ```
   ┌─────────────────────────────────────┐
   │  Create Conversation Branch         │
   ├─────────────────────────────────────┤
   │  Context: 1,247 tokens (15 messages)│
   │                                     │
   │  Branch intention (optional):       │
   │  ┌─────────────────────────────────┐│
   │  │ What if we approached this     ││
   │  │ problem using recursion?       ││
   │  └─────────────────────────────────┘│
   │                                     │
   │  [x] Include bookmark note          │
   │  [x] Link to parent conversation    │
   │  [ ] Auto-submit first message      │
   │                                     │
   │  [Cancel]          [Create Branch]  │
   └─────────────────────────────────────┘
   ```

3. **Execution:**
   - System assembles context
   - Opens new chat tab/window
   - Injects context as first message
   - Waits for user input or auto-submits

4. **Post-Creation:**
   - Shows success notification
   - Updates bookmark with branch indicator
   - Adds branch to navigation tree

### 2.5 Token Management

```javascript
class TokenManager {
  estimateTokens(text) {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
  
  truncateContext(messages, maxTokens = 4000) {
    let tokenCount = 0;
    const truncated = [];
    
    // Prioritize recent messages
    for (let i = messages.length - 1; i >= 0; i--) {
      const msgTokens = this.estimateTokens(messages[i].content);
      if (tokenCount + msgTokens > maxTokens) break;
      truncated.unshift(messages[i]);
      tokenCount += msgTokens;
    }
    
    return {
      messages: truncated,
      tokenCount,
      truncated: messages.length > truncated.length
    };
  }
}
```

### 2.6 Visual Branch Indicators

```css
/* Branch indicator in bookmark */
.bookmark-item.has-branch::after {
  content: "🌿";
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
}

/* Branch tree visualization */
.branch-tree {
  display: flex;
  flex-direction: column;
  padding-left: 20px;
  border-left: 2px solid #0084ff;
}

.branch-node {
  position: relative;
  padding: 10px;
  margin: 5px 0;
}

.branch-node::before {
  content: "";
  position: absolute;
  left: -20px;
  top: 50%;
  width: 18px;
  height: 2px;
  background: #0084ff;
}
```

---

## Implementation Timeline

### Phase 1: V1 Core (Weeks 1-4)
- Week 1: Text selection and highlighting system
- Week 2: Bookmark creation and storage
- Week 3: Navigation and jumping functionality
- Week 4: Platform-specific adaptations

### Phase 2: V1 Polish (Weeks 5-6)
- Week 5: Sidebar UI and search
- Week 6: Performance optimization and testing

### Phase 3: V2 Development (Weeks 7-10)
- Week 7: Context assembly system
- Week 8: Branch creation mechanics
- Week 9: Platform integrations
- Week 10: Branch visualization and tracking

### Phase 4: Testing & Launch (Weeks 11-12)
- Week 11: Beta testing and bug fixes
- Week 12: Documentation and release

---

## Success Metrics

### V1 Metrics
- Bookmark creation time < 100ms
- Text anchor accuracy > 99%
- Successful navigation rate > 99%
- Memory usage < 50MB
- User satisfaction > 4.5/5

### V2 Metrics
- Branch creation success rate > 95%
- Context preservation accuracy > 98%
- Average branch creation time < 5 seconds
- Token optimization efficiency > 90%
- Branch relationship tracking 100% accurate

---

## Risk Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Platform DOM changes | High | High | Implement multiple selectors, fallback strategies |
| Text anchor drift | Medium | Medium | Use multiple anchoring methods, fuzzy matching |
| Token limits | Medium | Low | Smart truncation, summarization options |
| API restrictions | High | Medium | Use DOM manipulation, avoid API dependencies |
| Performance impact | High | Low | Lazy loading, virtual scrolling, IndexedDB |

---

## Appendices

### A. Data Structures
- Complete bookmark schema
- Branch relationship model
- Storage optimization strategies

### B. UI/UX Mockups
- Bookmark sidebar designs
- Branch creation dialog
- Navigation indicators

### C. Testing Plan
- Unit test coverage targets
- Integration test scenarios
- User acceptance criteria

---
