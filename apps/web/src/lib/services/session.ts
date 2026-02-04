/**
 * Session service: get or create conversation session for a user/platform.
 */

import { createServerSupabase } from "../supabase/server";

export type Platform = "whatsapp" | "telegram" | "web";

export interface SessionRow {
  id: string;
  user_id: string;
  platform: string;
  platform_user_id: string;
  current_state: string;
  memory_draft: Record<string, unknown>;
  message_history: unknown[];
  enrichment_count: number;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

/**
 * Get or create a conversation session for the given user and platform.
 * Used by message router before calling the agent.
 */
export async function getOrCreateSession(
  userId: string,
  platform: Platform,
  platformUserId: string
): Promise<{ sessionId: string; session: SessionRow }> {
  const supabase = createServerSupabase();
  const { data: existing } = await supabase
    .from("conversation_sessions")
    .select("*")
    .eq("platform", platform)
    .eq("platform_user_id", platformUserId)
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString())
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { sessionId: existing.id, session: existing as SessionRow };
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: created, error } = await supabase
    .from("conversation_sessions")
    .insert({
      user_id: userId,
      platform,
      platform_user_id: platformUserId,
      current_state: "CONVERSATION",
      memory_draft: {},
      message_history: [],
      enrichment_count: 0,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create session: ${error.message}`);
  return { sessionId: created.id, session: created as SessionRow };
}

export type MessageHistoryEntry = { role: "user" | "assistant"; content: string };

/**
 * Append messages to session history and bump updated_at.
 * Used by message router after agent response.
 */
export async function updateSessionHistory(
  sessionId: string,
  newMessages: MessageHistoryEntry[]
): Promise<void> {
  const supabase = createServerSupabase();
  const { data: session } = await supabase
    .from("conversation_sessions")
    .select("message_history")
    .eq("id", sessionId)
    .single();

  const existing = (session?.message_history ?? []) as MessageHistoryEntry[];
  const combined = [...existing, ...newMessages].slice(-20);

  const { error } = await supabase
    .from("conversation_sessions")
    .update({
      message_history: combined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw new Error(`Failed to update session history: ${error.message}`);
}
