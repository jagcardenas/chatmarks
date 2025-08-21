# chatmarks

A browser extension that adds powerful note‑taking and bookmarking to AI chat platforms.

## Supported platforms
- ChatGPT: `https://chatgpt.com/*` and `https://chat.openai.com/*`
- Claude: `https://claude.ai/*`

## What you can do now
- Select text in a conversation to reveal a floating “Bookmark” button
- Click the button (or press Cmd/Ctrl+B) to open a dialog
- Add an optional note and save the bookmark
- Bookmarks are persisted locally via `chrome.storage.local`

## How it works (high‑level)
- Content script detects platform, captures selections, shows the bookmark dialog, and sends a `CREATE_BOOKMARK` message
- Background service worker handles `CREATE_BOOKMARK` and stores bookmarks under the `bookmarks` key
- The popup can read bookmarks via `GET_BOOKMARKS` to display counts and recent items

## Dev
- Vite + CRXJS build (`vite.config.ts`)
- Manifest V3 (`manifest.json`) with `host_permissions` for supported domains

## Roadmap (V1 highlights)
- UI: creation dialog (done), highlights (pending)
- Storage: CRUD and filtering (partial)
- Navigation: jump to/next/previous bookmarks (pending)
