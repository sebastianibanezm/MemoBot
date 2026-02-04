import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPE = "https://www.googleapis.com/auth/drive.file";

/**
 * GET /api/auth/google-drive
 * Redirects to Google OAuth for Drive. Requires Clerk auth.
 * Env: GOOGLE_CLIENT_ID, NEXT_PUBLIC_APP_URL.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/auth/google-drive/callback`;

  if (!clientId) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=google_drive_not_configured", baseUrl)
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state: userId,
  });
  const url = `${GOOGLE_AUTH_URL}?${params.toString()}`;
  return NextResponse.redirect(url);
}
