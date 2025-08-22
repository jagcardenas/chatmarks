#!/usr/bin/env node

/**
 * Chrome Extension Validation Script
 *
 * Validates the built extension against Chrome Web Store requirements
 * and Manifest V3 specifications.
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const MANIFEST_PATH = path.join(DIST_DIR, 'manifest.json');

/**
 * Validates that the extension build directory exists and contains required files
 */
function validateBuildStructure() {
  console.log('🔍 Validating extension build structure...');

  if (!fs.existsSync(DIST_DIR)) {
    throw new Error(
      '❌ Build directory (dist/) not found. Run "npm run build" first.'
    );
  }

  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(
      '❌ manifest.json not found in dist/. Build may have failed.'
    );
  }

  const requiredFiles = ['manifest.json', 'popup.js', 'options.js'];

  // Check for service worker (could be service-worker-loader.js or in chunks/)
  const hasServiceWorker =
    fs.existsSync(path.join(DIST_DIR, 'service-worker-loader.js')) ||
    fs.existsSync(path.join(DIST_DIR, 'chunks', 'service-worker.ts.js'));

  if (!hasServiceWorker) {
    throw new Error('❌ Service worker file not found');
  }

  const missingFiles = requiredFiles.filter(
    file => !fs.existsSync(path.join(DIST_DIR, file))
  );

  if (missingFiles.length > 0) {
    throw new Error(`❌ Required files missing: ${missingFiles.join(', ')}`);
  }

  console.log('✅ Build structure validation passed');
}

/**
 * Validates the manifest.json against Manifest V3 requirements
 */
function validateManifest() {
  console.log('🔍 Validating manifest.json...');

  const manifestContent = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(manifestContent);

  // Check required fields
  const requiredFields = ['manifest_version', 'name', 'version', 'description'];
  const missingFields = requiredFields.filter(field => !manifest[field]);

  if (missingFields.length > 0) {
    throw new Error(
      `❌ Missing required manifest fields: ${missingFields.join(', ')}`
    );
  }

  // Check Manifest V3
  if (manifest.manifest_version !== 3) {
    throw new Error('❌ Must use Manifest V3');
  }

  // Validate permissions
  const allowedPermissions = [
    'storage',
    'activeTab',
    'scripting',
    'contextMenus',
  ];
  const permissions = manifest.permissions || [];
  const invalidPermissions = permissions.filter(
    p => !allowedPermissions.includes(p)
  );

  if (invalidPermissions.length > 0) {
    throw new Error(`❌ Invalid permissions: ${invalidPermissions.join(', ')}`);
  }

  // Check for service worker
  if (!manifest.background || !manifest.background.service_worker) {
    throw new Error('❌ Background service worker not defined in manifest');
  }

  // Validate host permissions
  const hostPermissions = manifest.host_permissions || [];
  const allowedHosts = [
    'https://chat.openai.com/*',
    'https://chatgpt.com/*',
    'https://claude.ai/*',
    'https://x.com/*',
    'https://grok.x.ai/*',
  ];

  const invalidHosts = hostPermissions.filter(
    host => !allowedHosts.includes(host)
  );
  if (invalidHosts.length > 0) {
    console.warn(`⚠️  Unexpected host permissions: ${invalidHosts.join(', ')}`);
  }

  console.log('✅ Manifest validation passed');
  console.log(`   Version: ${manifest.version}`);
  console.log(`   Name: ${manifest.name}`);
  console.log(`   Permissions: ${permissions.join(', ')}`);
}

/**
 * Validates version consistency between package.json and manifest.json
 */
function validateVersionConsistency() {
  console.log('🔍 Validating version consistency...');

  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const manifestContent = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

  if (packageContent.version !== manifestContent.version) {
    throw new Error(
      `❌ Version mismatch: package.json (${packageContent.version}) != manifest.json (${manifestContent.version})`
    );
  }

  console.log(`✅ Version consistency validated: ${packageContent.version}`);
}

/**
 * Checks extension file sizes against Chrome Web Store limits
 */
function validateFileSizes() {
  console.log('🔍 Validating file sizes...');

  const MAX_TOTAL_SIZE = 128 * 1024 * 1024; // 128MB (Chrome Web Store limit)
  const MAX_INDIVIDUAL_FILE = 25 * 1024 * 1024; // 25MB per file

  function getDirectorySize(dirPath) {
    let totalSize = 0;
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        totalSize += getDirectorySize(filePath);
      } else {
        totalSize += stats.size;

        // Check individual file size
        if (stats.size > MAX_INDIVIDUAL_FILE) {
          throw new Error(
            `❌ File too large: ${file} (${(stats.size / 1024 / 1024).toFixed(2)}MB > 25MB)`
          );
        }
      }
    }

    return totalSize;
  }

  const totalSize = getDirectorySize(DIST_DIR);

  if (totalSize > MAX_TOTAL_SIZE) {
    throw new Error(
      `❌ Extension too large: ${(totalSize / 1024 / 1024).toFixed(2)}MB > 128MB`
    );
  }

  console.log(
    `✅ File size validation passed: ${(totalSize / 1024).toFixed(0)}KB total`
  );
}

/**
 * Main validation function
 */
async function validateExtension() {
  try {
    console.log('🚀 Starting Chrome extension validation...\n');

    validateBuildStructure();
    validateManifest();
    validateVersionConsistency();
    validateFileSizes();

    console.log('\n✅ All validation checks passed!');
    console.log('📦 Extension is ready for packaging and distribution');
  } catch (error) {
    console.error(`\n${error.message}`);
    process.exit(1);
  }
}

// Run validation if script is executed directly
if (require.main === module) {
  validateExtension();
}

module.exports = { validateExtension };
