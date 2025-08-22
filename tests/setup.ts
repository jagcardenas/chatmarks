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

// Helper function for location mocking
(global as any).setupLocationMock = (url: string) => {
  const urlObj = new URL(url);

  // Use Jest spies to mock location properties
  const hrefSpy = jest
    .spyOn(window.location, 'href', 'get')
    .mockReturnValue(url);
  const hostnameSpy = jest
    .spyOn(window.location, 'hostname', 'get')
    .mockReturnValue(urlObj.hostname);
  const pathnameSpy = jest
    .spyOn(window.location, 'pathname', 'get')
    .mockReturnValue(urlObj.pathname);
  const hashSpy = jest
    .spyOn(window.location, 'hash', 'get')
    .mockReturnValue(urlObj.hash);
  const searchSpy = jest
    .spyOn(window.location, 'search', 'get')
    .mockReturnValue(urlObj.search);
  const protocolSpy = jest
    .spyOn(window.location, 'protocol', 'get')
    .mockReturnValue(urlObj.protocol);
  const hostSpy = jest
    .spyOn(window.location, 'host', 'get')
    .mockReturnValue(urlObj.host);
  const portSpy = jest
    .spyOn(window.location, 'port', 'get')
    .mockReturnValue(urlObj.port);
  const originSpy = jest
    .spyOn(window.location, 'origin', 'get')
    .mockReturnValue(urlObj.origin);

  return {
    href: url,
    hostname: urlObj.hostname,
    pathname: urlObj.pathname,
    hash: urlObj.hash,
    search: urlObj.search,
    protocol: urlObj.protocol,
    host: urlObj.host,
    port: urlObj.port,
    origin: urlObj.origin,
    spies: [
      hrefSpy,
      hostnameSpy,
      pathnameSpy,
      hashSpy,
      searchSpy,
      protocolSpy,
      hostSpy,
      portSpy,
      originSpy,
    ],
  };
};

// Global test utilities can be added here
global.beforeEach(() => {
  // Setup before each test
});

global.afterEach(() => {
  // Cleanup after each test
  jest.restoreAllMocks();

  // Reset location spies to their original behavior
  jest.restoreAllMocks();
});
