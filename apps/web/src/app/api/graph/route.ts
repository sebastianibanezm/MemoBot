import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/graph — nodes (memories with id, title) and edges (memory_relationships)
 * for the current user, for force-directed graph visualization.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServerSupabase();
    const { data: memories, error: memErr } = await supabase
      .from("memories")
      .select("id, title")
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (memErr) throw memErr;
    const memoryIds = new Set((memories ?? []).map((m) => m.id));

    const { data: rels, error: relErr } = await supabase
      .from("memory_relationships")
      .select("memory_a_id, memory_b_id");

    if (relErr) throw relErr;

    const edges = (rels ?? []).filter(
      (r) => memoryIds.has(r.memory_a_id) && memoryIds.has(r.memory_b_id)
    );

    const nodes = (memories ?? []).map((m) => ({
      id: m.id,
      title: m.title || "(Untitled)",
    }));

    return NextResponse.json({
      nodes,
      links: edges.map((e) => ({ source: e.memory_a_id, target: e.memory_b_id })),
    });
  } catch (e) {
    console.error("[GET /api/graph]", e);
    return NextResponse.json({ error: "Failed to load graph" }, { status: 500 });
  }
}
