/**
 * BookmarkDialog Web Component
 *
 * A modal dialog for bookmark creation with the following features:
 * - Modal dialog with overlay
 * - Keyboard navigation (Tab, Escape)
 * - Accessibility compliance (WCAG 2.1 AA)
 * - Focus management
 * - Smooth animations
 * - Platform-adaptive theming
 */

import { BaseComponent } from './base/BaseComponent';

export interface BookmarkDialogOptions {
  title?: string;
  content?: string;
  position?: {
    top: number;
    left: number;
  };
}

export class BookmarkDialog extends BaseComponent {
  static componentName = 'bookmark-dialog';
  static observedAttributes = ['visible', 'title'];

  private _visible: boolean = false;
  private _title: string = '';
  private _previousFocus: Element | null = null;

  constructor() {
    super();
    this.setupEventListeners();
  }

  protected getTemplate(): string {
    return `
      <style>
        :host {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          display: none;
          pointer-events: none;
        }
        
        :host([visible]) {
          display: block;
          pointer-events: auto;
        }
        
        .dialog-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(2px);
          opacity: 0;
          transition: opacity 0.2s ease-out;
        }
        
        :host([visible]) .dialog-overlay {
          opacity: 1;
        }
        
        .bookmark-dialog {
          position: fixed;
          min-width: 320px;
          max-width: 480px;
          width: 90vw;
          max-height: 80vh;
          background: #ffffff;
          color: var(--chatmarks-text, #1f2937);
          border: 1px solid var(--chatmarks-border, #e5e7eb);
          border-radius: 12px;
          box-shadow: 
            0 10px 15px -3px rgba(0, 0, 0, 0.1),
            0 4px 6px -2px rgba(0, 0, 0, 0.05);
          padding: 0;
          margin: 0;
          overflow: hidden;
          transform: scale(0.95) translateY(-10px);
          opacity: 0;
          transition: all 0.2s ease-out;
          font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
          font-size: 14px;
          line-height: 1.5;
          box-sizing: border-box;
        }
        
        :host([visible]) .bookmark-dialog {
          transform: scale(1) translateY(0);
          opacity: 1;
        }
        
        .dialog-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--chatmarks-border, #e5e7eb);
          background: var(--chatmarks-secondary, #f9fafb);
        }
        
        .dialog-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--chatmarks-text, #1f2937);
          margin: 0;
        }
        
        .close-button {
          background: none;
          border: none;
          width: 32px;
          height: 32px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--chatmarks-text-secondary, #6b7280);
          transition: background-color 0.15s ease;
        }
        
        .close-button:hover {
          background: var(--chatmarks-hover, #f3f4f6);
        }
        
        .close-button:focus {
          outline: 2px solid var(--chatmarks-primary, #2563eb);
          outline-offset: -2px;
        }
        
        .close-icon {
          width: 18px;
          height: 18px;
          stroke: currentColor;
          fill: none;
          stroke-width: 2;
        }
        
        .dialog-content {
          padding: 20px;
        }
        
        .dialog-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          padding: 16px 20px;
          border-top: 1px solid var(--chatmarks-border, #e5e7eb);
          background: var(--chatmarks-secondary, #f9fafb);
        }
        
        .dialog-button {
          padding: 8px 16px;
          border-radius: 6px;
          border: 1px solid transparent;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          outline: none;
        }
        
        .dialog-button:focus {
          outline: 2px solid var(--chatmarks-primary, #2563eb);
          outline-offset: -2px;
        }
        
        .dialog-button--secondary {
          background: #ffffff;
          border-color: var(--chatmarks-border, #e5e7eb);
          color: var(--chatmarks-text, #1f2937);
        }
        
        .dialog-button--secondary:hover {
          background: var(--chatmarks-hover, #f3f4f6);
        }
        
        .dialog-button--primary {
          background: var(--chatmarks-primary, #2563eb);
          color: #ffffff;
        }
        
        .dialog-button--primary:hover {
          background: var(--chatmarks-primary-hover, #1d4ed8);
        }
        
        /* Animation for mobile */
        @media (max-width: 640px) {
          .bookmark-dialog {
            width: 95vw;
            min-width: unset;
            max-width: unset;
            border-radius: 12px 12px 0 0;
            bottom: 0;
            top: auto;
            left: 50%;
            transform: translateX(-50%) translateY(100%);
          }
          
          :host([visible]) .bookmark-dialog {
            transform: translateX(-50%) translateY(0);
          }
        }
      </style>
      
      <div class="dialog-overlay"></div>
      
      <div class="bookmark-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div class="dialog-header">
          <h2 class="dialog-title" id="dialog-title">Create Bookmark</h2>
          <button class="close-button" type="button" aria-label="Close dialog">
            <svg class="close-icon" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        <div class="dialog-content">
          <slot></slot>
        </div>
        
        <div class="dialog-actions">
          <button class="dialog-button dialog-button--secondary" type="button" data-action="cancel">
            Cancel
          </button>
          <button class="dialog-button dialog-button--primary" type="button" data-action="save">
            Save Bookmark
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Set up event listeners for dialog interaction
   */
  private setupEventListeners(): void {
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      this.addDialogEventListeners();
    });
  }

  /**
   * Add event listeners after DOM is constructed
   */
  private addDialogEventListeners(): void {
    const overlay = this.$('.dialog-overlay');
    const closeButton = this.$('.close-button');
    const cancelButton = this.$('[data-action="cancel"]');
    const saveButton = this.$('[data-action="save"]');

    // Close on overlay click
    overlay?.addEventListener('click', e => {
      if (e.target === overlay) {
        this.hide();
      }
    });

    // Close on close button click
    closeButton?.addEventListener('click', () => {
      this.hide();
    });

    // Cancel button
    cancelButton?.addEventListener('click', () => {
      this._event('cancel');
      this.hide();
    });

    // Save button
    saveButton?.addEventListener('click', () => {
      this._event('save');
      this.hide();
    });

    // Keyboard handling
    this.addEventListener('keydown', this.handleKeydown.bind(this));
  }

  /**
   * Handle keyboard events for accessibility
   */
  private handleKeydown(event: KeyboardEvent): void {
    if (!this._visible) return;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.hide();
        break;

      case 'Tab':
        this.handleTabNavigation(event);
        break;
    }
  }

  /**
   * Handle Tab key navigation within dialog
   */
  private handleTabNavigation(event: KeyboardEvent): void {
    const focusableElements = this.getFocusableElements();

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = this.shadowRoot?.activeElement;

    if (event.shiftKey) {
      // Shift+Tab: move to previous element
      if (activeElement === firstElement) {
        event.preventDefault();
        (lastElement as HTMLElement).focus();
      }
    } else {
      // Tab: move to next element
      if (activeElement === lastElement) {
        event.preventDefault();
        (firstElement as HTMLElement).focus();
      }
    }
  }

  /**
   * Get all focusable elements within the dialog
   */
  private getFocusableElements(): Element[] {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'textarea:not([disabled])',
      'select:not([disabled])',
      '[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    const elements = Array.from(
      this.shadowRoot?.querySelectorAll(focusableSelectors) || []
    );
    return elements.filter(element => {
      // Filter out hidden elements
      const style = getComputedStyle(element as HTMLElement);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }

  /**
   * Show the dialog with optional configuration
   */
  show(options: BookmarkDialogOptions = {}): void {
    try {
      // Store previous focus for restoration
      this._previousFocus = document.activeElement;

      // Update title if provided
      if (options.title) {
        this.title = options.title;
      }

      // Update content if provided
      if (options.content) {
        const contentSlot = this.$('.dialog-content slot');
        if (contentSlot) {
          contentSlot.innerHTML = options.content;
        }
      }

      // Position dialog if specified
      if (options.position) {
        this.positionDialog(options.position);
      } else {
        this.centerDialog();
      }

      // Show dialog
      this.visible = true;

      // Focus management
      requestAnimationFrame(() => {
        this.focusFirstElement();
      });

      // Dispatch show event
      this._event('show', options);
    } catch (error) {
      console.error('BookmarkDialog: Error showing dialog:', error);
    }
  }

  /**
   * Hide the dialog
   */
  hide(): void {
    try {
      this.visible = false;

      // Restore previous focus
      if (this._previousFocus instanceof HTMLElement) {
        this._previousFocus.focus();
        this._previousFocus = null;
      }

      // Dispatch hide event
      this._event('hide');
    } catch (error) {
      console.error('BookmarkDialog: Error hiding dialog:', error);
    }
  }

  /**
   * Position dialog at specific coordinates
   */
  private positionDialog(position: { top: number; left: number }): void {
    const dialog = this.$('.bookmark-dialog') as HTMLElement;
    if (!dialog) return;

    const { top, left } = position;
    const { innerWidth: vw, innerHeight: vh } = window;

    // Get dialog dimensions (estimate if not rendered)
    const dialogWidth = 400; // Default width
    const dialogHeight = 300; // Default height

    // Calculate position with viewport bounds checking
    const finalTop = Math.max(20, Math.min(top, vh - dialogHeight - 20));
    const finalLeft = Math.max(20, Math.min(left, vw - dialogWidth - 20));

    // Apply positioning
    dialog.style.top = `${finalTop}px`;
    dialog.style.left = `${finalLeft}px`;
    dialog.style.transform = 'none';
  }

  /**
   * Center dialog in viewport
   */
  private centerDialog(): void {
    const dialog = this.$('.bookmark-dialog') as HTMLElement;
    if (!dialog) return;

    // Reset positioning for centering
    dialog.style.top = '50%';
    dialog.style.left = '50%';
    dialog.style.transform = 'translate(-50%, -50%)';
  }

  /**
   * Focus the first focusable element in the dialog
   */
  private focusFirstElement(): void {
    const focusableElements = this.getFocusableElements();
    if (focusableElements.length > 0) {
      (focusableElements[0] as HTMLElement).focus();
    }
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
   * Title property getter
   */
  get title(): string {
    return this._title;
  }

  /**
   * Title property setter
   */
  set title(value: string) {
    if (this._title === value) return;

    this._title = value;
    this.setAttribute('title', value);

    // Update title element
    const titleElement = this.$('.dialog-title');
    if (titleElement) {
      titleElement.textContent = value;
    }
  }

  /**
   * Lifecycle: Handle attribute changes
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

      case 'title':
        if (newValue !== null) {
          this._title = newValue;
          const titleElement = this.$('.dialog-title');
          if (titleElement) {
            titleElement.textContent = newValue;
          }
        }
        break;
    }
  }

  /**
   * Lifecycle: Clean up when disconnected
   */
  protected cleanup(): void {
    super.cleanup();

    // Restore focus if dialog is removed while visible
    if (this._visible && this._previousFocus instanceof HTMLElement) {
      this._previousFocus.focus();
    }
  }
}
