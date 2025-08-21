# Background Scripts

## Purpose
Contains the service worker that handles extension background tasks, providing persistent functionality and coordination between different parts of the extension.

## Key Components
- **service-worker.ts**: Main service worker handling extension lifecycle, context menus, message routing, and storage operations

## Functionality
- **Context Menu Management**: Creates and handles right-click bookmark creation options
- **Inter-Context Messaging**: Routes messages between content scripts, popup, and options pages  
- **Settings Management**: Handles extension settings persistence and retrieval
- **Extension Lifecycle**: Manages installation, startup, and configuration initialization

## Integration Points
- **Content Scripts**: Receives bookmark creation and navigation requests
- **Popup Interface**: Provides bookmark data and handles user interactions
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