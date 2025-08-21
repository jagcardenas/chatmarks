/**
 * Vite Configuration for Chatmarks Chrome Extension
 * 
 * Configures the build system with CRXJS plugin for Chrome extension development,
 * including Hot Module Replacement (HMR), TypeScript compilation, and proper
 * asset handling for manifest V3 extensions.
 */

import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    crx({ 
      manifest,
      // Enable content script HMR for development
      contentScripts: {
        injectCss: true,
      },
    }),
  ],
  
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        // Main extension entry points
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
      },
      output: {
        // Ensure consistent naming for Chrome extension compatibility
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    
    // Source maps for development debugging
    sourcemap: process.env.NODE_ENV === 'development',
    
    // Minimize bundle size for better performance
    minify: process.env.NODE_ENV === 'production',
    
    // Output directory for built extension
    outDir: 'dist',
    emptyOutDir: true,
  },
  
  // Development server configuration
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5174,
    },
  },
  
  // Path resolution for clean imports
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@types': resolve(__dirname, 'src/types'),
      '@content': resolve(__dirname, 'src/content'),
      '@background': resolve(__dirname, 'src/background'),
      '@popup': resolve(__dirname, 'src/popup'),
    },
  },
  
  // Environment variables for different build contexts
  define: {
    __DEV__: process.env.NODE_ENV === 'development',
    __VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
  },
  
  // TypeScript configuration
  esbuild: {
    target: 'es2020',
    // Remove console logs in production
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
  
  // Optimization configuration
  optimizeDeps: {
    // Pre-bundle dependencies for faster development
    include: [],
    // Exclude Chrome extension APIs from bundling
    exclude: ['chrome'],
  },
});