#!/usr/bin/env node

/**
 * Bundle Size Analysis Script
 *
 * Analyzes the built extension bundle size and provides detailed
 * breakdowns to help identify optimization opportunities.
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '..', 'dist');

/**
 * Size limits for Chrome Web Store and performance
 */
const SIZE_LIMITS = {
  // Chrome Web Store limits
  TOTAL_MAX: 128 * 1024 * 1024, // 128MB
  INDIVIDUAL_FILE_MAX: 25 * 1024 * 1024, // 25MB per file

  // Performance targets
  TOTAL_TARGET: 5 * 1024 * 1024, // 5MB target
  JS_FILE_TARGET: 1 * 1024 * 1024, // 1MB per JS file target
  CONTENT_SCRIPT_TARGET: 500 * 1024, // 500KB for content scripts

  // Warning thresholds
  LARGE_FILE_WARNING: 100 * 1024, // 100KB
  VERY_LARGE_FILE_WARNING: 500 * 1024, // 500KB
};

/**
 * Formats byte size to human-readable format
 */
function formatSize(bytes) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Gets file size and metadata
 */
function getFileInfo(filePath) {
  const stats = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const relativePath = path.relative(DIST_DIR, filePath);

  return {
    path: relativePath,
    size: stats.size,
    extension: ext,
    isJS: ext === '.js',
    isCSS: ext === '.css',
    isHTML: ext === '.html',
    isImage: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'].includes(ext),
    isFont: ['.woff', '.woff2', '.ttf', '.otf'].includes(ext),
  };
}

/**
 * Recursively scans directory and collects file information
 */
function scanDirectory(dirPath) {
  let files = [];

  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stats = fs.statSync(itemPath);

    if (stats.isDirectory()) {
      files = files.concat(scanDirectory(itemPath));
    } else if (stats.isFile()) {
      files.push(getFileInfo(itemPath));
    }
  }

  return files;
}

/**
 * Analyzes bundle composition
 */
function analyzeBundleComposition(files) {
  const composition = {
    totalSize: 0,
    totalFiles: files.length,
    byType: {},
    largestFiles: [],
    warnings: [],
  };

  // Group by file type
  files.forEach(file => {
    composition.totalSize += file.size;

    const category = file.isJS
      ? 'JavaScript'
      : file.isCSS
        ? 'CSS'
        : file.isHTML
          ? 'HTML'
          : file.isImage
            ? 'Images'
            : file.isFont
              ? 'Fonts'
              : 'Other';

    if (!composition.byType[category]) {
      composition.byType[category] = {
        size: 0,
        count: 0,
        files: [],
      };
    }

    composition.byType[category].size += file.size;
    composition.byType[category].count++;
    composition.byType[category].files.push(file);
  });

  // Sort files by size
  composition.largestFiles = files.sort((a, b) => b.size - a.size).slice(0, 10);

  return composition;
}

/**
 * Checks for size limit violations and warnings
 */
function checkSizeLimits(composition) {
  const violations = [];
  const warnings = [];

  // Check total size limits
  if (composition.totalSize > SIZE_LIMITS.TOTAL_MAX) {
    violations.push({
      type: 'total_size_exceeded',
      message: `Total size ${formatSize(composition.totalSize)} exceeds Chrome Web Store limit of ${formatSize(SIZE_LIMITS.TOTAL_MAX)}`,
      severity: 'error',
    });
  } else if (composition.totalSize > SIZE_LIMITS.TOTAL_TARGET) {
    warnings.push({
      type: 'total_size_large',
      message: `Total size ${formatSize(composition.totalSize)} exceeds performance target of ${formatSize(SIZE_LIMITS.TOTAL_TARGET)}`,
      severity: 'warning',
    });
  }

  // Check individual file sizes
  composition.largestFiles.forEach(file => {
    if (file.size > SIZE_LIMITS.INDIVIDUAL_FILE_MAX) {
      violations.push({
        type: 'file_size_exceeded',
        message: `File ${file.path} (${formatSize(file.size)}) exceeds Chrome Web Store limit of ${formatSize(SIZE_LIMITS.INDIVIDUAL_FILE_MAX)}`,
        severity: 'error',
      });
    } else if (file.isJS && file.size > SIZE_LIMITS.JS_FILE_TARGET) {
      warnings.push({
        type: 'js_file_large',
        message: `JavaScript file ${file.path} (${formatSize(file.size)}) exceeds performance target of ${formatSize(SIZE_LIMITS.JS_FILE_TARGET)}`,
        severity: 'warning',
      });
    } else if (file.size > SIZE_LIMITS.VERY_LARGE_FILE_WARNING) {
      warnings.push({
        type: 'file_very_large',
        message: `File ${file.path} (${formatSize(file.size)}) is very large`,
        severity: 'warning',
      });
    }
  });

  return { violations, warnings };
}

