# Type Definitions

## Purpose
Centralizes all TypeScript type definitions and interfaces used throughout the extension, ensuring type safety and consistent data structures across all modules.

## Key Components
- **bookmark.ts**: Core bookmark data structures, text anchoring interfaces, and platform types
- **messages.ts**: Inter-context communication message types and response interfaces

## Functionality
- **Data Structure Definitions**: Bookmark, TextAnchor, SelectionRange, and related interfaces
- **Message Protocol**: Typed message system for communication between extension contexts
- **Platform Abstraction**: Type definitions for ChatGPT, Claude, and Grok platform adapters
- **Validation Types**: Result and validation interfaces for error handling and data integrity

## Integration Points
- **All Extension Modules**: Imported throughout codebase for consistent typing
- **Chrome APIs**: Extends Chrome extension API types with custom interfaces
- **Content Scripts**: Provides platform-specific types for DOM interaction
- **Storage Operations**: Defines data schemas for persistence and retrieval

## Performance Considerations
- Type-only imports that are erased at build time (no runtime cost)
- Optimized for TypeScript compilation speed with efficient type checking
- Minimal type definitions focused on actual usage patterns
- Generic types for reusable patterns across different contexts

## Testing Approach
- Type checking validation through TypeScript compiler strict mode
- Interface compatibility tests between different extension contexts
- Validation of complex generic types used in storage and messaging
- Runtime type validation for data received from Chrome APIs and user input