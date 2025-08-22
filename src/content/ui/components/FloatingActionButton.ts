/**
 * FloatingActionButton Web Component
 *
 * A floating action button for bookmark creation with the following features:
 * - Minimal visual footprint with smooth animations
 * - Smart positioning to avoid page content interference
 * - Keyboard accessibility and screen reader support
 * - Context-aware visibility based on text selection
 * - Hover and focus states with visual feedback
 * - Responsive behavior for mobile devices
 */

import { BaseComponent } from './base/BaseComponent';

export interface FloatingActionButtonOptions {
  position?: {
    top: number;
    left: number;
  };
  visible?: boolean;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  theme?: 'light' | 'dark' | 'auto';
}

export class FloatingActionButton extends BaseComponent {
  static componentName = 'floating-action-button';
  static observedAttributes = ['visible', 'disabled', 'size', 'theme'];

  private _visible: boolean = false;
  private _disabled: boolean = false;
  private _size: 'small' | 'medium' | 'large' = 'medium';
  private _theme: 'light' | 'dark' | 'auto' = 'auto';
  private _position: { top: number; left: number } | null = null;
  private _animationTimer: ReturnType<typeof setTimeout> | null = null;
  private _repositionObserver: ResizeObserver | null = null;

  // Size configurations
  private readonly SIZE_CONFIG = {
    small: { size: 40, iconSize: 18 },
    medium: { size: 48, iconSize: 20 },
    large: { size: 56, iconSize: 24 },
  };

  constructor() {
    super();
    this.setupFloatingButton();
    this.setupResponsiveObserver();
  }

