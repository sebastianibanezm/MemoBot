/**
 * CategoryService: match or create category for content (user-scoped).
 * Uses embedding similarity to match existing categories; creates new if needed.
 */

import OpenAI from "openai";
import { createServerSupabase } from "../supabase/server";
import { generateEmbedding } from "./embedding";

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  return new OpenAI({ apiKey });
}

/**
 * Use AI to suggest a category name for the given content.
 */
async function suggestCategoryName(content: string): Promise<string> {
  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 50,
      messages: [
        {
          role: "system",
          content: `You categorize content into meaningful categories. Return ONLY a single category name (1-3 words, title case). Examples: "Personal", "Work", "Family", "Health", "Travel", "Finance", "Legal Documents", "Goals", "Ideas", "Learning".`,
        },
        {
          role: "user",
          content: `What category best describes this content?\n\n${content.slice(0, 1000)}`,
        },
      ],
    });
    
    const suggested = response.choices[0]?.message?.content?.trim() ?? "";
    // Clean up the response - remove quotes, extra punctuation
    const cleaned = suggested.replace(/["']/g, "").replace(/[.!?]$/, "").trim();
    return cleaned.length > 0 && cleaned.length <= 50 ? cleaned : "Personal";
  } catch (error) {
    console.error("Failed to suggest category with AI:", error);
    return "Personal";
  }
}

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
    // No categories exist, use AI to suggest one
    const suggested = await suggestCategoryName(trimmed);
    return getOrCreateCategoryByName(userId, suggested);
  }

  const withEmbedding = categories.filter((c) => c.embedding && Array.isArray(c.embedding));
  if (withEmbedding.length === 0) {
    // Categories exist but none have embeddings, use AI to suggest
    const suggested = await suggestCategoryName(trimmed);
    return getOrCreateCategoryByName(userId, suggested);
  }

  let best: { id: string; name: string; similarity: number } | null = null;
  for (const cat of withEmbedding) {
    const sim = cosineSimilarity(queryEmbedding, cat.embedding as number[]);
    if (sim >= SIMILARITY_THRESHOLD && (!best || sim > best.similarity)) {
      best = { id: cat.id, name: cat.name, similarity: sim };
    }
  }

  if (best) return { id: best.id, name: best.name };
  
  // No good match found, use AI to suggest a category
  const suggested = await suggestCategoryName(trimmed);
  return getOrCreateCategoryByName(userId, suggested);
}

/**
 * Preview which category would be assigned (for draft display). Same logic as assignCategory.
 */
export async function previewCategory(
  content: string,
  existingCategories: { id: string; name: string; embedding?: number[] | null }[]
): Promise<string> {
  if (!content.trim()) return "Personal";
  const withEmbedding = existingCategories.filter((c) => c.embedding?.length === 512);
  if (withEmbedding.length === 0) {
    // No categories with embeddings, use AI
    return suggestCategoryName(content);
  }
  const queryEmbedding = await generateEmbedding(content);
  let best: { name: string; similarity: number } | null = null;
  for (const cat of withEmbedding) {
    const sim = cosineSimilarity(queryEmbedding, cat.embedding!);
    if (!best || sim > best.similarity) {
      best = { name: cat.name, similarity: sim };
    }
  }
  if (best && best.similarity >= SIMILARITY_THRESHOLD) {
    return best.name;
  }
  // No good match, use AI
  return suggestCategoryName(content);
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
