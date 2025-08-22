# Utility Functions

## Purpose
Provides utility functions and classes for text selection testing and validation. The main text selection functionality has been moved to `src/content/selection/TextSelection.ts` for better architectural organization.

## Key Components
- **selection-test.ts**: Comprehensive testing suite for selection functionality validation
- **index.ts**: Central export point for all utility functions

## Functionality
- **Selection Testing**: Automated validation of text selection and anchoring functionality
- **Test Suite Management**: Comprehensive test scenarios for different selection edge cases
- **Result Reporting**: Structured test results with detailed success/failure analysis

## Integration Points
- **Content Scripts**: Integration with the main TextSelection class for testing
- **Testing Framework**: Automated validation of selection functionality across scenarios
- **Development Tools**: Debugging and validation tools for selection system

## Performance Considerations
- Efficient test execution with proper cleanup of temporary DOM modifications
- Minimal memory footprint with cleanup of test elements and selections
- Optimized test scenarios to avoid redundant processing

## Testing Approach
- Automated test suite covering basic selection, multi-node selection, and restoration
- Platform-specific selection enhancement validation for each supported AI platform
- Interactive test utilities for manual testing and debugging
- Node.js unit tests for non-DOM utility functions and algorithms

## Key Classes

### SelectionTestSuite
Comprehensive testing framework:
- `runAllTests()`: Executes complete test suite with detailed results
- Individual test methods for different selection scenarios
- Console logging and structured result reporting
- Test DOM element creation and cleanup

### Deprecated Classes (Removed)
The following classes have been deprecated and replaced by `TextSelection` in `src/content/selection/`:

- **TextSelectionManager**: Replaced by `TextSelection.captureRange()`
- **PlatformTextSelection**: Platform-specific logic moved to dedicated platform adapters

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
import { TextSelection } from '../content/selection/TextSelection';
const textSelection = new TextSelection();
const selection = textSelection.captureRange();

// Selection restoration (requires anchor resolution)
const restoredRange = anchorSystem.resolveAnchor(bookmark.anchor);
if (restoredRange) {
  textSelection.restoreSelection(restoredRange);
}

// Running tests
import { SelectionTestSuite } from './selection-test';
const testSuite = new SelectionTestSuite();
const testResults = await testSuite.runAllTests();
```