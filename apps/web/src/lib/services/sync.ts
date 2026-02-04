/**
 * Sync service: export memories to local / GDrive / Dropbox (Phase 7).
 */

import { createServerSupabase } from "../supabase/server";
import { generateMemoryMarkdown } from "../sync/markdown";
import { writeMemoryToLocal } from "../sync/local-writer";
import type { MemoryRow } from "./memory";
import type { TagRow } from "./tagger";

export interface UserSyncSettings {
  local_backup_enabled: boolean;
  local_backup_path: string | null;
  google_drive_enabled: boolean;
  google_drive_folder_id: string | null;
  google_refresh_token: string | null;
  dropbox_enabled: boolean;
  dropbox_refresh_token: string | null;
}

export async function getUserSyncSettings(userId: string): Promise<UserSyncSettings | null> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("user_settings")
    .select(
      "local_backup_enabled, local_backup_path, google_drive_enabled, google_drive_folder_id, google_refresh_token, dropbox_enabled, dropbox_refresh_token"
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    local_backup_enabled: data.local_backup_enabled ?? true,
    local_backup_path: data.local_backup_path ?? null,
    google_drive_enabled: data.google_drive_enabled ?? false,
    google_drive_folder_id: data.google_drive_folder_id ?? null,
    google_refresh_token: data.google_refresh_token ?? null,
    dropbox_enabled: data.dropbox_enabled ?? false,
    dropbox_refresh_token: data.dropbox_refresh_token ?? null,
  };
}

/** Ensure user has a user_settings row (for defaults). */
async function ensureUserSettings(userId: string): Promise<UserSyncSettings> {
  const supabase = createServerSupabase();
  const existing = await getUserSyncSettings(userId);
  if (existing) return existing;
  const { error } = await supabase.from("user_settings").insert({
    user_id: userId,
    local_backup_enabled: true,
  });
  if (error) {
    return {
      local_backup_enabled: true,
      local_backup_path: null,
      google_drive_enabled: false,
      google_drive_folder_id: null,
      google_refresh_token: null,
      dropbox_enabled: false,
      dropbox_refresh_token: null,
    };
  }
  const settings = await getUserSyncSettings(userId);
  return settings ?? { local_backup_enabled: true, local_backup_path: null, google_drive_enabled: false, google_drive_folder_id: null, google_refresh_token: null, dropbox_enabled: false, dropbox_refresh_token: null };
}

export async function syncMemoryToStorage(
  userId: string,
  memory: MemoryRow,
  category: { id: string; name: string },
  tags: TagRow[]
): Promise<void> {
  const settings = await ensureUserSettings(userId);
  const supabase = createServerSupabase();
  const tagNames = tags.map((t) => t.name);
  const markdown = generateMemoryMarkdown(memory, category.name, tagNames);

  let localFilePath: string | null = null;

  if (settings.local_backup_enabled && settings.local_backup_path?.trim()) {
    try {
      localFilePath = await writeMemoryToLocal(
        settings.local_backup_path.trim(),
        category.name,
        memory.id,
        memory.title,
        markdown
      );
    } catch (_) {
      // Leave sync_status pending on write failure
      return;
    }
  }

  // Optional: Google Drive upload (Phase 7 placeholder – upload when token present)
  if (settings.google_drive_enabled && settings.google_refresh_token) {
    try {
      await syncMemoryToGoogleDrive(userId, memory, category.name, tagNames, markdown, settings);
    } catch (_) {
      // Non-fatal; local may have succeeded
    }
  }

  // Optional: Dropbox upload (Phase 7 placeholder)
  if (settings.dropbox_enabled && settings.dropbox_refresh_token) {
    try {
      await syncMemoryToDropbox(userId, memory, category.name, tagNames, markdown, settings);
    } catch (_) {
      // Non-fatal
    }
  }

  // Update memory sync status and local path when local backup succeeded
  if (localFilePath !== null) {
    await supabase
      .from("memories")
      .update({
        sync_status: "synced",
        local_file_path: localFilePath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", memory.id)
      .eq("user_id", userId);
  }
}

async function syncMemoryToGoogleDrive(
  _userId: string,
  _memory: MemoryRow,
  _categoryName: string,
  _tagNames: string[],
  _markdown: string,
  _settings: UserSyncSettings
): Promise<void> {
  // Phase 7: placeholder. Full implementation would use googleapis and refresh_token to upload file.
}

async function syncMemoryToDropbox(
  _userId: string,
  _memory: MemoryRow,
  _categoryName: string,
  _tagNames: string[],
  _markdown: string,
  _settings: UserSyncSettings
): Promise<void> {
  // Phase 7: placeholder. Full implementation would use Dropbox API and refresh_token.
}
