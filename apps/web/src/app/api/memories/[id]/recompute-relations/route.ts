import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getMemoryById } from "@/lib/services/memory";
import { findRelatedMemories, createRelationships } from "@/lib/services/relationship";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/memories/[id]/recompute-relations — re-compute related memories.
 * Uses the memory's embedding to find and create relationships with similar memories.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: memoryId } = await params;
  if (!memoryId) {
    return NextResponse.json({ error: "Missing memory id" }, { status: 400 });
  }

  try {
    // Verify the memory belongs to the user
    const memory = await getMemoryById(userId, memoryId);
    if (!memory) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    }

    // Get the memory's embedding
    const supabase = createServerSupabase();
    const { data: memoryWithEmbedding, error: embError } = await supabase
      .from("memories")
      .select("embedding")
      .eq("id", memoryId)
      .single();

    if (embError || !memoryWithEmbedding?.embedding) {
      return NextResponse.json(
        { error: "Memory has no embedding" },
        { status: 400 }
      );
    }

    const embedding = memoryWithEmbedding.embedding as number[];

    // Find related memories
    const related = await findRelatedMemories(userId, memoryId, embedding);
    console.log(
      `[recompute-relations] Found ${related.length} related memories for ${memoryId}:`,
      related.map((r) => ({ id: r.id, score: r.similarity_score }))
    );

    // Create relationships
    await createRelationships(memoryId, related);

    return NextResponse.json({
      success: true,
      relatedCount: related.length,
      related: related.map((r) => ({
        id: r.id,
        similarity_score: r.similarity_score,
      })),
    });
  } catch (e) {
    console.error("[POST /api/memories/[id]/recompute-relations]", e);
    return NextResponse.json(
      { error: "Failed to recompute relations" },
      { status: 500 }
    );
  }
}
