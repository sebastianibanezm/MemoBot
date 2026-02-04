import { createServerSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const DROPBOX_TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";

/**
 * GET /api/auth/dropbox/callback
 * Exchanges code for tokens and stores refresh_token in user_settings.
 * Query: code, state (userId).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/auth/dropbox/callback`;

  if (!code || !userId) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=dropbox_callback_missing", baseUrl)
    );
  }

  const clientId = process.env.DROPBOX_CLIENT_ID;
  const clientSecret = process.env.DROPBOX_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=dropbox_not_configured", baseUrl)
    );
  }

  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const tokenRes = await fetch(DROPBOX_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: body.toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error("[dropbox/callback] token exchange failed:", err);
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=dropbox_token_failed", baseUrl)
    );
  }

  const tokens = (await tokenRes.json()) as { refresh_token?: string };
  const refreshToken = tokens.refresh_token;
  if (!refreshToken) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=dropbox_no_refresh_token", baseUrl)
    );
  }

  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("user_settings")
    .upsert(
      {
        user_id: userId,
        dropbox_enabled: true,
        dropbox_refresh_token: refreshToken,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("[dropbox/callback] upsert settings failed:", error);
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=dropbox_save_failed", baseUrl)
    );
  }

  return NextResponse.redirect(
    new URL("/dashboard/settings?dropbox=linked", baseUrl)
  );
}
