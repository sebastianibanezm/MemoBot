import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { processSyncQueue } from "@/lib/services/sync-queue";
import { withRateLimit } from "@/lib/api-utils";

/**
 * POST /api/sync/process
 * Process pending memories for the current user (sync to local / GDrive / Dropbox).
 * Requires Clerk auth. Returns { processed, errors }.
 */
async function handlePost(_request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processSyncQueue(userId);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[sync/process] failed:", e);
    return NextResponse.json(
      { error: "Failed to process sync queue" },
      { status: 500 }
    );
  }
}

// Export with rate limiting (30 req/min for memory operations)
export const POST = withRateLimit(handlePost, { type: "memory" });
