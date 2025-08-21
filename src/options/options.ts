/**
 * Options Page Script for Chatmarks Extension
 * 
 * Handles the settings interface for customizing extension behavior,
 * appearance, and keyboard shortcuts.
 */

import { MessageType } from '../types/messages';

interface ExtensionSettings {
  highlightColor: string;
  showMinimap: boolean;
  sidebarPosition: 'left' | 'right';
  keyboardShortcuts: {
    createBookmark: string;
    nextBookmark: string;
    prevBookmark: string;
    showSidebar: string;
  };
  autoSave: boolean;
  contextMenu: boolean;
  floatingButton: boolean;
}

/**
 * Default extension settings
 */
const DEFAULT_SETTINGS: ExtensionSettings = {
  highlightColor: '#ffeb3b',
  showMinimap: true,
  sidebarPosition: 'right',
  keyboardShortcuts: {
    createBookmark: 'Ctrl+B',
    nextBookmark: 'Alt+ArrowDown',
    prevBookmark: 'Alt+ArrowUp',
    showSidebar: 'Ctrl+Shift+B'
  },
  autoSave: true,
  contextMenu: true,
  floatingButton: true
};

/**
 * Initialize options page when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', initializeOptionsPage);

/**
 * Initialize the options page interface
 */
async function initializeOptionsPage(): Promise<void> {
  try {
    // Load current settings
    await loadSettings();
    
    // Set up event listeners
    setupEventListeners();
    
    console.log('Chatmarks options page initialized');
  } catch (error) {
    console.error('Failed to initialize options page:', error);
    showSaveStatus('Failed to load settings', 'error');
  }
}

/**
 * Load settings from Chrome storage and populate the form
 */
async function loadSettings(): Promise<void> {
  try {
    const result = await chrome.storage.local.get('settings');
    const settings: ExtensionSettings = result.settings || DEFAULT_SETTINGS;
    
    // Populate form fields with current settings
    populateForm(settings);
    
    console.log('Settings loaded:', settings);
  } catch (error) {
    console.error('Failed to load settings:', error);
    // Fall back to default settings
    populateForm(DEFAULT_SETTINGS);
  }
}

/**
 * Populate form fields with settings values
 */
function populateForm(settings: ExtensionSettings): void {
  // Appearance settings
  (document.getElementById('highlight-color') as HTMLInputElement).value = settings.highlightColor;
  (document.getElementById('show-minimap') as HTMLInputElement).checked = settings.showMinimap;
  (document.getElementById('sidebar-position') as HTMLSelectElement).value = settings.sidebarPosition;
  
  // Keyboard shortcuts
  (document.getElementById('create-bookmark-shortcut') as HTMLInputElement).value = settings.keyboardShortcuts.createBookmark;
  (document.getElementById('next-bookmark-shortcut') as HTMLInputElement).value = settings.keyboardShortcuts.nextBookmark;
  (document.getElementById('prev-bookmark-shortcut') as HTMLInputElement).value = settings.keyboardShortcuts.prevBookmark;
  (document.getElementById('show-sidebar-shortcut') as HTMLInputElement).value = settings.keyboardShortcuts.showSidebar;
  
  // Behavior settings
  (document.getElementById('auto-save') as HTMLInputElement).checked = settings.autoSave;
  (document.getElementById('context-menu') as HTMLInputElement).checked = settings.contextMenu;
  (document.getElementById('floating-button') as HTMLInputElement).checked = settings.floatingButton;
  
  // Update color preview
  updateColorPreview(settings.highlightColor);
}

/**
 * Update color preview when highlight color changes
 */
function updateColorPreview(color: string): void {
  const preview = document.querySelector('.color-preview') as HTMLElement;
  if (preview) {
    preview.style.backgroundColor = color;
  }
}

/**
 * Set up event listeners for form interactions
 */
function setupEventListeners(): void {
  // Save settings button
  document.getElementById('save-settings')?.addEventListener('click', handleSaveSettings);
  
  // Reset to defaults button
  document.getElementById('reset-defaults')?.addEventListener('click', handleResetDefaults);
  
  // Export bookmarks button
  document.getElementById('export-bookmarks')?.addEventListener('click', handleExportBookmarks);
  
  // Import bookmarks trigger
  document.getElementById('import-trigger')?.addEventListener('click', handleImportTrigger);
  document.getElementById('import-bookmarks')?.addEventListener('change', handleImportBookmarks);
  
  // Clear all data button
  document.getElementById('clear-all-data')?.addEventListener('click', handleClearAllData);
  
  // Highlight color change
  document.getElementById('highlight-color')?.addEventListener('input', (e) => {
    const color = (e.target as HTMLInputElement).value;
    updateColorPreview(color);
  });
  
  // Auto-save on form changes (if enabled)
  document.querySelectorAll('input, select').forEach(element => {
    element.addEventListener('change', handleFormChange);
  });
}

/**
 * Handle form changes for auto-save functionality
 */
function handleFormChange(): void {
  const autoSave = (document.getElementById('auto-save') as HTMLInputElement).checked;
  if (autoSave) {
    // Debounced auto-save (implemented in later task)
    console.log('Auto-save triggered');
  }
}

/**
 * Handle save settings button click
 */
