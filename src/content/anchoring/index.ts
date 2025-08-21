/**
 * Text Anchoring System - Main Exports
 *
 * Exports all components of the multi-strategy text anchoring system
 * for use throughout the Chatmarks extension.
 */

// Core anchoring system coordinator
export { AnchorSystem } from './AnchorSystem';

// Individual strategy implementations
export { XPathAnchor } from './XPathAnchor';
export { OffsetAnchor } from './OffsetAnchor';
export { FuzzyMatcher } from './FuzzyMatcher';

// Re-export types for convenience
export type { TextAnchor, AnchorStrategy } from '../../types/bookmark';
