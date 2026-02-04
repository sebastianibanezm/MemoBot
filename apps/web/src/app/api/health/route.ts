import { NextResponse } from "next/server";

/**
 * Public health check for phase verification.
 * GET /api/health → 200 OK when app is running.
 */
export async function GET() {
  return NextResponse.json(
    { status: "ok", phase: 9 },
    { status: 200 }
  );
}
