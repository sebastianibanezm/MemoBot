import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getOrCreateSession, updateSessionHistory } from "@/lib/services/session";
import { processMessage } from "@/agent/orchestrator";

/**
 * POST /api/chat — Web chat endpoint for MemoBot.
 * Body: { message: string }
 * Returns: { reply: string, memories?: Array<{ id, title, content_preview }> }
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const message = body.message?.trim();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // For web platform, use the Clerk userId as the platformUserId
    const platform = "web" as const;
    const platformUserId = userId;

    // Get or create session for this user on the web platform
    const { sessionId, session } = await getOrCreateSession(
      userId,
      platform,
      platformUserId
    );

    const messageHistory = (session.message_history ?? []) as Array<{
      role: "user" | "assistant";
      content: string;
    }>;

    // Process the message through the agent orchestrator
    const { reply, retrievedMemories, createdMemory } = await processMessage(message, {
      userId,
      sessionId,
      platform,
      messageHistory,
    });

    // Update session history with the new exchange
    await updateSessionHistory(sessionId, [
      { role: "user", content: message },
      { role: "assistant", content: reply },
    ]);

    return NextResponse.json({ 
      reply,
      memories: retrievedMemories.length > 0 ? retrievedMemories : undefined,
      createdMemory: createdMemory || undefined,
    });
  } catch (e) {
    console.error("[POST /api/chat]", e);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}
