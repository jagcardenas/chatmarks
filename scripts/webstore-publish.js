#!/usr/bin/env node

/**
 * Chrome Web Store Publishing Script
 *
 * Publishes the uploaded extension draft to the Chrome Web Store
 * making it publicly available.
 *
 * Requires environment variables:
 * - CHROME_EXTENSION_ID
 * - CHROME_CLIENT_ID
 * - CHROME_CLIENT_SECRET
 * - CHROME_REFRESH_TOKEN
 */

const https = require('https');

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
 * Gets current extension status
 */
function getExtensionStatus(config, accessToken) {
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
 * Publishes the extension
 */
function publishExtension(config, accessToken, target = 'default') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.googleapis.com',
      path: `/chromewebstore/v1.1/items/${config.extensionId}/publish?publishTarget=${target}`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Length': '0',
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
          reject(new Error(`Publish failed: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Validates extension is ready for publishing
 */
function validateReadyForPublish(extensionStatus) {
  const errors = [];

  // Check if there's a draft available
  if (extensionStatus.status === 'ITEM_NOT_FOUND') {
    errors.push('Extension not found. Upload extension first.');
  }

  // Check for validation errors
  if (extensionStatus.itemError && extensionStatus.itemError.length > 0) {
    errors.push('Extension has validation errors:');
    extensionStatus.itemError.forEach(error => {
      errors.push(`  - ${error.error_detail || error.error_code}`);
    });
  }

  // Check publishing status
  if (
    extensionStatus.publishedStatus === 'PUBLISHED' &&
    extensionStatus.status === 'OK' &&
    !extensionStatus.version
  ) {
    errors.push('No new version available to publish');
  }

  return errors;
}

/**
 * Main publishing function
 */
async function publishToWebStore() {
  try {
    console.log('🚀 Starting Chrome Web Store publishing...\n');

    // Get configuration
    const config = getEnvironmentConfig();
    console.log(`📦 Extension ID: ${config.extensionId}`);

    // Get access token
    console.log('🔑 Getting access token...');
    const accessToken = await getAccessToken(config);
    console.log('✅ Access token obtained');

    // Check current status
    console.log('🔍 Checking extension status...');
    const extensionStatus = await getExtensionStatus(config, accessToken);

    console.log(`   Current status: ${extensionStatus.status || 'Unknown'}`);
    console.log(
      `   Published status: ${extensionStatus.publishedStatus || 'Unknown'}`
    );
    console.log(`   Version: ${extensionStatus.version || 'Unknown'}`);

    // Validate ready for publishing
    const validationErrors = validateReadyForPublish(extensionStatus);
    if (validationErrors.length > 0) {
      console.log('❌ Extension not ready for publishing:');
      validationErrors.forEach(error => console.log(`   ${error}`));
      throw new Error('Pre-publish validation failed');
    }

    console.log('✅ Extension validation passed');

    // Confirm publishing action
    console.log(
      '\n⚠️  This will publish the extension to the Chrome Web Store'
    );
    console.log('   making it publicly available to all users.');

    // In CI environment, publish automatically
    // In interactive mode, you might want to add confirmation
    const isCI = process.env.CI === 'true';

    if (!isCI) {
      console.log('\n🔄 Publishing to Chrome Web Store...');
    }

    // Publish extension
    const publishResponse = await publishExtension(config, accessToken);

    if (publishResponse.status && publishResponse.status.includes('OK')) {
      console.log('✅ Extension published successfully!');
    } else {
      console.log(
        `⚠️  Publish completed with response: ${JSON.stringify(publishResponse)}`
      );
    }

    // Get updated status
    console.log('🔍 Checking updated status...');
    const updatedStatus = await getExtensionStatus(config, accessToken);

    console.log(`   Status: ${updatedStatus.status || 'Unknown'}`);
    console.log(
      `   Published status: ${updatedStatus.publishedStatus || 'Unknown'}`
    );

    console.log('\n✅ Publishing completed!');
    console.log('📋 Post-publish information:');
    console.log('   • Extension is now live on Chrome Web Store');
    console.log('   • It may take a few hours to propagate to all users');
    console.log('   • Monitor the Developer Dashboard for any issues');
    console.log('   • Check extension reviews and ratings regularly');
  } catch (error) {
    console.error(`\n❌ Publishing failed: ${error.message}`);

    if (error.message.includes('environment variables')) {
      console.log('\n📝 To set up Chrome Web Store API access:');
      console.log('   1. Go to Google Cloud Console');
      console.log('   2. Enable Chrome Web Store API');
      console.log('   3. Create OAuth 2.0 credentials');
      console.log('   4. Set the required environment variables');
    }

    if (error.message.includes('validation')) {
      console.log('\n📝 To resolve validation issues:');
      console.log('   1. Upload a new version with "npm run webstore:upload"');
      console.log('   2. Fix any validation errors shown above');
      console.log('   3. Retry publishing');
    }

    process.exit(1);
  }
}

// Run publishing if script is executed directly
if (require.main === module) {
  publishToWebStore();
}

module.exports = { publishToWebStore };
