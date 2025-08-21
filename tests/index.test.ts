import { createBookmark, validateBookmark, BookmarkData } from '../src/index';

describe('createBookmark', () => {
  it('should create a bookmark with required fields', () => {
    const selectedText = 'This is selected text';
    const note = 'This is a note';

    const bookmark = createBookmark(selectedText, note);

    expect(bookmark.id).toBe('test-uuid-12345');
    expect(bookmark.text).toBe(selectedText);
    expect(bookmark.note).toBe(note);
    expect(bookmark.timestamp).toBeInstanceOf(Date);
  });

  it('should create a bookmark without a note', () => {
    const selectedText = 'This is selected text';

    const bookmark = createBookmark(selectedText);

    expect(bookmark.id).toBe('test-uuid-12345');
    expect(bookmark.text).toBe(selectedText);
    expect(bookmark.note).toBe('');
    expect(bookmark.timestamp).toBeInstanceOf(Date);
  });
});

describe('validateBookmark', () => {
  it('should validate a valid bookmark', () => {
    const validBookmark: BookmarkData = {
      id: 'test-id',
      text: 'Test text',
      note: 'Test note',
      timestamp: new Date(),
    };

    expect(validateBookmark(validBookmark)).toBe(true);
  });

  it('should invalidate bookmark with missing id', () => {
    const invalidBookmark: BookmarkData = {
      id: '',
      text: 'Test text',
      note: 'Test note',
      timestamp: new Date(),
    };

    expect(validateBookmark(invalidBookmark)).toBe(false);
  });

  it('should invalidate bookmark with missing text', () => {
    const invalidBookmark: BookmarkData = {
      id: 'test-id',
      text: '',
      note: 'Test note',
      timestamp: new Date(),
    };

    expect(validateBookmark(invalidBookmark)).toBe(false);
  });
});
