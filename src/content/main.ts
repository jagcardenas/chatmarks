/**
 * Main Content Script Entry Point
 *
 * Minimal entry point that initializes the ContentScriptInitializer.
 * All functionality has been refactored into focused modules for
 * better maintainability and testability.
 */

import './styles.css';
import { ContentScriptInitializer } from './ContentScriptInitializer';

// Global content script initializer
let contentScriptInitializer: ContentScriptInitializer | null = null;

/**
 * Initializes the content script.
 */
async function initializeContentScript(): Promise<void> {
  try {
    contentScriptInitializer = new ContentScriptInitializer();
    await contentScriptInitializer.initialize();
  } catch (error) {
    console.error('Chatmarks: Failed to initialize content script:', error);
  }
}

/**
 * Cleans up the content script.
 */
async function cleanupContentScript(): Promise<void> {
  if (contentScriptInitializer) {
    await contentScriptInitializer.cleanup();
    contentScriptInitializer = null;
  }
}

// Initialize the content script when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  initializeContentScript();
}

// Add cleanup on page unload
window.addEventListener('beforeunload', () => {
  cleanupContentScript();
});

// Export onExecute function for CRXJS compatibility
export function onExecute() {
  // This function is called by the CRXJS content script loader
  // The initialization is already handled by the main execution above
}
