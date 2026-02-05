import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1, // substitution
          matrix[i]![j - 1]! + 1,     // insertion
          matrix[i - 1]![j]! + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length]![a.length]!;
}

/**
 * Calculate similarity ratio between two strings (0-1)
 */
function stringSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

/**
 * Normalize a tag name for comparison (remove plurals, common abbreviations)
 */
function normalizeForComparison(name: string): string {
  let normalized = name.toLowerCase().trim();
  
  // Remove trailing 's' for plurals (simple heuristic)
  if (normalized.endsWith('s') && normalized.length > 3) {
    normalized = normalized.slice(0, -1);
  }
  
  // Remove trailing 'es' for plurals
  if (normalized.endsWith('es') && normalized.length > 4) {
    normalized = normalized.slice(0, -2);
  }
  
  // Remove trailing 'ies' -> 'y' for plurals (e.g., memories -> memory)
  if (normalized.endsWith('ie') && normalized.length > 4) {
    normalized = normalized.slice(0, -2) + 'y';
  }
  
  // Remove hyphens and underscores for comparison
  normalized = normalized.replace(/[-_]/g, '');
  
  return normalized;
}

/**
 * Common abbreviation mappings
 */
const ABBREVIATIONS: Record<string, string[]> = {
  'meeting': ['mtg', 'meet'],
  'document': ['doc', 'docs'],
  'information': ['info'],
  'application': ['app', 'apps'],
  'development': ['dev'],
  'production': ['prod'],
  'configuration': ['config', 'cfg'],
  'message': ['msg'],
  'project': ['proj'],
  'reference': ['ref'],
  'specification': ['spec', 'specs'],
  'repository': ['repo'],
  'administration': ['admin'],
  'authentication': ['auth'],
  'organization': ['org'],
  'environment': ['env'],
  'temporary': ['temp', 'tmp'],
  'management': ['mgmt'],
  'department': ['dept'],
  'number': ['num', 'no'],
  'assistant': ['asst'],
  'account': ['acct'],
  'address': ['addr'],
  'approximate': ['approx'],
  'average': ['avg'],
  'building': ['bldg'],
  'company': ['co'],
  'corporation': ['corp'],
  'december': ['dec'],
  'january': ['jan'],
  'february': ['feb'],
};

/**
 * Check if two tags are similar enough to merge
 */
function shouldMergeTags(tag1: string, tag2: string): boolean {
  const norm1 = normalizeForComparison(tag1);
  const norm2 = normalizeForComparison(tag2);
  
  // Exact match after normalization
  if (norm1 === norm2) return true;
  
  // Check abbreviation mappings
  for (const [full, abbrevs] of Object.entries(ABBREVIATIONS)) {
    if (
      (norm1 === full && abbrevs.includes(norm2)) ||
      (norm2 === full && abbrevs.includes(norm1)) ||
      (norm1.includes(full) && abbrevs.some(a => norm2.includes(a))) ||
      (norm2.includes(full) && abbrevs.some(a => norm1.includes(a)))
    ) {
      return true;
    }
  }
  
  // String similarity check (threshold: 0.85 for short strings, 0.8 for longer)
  const threshold = Math.min(norm1.length, norm2.length) <= 5 ? 0.85 : 0.8;
  const similarity = stringSimilarity(norm1, norm2);
  
  return similarity >= threshold;
}

interface TagWithCount {
  id: string;
  name: string;
  normalized_name: string;
  usage_count: number;
}

/**
 * POST /api/tags/merge — automatically merge similar tags
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServerSupabase();
    
    // Fetch all tags for the user
    const { data: tags, error: fetchError } = await supabase
      .from("tags")
      .select("id, name, normalized_name, usage_count")
      .eq("user_id", userId)
      .order("usage_count", { ascending: false });

    if (fetchError) throw fetchError;
    if (!tags || tags.length < 2) {
      return NextResponse.json({ merged: 0, message: "Not enough tags to merge" });
    }

    // Find groups of similar tags
    const processed = new Set<string>();
    const mergeGroups: TagWithCount[][] = [];

    for (let i = 0; i < tags.length; i++) {
      const tag1 = tags[i]!;
      if (processed.has(tag1.id)) continue;

      const group: TagWithCount[] = [tag1];
      processed.add(tag1.id);

      for (let j = i + 1; j < tags.length; j++) {
        const tag2 = tags[j]!;
        if (processed.has(tag2.id)) continue;

        if (shouldMergeTags(tag1.name, tag2.name)) {
          group.push(tag2);
          processed.add(tag2.id);
        }
      }

      if (group.length > 1) {
        mergeGroups.push(group);
      }
    }

    if (mergeGroups.length === 0) {
      return NextResponse.json({ merged: 0, message: "No similar tags found" });
    }

    let totalMerged = 0;

    // Process each merge group
    for (const group of mergeGroups) {
      // Sort by usage_count descending - keep the most used tag as canonical
      group.sort((a, b) => b.usage_count - a.usage_count);
      
      const canonical = group[0]!;
      const duplicates = group.slice(1);

      for (const dup of duplicates) {
        // Update memory_tags to point to canonical tag
        // First, get all memory associations for the duplicate tag
        const { data: memoryTags } = await supabase
          .from("memory_tags")
          .select("memory_id")
          .eq("tag_id", dup.id);

        if (memoryTags && memoryTags.length > 0) {
          for (const mt of memoryTags) {
            // Check if canonical tag already has this memory
            const { data: existing } = await supabase
              .from("memory_tags")
              .select("memory_id")
              .eq("memory_id", mt.memory_id)
              .eq("tag_id", canonical.id)
              .single();

            if (!existing) {
              // Move the association to canonical tag
              await supabase
                .from("memory_tags")
                .update({ tag_id: canonical.id })
                .eq("memory_id", mt.memory_id)
                .eq("tag_id", dup.id);
            } else {
              // Delete the duplicate association
              await supabase
                .from("memory_tags")
                .delete()
                .eq("memory_id", mt.memory_id)
                .eq("tag_id", dup.id);
            }
          }
        }

        // Update canonical tag's usage count
        await supabase
          .from("tags")
          .update({ 
            usage_count: canonical.usage_count + dup.usage_count 
          })
          .eq("id", canonical.id);

        // Delete the duplicate tag
        await supabase
          .from("tags")
          .delete()
          .eq("id", dup.id);

        totalMerged++;
        
        // Update canonical's count for next iteration
        canonical.usage_count += dup.usage_count;
      }
    }

    return NextResponse.json({ 
      merged: totalMerged, 
      groups: mergeGroups.length,
      message: `Merged ${totalMerged} duplicate tags into ${mergeGroups.length} canonical tags` 
    });
  } catch (e) {
    console.error("[POST /api/tags/merge]", e);
    return NextResponse.json({ error: "Failed to merge tags" }, { status: 500 });
  }
}
