/**
 * POST /api/attachments/upload — Upload a file attachment.
 * Accepts multipart/form-data with file and optional memoryId.
 * Returns: { attachment: AttachmentRow }
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { uploadAttachment, type AttachmentRow } from "@/lib/services/attachment";
import { syncUserToSupabase } from "@/lib/sync-user";

// Vercel Hobby plan has a 4.5MB request body limit.
// Set file limit to 4MB to leave headroom for form-data overhead.
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

// Allow up to 60s for upload + AI analysis (default is 10s on Hobby)
export const maxDuration = 60;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
];

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ensure user exists in database before creating attachment
  const user = await currentUser();
  if (user) {
    await syncUserToSupabase({
      id: user.id,
      email_addresses: user.emailAddresses?.map((e) => ({ email_address: e.emailAddress })),
      first_name: user.firstName,
      last_name: user.lastName,
      image_url: user.imageUrl,
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const memoryId = formData.get("memoryId") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type not supported: ${file.type}` },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload attachment
    const result = await uploadAttachment({
      userId,
      memoryId: memoryId || undefined,
      buffer,
      fileName: file.name,
      mimeType: file.type,
    });

    return NextResponse.json({
      attachment: result.attachment,
      analysisResult: result.analysisResult
        ? {
            status: result.analysisResult.status,
            hasContent: !!result.analysisResult.content,
          }
        : null,
    });
  } catch (e) {
    console.error("[POST /api/attachments/upload]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to upload file" },
      { status: 500 }
    );
  }
}
