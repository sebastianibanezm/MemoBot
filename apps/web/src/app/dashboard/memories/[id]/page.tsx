import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { getMemoryById } from "@/lib/services/memory";
import { getRelatedMemoriesForDisplay } from "@/lib/services/relationship";
import { createServerSupabase } from "@/lib/supabase/server";
import MemoryDetail from "@/components/MemoryDetail";

export const dynamic = "force-dynamic";

export default async function MemoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const { id } = await params;

  const memory = await getMemoryById(userId, id);
  if (!memory) notFound();

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

  // Fetch related memories (non-critical, so we catch errors gracefully)
  let relatedMemories: Awaited<ReturnType<typeof getRelatedMemoriesForDisplay>> = [];
  try {
    relatedMemories = await getRelatedMemoriesForDisplay(userId, id);
  } catch (error) {
    console.error("[MemoryDetailPage] Failed to fetch related memories:", error);
    // Continue with empty related memories rather than failing the page
  }

  return (
    <MemoryDetail
      memory={{
        id: memory.id,
        title: memory.title,
        content: memory.content,
        summary: memory.summary,
        category_id: memory.category_id,
        category_name: categoryName,
        tag_ids: tagIds,
        tag_names: tagNames,
        source_platform: memory.source_platform,
        created_at: memory.created_at,
        occurred_at: memory.occurred_at,
      }}
      relatedMemories={relatedMemories}
    />
  );
}
