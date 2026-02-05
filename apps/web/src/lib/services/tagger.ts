/**
 * TagService: extract tags from content, normalize, get-or-create (user-scoped).
 * Uses embedding similarity to match existing tags when exact name match fails.
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

export interface TagRow {
  id: string;
  name: string;
  normalized_name: string;
  usage_count: number;
}

// Lowered from 0.80 to improve tag reuse - 0.60 catches more semantic matches
// Kept slightly higher than categories (0.55) since tags are more specific
const SIMILARITY_THRESHOLD = 0.60;

function normalizeTagName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, 50) || "untagged";
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
 * Get or create tags by name; returns tag rows for linking to memory.
 * Uses embedding similarity to match existing tags when exact name match fails.
 */
export async function getOrCreateTags(
  userId: string,
  tagNames: string[]
): Promise<TagRow[]> {
  if (!tagNames?.length) return [];
  const supabase = createServerSupabase();
  const normalized = [...new Set(tagNames.map((n) => normalizeTagName(n)).filter(Boolean))];
  const result: TagRow[] = [];

  // Fetch all existing tags with embeddings upfront for similarity matching
  const { data: allTags } = await supabase
    .from("tags")
    .select("id, name, normalized_name, usage_count, embedding")
    .eq("user_id", userId);

  const existingTags = allTags ?? [];
  const tagsWithEmbeddings = existingTags.filter(
    (t) => t.embedding && Array.isArray(t.embedding)
  );

  for (const name of normalized.slice(0, 20)) {
    const norm = normalizeTagName(name);
    const displayName = name.trim().slice(0, 50) || norm;

    // Step 1: Try exact normalized name match first (fast path)
    const exactMatch = existingTags.find((t) => t.normalized_name === norm);

    if (exactMatch) {
      await supabase
        .from("tags")
        .update({
          usage_count: (exactMatch.usage_count ?? 0) + 1,
          name: displayName,
        })
        .eq("id", exactMatch.id);
      result.push({
        id: exactMatch.id,
        name: displayName,
        normalized_name: exactMatch.normalized_name,
        usage_count: (exactMatch.usage_count ?? 0) + 1,
      });
      continue;
    }

    // Step 2: No exact match - try embedding similarity matching
    const tagEmbedding = await generateEmbedding(displayName);

    let bestMatch: {
      id: string;
      name: string;
      normalized_name: string;
      usage_count: number;
      similarity: number;
    } | null = null;

    for (const tag of tagsWithEmbeddings) {
      const sim = cosineSimilarity(tagEmbedding, tag.embedding as number[]);
      if (sim >= SIMILARITY_THRESHOLD && (!bestMatch || sim > bestMatch.similarity)) {
        bestMatch = {
          id: tag.id,
          name: tag.name,
          normalized_name: tag.normalized_name,
          usage_count: tag.usage_count ?? 0,
          similarity: sim,
        };
      }
    }

    if (bestMatch) {
      // Found a similar tag via embedding - use it instead of creating a new one
      await supabase
        .from("tags")
        .update({
          usage_count: bestMatch.usage_count + 1,
        })
        .eq("id", bestMatch.id);
      result.push({
        id: bestMatch.id,
        name: bestMatch.name, // Keep the original tag name
        normalized_name: bestMatch.normalized_name,
        usage_count: bestMatch.usage_count + 1,
      });
      continue;
    }

    // Step 3: No match found - create new tag
    const { data: created, error } = await supabase
      .from("tags")
      .insert({
        user_id: userId,
        name: displayName,
        normalized_name: norm,
        embedding: tagEmbedding,
        usage_count: 1,
      })
      .select("id, name, normalized_name, usage_count")
      .single();

    if (error) throw new Error(`Failed to create tag: ${error.message}`);
    
    // Add the newly created tag to our local cache for subsequent iterations
    existingTags.push({
      id: created.id,
      name: created.name,
      normalized_name: created.normalized_name,
      usage_count: created.usage_count ?? 1,
      embedding: tagEmbedding,
    });
    tagsWithEmbeddings.push({
      id: created.id,
      name: created.name,
      normalized_name: created.normalized_name,
      usage_count: created.usage_count ?? 1,
      embedding: tagEmbedding,
    });

    result.push({
      id: created.id,
      name: created.name,
      normalized_name: created.normalized_name,
      usage_count: created.usage_count ?? 1,
    });
  }

  return result;
}

