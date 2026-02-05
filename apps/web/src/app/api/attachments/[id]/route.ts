/**
 * GET /api/attachments/[id] — Get a single attachment with download URL.
 * DELETE /api/attachments/[id] — Delete an attachment.
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  getAttachmentById,
  getAttachmentUrl,
  deleteAttachment,
} from "@/lib/services/attachment";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const attachment = await getAttachmentById(id, userId);

    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    // Generate signed URL for download
    const url = await getAttachmentUrl(attachment.storage_path);

    return NextResponse.json({
      attachment: {
        ...attachment,
        url,
      },
    });
  } catch (e) {
    console.error(`[GET /api/attachments/${id}]`, e);
    return NextResponse.json(
      { error: "Failed to fetch attachment" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await deleteAttachment(id, userId);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(`[DELETE /api/attachments/${id}]`, e);
    return NextResponse.json(
      { error: "Failed to delete attachment" },
      { status: 500 }
    );
  }
}
