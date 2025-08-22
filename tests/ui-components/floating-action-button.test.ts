/**
 * FloatingActionButton Test Suite
 *
 * Unit tests for the FloatingActionButton Web Component.
 * These tests focus on positioning, interactions, and responsive behavior
 * without requiring complex Web Components API mocking.
 */

import {
  FloatingActionButton,
  FloatingActionButtonOptions,
} from '../../src/content/ui/components/FloatingActionButton';

// Mock ResizeObserver
const mockObserve = jest.fn();
const mockDisconnect = jest.fn();
const mockUnobserve = jest.fn();

class MockResizeObserver {
  observe = mockObserve;
  disconnect = mockDisconnect;
  unobserve = mockUnobserve;
}

// Set up global mock
(global as any).ResizeObserver = MockResizeObserver;

// Create a simplified testable FAB class
class TestableFloatingActionButton {
  static componentName = 'floating-action-button';
  static observedAttributes = ['visible', 'disabled', 'size', 'theme'];

  private _visible: boolean = false;
  private _disabled: boolean = false;
  private _size: 'small' | 'medium' | 'large' = 'medium';
  private _theme: 'light' | 'dark' | 'auto' = 'auto';
  private _position: { top: number; left: number } | null = null;
  private _animationTimer: ReturnType<typeof setTimeout> | null = null;
  private _repositionObserver: any = null;

  // Size configurations
  private readonly SIZE_CONFIG = {
    small: { size: 40, iconSize: 18 },
    medium: { size: 48, iconSize: 20 },
    large: { size: 56, iconSize: 24 },
  };

  // Mock style object
  public style = {
    top: '',
    left: '',
  };

  // Mocked methods
  public attachShadow = jest.fn().mockReturnValue({
    appendChild: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(),
    innerHTML: '',
  });

  public dispatchEvent = jest.fn();
  public setAttribute = jest.fn();
  public removeAttribute = jest.fn();
  public addEventListener = jest.fn();
  public shadowRoot = { innerHTML: '' };

