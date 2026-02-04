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

export interface RelatedMemoryDisplay {
  id: string;
  title: string | null;
  summary: string | null;
  content: string;
  category_name: string | null;
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

/**
 * Get related memories for display in the memory detail view.
 * Queries memory_relationships bidirectionally and joins with memories table.
 */
export async function getRelatedMemoriesForDisplay(
  userId: string,
  memoryId: string
): Promise<RelatedMemoryDisplay[]> {
  const supabase = createServerSupabase();

  // Query relationships where this memory is either memory_a or memory_b
  const { data: relationships, error: relError } = await supabase
    .from("memory_relationships")
    .select("memory_a_id, memory_b_id, similarity_score")
    .or(`memory_a_id.eq.${memoryId},memory_b_id.eq.${memoryId}`);

  if (relError) throw new Error(`getRelatedMemoriesForDisplay: ${relError.message}`);
  if (!relationships || relationships.length === 0) return [];

  // Extract the related memory IDs (the one that isn't the current memory)
  const relatedIds = relationships.map((r) =>
    r.memory_a_id === memoryId ? r.memory_b_id : r.memory_a_id
  );
  const similarityMap = new Map<string, number>();
  relationships.forEach((r) => {
    const relatedId = r.memory_a_id === memoryId ? r.memory_b_id : r.memory_a_id;
    similarityMap.set(relatedId, r.similarity_score);
  });

  // Fetch the related memories with their category info
  const { data: memories, error: memError } = await supabase
    .from("memories")
    .select("id, title, summary, content, category_id, categories(name)")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("id", relatedIds);

  if (memError) throw new Error(`getRelatedMemoriesForDisplay: ${memError.message}`);
  if (!memories) return [];

  // Transform and sort by similarity score (highest first)
  const result: RelatedMemoryDisplay[] = memories.map((m) => {
    const cat = m.categories as { name: string } | { name: string }[] | null;
    const categoryName = Array.isArray(cat) ? cat[0]?.name : cat?.name;
    return {
      id: m.id,
      title: m.title,
      summary: m.summary,
      content: m.content,
      category_name: categoryName ?? null,
      similarity_score: similarityMap.get(m.id) ?? 0,
    };
  });

  result.sort((a, b) => b.similarity_score - a.similarity_score);
  return result;
}
