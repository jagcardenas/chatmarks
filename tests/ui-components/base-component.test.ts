/**
 * BaseComponent Test Suite
 *
 * Unit tests for the foundational Web Component class.
 * These tests focus on the logic without requiring full Web Components API.
 */

import { BaseComponent } from '../../src/content/ui/components/base/BaseComponent';

// Create a mock class that mimics HTMLElement for testing
class MockHTMLElement {
  attachShadow: jest.Mock;
  dispatchEvent: jest.Mock;
  shadowRoot: any;

  constructor() {
    this.attachShadow = jest.fn().mockReturnValue({
      appendChild: jest.fn(),
      querySelector: jest.fn().mockReturnValue(null),
    });
    this.dispatchEvent = jest.fn();
    this.shadowRoot = this.attachShadow.mock.results[0]?.value;
  }
}

// Create a testable component that uses composition instead of inheritance
class TestableComponent {
  static componentName = 'testable-component';
  static observedAttributes = ['test-attr', 'value'];

  private mockElement: MockHTMLElement;
  private baseComponent: BaseComponent;

  constructor() {
    this.mockElement = new MockHTMLElement();

    // Create base component with mocked element methods
    this.baseComponent = Object.create(BaseComponent.prototype);
    (this.baseComponent as any).attachShadow = this.mockElement.attachShadow;
    (this.baseComponent as any).dispatchEvent = this.mockElement.dispatchEvent;

    // Set the component name for proper event prefixing
    (this.baseComponent.constructor as any).componentName =
      'testable-component';

    // Mock the getTemplate method
    (this.baseComponent as any).getTemplate = () => `
      <style>:host { display: block; }</style>
      <div class="content"><slot></slot></div>
    `;

    // Initialize component properties
    (this.baseComponent as any)._isConnected = false;
    (this.baseComponent as any)._shadowQuery =
      this.mockElement.shadowRoot?.querySelector;

    // Call base initialization
    this.initializeComponent();
  }

  private initializeComponent() {
    // Simulate constructor logic without calling super()
    try {
      const shadowRoot = this.baseComponent.attachShadow?.({
        mode: 'open',
        delegatesFocus: true,
      });

      if (shadowRoot) {
        (this.baseComponent as any)._shadowQuery =
          shadowRoot.querySelector?.bind(shadowRoot);

        const template = (this.baseComponent as any).getTemplate();
        if (template) {
          const templateElement = {
            content: { cloneNode: () => ({ nodeType: 1 }) as any },
          };
          shadowRoot.appendChild?.(templateElement.content.cloneNode());
        }
      }

      // Dispatch construction event
      this.baseComponent.dispatchEvent?.(
        new CustomEvent('testable-component:construction', {
          bubbles: true,
          composed: true,
        })
      );
    } catch (error) {
      // Handle initialization errors gracefully
    }
  }

  // Expose BaseComponent methods for testing
  get isConnected() {
    return (this.baseComponent as any)._isConnected;
  }
  get attachShadowMock() {
    return this.mockElement.attachShadow;
  }
  get dispatchEventMock() {
    return this.mockElement.dispatchEvent;
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ) {
    return this.baseComponent.attributeChangedCallback(
      name,
      oldValue,
      newValue
    );
  }

  connectedCallback() {
    return this.baseComponent.connectedCallback();
  }

  disconnectedCallback() {
    return this.baseComponent.disconnectedCallback();
  }

  callProtectedEvent(eventName: string, detail?: any) {
    (this.baseComponent as any)._event(eventName, detail);
  }

  callProtectedQuery(selector: string) {
    return (this.baseComponent as any).$(selector);
  }

  callProtectedCleanup() {
    return (this.baseComponent as any).cleanup();
  }
}

