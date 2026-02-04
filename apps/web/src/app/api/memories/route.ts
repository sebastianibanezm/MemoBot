import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/memories — list recent memories for the current user.
 * Query: categoryId (optional), search (optional), tags (optional, comma-separated), limit (default 20), offset (default 0).
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const categoriesParam = searchParams.get("categories") || undefined;
  const categoryIds = categoriesParam ? categoriesParam.split(",").filter(Boolean) : [];
  const search = searchParams.get("search") || undefined;
  const tagsParam = searchParams.get("tags") || undefined;
  const tagIds = tagsParam ? tagsParam.split(",").filter(Boolean) : [];
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)), 50);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));

  try {
    const supabase = createServerSupabase();

    // If filtering by tags, first get memory IDs that have ALL the specified tags
    let memoryIdsWithTags: string[] | null = null;
    if (tagIds.length > 0) {
      const { data: memoryTagsData, error: tagsError } = await supabase
        .from("memory_tags")
        .select("memory_id, tag_id")
        .in("tag_id", tagIds);
      
      if (tagsError) throw tagsError;

      // Group by memory_id and filter those that have all tags
      const memoryTagCounts = new Map<string, Set<string>>();
      for (const mt of memoryTagsData ?? []) {
        if (!memoryTagCounts.has(mt.memory_id)) {
          memoryTagCounts.set(mt.memory_id, new Set());
        }
        memoryTagCounts.get(mt.memory_id)!.add(mt.tag_id);
      }
      
      // Only include memories that have ALL selected tags
      memoryIdsWithTags = [];
      for (const [memoryId, tags] of memoryTagCounts) {
        if (tagIds.every(tagId => tags.has(tagId))) {
          memoryIdsWithTags.push(memoryId);
        }
      }

      // If no memories match the tag filter, return empty result
      if (memoryIdsWithTags.length === 0) {
        return NextResponse.json({ memories: [], total: 0 });
      }
    }

    let q = supabase
      .from("memories")
      .select(
        "id, title, content, summary, category_id, source_platform, created_at, updated_at, occurred_at, category:categories(name), memory_tags(tag:tags(name))",
        { count: "exact" }
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (categoryIds.length > 0) q = q.in("category_id", categoryIds);
    if (search) {
      // Use ilike for simple text search on title and content
      q = q.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }
    if (memoryIdsWithTags) {
      q = q.in("id", memoryIdsWithTags);
    }
    
    const { data: memories, error, count } = await q;
    if (error) throw error;

    // Transform to include category_name and tags array
    const transformed = (memories ?? []).map((m) => {
      const cat = m.category as { name: string } | { name: string }[] | null;
      const categoryName = Array.isArray(cat) ? cat[0]?.name : cat?.name;
      const memoryTags = (m.memory_tags ?? []) as { tag: { name: string } | { name: string }[] }[];
      const tags = memoryTags
        .map((mt) => {
          const t = mt.tag;
          return Array.isArray(t) ? t[0]?.name : t?.name;
        })
        .filter(Boolean) as string[];
      return {
        id: m.id,
        title: m.title,
        content: m.content,
        summary: m.summary,
        category_id: m.category_id,
        category_name: categoryName ?? null,
        tags,
        source_platform: m.source_platform,
        created_at: m.created_at,
        updated_at: m.updated_at,
        occurred_at: m.occurred_at,
      };
    });

    return NextResponse.json({ memories: transformed, total: count ?? 0 });
  } catch (e) {
    console.error("[GET /api/memories]", e);
    return NextResponse.json({ error: "Failed to list memories" }, { status: 500 });
  }
}
