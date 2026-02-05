/**
 * RelationshipService: detect related memories and create bidirectional links.
 */

import { createServerSupabase } from "../supabase/server";

const RELATED_COUNT = 5;
const SIMILARITY_THRESHOLD = 0.5; // Lowered from 0.6 to catch more related memories

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
  has_reminders?: boolean;
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

  // Insert relationships one by one to handle the function-based unique index
  // The unique_memory_pair index uses LEAST/GREATEST which doesn't work well with upsert
  for (const row of rows) {
    try {
      // Check if relationship already exists (use maybeSingle to avoid error when not found)
      const { data: existing, error: selectError } = await supabase
        .from("memory_relationships")
        .select("id, similarity_score")
        .or(
          `and(memory_a_id.eq.${row.memory_a_id},memory_b_id.eq.${row.memory_b_id}),and(memory_a_id.eq.${row.memory_b_id},memory_b_id.eq.${row.memory_a_id})`
        )
        .limit(1)
        .maybeSingle();

      if (selectError) {
        console.error(
          `[createRelationships] Failed to check existing relationship:`,
          selectError.message
        );
        continue;
      }

      if (existing) {
        // Update similarity score if relationship exists
        const { error: updateError } = await supabase
          .from("memory_relationships")
          .update({ similarity_score: row.similarity_score })
          .eq("id", existing.id);
        if (updateError) {
          console.error(
            `[createRelationships] Failed to update relationship ${existing.id}:`,
            updateError.message
          );
        } else {
          console.log(
            `[createRelationships] Updated relationship ${existing.id} with score ${row.similarity_score}`
          );
        }
      } else {
        // Insert new relationship
        const { error: insertError } = await supabase
          .from("memory_relationships")
          .insert(row);
        if (insertError) {
          console.error(
            `[createRelationships] Failed to insert relationship between ${row.memory_a_id} and ${row.memory_b_id}:`,
            insertError.message
          );
        } else {
          console.log(
            `[createRelationships] Created relationship between ${row.memory_a_id} and ${row.memory_b_id} with score ${row.similarity_score}`
          );
        }
      }
    } catch (err) {
      console.error(
        `[createRelationships] Unexpected error:`,
        err instanceof Error ? err.message : err
      );
    }
  }
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
  // Use a Set to deduplicate in case there are duplicate relationships
  const similarityMap = new Map<string, number>();
  relationships.forEach((r) => {
    const relatedId = r.memory_a_id === memoryId ? r.memory_b_id : r.memory_a_id;
    // Keep the highest similarity score if there are duplicates
    const existingScore = similarityMap.get(relatedId);
    if (!existingScore || r.similarity_score > existingScore) {
      similarityMap.set(relatedId, r.similarity_score);
    }
  });
  const relatedIds = Array.from(similarityMap.keys());

  // Fetch the related memories with their category info and reminders
  const { data: memories, error: memError } = await supabase
    .from("memories")
    .select("id, title, summary, content, category_id, categories(name), reminders(id, status)")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("id", relatedIds);

  if (memError) throw new Error(`getRelatedMemoriesForDisplay: ${memError.message}`);
  if (!memories) return [];

  // Transform and sort by similarity score (highest first)
  const result: RelatedMemoryDisplay[] = memories.map((m) => {
    const cat = m.categories as { name: string } | { name: string }[] | null;
    const categoryName = Array.isArray(cat) ? cat[0]?.name : cat?.name;
    const reminders = (m.reminders ?? []) as { id: string; status: string }[];
    const hasActiveReminders = reminders.some((r) => r.status === "pending");
    return {
      id: m.id,
      title: m.title,
      summary: m.summary,
      content: m.content,
      category_name: categoryName ?? null,
      similarity_score: similarityMap.get(m.id) ?? 0,
      has_reminders: hasActiveReminders,
    };
  });

  result.sort((a, b) => b.similarity_score - a.similarity_score);
  return result;
}
