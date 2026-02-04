/**
 * RAG + Querying config (Phase 6): tuned defaults for hybrid search,
 * 2-degree network retrieval, and context building for Claude.
 */

/** Defaults for hybrid search (RRF full-text + semantic). */
export const RAG_HYBRID_DEFAULTS = {
  fullTextWeight: 1.2,
  semanticWeight: 1.5,
  rrfK: 50,
  matchCount: 10,
} as const;

/** Defaults for 2-degree network retrieval (direct + related memories). */
export const RAG_NETWORK_DEFAULTS = {
  initialCount: 6,
  relatedCount: 3,
  similarityThreshold: 0.35, // Lowered from 0.48 to catch more semantic matches
} as const;

/** Semantic-only search (match_memories) defaults. */
export const RAG_SEMANTIC_DEFAULTS = {
  matchCount: 10,
  matchThreshold: 0.40, // Lowered from 0.55 to be more inclusive
} as const;

/** Context building: content preview length for Claude. */
export const RAG_CONTEXT_DEFAULTS = {
  contentPreviewLength: 220,
  maxMessageHistoryForContext: 8,
} as const;