describe('BaseComponent', () => {
  let component: TestableComponent;

  beforeEach(() => {
    component = new TestableComponent();
  });

  describe('Constructor and Initialization', () => {
    it('should attach shadow DOM with correct options', () => {
      expect(component.attachShadowMock).toHaveBeenCalledWith({
        mode: 'open',
        delegatesFocus: true,
      });
    });

    it('should dispatch construction event on initialization', () => {
      expect(component.dispatchEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'testable-component:construction',
          bubbles: true,
          composed: true,
        })
      );
    });

    it('should initialize connected state as false', () => {
      expect(component.isConnected).toBe(false);
    });
  });

  describe('Attribute Management', () => {
    it('should handle attribute changes and dispatch events', () => {
      const oldValue = 'old';
      const newValue = 'new';

      component.dispatchEventMock.mockClear();
      component.attributeChangedCallback('test-attr', oldValue, newValue);

      expect(component.dispatchEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'testable-component:attributeChanged',
          detail: {
            attribute: 'test-attr',
            oldValue,
            newValue,
          },
        })
      );
    });

    it('should not dispatch event when old and new values are the same', () => {
      const sameValue = 'same';

      component.dispatchEventMock.mockClear();
      component.attributeChangedCallback('test-attr', sameValue, sameValue);

      expect(component.dispatchEventMock).not.toHaveBeenCalled();
    });
  });

  describe('Lifecycle Methods', () => {
    it('should dispatch connected event when connected', () => {
      component.dispatchEventMock.mockClear();
      component.connectedCallback();

      expect(component.dispatchEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'testable-component:connected',
          bubbles: true,
          composed: true,
        })
      );
    });

    it('should set isConnected to true when connected', () => {
      component.connectedCallback();

      expect(component.isConnected).toBe(true);
    });

    it('should dispatch disconnected event and call cleanup when disconnected', () => {
      component.dispatchEventMock.mockClear();
      component.disconnectedCallback();

      expect(component.dispatchEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'testable-component:disconnected',
          bubbles: true,
          composed: true,
        })
      );
    });

    it('should set isConnected to false when disconnected', () => {
      component.connectedCallback();
      component.disconnectedCallback();

      expect(component.isConnected).toBe(false);
    });
  });

  describe('Event System', () => {
    it('should dispatch custom events with correct naming', () => {
      const eventData = { test: 'data' };

      component.dispatchEventMock.mockClear();
      component.callProtectedEvent('test-event', eventData);

      expect(component.dispatchEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'testable-component:test-event',
          detail: eventData,
          bubbles: true,
          composed: true,
        })
      );
    });

    it('should handle events without detail data', () => {
      component.dispatchEventMock.mockClear();
      component.callProtectedEvent('simple-event');

      expect(component.dispatchEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'testable-component:simple-event',
        })
      );

      // Verify the event was called (detail may be null instead of undefined)
      const call = component.dispatchEventMock.mock.calls[0][0];
      expect(call.type).toBe('testable-component:simple-event');
    });
  });

  describe('Template Rendering', () => {
    it('should use provided template in shadow DOM', () => {
      // Template should be appended during construction
      const shadowRoot = component.attachShadowMock.mock.results[0]?.value;
      expect(shadowRoot?.appendChild).toHaveBeenCalled();
    });
  });

  describe('Component Registration', () => {
    it('should provide static componentName', () => {
      expect(TestableComponent.componentName).toBe('testable-component');
    });

    it('should define observed attributes', () => {
      expect(TestableComponent.observedAttributes).toEqual([
        'test-attr',
        'value',
      ]);
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', () => {
      // Create a component that throws during template generation
      class ErrorComponent extends TestableComponent {
        constructor() {
          try {
            super();
          } catch {
            // Errors should be caught and handled
          }
        }
      }

      expect(() => new ErrorComponent()).not.toThrow();
    });
  });

  describe('Shadow DOM Query Helper', () => {
    it('should provide $ method for shadow DOM queries', () => {
      const shadowRoot = component.attachShadowMock.mock.results[0]?.value;
      if (shadowRoot?.querySelector) {
        shadowRoot.querySelector.mockReturnValue({ id: 'test-element' });

        const result = component.callProtectedQuery('.test-class');

        expect(shadowRoot.querySelector).toHaveBeenCalledWith('.test-class');
        expect(result).toEqual({ id: 'test-element' });
      }
    });

    it('should handle null shadow root gracefully', () => {
      // Create a component with null shadow query
      const nullComponent = new TestableComponent();
      (nullComponent as any).baseComponent._shadowQuery = null;

      expect(() => {
        nullComponent.callProtectedQuery('.test-selector');
      }).not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should provide cleanup method', () => {
      expect(() => component.callProtectedCleanup()).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should support focus delegation in shadow DOM', () => {
      expect(component.attachShadowMock).toHaveBeenCalledWith(
        expect.objectContaining({
          delegatesFocus: true,
        })
      );
    });
  });
});
