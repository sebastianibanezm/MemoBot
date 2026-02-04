import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const DROPBOX_AUTH_URL = "https://www.dropbox.com/oauth2/authorize";

/**
 * GET /api/auth/dropbox
 * Redirects to Dropbox OAuth. Requires Clerk auth.
 * Env: DROPBOX_CLIENT_ID, NEXT_PUBLIC_APP_URL.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  }

  const clientId = process.env.DROPBOX_CLIENT_ID;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/auth/dropbox/callback`;

  if (!clientId) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=dropbox_not_configured", baseUrl)
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    token_access_type: "offline",
    state: userId,
  });
  const url = `${DROPBOX_AUTH_URL}?${params.toString()}`;
  return NextResponse.redirect(url);
}