async function handleSaveSettings(): Promise<void> {
  try {
    const settings = collectFormData();
    
    await chrome.storage.local.set({ settings });
    
    showSaveStatus('Settings saved successfully', 'success');
    console.log('Settings saved:', settings);
  } catch (error) {
    console.error('Failed to save settings:', error);
    showSaveStatus('Failed to save settings', 'error');
  }
}

/**
 * Collect form data into settings object
 */
function collectFormData(): ExtensionSettings {
  return {
    highlightColor: (document.getElementById('highlight-color') as HTMLInputElement).value,
    showMinimap: (document.getElementById('show-minimap') as HTMLInputElement).checked,
    sidebarPosition: (document.getElementById('sidebar-position') as HTMLSelectElement).value as 'left' | 'right',
    keyboardShortcuts: {
      createBookmark: (document.getElementById('create-bookmark-shortcut') as HTMLInputElement).value,
      nextBookmark: (document.getElementById('next-bookmark-shortcut') as HTMLInputElement).value,
      prevBookmark: (document.getElementById('prev-bookmark-shortcut') as HTMLInputElement).value,
      showSidebar: (document.getElementById('show-sidebar-shortcut') as HTMLInputElement).value,
    },
    autoSave: (document.getElementById('auto-save') as HTMLInputElement).checked,
    contextMenu: (document.getElementById('context-menu') as HTMLInputElement).checked,
    floatingButton: (document.getElementById('floating-button') as HTMLInputElement).checked,
  };
}

/**
 * Handle reset to defaults button click
 */
async function handleResetDefaults(): Promise<void> {
  if (confirm('Are you sure you want to reset all settings to defaults?')) {
    try {
      populateForm(DEFAULT_SETTINGS);
      await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
      
      showSaveStatus('Settings reset to defaults', 'success');
      console.log('Settings reset to defaults');
    } catch (error) {
      console.error('Failed to reset settings:', error);
      showSaveStatus('Failed to reset settings', 'error');
    }
  }
}

/**
 * Handle export bookmarks button click
 */
async function handleExportBookmarks(): Promise<void> {
  try {
    const result = await chrome.storage.local.get('bookmarks');
    const bookmarks = result.bookmarks || [];
    
    const dataStr = JSON.stringify(bookmarks, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chatmarks-bookmarks-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    showSaveStatus('Bookmarks exported successfully', 'success');
  } catch (error) {
    console.error('Failed to export bookmarks:', error);
    showSaveStatus('Failed to export bookmarks', 'error');
  }
}

/**
 * Handle import trigger button click
 */
function handleImportTrigger(): void {
  const fileInput = document.getElementById('import-bookmarks') as HTMLInputElement;
  fileInput.click();
}

/**
 * Handle import bookmarks file selection
 */
async function handleImportBookmarks(event: Event): Promise<void> {
  const fileInput = event.target as HTMLInputElement;
  const file = fileInput.files?.[0];
  
  if (!file) return;
  
  try {
    const text = await file.text();
    const bookmarks = JSON.parse(text);
    
    // Validate bookmark data structure (basic validation)
    if (!Array.isArray(bookmarks)) {
      throw new Error('Invalid bookmark data format');
    }
    
    // Confirm import
    const confirmImport = confirm(`Import ${bookmarks.length} bookmarks? This will merge with existing bookmarks.`);
    if (!confirmImport) return;
    
    // Get existing bookmarks
    const result = await chrome.storage.local.get('bookmarks');
    const existingBookmarks = result.bookmarks || [];
    
    // Merge bookmarks (avoid duplicates by ID)
    const mergedBookmarks = [...existingBookmarks];
    let importCount = 0;
    
    for (const bookmark of bookmarks) {
      if (!mergedBookmarks.find(b => b.id === bookmark.id)) {
        mergedBookmarks.push(bookmark);
        importCount++;
      }
    }
    
    // Save merged bookmarks
    await chrome.storage.local.set({ bookmarks: mergedBookmarks });
    
    showSaveStatus(`Successfully imported ${importCount} new bookmarks`, 'success');
  } catch (error) {
    console.error('Failed to import bookmarks:', error);
    showSaveStatus('Failed to import bookmarks. Please check the file format.', 'error');
  }
}

/**
 * Handle clear all data button click
 */
async function handleClearAllData(): Promise<void> {
  const confirmClear = confirm(
    'Are you sure you want to delete ALL bookmarks? This action cannot be undone.'
  );
  
  if (!confirmClear) return;
  
  // Double confirmation for safety
  const doubleConfirm = confirm(
    'This will permanently delete all your bookmarks. Are you absolutely sure?'
  );
  
  if (!doubleConfirm) return;
  
  try {
    await chrome.storage.local.remove('bookmarks');
    showSaveStatus('All bookmarks have been deleted', 'success');
  } catch (error) {
    console.error('Failed to clear bookmarks:', error);
    showSaveStatus('Failed to clear bookmarks', 'error');
  }
}

/**
 * Show save status message to user
 */
function showSaveStatus(message: string, type: 'success' | 'error'): void {
  const statusElement = document.getElementById('save-status');
  if (!statusElement) return;
  
  statusElement.textContent = message;
  statusElement.className = `save-status ${type}`;
  
  // Clear status after 3 seconds
  setTimeout(() => {
    statusElement.textContent = '';
    statusElement.className = 'save-status';
  }, 3000);
}