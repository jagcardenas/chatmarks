/**
 * Jest setup file for Chatmarks tests
 */

// Mock crypto.randomUUID for testing
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-12345',
  },
});

// Mock TextEncoder/TextDecoder for JSDOM
if (typeof global.TextEncoder === 'undefined') {
  const util = require('util');
  global.TextEncoder = util.TextEncoder;
  global.TextDecoder = util.TextDecoder;
}

// Global test utilities can be added here
global.beforeEach(() => {
  // Setup before each test
});

global.afterEach(() => {
  // Cleanup after each test
});
