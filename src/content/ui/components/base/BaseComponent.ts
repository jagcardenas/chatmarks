/**
 * BaseComponent - Foundation for all UI Web Components
 *
 * Provides shared functionality for Web Components including:
 * - Shadow DOM setup with focus delegation
 * - Event system with consistent naming
 * - Attribute observation and reactivity
 * - Lifecycle management with cleanup
 * - Memory leak prevention
 */

export abstract class BaseComponent extends HTMLElement {
  /** Component name for event prefixing and registration */
  static componentName: string;

  /** Attributes to observe for changes */
  static observedAttributes: string[] = [];

  /** Shadow DOM query selector helper */
  protected _shadowQuery!: (selector: string) => Element | null;

  /** Component connection state */
  protected _isConnected: boolean = false;

  constructor() {
    super();

    try {
      // Attach shadow DOM with focus delegation for accessibility
      const shadowRoot = this.attachShadow({
        mode: 'open',
        delegatesFocus: true,
      });

      // Set up shadow DOM query helper
      this._shadowQuery = shadowRoot.querySelector.bind(shadowRoot);

      // Render template if provided
      const template = this.getTemplate();
      if (template) {
        const templateElement = document.createElement('template');
        templateElement.innerHTML = template;
        shadowRoot.appendChild(templateElement.content.cloneNode(true));
      }

      // Dispatch construction event
      this._event('construction');
    } catch (error) {
      console.error(`${this.getComponentName()}: Construction failed:`, error);
    }
  }

  /**
   * Get template HTML for shadow DOM
   * Must be implemented by subclasses
   */
  protected abstract getTemplate(): string;

  /**
   * Get component name from static property
   */
  protected getComponentName(): string {
    return (
      (this.constructor as typeof BaseComponent).componentName ||
      'base-component'
    );
  }

  /**
   * Lifecycle: Called when element is connected to DOM
   */
  connectedCallback(): void {
    this._isConnected = true;
    this._event('connected');
  }

  /**
   * Lifecycle: Called when element is disconnected from DOM
   */
  disconnectedCallback(): void {
    this._isConnected = false;
    this.cleanup();
    this._event('disconnected');
  }

  /**
   * Lifecycle: Called when observed attributes change
   */
  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    // Don't process if values are the same
    if (oldValue === newValue) return;

    // Create a property from the attribute value
    // This allows both attribute and property access
    (this as any)[name] = newValue;

    // Dispatch attribute change event
    this._event('attributeChanged', {
      attribute: name,
      oldValue,
      newValue,
    });
  }

  /**
   * Get connection state
   */
  get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Shadow DOM query helper
   */
  protected $(selector: string): Element | null {
    return this._shadowQuery ? this._shadowQuery(selector) : null;
  }

  /**
   * Dispatch a custom event with consistent naming
   * @param eventName - Event name (will be prefixed with component name)
   * @param detail - Event detail data
   */
  protected _event(eventName: string, detail?: any): void {
    const fullEventName = `${this.getComponentName()}:${eventName}`;

    const event = new CustomEvent(fullEventName, {
      bubbles: true,
      composed: true,
      detail,
    });

    this.dispatchEvent(event);
  }

  /**
   * Cleanup method for memory leak prevention
   * Should be overridden by subclasses to clean up specific resources
   */
  protected cleanup(): void {
    // Base cleanup - can be extended by subclasses
    // Remove any global event listeners, timers, etc.
  }

  /**
   * Utility method to safely set text content
   * Prevents XSS by using textContent instead of innerHTML
   */
  protected safeSetText(element: Element | null, text: string): void {
    if (element) {
      element.textContent = text;
    }
  }

  /**
   * Utility method to safely set HTML content
   * Only use when HTML is trusted and sanitized
   */
  protected safeSetHTML(element: Element | null, html: string): void {
    if (element) {
      // In production, this should include HTML sanitization
      element.innerHTML = html;
    }
  }

  /**
   * Utility method to add event listener with cleanup tracking
   * Helps prevent memory leaks
   */
  protected addEventListenerWithCleanup(
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions
  ): void {
    target.addEventListener(type, listener, options);

    // Store for cleanup - could be enhanced with a cleanup registry
    // For now, rely on browser's automatic cleanup when element is removed
  }
}
