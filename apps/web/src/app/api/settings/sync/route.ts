import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUserSyncSettings } from "@/lib/services/sync";

/**
 * GET /api/settings/sync — return sync settings for the current user.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const settings = await getUserSyncSettings(userId);
    return NextResponse.json({
      local_backup_enabled: settings?.local_backup_enabled ?? true,
      local_backup_path: settings?.local_backup_path ?? null,
      google_drive_enabled: settings?.google_drive_enabled ?? false,
      dropbox_enabled: settings?.dropbox_enabled ?? false,
    });
  } catch (e) {
    console.error("[GET /api/settings/sync]", e);
    return NextResponse.json({ error: "Failed to get settings" }, { status: 500 });
  }
}

/**
 * PATCH /api/settings/sync — update sync settings (local_backup_enabled, local_backup_path).
 */
export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { local_backup_enabled?: boolean; local_backup_path?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const supabase = createServerSupabase();
    const { data: existing } = await supabase
      .from("user_settings")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    const payload: Record<string, unknown> = {
      user_id: userId,
      updated_at: new Date().toISOString(),
    };
    if (typeof body.local_backup_enabled === "boolean") {
      payload.local_backup_enabled = body.local_backup_enabled;
    }
    if (typeof body.local_backup_path === "string") {
      payload.local_backup_path = body.local_backup_path.trim() || null;
    }

    if (existing) {
      const { error } = await supabase
        .from("user_settings")
        .update(payload)
        .eq("user_id", userId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("user_settings").insert(payload);
      if (error) throw error;
    }

    const settings = await getUserSyncSettings(userId);
    return NextResponse.json({
      local_backup_enabled: settings?.local_backup_enabled ?? true,
      local_backup_path: settings?.local_backup_path ?? null,
      google_drive_enabled: settings?.google_drive_enabled ?? false,
      dropbox_enabled: settings?.dropbox_enabled ?? false,
    });
  } catch (e) {
    console.error("[PATCH /api/settings/sync]", e);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
