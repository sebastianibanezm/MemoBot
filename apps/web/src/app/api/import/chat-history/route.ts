import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { importChatHistory } from "@/lib/services/bulk-import";

/**
 * POST /api/import/chat-history — Upload and import a chat export file.
 * Accepts multipart/form-data with a "file" field containing .txt export.
 * Returns import results.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    
    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum 10MB." }, { status: 400 });
    }
    
    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".txt") && !fileName.endsWith(".text")) {
      return NextResponse.json({ 
        error: "Invalid file type. Please upload a .txt chat export file." 
      }, { status: 400 });
    }
    
    const content = await file.text();
    
    if (content.trim().length === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }
    
    console.log(`[import] Starting chat history import for user ${userId}, file: ${file.name}, size: ${file.size} bytes`);
    
    const result = await importChatHistory(userId, content, file.name);
    
    console.log(`[import] Complete for user ${userId}: ${result.memoriesCreated} created, ${result.memoriesSkipped} skipped`);
    
    return NextResponse.json(result);
  } catch (e) {
    console.error("[import] Error:", e);
    return NextResponse.json(
      { error: "Import failed", message: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
