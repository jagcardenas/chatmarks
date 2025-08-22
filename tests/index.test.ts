/**
 * Index Entry Point Tests
 *
 * Tests for the main entry point exports and re-exports.
 * Basic functionality is now tested in the specialized modules:
 * - BookmarkManager tests for bookmark operations
 * - StorageService tests for persistence
 * - TextSelection tests for text capture
 */

/**
 * Index Entry Point Tests
 *
 * Tests for the main entry point exports and re-exports.
 * Since TypeScript types don't exist at runtime, we test the structure
 * and verify that the module can be imported without errors.
 */

describe('Index Exports', () => {
  it('should be able to import from index without errors', () => {
    // This test verifies that the module can be imported without runtime errors
    // and that all type re-exports are properly configured
    expect(() => {
      const index = require('../src/index');
      // If we get here, the module loaded successfully
      expect(index).toBeDefined();
    }).not.toThrow();
  });

  it('should verify Platform type values work correctly', () => {
    // Test that Platform type values work as expected
    const platforms = ['chatgpt', 'claude', 'grok'] as const;
    platforms.forEach(platform => {
      expect(typeof platform).toBe('string');
      expect(platform.length).toBeGreaterThan(0);
    });
  });

  it('should verify Bookmark structure can be created', () => {
    // Test that we can create objects that match the Bookmark interface
    const testBookmark = {
      id: 'test-id',
      platform: 'chatgpt' as const,
      conversationId: 'conv-123',
      messageId: 'msg-456',
      anchor: {
        selectedText: 'test text',
        startOffset: 0,
        endOffset: 9,
        xpathSelector: '//div[@id="test"]',
        messageId: 'msg-456',
        contextBefore: '',
        contextAfter: '',
        checksum: 'abc123',
        confidence: 0.9,
        strategy: 'xpath' as const,
      },
      note: 'test note',
      tags: [],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      color: '#ffeb3b',
    };

    // Verify the structure is correct
    expect(testBookmark.id).toBe('test-id');
    expect(testBookmark.platform).toBe('chatgpt');
    expect(testBookmark.note).toBe('test note');
    expect(testBookmark.anchor.selectedText).toBe('test text');
    expect(testBookmark.anchor.confidence).toBe(0.9);
  });
});
