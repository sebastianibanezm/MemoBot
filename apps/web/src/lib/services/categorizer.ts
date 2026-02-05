/**
 * CategoryService: match or create category for content (user-scoped).
 * Uses embedding similarity to match existing categories; creates new if needed.
 */

import OpenAI from "openai";
import { createServerSupabase } from "../supabase/server";
import { generateEmbedding } from "./embedding";
import { NEON_COLOR_KEYS, type NeonColorKey } from "../constants/colors";

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  return new OpenAI({ apiKey });
}

/**
 * Use AI to suggest a category name for the given content.
 * If existing categories are provided, the AI will prefer to use one of them.
 */
async function suggestCategoryName(
  content: string,
  existingCategoryNames: string[] = []
): Promise<string> {
  try {
    const openai = getOpenAIClient();
    
    // Build system prompt based on whether we have existing categories
    let systemPrompt: string;
    if (existingCategoryNames.length > 0) {
      systemPrompt = `You categorize content into meaningful categories. The user already has these categories: [${existingCategoryNames.join(", ")}].

IMPORTANT: Strongly prefer to use one of the existing categories if the content reasonably fits. Only suggest a new category name if NONE of the existing categories are even remotely appropriate.

Return ONLY a single category name (1-3 words, title case). If using an existing category, return it EXACTLY as shown above.`;
    } else {
      systemPrompt = `You categorize content into meaningful categories. Return ONLY a single category name (1-3 words, title case). Examples: "Personal", "Work", "Family", "Health", "Travel", "Finance", "Legal Documents", "Goals", "Ideas", "Learning".`;
    }
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 50,
      messages: [
        {
          role: "system",
          content: systemPrompt,
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

// Lowered from 0.75 to improve category reuse - 0.55 catches more semantic matches
const SIMILARITY_THRESHOLD = 0.55;
const DEFAULT_CATEGORY_NAME = "Uncategorized";

/**
 * Find best-matching category by embedding similarity, or create one.
 * If content is already a category name (e.g. user override), we resolve by name first.
 * 
 * Matching strategy (prioritizes reuse of existing categories):
 * 1. Exact name match (case-insensitive) if input looks like a category name
 * 2. Embedding similarity match above threshold
 * 3. AI suggestion with awareness of existing categories
 * 4. Fallback embedding check on AI suggestion to catch near-duplicates
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
    const suggested = await suggestCategoryName(trimmed, []);
    return getOrCreateCategoryByName(userId, suggested);
  }

  // Extract category names for AI awareness
  const categoryNames = categories.map((c) => c.name);

  const withEmbedding = categories.filter((c) => c.embedding && Array.isArray(c.embedding));
  if (withEmbedding.length === 0) {
    // Categories exist but none have embeddings, use AI with category awareness
    const suggested = await suggestCategoryName(trimmed, categoryNames);
    return getOrCreateCategoryByName(userId, suggested);
  }

  // Find best embedding match
  let best: { id: string; name: string; similarity: number } | null = null;
  for (const cat of withEmbedding) {
    const sim = cosineSimilarity(queryEmbedding, cat.embedding as number[]);
    if (sim >= SIMILARITY_THRESHOLD && (!best || sim > best.similarity)) {
      best = { id: cat.id, name: cat.name, similarity: sim };
    }
  }

  if (best) return { id: best.id, name: best.name };
  
  // No good embedding match found, use AI to suggest a category (with awareness of existing ones)
  const suggested = await suggestCategoryName(trimmed, categoryNames);
  
  // Check if the AI suggestion matches an existing category by name
  const exactMatch = categories.find(
    (c) => c.name.toLowerCase() === suggested.toLowerCase()
  );
  if (exactMatch) {
    return { id: exactMatch.id, name: exactMatch.name };
  }
  
  // Fallback: Check if the AI's suggested name is semantically similar to an existing category
  // This catches cases like AI suggesting "Work Projects" when "Work" exists
  const suggestionEmbedding = await generateEmbedding(suggested);
  const FALLBACK_THRESHOLD = 0.70; // Slightly higher threshold for name-to-name comparison
  
  let fallbackMatch: { id: string; name: string; similarity: number } | null = null;
  for (const cat of withEmbedding) {
    const sim = cosineSimilarity(suggestionEmbedding, cat.embedding as number[]);
    if (sim >= FALLBACK_THRESHOLD && (!fallbackMatch || sim > fallbackMatch.similarity)) {
      fallbackMatch = { id: cat.id, name: cat.name, similarity: sim };
    }
  }
  
  if (fallbackMatch) {
    return { id: fallbackMatch.id, name: fallbackMatch.name };
  }
  
  // No match at all - create new category
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
  
  const categoryNames = existingCategories.map((c) => c.name);
  const withEmbedding = existingCategories.filter((c) => c.embedding?.length === 512);
  
  if (withEmbedding.length === 0) {
    // No categories with embeddings, use AI with category awareness
    return suggestCategoryName(content, categoryNames);
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
  
  // No good match, use AI with awareness of existing categories
  const suggested = await suggestCategoryName(content, categoryNames);
  
  // Check if AI suggestion matches an existing category
  const exactMatch = existingCategories.find(
    (c) => c.name.toLowerCase() === suggested.toLowerCase()
  );
  if (exactMatch) {
    return exactMatch.name;
  }
  
  // Fallback: Check if the suggestion is semantically similar to an existing category
  if (withEmbedding.length > 0) {
    const suggestionEmbedding = await generateEmbedding(suggested);
    const FALLBACK_THRESHOLD = 0.70;
    
    let fallbackMatch: { name: string; similarity: number } | null = null;
    for (const cat of withEmbedding) {
      const sim = cosineSimilarity(suggestionEmbedding, cat.embedding!);
      if (sim >= FALLBACK_THRESHOLD && (!fallbackMatch || sim > fallbackMatch.similarity)) {
        fallbackMatch = { name: cat.name, similarity: sim };
      }
    }
    
    if (fallbackMatch) {
      return fallbackMatch.name;
    }
  }
  
  return suggested;
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

/**
 * Pick an available color for a new category.
 * First tries to find a color not currently in use.
 * If all colors are taken, picks the one with the fewest memories.
 */
async function pickAvailableColor(userId: string): Promise<NeonColorKey> {
  const supabase = createServerSupabase();
  
  // Fetch all existing categories with their colors and memory counts
  const { data: categories } = await supabase
    .from("categories")
    .select("color, memory_count")
    .eq("user_id", userId);
  
  if (!categories?.length) {
    // No categories exist, return the first color
    return NEON_COLOR_KEYS[0];
  }
  
  // Build a map of color -> total memory count
  const colorUsage = new Map<string, number>();
  for (const cat of categories) {
    if (cat.color) {
      const current = colorUsage.get(cat.color) ?? 0;
      colorUsage.set(cat.color, current + (cat.memory_count ?? 0));
    }
  }
  
  // Find colors not currently in use
  const unusedColors = NEON_COLOR_KEYS.filter((color) => !colorUsage.has(color));
  
  if (unusedColors.length > 0) {
    // Return the first unused color
    return unusedColors[0];
  }
  
  // All colors are taken, find the one with the fewest memories
  let minColor: NeonColorKey = NEON_COLOR_KEYS[0];
  let minCount = Infinity;
  
  for (const [color, count] of colorUsage) {
    if (count < minCount) {
      minCount = count;
      minColor = color as NeonColorKey;
    }
  }
  
  return minColor;
}

async function getOrCreateCategoryByName(
  userId: string,
  name: string
): Promise<{ id: string; name: string }> {
  const existing = await getCategoryByName(userId, name);
  if (existing) return existing;
  const supabase = createServerSupabase();
  const embedding = await generateEmbedding(name);
  
  // Pick an available color for the new category
  const color = await pickAvailableColor(userId);
  
  const { data, error } = await supabase
    .from("categories")
    .insert({
      user_id: userId,
      name: name.trim(),
      embedding,
      color,
      memory_count: 0,
    })
    .select("id, name")
    .single();
  if (error) throw new Error(`Failed to create category: ${error.message}`);
  return { id: data.id, name: data.name };
}

/**
 * Increment memory_count for a category and regenerate its description.
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
  
  // Regenerate category description to include the new memory
  // Run in background to not block the memory creation flow
  generateCategoryDescription(userId, categoryId).catch((err) => {
    console.error("Failed to regenerate category description:", err);
  });
}

/**
 * Decrement memory_count for a category and regenerate its description.
 */
export async function decrementCategoryMemoryCount(
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
  const count = Math.max(0, (data?.memory_count ?? 0) - 1);
  await supabase
    .from("categories")
    .update({ memory_count: count, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", categoryId);
  
  // Regenerate category description
  generateCategoryDescription(userId, categoryId).catch((err) => {
    console.error("Failed to regenerate category description:", err);
  });
}

/**
 * Update memory counts when a memory moves between categories.
 * Decrements old category count and increments new category count.
 */
export async function updateCategoryMemoryCounts(
  userId: string,
  oldCategoryId: string | null,
  newCategoryId: string | null
): Promise<void> {
  // Decrement old category count
  if (oldCategoryId) {
    await decrementCategoryMemoryCount(userId, oldCategoryId);
  }
  
  // Increment new category count
  if (newCategoryId) {
    await incrementCategoryMemoryCount(userId, newCategoryId);
  }
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

/**
 * Generate a category description by analyzing all memory summaries in the category.
 * Uses GPT-4o-mini to create a brief 1-2 sentence description.
 */
export async function generateCategoryDescription(
  userId: string,
  categoryId: string
): Promise<string> {
  const supabase = createServerSupabase();
  
  // Fetch all memories in this category with their summaries
  const { data: memories } = await supabase
    .from("memories")
    .select("summary, title")
    .eq("user_id", userId)
    .eq("category_id", categoryId)
    .is("deleted_at", null)
    .limit(50); // Limit to avoid token overflow
  
  if (!memories?.length) {
    return "";
  }
  
  // Combine summaries for analysis
  const summaryTexts = memories
    .map((m) => m.summary || m.title || "")
    .filter(Boolean)
    .slice(0, 20); // Use up to 20 summaries
  
  if (summaryTexts.length === 0) {
    return "";
  }
  
  const combinedContent = summaryTexts.join("\n- ");
  
  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 100,
      messages: [
        {
          role: "system",
          content: `You create brief category descriptions. Given a list of memory summaries from a category, write a concise 1-2 sentence description that captures what this category contains. Be descriptive but brief. Do not start with "This category..." - just describe the content directly.`,
        },
        {
          role: "user",
          content: `Create a brief description for a category containing these memories:\n- ${combinedContent}`,
        },
      ],
    });
    
    const description = response.choices[0]?.message?.content?.trim() ?? "";
    
    // Update the category with the new description
    if (description) {
      await supabase
        .from("categories")
        .update({ description, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("id", categoryId);
    }
    
    return description;
  } catch (error) {
    console.error("Failed to generate category description:", error);
    return "";
  }
}
