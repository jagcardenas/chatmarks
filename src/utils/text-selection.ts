/**
 * Text Selection Utilities for Chatmarks Extension
 *
 * Legacy utilities file - main implementation moved to src/content/selection/TextSelection.ts
 * This file is kept for backwards compatibility and will be removed in future versions.
 */

import { TextAnchor, SelectionRange, Platform } from '../types/bookmark';
import { TextSelection } from '../content/selection/TextSelection';

/**
 * Main class for handling text selection operations
 * @deprecated Use TextSelection from '../content/selection/TextSelection' instead
 */
export class TextSelectionManager {
  private textSelection: TextSelection;

  constructor() {
    this.textSelection = new TextSelection();
  }

  /**
   * Get the current text selection with comprehensive anchoring data
   * @deprecated Use TextSelection.captureRange() instead
   */
  getCurrentSelection(): SelectionRange | null {
    return this.textSelection.captureRange();
  }

  /**
   * Restore selection for specific platform
   * @deprecated Use TextSelection methods instead
   */
  restoreSelection(anchor: TextAnchor): boolean {
    // Legacy method - returns false for now
    // TODO: Implement restoration logic using anchor data
    console.warn(
      'Legacy restoreSelection called with anchor:',
      anchor.selectedText
    );
    return false;
  }

  /**
   * Clear current selection
   * @deprecated Use TextSelection.clearSelection() instead
   */
  clearSelection(): void {
    this.textSelection.clearSelection();
  }

  /**
   * Validate an anchor
   * @deprecated Legacy method
   */
  validateAnchor(anchor: TextAnchor): boolean {
    return !!anchor.selectedText;
  }
}

/**
 * Platform-specific text selection handler
 * @deprecated Use platform adapters instead
 */
export class PlatformTextSelection {
  private manager: TextSelectionManager;

  constructor() {
    this.manager = new TextSelectionManager();
  }

  /**
   * Restore selection for specific platform
   */
  async restoreSelectionForPlatform(
    anchor: TextAnchor,
    platform: Platform
  ): Promise<boolean> {
    // Could add platform-specific restoration logic here
    console.warn(
      'Platform-specific restoration requested for:',
      platform,
      'with anchor:',
      anchor.selectedText
    );
    return this.manager.restoreSelection(anchor);
  }

  /**
   * Get selection for specific platform
   * @deprecated Legacy method
   */
  getSelectionForPlatform(platform: Platform): SelectionRange | null {
    // Platform-specific selection logic will be implemented here
    console.warn('Platform-specific selection requested for:', platform);
    return this.manager.getCurrentSelection();
  }
}
