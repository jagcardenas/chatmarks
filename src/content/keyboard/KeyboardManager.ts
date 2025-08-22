/**
 * Keyboard Shortcuts Manager
 *
 * Handles parsing, validation, and execution of keyboard shortcuts.
 * Supports customizable shortcuts with conflict detection and platform-specific handling.
 */

import { MessageType, ExtensionMessage } from '../../types/messages';

export interface KeyboardShortcut {
  id: string;
  keys: string;
  action: () => void;
  description: string;
  category: 'bookmark' | 'navigation' | 'ui';
}

export interface ShortcutConflict {
  shortcut: string;
  conflictingActions: string[];
  severity: 'warning' | 'error';
}

export interface ParsedShortcut {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean; // Cmd on Mac
}

export class KeyboardManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map(); // key -> shortcut
  private shortcutKeys: Map<string, string[]> = new Map(); // normalizedKey -> [shortcutIds]
  private eventListener: EventListener | null = null;
  private _isEnabled: boolean = false; // Start disabled, enable explicitly
  private targetElement: EventTarget | null = null;

  /**
   * Initialize the keyboard manager with a target element
   */
  constructor(targetElement: EventTarget = document) {
    this.targetElement = targetElement;
  }

  /**
   * Register a keyboard shortcut
   */
  registerShortcut(shortcut: KeyboardShortcut): void {
    const normalizedKeys = this.normalizeShortcutKeys(shortcut.keys);

    // Store the shortcut by ID
    this.shortcuts.set(shortcut.id, shortcut);

    // Track which shortcuts use which keys
    if (!this.shortcutKeys.has(normalizedKeys)) {
      this.shortcutKeys.set(normalizedKeys, []);
    }
    this.shortcutKeys.get(normalizedKeys)!.push(shortcut.id);
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregisterShortcut(keys: string): void {
    const normalizedKeys = this.normalizeShortcutKeys(keys);
    const shortcutIds = this.shortcutKeys.get(normalizedKeys) || [];

    // Remove all shortcuts with these keys
    for (const id of shortcutIds) {
      this.shortcuts.delete(id);
    }

    this.shortcutKeys.delete(normalizedKeys);
  }

  /**
   * Enable keyboard shortcuts
   */
  enable(): void {
    if (!this._isEnabled && this.targetElement) {
      this.setupEventListener();
      this._isEnabled = true;
    }
  }

  /**
   * Check if keyboard shortcuts are enabled
   */
  isEnabled(): boolean {
    return this._isEnabled;
  }

  /**
   * Disable keyboard shortcuts
   */
  disable(): void {
    if (this._isEnabled) {
      this.removeEventListener();
      this._isEnabled = false;
    }
  }

  /**
   * Setup the keyboard event listener
   */
  private setupEventListener(): void {
    if (this.eventListener) return;

    this.eventListener = (event: Event) => {
      this.handleKeyboardEvent(event as KeyboardEvent);
    };

    this.targetElement?.addEventListener('keydown', this.eventListener);
  }

  /**
   * Remove the keyboard event listener
   */
  private removeEventListener(): void {
    if (this.eventListener && this.targetElement) {
      this.targetElement.removeEventListener('keydown', this.eventListener);
      this.eventListener = null;
    }
  }

  /**
   * Handle keyboard events and execute matching shortcuts
   */
  private handleKeyboardEvent(event: KeyboardEvent): void {
    if (!this._isEnabled) return;

    // Don't interfere with input fields
    if (this.isInputField(event.target as Element)) return;

    const shortcutString = this.eventToShortcutString(event);
    const shortcutIds = this.shortcutKeys.get(shortcutString) || [];
    const shortcut = shortcutIds.length > 0 ? this.shortcuts.get(shortcutIds[0]!) : undefined;

    if (shortcut) {
      event.preventDefault();
      event.stopPropagation();
      try {
        shortcut.action();
      } catch (error) {
        console.error(`Error executing keyboard shortcut ${shortcutString}:`, error);
      }
    }
  }

  /**
   * Check if the target element is an input field
   */
  private isInputField(target: Element | null): boolean {
    if (!target) return false;

    const tagName = target.tagName?.toLowerCase();
    const contentEditable = target.getAttribute('contenteditable');
    const role = target.getAttribute('role');

    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      contentEditable === 'true' ||
      contentEditable === '' ||
      role === 'textbox' ||
      role === 'combobox'
    );
  }

  /**
   * Convert a keyboard event to a normalized shortcut string
   */
  private eventToShortcutString(event: KeyboardEvent): string {
    const parts: string[] = [];

    if (event.ctrlKey || event.metaKey) {
      parts.push('Ctrl');
    }
    if (event.altKey) {
      parts.push('Alt');
    }
    if (event.shiftKey) {
      parts.push('Shift');
    }

    if (event.key) {
      parts.push(this.normalizeKey(event.key));
    }

    return parts.join('+');
  }

  /**
   * Parse a shortcut string into its components
   */
  parseShortcut(shortcutString: string): ParsedShortcut {
    const parts = shortcutString.split('+').map(p => p.trim());
    const modifiers = parts.slice(0, -1);
    const key = parts[parts.length - 1];

    return {
      key: this.normalizeKey(key || ''),
      ctrlKey: modifiers.includes('Ctrl') || modifiers.includes('Control'),
      altKey: modifiers.includes('Alt'),
      shiftKey: modifiers.includes('Shift'),
      metaKey: modifiers.includes('Cmd') || modifiers.includes('Meta'),
    };
  }

  /**
   * Normalize shortcut keys for consistent comparison
   */
  private normalizeShortcutKeys(keys: string): string {
    return keys
      .split('+')
      .map(part => part.trim())
      .map(part => this.normalizeKey(part))
      .join('+');
  }

  /**
   * Normalize key names for consistent comparison
   */
  private normalizeKey(key: string): string {
    if (!key) {
      return '';
    }

    const trimmedKey = key.trim();
    if (trimmedKey.length === 0) {
      return '';
    }

    const keyMap: { [key: string]: string } = {
      'control': 'Ctrl',
      'ctrl': 'Ctrl',
      'alt': 'Alt',
      'shift': 'Shift',
      'meta': 'Ctrl', // Meta key maps to Ctrl for consistency
      'cmd': 'Ctrl',  // Cmd key maps to Ctrl for consistency
      'command': 'Ctrl',
      'arrowup': 'ArrowUp',
      'arrowdown': 'ArrowDown',
      'arrowleft': 'ArrowLeft',
      'arrowright': 'ArrowRight',
      ' ': 'Space',
      'space': 'Space',
      'enter': 'Enter',
      'return': 'Enter',
      'escape': 'Escape',
      'esc': 'Escape',
      'delete': 'Delete',
      'del': 'Delete',
      'backspace': 'Backspace',
      'tab': 'Tab',
      'capslock': 'CapsLock',
      'numlock': 'NumLock',
      'scrolllock': 'ScrollLock',
      'pause': 'Pause',
      'contextmenu': 'ContextMenu',
      'printscreen': 'PrintScreen',
      'insert': 'Insert',
      'home': 'Home',
      'end': 'End',
      'pageup': 'PageUp',
      'pagedown': 'PageDown',
      'f1': 'F1',
      'f2': 'F2',
      'f3': 'F3',
      'f4': 'F4',
      'f5': 'F5',
      'f6': 'F6',
      'f7': 'F7',
      'f8': 'F8',
      'f9': 'F9',
      'f10': 'F10',
      'f11': 'F11',
      'f12': 'F12',
    };

    const normalized = keyMap[trimmedKey.toLowerCase()];
    if (normalized) {
      return normalized;
    }

    // For single character keys, ensure consistent casing
    if (trimmedKey.length === 1) {
      return trimmedKey.toUpperCase();
    }

    // For other keys, capitalize first letter
    return trimmedKey.charAt(0).toUpperCase() + trimmedKey.slice(1).toLowerCase();
  }

  /**
   * Detect conflicts between shortcuts
   */
  detectConflicts(): ShortcutConflict[] {
    const conflicts: ShortcutConflict[] = [];

    // Find conflicts by checking which keys have multiple shortcuts
    for (const [normalizedKeys, shortcutIds] of this.shortcutKeys) {
      if (shortcutIds.length > 1) {
        const conflictingActions = shortcutIds.map(id => {
          const shortcut = this.shortcuts.get(id);
          return shortcut?.description || 'Unknown action';
        });

        conflicts.push({
          shortcut: normalizedKeys,
          conflictingActions,
          severity: 'error',
        });
      }
    }

    return conflicts;
  }

  /**
   * Validate a shortcut string format
   */
  validateShortcut(shortcutString: string): { valid: boolean; error?: string } {
    if (!shortcutString || shortcutString.trim().length === 0) {
      return { valid: false, error: 'Shortcut cannot be empty' };
    }

    const parts = shortcutString.split('+').map(p => p.trim());

    if (parts.length === 0) {
      return { valid: false, error: 'Invalid shortcut format' };
    }

    // Handle case where shortcut is just a single part with no key
    if (parts.length === 1 && parts[0]?.trim() === '') {
      return { valid: false, error: 'Invalid shortcut format' };
    }

    // Check for valid modifier keys
    const validModifiers = new Set(['Ctrl', 'Control', 'Alt', 'Shift', 'Cmd', 'Meta']);
    const modifiers = parts.slice(0, -1);

    for (const modifier of modifiers) {
      if (!validModifiers.has(modifier)) {
        return { valid: false, error: `Invalid modifier key: ${modifier}` };
      }
    }

    // Check for duplicate modifiers
    const uniqueModifiers = new Set(modifiers);
    if (uniqueModifiers.size !== modifiers.length) {
      return { valid: false, error: 'Duplicate modifier keys' };
    }

    // Must have at least one non-modifier key
    if (parts.length === modifiers.length) {
      return { valid: false, error: 'Missing key (e.g., A, B, ArrowUp)' };
    }

    // Check if the key part is valid
    const keyPart = parts[parts.length - 1];
    if (!keyPart || keyPart.trim().length === 0) {
      return { valid: false, error: 'Missing key (e.g., A, B, ArrowUp)' };
    }

    // Single letter keys (like 'B') should require a modifier
    const functionKeys = new Set(['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
                                  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
                                  'Enter', 'Escape', 'Tab', 'Space', 'Delete', 'Insert', 'Home', 'End',
                                  'PageUp', 'PageDown', 'Backspace', 'PrintScreen', 'ScrollLock', 'Pause']);

    if (keyPart.length === 1 && !functionKeys.has(keyPart) && modifiers.length === 0) {
      return { valid: false, error: 'Single letter keys require a modifier (e.g., Ctrl+B)' };
    }

    return { valid: true };
  }

  /**
   * Get all registered shortcuts
   */
  getAllShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Clear all registered shortcuts
   */
  clearAllShortcuts(): void {
    this.shortcuts.clear();
    this.shortcutKeys.clear();
  }

  /**
   * Load shortcuts from settings
   */
  async loadFromSettings(): Promise<void> {
    try {
      const result = await chrome.storage.local.get('settings');
      const settings = result?.settings || {};

      const keyboardShortcuts = settings.keyboardShortcuts || {
        createBookmark: 'Ctrl+B',
        nextBookmark: 'Alt+ArrowDown',
        prevBookmark: 'Alt+ArrowUp',
        showSidebar: 'Ctrl+Shift+B',
      };

      // Clear existing shortcuts
      this.clearAllShortcuts();

      // Register default shortcuts - actual actions will be provided by caller
      this.registerShortcut({
        id: 'createBookmark',
        keys: keyboardShortcuts.createBookmark,
        action: () => {}, // Placeholder - will be overridden
        description: 'Create bookmark from selection',
        category: 'bookmark',
      });

      this.registerShortcut({
        id: 'nextBookmark',
        keys: keyboardShortcuts.nextBookmark,
        action: () => {}, // Placeholder - will be overridden
        description: 'Navigate to next bookmark',
        category: 'navigation',
      });

      this.registerShortcut({
        id: 'prevBookmark',
        keys: keyboardShortcuts.prevBookmark,
        action: () => {}, // Placeholder - will be overridden
        description: 'Navigate to previous bookmark',
        category: 'navigation',
      });

      this.registerShortcut({
        id: 'showSidebar',
        keys: keyboardShortcuts.showSidebar,
        action: () => {}, // Placeholder - will be overridden
        description: 'Show bookmark sidebar',
        category: 'ui',
      });
    } catch (error) {
      console.warn('Failed to load keyboard shortcuts from settings:', error);
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.disable();
    this.clearAllShortcuts();
    this.shortcutKeys.clear();
    this.targetElement = null;
  }
}
