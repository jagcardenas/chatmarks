#!/usr/bin/env node

/**
 * Security Scanning Script for Chrome Extension
 *
 * Scans the built extension for common security issues,
 * sensitive data exposure, and potential vulnerabilities.
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '..', 'dist');

/**
 * Patterns that might indicate sensitive data
 */
const SENSITIVE_PATTERNS = [
  {
    pattern: /api[_-]?key/gi,
    description: 'API key',
  },
  {
    pattern: /secret/gi,
    description: 'Secret',
  },
  {
    pattern: /password/gi,
    description: 'Password',
  },
  {
    pattern: /token/gi,
    description: 'Token',
  },
  {
    pattern: /private[_-]?key/gi,
    description: 'Private key',
  },
  {
    pattern: /auth[_-]?token/gi,
    description: 'Auth token',
  },
  {
    pattern: /oauth/gi,
    description: 'OAuth',
  },
  {
    pattern: /bearer\s+[a-zA-Z0-9]+/gi,
    description: 'Bearer token',
  },
];

/**
 * Dangerous JavaScript patterns
 */
const DANGEROUS_PATTERNS = [
  {
    pattern: /eval\s*\(/gi,
    description: 'eval() usage',
    severity: 'high',
  },
  {
    pattern: /innerHTML\s*=/gi,
    description: 'innerHTML assignment',
    severity: 'medium',
  },
  {
    pattern: /document\.write\s*\(/gi,
    description: 'document.write() usage',
    severity: 'medium',
  },
  {
    pattern: /\.outerHTML\s*=/gi,
    description: 'outerHTML assignment',
    severity: 'medium',
  },
  {
    pattern: /new\s+Function\s*\(/gi,
    description: 'Function constructor',
    severity: 'high',
  },
  {
    pattern: /setTimeout\s*\(\s*["'].*["']/gi,
    description: 'setTimeout with string',
    severity: 'medium',
  },
  {
    pattern: /setInterval\s*\(\s*["'].*["']/gi,
    description: 'setInterval with string',
    severity: 'medium',
  },
];

/**
 * Scans a file for sensitive patterns
 */
function scanFile(filePath, patterns, patternType = 'sensitive') {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(DIST_DIR, filePath);
  const findings = [];

  patterns.forEach(({ pattern, description, severity = 'warning' }) => {
    const matches = content.match(pattern);
    if (matches) {
      findings.push({
        file: relativePath,
        pattern: description,
        matches: matches.length,
        severity,
        type: patternType,
      });
    }
  });

  return findings;
}

/**
 * Recursively scans directory for files
 */
function scanDirectory(dirPath, patterns, patternType = 'sensitive') {
  let allFindings = [];

  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stats = fs.statSync(itemPath);

    if (stats.isDirectory()) {
      allFindings = allFindings.concat(
        scanDirectory(itemPath, patterns, patternType)
      );
    } else if (stats.isFile()) {
      const ext = path.extname(item).toLowerCase();

      // Only scan relevant file types
      if (['.js', '.ts', '.json', '.html', '.css'].includes(ext)) {
        const findings = scanFile(itemPath, patterns, patternType);
        allFindings = allFindings.concat(findings);
      }
    }
  }

  return allFindings;
}

/**
 * Validates Content Security Policy
 */
function validateCSP() {
  console.log('🔍 Validating Content Security Policy...');

  const manifestPath = path.join(DIST_DIR, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    throw new Error('❌ manifest.json not found');
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Check for CSP in manifest
  if (!manifest.content_security_policy) {
    console.warn('⚠️  No Content Security Policy defined in manifest');
    return;
  }

  const csp = manifest.content_security_policy;

  // Check for unsafe CSP directives
  const unsafeDirectives = ["'unsafe-eval'", "'unsafe-inline'", 'data:', '*'];

  const cspString = JSON.stringify(csp);
  const foundUnsafe = unsafeDirectives.filter(directive =>
    cspString.includes(directive)
  );

  if (foundUnsafe.length > 0) {
    console.warn(
      `⚠️  Potentially unsafe CSP directives found: ${foundUnsafe.join(', ')}`
    );
  } else {
    console.log('✅ Content Security Policy validation passed');
  }
}

/**
 * Checks for hardcoded URLs and external requests
 */
function checkExternalRequests() {
  console.log('🔍 Checking for external requests...');

  const urlPatterns = [
    {
      pattern:
        /https?:\/\/(?!(?:chat\.openai\.com|chatgpt\.com|claude\.ai|x\.com|grok\.x\.ai))[^\s"']+/gi,
      description: 'External URL',
    },
    {
      pattern: /fetch\s*\(\s*["'][^"']*["']/gi,
      description: 'fetch() call',
    },
    {
      pattern: /XMLHttpRequest/gi,
      description: 'XMLHttpRequest usage',
    },
  ];

  const findings = scanDirectory(DIST_DIR, urlPatterns, 'external');

  if (findings.length > 0) {
    console.warn('⚠️  External requests found:');
    findings.forEach(finding => {
      console.warn(
        `   ${finding.file}: ${finding.pattern} (${finding.matches} matches)`
      );
    });
  } else {
    console.log('✅ No unexpected external requests found');
  }

  return findings;
}

/**
 * Main security scanning function
 */
async function scanSecurity() {
  try {
    console.log('🛡️  Starting security scan...\n');

    if (!fs.existsSync(DIST_DIR)) {
      throw new Error(
        '❌ Build directory not found. Run "npm run build" first.'
      );
    }

    // Scan for sensitive data
    console.log('🔍 Scanning for sensitive data...');
    const sensitiveFindings = scanDirectory(
      DIST_DIR,
      SENSITIVE_PATTERNS,
      'sensitive'
    );

    if (sensitiveFindings.length > 0) {
      console.error('❌ Sensitive data found:');
      sensitiveFindings.forEach(finding => {
        console.error(
          `   ${finding.file}: ${finding.pattern} (${finding.matches} matches)`
        );
      });
      throw new Error('Sensitive data detected in build');
    } else {
      console.log('✅ No sensitive data found');
    }

    // Scan for dangerous patterns
    console.log('🔍 Scanning for dangerous JavaScript patterns...');
    const dangerousFindings = scanDirectory(
      DIST_DIR,
      DANGEROUS_PATTERNS,
      'dangerous'
    );

    const highSeverityFindings = dangerousFindings.filter(
      f => f.severity === 'high'
    );

    if (highSeverityFindings.length > 0) {
      console.error('❌ High severity security issues found:');
      highSeverityFindings.forEach(finding => {
        console.error(
          `   ${finding.file}: ${finding.pattern} (${finding.matches} matches)`
        );
      });
      throw new Error('High severity security issues detected');
    }

    const mediumSeverityFindings = dangerousFindings.filter(
      f => f.severity === 'medium'
    );
    if (mediumSeverityFindings.length > 0) {
      console.warn('⚠️  Medium severity security issues found:');
      mediumSeverityFindings.forEach(finding => {
        console.warn(
          `   ${finding.file}: ${finding.pattern} (${finding.matches} matches)`
        );
      });
    }

    if (dangerousFindings.length === 0) {
      console.log('✅ No dangerous JavaScript patterns found');
    }

    // Validate CSP
    validateCSP();

    // Check external requests
    const externalFindings = checkExternalRequests();

    console.log('\n✅ Security scan completed');

    if (mediumSeverityFindings.length > 0 || externalFindings.length > 0) {
      console.log('⚠️  Review warnings above before proceeding with release');
    } else {
      console.log('🔒 No security issues detected');
    }
  } catch (error) {
    console.error(`\n${error.message}`);
    process.exit(1);
  }
}

// Run security scan if script is executed directly
if (require.main === module) {
  scanSecurity();
}

module.exports = { scanSecurity };
