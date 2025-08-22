#!/usr/bin/env node

/**
 * Manifest Version Synchronization Script
 *
 * Synchronizes the version in manifest.json with package.json
 * after a version bump operation.
 */

const fs = require('fs');
const path = require('path');

const PACKAGE_PATH = path.join(__dirname, '..', 'package.json');
const MANIFEST_PATH = path.join(__dirname, '..', 'manifest.json');

/**
 * Updates the manifest.json version to match package.json
 */
function updateManifestVersion() {
  try {
    console.log('🔄 Synchronizing manifest.json version with package.json...');

    // Read package.json
    if (!fs.existsSync(PACKAGE_PATH)) {
      throw new Error('❌ package.json not found');
    }

    const packageContent = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
    const newVersion = packageContent.version;

    if (!newVersion) {
      throw new Error('❌ No version found in package.json');
    }

    // Read manifest.json
    if (!fs.existsSync(MANIFEST_PATH)) {
      throw new Error('❌ manifest.json not found');
    }

    const manifestContent = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const oldVersion = manifestContent.version;

    // Update version
    manifestContent.version = newVersion;

    // Write back to manifest.json with proper formatting
    fs.writeFileSync(
      MANIFEST_PATH,
      JSON.stringify(manifestContent, null, 2) + '\n'
    );

    console.log(`✅ Version updated: ${oldVersion} → ${newVersion}`);
    console.log(`   package.json: ${newVersion}`);
    console.log(`   manifest.json: ${newVersion}`);
  } catch (error) {
    console.error(`❌ Failed to update manifest version: ${error.message}`);
    process.exit(1);
  }
}

// Run if script is executed directly
if (require.main === module) {
  updateManifestVersion();
}

module.exports = { updateManifestVersion };