/**
 * Provides optimization suggestions
 */
function getOptimizationSuggestions(composition, issues) {
  const suggestions = [];

  // JavaScript optimization suggestions
  const jsFiles = composition.byType['JavaScript'];
  if (jsFiles && jsFiles.size > SIZE_LIMITS.JS_FILE_TARGET) {
    suggestions.push('Consider code splitting for large JavaScript files');
    suggestions.push('Enable tree shaking to remove unused code');
    suggestions.push('Use dynamic imports for non-critical code');
  }

  // Image optimization suggestions
  const imageFiles = composition.byType['Images'];
  if (imageFiles && imageFiles.size > 100 * 1024) {
    suggestions.push(
      'Optimize image assets (use WebP format, compress images)'
    );
    suggestions.push('Consider using SVG for icons instead of raster images');
  }

  // General suggestions based on violations
  if (issues.violations.length > 0) {
    suggestions.push(
      'Critical: Address size limit violations before publishing'
    );
  }

  if (issues.warnings.length > 0) {
    suggestions.push(
      'Consider addressing size warnings to improve performance'
    );
  }

  // Bundle analysis suggestions
  if (composition.totalFiles > 50) {
    suggestions.push('Consider bundling smaller files to reduce file count');
  }

  return suggestions;
}

/**
 * Prints detailed analysis report
 */
function printAnalysisReport(composition, issues, suggestions) {
  console.log('📊 Bundle Size Analysis Report\n');

  // Overall summary
  console.log(`📦 Total Size: ${formatSize(composition.totalSize)}`);
  console.log(`📁 Total Files: ${composition.totalFiles}`);
  console.log('');

  // Size by category
  console.log('📋 Size by Category:');
  Object.entries(composition.byType)
    .sort(([, a], [, b]) => b.size - a.size)
    .forEach(([category, data]) => {
      const percentage = ((data.size / composition.totalSize) * 100).toFixed(1);
      console.log(
        `   ${category}: ${formatSize(data.size)} (${percentage}%) - ${data.count} files`
      );
    });
  console.log('');

  // Largest files
  console.log('📈 Largest Files:');
  composition.largestFiles.slice(0, 5).forEach((file, index) => {
    const percentage = ((file.size / composition.totalSize) * 100).toFixed(1);
    console.log(
      `   ${index + 1}. ${file.path}: ${formatSize(file.size)} (${percentage}%)`
    );
  });
  console.log('');

  // Violations and warnings
  if (issues.violations.length > 0) {
    console.log('❌ Size Limit Violations:');
    issues.violations.forEach(violation => {
      console.log(`   ${violation.message}`);
    });
    console.log('');
  }

  if (issues.warnings.length > 0) {
    console.log('⚠️  Size Warnings:');
    issues.warnings.forEach(warning => {
      console.log(`   ${warning.message}`);
    });
    console.log('');
  }

  // Optimization suggestions
  if (suggestions.length > 0) {
    console.log('💡 Optimization Suggestions:');
    suggestions.forEach(suggestion => {
      console.log(`   • ${suggestion}`);
    });
    console.log('');
  }

  // Performance indicators
  console.log('⚡ Performance Indicators:');
  console.log(
    `   Load Time Estimate: ${Math.ceil(composition.totalSize / (50 * 1024))}s (on slow connection)`
  );
  console.log(
    `   Memory Usage Estimate: ~${Math.ceil((composition.totalSize * 2) / (1024 * 1024))}MB`
  );
}

/**
 * Main size check function
 */
async function checkSize() {
  try {
    console.log('📏 Starting bundle size analysis...\n');

    if (!fs.existsSync(DIST_DIR)) {
      throw new Error(
        '❌ Build directory not found. Run "npm run build" first.'
      );
    }

    // Scan all files
    const files = scanDirectory(DIST_DIR);

    if (files.length === 0) {
      throw new Error('❌ No files found in build directory');
    }

    // Analyze composition
    const composition = analyzeBundleComposition(files);

    // Check size limits
    const issues = checkSizeLimits(composition);

    // Get optimization suggestions
    const suggestions = getOptimizationSuggestions(composition, issues);

    // Print report
    printAnalysisReport(composition, issues, suggestions);

    // Exit with error if there are violations
    if (issues.violations.length > 0) {
      console.log('❌ Size check failed due to limit violations');
      process.exit(1);
    }

    if (issues.warnings.length > 0) {
      console.log('⚠️  Size check completed with warnings');
    } else {
      console.log('✅ Size check passed - all files within limits');
    }
  } catch (error) {
    console.error(`\n${error.message}`);
    process.exit(1);
  }
}

// Run size check if script is executed directly
if (require.main === module) {
  checkSize();
}

module.exports = { checkSize };