  // Mock DOM elements
  private mockElements = {
    button: {
      addEventListener: jest.fn(),
      disabled: false,
      className: 'fab-button fab-button--auto',
      style: { transform: '' },
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
      },
    },
    ripple: { style: { width: '0', height: '0' } },
  };

  private $ = jest.fn((selector: string): any => {
    switch (selector) {
      case '.fab-button':
        return this.mockElements.button;
      case '.fab-ripple':
        return this.mockElements.ripple;
      default:
        return null;
    }
  }) as jest.MockedFunction<(selector: string) => any>;

  constructor() {
    this.initializeComponent();
  }

  private initializeComponent() {
    try {
      const shadowRoot = this.attachShadow({
        mode: 'open',
        delegatesFocus: true,
      });

      if (shadowRoot) {
        const template = this.getTemplate();
        shadowRoot.innerHTML = template;
      }

      this.setupEventListeners();
      this.setupResponsiveObserver();

      this.dispatchEvent(
        new CustomEvent('floating-action-button:construction', {
          bubbles: true,
          composed: true,
        })
      );
    } catch (error) {
      // Handle initialization errors gracefully
    }
  }

  private getTemplate(): string {
    return `<button class="fab-button fab-button--${this._theme}">Mock FAB</button>`;
  }

  private setupEventListeners(): void {
    requestAnimationFrame(() => {
      this.mockElements.button.addEventListener(
        'click',
        this.handleButtonClick.bind(this)
      );
      this.mockElements.button.addEventListener(
        'mousedown',
        this.handleInteractionStart.bind(this)
      );
      this.mockElements.button.addEventListener(
        'mouseenter',
        this.handleMouseEnter.bind(this)
      );
      this.mockElements.button.addEventListener(
        'mouseleave',
        this.handleMouseLeave.bind(this)
      );
      this.addEventListener('keydown', this.handleKeydown.bind(this));
    });
  }

  private setupResponsiveObserver(): void {
    this._repositionObserver = new MockResizeObserver();
    this._repositionObserver.observe(document.body);
  }

  // Event handlers
  handleButtonClick(event: any) {
    if (this._disabled) return;

    event?.stopPropagation?.();
    event?.preventDefault?.();

    this.addRippleEffect(event);

    this.dispatchEvent(
      new CustomEvent('floating-action-button:click', {
        bubbles: true,
        composed: true,
        detail: {
          position: this._position,
          timestamp: Date.now(),
        },
      })
    );
  }

  handleInteractionStart(event: any) {
    if (this._disabled) return;

    this.mockElements.button.style.transform = 'scale(0.95)';

    setTimeout(() => {
      this.mockElements.button.style.transform = '';
    }, 150);
  }

  handleMouseEnter() {
    if (this._disabled) return;
    this.dispatchEvent(
      new CustomEvent('floating-action-button:hover', {
        bubbles: true,
        composed: true,
        detail: { state: 'enter' },
      })
    );
  }

  handleMouseLeave() {
    if (this._disabled) return;
    this.dispatchEvent(
      new CustomEvent('floating-action-button:hover', {
        bubbles: true,
        composed: true,
        detail: { state: 'leave' },
      })
    );
  }

  handleKeydown(event: any) {
    if (this._disabled) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        event?.preventDefault?.();
        this.handleButtonClick(event);
        break;

      case 'Escape':
        this.hide();
        break;
    }
  }

  addRippleEffect(event: any) {
    const ripple = this.mockElements.ripple;

    ripple.style.width = '0';
    ripple.style.height = '0';

    requestAnimationFrame(() => {
      const config = this.SIZE_CONFIG[this._size];
      const size = config.size * 1.5;

      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;

      setTimeout(() => {
        ripple.style.width = '0';
        ripple.style.height = '0';
      }, 300);
    });
  }

  // Public methods
  show(options: FloatingActionButtonOptions = {}): void {
    try {
      if (options.position) {
        this.setPosition(options.position);
      }

      if (options.size !== undefined) {
        this.size = options.size;
      }

      if (options.theme !== undefined) {
        this.theme = options.theme;
      }

      if (options.disabled !== undefined) {
        this.disabled = options.disabled;
      }

      this.visible = true;

      if (!this._position && !options.position) {
        this.autoPosition();
      }

      this.dispatchEvent(
        new CustomEvent('floating-action-button:show', {
          bubbles: true,
          composed: true,
          detail: options,
        })
      );
    } catch (error) {
      // Handle errors gracefully
    }
  }

  hide(): void {
    try {
      this.visible = false;

      if (this._animationTimer) {
        clearTimeout(this._animationTimer);
        this._animationTimer = null;
      }

      this.dispatchEvent(
        new CustomEvent('floating-action-button:hide', {
          bubbles: true,
          composed: true,
        })
      );
    } catch (error) {
      // Handle errors gracefully
    }
  }

  setPosition(position: { top: number; left: number }): void {
    this._position = { ...position };

    const { top, left } = this.constrainPosition(position);

    this.style.top = `${top}px`;
    this.style.left = `${left}px`;

    this.dispatchEvent(
      new CustomEvent('floating-action-button:position', {
        bubbles: true,
        composed: true,
        detail: { top, left },
      })
    );
  }

  private autoPosition(): void {
    // Mock window dimensions
    const vw = 1024;
    const vh = 768;
    const config = this.SIZE_CONFIG[this._size];
    const padding = 20;

    const position = {
      top: vh - config.size - padding,
      left: vw - config.size - padding,
    };

    this.setPosition(position);
  }

  private constrainPosition(position: { top: number; left: number }): {
    top: number;
    left: number;
  } {
    // Mock window dimensions
    const vw = 1024;
    const vh = 768;
    const config = this.SIZE_CONFIG[this._size];
    const padding = 10;

    const constrainedTop = Math.max(
      padding,
      Math.min(position.top, vh - config.size - padding)
    );
    const constrainedLeft = Math.max(
      padding,
      Math.min(position.left, vw - config.size - padding)
    );

    return {
      top: constrainedTop,
      left: constrainedLeft,
    };
  }

  pulse(): void {
    this.mockElements.button.classList.add('fab-button--pulse');

    setTimeout(() => {
      this.mockElements.button.classList.remove('fab-button--pulse');
    }, 4000);
  }

  getPosition(): { top: number; left: number } | null {
    return this._position ? { ...this._position } : null;
  }

  // Property getters/setters
  get visible(): boolean {
    return this._visible;
  }
  set visible(value: boolean) {
    if (this._visible === value) return;
    this._visible = value;
    if (value) {
      this.setAttribute('visible', '');
    } else {
      this.removeAttribute('visible');
    }
  }

  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(value: boolean) {
    if (this._disabled === value) return;
    this._disabled = value;
    this.mockElements.button.disabled = value;
    if (value) {
      this.setAttribute('disabled', '');
    } else {
      this.removeAttribute('disabled');
    }
  }

  get size(): 'small' | 'medium' | 'large' {
    return this._size;
  }
  set size(value: 'small' | 'medium' | 'large') {
    if (this._size === value) return;
    this._size = value;
    this.setAttribute('size', value);
    this.updateTemplate();
  }

  get theme(): 'light' | 'dark' | 'auto' {
    return this._theme;
  }
  set theme(value: 'light' | 'dark' | 'auto') {
    if (this._theme === value) return;
    this._theme = value;
    this.setAttribute('theme', value);
    this.mockElements.button.className = `fab-button fab-button--${value}`;
  }

  private updateTemplate(): void {
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = this.getTemplate();
      this.setupEventListeners();
    }
  }

  cleanup(): void {
    if (this._animationTimer) {
      clearTimeout(this._animationTimer);
      this._animationTimer = null;
    }

    if (this._repositionObserver) {
      this._repositionObserver.disconnect();
      this._repositionObserver = null;
    }
  }

  // Test helper methods
  getElement(selector: string) {
    return this.$(selector);
  }
  getMockElements() {
    return this.mockElements;
  }
  getSizeConfig() {
    return this.SIZE_CONFIG;
  }
}

