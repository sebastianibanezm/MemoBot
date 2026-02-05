import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  createReminder,
  listReminders,
  ReminderStatus,
} from "@/lib/services/reminders";
import { getMemoryById } from "@/lib/services/memory";

/**
 * GET /api/reminders — list reminders for the current user.
 * Query: status (optional), upcoming (optional boolean), limit (default 50), offset (default 0).
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const upcomingParam = searchParams.get("upcoming");
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)), 100);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));

  try {
    let status: ReminderStatus | ReminderStatus[] | undefined;
    if (statusParam) {
      if (statusParam.includes(",")) {
        status = statusParam.split(",").filter(Boolean) as ReminderStatus[];
      } else {
        status = statusParam as ReminderStatus;
      }
    }

    const upcoming = upcomingParam === "true";

    const reminders = await listReminders(userId, {
      status,
      upcoming,
      limit,
      offset,
    });

    // Transform to include memory info
    const transformed = reminders.map((r) => ({
      id: r.id,
      memory_id: r.memory_id,
      title: r.title,
      summary: r.summary,
      remind_at: r.remind_at,
      channels: r.channels,
      status: r.status,
      sent_at: r.sent_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
      memory: r.memory
        ? {
            id: r.memory.id,
            title: r.memory.title,
            summary: r.memory.summary,
          }
        : null,
    }));

    return NextResponse.json({ reminders: transformed });
  } catch (e) {
    console.error("[GET /api/reminders]", e);
    return NextResponse.json({ error: "Failed to list reminders" }, { status: 500 });
  }
}

/**
 * POST /api/reminders — create a new reminder.
 * Body: { memory_id, title, summary?, remind_at, channels? }
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { memory_id, title, summary, remind_at } = body;

    // Validate required fields
    if (!memory_id) {
      return NextResponse.json({ error: "memory_id is required" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!remind_at) {
      return NextResponse.json({ error: "remind_at is required" }, { status: 400 });
    }

    // Verify memory exists and belongs to user
    const memory = await getMemoryById(userId, memory_id);
    if (!memory) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    }

    // Validate remind_at is a valid date in the future
    const remindAtDate = new Date(remind_at);
    if (isNaN(remindAtDate.getTime())) {
      return NextResponse.json({ error: "Invalid remind_at date" }, { status: 400 });
    }

    // Channels are auto-set based on source platform (web → email + whatsapp)
    // The channels parameter is ignored - notification channels are determined by source platform:
    // - WhatsApp created → email + whatsapp
    // - Telegram created → email + telegram
    // - Web created → email + whatsapp

    const reminder = await createReminder({
      userId,
      memoryId: memory_id,
      title,
      summary: summary ?? null,
      remindAt: remindAtDate,
      sourcePlatform: "web",
      // No channels override - let the service auto-set based on platform
    });

    return NextResponse.json({ reminder }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/reminders]", e);
    return NextResponse.json({ error: "Failed to create reminder" }, { status: 500 });
  }
}
