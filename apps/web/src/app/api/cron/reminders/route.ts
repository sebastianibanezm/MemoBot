import { NextRequest, NextResponse } from "next/server";
import { processDueReminders } from "@/lib/services/reminders";

/**
 * POST /api/cron/reminders — Process due reminders and send notifications.
 * This endpoint is called by Vercel Cron or an external scheduler.
 * Protected by CRON_SECRET header.
 */
export async function POST(request: NextRequest) {
  // Verify the cron secret
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  // Support both "Bearer <secret>" and direct secret as Authorization header
  const providedSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (!cronSecret || providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[CRON] Starting reminder processing...");
    const result = await processDueReminders();
    console.log(
      `[CRON] Reminder processing complete: ${result.processed} processed, ${result.sent} sent, ${result.failed} failed`
    );

    return NextResponse.json({
      success: true,
      processed: result.processed,
      sent: result.sent,
      failed: result.failed,
      details: result.results,
    });
  } catch (e) {
    console.error("[CRON] Reminder processing error:", e);
    return NextResponse.json(
      { error: "Failed to process reminders", message: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/reminders — Health check for the cron endpoint.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/cron/reminders",
    description: "Reminder processing cron endpoint",
  });
}
