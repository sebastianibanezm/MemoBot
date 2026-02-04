/**
 * TagService: extract tags from content, normalize, get-or-create (user-scoped).
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

function normalizeTagName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, 50) || "untagged";
}

/**
 * Get or create tags by name; returns tag rows for linking to memory.
 */
export async function getOrCreateTags(
  userId: string,
  tagNames: string[]
): Promise<TagRow[]> {
  if (!tagNames?.length) return [];
  const supabase = createServerSupabase();
  const normalized = [...new Set(tagNames.map((n) => normalizeTagName(n)).filter(Boolean))];
  const result: TagRow[] = [];

  for (const name of normalized.slice(0, 20)) {
    const norm = normalizeTagName(name);
    const displayName = name.trim().slice(0, 50) || norm;

    const { data: existing } = await supabase
      .from("tags")
      .select("id, name, normalized_name, usage_count")
      .eq("user_id", userId)
      .eq("normalized_name", norm)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("tags")
        .update({
          usage_count: (existing.usage_count ?? 0) + 1,
          name: displayName,
        })
        .eq("id", existing.id);
      result.push({
        id: existing.id,
        name: displayName,
        normalized_name: existing.normalized_name,
        usage_count: (existing.usage_count ?? 0) + 1,
      });
      continue;
    }

    const embedding = await generateEmbedding(displayName);
    const { data: created, error } = await supabase
      .from("tags")
      .insert({
        user_id: userId,
        name: displayName,
        normalized_name: norm,
        embedding,
        usage_count: 1,
      })
      .select("id, name, normalized_name, usage_count")
      .single();

    if (error) throw new Error(`Failed to create tag: ${error.message}`);
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
 */
export async function extractTagNamesFromContent(content: string, maxTags = 5): Promise<string[]> {
  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 100,
      messages: [
        {
          role: "system",
          content: `You extract meaningful topic tags from text. Return only a JSON array of ${maxTags} short, relevant tags (1-3 words each). Tags should be meaningful topics, themes, or categories - NOT random words from the text. Examples of good tags: "family", "travel", "work project", "health", "birthday", "legal documents".`,
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
 */
export async function extractAndAssignTags(
  userId: string,
  content: string
): Promise<TagRow[]> {
  const names = await extractTagNamesFromContent(content, 5);
  return getOrCreateTags(userId, names.length ? names : ["general"]);
}

/**
 * Preview which tags would be extracted (for draft display).
 */
export async function previewTags(
  content: string,
  _existingTags: { name: string }[],
  maxTags = 5
): Promise<string[]> {
  return extractTagNamesFromContent(content, maxTags);
}
