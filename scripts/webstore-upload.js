#!/usr/bin/env node

/**
 * Chrome Web Store Upload Script
 *
 * Handles uploading the extension to Chrome Web Store using
 * the Chrome Web Store API.
 *
 * Requires environment variables:
 * - CHROME_EXTENSION_ID
 * - CHROME_CLIENT_ID
 * - CHROME_CLIENT_SECRET
 * - CHROME_REFRESH_TOKEN
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const EXTENSION_ZIP = path.join(__dirname, '..', 'chatmarks-extension.zip');

/**
 * Gets required environment variables
 */
function getEnvironmentConfig() {
  const requiredVars = [
    'CHROME_EXTENSION_ID',
    'CHROME_CLIENT_ID',
    'CHROME_CLIENT_SECRET',
    'CHROME_REFRESH_TOKEN',
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(
      `❌ Missing required environment variables: ${missing.join(', ')}`
    );
  }

  return {
    extensionId: process.env.CHROME_EXTENSION_ID,
    clientId: process.env.CHROME_CLIENT_ID,
    clientSecret: process.env.CHROME_CLIENT_SECRET,
    refreshToken: process.env.CHROME_REFRESH_TOKEN,
  };
}

/**
 * Gets access token using refresh token
 */
function getAccessToken(config) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    }).toString();

    const options = {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          const response = JSON.parse(data);
          resolve(response.access_token);
        } else {
          reject(
            new Error(`Failed to get access token: ${res.statusCode} ${data}`)
          );
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Uploads extension to Chrome Web Store
 */
function uploadExtension(config, accessToken) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(EXTENSION_ZIP)) {
      reject(
        new Error('❌ Extension zip file not found. Run "npm run pack" first.')
      );
      return;
    }

    const zipData = fs.readFileSync(EXTENSION_ZIP);

    const options = {
      hostname: 'www.googleapis.com',
      path: `/upload/chromewebstore/v1.1/items/${config.extensionId}`,
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/zip',
        'Content-Length': zipData.length,
        'x-goog-api-version': '2',
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          const response = JSON.parse(data);
          resolve(response);
        } else {
          reject(new Error(`Upload failed: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(zipData);
    req.end();
  });
}

/**
 * Gets upload status
 */
function getUploadStatus(config, accessToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.googleapis.com',
      path: `/chromewebstore/v1.1/items/${config.extensionId}?projection=DRAFT`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-goog-api-version': '2',
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          const response = JSON.parse(data);
          resolve(response);
        } else {
          reject(new Error(`Status check failed: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Main upload function
 */
async function uploadToWebStore() {
  try {
    console.log('🚀 Starting Chrome Web Store upload...\n');

    // Get configuration
    const config = getEnvironmentConfig();
    console.log(`📦 Extension ID: ${config.extensionId}`);

    // Get access token
    console.log('🔑 Getting access token...');
    const accessToken = await getAccessToken(config);
    console.log('✅ Access token obtained');

    // Check extension zip exists
    if (!fs.existsSync(EXTENSION_ZIP)) {
      throw new Error('❌ Extension zip not found. Run "npm run pack" first.');
    }

    const zipStats = fs.statSync(EXTENSION_ZIP);
    console.log(`📁 Extension package: ${(zipStats.size / 1024).toFixed(0)}KB`);

    // Upload extension
    console.log('📤 Uploading extension to Chrome Web Store...');
    const uploadResponse = await uploadExtension(config, accessToken);

    if (uploadResponse.uploadState === 'SUCCESS') {
      console.log('✅ Extension uploaded successfully');
    } else {
      console.log(
        `⚠️  Upload completed with state: ${uploadResponse.uploadState}`
      );
    }

    // Check status
    console.log('🔍 Checking upload status...');
    const statusResponse = await getUploadStatus(config, accessToken);

    console.log(`   Status: ${statusResponse.status || 'Unknown'}`);
    console.log(`   Version: ${statusResponse.version || 'Unknown'}`);

    if (statusResponse.itemError && statusResponse.itemError.length > 0) {
      console.log('❌ Upload errors found:');
      statusResponse.itemError.forEach(error => {
        console.log(`   - ${error.error_detail || error.error_code}`);
      });
      throw new Error('Upload validation failed');
    }

    console.log('\n✅ Upload completed successfully!');
    console.log('📋 Next steps:');
    console.log(
      '   1. Review the extension in Chrome Web Store Developer Dashboard'
    );
    console.log('   2. Test the uploaded version thoroughly');
    console.log('   3. Use "npm run webstore:publish" to publish when ready');
  } catch (error) {
    console.error(`\n❌ Upload failed: ${error.message}`);

    if (error.message.includes('environment variables')) {
      console.log('\n📝 To set up Chrome Web Store API access:');
      console.log('   1. Go to Google Cloud Console');
      console.log('   2. Enable Chrome Web Store API');
      console.log('   3. Create OAuth 2.0 credentials');
      console.log('   4. Set the required environment variables');
    }

    process.exit(1);
  }
}

// Run upload if script is executed directly
if (require.main === module) {
  uploadToWebStore();
}

module.exports = { uploadToWebStore };
