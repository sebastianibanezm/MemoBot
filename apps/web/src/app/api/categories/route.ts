import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/categories — list categories for the current user (id, name, memory_count).
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, memory_count")
      .eq("user_id", userId)
      .order("memory_count", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ categories: data ?? [] });
  } catch (e) {
    console.error("[GET /api/categories]", e);
    return NextResponse.json({ error: "Failed to list categories" }, { status: 500 });
  }
}
