/**
 * UIManager Module
 *
 * Manages UI components for bookmark creation using Web Components.
 * Coordinates FloatingActionButton and BookmarkDialog components,
 * handles positioning, visibility, and user interactions.
 */

import { SelectionRange } from '../types/bookmark';
import { FloatingActionButton } from './ui/components/FloatingActionButton';
import { BookmarkDialog } from './ui/components/BookmarkDialog';
import { EventTracker } from './utils/EventTracker';

export interface UIManagerCallbacks {
  onSaveBookmark: (note: string) => Promise<void>;
  onCancel: () => void;
}

export class UIManager {
  private floatingButton: FloatingActionButton | null = null;
  private bookmarkDialog: BookmarkDialog | null = null;
  private eventTracker: EventTracker;
  private callbacks: UIManagerCallbacks | null = null;
  private currentSelection: SelectionRange | null = null;

  constructor() {
    this.eventTracker = new EventTracker();
    this.registerComponents();
  }

  /**
   * Registers Web Components if not already registered.
   */
  private registerComponents(): void {
    // Register FloatingActionButton if not already registered
    if (!customElements.get('floating-action-button')) {
      customElements.define('floating-action-button', FloatingActionButton);
    }

    // Register BookmarkDialog if not already registered
    if (!customElements.get('bookmark-dialog')) {
      customElements.define('bookmark-dialog', BookmarkDialog);
    }
  }

  /**
   * Sets callbacks for UI interactions.
   *
   * @param callbacks - The callbacks to handle UI events
   */
  setCallbacks(callbacks: UIManagerCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Shows the floating action button at the specified position.
   *
   * @param event - The mouse event for positioning
   * @param selection - The current text selection
   */
  showFloatingButton(event: MouseEvent, selection: SelectionRange): void {
    this.currentSelection = selection;

    if (!this.floatingButton) {
      this.floatingButton = document.createElement(
        'floating-action-button'
      ) as FloatingActionButton;
      this.floatingButton.setAttribute('text', 'Bookmark');

      // Handle button click
      this.eventTracker.addTrackedTypedEventListener(
        this.floatingButton,
        'action-click',
        () => this.openBookmarkDialog()
      );

      document.body.appendChild(this.floatingButton);
    }

    // Calculate position avoiding viewport edges
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const btnWidth = 90;
    const btnHeight = 30;

    let left = event.clientX + margin;
    let top = event.clientY + margin;

    if (left + btnWidth > vw) left = vw - btnWidth - margin;
    if (top + btnHeight > vh) top = vh - btnHeight - margin;

    this.floatingButton.setPosition({ top, left });
    this.floatingButton.show();
  }

  /**
   * Hides the floating action button.
   */
  hideFloatingButton(): void {
    if (this.floatingButton) {
      this.floatingButton.hide();
    }
  }

  /**
   * Opens the bookmark dialog with the current selection.
   */
  openBookmarkDialog(): void {
    if (!this.currentSelection) return;

    if (!this.bookmarkDialog) {
      this.bookmarkDialog = document.createElement(
        'bookmark-dialog'
      ) as BookmarkDialog;

      // Handle dialog events
      this.eventTracker.addTrackedTypedEventListener(
        this.bookmarkDialog,
        'bookmark-save',
        async (event: CustomEvent) => {
          const note = event.detail?.note || '';
          if (this.callbacks?.onSaveBookmark) {
            await this.callbacks.onSaveBookmark(note);
          }
          this.closeBookmarkDialog();
          this.hideFloatingButton();
        }
      );

      this.eventTracker.addTrackedTypedEventListener(
        this.bookmarkDialog,
        'bookmark-cancel',
        () => {
          if (this.callbacks?.onCancel) {
            this.callbacks.onCancel();
          }
          this.closeBookmarkDialog();
        }
      );

      document.body.appendChild(this.bookmarkDialog);
    }

    // Calculate dialog position based on selection
    const rect = this.currentSelection.boundingRect;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dlgWidth = Math.min(480, Math.max(320, Math.floor(vw * 0.35)));
    const dlgHeight = 280; // Approximate height

    const left = Math.min(
      Math.max(12, rect.left + rect.width / 2 - dlgWidth / 2),
      vw - dlgWidth - 12
    );
    const top = Math.min(
      Math.max(12, rect.top - dlgHeight - 12),
      vh - dlgHeight - 12
    );

    // Show dialog with position and content
    const previewText = this.currentSelection.selectedText.slice(0, 140);
    const displayText =
      this.currentSelection.selectedText.length > 140
        ? `${previewText}…`
        : previewText;

    this.bookmarkDialog.show({
      title: 'Create bookmark',
      content: displayText,
      position: { top, left },
    });
    this.bookmarkDialog.show();
  }

  /**
   * Closes the bookmark dialog.
   */
  closeBookmarkDialog(): void {
    if (this.bookmarkDialog) {
      this.bookmarkDialog.hide();
    }
  }

  /**
   * Updates the current selection in the dialog if it's open.
   *
   * @param selection - The new selection
   */
  updateSelection(selection: SelectionRange): void {
    this.currentSelection = selection;

    if (this.bookmarkDialog && this.bookmarkDialog.visible) {
      // If dialog is visible, we'll update it when it's reopened
      // For now, just store the updated selection
    }
  }

  /**
   * Checks if the event target is within extension UI elements.
   *
   * @param target - The event target to check
   * @returns true if within extension UI, false otherwise
   */
  isEventWithinExtensionUI(target: EventTarget | null): boolean {
    if (!target) return false;

    const node = target as Node;

    if (this.floatingButton && this.floatingButton.contains(node)) {
      return true;
    }

    if (this.bookmarkDialog && this.bookmarkDialog.contains(node)) {
      return true;
    }

    // Check for shadow DOM elements
    if (node instanceof Element) {
      const shadowHost = node.getRootNode();
      if (shadowHost instanceof ShadowRoot) {
        if (
          shadowHost.host === this.floatingButton ||
          shadowHost.host === this.bookmarkDialog
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Cleans up all UI elements and event listeners.
   */
  cleanup(): void {
    this.hideFloatingButton();
    this.closeBookmarkDialog();

    if (this.floatingButton && this.floatingButton.parentNode) {
      this.floatingButton.parentNode.removeChild(this.floatingButton);
    }

    if (this.bookmarkDialog && this.bookmarkDialog.parentNode) {
      this.bookmarkDialog.parentNode.removeChild(this.bookmarkDialog);
    }

    this.eventTracker.cleanup();

    this.floatingButton = null;
    this.bookmarkDialog = null;
    this.currentSelection = null;
    this.callbacks = null;
  }

  /**
   * Gets the current selection stored in the UI manager.
   *
   * @returns The current selection or null
   */
  getCurrentSelection(): SelectionRange | null {
    return this.currentSelection;
  }

  /**
   * Clears the current selection.
   */
  clearSelection(): void {
    this.currentSelection = null;
  }
}
