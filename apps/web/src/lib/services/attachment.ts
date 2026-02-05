/**
 * Attachment Service
 * Handles file uploads to Supabase Storage and attachment record management.
 */

import { createServerSupabase } from "../supabase/server";
import {
  analyzeFileContent,
  type AnalysisResult,
  type ExtractionStatus,
} from "./content-analyzer";

const STORAGE_BUCKET = "memory-attachments";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Track if bucket has been verified to exist
let bucketVerified = false;

/**
 * Ensure the storage bucket exists, creating it if necessary.
 */
async function ensureBucketExists(): Promise<void> {
  if (bucketVerified) return;

  const supabase = createServerSupabase();

  // Check if bucket exists
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error("[attachment] Failed to list buckets:", listError.message);
    // Continue anyway - the bucket might exist
    bucketVerified = true;
    return;
  }

  const bucketExists = buckets?.some((b) => b.name === STORAGE_BUCKET);

  if (!bucketExists) {
    console.log(`[attachment] Creating storage bucket: ${STORAGE_BUCKET}`);
    const { error: createError } = await supabase.storage.createBucket(STORAGE_BUCKET, {
      public: false,
      fileSizeLimit: MAX_FILE_SIZE,
      allowedMimeTypes: [
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
      ],
    });

    if (createError) {
      // Bucket might already exist (race condition) or other issue
      console.error("[attachment] Failed to create bucket:", createError.message);
    } else {
      console.log(`[attachment] Storage bucket created: ${STORAGE_BUCKET}`);
    }
  }

  bucketVerified = true;
}

export interface AttachmentRow {
  id: string;
  memory_id: string | null;
  user_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  extracted_content: string | null;
  extraction_status: ExtractionStatus | "pending";
  created_at: string;
}

export interface UploadAttachmentInput {
  userId: string;
  memoryId?: string | null;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

export interface UploadAttachmentResult {
  attachment: AttachmentRow;
  analysisResult: AnalysisResult | null;
}

/**
 * Upload a file to Supabase Storage and create an attachment record.
 * Optionally analyzes the file content for text extraction.
 */
export async function uploadAttachment(
  input: UploadAttachmentInput,
  analyzeContent = true
): Promise<UploadAttachmentResult> {
  const { userId, memoryId, buffer, fileName, mimeType } = input;
  const supabase = createServerSupabase();

  // Validate file size
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(
      `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
    );
  }

  // Ensure storage bucket exists
  await ensureBucketExists();

  // Generate unique storage path: userId/timestamp_filename
  const timestamp = Date.now();
  const sanitizedFileName = sanitizeFileName(fileName);
  const storagePath = `${userId}/${timestamp}_${sanitizedFileName}`;

  console.log(
    `[attachment] Uploading: ${fileName} (${buffer.length} bytes) to ${storagePath}`
  );

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error("[attachment] Upload failed:", uploadError.message);
    throw new Error(`Failed to upload file: ${uploadError.message}`);
  }

  // Analyze content if requested
  let analysisResult: AnalysisResult | null = null;
  let extractedContent: string | null = null;
  let extractionStatus: ExtractionStatus | "pending" = "pending";

  if (analyzeContent) {
    analysisResult = await analyzeFileContent(buffer, mimeType, fileName);
    extractedContent = analysisResult.content;
    extractionStatus = analysisResult.status;
  }

  // Create attachment record in database
  const { data: attachment, error: dbError } = await supabase
    .from("attachments")
    .insert({
      user_id: userId,
      memory_id: memoryId ?? null,
      file_name: fileName,
      file_type: mimeType,
      file_size: buffer.length,
      storage_path: storagePath,
      extracted_content: extractedContent,
      extraction_status: extractionStatus,
    })
    .select()
    .single();

  if (dbError) {
    // Clean up uploaded file if database insert fails
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    console.error("[attachment] Database insert failed:", dbError.message);
    throw new Error(`Failed to create attachment record: ${dbError.message}`);
  }

  console.log(`[attachment] Created attachment ${attachment.id} for ${fileName}`);

  return {
    attachment: attachment as AttachmentRow,
    analysisResult,
  };
}

/**
 * Generate a signed URL for downloading an attachment.
 * URL is valid for 1 hour.
 */
export async function getAttachmentUrl(
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string> {
  const supabase = createServerSupabase();

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) {
    throw new Error(`Failed to generate download URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Get all attachments for a memory.
 */
export async function getAttachmentsByMemoryId(
  memoryId: string
): Promise<AttachmentRow[]> {
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("memory_id", memoryId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch attachments: ${error.message}`);
  }

  return (data as AttachmentRow[]) ?? [];
}

/**
 * Get unlinked (pending) attachments for a user.
 * These are attachments uploaded but not yet linked to a memory.
 */
export async function getPendingAttachments(
  userId: string
): Promise<AttachmentRow[]> {
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("user_id", userId)
    .is("memory_id", null)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(`Failed to fetch pending attachments: ${error.message}`);
  }

  return (data as AttachmentRow[]) ?? [];
}

/**
 * Link attachments to a memory.
 * Used when a memory is created/finalized.
 */
export async function linkAttachmentsToMemory(
  attachmentIds: string[],
  memoryId: string,
  userId: string
): Promise<void> {
  if (attachmentIds.length === 0) return;

  const supabase = createServerSupabase();

  const { error } = await supabase
    .from("attachments")
    .update({ memory_id: memoryId })
    .in("id", attachmentIds)
    .eq("user_id", userId)
    .is("memory_id", null); // Only update unlinked attachments

  if (error) {
    throw new Error(`Failed to link attachments: ${error.message}`);
  }

  console.log(
    `[attachment] Linked ${attachmentIds.length} attachments to memory ${memoryId}`
  );
}

/**
 * Delete an attachment (from both storage and database).
 */
export async function deleteAttachment(
  attachmentId: string,
  userId: string
): Promise<void> {
  const supabase = createServerSupabase();

  // First, get the attachment to find its storage path
  const { data: attachment, error: fetchError } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .eq("user_id", userId)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      // Attachment not found or doesn't belong to user
      return;
    }
    throw new Error(`Failed to fetch attachment: ${fetchError.message}`);
  }

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([attachment.storage_path]);

  if (storageError) {
    console.error(
      "[attachment] Storage delete failed:",
      storageError.message
    );
    // Continue to delete database record even if storage fails
  }

  // Delete from database
  const { error: dbError } = await supabase
    .from("attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("user_id", userId);

  if (dbError) {
    throw new Error(`Failed to delete attachment: ${dbError.message}`);
  }

  console.log(`[attachment] Deleted attachment ${attachmentId}`);
}

/**
 * Get attachment count for a memory.
 */
export async function getAttachmentCount(memoryId: string): Promise<number> {
  const supabase = createServerSupabase();

  const { count, error } = await supabase
    .from("attachments")
    .select("*", { count: "exact", head: true })
    .eq("memory_id", memoryId);

  if (error) {
    console.error("[attachment] Count query failed:", error.message);
    return 0;
  }

  return count ?? 0;
}

/**
 * Get a single attachment by ID.
 */
export async function getAttachmentById(
  attachmentId: string,
  userId: string
): Promise<AttachmentRow | null> {
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("id", attachmentId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch attachment: ${error.message}`);
  }

  return data as AttachmentRow;
}

/**
 * Sanitize file name for storage path.
 * Removes special characters and limits length.
 */
function sanitizeFileName(fileName: string): string {
  // Remove path separators and special characters
  const sanitized = fileName
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 100);

  // Ensure we have a valid file name
  return sanitized || "file";
}

/**
 * Format file size for display.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
