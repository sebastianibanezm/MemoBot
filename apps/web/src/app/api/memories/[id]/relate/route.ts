import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getMemoryById } from "@/lib/services/memory";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * DELETE /api/memories/[id]/relate — unlink two memories.
 * Query: targetMemoryId (required)
 */
export async function DELETE(
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
    const { searchParams } = new URL(request.url);
    const targetMemoryId = searchParams.get("targetMemoryId");

    if (!targetMemoryId) {
      return NextResponse.json({ error: "Missing targetMemoryId" }, { status: 400 });
    }

    // Verify the source memory belongs to the user
    const sourceMemory = await getMemoryById(userId, memoryId);
    if (!sourceMemory) {
      return NextResponse.json({ error: "Source memory not found" }, { status: 404 });
    }

    const supabase = createServerSupabase();

    // Use LEAST/GREATEST ordering to find the relationship
    const memoryAId = memoryId < targetMemoryId ? memoryId : targetMemoryId;
    const memoryBId = memoryId < targetMemoryId ? targetMemoryId : memoryId;

    // Delete the relationship
    const { error } = await supabase
      .from("memory_relationships")
      .delete()
      .eq("memory_a_id", memoryAId)
      .eq("memory_b_id", memoryBId);

    if (error) {
      throw new Error(`Failed to delete relationship: ${error.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/memories/[id]/relate]", e);
    return NextResponse.json({ error: "Failed to unlink memories" }, { status: 500 });
  }
}

/**
 * POST /api/memories/[id]/relate — manually link two memories.
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
    const body = await request.json();
    const { targetMemoryId } = body;

    if (!targetMemoryId) {
      return NextResponse.json({ error: "Missing targetMemoryId" }, { status: 400 });
    }

    if (memoryId === targetMemoryId) {
      return NextResponse.json({ error: "Cannot link a memory to itself" }, { status: 400 });
    }

    // Verify both memories belong to the user
    const sourceMemory = await getMemoryById(userId, memoryId);
    if (!sourceMemory) {
      return NextResponse.json({ error: "Source memory not found" }, { status: 404 });
    }

    const targetMemory = await getMemoryById(userId, targetMemoryId);
    if (!targetMemory) {
      return NextResponse.json({ error: "Target memory not found" }, { status: 404 });
    }

    const supabase = createServerSupabase();

    // Create the relationship using the same bidirectional pattern
    // Use LEAST/GREATEST ordering for consistency
    const memoryAId = memoryId < targetMemoryId ? memoryId : targetMemoryId;
    const memoryBId = memoryId < targetMemoryId ? targetMemoryId : memoryId;

    // Check if relationship already exists
    const { data: existing } = await supabase
      .from("memory_relationships")
      .select("id")
      .eq("memory_a_id", memoryAId)
      .eq("memory_b_id", memoryBId)
      .single();

    if (existing) {
      // Update existing relationship to manual type
      const { error } = await supabase
        .from("memory_relationships")
        .update({
          relationship_type: "manual",
          similarity_score: 1.0,
        })
        .eq("id", existing.id);

      if (error) {
        throw new Error(`Failed to update relationship: ${error.message}`);
      }
    } else {
      // Create new relationship
      const { error } = await supabase.from("memory_relationships").insert({
        memory_a_id: memoryAId,
        memory_b_id: memoryBId,
        relationship_type: "manual",
        similarity_score: 1.0,
      });

      if (error) {
        throw new Error(`Failed to create relationship: ${error.message}`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[POST /api/memories/[id]/relate]", e);
    return NextResponse.json({ error: "Failed to link memories" }, { status: 500 });
  }
}