/**
 * Extract meaningful tag names from content using AI.
 * If existing tags are provided, the AI will prefer to use them.
 */
export async function extractTagNamesFromContent(
  content: string,
  maxTags = 5,
  existingTagNames: string[] = []
): Promise<string[]> {
  try {
    const openai = getOpenAIClient();
    
    // Build system prompt based on whether we have existing tags
    let systemPrompt: string;
    if (existingTagNames.length > 0) {
      systemPrompt = `You extract meaningful topic tags from text. The user already has these tags: [${existingTagNames.slice(0, 50).join(", ")}].

IMPORTANT: Strongly prefer to use existing tags from the list above if they are relevant to the content. Only suggest new tags if NONE of the existing tags apply.

Return only a JSON array of up to ${maxTags} short, relevant tags (1-3 words each). If using existing tags, return them EXACTLY as shown above. Tags should be meaningful topics, themes, or categories.`;
    } else {
      systemPrompt = `You extract meaningful topic tags from text. Return only a JSON array of ${maxTags} short, relevant tags (1-3 words each). Tags should be meaningful topics, themes, or categories - NOT random words from the text. Examples of good tags: "family", "travel", "work project", "health", "birthday", "legal documents".`;
    }
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 100,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `Extract ${maxTags} meaningful tags from this content:\n\n${content.slice(0, 1500)}`,
        },
      ],
    });
    
    const text = response.choices[0]?.message?.content?.trim() ?? "[]";
    // Extract JSON array from response (use [\s\S]* instead of .* with s flag)
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0)
          .slice(0, maxTags);
      }
    }
    return ["general"];
  } catch (error) {
    console.error("Failed to extract tags with AI:", error);
    return ["general"];
  }
}

/**
 * Extract tags from content and get-or-create tag rows for the user.
 * Fetches existing tags first so AI can prefer reusing them.
 */
export async function extractAndAssignTags(
  userId: string,
  content: string
): Promise<TagRow[]> {
  const supabase = createServerSupabase();
  
  // Fetch existing tag names for AI awareness
  const { data: existingTags } = await supabase
    .from("tags")
    .select("name")
    .eq("user_id", userId);
  
  const existingTagNames = existingTags?.map((t) => t.name) ?? [];
  
  const names = await extractTagNamesFromContent(content, 5, existingTagNames);
  return getOrCreateTags(userId, names.length ? names : ["general"]);
}

/**
 * Preview which tags would be assigned (for draft display).
 * Uses embedding similarity to show accurate preview of matched existing tags.
 */
export async function previewTags(
  content: string,
  existingTags: { name: string; embedding?: number[] | null }[],
  maxTags = 5
): Promise<string[]> {
  // Pass existing tag names to AI for better reuse
  const existingTagNames = existingTags.map((t) => t.name);
  const extractedNames = await extractTagNamesFromContent(content, maxTags, existingTagNames);
  if (!extractedNames.length) return ["general"];

  const tagsWithEmbeddings = existingTags.filter(
    (t) => t.embedding && Array.isArray(t.embedding) && t.embedding.length === 512
  );

  // If no existing tags with embeddings, just return extracted names
  if (tagsWithEmbeddings.length === 0) {
    return extractedNames;
  }

  const result: string[] = [];

  for (const name of extractedNames) {
    const norm = normalizeTagName(name);

    // Check for exact match first
    const exactMatch = existingTags.find(
      (t) => normalizeTagName(t.name) === norm
    );
    if (exactMatch) {
      result.push(exactMatch.name);
      continue;
    }

    // Check for embedding similarity match
    const tagEmbedding = await generateEmbedding(name);
    let bestMatch: { name: string; similarity: number } | null = null;

    for (const tag of tagsWithEmbeddings) {
      const sim = cosineSimilarity(tagEmbedding, tag.embedding!);
      if (sim >= SIMILARITY_THRESHOLD && (!bestMatch || sim > bestMatch.similarity)) {
        bestMatch = { name: tag.name, similarity: sim };
      }
    }

    if (bestMatch) {
      result.push(bestMatch.name);
    } else {
      result.push(name); // New tag would be created
    }
  }

  return result;
}