  protected getTemplate(): string {
    const config = this.SIZE_CONFIG[this._size];

    return `
      <style>
        :host {
          position: fixed;
          z-index: 2147483646; /* Just below dialogs */
          pointer-events: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          opacity: 0;
          transform: scale(0.8) translateY(8px);
        }
        
        :host([visible]) {
          opacity: 1;
          transform: scale(1) translateY(0);
          pointer-events: auto;
        }
        
        :host([disabled]) {
          opacity: 0.5;
          pointer-events: none;
        }
        
        .fab-button {
          width: ${config.size}px;
          height: ${config.size}px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
          position: relative;
          overflow: hidden;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 
            0 4px 6px -1px rgba(0, 0, 0, 0.1),
            0 2px 4px -1px rgba(0, 0, 0, 0.06);
          outline: none;
        }
        
        /* Theme variations */
        .fab-button--light {
          background: #ffffff;
          color: var(--chatmarks-primary, #2563eb);
          border: 1px solid var(--chatmarks-border, #e5e7eb);
        }
        
        .fab-button--dark {
          background: var(--chatmarks-dark-bg, #1f2937);
          color: #ffffff;
          border: 1px solid var(--chatmarks-dark-border, #374151);
        }
        
        .fab-button--auto {
          background: var(--chatmarks-primary, #2563eb);
          color: #ffffff;
          border: 1px solid transparent;
        }
        
        /* Hover states */
        .fab-button:hover {
          transform: scale(1.05);
          box-shadow: 
            0 8px 10px -3px rgba(0, 0, 0, 0.1),
            0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }
        
        .fab-button--light:hover {
          background: var(--chatmarks-hover, #f3f4f6);
          border-color: var(--chatmarks-primary, #2563eb);
        }
        
        .fab-button--dark:hover {
          background: var(--chatmarks-dark-hover, #374151);
        }
        
        .fab-button--auto:hover {
          background: var(--chatmarks-primary-hover, #1d4ed8);
        }
        
        /* Focus states */
        .fab-button:focus {
          outline: 2px solid var(--chatmarks-primary, #2563eb);
          outline-offset: 2px;
        }
        
        .fab-button:active {
          transform: scale(0.95);
          transition-duration: 0.1s;
        }
        
        /* Disabled state */
        .fab-button:disabled {
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        
        .fab-icon {
          width: ${config.iconSize}px;
          height: ${config.iconSize}px;
          stroke: currentColor;
          fill: none;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
          transition: transform 0.2s ease;
        }
        
        .fab-button:hover .fab-icon {
          transform: scale(1.1);
        }
        
        /* Ripple effect */
        .fab-ripple {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.3);
          transform: translate(-50%, -50%);
          transition: width 0.3s ease, height 0.3s ease;
          pointer-events: none;
        }
        
        .fab-button:active .fab-ripple {
          width: ${config.size * 1.5}px;
          height: ${config.size * 1.5}px;
        }
        
        /* Tooltip */
        .fab-tooltip {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-bottom: 8px;
          padding: 6px 12px;
          background: var(--chatmarks-dark-bg, #1f2937);
          color: #ffffff;
          font-size: 12px;
          font-weight: 500;
          border-radius: 6px;
          white-space: nowrap;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.2s ease, visibility 0.2s ease;
          pointer-events: none;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .fab-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 4px solid transparent;
          border-top-color: var(--chatmarks-dark-bg, #1f2937);
        }
        
        .fab-button:hover .fab-tooltip,
        .fab-button:focus .fab-tooltip {
          opacity: 1;
          visibility: visible;
        }
        
        /* Mobile responsive adjustments */
        @media (max-width: 768px) {
          :host {
            /* Adjust positioning for mobile */
          }
          
          .fab-button {
            /* Slightly larger touch target on mobile */
            min-width: 48px;
            min-height: 48px;
          }
          
          .fab-tooltip {
            /* Hide tooltip on mobile to avoid interference */
            display: none;
          }
        }
        
        /* High contrast mode support */
        @media (prefers-contrast: high) {
          .fab-button {
            border-width: 2px;
          }
          
          .fab-button:focus {
            outline-width: 3px;
          }
        }
        
        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          :host,
          .fab-button,
          .fab-icon,
          .fab-tooltip,
          .fab-ripple {
            transition: none;
          }
          
          .fab-button:hover {
            transform: none;
          }
        }
        
        /* Animation keyframes for entrance */
        @keyframes fab-enter {
          0% {
            opacity: 0;
            transform: scale(0) rotate(180deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }
        
        @keyframes fab-exit {
          0% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
          100% {
            opacity: 0;
            transform: scale(0) rotate(-180deg);
          }
        }
        
        /* Pulse animation for attention */
        @keyframes fab-pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
        
        .fab-button--pulse {
          animation: fab-pulse 2s infinite;
        }
      </style>
      
      <button 
        class="fab-button fab-button--${this._theme}" 
        type="button"
        aria-label="Create bookmark for selected text"
        title="Create bookmark"
        tabindex="0"
        role="button"
      >
        <div class="fab-ripple"></div>
        
        <svg class="fab-icon" viewBox="0 0 24 24" role="img" aria-hidden="true">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
        
        <div class="fab-tooltip" role="tooltip">
          Create bookmark
        </div>
      </button>
    `;
  }

  /**
   * Set up floating button event listeners and behaviors
   */
  private setupFloatingButton(): void {
    requestAnimationFrame(() => {
      this.addButtonEventListeners();
      this.setupKeyboardNavigation();
    });
  }

  /**
   * Add event listeners for button interactions
   */
  private addButtonEventListeners(): void {
    const button = this.$('.fab-button') as HTMLButtonElement;

    // Primary click handler
    button?.addEventListener('click', this.handleButtonClick.bind(this));

    // Touch and mouse interaction handlers
    button?.addEventListener(
      'mousedown',
      this.handleInteractionStart.bind(this)
    );
    button?.addEventListener(
      'touchstart',
      this.handleInteractionStart.bind(this),
      { passive: true }
    );

    // Hover handlers for enhanced UX
    button?.addEventListener('mouseenter', this.handleMouseEnter.bind(this));
    button?.addEventListener('mouseleave', this.handleMouseLeave.bind(this));

    // Focus handlers
    button?.addEventListener('focus', this.handleFocus.bind(this));
    button?.addEventListener('blur', this.handleBlur.bind(this));
  }

  /**
   * Set up keyboard navigation support
   */
  private setupKeyboardNavigation(): void {
    this.addEventListener('keydown', this.handleKeydown.bind(this));
  }

