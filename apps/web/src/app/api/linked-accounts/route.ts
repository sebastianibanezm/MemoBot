import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getLinkedAccounts } from "@/lib/services/account-linking";

/**
 * GET /api/linked-accounts
 * Returns: { links: PlatformLink[] }
 * Requires Clerk auth.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const links = await getLinkedAccounts(userId);
    return NextResponse.json({
      links: links.map((l) => ({
        id: l.id,
        platform: l.platform,
        platform_user_id: l.platform_user_id,
        platform_username: l.platform_username,
        linked_at: l.linked_at,
      })),
    });
  } catch (e) {
    console.error("[linked-accounts] list failed:", e);
    return NextResponse.json(
      { error: "Failed to list linked accounts" },
      { status: 500 }
    );
  }
}
