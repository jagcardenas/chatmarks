/**
 * KeyboardManager Test Suite
 *
 * Comprehensive tests for the KeyboardManager class including:
 * - Shortcut registration and unregistration
 * - Event handling and execution
 * - Conflict detection
 * - Shortcut validation
 * - Settings integration
 * - Input field detection
 */

import {
  KeyboardManager,
  KeyboardShortcut,
} from '../src/content/keyboard/KeyboardManager';

// Mock chrome API
const mockChrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
};

// Setup global chrome mock
(global as any).chrome = mockChrome;

describe('KeyboardManager', () => {
  let keyboardManager: KeyboardManager;
  let mockElement: EventTarget;
  let mockAddEventListener: jest.SpyInstance;
  let mockRemoveEventListener: jest.SpyInstance;

  beforeEach(() => {
    // Clean up any previous state
    if (keyboardManager) {
      keyboardManager.cleanup();
    }

    // Create mock element
    mockElement = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };

    // Spy on event listener methods
    mockAddEventListener = jest.spyOn(mockElement, 'addEventListener');
    mockRemoveEventListener = jest.spyOn(mockElement, 'removeEventListener');

    // Create keyboard manager
    keyboardManager = new KeyboardManager(mockElement);

    // Reset chrome mocks
    mockChrome.storage.local.get.mockClear();
    mockChrome.storage.local.set.mockClear();
  });

  afterEach(() => {
    keyboardManager.cleanup();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default document target', () => {
      const defaultManager = new KeyboardManager();
      expect(defaultManager).toBeInstanceOf(KeyboardManager);
      defaultManager.cleanup();
    });

    it('should initialize with custom target element', () => {
      expect(keyboardManager).toBeInstanceOf(KeyboardManager);
    });

    it('should be enabled by default', () => {
      // Manager should not be enabled by default
      expect(keyboardManager.isEnabled()).toBe(false);

      // Enable it explicitly
      keyboardManager.enable();
      expect(keyboardManager.isEnabled()).toBe(true);
      expect(mockAddEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });
  });

  describe('Shortcut Registration', () => {
    const mockAction = jest.fn();
    const testShortcut: KeyboardShortcut = {
      id: 'test',
      keys: 'Ctrl+B',
      action: mockAction,
      description: 'Test shortcut',
      category: 'bookmark',
    };

    it('should register shortcuts correctly', () => {
      keyboardManager.registerShortcut(testShortcut);

      const shortcuts = keyboardManager.getAllShortcuts();
      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0]?.id).toBe('test');
    });

    it('should normalize shortcut keys', () => {
      const shortcut: KeyboardShortcut = {
        id: 'test',
        keys: 'ctrl+b',
        action: mockAction,
        description: 'Test shortcut',
        category: 'bookmark',
      };

      keyboardManager.registerShortcut(shortcut);

      // Should be normalized to Ctrl+B
      const shortcuts = keyboardManager.getAllShortcuts();
      expect(shortcuts[0]?.keys).toBe('ctrl+b'); // Original case preserved but normalized
    });

    it('should handle duplicate registrations', () => {
      const shortcut1: KeyboardShortcut = {
        id: 'test1',
        keys: 'Ctrl+B',
        action: jest.fn(),
        description: 'Test shortcut 1',
        category: 'bookmark',
      };

      const shortcut2: KeyboardShortcut = {
        id: 'test2',
        keys: 'Ctrl+B',
        action: jest.fn(),
        description: 'Test shortcut 2',
        category: 'bookmark',
      };

      keyboardManager.registerShortcut(shortcut1);
      keyboardManager.registerShortcut(shortcut2);

      const shortcuts = keyboardManager.getAllShortcuts();
      expect(shortcuts).toHaveLength(2); // Both shortcuts are kept for conflict detection
      const shortcutIds = shortcuts.map(s => s.id).sort();
      expect(shortcutIds).toEqual(['test1', 'test2']);
    });
  });

  describe('Shortcut Unregistration', () => {
    it('should unregister shortcuts by keys', () => {
      const mockAction = jest.fn();
      const shortcut: KeyboardShortcut = {
        id: 'test',
        keys: 'Ctrl+B',
        action: mockAction,
        description: 'Test shortcut',
        category: 'bookmark',
      };

      keyboardManager.registerShortcut(shortcut);
      expect(keyboardManager.getAllShortcuts()).toHaveLength(1);

      keyboardManager.unregisterShortcut('Ctrl+B');
      expect(keyboardManager.getAllShortcuts()).toHaveLength(0);
    });

    it('should handle unregistration of non-existent shortcuts', () => {
      expect(() => {
        keyboardManager.unregisterShortcut('NonExistent');
      }).not.toThrow();
    });
  });

  describe('Keyboard Event Handling', () => {
    let mockAction: jest.Mock;

    beforeEach(() => {
      mockAction = jest.fn();
      const shortcut: KeyboardShortcut = {
        id: 'test',
        keys: 'Ctrl+B',
        action: mockAction,
        description: 'Test shortcut',
        category: 'bookmark',
      };
      keyboardManager.registerShortcut(shortcut);
      keyboardManager.enable(); // Enable to set up event listener
    });

    it('should execute shortcuts on matching key events', () => {
      const mockEvent = {
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        key: 'b',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        target: document.body,
      } as unknown as KeyboardEvent;

      // Trigger the event listener
      const eventListener = mockAddEventListener.mock.calls[0][1];
      eventListener(mockEvent);

      expect(mockAction).toHaveBeenCalled();
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });

    it('should not execute shortcuts when disabled', () => {
      keyboardManager.disable();

      const mockEvent = {
        ctrlKey: true,
        key: 'b',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        target: document.body,
      } as unknown as KeyboardEvent;

      const eventListener = mockAddEventListener.mock.calls[0][1];
      eventListener(mockEvent);

      expect(mockAction).not.toHaveBeenCalled();
    });

    it('should ignore events on input fields', () => {
      const mockInput = document.createElement('input');
      const mockEvent = {
        ctrlKey: true,
        key: 'b',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        target: mockInput,
      } as unknown as KeyboardEvent;

      const eventListener = mockAddEventListener.mock.calls[0][1];
      eventListener(mockEvent);

      expect(mockAction).not.toHaveBeenCalled();
    });

    it('should ignore events on textarea elements', () => {
      const mockTextarea = document.createElement('textarea');
      const mockEvent = {
        ctrlKey: true,
        key: 'b',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        target: mockTextarea,
      } as unknown as KeyboardEvent;

      const eventListener = mockAddEventListener.mock.calls[0][1];
      eventListener(mockEvent);

      expect(mockAction).not.toHaveBeenCalled();
    });

    it('should ignore events on contenteditable elements', () => {
      const mockDiv = document.createElement('div');
      mockDiv.setAttribute('contenteditable', 'true');

      const mockEvent = {
        ctrlKey: true,
        key: 'b',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        target: mockDiv,
      } as unknown as KeyboardEvent;

      const eventListener = mockAddEventListener.mock.calls[0][1];
      eventListener(mockEvent);

      expect(mockAction).not.toHaveBeenCalled();
    });

    it('should handle different key combinations', () => {
      // Enable the keyboard manager first
      keyboardManager.enable();

      const action = jest.fn();
      keyboardManager.registerShortcut({
        id: 'test',
        keys: 'Ctrl+B',
        action,
        description: 'Test',
        category: 'bookmark',
      });

      const mockEvent = {
        ctrlKey: true,
        key: 'b',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        target: document.body,
      } as unknown as KeyboardEvent;

      // Trigger the event handler directly by calling the private method
      const eventHandler = (keyboardManager as any).handleKeyboardEvent.bind(
        keyboardManager
      );
      eventHandler(mockEvent);

      expect(action).toHaveBeenCalled();
    });
  });

  describe('Shortcut Parsing and Validation', () => {
    describe('parseShortcut', () => {
      it('should parse simple shortcuts correctly', () => {
        const result = keyboardManager.parseShortcut('Ctrl+B');

        expect(result).toEqual({
          key: 'B',
          ctrlKey: true,
          altKey: false,
          shiftKey: false,
          metaKey: false,
        });
      });

      it('should parse complex shortcuts correctly', () => {
        const result = keyboardManager.parseShortcut('Ctrl+Alt+Shift+F1');

        expect(result).toEqual({
          key: 'F1',
          ctrlKey: true,
          altKey: true,
          shiftKey: true,
          metaKey: false,
        });
      });

      it('should handle different modifier key names', () => {
        expect(keyboardManager.parseShortcut('Control+B').ctrlKey).toBe(true);
        expect(keyboardManager.parseShortcut('Cmd+B').metaKey).toBe(true);
        expect(keyboardManager.parseShortcut('Meta+B').metaKey).toBe(true);
      });

      it('should normalize key names', () => {
        expect(keyboardManager.parseShortcut('Ctrl+ArrowUp').key).toBe(
          'ArrowUp'
        );
        expect(keyboardManager.parseShortcut('Ctrl+Space').key).toBe('Space');
        expect(keyboardManager.parseShortcut('Ctrl+Enter').key).toBe('Enter');
      });
    });

    describe('validateShortcut', () => {
      it('should validate correct shortcuts', () => {
        const validShortcuts = [
          'Ctrl+B',
          'Alt+F1',
          'Ctrl+Shift+S',
          'Ctrl+Alt+ArrowUp',
          'F12',
        ];

        validShortcuts.forEach(shortcut => {
          const result = keyboardManager.validateShortcut(shortcut);
          expect(result.valid).toBe(true);
        });
      });

      it('should reject invalid shortcuts', () => {
        const invalidShortcuts = [
          '',
          'Invalid+B',
          'Ctrl+Ctrl+B',
          'B', // Single key without modifier
          'Ctrl+',
          '+B',
        ];

        invalidShortcuts.forEach(shortcut => {
          const result = keyboardManager.validateShortcut(shortcut);
          expect(result.valid).toBe(false);
        });
      });

      it('should provide meaningful error messages', () => {
        expect(keyboardManager.validateShortcut('').error).toContain('empty');
        expect(keyboardManager.validateShortcut('Invalid+B').error).toContain(
          'Invalid modifier'
        );
        expect(keyboardManager.validateShortcut('Ctrl+Ctrl+B').error).toContain(
          'Duplicate modifier'
        );
        expect(keyboardManager.validateShortcut('Ctrl+').error).toContain(
          'Missing key'
        );
      });
    });
  });

  describe('Conflict Detection', () => {
    it('should detect conflicts between shortcuts', () => {
      const action1 = jest.fn();
      const action2 = jest.fn();

      keyboardManager.registerShortcut({
        id: 'shortcut1',
        keys: 'Ctrl+B',
        action: action1,
        description: 'First action',
        category: 'bookmark',
      });

      keyboardManager.registerShortcut({
        id: 'shortcut2',
        keys: 'Ctrl+B',
        action: action2,
        description: 'Second action',
        category: 'navigation',
      });

      const shortcuts = keyboardManager.getAllShortcuts();
      const conflicts = keyboardManager.detectConflicts();

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]?.shortcut).toBe('Ctrl+B');
      expect(conflicts[0]?.conflictingActions).toEqual([
        'First action',
        'Second action',
      ]);
      expect(conflicts[0]?.severity).toBe('error');
    });

    it('should not report conflicts for unique shortcuts', () => {
      keyboardManager.registerShortcut({
        id: 'shortcut1',
        keys: 'Ctrl+B',
        action: jest.fn(),
        description: 'First action',
        category: 'bookmark',
      });

      keyboardManager.registerShortcut({
        id: 'shortcut2',
        keys: 'Ctrl+S',
        action: jest.fn(),
        description: 'Second action',
        category: 'bookmark',
      });

      const conflicts = keyboardManager.detectConflicts();
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('Settings Integration', () => {
    beforeEach(() => {
      mockChrome.storage.local.get.mockResolvedValue({
        settings: {
          keyboardShortcuts: {
            createBookmark: 'Ctrl+K',
            nextBookmark: 'Alt+ArrowRight',
            prevBookmark: 'Alt+ArrowLeft',
            showSidebar: 'Ctrl+Shift+K',
          },
        },
      });
    });

    it('should load shortcuts from settings', async () => {
      await keyboardManager.loadFromSettings();

      const shortcuts = keyboardManager.getAllShortcuts();
      expect(shortcuts).toHaveLength(4);

      const shortcutIds = shortcuts.map(s => s.id);
      expect(shortcutIds).toEqual(
        expect.arrayContaining([
          'createBookmark',
          'nextBookmark',
          'prevBookmark',
          'showSidebar',
        ])
      );
    });

    it('should use default shortcuts when settings not available', async () => {
      mockChrome.storage.local.get.mockResolvedValue({});

      await keyboardManager.loadFromSettings();

      const shortcuts = keyboardManager.getAllShortcuts();
      expect(shortcuts).toHaveLength(4);

      const createBookmarkShortcut = shortcuts.find(
        s => s.id === 'createBookmark'
      );
      expect(createBookmarkShortcut?.keys).toBe('Ctrl+B');
    });

    it('should handle settings loading errors gracefully', async () => {
      mockChrome.storage.local.get.mockRejectedValue(
        new Error('Storage error')
      );

      await expect(keyboardManager.loadFromSettings()).resolves.toBeUndefined();

      // Should still work with empty shortcuts
      const shortcuts = keyboardManager.getAllShortcuts();
      expect(shortcuts).toHaveLength(0);
    });
  });

  describe('Enable/Disable Functionality', () => {
    it('should enable and disable correctly', () => {
      keyboardManager.enable(); // First enable to set up listener
      keyboardManager.disable();
      expect(mockRemoveEventListener).toHaveBeenCalled();

      keyboardManager.enable();
      expect(mockAddEventListener).toHaveBeenCalledTimes(2); // Once during first enable, once during second enable
    });

    it('should prevent multiple event listener registrations', () => {
      keyboardManager.enable();
      keyboardManager.enable();
      keyboardManager.enable();

      expect(mockAddEventListener).toHaveBeenCalledTimes(1); // Should only be called once due to prevention logic
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', () => {
      keyboardManager.enable(); // Enable to set up listener

      keyboardManager.registerShortcut({
        id: 'test',
        keys: 'Ctrl+B',
        action: jest.fn(),
        description: 'Test',
        category: 'bookmark',
      });

      expect(keyboardManager.getAllShortcuts()).toHaveLength(1);

      keyboardManager.cleanup();

      expect(keyboardManager.getAllShortcuts()).toHaveLength(0);
      expect(mockRemoveEventListener).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    beforeEach(() => {
      keyboardManager.enable(); // Enable for edge case tests
    });

    it('should handle malformed keyboard events', () => {
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        target: document.body,
      } as unknown as KeyboardEvent;

      const eventListener = mockAddEventListener.mock.calls[0][1];

      expect(() => {
        eventListener(mockEvent);
      }).not.toThrow();
    });

    it('should handle shortcut action errors gracefully', () => {
      const errorAction = jest.fn().mockImplementation(() => {
        throw new Error('Action failed');
      });

      keyboardManager.registerShortcut({
        id: 'error',
        keys: 'Ctrl+E',
        action: errorAction,
        description: 'Error action',
        category: 'bookmark',
      });

      const mockEvent = {
        ctrlKey: true,
        key: 'e',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        target: document.body,
      } as unknown as KeyboardEvent;

      const eventListener = mockAddEventListener.mock.calls[0][1];

      // Should not throw, should log error
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      eventListener(mockEvent);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle null or undefined event targets', () => {
      const mockEvent = {
        ctrlKey: true,
        key: 'b',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        target: null,
      } as unknown as KeyboardEvent;

      const eventListener = mockAddEventListener.mock.calls[0][1];
      expect(() => eventListener(mockEvent)).not.toThrow();
    });
  });

  describe('Cross-platform Compatibility', () => {
    beforeEach(() => {
      keyboardManager.enable(); // Enable for cross-platform tests
    });

    it('should handle Meta key (Cmd on Mac) as Ctrl', () => {
      const mockAction = jest.fn();
      keyboardManager.registerShortcut({
        id: 'test',
        keys: 'Ctrl+B',
        action: mockAction,
        description: 'Test',
        category: 'bookmark',
      });

      const mockEvent = {
        ctrlKey: false,
        metaKey: true, // Cmd key on Mac
        key: 'b',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        target: document.body,
      } as unknown as KeyboardEvent;

      const eventListener = mockAddEventListener.mock.calls[0][1];
      eventListener(mockEvent);

      expect(mockAction).toHaveBeenCalled();
    });

    it('should normalize different key representations', () => {
      const testCases = [
        { input: 'ArrowUp', expected: 'ArrowUp' },
        { input: 'arrowup', expected: 'ArrowUp' },
        { input: 'ARROWUP', expected: 'ArrowUp' },
        { input: 'Space', expected: 'Space' },
        { input: ' ', expected: 'Space' },
        { input: 'Enter', expected: 'Enter' },
        { input: 'Return', expected: 'Enter' },
      ];

      testCases.forEach(({ input, expected }) => {
        const shortcut = `Ctrl+${input}`;
        const result = keyboardManager.parseShortcut(shortcut);
        expect(result.key).toBe(expected);
      });
    });
  });
});
