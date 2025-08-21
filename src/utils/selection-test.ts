/**
 * Text Selection Testing Utilities
 * 
 * Provides testing functions to validate text selection and anchoring
 * functionality across different scenarios and edge cases.
 */

import { TextSelectionManager, PlatformTextSelection } from './text-selection';
import { Platform, TextAnchor, SelectionRange } from '../types/bookmark';

/**
 * Test suite for text selection functionality
 */
export class SelectionTestSuite {
  private manager: TextSelectionManager;
  private platformSelection: PlatformTextSelection;

  constructor() {
    this.manager = new TextSelectionManager();
    this.platformSelection = new PlatformTextSelection();
  }

  /**
   * Run all selection tests and return results
   */
  async runAllTests(): Promise<TestResults> {
    const results: TestResults = {
      passed: 0,
      failed: 0,
      tests: []
    };

    // Basic selection tests
    results.tests.push(await this.testBasicSelection());
    results.tests.push(await this.testMultiNodeSelection());
    results.tests.push(await this.testSelectionRestoration());
    results.tests.push(await this.testAnchorValidation());
    results.tests.push(await this.testPlatformDetection());

    // Count results
    results.tests.forEach(test => {
      if (test.passed) results.passed++;
      else results.failed++;
    });

    return results;
  }

  /**
   * Test basic text selection functionality
   */
  private async testBasicSelection(): Promise<TestResult> {
    const testName = 'Basic Selection Test';
    
    try {
      // Create a test element
      const testElement = this.createTestElement('This is a test message for selection.');
      document.body.appendChild(testElement);

      // Simulate text selection
      const range = document.createRange();
      range.setStart(testElement.firstChild!, 10);
      range.setEnd(testElement.firstChild!, 14);
      
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);

        // Test selection capture
        const capturedSelection = this.manager.getCurrentSelection();
        
        if (capturedSelection && capturedSelection.text === 'test') {
          document.body.removeChild(testElement);
          return { name: testName, passed: true, message: 'Successfully captured basic selection' };
        }
      }

