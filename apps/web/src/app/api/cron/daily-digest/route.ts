import { NextRequest, NextResponse } from "next/server";
import { processDailyDigests } from "@/lib/services/daily-digest";

/**
 * POST /api/cron/daily-digest — Process and send daily digest prompts.
 * Called every 5 minutes by Vercel Cron to catch users across all timezones.
 * Protected by CRON_SECRET header.
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const providedSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (!cronSecret || providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[CRON] Starting daily digest processing...");
    const result = await processDailyDigests();
    console.log(
      `[CRON] Daily digest complete: ${result.processed} processed, ${result.sent} sent, ${result.failed} failed`
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (e) {
    console.error("[CRON] Daily digest error:", e);
    return NextResponse.json(
      { error: "Failed to process daily digests", message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/cron/daily-digest",
    description: "Daily digest prompt cron endpoint (run every 5 minutes)",
  });
}
