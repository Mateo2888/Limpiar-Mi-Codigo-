export type { CommentNode, Edit, LanguageAdapter, SourceRange } from './types.js';
export { clean } from './cleaner.js';
export type { CleanResult } from './cleaner.js';
export { isNoiseLineComment } from './rules/redundancy.js';
export { applyEdits, buildRemovalEdit } from './diffEngine.js';
