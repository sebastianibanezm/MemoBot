import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getMemoryById, updateMemory, deleteMemory } from "@/lib/services/memory";
import { createServerSupabase } from "@/lib/supabase/server";
import { updateCategoryMemoryCounts } from "@/lib/services/categorizer";

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

/**
 * PUT /api/memories/[id] — update a memory.
 * Body: { title?, content?, summary?, category_id?, tag_ids?: string[] }
 */
export async function PUT(
  request: Request,
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
    const body = await request.json();
    const { title, content, summary, category_id, tag_ids } = body;

    // Verify the memory belongs to the user
    const existing = await getMemoryById(userId, id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const supabase = createServerSupabase();
    
    // Track old category for description regeneration
    const oldCategoryId = existing.category_id;

    // Update memory fields
    const updated = await updateMemory(userId, id, {
      title: title !== undefined ? title : undefined,
      content: content !== undefined ? content : undefined,
      summary: summary !== undefined ? summary : undefined,
      categoryId: category_id !== undefined ? category_id : undefined,
    });
    
    // Update category memory counts if category changed
    if (category_id !== undefined && category_id !== oldCategoryId) {
      // This will decrement old category count, increment new category count,
      // and regenerate descriptions for both categories
      updateCategoryMemoryCounts(userId, oldCategoryId, category_id).catch((err) => {
        console.error("Failed to update category memory counts:", err);
      });
    }

    // Handle tag updates if tag_ids is provided
    if (tag_ids !== undefined && Array.isArray(tag_ids)) {
      // Get current tags for this memory
      const { data: currentTags } = await supabase
        .from("memory_tags")
        .select("tag_id")
        .eq("memory_id", id);
      
      const currentTagIds = new Set((currentTags ?? []).map((t) => t.tag_id));
      const newTagIds = new Set(tag_ids as string[]);

      // Tags to remove
      const tagsToRemove = [...currentTagIds].filter((tagId) => !newTagIds.has(tagId));
      // Tags to add
      const tagsToAdd = [...newTagIds].filter((tagId) => !currentTagIds.has(tagId));

      // Remove tags
      if (tagsToRemove.length > 0) {
        await supabase
          .from("memory_tags")
          .delete()
          .eq("memory_id", id)
          .in("tag_id", tagsToRemove);
      }

      // Add tags
      if (tagsToAdd.length > 0) {
        const insertData = tagsToAdd.map((tagId) => ({
          memory_id: id,
          tag_id: tagId,
        }));
        await supabase.from("memory_tags").insert(insertData);
      }
    }

    return NextResponse.json({ memory: updated });
  } catch (e) {
    console.error("[PUT /api/memories/[id]]", e);
    return NextResponse.json({ error: "Failed to update memory" }, { status: 500 });
  }
}

/**
 * DELETE /api/memories/[id] — soft delete a memory.
 */
export async function DELETE(
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
    // Verify the memory belongs to the user
    const existing = await getMemoryById(userId, id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await deleteMemory(userId, id, true); // soft delete
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/memories/[id]]", e);
    return NextResponse.json({ error: "Failed to delete memory" }, { status: 500 });
  }
}
