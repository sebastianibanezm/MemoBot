import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { NEON_COLORS } from "../route";

/**
 * GET /api/categories/[id] — get a single category by ID.
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
    return NextResponse.json({ error: "Missing category id" }, { status: 400 });
  }

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, description, color, memory_count")
      .eq("user_id", userId)
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    return NextResponse.json({ category: data });
  } catch (e) {
    console.error("[GET /api/categories/[id]]", e);
    return NextResponse.json({ error: "Failed to get category" }, { status: 500 });
  }
}

/**
 * PATCH /api/categories/[id] — update a category.
 * Body: { name?: string, color?: NeonColor }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing category id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { name, color } = body;

    const supabase = createServerSupabase();

    // Verify category exists and belongs to user
    const { data: existing, error: existingError } = await supabase
      .from("categories")
      .select("id")
      .eq("user_id", userId)
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (trimmedName.length === 0) {
        return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      }
      if (trimmedName.length > 50) {
        return NextResponse.json({ error: "Name must be 50 characters or less" }, { status: 400 });
      }
      
      // Check for duplicate name
      const { data: duplicate } = await supabase
        .from("categories")
        .select("id")
        .eq("user_id", userId)
        .ilike("name", trimmedName)
        .neq("id", id)
        .maybeSingle();

      if (duplicate) {
        return NextResponse.json({ error: "Category with this name already exists" }, { status: 409 });
      }
      
      updates.name = trimmedName;
    }

    if (color !== undefined) {
      if (NEON_COLORS.includes(color)) {
        updates.color = color;
      }
    }

    const { data, error } = await supabase
      .from("categories")
      .update(updates)
      .eq("user_id", userId)
      .eq("id", id)
      .select("id, name, description, color, memory_count")
      .single();

    if (error) throw error;
    return NextResponse.json({ category: data });
  } catch (e) {
    console.error("[PATCH /api/categories/[id]]", e);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

/**
 * DELETE /api/categories/[id] — delete a category.
 * Memories in this category will have their category_id set to NULL.
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
    return NextResponse.json({ error: "Missing category id" }, { status: 400 });
  }

  try {
    const supabase = createServerSupabase();

    // Verify category exists and belongs to user
    const { data: existing, error: existingError } = await supabase
      .from("categories")
      .select("id, memory_count")
      .eq("user_id", userId)
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Delete the category (memories will have category_id set to NULL via FK constraint)
    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("user_id", userId)
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true, memories_affected: existing.memory_count });
  } catch (e) {
    console.error("[DELETE /api/categories/[id]]", e);
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