  /**
   * Set up responsive behavior observer
   */
  private setupResponsiveObserver(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this._repositionObserver = new ResizeObserver(() => {
        if (this._visible) {
          this.adjustPosition();
        }
      });

      // Observe viewport changes
      this._repositionObserver.observe(document.body);
    }
  }

  /**
   * Handle button click event
   */
  private handleButtonClick(event: Event): void {
    if (this._disabled) return;

    // Prevent event bubbling to avoid conflicts
    event.stopPropagation();
    event.preventDefault();

    // Add visual feedback
    this.addRippleEffect(event);

    // Dispatch custom click event
    this._event('click', {
      position: this._position,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle interaction start (mouse/touch down)
   */
  private handleInteractionStart(event: Event): void {
    if (this._disabled) return;

    const button = this.$('.fab-button') as HTMLElement;
    if (button) {
      button.style.transform = 'scale(0.95)';

      // Reset transform after a short delay
      setTimeout(() => {
        button.style.transform = '';
      }, 150);
    }
  }

  /**
   * Handle mouse enter for hover effects
   */
  private handleMouseEnter(): void {
    if (this._disabled) return;

    this._event('hover', { state: 'enter' });
  }

  /**
   * Handle mouse leave for hover effects
   */
  private handleMouseLeave(): void {
    if (this._disabled) return;

    this._event('hover', { state: 'leave' });
  }

  /**
   * Handle focus event
   */
  private handleFocus(): void {
    this._event('focus');
  }

  /**
   * Handle blur event
   */
  private handleBlur(): void {
    this._event('blur');
  }

  /**
   * Handle keyboard events
   */
  private handleKeydown(event: KeyboardEvent): void {
    if (this._disabled) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.handleButtonClick(event);
        break;

      case 'Escape':
        this.hide();
        break;
    }
  }

  /**
   * Add ripple effect animation
   */
  private addRippleEffect(event: Event): void {
    const button = this.$('.fab-button') as HTMLElement;
    const ripple = this.$('.fab-ripple') as HTMLElement;

    if (!button || !ripple) return;

    // Reset ripple
    ripple.style.width = '0';
    ripple.style.height = '0';

    // Trigger ripple animation
    requestAnimationFrame(() => {
      const config = this.SIZE_CONFIG[this._size];
      const size = config.size * 1.5;

      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;

      // Reset after animation
      setTimeout(() => {
        ripple.style.width = '0';
        ripple.style.height = '0';
      }, 300);
    });
  }

  /**
   * Show the floating action button with animation
   */
  show(options: FloatingActionButtonOptions = {}): void {
    try {
      // Update configuration if provided
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

      // Show with animation
      this.visible = true;

      // Auto-position if no position specified
      if (!this._position && !options.position) {
        this.autoPosition();
      }

      // Dispatch show event
      this._event('show', options);
    } catch (error) {
      console.error('FloatingActionButton: Error showing button:', error);
    }
  }

  /**
   * Hide the floating action button with animation
   */
  hide(): void {
    try {
      this.visible = false;

      // Clear any pending animations
      if (this._animationTimer) {
        clearTimeout(this._animationTimer);
        this._animationTimer = null;
      }

      // Dispatch hide event
      this._event('hide');
    } catch (error) {
      console.error('FloatingActionButton: Error hiding button:', error);
    }
  }

  /**
   * Set button position manually
   */
  setPosition(position: { top: number; left: number }): void {
    this._position = { ...position };

    const { top, left } = this.constrainPosition(position);

    this.style.top = `${top}px`;
    this.style.left = `${left}px`;

    this._event('position', { top, left });
  }

  /**
   * Auto-position button based on viewport and content
   */
  private autoPosition(): void {
    const { innerWidth: vw, innerHeight: vh } = window;
    const config = this.SIZE_CONFIG[this._size];
    const padding = 20;

    // Default to bottom-right corner
    const position = {
      top: vh - config.size - padding,
      left: vw - config.size - padding,
    };

    this.setPosition(position);
  }

  /**
   * Constrain position to viewport bounds
   */
  private constrainPosition(position: { top: number; left: number }): {
    top: number;
    left: number;
  } {
    const { innerWidth: vw, innerHeight: vh } = window;
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

  /**
   * Adjust position when viewport changes
   */
  private adjustPosition(): void {
    if (this._position) {
      this.setPosition(this._position);
    } else {
      this.autoPosition();
    }
  }

  /**
   * Add pulse animation to draw attention
   */
  pulse(): void {
    const button = this.$('.fab-button') as HTMLElement;
    if (button) {
      button.classList.add('fab-button--pulse');

      setTimeout(() => {
        button.classList.remove('fab-button--pulse');
      }, 4000); // Pulse for 4 seconds
    }
  }

  /**
   * Get current position
   */
  getPosition(): { top: number; left: number } | null {
    return this._position ? { ...this._position } : null;
  }

  /**
   * Visible property getter
   */
  get visible(): boolean {
    return this._visible;
  }

  /**
   * Visible property setter
   */
  set visible(value: boolean) {
    if (this._visible === value) return;

    this._visible = value;

    if (value) {
      this.setAttribute('visible', '');
    } else {
      this.removeAttribute('visible');
    }
  }

  /**
   * Disabled property getter
   */
  get disabled(): boolean {
    return this._disabled;
  }

  /**
   * Disabled property setter
   */
  set disabled(value: boolean) {
    if (this._disabled === value) return;

    this._disabled = value;

    const button = this.$('.fab-button') as HTMLButtonElement;
    if (button) {
      button.disabled = value;
    }

    if (value) {
      this.setAttribute('disabled', '');
    } else {
      this.removeAttribute('disabled');
    }
  }

  /**
   * Size property getter
   */
  get size(): 'small' | 'medium' | 'large' {
    return this._size;
  }

  /**
   * Size property setter
   */
  set size(value: 'small' | 'medium' | 'large') {
    if (this._size === value) return;

    this._size = value;
    this.setAttribute('size', value);

    // Re-render with new size
    this.updateTemplate();
  }

  /**
   * Theme property getter
   */
  get theme(): 'light' | 'dark' | 'auto' {
    return this._theme;
  }

  /**
   * Theme property setter
   */
  set theme(value: 'light' | 'dark' | 'auto') {
    if (this._theme === value) return;

    this._theme = value;
    this.setAttribute('theme', value);

    // Update button theme class
    const button = this.$('.fab-button') as HTMLElement;
    if (button) {
      button.className = `fab-button fab-button--${value}`;
    }
  }

  /**
   * Update template after property changes
   */
  private updateTemplate(): void {
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = this.getTemplate();
      this.setupFloatingButton();
    }
  }

  /**
   * Handle attribute changes
   */
  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    super.attributeChangedCallback(name, oldValue, newValue);

    switch (name) {
      case 'visible':
        this._visible = newValue !== null;
        break;

      case 'disabled':
        this._disabled = newValue !== null;
        const button = this.$('.fab-button') as HTMLButtonElement;
        if (button) {
          button.disabled = this._disabled;
        }
        break;

      case 'size':
        if (newValue && ['small', 'medium', 'large'].includes(newValue)) {
          this._size = newValue as 'small' | 'medium' | 'large';
          this.updateTemplate();
        }
        break;

      case 'theme':
        if (newValue && ['light', 'dark', 'auto'].includes(newValue)) {
          this._theme = newValue as 'light' | 'dark' | 'auto';
          const button = this.$('.fab-button') as HTMLElement;
          if (button) {
            button.className = `fab-button fab-button--${newValue}`;
          }
        }
        break;
    }
  }

  /**
   * Cleanup when component is disconnected
   */
  protected cleanup(): void {
    super.cleanup();

    // Clear timers
    if (this._animationTimer) {
      clearTimeout(this._animationTimer);
      this._animationTimer = null;
    }

    // Disconnect resize observer
    if (this._repositionObserver) {
      this._repositionObserver.disconnect();
      this._repositionObserver = null;
    }
  }
}
