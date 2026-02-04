import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/tags — list tags for the current user (id, name, usage_count).
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("tags")
      .select("id, name, usage_count")
      .eq("user_id", userId)
      .order("usage_count", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ tags: data ?? [] });
  } catch (e) {
    console.error("[GET /api/tags]", e);
    return NextResponse.json({ error: "Failed to list tags" }, { status: 500 });
  }
}
