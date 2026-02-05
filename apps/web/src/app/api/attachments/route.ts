/**
 * GET /api/attachments — Get attachments for a memory.
 * Query params: memoryId (required)
 * Returns: { attachments: AttachmentRow[] }
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getAttachmentsByMemoryId, getAttachmentUrl } from "@/lib/services/attachment";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memoryId = request.nextUrl.searchParams.get("memoryId");

  if (!memoryId) {
    return NextResponse.json(
      { error: "memoryId is required" },
      { status: 400 }
    );
  }

  try {
    const attachments = await getAttachmentsByMemoryId(memoryId);

    // Generate signed URLs for each attachment
    const attachmentsWithUrls = await Promise.all(
      attachments.map(async (att) => ({
        ...att,
        url: await getAttachmentUrl(att.storage_path),
      }))
    );

    return NextResponse.json({ attachments: attachmentsWithUrls });
  } catch (e) {
    console.error("[GET /api/attachments]", e);
    return NextResponse.json(
      { error: "Failed to fetch attachments" },
      { status: 500 }
    );
  }
}
