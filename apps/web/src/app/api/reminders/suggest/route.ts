import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getMemoryById } from "@/lib/services/memory";
import OpenAI from "openai";

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  return new OpenAI({ apiKey });
}

/**
 * POST /api/reminders/suggest — analyze a memory and suggest reminder details.
 * Body: { memory_id }
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { memory_id } = body;

    if (!memory_id) {
      return NextResponse.json({ error: "memory_id is required" }, { status: 400 });
    }

    // Get the memory
    const memory = await getMemoryById(userId, memory_id);
    if (!memory) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    }

    const openai = getOpenAIClient();

    const now = new Date();
    const prompt = `Analyze this memory and suggest a reminder for it. The memory may contain dates, deadlines, appointments, tasks, or other time-sensitive information.

Memory Title: ${memory.title || "Untitled"}
Memory Content: ${memory.content}
${memory.summary ? `Memory Summary: ${memory.summary}` : ""}

Current date/time: ${now.toISOString()}

Respond in JSON format with these fields:
{
  "should_remind": boolean (true if this memory contains actionable/time-sensitive content),
  "title": string (a short, action-oriented reminder title, max 50 chars),
  "summary": string (brief reasoning for the reminder, max 100 chars),
  "suggested_time": string (ISO 8601 datetime for when to remind, must be in the future),
  "confidence": "high" | "medium" | "low" (how confident you are about the suggestion)
}

Guidelines:
- If there's a specific date/time mentioned, use that (adjusted to the future if needed)
- If there's a deadline, suggest reminding 1 day before
- If there's an appointment, suggest reminding 1 hour before
- If it's a general task without a date, suggest tomorrow at 9 AM
- If the memory doesn't seem to need a reminder (e.g., just a note or observation), set should_remind to false
- Title should be actionable (e.g., "Follow up on...", "Prepare for...", "Complete...")`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 300,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that analyzes memories to suggest appropriate reminders. Always respond with valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "Failed to analyze memory" }, { status: 500 });
    }

    const suggestion = JSON.parse(content);

    // Validate and adjust suggested_time if needed
    if (suggestion.suggested_time) {
      const suggestedDate = new Date(suggestion.suggested_time);
      if (isNaN(suggestedDate.getTime()) || suggestedDate <= now) {
        // Default to tomorrow at 9 AM if invalid or in the past
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        suggestion.suggested_time = tomorrow.toISOString();
      }
    } else {
      // Default to tomorrow at 9 AM
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      suggestion.suggested_time = tomorrow.toISOString();
    }

    return NextResponse.json({
      suggestion: {
        should_remind: suggestion.should_remind ?? true,
        title: suggestion.title || memory.title || "Reminder",
        summary: suggestion.summary || "",
        suggested_time: suggestion.suggested_time,
        confidence: suggestion.confidence || "medium",
      },
    });
  } catch (e) {
    console.error("[POST /api/reminders/suggest]", e);
    return NextResponse.json({ error: "Failed to analyze memory" }, { status: 500 });
  }
}
