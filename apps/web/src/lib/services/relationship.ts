/**
 * RelationshipService: detect related memories and create bidirectional links.
 */

import { createServerSupabase } from "../supabase/server";

const RELATED_COUNT = 5;
const SIMILARITY_THRESHOLD = 0.6;

export interface RelatedMemory {
  id: string;
  similarity_score: number;
}

/**
 * Find memories similar to the given embedding (excluding the current memory).
 * Uses match_memories RPC.
 */
export async function findRelatedMemories(
  userId: string,
  excludeMemoryId: string,
  embedding: number[]
): Promise<RelatedMemory[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase.rpc("match_memories", {
    p_user_id: userId,
    query_embedding: embedding,
    match_count: RELATED_COUNT + 5, // fetch extra to filter out self
    match_threshold: SIMILARITY_THRESHOLD,
  });
  if (error) throw new Error(`findRelatedMemories: ${error.message}`);
  const list = (data ?? []) as { id: string; similarity: number }[];
  const filtered = list
    .filter((r) => r.id !== excludeMemoryId)
    .slice(0, RELATED_COUNT)
    .map((r) => ({ id: r.id, similarity_score: r.similarity }));
  return filtered;
}

/**
 * Create bidirectional relationships between a memory and related memories.
 * Uses unique pair (LEAST, GREATEST) so we only insert one row per pair.
 */
export async function createRelationships(
  memoryId: string,
  related: RelatedMemory[]
): Promise<void> {
  if (related.length === 0) return;
  const supabase = createServerSupabase();
  const rows = related.map((r) => ({
    memory_a_id: memoryId < r.id ? memoryId : r.id,
    memory_b_id: memoryId < r.id ? r.id : memoryId,
    relationship_type: "related",
    similarity_score: r.similarity_score,
  }));
  await supabase.from("memory_relationships").upsert(rows, {
    onConflict: "unique_memory_pair",
    ignoreDuplicates: false,
  });
}
