/**
 * ContentScriptInitializer Module
 *
 * Main orchestrator for content script initialization.
 * Coordinates all managers and handles the complete setup
 * and teardown of the bookmark system.
 */

import { Platform } from '../types/bookmark';
import { TextSelection } from './selection/TextSelection';
import { AnchorSystem } from './anchoring/AnchorSystem';
import { ChatGPTAdapter, ClaudeAdapter, GrokAdapter, createPlatformAdapter } from './adapters';
import { HighlightRenderer } from './ui/highlights/HighlightRenderer';
import { KeyboardManager } from './keyboard/KeyboardManager';
import { ThemeManager } from './utils/ThemeManager';
import {
  detectCurrentPlatform,
  extractConversationId,
} from './utils/PlatformUtils';
import { UIManager } from './UIManager';
import { SelectionManager } from './SelectionManager';
import { BookmarkOperations } from './BookmarkOperations';
import { MessageHandler } from './MessageHandler';
import { ShortcutActions } from './ShortcutActions';
import { NavigationController } from './navigation/NavigationController';
import { StorageService } from './storage/StorageService';

export class ContentScriptInitializer {
  // Core managers
  private textSelection: TextSelection | null = null;
  private anchorSystem: AnchorSystem | null = null;
  private platformAdapter: ChatGPTAdapter | ClaudeAdapter | GrokAdapter | null = null;
  private highlightRenderer: HighlightRenderer | null = null;
  private keyboardManager: KeyboardManager | null = null;
  private themeManager: ThemeManager | null = null;
  private storageService: StorageService | null = null;

  // Coordinators
  private uiManager: UIManager | null = null;
  private selectionManager: SelectionManager | null = null;
  private bookmarkOperations: BookmarkOperations | null = null;
  private messageHandler: MessageHandler | null = null;
  private shortcutActions: ShortcutActions | null = null;
  private navigationController: NavigationController | null = null;

  // State
  private currentPlatform: Platform | null = null;
  private isInitialized: boolean = false;

  /**
   * Initializes the content script based on detected platform.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('Chatmarks: Content script already initialized');
      return;
    }

    try {
      // Detect platform first
      this.currentPlatform = detectCurrentPlatform();

      if (!this.currentPlatform) {
        console.debug('Chatmarks: No supported platform detected');
        return;
      }

      // Initialize platform adapter
      this.platformAdapter = createPlatformAdapter();

      if (!this.platformAdapter) {
        console.warn('Chatmarks: Failed to create platform adapter');
        return;
      }

      // Initialize core managers
      await this.initializeCoreManagers();

      // Initialize coordinators
      await this.initializeCoordinators();

      // Apply theme from settings
      await this.themeManager!.applyThemeFromSettings();

      // Set up all interactions
      await this.setupManagerInteractions();

      // Restore existing highlights
      await this.bookmarkOperations!.restoreExistingHighlights();

      // Notify background script that platform is ready
      await this.messageHandler!.notifyPlatformDetected(this.currentPlatform);

      this.isInitialized = true;
      console.debug(
        `Chatmarks: Content script initialized for platform: ${this.currentPlatform}`
      );
    } catch (error) {
      console.error('Chatmarks: Failed to initialize content script:', error);
      await this.cleanup();
    }
  }

  /**
   * Initializes the core manager instances.
   */
  private async initializeCoreManagers(): Promise<void> {
    // Initialize core managers
    this.textSelection = new TextSelection();
    this.anchorSystem = new AnchorSystem(document);
    this.highlightRenderer = new HighlightRenderer(document);
    this.keyboardManager = new KeyboardManager(document);
    this.themeManager = new ThemeManager();
    this.storageService = new StorageService();
  }

  /**
   * Initializes the coordinator instances.
   */
  private async initializeCoordinators(): Promise<void> {
    // Initialize UI manager
    this.uiManager = new UIManager();

    // Initialize selection manager
    this.selectionManager = new SelectionManager(
      this.textSelection!,
      this.uiManager
    );

    // Initialize bookmark operations
    this.bookmarkOperations = new BookmarkOperations(
      this.anchorSystem!,
      this.highlightRenderer!,
      this.platformAdapter,
      this.currentPlatform!
    );

    // Initialize navigation controller with current conversation
    const conversationId = extractConversationId();
    this.navigationController = new NavigationController(
      this.storageService!,
      this.bookmarkOperations,
      conversationId,
      {
        enableSmoothScrolling: true,
        highlightDuration: 3000,
        enableURLState: true,
        enableCrossConversation: true,
        scrollOffset: 100,
        navigationDebounce: 100,
      }
    );

    // Set navigation controller in bookmark operations
    this.bookmarkOperations.setNavigationController(this.navigationController);

    // Initialize message handler
    this.messageHandler = new MessageHandler();
    this.messageHandler.setBookmarkOperations(this.bookmarkOperations);
    this.messageHandler.setSelectionManager(this.selectionManager);

    // Initialize shortcut actions
    this.shortcutActions = new ShortcutActions(
      this.keyboardManager!,
      this.selectionManager,
      this.uiManager
    );
    this.shortcutActions.setBookmarkOperations(this.bookmarkOperations);
  }

