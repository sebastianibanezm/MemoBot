/**
 * DateExtractionService: Extract relevant dates from memory content.
 * Uses AI to parse natural language date references (e.g., "next Tuesday", "a week from now").
 */

import OpenAI from "openai";

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  return new OpenAI({ apiKey });
}

export interface ExtractedDate {
  date: string | null;        // ISO 8601 datetime, null if no date found
  is_in_past: boolean;        // true if the extracted date is in the past
  confidence: "high" | "medium" | "low" | "none";
  reasoning: string;          // e.g., "Found 'next Tuesday at 3pm'"
}

/**
 * Extract the most relevant date from memory content.
 * Converts relative dates (e.g., "tomorrow", "next week") to absolute dates.
 * 
 * @param content - The memory content to analyze
 * @param title - Optional title for additional context
 * @returns Extracted date info, or null date with "none" confidence if no date found
 */
export async function extractRelevantDate(
  content: string,
  title?: string | null
): Promise<ExtractedDate> {
  const now = new Date();
  
  try {
    const openai = getOpenAIClient();

    const prompt = `Analyze this memory content and extract the most relevant date/time mentioned.

${title ? `Title: ${title}\n` : ""}Content: ${content}

Current date/time: ${now.toISOString()} (${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })})

Look for:
- Specific dates: "February 15th", "March 2026", "on Friday"
- Relative dates: "tomorrow", "next week", "in 3 days", "a week from now"
- Past references: "yesterday", "last Tuesday", "two days ago"
- Times: "at 2pm", "at 14:00", "in the morning"
- Appointments/events: "meeting tomorrow at 3pm", "doctor visit next Monday"

Respond in JSON format:
{
  "has_date": boolean (true if any date/time reference was found),
  "date": string | null (ISO 8601 datetime if found, null if not),
  "is_in_past": boolean (true if the date is before the current date/time),
  "confidence": "high" | "medium" | "low" (how confident about the extraction),
  "reasoning": string (brief explanation, e.g., "Found 'doctor appointment next Tuesday at 2pm'")
}

Guidelines:
- If multiple dates exist, extract the MOST RELEVANT one (usually the main event/deadline)
- Convert relative dates to absolute dates based on current date
- If only a date is mentioned without time, use 12:00 PM (noon) as default
- If only a time is mentioned without date, assume today if future, tomorrow if past
- "high" confidence: explicit date/time mentioned
- "medium" confidence: relative date that's clear (e.g., "tomorrow")
- "low" confidence: vague references (e.g., "soon", "later this week")
- If no date reference at all, set has_date to false and date to null`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a precise date extraction assistant. Always respond with valid JSON. Be accurate when converting relative dates to absolute dates.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) {
      console.warn("[extractRelevantDate] Empty response from OpenAI");
      return {
        date: null,
        is_in_past: false,
        confidence: "none",
        reasoning: "Failed to analyze content",
      };
    }

    const parsed = JSON.parse(responseContent);

    // Validate the extracted date
    if (parsed.has_date && parsed.date) {
      const extractedDate = new Date(parsed.date);
      if (isNaN(extractedDate.getTime())) {
        console.warn("[extractRelevantDate] Invalid date from AI:", parsed.date);
        return {
          date: null,
          is_in_past: false,
          confidence: "none",
          reasoning: "Invalid date format returned",
        };
      }

      // Recalculate is_in_past to ensure accuracy
      const isInPast = extractedDate < now;

      return {
        date: extractedDate.toISOString(),
        is_in_past: isInPast,
        confidence: parsed.confidence || "medium",
        reasoning: parsed.reasoning || "Date extracted from content",
      };
    }

    return {
      date: null,
      is_in_past: false,
      confidence: "none",
      reasoning: parsed.reasoning || "No date reference found in content",
    };
  } catch (error) {
    console.error("[extractRelevantDate] Error:", error instanceof Error ? error.message : error);
    return {
      date: null,
      is_in_past: false,
      confidence: "none",
      reasoning: "Error analyzing content for dates",
    };
  }
}
