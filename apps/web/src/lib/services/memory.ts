/**
 * MemoryService: user-scoped CRUD for memories.
 */

import { createServerSupabase } from "../supabase/server";
import { generateEmbedding } from "./embedding";

export type SourcePlatform = "whatsapp" | "telegram" | "web";

export interface CreateMemoryInput {
  userId: string;
  title?: string | null;
  content: string;
  summary?: string | null;
  categoryId?: string | null;
  sourcePlatform?: SourcePlatform | null;
  occurredAt?: string | null;
}

export interface UpdateMemoryInput {
  title?: string | null;
  content?: string;
  summary?: string | null;
  categoryId?: string | null;
}

export interface MemoryRow {
  id: string;
  user_id: string;
  title: string | null;
  content: string;
  summary: string | null;
  category_id: string | null;
  source_platform: string | null;
  created_at: string;
  updated_at: string;
  occurred_at: string | null;
  deleted_at: string | null;
}

export async function createMemory(input: CreateMemoryInput): Promise<MemoryRow> {
  const supabase = createServerSupabase();
  const embedding = await generateEmbedding(input.content);
  const { data, error } = await supabase
    .from("memories")
    .insert({
      user_id: input.userId,
      title: input.title ?? null,
      content: input.content,
      summary: input.summary ?? null,
      embedding,
      category_id: input.categoryId ?? null,
      source_platform: input.sourcePlatform ?? null,
      occurred_at: input.occurredAt ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create memory: ${error.message}`);
  return data as MemoryRow;
}

export async function getMemoryById(
  userId: string,
  memoryId: string
): Promise<MemoryRow | null> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .eq("user_id", userId)
    .eq("id", memoryId)
    .is("deleted_at", null)
    .single();
  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return (data as MemoryRow) ?? null;
}

export async function updateMemory(
  userId: string,
  memoryId: string,
  input: UpdateMemoryInput
): Promise<MemoryRow> {
  const supabase = createServerSupabase();
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    ...(input.title !== undefined && { title: input.title }),
    ...(input.summary !== undefined && { summary: input.summary }),
    ...(input.categoryId !== undefined && { category_id: input.categoryId }),
  };
  if (input.content !== undefined) {
    update.content = input.content;
    update.embedding = await generateEmbedding(input.content);
  }
  const { data, error } = await supabase
    .from("memories")
    .update(update)
    .eq("user_id", userId)
    .eq("id", memoryId)
    .select()
    .single();
  if (error) throw new Error(`Failed to update memory: ${error.message}`);
  return data as MemoryRow;
}

export async function deleteMemory(
  userId: string,
  memoryId: string,
  soft = true
): Promise<void> {
  const supabase = createServerSupabase();
  if (soft) {
    const { error } = await supabase
      .from("memories")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("id", memoryId);
    if (error) throw new Error(`Failed to delete memory: ${error.message}`);
  } else {
    const { error } = await supabase
      .from("memories")
      .delete()
      .eq("user_id", userId)
      .eq("id", memoryId);
    if (error) throw new Error(`Failed to delete memory: ${error.message}`);
  }
}

export async function listRecentMemories(
  userId: string,
  limit: number,
  categoryId?: string | null
): Promise<MemoryRow[]> {
  const supabase = createServerSupabase();
  let q = supabase
    .from("memories")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(1, limit), 20));
  if (categoryId) q = q.eq("category_id", categoryId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data as MemoryRow[]) ?? [];
}