  /**
   * Sets up interactions between all managers.
   */
  private async setupManagerInteractions(): Promise<void> {
    // Set up UI manager callbacks
    this.uiManager!.setCallbacks({
      onSaveBookmark: async (note: string) => {
        const selection = this.selectionManager!.getCurrentSelection();
        if (selection) {
          await this.bookmarkOperations!.saveBookmark(selection, note);
          this.selectionManager!.clearCurrentSelection();
        }
      },
      onCancel: () => {
        this.selectionManager!.clearCurrentSelection();
      },
    });

    // Set up selection manager callbacks
    this.selectionManager!.setCallbacks({
      onSelectionReady: _selection => {
        // Selection ready - UI manager will handle showing the floating button
      },
      onSelectionCleared: () => {
        // Selection cleared - UI manager will handle hiding UI
      },
    });

    // Initialize all managers
    this.selectionManager!.initialize();
    this.messageHandler!.initialize();
    this.shortcutActions!.initialize();
    await this.navigationController!.initialize();
  }

  /**
   * Gets the current platform.
   *
   * @returns The current platform or null
   */
  getCurrentPlatform(): Platform | null {
    return this.currentPlatform;
  }

  /**
   * Checks if the content script is initialized.
   *
   * @returns true if initialized, false otherwise
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Gets the bookmark operations instance.
   *
   * @returns The bookmark operations instance or null
   */
  getBookmarkOperations(): BookmarkOperations | null {
    return this.bookmarkOperations;
  }

  /**
   * Gets the selection manager instance.
   *
   * @returns The selection manager instance or null
   */
  getSelectionManager(): SelectionManager | null {
    return this.selectionManager;
  }

  /**
   * Gets the UI manager instance.
   *
   * @returns The UI manager instance or null
   */
  getUIManager(): UIManager | null {
    return this.uiManager;
  }

  /**
   * Gets the navigation controller instance.
   *
   * @returns The navigation controller instance or null
   */
  getNavigationController(): NavigationController | null {
    return this.navigationController;
  }

  /**
   * Updates the theme with new settings.
   *
   * @param accentColor - The new accent color
   * @param highlightColor - The new highlight color
   */
  async updateTheme(
    accentColor?: string,
    highlightColor?: string
  ): Promise<void> {
    if (this.themeManager) {
      await this.themeManager.updateTheme({
        accentColor,
        highlightColor,
      });
    }
  }

  /**
   * Forces a re-initialization of keyboard shortcuts.
   */
  async updateKeyboardShortcuts(): Promise<void> {
    if (this.shortcutActions) {
      await this.shortcutActions.updateShortcuts();
    }
  }

  /**
   * Gets statistics about the current state.
   *
   * @returns Object with initialization statistics
   */
  getStats(): {
    initialized: boolean;
    platform: Platform | null;
    managersActive: {
      textSelection: boolean;
      anchorSystem: boolean;
      highlightRenderer: boolean;
      keyboardManager: boolean;
      themeManager: boolean;
      storageService: boolean;
      uiManager: boolean;
      selectionManager: boolean;
      bookmarkOperations: boolean;
      messageHandler: boolean;
      shortcutActions: boolean;
      navigationController: boolean;
    };
  } {
    return {
      initialized: this.isInitialized,
      platform: this.currentPlatform,
      managersActive: {
        textSelection: this.textSelection !== null,
        anchorSystem: this.anchorSystem !== null,
        highlightRenderer: this.highlightRenderer !== null,
        keyboardManager: this.keyboardManager !== null,
        themeManager: this.themeManager !== null,
        storageService: this.storageService !== null,
        uiManager: this.uiManager !== null,
        selectionManager: this.selectionManager !== null,
        bookmarkOperations: this.bookmarkOperations !== null,
        messageHandler: this.messageHandler !== null,
        shortcutActions: this.shortcutActions !== null,
        navigationController: this.navigationController !== null,
      },
    };
  }

  /**
   * Cleans up all managers and resources.
   */
  async cleanup(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      // Clean up coordinators
      if (this.navigationController) {
        this.navigationController.cleanup();
        this.navigationController = null;
      }

      if (this.shortcutActions) {
        this.shortcutActions.cleanup();
        this.shortcutActions = null;
      }

      if (this.messageHandler) {
        this.messageHandler.cleanup();
        this.messageHandler = null;
      }

      if (this.selectionManager) {
        this.selectionManager.cleanup();
        this.selectionManager = null;
      }

      if (this.uiManager) {
        this.uiManager.cleanup();
        this.uiManager = null;
      }

      // Clean up core managers
      if (this.textSelection) {
        this.textSelection.cleanup();
        this.textSelection = null;
      }

      if (this.highlightRenderer) {
        this.highlightRenderer.cleanup();
        this.highlightRenderer = null;
      }

      if (this.keyboardManager) {
        this.keyboardManager.cleanup();
        this.keyboardManager = null;
      }

      // Clear references
      this.bookmarkOperations = null;
      this.anchorSystem = null;
      this.platformAdapter = null;
      this.themeManager = null;
      this.storageService = null;
      this.currentPlatform = null;
      this.isInitialized = false;

      console.debug('Chatmarks: Content script cleanup completed');
    } catch (error) {
      console.error('Chatmarks: Error during cleanup:', error);
    }
  }
}
