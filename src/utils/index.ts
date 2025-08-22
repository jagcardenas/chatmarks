/**
 * Utility Functions Index
 *
 * Central export point for all utility functions and classes
 */

// Text selection utilities are now in src/content/selection/TextSelection.ts
// Use TextSelection class instead of deprecated TextSelectionManager/PlatformTextSelection

// Selection testing utilities
export {
  SelectionTestSuite,
  runSelectionTests,
  type TestResult,
  type TestResults,
} from './selection-test';
