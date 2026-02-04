/**
 * TagService: extract tags from content, normalize, get-or-create (user-scoped).
 */

import { createServerSupabase } from "../supabase/server";
import { generateEmbedding } from "./embedding";

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
 * Extract tag names from content using a simple heuristic (or could use Claude).
 * For Phase 2 we use a simple keyword-style extraction; can be replaced with LLM later.
 */
export function extractTagNamesFromContent(content: string, maxTags = 5): string[] {
  const lower = content.toLowerCase();
  const words = lower.split(/\s+/).filter((w) => w.length > 2);
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const w of words) {
    const cleaned = w.replace(/[^a-z0-9]/g, "");
    if (cleaned.length >= 2 && !seen.has(cleaned)) {
      seen.add(cleaned);
      tags.push(cleaned);
      if (tags.length >= maxTags) break;
    }
  }
  return tags;
}

/**
 * Extract tags from content and get-or-create tag rows for the user.
 */
export async function extractAndAssignTags(
  userId: string,
  content: string
): Promise<TagRow[]> {
  const names = extractTagNamesFromContent(content, 5);
  return getOrCreateTags(userId, names.length ? names : ["general"]);
}

/**
 * Preview which tags would be extracted (for draft display).
 */
export function previewTags(
  content: string,
  _existingTags: { name: string }[],
  maxTags = 5
): string[] {
  return extractTagNamesFromContent(content, maxTags);
}
