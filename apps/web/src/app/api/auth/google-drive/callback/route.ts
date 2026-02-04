import { createServerSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * GET /api/auth/google-drive/callback
 * Exchanges code for tokens and stores refresh_token in user_settings.
 * Query: code, state (userId).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/auth/google-drive/callback`;

  if (!code || !userId) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=google_drive_callback_missing", baseUrl)
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=google_drive_not_configured", baseUrl)
    );
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error("[google-drive/callback] token exchange failed:", err);
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=google_drive_token_failed", baseUrl)
    );
  }

  const tokens = (await tokenRes.json()) as { refresh_token?: string };
  const refreshToken = tokens.refresh_token;
  if (!refreshToken) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=google_drive_no_refresh_token", baseUrl)
    );
  }

  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("user_settings")
    .upsert(
      {
        user_id: userId,
        google_drive_enabled: true,
        google_refresh_token: refreshToken,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("[google-drive/callback] upsert settings failed:", error);
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=google_drive_save_failed", baseUrl)
    );
  }

  return NextResponse.redirect(
    new URL("/dashboard/settings?google_drive=linked", baseUrl)
  );
}
