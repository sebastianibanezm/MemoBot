/**
 * Sync queue: process memories with sync_status = 'pending' (Phase 7).
 */

import { createServerSupabase } from "../supabase/server";
import { syncMemoryToStorage } from "./sync";
import type { MemoryRow } from "./memory";
import type { TagRow } from "./tagger";

export interface ProcessSyncQueueResult {
  processed: number;
  errors: number;
}

/**
 * Fetch pending memories for a user and sync each to storage (local / GDrive / Dropbox).
 * Uses service role; pass userId for the user whose memories to process.
 */
export async function processSyncQueue(userId: string): Promise<ProcessSyncQueueResult> {
  const supabase = createServerSupabase();
  await supabase.rpc("set_current_user_id", { user_id: userId });

  const { data: memories, error: listError } = await supabase
    .from("memories")
    .select("id, user_id, title, content, summary, created_at, updated_at, occurred_at, source_platform, category_id")
    .eq("user_id", userId)
    .eq("sync_status", "pending")
    .is("deleted_at", null);

  if (listError || !memories?.length) {
    return { processed: 0, errors: 0 };
  }

  let processedCount = 0;
  let errorCount = 0;

  for (const mem of memories) {
    const memory = mem as MemoryRow;
    let category = { id: "", name: "Uncategorized" };
    if (memory.category_id) {
      const { data: cat } = await supabase
        .from("categories")
        .select("id, name")
        .eq("id", memory.category_id)
        .single();
      if (cat) category = { id: cat.id, name: cat.name };
    }

    const { data: tagRows } = await supabase
      .from("memory_tags")
      .select("tag_id")
      .eq("memory_id", memory.id);
    const tagIds = (tagRows ?? []).map((r) => r.tag_id);
    let tags: TagRow[] = [];
    if (tagIds.length) {
      const { data: tagList } = await supabase
        .from("tags")
        .select("id, name, normalized_name, usage_count")
        .in("id", tagIds);
      tags = (tagList ?? []) as TagRow[];
    }

    try {
      await syncMemoryToStorage(userId, memory, category, tags);
      processedCount++;
    } catch (_) {
      errorCount++;
    }
  }

  return { processed: processedCount, errors: errorCount };
}
