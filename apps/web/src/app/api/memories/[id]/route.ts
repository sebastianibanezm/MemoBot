import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getMemoryById } from "@/lib/services/memory";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/memories/[id] — single memory with category name and tag names.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing memory id" }, { status: 400 });
  }

  try {
    const memory = await getMemoryById(userId, id);
    if (!memory) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const supabase = createServerSupabase();
    let categoryName: string | null = null;
    if (memory.category_id) {
      const { data: cat } = await supabase
        .from("categories")
        .select("name")
        .eq("id", memory.category_id)
        .single();
      categoryName = cat?.name ?? null;
    }

    const { data: tagRows } = await supabase
      .from("memory_tags")
      .select("tag_id")
      .eq("memory_id", id);
    const tagIds = (tagRows ?? []).map((r) => r.tag_id);
    let tagNames: string[] = [];
    if (tagIds.length > 0) {
      const { data: tags } = await supabase
        .from("tags")
        .select("name")
        .in("id", tagIds);
      tagNames = (tags ?? []).map((t) => t.name);
    }

    return NextResponse.json({
      memory: {
        id: memory.id,
        title: memory.title,
        content: memory.content,
        summary: memory.summary,
        category_id: memory.category_id,
        category_name: categoryName,
        tag_names: tagNames,
        source_platform: memory.source_platform,
        created_at: memory.created_at,
        updated_at: memory.updated_at,
        occurred_at: memory.occurred_at,
      },
    });
  } catch (e) {
    console.error("[GET /api/memories/[id]]", e);
    return NextResponse.json({ error: "Failed to get memory" }, { status: 500 });
  }
}
