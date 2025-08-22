/**
 * SelectionManager Module
 *
 * Manages text selection events and state for bookmark creation.
 * Coordinates with TextSelection for capturing ranges and UIManager
 * for displaying bookmark creation UI.
 */

import { SelectionRange } from '../types/bookmark';
import { TextSelection } from './selection/TextSelection';
import { UIManager } from './UIManager';
import { EventTracker } from './utils/EventTracker';

export interface SelectionManagerCallbacks {
  onSelectionReady: (selection: SelectionRange) => void;
  onSelectionCleared: () => void;
}

export class SelectionManager {
  private textSelection: TextSelection;
  private uiManager: UIManager;
  private eventTracker: EventTracker;
  private currentSelection: SelectionRange | null = null;
  private callbacks: SelectionManagerCallbacks | null = null;
  private selectionTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(textSelection: TextSelection, uiManager: UIManager) {
    this.textSelection = textSelection;
    this.uiManager = uiManager;
    this.eventTracker = new EventTracker();
  }

  /**
   * Sets callbacks for selection events.
   *
   * @param callbacks - The callbacks to handle selection events
   */
  setCallbacks(callbacks: SelectionManagerCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Initializes selection event listeners.
   */
  initialize(): void {
    this.setupSelectionListeners();
  }

  /**
   * Sets up event listeners for text selection.
   */
  private setupSelectionListeners(): void {
    this.eventTracker.addTrackedTypedEventListener(
      document,
      'selectionchange',
      () => this.handleSelectionChange()
    );

    this.eventTracker.addTrackedTypedEventListener(
      document,
      'mouseup',
      (event: MouseEvent) => this.handleMouseUp(event)
    );
  }

  /**
   * Handles text selection changes with comprehensive selection capture.
   */
  private handleSelectionChange(): void {
    const selectionData = this.textSelection.captureRange();

    if (!selectionData) {
      // Hide any visible bookmark creation UI
      this.uiManager.hideFloatingButton();
      this.clearCurrentSelection();
      return;
    }

    // Store current selection for bookmark creation
    this.storeCurrentSelection(selectionData);
  }

  /**
   * Stores current selection data for bookmark creation.
   *
   * @param selectionData - The captured selection range
   */
  private storeCurrentSelection(selectionData: SelectionRange): void {
    this.currentSelection = selectionData;

    // Update UI manager with new selection
    this.uiManager.updateSelection(selectionData);

    // Notify callbacks
    if (this.callbacks?.onSelectionReady) {
      this.callbacks.onSelectionReady(selectionData);
    }
  }

  /**
   * Handles mouse up events for selection completion.
   *
   * @param event - The mouse up event
   */
  private handleMouseUp(event: MouseEvent): void {
    // Clear any existing timeout
    if (this.selectionTimeout) {
      clearTimeout(this.selectionTimeout);
    }

    // Small delay to ensure selection is finalized
    this.selectionTimeout = setTimeout(() => {
      if (this.uiManager.isEventWithinExtensionUI(event.target)) {
        return;
      }

      if (this.currentSelection && this.currentSelection.selectedText.trim()) {
        this.uiManager.showFloatingButton(event, this.currentSelection);
      }
    }, 10);
  }

  /**
   * Gets the current text selection.
   *
   * @returns The current selection or null
   */
  getCurrentSelection(): SelectionRange | null {
    return this.currentSelection;
  }

  /**
   * Clears the current selection and removes any ranges.
   */
  clearCurrentSelection(): void {
    this.currentSelection = null;

    // Clear browser selection
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
    }

    // Clear UI manager selection
    this.uiManager.clearSelection();

    // Notify callbacks
    if (this.callbacks?.onSelectionCleared) {
      this.callbacks.onSelectionCleared();
    }
  }

  /**
   * Programmatically creates a selection from a Range object.
   *
   * @param range - The Range object to select
   * @returns The created SelectionRange or null if failed
   */
  createSelectionFromRange(range: Range): SelectionRange | null {
    const sel = window.getSelection();
    if (!sel) return null;

    // Clear existing selection
    sel.removeAllRanges();

    // Add new range
    sel.addRange(range);

    // Capture the new selection
    const selectionData = this.textSelection.captureRange();

    if (selectionData) {
      this.storeCurrentSelection(selectionData);
    }

    return selectionData;
  }

  /**
   * Checks if there is an active text selection.
   *
   * @returns true if there is an active selection, false otherwise
   */
  hasActiveSelection(): boolean {
    return (
      this.currentSelection !== null &&
      this.currentSelection.selectedText.trim().length > 0
    );
  }

  /**
   * Updates the current selection if the text matches.
   * Useful for maintaining selection after DOM changes.
   *
   * @param selection - The selection to update
   * @returns true if updated successfully, false otherwise
   */
  updateSelection(selection: SelectionRange): boolean {
    if (!this.currentSelection) return false;

    // Check if it's the same selection by comparing text
    if (this.currentSelection.selectedText === selection.selectedText) {
      this.currentSelection = selection;
      this.uiManager.updateSelection(selection);
      return true;
    }

    return false;
  }

  /**
   * Gets selection statistics for debugging.
   *
   * @returns Object with selection statistics
   */
  getSelectionStats(): {
    hasSelection: boolean;
    textLength: number;
    startOffset: number;
    endOffset: number;
  } {
    if (!this.currentSelection) {
      return {
        hasSelection: false,
        textLength: 0,
        startOffset: 0,
        endOffset: 0,
      };
    }

    return {
      hasSelection: true,
      textLength: this.currentSelection.selectedText.length,
      startOffset: this.currentSelection.startOffset,
      endOffset: this.currentSelection.endOffset,
    };
  }

  /**
   * Cleans up event listeners and timers.
   */
  cleanup(): void {
    if (this.selectionTimeout) {
      clearTimeout(this.selectionTimeout);
      this.selectionTimeout = null;
    }

    this.eventTracker.cleanup();
    this.clearCurrentSelection();
    this.callbacks = null;
  }
}
