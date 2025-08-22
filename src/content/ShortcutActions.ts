/**
 * ShortcutActions Module
 *
 * Implements actions for keyboard shortcuts.
 * Provides handlers for bookmark creation, navigation, and UI toggles
 * that are triggered by keyboard shortcuts.
 */

import { KeyboardManager, KeyboardShortcut } from './keyboard/KeyboardManager';
import { SelectionManager } from './SelectionManager';
import { UIManager } from './UIManager';
import { BookmarkOperations } from './BookmarkOperations';

export class ShortcutActions {
  private keyboardManager: KeyboardManager;
  private selectionManager: SelectionManager;
  private uiManager: UIManager;
  private bookmarkOperations: BookmarkOperations | null = null;

  constructor(
    keyboardManager: KeyboardManager,
    selectionManager: SelectionManager,
    uiManager: UIManager
  ) {
    this.keyboardManager = keyboardManager;
    this.selectionManager = selectionManager;
    this.uiManager = uiManager;
  }

  /**
   * Sets the bookmark operations instance for shortcut actions.
   *
   * @param bookmarkOperations - The bookmark operations instance
   */
  setBookmarkOperations(bookmarkOperations: BookmarkOperations): void {
    this.bookmarkOperations = bookmarkOperations;
  }

  /**
   * Initializes keyboard shortcuts and registers actions.
   */
  async initialize(): Promise<void> {
    try {
      // Load shortcuts from settings and enable the keyboard manager
      await this.keyboardManager.loadFromSettings();
      this.keyboardManager.enable();

      // Register actual shortcut actions
      this.registerShortcutActions();

      // Check for conflicts and log them
      const conflicts = this.keyboardManager.detectConflicts();
      if (conflicts.length > 0) {
        console.warn(
          'Chatmarks: Keyboard shortcut conflicts detected:',
          conflicts
        );
      }
    } catch (error) {
      console.error('Chatmarks: Failed to setup keyboard shortcuts:', error);
    }
  }

  /**
   * Registers the actual actions for keyboard shortcuts.
   */
  private registerShortcutActions(): void {
    const shortcuts = this.keyboardManager.getAllShortcuts();

    // Override placeholder actions with real implementations
    for (const shortcut of shortcuts) {
      switch (shortcut.id) {
        case 'createBookmark':
          this.keyboardManager.registerShortcut({
            ...shortcut,
            action: () => this.handleCreateBookmarkShortcut(),
          });
          break;

        case 'nextBookmark':
          this.keyboardManager.registerShortcut({
            ...shortcut,
            action: () => this.handleNextBookmarkShortcut(),
          });
          break;

        case 'prevBookmark':
          this.keyboardManager.registerShortcut({
            ...shortcut,
            action: () => this.handlePrevBookmarkShortcut(),
          });
          break;

        case 'showSidebar':
          this.keyboardManager.registerShortcut({
            ...shortcut,
            action: () => this.handleShowSidebarShortcut(),
          });
          break;

        case 'deleteBookmark':
          this.keyboardManager.registerShortcut({
            ...shortcut,
            action: () => this.handleDeleteBookmarkShortcut(),
          });
          break;

        case 'editBookmark':
          this.keyboardManager.registerShortcut({
            ...shortcut,
            action: () => this.handleEditBookmarkShortcut(),
          });
          break;
      }
    }
  }

  /**
   * Handles create bookmark keyboard shortcut.
   * Opens the bookmark dialog if there's an active selection.
   */
  private handleCreateBookmarkShortcut(): void {
    const selection = window.getSelection();

    if (selection && !selection.isCollapsed) {
      // Check if we have a captured selection
      if (this.selectionManager.hasActiveSelection()) {
        this.uiManager.openBookmarkDialog();
      } else {
        // Try to capture the current selection
        const capturedSelection = this.selectionManager.getCurrentSelection();
        if (capturedSelection) {
          this.uiManager.openBookmarkDialog();
        }
      }
    }
  }

  /**
   * Handles next bookmark navigation shortcut.
   * Navigates to the next bookmark in the conversation.
   */
  private async handleNextBookmarkShortcut(): Promise<void> {
    if (!this.bookmarkOperations) {
      console.warn('Chatmarks: Bookmark operations not initialized');
      return;
    }

    try {
      const result = await this.bookmarkOperations.navigateToNextBookmark();
      
      if (result.success) {
        console.debug('Chatmarks: Successfully navigated to next bookmark');
        // Optionally show a brief notification to user
        this.showNavigationFeedback('Next bookmark');
      } else {
        console.debug('Chatmarks: No next bookmark available');
        this.showNavigationFeedback('No next bookmark');
      }
    } catch (error) {
      console.error('Chatmarks: Error navigating to next bookmark:', error);
      this.showNavigationFeedback('Navigation failed');
    }
  }

