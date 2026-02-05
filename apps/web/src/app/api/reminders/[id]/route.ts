import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  getReminderById,
  updateReminder,
  deleteReminder,
} from "@/lib/services/reminders";
import { NotificationChannel } from "@/lib/services/notifications";

/**
 * GET /api/reminders/[id] — get a single reminder.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing reminder id" }, { status: 400 });
  }

  try {
    const reminder = await getReminderById(userId, id);
    if (!reminder) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      reminder: {
        id: reminder.id,
        memory_id: reminder.memory_id,
        title: reminder.title,
        summary: reminder.summary,
        remind_at: reminder.remind_at,
        channels: reminder.channels,
        status: reminder.status,
        sent_at: reminder.sent_at,
        created_at: reminder.created_at,
        updated_at: reminder.updated_at,
        memory: reminder.memory
          ? {
              id: reminder.memory.id,
              title: reminder.memory.title,
              content: reminder.memory.content,
              summary: reminder.memory.summary,
            }
          : null,
      },
    });
  } catch (e) {
    console.error("[GET /api/reminders/[id]]", e);
    return NextResponse.json({ error: "Failed to get reminder" }, { status: 500 });
  }
}

/**
 * PUT /api/reminders/[id] — update a reminder.
 * Body: { title?, summary?, remind_at?, channels?, status? }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing reminder id" }, { status: 400 });
  }

  try {
    // Verify the reminder exists and belongs to the user
    const existing = await getReminderById(userId, id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Don't allow editing sent or cancelled reminders
    if (existing.status === "sent" || existing.status === "cancelled") {
      return NextResponse.json(
        { error: "Cannot edit a reminder that has already been sent or cancelled" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { title, summary, remind_at, channels, status } = body;

    // Validate remind_at if provided
    let remindAtDate: Date | undefined;
    if (remind_at !== undefined) {
      remindAtDate = new Date(remind_at);
      if (isNaN(remindAtDate.getTime())) {
        return NextResponse.json({ error: "Invalid remind_at date" }, { status: 400 });
      }
    }

    // Validate channels if provided
    let reminderChannels: NotificationChannel[] | undefined;
    if (channels !== undefined) {
      const validChannels: NotificationChannel[] = ["whatsapp", "telegram", "email"];
      reminderChannels = (channels as string[]).filter((c) =>
        validChannels.includes(c as NotificationChannel)
      ) as NotificationChannel[];

      if (reminderChannels.length === 0) {
        return NextResponse.json({ error: "At least one valid channel is required" }, { status: 400 });
      }
    }

    // Validate status if provided
    if (status !== undefined) {
      const validStatuses = ["pending", "cancelled"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: "Invalid status. Can only be set to pending or cancelled" },
          { status: 400 }
        );
      }
    }

    const updated = await updateReminder(userId, id, {
      title: title !== undefined ? title : undefined,
      summary: summary !== undefined ? summary : undefined,
      remindAt: remindAtDate,
      channels: reminderChannels,
      status: status,
    });

    return NextResponse.json({ reminder: updated });
  } catch (e) {
    console.error("[PUT /api/reminders/[id]]", e);
    return NextResponse.json({ error: "Failed to update reminder" }, { status: 500 });
  }
}

/**
 * DELETE /api/reminders/[id] — delete a reminder.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing reminder id" }, { status: 400 });
  }

  try {
    // Verify the reminder exists and belongs to the user
    const existing = await getReminderById(userId, id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await deleteReminder(userId, id);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/reminders/[id]]", e);
    return NextResponse.json({ error: "Failed to delete reminder" }, { status: 500 });
  }
}
