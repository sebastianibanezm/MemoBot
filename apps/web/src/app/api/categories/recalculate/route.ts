import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/categories/recalculate — recalculate memory counts for all categories.
 * This fixes any out-of-sync counts from previous category changes.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServerSupabase();

    // Get all categories for the user
    const { data: categories, error: catError } = await supabase
      .from("categories")
      .select("id")
      .eq("user_id", userId);

    if (catError) throw catError;

    const updates: { id: string; count: number }[] = [];

    // For each category, count actual memories
    for (const category of categories ?? []) {
      const { count, error: countError } = await supabase
        .from("memories")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("category_id", category.id)
        .is("deleted_at", null);

      if (countError) throw countError;

      // Update the category count
      const { error: updateError } = await supabase
        .from("categories")
        .update({ 
          memory_count: count ?? 0, 
          updated_at: new Date().toISOString() 
        })
        .eq("id", category.id)
        .eq("user_id", userId);

      if (updateError) throw updateError;

      updates.push({ id: category.id, count: count ?? 0 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Recalculated counts for ${updates.length} categories`,
      updates 
    });
  } catch (e) {
    console.error("[POST /api/categories/recalculate]", e);
    return NextResponse.json({ error: "Failed to recalculate counts" }, { status: 500 });
  }
}
