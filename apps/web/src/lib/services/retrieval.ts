/**
 * RetrievalService: hybrid search and 2-degree network expansion (Phase 6 RAG).
 * Wraps Supabase RPCs match_memories, hybrid_search_memories, get_memory_network.
 */

import { createServerSupabase } from "../supabase/server";
import { generateEmbedding } from "./embedding";
import {
  RAG_HYBRID_DEFAULTS,
  RAG_NETWORK_DEFAULTS,
  RAG_SEMANTIC_DEFAULTS,
} from "../rag-config";

export interface MemorySearchHit {
  id: string;
  title: string | null;
  content: string;
  category_id: string | null;
  similarity?: number;
  score?: number;
  degree?: number;
  relevance_score?: number;
  created_at: string;
}

/**
 * Semantic-only search (match_memories).
 */
export async function searchMemoriesSemantic(
  userId: string,
  query: string,
  limit = RAG_SEMANTIC_DEFAULTS.matchCount,
  threshold = RAG_SEMANTIC_DEFAULTS.matchThreshold
): Promise<MemorySearchHit[]> {
  const supabase = createServerSupabase();
  const embedding = await generateEmbedding(query);
  const { data, error } = await supabase.rpc("match_memories", {
    p_user_id: userId,
    query_embedding: embedding,
    match_count: limit,
    match_threshold: threshold,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as MemorySearchHit[];
}

/**
 * Hybrid search (full-text + semantic with RRF).
 */
export async function searchMemoriesHybrid(
  userId: string,
  queryText: string,
  limit = RAG_HYBRID_DEFAULTS.matchCount,
  fullTextWeight = RAG_HYBRID_DEFAULTS.fullTextWeight,
  semanticWeight = RAG_HYBRID_DEFAULTS.semanticWeight
): Promise<MemorySearchHit[]> {
  const supabase = createServerSupabase();
  const embedding = await generateEmbedding(queryText);
  const { data, error } = await supabase.rpc("hybrid_search_memories", {
    p_user_id: userId,
    query_text: queryText,
    query_embedding: embedding,
    match_count: limit,
    full_text_weight: fullTextWeight,
    semantic_weight: semanticWeight,
    rrf_k: RAG_HYBRID_DEFAULTS.rrfK,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as MemorySearchHit[];
}

/**
 * 2-degree network retrieval (direct matches + related memories).
 */
export async function getMemoryNetwork(
  userId: string,
  query: string,
  initialCount = RAG_NETWORK_DEFAULTS.initialCount,
  relatedCount = RAG_NETWORK_DEFAULTS.relatedCount,
  similarityThreshold = RAG_NETWORK_DEFAULTS.similarityThreshold
): Promise<MemorySearchHit[]> {
  const supabase = createServerSupabase();
  const embedding = await generateEmbedding(query);
  const { data, error } = await supabase.rpc("get_memory_network", {
    p_user_id: userId,
    query_embedding: embedding,
    initial_count: initialCount,
    related_count: relatedCount,
    similarity_threshold: similarityThreshold,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as MemorySearchHit[];
}
