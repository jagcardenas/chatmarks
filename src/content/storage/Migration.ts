/**
 * Storage Migration System for Schema Versioning
 *
 * Handles data migration between different schema versions with backup,
 * rollback, and validation capabilities. Ensures smooth upgrades while
 * maintaining data integrity.
 *
 * Key Features:
 * - Automatic schema version detection
 * - Data backup before migration with timestamp
 * - Step-by-step migration with rollback on failure
 * - Schema validation after migration
 * - Support for multiple migration paths
 */

import { Bookmark, Platform, TextAnchor } from '../../types/bookmark';

/**
 * Migration result interface
 */
export interface MigrationResult {
  success: boolean;
  fromVersion: number;
  toVersion: number;
  backupKey?: string;
  error?: string;
  migratedCount: number;
  executionTime: number;
}

/**
 * Legacy bookmark format from v1
 */
interface LegacyBookmarkV1 {
  id: string;
  text: string; // Was "selectedText" in anchor
  note: string;
  conversation: string; // Was "conversationId"
  message?: string; // Was "messageId"
  created?: string;
  tags?: string[];
  color?: string;
}

export class StorageMigration {
  private static readonly STORAGE_KEY = 'bookmarks';
  private static readonly SCHEMA_VERSION_KEY = 'schemaVersion';
  private static readonly CURRENT_VERSION = 2;
  private static readonly BACKUP_PREFIX = 'backup_v';
  private static readonly BACKUP_TIMESTAMP_KEY = 'backup_timestamp';

  /**
   * Checks if migration is needed
   *
   * @returns Promise resolving to true if migration is required
   */
  async needsMigration(): Promise<boolean> {
    try {
      const currentVersion = await this.getCurrentVersion();
      return currentVersion < StorageMigration.CURRENT_VERSION;
    } catch (error) {
      console.error('Error checking migration status:', error);
      return false;
    }
  }

  /**
   * Performs migration from a specific version to current
   *
   * @param fromVersion - Version to migrate from
   * @returns Promise resolving to migration result
   */
  async migrateFromVersion(fromVersion: number): Promise<MigrationResult> {
    const startTime = performance.now();
    let backupKey: string | undefined;

    try {
      // Create backup before migration
      backupKey = await this.backupData();

      let migratedCount = 0;
      let currentVersion = fromVersion;

      // Perform step-by-step migration
      while (currentVersion < StorageMigration.CURRENT_VERSION) {
        const stepResult = await this.performMigrationStep(
          currentVersion,
          currentVersion + 1
        );
        migratedCount += stepResult.migratedCount;
        currentVersion++;
      }

      // Validate schema after migration
      const isValid = await this.validateSchema();
      if (!isValid) {
        throw new Error('Schema validation failed after migration');
      }

      // Update schema version
      await this.updateSchemaVersion(StorageMigration.CURRENT_VERSION);

      const endTime = performance.now();
      return {
        success: true,
        fromVersion,
        toVersion: StorageMigration.CURRENT_VERSION,
        backupKey,
        migratedCount,
        executionTime: endTime - startTime,
      };
    } catch (error) {
      // Attempt rollback on failure
      if (backupKey) {
        try {
          await this.rollbackFromBackup(backupKey);
        } catch (rollbackError) {
          console.error('Rollback failed:', rollbackError);
        }
      }

      const endTime = performance.now();
      return {
        success: false,
        fromVersion,
        toVersion: fromVersion, // No change due to failure
        backupKey,
        error:
          error instanceof Error ? error.message : 'Unknown migration error',
        migratedCount: 0,
        executionTime: endTime - startTime,
      };
    }
  }

