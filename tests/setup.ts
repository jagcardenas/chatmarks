/**
 * Jest setup file for Chatmarks tests
 */

// Mock crypto.randomUUID for testing
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-12345',
  },
});

// Global test utilities can be added here
global.beforeEach(() => {
  // Setup before each test
});

global.afterEach(() => {
  // Cleanup after each test
});
