/**
 * CategoryService: match or create category for content (user-scoped).
 * Uses embedding similarity to match existing categories; creates new if needed.
 */

import { createServerSupabase } from "../supabase/server";
import { generateEmbedding } from "./embedding";

export interface CategoryMatch {
  id: string;
  name: string;
  description?: string | null;
  memory_count: number;
}

const SIMILARITY_THRESHOLD = 0.75;
const DEFAULT_CATEGORY_NAME = "Uncategorized";

/**
 * Find best-matching category by embedding similarity, or create one.
 * If content is already a category name (e.g. user override), we resolve by name first.
 */
export async function assignCategory(
  userId: string,
  contentOrCategoryName: string
): Promise<{ id: string; name: string }> {
  const supabase = createServerSupabase();
  const trimmed = contentOrCategoryName.trim();
  if (!trimmed) {
    return getOrCreateCategoryByName(userId, DEFAULT_CATEGORY_NAME);
  }

  // Check if it looks like a category name (short, no long sentences)
  const looksLikeName = trimmed.length <= 80 && !trimmed.includes(". ");
  if (looksLikeName) {
    const byName = await getCategoryByName(userId, trimmed);
    if (byName) return { id: byName.id, name: byName.name };
  }

  const queryEmbedding = await generateEmbedding(trimmed);

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, description, embedding, memory_count")
    .eq("user_id", userId);

  if (!categories?.length) {
    return getOrCreateCategoryByName(userId, DEFAULT_CATEGORY_NAME);
  }

  const withEmbedding = categories.filter((c) => c.embedding && Array.isArray(c.embedding));
  if (withEmbedding.length === 0) {
    return getOrCreateCategoryByName(userId, DEFAULT_CATEGORY_NAME);
  }

  let best: { id: string; name: string; similarity: number } | null = null;
  for (const cat of withEmbedding) {
    const sim = cosineSimilarity(queryEmbedding, cat.embedding as number[]);
    if (sim >= SIMILARITY_THRESHOLD && (!best || sim > best.similarity)) {
      best = { id: cat.id, name: cat.name, similarity: sim };
    }
  }

  if (best) return { id: best.id, name: best.name };
  return getOrCreateCategoryByName(userId, DEFAULT_CATEGORY_NAME);
}

/**
 * Preview which category would be assigned (for draft display). Same logic as assignCategory.
 */
export async function previewCategory(
  content: string,
  existingCategories: { id: string; name: string; embedding?: number[] | null }[]
): Promise<string> {
  if (!content.trim()) return DEFAULT_CATEGORY_NAME;
  const withEmbedding = existingCategories.filter((c) => c.embedding?.length === 512);
  if (withEmbedding.length === 0) return DEFAULT_CATEGORY_NAME;
  const queryEmbedding = await generateEmbedding(content);
  let best: { name: string; similarity: number } | null = null;
  for (const cat of withEmbedding) {
    const sim = cosineSimilarity(queryEmbedding, cat.embedding!);
    if (!best || sim > best.similarity) {
      best = { name: cat.name, similarity: sim };
    }
  }
  return best && best.similarity >= SIMILARITY_THRESHOLD ? best.name : DEFAULT_CATEGORY_NAME;
}

async function getCategoryByName(
  userId: string,
  name: string
): Promise<{ id: string; name: string } | null> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("categories")
    .select("id, name")
    .eq("user_id", userId)
    .ilike("name", name.trim())
    .limit(1)
    .maybeSingle();
  return data ? { id: data.id, name: data.name } : null;
}

async function getOrCreateCategoryByName(
  userId: string,
  name: string
): Promise<{ id: string; name: string }> {
  const existing = await getCategoryByName(userId, name);
  if (existing) return existing;
  const supabase = createServerSupabase();
  const embedding = await generateEmbedding(name);
  const { data, error } = await supabase
    .from("categories")
    .insert({
      user_id: userId,
      name: name.trim(),
      embedding,
      memory_count: 0,
    })
    .select("id, name")
    .single();
  if (error) throw new Error(`Failed to create category: ${error.message}`);
  return { id: data.id, name: data.name };
}

/**
 * Increment memory_count for a category (no RPC in schema).
 */
export async function incrementCategoryMemoryCount(
  userId: string,
  categoryId: string
): Promise<void> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("categories")
    .select("memory_count")
    .eq("user_id", userId)
    .eq("id", categoryId)
    .single();
  const count = (data?.memory_count ?? 0) + 1;
  await supabase
    .from("categories")
    .update({ memory_count: count, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", categoryId);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