  /**
   * Creates a backup of current data before migration
   *
   * @returns Promise resolving to backup key
   */
  async backupData(): Promise<string> {
    try {
      const currentVersion = await this.getCurrentVersion();
      const backupKey = `${StorageMigration.BACKUP_PREFIX}${currentVersion}`;

      // Get all current data
      const result = await chrome.storage.local.get(null);

      // Store backup with timestamp
      await chrome.storage.local.set({
        [backupKey]: result,
        [StorageMigration.BACKUP_TIMESTAMP_KEY]: new Date().toISOString(),
      });

      return backupKey;
    } catch (error) {
      throw new Error(
        `Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validates the current schema structure
   *
   * @returns Promise resolving to true if schema is valid
   */
  async validateSchema(): Promise<boolean> {
    try {
      const result = await chrome.storage.local.get([
        StorageMigration.STORAGE_KEY,
        StorageMigration.SCHEMA_VERSION_KEY,
      ]);

      const bookmarks: Bookmark[] = result[StorageMigration.STORAGE_KEY] || [];
      const schemaVersion = result[StorageMigration.SCHEMA_VERSION_KEY];

      // Check schema version
      if (schemaVersion !== StorageMigration.CURRENT_VERSION) {
        console.warn(
          `Schema version mismatch: expected ${StorageMigration.CURRENT_VERSION}, got ${schemaVersion}`
        );
        return false;
      }

      // Validate bookmark structure
      for (const bookmark of bookmarks) {
        if (!this.isValidBookmarkStructure(bookmark)) {
          console.warn('Invalid bookmark structure found:', bookmark);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Schema validation error:', error);
      return false;
    }
  }

  /**
   * Restores data from a backup
   *
   * @param backupKey - The backup key to restore from
   * @returns Promise that resolves when restore is complete
   */
  async rollbackFromBackup(backupKey: string): Promise<void> {
    try {
      const result = await chrome.storage.local.get(backupKey);
      const backupData = result[backupKey];

      if (!backupData) {
        throw new Error(`Backup not found: ${backupKey}`);
      }

      // Clear current data and restore backup
      await chrome.storage.local.clear();
      await chrome.storage.local.set(backupData);
    } catch (error) {
      throw new Error(
        `Failed to rollback from backup: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Gets the current schema version
   *
   * @returns Promise resolving to current version
   */
  private async getCurrentVersion(): Promise<number> {
    try {
      const result = await chrome.storage.local.get(
        StorageMigration.SCHEMA_VERSION_KEY
      );
      return result[StorageMigration.SCHEMA_VERSION_KEY] || 1; // Default to v1
    } catch (error) {
      throw new Error(
        `Failed to get current version: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Updates the schema version
   *
   * @param version - New version number
   * @returns Promise that resolves when version is updated
   */
  private async updateSchemaVersion(version: number): Promise<void> {
    try {
      await chrome.storage.local.set({
        [StorageMigration.SCHEMA_VERSION_KEY]: version,
      });
    } catch (error) {
      throw new Error(
        `Failed to update schema version: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Performs a single migration step
   *
   * @param fromVersion - Source version
   * @param toVersion - Target version
   * @returns Promise resolving to step result
   */
  private async performMigrationStep(
    fromVersion: number,
    toVersion: number
  ): Promise<{ migratedCount: number }> {
    switch (fromVersion) {
      case 1:
        return await this.migrateV1ToV2();
      default:
        throw new Error(
          `No migration path from version ${fromVersion} to ${toVersion}`
        );
    }
  }

  /**
   * Migrates from v1 to v2 schema
   *
   * @returns Promise resolving to migration result
   */
  private async migrateV1ToV2(): Promise<{ migratedCount: number }> {
    try {
      const result = await chrome.storage.local.get(
        StorageMigration.STORAGE_KEY
      );
      const legacyBookmarks: LegacyBookmarkV1[] =
        result[StorageMigration.STORAGE_KEY] || [];

      const migratedBookmarks: Bookmark[] = legacyBookmarks.map(legacy => {
        // Convert legacy format to current format
        const anchor: TextAnchor = {
          selectedText: legacy.text || '',
          startOffset: 0, // Unknown in v1, default to 0
          endOffset: legacy.text?.length || 0,
          xpathSelector: '', // Unknown in v1, will rely on fallback strategies
          messageId: legacy.message || legacy.id, // Use bookmark ID as fallback
          contextBefore: '', // Unknown in v1
          contextAfter: '', // Unknown in v1
          checksum: this.generateChecksum(legacy.text || ''),
          confidence: 0.5, // Low confidence due to missing data
          strategy: 'fuzzy' as const, // Will need fuzzy matching
        };

        const migrated: Bookmark = {
          id: legacy.id,
          platform: 'chatgpt' as Platform, // Default to ChatGPT for v1 data
          conversationId: legacy.conversation,
          messageId: legacy.message || legacy.id,
          anchor,
          note: legacy.note || '',
          tags: legacy.tags || [],
          created: legacy.created || new Date().toISOString(),
          updated: new Date().toISOString(),
          color: legacy.color || '#ffeb3b',
        };

        return migrated;
      });

      // Save migrated data
      await chrome.storage.local.set({
        [StorageMigration.STORAGE_KEY]: migratedBookmarks,
      });

      return { migratedCount: migratedBookmarks.length };
    } catch (error) {
      throw new Error(
        `V1 to V2 migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validates bookmark structure against current schema
   *
   * @param bookmark - Bookmark to validate
   * @returns True if structure is valid
   */
  private isValidBookmarkStructure(bookmark: any): bookmark is Bookmark {
    return (
      typeof bookmark === 'object' &&
      typeof bookmark.id === 'string' &&
      typeof bookmark.platform === 'string' &&
      typeof bookmark.conversationId === 'string' &&
      typeof bookmark.messageId === 'string' &&
      typeof bookmark.anchor === 'object' &&
      typeof bookmark.anchor.selectedText === 'string' &&
      typeof bookmark.anchor.startOffset === 'number' &&
      typeof bookmark.anchor.endOffset === 'number' &&
      typeof bookmark.note === 'string' &&
      Array.isArray(bookmark.tags) &&
      typeof bookmark.created === 'string' &&
      typeof bookmark.updated === 'string' &&
      typeof bookmark.color === 'string'
    );
  }

  /**
   * Generates a simple checksum for text content
   *
   * @param text - Text to generate checksum for
   * @returns Checksum string
   */
  private generateChecksum(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Lists all available backups
   *
   * @returns Promise resolving to array of backup information
   */
  async listBackups(): Promise<
    Array<{
      key: string;
      version: number;
      timestamp?: string;
    }>
  > {
    try {
      const result = await chrome.storage.local.get(null);
      const backups: Array<{
        key: string;
        version: number;
        timestamp?: string;
      }> = [];

      Object.keys(result).forEach(key => {
        if (key.startsWith(StorageMigration.BACKUP_PREFIX)) {
          const versionMatch = key.match(/backup_v(\d+)/);
          if (versionMatch && versionMatch[1]) {
            backups.push({
              key,
              version: parseInt(versionMatch[1], 10),
              timestamp: result[StorageMigration.BACKUP_TIMESTAMP_KEY],
            });
          }
        }
      });

      return backups.sort((a, b) => b.version - a.version);
    } catch (error) {
      throw new Error(
        `Failed to list backups: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Cleans up old backups (keeps latest 3)
   *
   * @returns Promise that resolves when cleanup is complete
   */
  async cleanupOldBackups(): Promise<void> {
    try {
      const backups = await this.listBackups();

      // Keep only the latest 3 backups
      const backupsToDelete = backups.slice(3);

      for (const backup of backupsToDelete) {
        await chrome.storage.local.remove(backup.key);
      }
    } catch (error) {
      throw new Error(
        `Failed to cleanup backups: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
