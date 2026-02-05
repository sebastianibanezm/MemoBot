/**
 * Audio transcription service using OpenAI Whisper API.
 * Supports automatic language detection for English and Spanish.
 */

import OpenAI, { toFile } from "openai";

const WHISPER_MODEL = "whisper-1";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  if (!client) client = new OpenAI({ apiKey: key });
  return client;
}

/**
 * Map common audio MIME types to file extensions.
 * WhatsApp voice notes typically use audio/ogg with opus codec.
 */
function getExtensionFromMimeType(mimeType: string): string {
  const baseType = mimeType.split(";")[0].trim().toLowerCase();
  const mimeToExt: Record<string, string> = {
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/m4a": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/webm": "webm",
    "audio/aac": "aac",
  };
  return mimeToExt[baseType] ?? "ogg";
}

export interface TranscriptionResult {
  text: string;
  success: true;
}

export interface TranscriptionError {
  error: string;
  success: false;
}

export type TranscriptionResponse = TranscriptionResult | TranscriptionError;

/**
 * Transcribe audio using OpenAI Whisper API.
 * Automatically detects language (supports English, Spanish, and 50+ other languages).
 * 
 * @param audioBuffer - The audio file as a Buffer
 * @param mimeType - The MIME type of the audio (e.g., "audio/ogg; codecs=opus")
 * @returns TranscriptionResponse with text on success, or error message on failure
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string
): Promise<TranscriptionResponse> {
  // Validate buffer size (Whisper API limit is 25MB)
  const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
  if (audioBuffer.length > MAX_FILE_SIZE) {
    console.error("[transcription] Audio file too large:", audioBuffer.length, "bytes");
    return {
      success: false,
      error: "Voice message is too long. Please send a shorter message (under 25MB).",
    };
  }

  if (audioBuffer.length === 0) {
    console.error("[transcription] Empty audio buffer");
    return {
      success: false,
      error: "Voice message appears to be empty. Please try recording again.",
    };
  }

  try {
    const openai = getClient();
    const extension = getExtensionFromMimeType(mimeType);
    const filename = `audio.${extension}`;

    console.log(`[transcription] Transcribing audio: ${audioBuffer.length} bytes, type: ${mimeType}`);

    // Convert Buffer to File object for OpenAI API
    const file = await toFile(audioBuffer, filename, { type: mimeType });

    const transcription = await openai.audio.transcriptions.create({
      model: WHISPER_MODEL,
      file: file,
      // No language parameter - Whisper auto-detects
    });

    const text = transcription.text?.trim();

    if (!text) {
      console.warn("[transcription] Empty transcription result");
      return {
        success: false,
        error: "Could not understand the voice message. Please try speaking more clearly or type your message.",
      };
    }

    console.log(`[transcription] Success: "${text.slice(0, 100)}${text.length > 100 ? "..." : ""}"`);

    return {
      success: true,
      text,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[transcription] Whisper API error:", message);

    // Handle specific OpenAI API errors
    if (message.includes("Invalid file format")) {
      return {
        success: false,
        error: "Voice message format not supported. Please try again.",
      };
    }

    if (message.includes("rate limit")) {
      return {
        success: false,
        error: "Too many voice messages. Please wait a moment and try again.",
      };
    }

    return {
      success: false,
      error: "Sorry, I couldn't process your voice message. Please try again or type your message.",
    };
  }
}
