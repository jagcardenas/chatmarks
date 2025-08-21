# Utility Functions

## Purpose
Provides core utility functions and classes for text selection, anchoring, and bookmark management across different AI platforms. These utilities handle the complex logic of capturing and restoring text selections reliably.

## Key Components
- **text-selection.ts**: Core text selection management with multiple anchoring strategies
- **selection-test.ts**: Comprehensive testing suite for selection functionality validation
- **index.ts**: Central export point for all utility functions

## Functionality
- **Text Selection Detection**: Captures user text selections with comprehensive metadata
- **Multi-Strategy Anchoring**: XPath selectors, character offsets, and fuzzy matching for reliable positioning
- **Platform-Specific Enhancements**: Tailored selection handling for ChatGPT, Claude, and Grok
- **Selection Restoration**: Robust fallback system to restore selections after DOM changes
- **Validation and Recovery**: Checksum-based validation and intelligent selection recovery

## Integration Points
- **Content Scripts**: Primary consumer of text selection utilities for real-time selection capture
- **Platform Adapters**: Enhanced selection data with platform-specific context
- **Storage System**: Persists anchor data for bookmark restoration across sessions
- **Testing Framework**: Automated validation of selection functionality across scenarios

## Performance Considerations
- Efficient DOM traversal with TreeWalker API for character offset calculation
- Optimized XPath generation with depth limits to prevent excessive DOM traversal
- Cached selection data to minimize redundant processing during rapid selection changes
- Minimal memory footprint with cleanup of temporary DOM modifications during testing

## Testing Approach
- Automated test suite covering basic selection, multi-node selection, and restoration
- Anchor validation tests for detecting content changes and maintaining accuracy
- Platform-specific selection enhancement validation for each supported AI platform
- Interactive test page (test-selection.html) for manual testing and debugging
- Node.js unit tests for non-DOM utility functions and algorithms

## Key Classes

### TextSelectionManager
Main class for text selection operations:
- `getCurrentSelection()`: Captures current selection with comprehensive anchoring
- `restoreSelection(anchor)`: Restores selection using multiple fallback strategies
- `validateAnchor(anchor)`: Verifies anchor integrity after content changes
- `clearSelection()`: Programmatically clears current selection

### PlatformTextSelection
Platform-specific selection enhancements:
- `getSelectionForPlatform(platform)`: Platform-enhanced selection capture
- `restoreSelectionForPlatform(anchor, platform)`: Platform-specific restoration
- Private methods for ChatGPT, Claude, and Grok optimizations

### SelectionTestSuite
Comprehensive testing framework:
- `runAllTests()`: Executes complete test suite with detailed results
- Individual test methods for different selection scenarios
- Console logging and structured result reporting
- Test DOM element creation and cleanup

## Text Anchoring Strategies

1. **XPath Selector (Primary)**
   - Generates robust XPath expressions for DOM element targeting
   - Includes element IDs and sibling positioning for stability
   - Handles both element and text node selection scenarios

2. **Character Offset (Fallback)**
   - Document-wide character position calculation using TreeWalker
   - Works across DOM restructuring if text content remains similar
   - Efficient for programmatic text positioning

3. **Fuzzy Context Matching (Recovery)**
   - Levenshtein distance-based similarity matching
   - 50-character context before and after selection for disambiguation
   - Checksum validation to detect content changes

## Usage Examples

```typescript
// Basic selection capture
const manager = new TextSelectionManager();
const selection = manager.getCurrentSelection();

// Platform-specific enhancements
const platformManager = new PlatformTextSelection();
const enhancedSelection = platformManager.getSelectionForPlatform('chatgpt');

// Selection restoration
const restored = await manager.restoreSelection(bookmark.anchor);

// Running tests
import { runSelectionTests } from './utils';
const testResults = await runSelectionTests();
```