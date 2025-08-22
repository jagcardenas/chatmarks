/**
 * UI Components Module Exports
 *
 * Centralized export point for all Chatmarks UI Web Components.
 * This module provides easy access to all components and their registration utilities.
 */

// Base component system
export { BaseComponent } from './base/BaseComponent';
export { ComponentRegistry, RegisterComponent } from './base/ComponentRegistry';

// UI Components
export { BookmarkDialog } from './BookmarkDialog';
export type { BookmarkDialogOptions } from './BookmarkDialog';

export { BookmarkForm } from './BookmarkForm';
export type { BookmarkFormData, BookmarkFormOptions } from './BookmarkForm';

export { FloatingActionButton } from './FloatingActionButton';
export type { FloatingActionButtonOptions } from './FloatingActionButton';

// Component registration helper
import { BookmarkDialog } from './BookmarkDialog';
import { BookmarkForm } from './BookmarkForm';
import { FloatingActionButton } from './FloatingActionButton';
import { ComponentRegistry } from './base/ComponentRegistry';

/**
 * Register all Chatmarks UI components with the browser
 * This should be called once during application initialization
 */
export function registerAllComponents(): void {
  try {
    ComponentRegistry.registerAll([
      {
        component: BookmarkDialog as any,
        globalName: 'ChatmarksBookmarkDialog',
      },
      {
        component: BookmarkForm as any,
        globalName: 'ChatmarksBookmarkForm',
      },
      {
        component: FloatingActionButton as any,
        globalName: 'ChatmarksFloatingActionButton',
      },
    ]);

    console.debug('All Chatmarks UI components registered successfully');
  } catch (error) {
    console.error('Failed to register Chatmarks UI components:', error);
  }
}

/**
 * Check if all components are registered
 */
export function areComponentsRegistered(): boolean {
  const requiredComponents = [
    BookmarkDialog.componentName,
    BookmarkForm.componentName,
    FloatingActionButton.componentName,
  ];

  return requiredComponents.every(name => ComponentRegistry.isRegistered(name));
}

/**
 * Create a bookmark dialog element
 */
export function createBookmarkDialog(): HTMLElement | null {
  return ComponentRegistry.createElement(BookmarkDialog.componentName);
}

/**
 * Create a bookmark form element
 */
export function createBookmarkForm(): HTMLElement | null {
  return ComponentRegistry.createElement(BookmarkForm.componentName);
}

/**
 * Create a floating action button element
 */
export function createFloatingActionButton(): HTMLElement | null {
  return ComponentRegistry.createElement(FloatingActionButton.componentName);
}

// Re-export base types for convenience
// Note: ComponentRegistry uses a simpler interface structure

// Component name constants for external use
export const COMPONENT_NAMES = {
  BOOKMARK_DIALOG: BookmarkDialog.componentName,
  BOOKMARK_FORM: BookmarkForm.componentName,
  FLOATING_ACTION_BUTTON: FloatingActionButton.componentName,
} as const;