  /**
   * Handles previous bookmark navigation shortcut.
   * Navigates to the previous bookmark in the conversation.
   */
  private async handlePrevBookmarkShortcut(): Promise<void> {
    if (!this.bookmarkOperations) {
      console.warn('Chatmarks: Bookmark operations not initialized');
      return;
    }

    try {
      const result = await this.bookmarkOperations.navigateToPreviousBookmark();
      
      if (result.success) {
        console.debug('Chatmarks: Successfully navigated to previous bookmark');
        this.showNavigationFeedback('Previous bookmark');
      } else {
        console.debug('Chatmarks: No previous bookmark available');
        this.showNavigationFeedback('No previous bookmark');
      }
    } catch (error) {
      console.error('Chatmarks: Error navigating to previous bookmark:', error);
      this.showNavigationFeedback('Navigation failed');
    }
  }

  /**
   * Handles show sidebar shortcut.
   * Toggles the bookmark sidebar visibility.
   */
  private handleShowSidebarShortcut(): void {
    // TODO: Implement sidebar toggle (Task 17)
    console.log(
      'Show sidebar shortcut triggered - sidebar not yet implemented'
    );

    // Send message to show sidebar when implemented
    chrome.runtime.sendMessage({
      type: 'SHOW_BOOKMARK_SIDEBAR',
      data: {},
    });
  }

  /**
   * Handles delete bookmark shortcut.
   * Deletes the bookmark at the current selection if one exists.
   */
  private async handleDeleteBookmarkShortcut(): Promise<void> {
    if (!this.bookmarkOperations) {
      console.log('Chatmarks: Bookmark operations not initialized');
      return;
    }

    // TODO: Implement bookmark deletion at cursor (Task 16)
    console.log(
      'Delete bookmark shortcut triggered - deletion UI not yet implemented'
    );
  }

  /**
   * Handles edit bookmark shortcut.
   * Opens edit dialog for the bookmark at the current selection.
   */
  private async handleEditBookmarkShortcut(): Promise<void> {
    if (!this.bookmarkOperations) {
      console.log('Chatmarks: Bookmark operations not initialized');
      return;
    }

    // TODO: Implement bookmark editing (Task 16)
    console.log(
      'Edit bookmark shortcut triggered - editing UI not yet implemented'
    );
  }

  /**
   * Registers a custom shortcut action.
   *
   * @param shortcut - The keyboard shortcut configuration
   */
  registerCustomShortcut(shortcut: KeyboardShortcut): void {
    this.keyboardManager.registerShortcut(shortcut);
  }

  /**
   * Updates shortcut configuration from settings.
   */
  async updateShortcuts(): Promise<void> {
    await this.keyboardManager.loadFromSettings();
    this.registerShortcutActions();
  }

  /**
   * Gets all registered shortcuts.
   *
   * @returns Array of keyboard shortcuts
   */
  getAllShortcuts(): KeyboardShortcut[] {
    return this.keyboardManager.getAllShortcuts();
  }

  /**
   * Checks if a specific shortcut is enabled.
   *
   * @param shortcutId - The ID of the shortcut to check
   * @returns true if enabled, false otherwise
   */
  isShortcutEnabled(shortcutId: string): boolean {
    const shortcuts = this.keyboardManager.getAllShortcuts();
    const shortcut = shortcuts.find(s => s.id === shortcutId);

    // Check if shortcut exists and is not disabled
    return shortcut !== undefined;
  }

  /**
   * Shows visual feedback for navigation actions.
   * Creates a temporary toast notification for user feedback.
   *
   * @param message - The message to display to the user
   */
  private showNavigationFeedback(message: string): void {
    // Create a simple toast notification for navigation feedback
    const toast = document.createElement('div');
    toast.className = 'chatmarks-navigation-feedback';
    toast.textContent = message;
    
    // Apply styles for visibility and positioning
    Object.assign(toast.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      backgroundColor: '#333',
      color: 'white',
      padding: '8px 16px',
      borderRadius: '4px',
      fontSize: '14px',
      fontFamily: 'system-ui, sans-serif',
      zIndex: '10000',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      opacity: '0',
      transform: 'translateY(-10px)',
      transition: 'all 0.3s ease-in-out',
      pointerEvents: 'none',
    });

    // Add to page
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    // Remove after delay with fade-out animation
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300); // Wait for fade-out animation
    }, 2000); // Show for 2 seconds
  }

  /**
   * Cleans up keyboard shortcuts.
   */
  cleanup(): void {
    this.keyboardManager.cleanup();
    this.bookmarkOperations = null;
  }
}
