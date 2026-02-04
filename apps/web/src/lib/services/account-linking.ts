/**
 * Account linking: link codes (generate/verify) and platform links (list, resolve user).
 * PLAN.md Phase 3.
 */

import { randomInt } from "crypto";
import { createServerSupabase } from "../supabase/server";

export type Platform = "whatsapp" | "telegram";

export interface PlatformLinkRow {
  id: string;
  user_id: string;
  platform: string;
  platform_user_id: string;
  platform_username: string | null;
  linked_at: string;
}

/**
 * Generate a 6-digit link code for the given user and platform.
 * Expires any existing unused codes for this user/platform, then inserts a new code (10 min TTL).
 */
export async function generateLinkCode(
  userId: string,
  platform: Platform
): Promise<string> {
  const code = randomInt(100000, 999999).toString();
  const supabase = createServerSupabase();

  await supabase
    .from("link_codes")
    .update({ expires_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("platform", platform)
    .is("used_at", null);

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error } = await supabase.from("link_codes").insert({
    user_id: userId,
    platform,
    code,
    expires_at: expiresAt,
  });

  if (error) throw new Error(`Failed to create link code: ${error.message}`);
  return code;
}

export interface VerifyResult {
  success: boolean;
  message: string;
}

/**
 * Verify a link code from a messaging platform and create the platform_links row.
 * Used by the message router when user sends "LINK 123456".
 */
export async function verifyAndLinkAccount(
  platform: Platform,
  platformUserId: string,
  code: string
): Promise<VerifyResult> {
  const supabase = createServerSupabase();
  const now = new Date().toISOString();

  const { data: linkCode, error: codeError } = await supabase
    .from("link_codes")
    .select("*")
    .eq("platform", platform)
    .eq("code", code.trim())
    .is("used_at", null)
    .gt("expires_at", now)
    .maybeSingle();

  if (codeError || !linkCode) {
    return {
      success: false,
      message:
        "Invalid or expired code. Please generate a new one from the dashboard.",
    };
  }

  const { data: existingLink } = await supabase
    .from("platform_links")
    .select("user_id")
    .eq("platform", platform)
    .eq("platform_user_id", platformUserId)
    .maybeSingle();

  if (existingLink) {
    return {
      success: false,
      message: "This account is already linked to a MemoBot user.",
    };
  }

  const { error: insertError } = await supabase.from("platform_links").insert({
    user_id: linkCode.user_id,
    platform,
    platform_user_id: platformUserId,
  });

  if (insertError) {
    return {
      success: false,
      message: "Failed to link account. Please try again.",
    };
  }

  await supabase
    .from("link_codes")
    .update({ used_at: now })
    .eq("id", linkCode.id);

  return {
    success: true,
    message:
      "✅ Account linked successfully! You can now use MemoBot. Try asking me about anything, or say \"memory\" to create a new memory.",
  };
}

/**
 * List platform links for a user (for settings UI).
 */
export async function getLinkedAccounts(
  userId: string
): Promise<PlatformLinkRow[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("platform_links")
    .select("id, user_id, platform, platform_user_id, platform_username, linked_at")
    .eq("user_id", userId)
    .order("linked_at", { ascending: false });

  if (error) throw new Error(`Failed to list linked accounts: ${error.message}`);
  return (data ?? []) as PlatformLinkRow[];
}

/**
 * Resolve Clerk user id from platform + platform_user_id (for message router).
 */
export async function resolveUserFromPlatform(
  platform: Platform,
  platformUserId: string
): Promise<string | null> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("platform_links")
    .select("user_id")
    .eq("platform", platform)
    .eq("platform_user_id", platformUserId)
    .maybeSingle();

  return data?.user_id ?? null;
}
