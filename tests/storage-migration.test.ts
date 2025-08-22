/**
 * Test suite for StorageMigration
 *
 * Tests schema migration, backup/restore, and data integrity.
 */

// Types imported but not used in this test file - only interfaces are tested

// Chrome API mocks
const mockChromeStorage = {
  local: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn(),
  },
};

// Setup Chrome API mock
Object.defineProperty(global, 'chrome', {
  value: {
    storage: mockChromeStorage,
  },
  writable: true,
});

import { StorageMigration } from '../src/content/storage/Migration';

describe('StorageMigration', () => {
  let storageMigration: StorageMigration;

  beforeEach(() => {
    storageMigration = new StorageMigration();
    jest.clearAllMocks();
  });

  describe('Schema Migration', () => {
    test('should detect when migration is needed', async () => {
      // Arrange
      mockChromeStorage.local.get.mockResolvedValue({
        schemaVersion: 1,
        bookmarks: [],
      });

      // Act
      const needsMigration = await storageMigration.needsMigration();

      // Assert
      expect(needsMigration).toBe(true);
    });

    test('should backup data before migration', async () => {
      // Arrange
      const existingData = {
        schemaVersion: 1,
        bookmarks: [{ id: 'old-format', note: 'test' }],
      };
      mockChromeStorage.local.get.mockResolvedValue(existingData);
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      // Act
      await storageMigration.backupData();

      // Assert
      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        backup_v1: existingData,
        backup_timestamp: expect.any(String),
      });
    });

    test.skip('should migrate from v1 to current schema', async () => {
      // Arrange
      const v1Data = {
        schemaVersion: 1,
        bookmarks: [
          {
            id: 'old-1',
            text: 'Selected text', // Old format
            note: 'Note',
            conversation: 'conv-123', // Old field name
          },
        ],
      };

      // Mock the sequence of calls during migration
      mockChromeStorage.local.get
        .mockResolvedValueOnce({ schemaVersion: 1 }) // getCurrentVersion call
        .mockResolvedValueOnce(v1Data) // backup data call
        .mockResolvedValueOnce(v1Data) // migration step call
        .mockResolvedValueOnce({
          // validation call
          schemaVersion: 2,
          bookmarks: [
            {
              id: 'old-1',
              platform: 'chatgpt',
              conversationId: 'conv-123',
              messageId: 'old-1',
              anchor: {
                selectedText: 'Selected text',
                startOffset: 0,
                endOffset: 13,
                xpathSelector: '',
                messageId: 'old-1',
                contextBefore: '',
                contextAfter: '',
                checksum: expect.any(String),
                confidence: 0.5,
                strategy: 'fuzzy',
              },
              note: 'Note',
              tags: [],
              created: expect.any(String),
              updated: expect.any(String),
              color: '#ffeb3b',
            },
          ],
        });

      mockChromeStorage.local.set.mockResolvedValue(undefined);

      // Act
      const result = await storageMigration.migrateFromVersion(1);

      // Assert
      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe(1);
      expect(result.toVersion).toBe(2);
      expect(result.migratedCount).toBe(1);
    });

    test('should validate schema after migration', async () => {
      // Arrange
      const migratedData = {
        schemaVersion: 2,
        bookmarks: [
          {
            id: 'migrated-1',
            platform: 'chatgpt',
            conversationId: 'conv-123',
            messageId: 'msg-456',
            anchor: {
              selectedText: 'text',
              startOffset: 0,
              endOffset: 4,
              xpathSelector: '//div',
              messageId: 'msg-456',
              contextBefore: '',
              contextAfter: '',
              checksum: 'abc123',
              confidence: 0.95,
              strategy: 'xpath',
            },
            note: 'note',
            tags: [],
            created: '2024-01-01T00:00:00.000Z',
            updated: '2024-01-01T00:00:00.000Z',
            color: '#ffeb3b',
          },
        ],
      };
      mockChromeStorage.local.get.mockResolvedValue(migratedData);

      // Act
      const isValid = await storageMigration.validateSchema();

      // Assert
      expect(isValid).toBe(true);
    });

    test('should handle migration rollback on failure', async () => {
      // Arrange
      const originalData = {
        schemaVersion: 1,
        bookmarks: [{ id: 'original' }],
      };
      mockChromeStorage.local.get
        .mockResolvedValueOnce(originalData) // Initial data for backup
        .mockResolvedValueOnce(null) // Backup data
        .mockResolvedValueOnce({ backup_v1: originalData }); // Backup data for rollback

      // Simulate migration failure
      mockChromeStorage.local.set
        .mockResolvedValueOnce(undefined) // Backup succeeds
        .mockRejectedValueOnce(new Error('Migration failed')); // Migration fails

      // Act
      const result = await storageMigration.migrateFromVersion(1);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Migration failed');
    });
  });

  describe('Backup Management', () => {
    test('should list available backups', async () => {
      // Arrange
      mockChromeStorage.local.get.mockResolvedValue({
        backup_v1: { data: 'v1' },
        backup_v2: { data: 'v2' },
        backup_timestamp: '2024-01-01T00:00:00.000Z',
        other_key: 'not a backup',
      });

      // Act
      const backups = await storageMigration.listBackups();

      // Assert
      expect(backups).toHaveLength(2);
      expect(backups[0]?.version).toBe(2); // Should be sorted by version desc
      expect(backups[1]?.version).toBe(1);
    });

    test('should cleanup old backups', async () => {
      // Arrange
      const backupData = {
        backup_v1: { data: 'v1' },
        backup_v2: { data: 'v2' },
        backup_v3: { data: 'v3' },
        backup_v4: { data: 'v4' },
        backup_v5: { data: 'v5' },
        backup_timestamp: '2024-01-01T00:00:00.000Z',
      };

      mockChromeStorage.local.get.mockResolvedValue(backupData);
      mockChromeStorage.local.remove.mockResolvedValue(undefined);

      // Act
      await storageMigration.cleanupOldBackups();

      // Assert
      // Should remove older backups (keep latest 3)
      expect(mockChromeStorage.local.remove).toHaveBeenCalledWith('backup_v1');
      expect(mockChromeStorage.local.remove).toHaveBeenCalledWith('backup_v2');
      expect(mockChromeStorage.local.remove).toHaveBeenCalledTimes(2);
    });

    test('should rollback from backup successfully', async () => {
      // Arrange
      const backupData = {
        schemaVersion: 1,
        bookmarks: [{ id: 'backup-bookmark' }],
      };

      mockChromeStorage.local.get.mockResolvedValue({
        backup_v1: backupData,
      });
      mockChromeStorage.local.clear.mockResolvedValue(undefined);
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      // Act
      await storageMigration.rollbackFromBackup('backup_v1');

      // Assert
      expect(mockChromeStorage.local.clear).toHaveBeenCalled();
      expect(mockChromeStorage.local.set).toHaveBeenCalledWith(backupData);
    });

    test('should handle missing backup during rollback', async () => {
      // Arrange
      mockChromeStorage.local.get.mockResolvedValue({}); // No backup found

      // Act & Assert
      await expect(
        storageMigration.rollbackFromBackup('backup_v999')
      ).rejects.toThrow('Backup not found: backup_v999');
    });
  });

  describe('Schema Validation', () => {
    test('should validate valid schema', async () => {
      // Arrange
      const validData = {
        schemaVersion: 2,
        bookmarks: [
          {
            id: 'valid-bookmark',
            platform: 'chatgpt',
            conversationId: 'conv-123',
            messageId: 'msg-456',
            anchor: {
              selectedText: 'text',
              startOffset: 0,
              endOffset: 4,
              xpathSelector: '//div',
              messageId: 'msg-456',
              contextBefore: '',
              contextAfter: '',
              checksum: 'abc123',
              confidence: 0.95,
              strategy: 'xpath',
            },
            note: 'note',
            tags: [],
            created: '2024-01-01T00:00:00.000Z',
            updated: '2024-01-01T00:00:00.000Z',
            color: '#ffeb3b',
          },
        ],
      };

      mockChromeStorage.local.get.mockResolvedValue(validData);

      // Act
      const isValid = await storageMigration.validateSchema();

      // Assert
      expect(isValid).toBe(true);
    });

    test('should detect invalid schema version', async () => {
      // Arrange
      mockChromeStorage.local.get.mockResolvedValue({
        schemaVersion: 999, // Invalid version
        bookmarks: [],
      });

      // Act
      const isValid = await storageMigration.validateSchema();

      // Assert
      expect(isValid).toBe(false);
    });

    test('should detect invalid bookmark structure', async () => {
      // Arrange
      mockChromeStorage.local.get.mockResolvedValue({
        schemaVersion: 2,
        bookmarks: [
          {
            id: 'invalid-bookmark',
            // Missing required fields
          },
        ],
      });

      // Act
      const isValid = await storageMigration.validateSchema();

      // Assert
      expect(isValid).toBe(false);
    });
  });
});
