/**
 * Component Registry System
 *
 * Manages registration of Web Components with the browser's custom elements registry.
 * Provides utilities for dynamic component registration and prevents duplicate registrations.
 */

import { BaseComponent } from './BaseComponent';

/**
 * Interface for registrable components
 */
interface RegistrableComponent {
  new (): HTMLElement;
  componentName: string;
}

/**
 * Registry for managing custom element registration
 */
export class ComponentRegistry {
  private static registeredComponents = new Set<string>();

  /**
   * Register a component with the browser's custom elements registry
   * @param ComponentClass - The component class to register
   * @param globalName - Optional name for global window access
   */
  static register<T extends BaseComponent>(
    ComponentClass: RegistrableComponent & (new () => T),
    globalName?: string
  ): void {
    const componentName = ComponentClass.componentName;

    if (!componentName) {
      console.error('Component must have a static componentName property');
      return;
    }

    // Check if already registered to prevent errors
    if (this.registeredComponents.has(componentName)) {
      console.warn(`Component '${componentName}' is already registered`);
      return;
    }

    // Check browser registry to avoid errors
    if (customElements.get(componentName)) {
      console.warn(
        `Custom element '${componentName}' is already defined in browser`
      );
      this.registeredComponents.add(componentName);
      return;
    }

    try {
      // Register with browser
      customElements.define(componentName, ComponentClass);

      // Track registration
      this.registeredComponents.add(componentName);

      // Optionally expose globally for dynamic access
      if (globalName) {
        (window as any)[globalName] = ComponentClass;
      }

      console.debug(`Component '${componentName}' registered successfully`);
    } catch (error) {
      console.error(`Failed to register component '${componentName}':`, error);
    }
  }

  /**
   * Check if a component is registered
   * @param componentName - Name of the component to check
   */
  static isRegistered(componentName: string): boolean {
    return this.registeredComponents.has(componentName);
  }

  /**
   * Get list of registered component names
   */
  static getRegisteredComponents(): string[] {
    return Array.from(this.registeredComponents);
  }

  /**
   * Register multiple components at once
   * @param components - Array of component classes to register
   */
  static registerAll(
    components: Array<{
      component: RegistrableComponent & (new () => BaseComponent);
      globalName?: string;
    }>
  ): void {
    components.forEach(({ component, globalName }) => {
      this.register(component, globalName);
    });
  }

  /**
   * Wait for a component to be defined
   * @param componentName - Name of the component to wait for
   * @returns Promise that resolves when component is defined
   */
  static async whenDefined(
    componentName: string
  ): Promise<new () => HTMLElement> {
    return customElements.whenDefined(componentName);
  }

  /**
   * Create an instance of a registered component
   * @param componentName - Name of the component to create
   * @returns HTMLElement instance or null if not found
   */
  static createElement(componentName: string): HTMLElement | null {
    if (!this.isRegistered(componentName)) {
      console.warn(`Component '${componentName}' is not registered`);
      return null;
    }

    try {
      return document.createElement(componentName);
    } catch (error) {
      console.error(`Failed to create component '${componentName}':`, error);
      return null;
    }
  }
}

/**
 * Decorator for automatic component registration
 * @param componentName - The custom element name
 * @param globalName - Optional global window property name
 */
export function RegisterComponent(componentName: string, globalName?: string) {
  return function <T extends new () => BaseComponent>(constructor: T) {
    // Set componentName as static property
    (constructor as any).componentName = componentName;

    // Register when DOM is ready or immediately if already ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        ComponentRegistry.register(constructor as any, globalName);
      });
    } else {
      ComponentRegistry.register(constructor as any, globalName);
    }

    return constructor;
  };
}
