import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { generateLinkCode } from "@/lib/services/account-linking";
import { withRateLimit } from "@/lib/api-utils";

const PLATFORMS = ["whatsapp", "telegram"] as const;

/**
 * POST /api/link-code
 * Body: { platform: "whatsapp" | "telegram" }
 * Returns: { code: string } (6-digit code, valid 10 min)
 * Requires Clerk auth.
 */
async function handlePost(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { platform?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const platform = body.platform;
  if (
    typeof platform !== "string" ||
    !PLATFORMS.includes(platform as "whatsapp" | "telegram")
  ) {
    return NextResponse.json(
      { error: "Missing or invalid platform (expected whatsapp or telegram)" },
      { status: 400 }
    );
  }

  try {
    const code = await generateLinkCode(userId, platform as "whatsapp" | "telegram");
    return NextResponse.json({ code });
  } catch (e) {
    console.error("[link-code] generate failed:", e);
    return NextResponse.json(
      { error: "Failed to generate link code" },
      { status: 500 }
    );
  }
}

// Export with stricter rate limiting for auth-related endpoint (10 req/min)
export const POST = withRateLimit(handlePost, { type: "auth" });
