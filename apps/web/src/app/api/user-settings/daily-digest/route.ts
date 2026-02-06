import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/user-settings/daily-digest — Get the current user's daily digest preferences.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("user_settings")
    .select("daily_digest_enabled, daily_digest_time, daily_digest_timezone")
    .eq("user_id", userId)
    .single();
  
  return NextResponse.json({
    enabled: data?.daily_digest_enabled ?? false,
    time: data?.daily_digest_time ?? "20:00",
    timezone: data?.daily_digest_timezone ?? "UTC",
  });
}

/**
 * PUT /api/user-settings/daily-digest — Update the current user's daily digest preferences.
 */
export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const body = await request.json();
  const { enabled, time, timezone } = body;
  
  const supabase = createServerSupabase();
  
  // Check if user_settings row exists
  const { data: existing } = await supabase
    .from("user_settings")
    .select("id")
    .eq("user_id", userId)
    .single();
  
  if (existing) {
    // Update existing row
    const { error } = await supabase
      .from("user_settings")
      .update({
        daily_digest_enabled: enabled ?? false,
        daily_digest_time: time ?? "20:00",
        daily_digest_timezone: timezone ?? "UTC",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    
    if (error) {
      console.error("[daily-digest] Failed to update settings:", error.message);
      return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }
  } else {
    // Insert new row
    const { error } = await supabase
      .from("user_settings")
      .insert({
        user_id: userId,
        daily_digest_enabled: enabled ?? false,
        daily_digest_time: time ?? "20:00",
        daily_digest_timezone: timezone ?? "UTC",
      });
    
    if (error) {
      console.error("[daily-digest] Failed to create settings:", error.message);
      return NextResponse.json({ error: "Failed to create settings" }, { status: 500 });
    }
  }
  
  return NextResponse.json({ success: true });
}
