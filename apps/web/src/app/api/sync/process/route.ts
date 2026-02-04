import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { processSyncQueue } from "@/lib/services/sync-queue";

/**
 * POST /api/sync/process
 * Process pending memories for the current user (sync to local / GDrive / Dropbox).
 * Requires Clerk auth. Returns { processed, errors }.
 */
export async function POST() {
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