      document.body.removeChild(testElement);
      return { name: testName, passed: false, message: 'Failed to capture basic selection' };
    } catch (error) {
      return { name: testName, passed: false, message: `Error: ${error}` };
    }
  }

  /**
   * Test selection across multiple nodes
   */
  private async testMultiNodeSelection(): Promise<TestResult> {
    const testName = 'Multi-Node Selection Test';
    
    try {
      // Create test element with multiple child nodes
      const testElement = document.createElement('div');
      testElement.innerHTML = 'First <span>middle</span> last';
      document.body.appendChild(testElement);

      // Select across multiple nodes
      const range = document.createRange();
      range.setStart(testElement.firstChild!, 2); // "rst"
      range.setEnd(testElement.lastChild!, 2);    // "st"
      
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);

        const capturedSelection = this.manager.getCurrentSelection();
        
        if (capturedSelection && capturedSelection.text.includes('middle')) {
          document.body.removeChild(testElement);
          return { name: testName, passed: true, message: 'Successfully captured multi-node selection' };
        }
      }

      document.body.removeChild(testElement);
      return { name: testName, passed: false, message: 'Failed to capture multi-node selection' };
    } catch (error) {
      return { name: testName, passed: false, message: `Error: ${error}` };
    }
  }

  /**
   * Test selection restoration from anchor
   */
  private async testSelectionRestoration(): Promise<TestResult> {
    const testName = 'Selection Restoration Test';
    
    try {
      // Create test element
      const testElement = this.createTestElement('This is a restoration test message.');
      document.body.appendChild(testElement);

      // Create initial selection
      const range = document.createRange();
      range.setStart(testElement.firstChild!, 10);
      range.setEnd(testElement.firstChild!, 21);
      
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);

        // Capture selection and create anchor
        const capturedSelection = this.manager.getCurrentSelection();
        if (capturedSelection) {
          const anchor = capturedSelection.anchor;
          
          // Clear selection
          this.manager.clearSelection();
          
          // Restore selection from anchor
          const restored = await this.manager.restoreSelection(anchor);
          
          if (restored) {
            const newSelection = window.getSelection();
            const restoredText = newSelection?.toString() || '';
            
            document.body.removeChild(testElement);
            
            if (restoredText === 'restoration') {
              return { name: testName, passed: true, message: 'Successfully restored selection' };
            } else {
              return { name: testName, passed: false, message: `Restored wrong text: "${restoredText}"` };
            }
          }
        }
      }

      document.body.removeChild(testElement);
      return { name: testName, passed: false, message: 'Failed to restore selection' };
    } catch (error) {
      return { name: testName, passed: false, message: `Error: ${error}` };
    }
  }

  /**
   * Test anchor validation
   */
  private async testAnchorValidation(): Promise<TestResult> {
    const testName = 'Anchor Validation Test';
    
    try {
      const testElement = this.createTestElement('Validation test content for anchor.');
      document.body.appendChild(testElement);

      // Create selection
      const range = document.createRange();
      range.setStart(testElement.firstChild!, 0);
      range.setEnd(testElement.firstChild!, 10);
      
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);

        const capturedSelection = this.manager.getCurrentSelection();
        if (capturedSelection) {
          const anchor = capturedSelection.anchor;
          
          // Test validation - should pass initially
          const isValid = this.manager.validateAnchor(anchor);
          
          if (isValid) {
            // Modify content slightly and test again
            testElement.textContent = 'Modified validation test content for anchor.';
            const isStillValid = this.manager.validateAnchor(anchor);
            
            document.body.removeChild(testElement);
            
            if (!isStillValid) {
              return { name: testName, passed: true, message: 'Anchor validation correctly detected changes' };
            } else {
              return { name: testName, passed: false, message: 'Anchor validation failed to detect changes' };
            }
          }
        }
      }

      document.body.removeChild(testElement);
      return { name: testName, passed: false, message: 'Failed to create or validate anchor' };
    } catch (error) {
      return { name: testName, passed: false, message: `Error: ${error}` };
    }
  }

  /**
   * Test platform-specific selection enhancements
   */
  private async testPlatformDetection(): Promise<TestResult> {
    const testName = 'Platform Detection Test';
    
    try {
      const testElement = this.createTestElement('Platform-specific selection test.');
      document.body.appendChild(testElement);

      // Create selection
      const range = document.createRange();
      range.setStart(testElement.firstChild!, 0);
      range.setEnd(testElement.firstChild!, 8);
      
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);

        // Test platform-specific selection for each platform
        const platforms: Platform[] = ['chatgpt', 'claude', 'grok'];
        const results: boolean[] = [];

        for (const platform of platforms) {
          const platformSelection = this.platformSelection.getSelectionForPlatform(platform);
          results.push(platformSelection !== null && platformSelection.text === 'Platform');
        }

        document.body.removeChild(testElement);

        if (results.every(r => r === true)) {
          return { name: testName, passed: true, message: 'Platform-specific selections work for all platforms' };
        } else {
          return { name: testName, passed: false, message: 'Platform-specific selection failed for some platforms' };
        }
      }

      document.body.removeChild(testElement);
      return { name: testName, passed: false, message: 'Failed to create selection for platform testing' };
    } catch (error) {
      return { name: testName, passed: false, message: `Error: ${error}` };
    }
  }

  /**
   * Create a test DOM element with specified text
   */
  private createTestElement(text: string): HTMLElement {
    const element = document.createElement('div');
    element.textContent = text;
    element.style.position = 'absolute';
    element.style.left = '-9999px';
    element.style.top = '-9999px';
    return element;
  }

  /**
   * Log test results to console
   */
  logResults(results: TestResults): void {
    console.group('Text Selection Test Results');
    console.log(`Total: ${results.tests.length}, Passed: ${results.passed}, Failed: ${results.failed}`);
    
    results.tests.forEach(test => {
      if (test.passed) {
        console.log(`✅ ${test.name}: ${test.message}`);
      } else {
        console.error(`❌ ${test.name}: ${test.message}`);
      }
    });
    
    console.groupEnd();
  }
}

/**
 * Test result interfaces
 */
export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

export interface TestResults {
  passed: number;
  failed: number;
  tests: TestResult[];
}

/**
 * Quick test function for manual testing
 */
export async function runSelectionTests(): Promise<TestResults> {
  const testSuite = new SelectionTestSuite();
  const results = await testSuite.runAllTests();
  testSuite.logResults(results);
  return results;
}

// Export classes for direct use
export { SelectionTestSuite };