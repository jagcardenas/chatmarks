# Background Service Worker - Chrome Extension Manifest V3

## Purpose
Implements the Chrome Extension Manifest V3 service worker that orchestrates extension-wide functionality, providing context menu management, inter-context messaging, bookmark persistence, and settings management through a streamlined, ephemeral background process.

## Key Components
- **service-worker.ts**: Manifest V3 compliant service worker with full StorageService integration, context menu management, and comprehensive message routing

## Implemented Functionality (Task 2 + Context Menu Integration)

### **Context Menu Management**
- **Dynamic Menu Creation**: "Create Bookmark" option appears only when text is selected
- **Platform-Specific URLs**: Context menu restricted to supported AI platforms
- **Selection Text Passing**: Passes selected text to content script for bookmark creation
- **Permission-Based Access**: Uses `contextMenus` permission with proper document URL patterns

### **Advanced Message Routing**
- **Typed Message System**: Full TypeScript support with MessageType enumeration
- **Async Handler Support**: Proper async/await handling with response management
- **Error Recovery**: Comprehensive error handling with user-friendly error messages
- **Performance Monitoring**: Built-in timing and success/failure tracking

### **Integrated Storage Operations**
- **StorageService Integration**: Uses full StorageService architecture with validation
- **Bookmark CRUD**: Complete bookmark creation, reading, updating, deletion via background
- **Settings Persistence**: Advanced settings management with schema validation
- **Data Migration**: Automatic schema migration support for updates

### **Extension Lifecycle Management**
- **Installation Handling**: Sets up default settings, context menus, and initializes storage
- **Default Configuration**: Creates default theme settings and keyboard shortcuts
- **Service Worker Restart**: Ephemeral architecture with proper state recovery

## Integration Points
- **Content Scripts**: Receives bookmark creation requests (`CREATE_BOOKMARK`) and navigation
- **Popup Interface**: Provides bookmark data via `GET_BOOKMARKS` and handles user interactions
- **Options Page**: Manages settings persistence and data export/import
- **Chrome APIs**: Utilizes storage, contextMenus, tabs, and runtime APIs

## Performance Considerations
- Service workers are ephemeral and restart frequently - no global state persistence
- All persistent data stored in chrome.storage.local for unlimited quota
- Minimal CPU usage - only active during message handling and user interactions
- Optimized for fast startup and low memory footprint

## Testing Approach
- Mock Chrome APIs for unit testing service worker functions
- Test message routing and response handling with different scenarios
- Validate context menu creation and click handling
- Test settings persistence and retrieval operations