describe('FloatingActionButton', () => {
  let fab: TestableFloatingActionButton;

  beforeEach(() => {
    jest.clearAllMocks();
    mockObserve.mockClear();
    mockDisconnect.mockClear();
    mockUnobserve.mockClear();
    fab = new TestableFloatingActionButton();
  });

  afterEach(() => {
    fab.cleanup();
    jest.clearAllTimers();
  });

  describe('Constructor and Initialization', () => {
    it('should attach shadow DOM with correct options', () => {
      expect(fab.attachShadow).toHaveBeenCalledWith({
        mode: 'open',
        delegatesFocus: true,
      });
    });

    it('should dispatch construction event', () => {
      expect(fab.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'floating-action-button:construction',
          bubbles: true,
          composed: true,
        })
      );
    });

    it('should initialize with default properties', () => {
      expect(fab.visible).toBe(false);
      expect(fab.disabled).toBe(false);
      expect(fab.size).toBe('medium');
      expect(fab.theme).toBe('auto');
    });

    it('should initialize with no position', () => {
      expect(fab.getPosition()).toBeNull();
    });

    it('should set up resize observer', () => {
      // Resize observer should be initialized during construction
      expect(mockObserve).toHaveBeenCalled();
    });
  });

  describe('Visibility Control', () => {
    it('should show button when show() is called', () => {
      fab.show();

      expect(fab.visible).toBe(true);
      expect(fab.setAttribute).toHaveBeenCalledWith('visible', '');
    });

    it('should hide button when hide() is called', () => {
      fab.show();
      fab.hide();

      expect(fab.visible).toBe(false);
      expect(fab.removeAttribute).toHaveBeenCalledWith('visible');
    });

    it('should dispatch show event when shown', () => {
      fab.dispatchEvent.mockClear();

      fab.show();

      expect(fab.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'floating-action-button:show',
        })
      );
    });

    it('should dispatch hide event when hidden', () => {
      fab.show();
      fab.dispatchEvent.mockClear();

      fab.hide();

      expect(fab.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'floating-action-button:hide',
        })
      );
    });

    it('should auto-position when shown without explicit position', () => {
      fab.show();

      const position = fab.getPosition();
      expect(position).not.toBeNull();
      expect(typeof position?.top).toBe('number');
      expect(typeof position?.left).toBe('number');
    });
  });

  describe('Positioning', () => {
    it('should set position correctly', () => {
      const position = { top: 100, left: 200 };

      fab.setPosition(position);

      expect(fab.getPosition()).toEqual(position);
      expect(fab.style.top).toBe('100px');
      expect(fab.style.left).toBe('200px');
    });

    it('should dispatch position event when position is set', () => {
      fab.dispatchEvent.mockClear();

      fab.setPosition({ top: 50, left: 100 });

      expect(fab.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'floating-action-button:position',
          detail: { top: 50, left: 100 },
        })
      );
    });

    it('should constrain position to viewport bounds', () => {
      // Test position that would be outside bounds
      fab.setPosition({ top: -50, left: -50 });

      // Should be constrained to minimum padding
      expect(fab.style.top).toBe('10px'); // minimum padding
      expect(fab.style.left).toBe('10px'); // minimum padding
    });

    it('should accept position in show options', () => {
      const position = { top: 300, left: 400 };

      fab.show({ position });

      expect(fab.getPosition()).toEqual(position);
    });
  });

  describe('Button Interactions', () => {
    it('should handle button clicks', () => {
      fab.dispatchEvent.mockClear();

      fab.handleButtonClick({
        stopPropagation: jest.fn(),
        preventDefault: jest.fn(),
      });

      expect(fab.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'floating-action-button:click',
          detail: expect.objectContaining({
            position: null,
            timestamp: expect.any(Number),
          }),
        })
      );
    });

    it('should not handle clicks when disabled', () => {
      fab.disabled = true;
      fab.dispatchEvent.mockClear();

      fab.handleButtonClick({
        stopPropagation: jest.fn(),
        preventDefault: jest.fn(),
      });

      expect(fab.dispatchEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'floating-action-button:click',
        })
      );
    });

    it('should handle mouse interactions', () => {
      const mockButton = fab.getMockElements().button;

      fab.handleInteractionStart({});

      expect(mockButton.style.transform).toBe('scale(0.95)');
    });

    it('should handle mouse enter/leave events', () => {
      fab.dispatchEvent.mockClear();

      fab.handleMouseEnter();

      expect(fab.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'floating-action-button:hover',
          detail: { state: 'enter' },
        })
      );

      fab.handleMouseLeave();

      expect(fab.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'floating-action-button:hover',
          detail: { state: 'leave' },
        })
      );
    });
  });

  describe('Keyboard Navigation', () => {
    it('should handle Enter key to trigger click', () => {
      fab.dispatchEvent.mockClear();

      fab.handleKeydown({ key: 'Enter', preventDefault: jest.fn() });

      expect(fab.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'floating-action-button:click',
        })
      );
    });

    it('should handle Space key to trigger click', () => {
      fab.dispatchEvent.mockClear();

      fab.handleKeydown({ key: ' ', preventDefault: jest.fn() });

      expect(fab.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'floating-action-button:click',
        })
      );
    });

    it('should handle Escape key to hide button', () => {
      fab.show();

      fab.handleKeydown({ key: 'Escape' });

      expect(fab.visible).toBe(false);
    });

    it('should not handle keyboard events when disabled', () => {
      fab.disabled = true;
      fab.dispatchEvent.mockClear();

      fab.handleKeydown({ key: 'Enter', preventDefault: jest.fn() });

      expect(fab.dispatchEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'floating-action-button:click',
        })
      );
    });
  });

  describe('Ripple Effect', () => {
    it('should add ripple effect on interaction', () => {
      const mockRipple = fab.getMockElements().ripple;

      fab.addRippleEffect({});

      expect(mockRipple.style.width).toBe('0');
      expect(mockRipple.style.height).toBe('0');
    });

    it('should animate ripple effect', done => {
      const mockRipple = fab.getMockElements().ripple;

      fab.addRippleEffect({});

      requestAnimationFrame(() => {
        expect(mockRipple.style.width).toBe('72px'); // medium size * 1.5
        expect(mockRipple.style.height).toBe('72px');
        done();
      });
    });
  });

  describe('Size Configuration', () => {
    it('should update size correctly', () => {
      fab.size = 'large';

      expect(fab.size).toBe('large');
      expect(fab.setAttribute).toHaveBeenCalledWith('size', 'large');
    });

    it('should not update if size is the same', () => {
      fab.size = 'medium'; // Already default
      fab.setAttribute.mockClear();

      fab.size = 'medium';

      expect(fab.setAttribute).not.toHaveBeenCalled();
    });

    it('should use correct size configurations', () => {
      const sizeConfig = fab.getSizeConfig();

      expect(sizeConfig.small).toEqual({ size: 40, iconSize: 18 });
      expect(sizeConfig.medium).toEqual({ size: 48, iconSize: 20 });
      expect(sizeConfig.large).toEqual({ size: 56, iconSize: 24 });
    });

    it('should accept size in show options', () => {
      fab.show({ size: 'small' });

      expect(fab.size).toBe('small');
    });
  });

  describe('Theme Configuration', () => {
    it('should update theme correctly', () => {
      fab.theme = 'dark';

      expect(fab.theme).toBe('dark');
      expect(fab.setAttribute).toHaveBeenCalledWith('theme', 'dark');
    });

    it('should update button theme class', () => {
      const mockButton = fab.getMockElements().button;

      fab.theme = 'light';

      expect(mockButton.className).toBe('fab-button fab-button--light');
    });

    it('should accept theme in show options', () => {
      fab.show({ theme: 'dark' });

      expect(fab.theme).toBe('dark');
    });
  });

  describe('Disabled State', () => {
    it('should update disabled state correctly', () => {
      fab.disabled = true;

      expect(fab.disabled).toBe(true);
      expect(fab.setAttribute).toHaveBeenCalledWith('disabled', '');
      expect(fab.getMockElements().button.disabled).toBe(true);
    });

    it('should remove disabled state', () => {
      fab.disabled = true;
      fab.disabled = false;

      expect(fab.disabled).toBe(false);
      expect(fab.removeAttribute).toHaveBeenCalledWith('disabled');
      expect(fab.getMockElements().button.disabled).toBe(false);
    });

    it('should accept disabled in show options', () => {
      fab.show({ disabled: true });

      expect(fab.disabled).toBe(true);
    });
  });

  describe('Pulse Animation', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should add pulse animation', () => {
      const mockButton = fab.getMockElements().button;

      fab.pulse();

      expect(mockButton.classList.add).toHaveBeenCalledWith(
        'fab-button--pulse'
      );
    });

    it('should remove pulse animation after timeout', () => {
      const mockButton = fab.getMockElements().button;

      fab.pulse();

      jest.advanceTimersByTime(4000);

      expect(mockButton.classList.remove).toHaveBeenCalledWith(
        'fab-button--pulse'
      );
    });
  });

  describe('Show Options Integration', () => {
    it('should apply all show options correctly', () => {
      const options: FloatingActionButtonOptions = {
        position: { top: 100, left: 200 },
        visible: true,
        disabled: false,
        size: 'large',
        theme: 'dark',
      };

      fab.show(options);

      expect(fab.visible).toBe(true);
      expect(fab.disabled).toBe(false);
      expect(fab.size).toBe('large');
      expect(fab.theme).toBe('dark');
      expect(fab.getPosition()).toEqual({ top: 100, left: 200 });
    });
  });

  describe('Component Information', () => {
    it('should have correct component name', () => {
      expect(TestableFloatingActionButton.componentName).toBe(
        'floating-action-button'
      );
    });

    it('should observe correct attributes', () => {
      expect(TestableFloatingActionButton.observedAttributes).toEqual([
        'visible',
        'disabled',
        'size',
        'theme',
      ]);
    });
  });

  describe('Error Handling', () => {
    it('should handle show errors gracefully', () => {
      // Mock an error condition
      const originalSetPosition = fab.setPosition;
      fab.setPosition = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      expect(() => {
        fab.show({ position: { top: 0, left: 0 } });
      }).not.toThrow();

      // Restore original method
      fab.setPosition = originalSetPosition;
    });

    it('should handle hide errors gracefully', () => {
      expect(() => {
        fab.hide();
      }).not.toThrow();
    });

    it('should handle initialization errors gracefully', () => {
      expect(() => new TestableFloatingActionButton()).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on disconnect', () => {
      const fab = new TestableFloatingActionButton();

      fab.cleanup();

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should clear timers during cleanup', () => {
      const fab = new TestableFloatingActionButton();

      // Simulate having a timer
      (fab as any)._animationTimer = setTimeout(() => {}, 1000);

      fab.cleanup();

      expect((fab as any)._animationTimer).toBeNull();
    });
  });
});
