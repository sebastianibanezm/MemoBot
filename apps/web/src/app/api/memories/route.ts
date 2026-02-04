import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/memories — list recent memories for the current user.
 * Query: categoryId (optional), limit (default 20), offset (default 0).
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId") || undefined;
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)), 50);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));

  try {
    const supabase = createServerSupabase();
    let q = supabase
      .from("memories")
      .select("id, title, content, summary, category_id, source_platform, created_at, updated_at, occurred_at", { count: "exact" })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (categoryId) q = q.eq("category_id", categoryId);
    const { data: memories, error, count } = await q;
    if (error) throw error;
    return NextResponse.json({ memories: memories ?? [], total: count ?? 0 });
  } catch (e) {
    console.error("[GET /api/memories]", e);
    return NextResponse.json({ error: "Failed to list memories" }, { status: 500 });
  }
}
