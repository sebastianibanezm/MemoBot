/**
 * Telegram Bot webhook (PLAN.md Phase 4).
 * POST /api/webhook/telegram — verify secret, parse Update, run message router, reply via sendMessage.
 * Supports text messages, inline keyboard buttons, voice notes (via Whisper transcription),
 * and file attachments (images, documents, videos).
 */

import { NextRequest, NextResponse } from "next/server";
import { processIncomingMessage } from "@/lib/message-router";
import { transcribeAudio } from "@/lib/services/transcription";
import { uploadAttachment, type AttachmentRow } from "@/lib/services/attachment";
import { resolveUserFromPlatform } from "@/lib/services/account-linking";

const TELEGRAM_API = "https://api.telegram.org";

/**
 * Simple in-memory message deduplication cache.
 * Prevents duplicate processing when Telegram retries webhooks.
 * TTL: 5 minutes (300000ms)
 */
const processedMessages = new Map<string, number>();
const MESSAGE_DEDUP_TTL_MS = 5 * 60 * 1000;

function isMessageProcessed(updateId: number): boolean {
  const now = Date.now();
  const key = String(updateId);
  
  // Clean up expired entries
  for (const [id, timestamp] of processedMessages) {
    if (now - timestamp > MESSAGE_DEDUP_TTL_MS) {
      processedMessages.delete(id);
    }
  }
  
  if (processedMessages.has(key)) {
    console.log(`[Telegram] Skipping duplicate update: ${updateId}`);
    return true;
  }
  
  processedMessages.set(key, now);
  return false;
}

/**
 * Session-level queue to prevent race conditions when multiple messages
 * arrive for the same user before the first one finishes processing.
 */
const sessionQueues = new Map<string, Promise<void>>();

async function processWithSessionQueue(
  sessionKey: string,
  processor: () => Promise<void>
): Promise<void> {
  // Wait for any pending processing for this session
  const pending = sessionQueues.get(sessionKey);
  
  // Chain this processing after the pending one
  const newPromise = (pending ?? Promise.resolve()).then(processor).catch((err) => {
    console.error(`[Telegram] Session queue error for ${sessionKey}:`, err);
  });
  
  sessionQueues.set(sessionKey, newPromise);
  
  // Clean up after completion
  newPromise.finally(() => {
    if (sessionQueues.get(sessionKey) === newPromise) {
      sessionQueues.delete(sessionKey);
    }
  });
  
  return newPromise;
}

function getEnv(name: string): string | undefined {
  return process.env[name];
}

/**
 * Get file extension from MIME type.
 */
function getExtensionFromMime(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "application/pdf": "pdf",
    "text/plain": "txt",
    "text/markdown": "md",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  };
  return mimeToExt[mimeType.split(";")[0]] || "bin";
}

/**
 * Download a file from Telegram using the Bot API.
 * Step 1: GET /getFile to get the file path
 * Step 2: Download from https://api.telegram.org/file/bot<token>/<file_path>
 */
async function downloadTelegramFile(
  fileId: string
): Promise<{ buffer: Buffer; mimeType: string; fileName?: string } | null> {
  const token = getEnv("TELEGRAM_BOT_TOKEN");
  if (!token) {
    console.error("[Telegram] TELEGRAM_BOT_TOKEN not set for file download");
    return null;
  }

  try {
    // Step 1: Get file path
    const getFileUrl = `${TELEGRAM_API}/bot${token}/getFile?file_id=${fileId}`;
    console.log(`[Telegram] Getting file info for: ${fileId}`);
    
    const fileInfoRes = await fetch(getFileUrl);
    if (!fileInfoRes.ok) {
      const err = await fileInfoRes.text();
      console.error(`[Telegram] Failed to get file info: ${fileInfoRes.status} ${err}`);
      return null;
    }

    const fileInfo = await fileInfoRes.json() as {
      ok: boolean;
      result?: {
        file_id: string;
        file_unique_id: string;
        file_size?: number;
        file_path?: string;
      };
    };

    if (!fileInfo.ok || !fileInfo.result?.file_path) {
      console.error("[Telegram] No file path in response");
      return null;
    }

    const filePath = fileInfo.result.file_path;
    
    // Step 2: Download the file
    const downloadUrl = `${TELEGRAM_API}/file/bot${token}/${filePath}`;
    console.log(`[Telegram] Downloading file: ${filePath}`);
    
    const fileRes = await fetch(downloadUrl);
    if (!fileRes.ok) {
      const err = await fileRes.text();
      console.error(`[Telegram] Failed to download file: ${fileRes.status} ${err}`);
      return null;
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Infer mime type from file extension
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    const extToMime: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'pdf': 'application/pdf',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'ogg': 'audio/ogg',
      'oga': 'audio/ogg',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain',
      'md': 'text/markdown',
    };
    const mimeType = extToMime[extension] || 'application/octet-stream';
    
    // Extract filename from path
    const fileName = filePath.split('/').pop();
    
    console.log(`[Telegram] Downloaded file: ${buffer.length} bytes, type: ${mimeType}`);
    
    return { buffer, mimeType, fileName };
  } catch (error) {
    console.error("[Telegram] File download error:", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Verify webhook request using Telegram secret_token (X-Telegram-Bot-Api-Secret-Token).
 */
function verifySecretToken(request: NextRequest): boolean {
  const secret = getEnv("TELEGRAM_WEBHOOK_SECRET");
  if (!secret) return false;
  const header = request.headers.get("x-telegram-bot-api-secret-token");
  return header === secret;
}

/** Button structure for inline keyboard */
export interface TelegramButton {
  id: string;
  title: string;
}

/**
 * Send a text message to a Telegram chat via Bot API.
 * Optionally includes an inline keyboard with buttons.
 */
async function sendTelegramMessage(
  chatId: number, 
  text: string,
  buttons?: TelegramButton[]
): Promise<void> {
  const token = getEnv("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");
  
  const url = `${TELEGRAM_API}/bot${token}/sendMessage`;
  
  // Build payload
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
  };
  
  // Add inline keyboard if buttons provided
  if (buttons && buttons.length > 0) {
    payload.reply_markup = {
      inline_keyboard: buttons.slice(0, 3).map((btn) => [
        {
          text: btn.title.slice(0, 64), // Telegram allows up to 64 chars
          callback_data: btn.id.slice(0, 64), // callback_data max 64 bytes
        },
      ]),
    };
  }
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  
  if (!res.ok) {
    const err = await res.text();
    // If Markdown parsing fails, retry without parse_mode
    if (err.includes("can't parse entities") || err.includes("Bad Request")) {
      console.warn("[Telegram] Markdown parsing failed, retrying as plain text");
      payload.parse_mode = undefined;
      const retryRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!retryRes.ok) {
        const retryErr = await retryRes.text();
        throw new Error(`Telegram sendMessage failed: ${retryRes.status} ${retryErr}`);
      }
      return;
    }
    throw new Error(`Telegram sendMessage failed: ${res.status} ${err}`);
  }
}

/**
 * Answer a callback query (button click acknowledgment).
 * This removes the "loading" state from the button.
 */
async function answerCallbackQuery(callbackQueryId: string): Promise<void> {
  const token = getEnv("TELEGRAM_BOT_TOKEN");
  if (!token) return;
  
  const url = `${TELEGRAM_API}/bot${token}/answerCallbackQuery`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  });
}

/** Telegram Update payload (subset we use). */
interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string; username?: string };
    chat: { id: number; type?: string };
    text?: string;
    voice?: {
      file_id: string;
      file_unique_id: string;
      duration: number;
      mime_type?: string;
      file_size?: number;
    };
    audio?: {
      file_id: string;
      file_unique_id: string;
      duration: number;
      mime_type?: string;
      file_size?: number;
      file_name?: string;
    };
    photo?: Array<{
      file_id: string;
      file_unique_id: string;
      width: number;
      height: number;
      file_size?: number;
    }>;
    document?: {
      file_id: string;
      file_unique_id: string;
      file_name?: string;
      mime_type?: string;
      file_size?: number;
    };
    video?: {
      file_id: string;
      file_unique_id: string;
      width: number;
      height: number;
      duration: number;
      mime_type?: string;
      file_size?: number;
    };
    caption?: string;
    // Forwarded message fields
    forward_origin?: unknown;
    forward_from?: { id: number; first_name?: string; username?: string };
    forward_from_chat?: { id: number; title?: string; type?: string };
    forward_date?: number;
    forward_sender_name?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name?: string; username?: string };
    message?: {
      message_id: number;
      chat: { id: number; type?: string };
    };
    data?: string; // callback_data from the button
  };
}

export async function POST(request: NextRequest) {
  if (!verifySecretToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: TelegramUpdate;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Skip duplicate updates
  if (isMessageProcessed(body.update_id)) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Handle callback query (button click)
  if (body.callback_query) {
    const callbackQuery = body.callback_query;
    const chatId = callbackQuery.message?.chat.id;
    const fromId = String(callbackQuery.from.id);
    const buttonId = callbackQuery.data;
    
    if (!chatId || !buttonId) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    
    // Acknowledge the button click
    await answerCallbackQuery(callbackQuery.id);
    
    // Map button IDs to text commands (similar to WhatsApp)
    const buttonToText: Record<string, string> = {
      new_memory: "I want to create a new memory",
      save_memory: "Save it",
      create_reminder: "Yes, create a reminder for this",
    };
    
    const text = buttonToText[buttonId] || buttonId;
    console.log(`[Telegram] Button clicked: ${buttonId} ("${text}")`);
    
    const replyFn = async (replyText: string, options?: { buttons?: TelegramButton[] }) => {
      await sendTelegramMessage(chatId, replyText, options?.buttons);
    };
    
    // Process with session queue
    const sessionKey = `telegram:${fromId}`;
    await processWithSessionQueue(sessionKey, async () => {
      try {
        await processIncomingMessage("telegram", fromId, text, replyFn, buttonId);
      } catch (err) {
        console.error("Telegram callback query processIncomingMessage error:", err);
        try {
          await replyFn("Something went wrong. Please try again or contact support.");
        } catch (sendErr) {
          console.error("Telegram sendMessage error after failure:", sendErr);
        }
      }
    });
    
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Handle regular message
  const message = body.message;
  if (!message?.chat?.id || message.from?.id == null) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const chatId = message.chat.id;
  const fromId = String(message.from.id);
  
  const replyFn = async (replyText: string, options?: { buttons?: TelegramButton[] }) => {
    await sendTelegramMessage(chatId, replyText, options?.buttons);
  };

  // Detect forwarded messages
  let isForwarded = false;
  if (message.forward_origin || message.forward_from || message.forward_from_chat || message.forward_date) {
    isForwarded = true;
    // Extract forwarding source for logging
    let forwardedFrom = "unknown";
    if (message.forward_from) {
      forwardedFrom = message.forward_from.first_name || message.forward_from.username || "someone";
    } else if (message.forward_from_chat) {
      forwardedFrom = message.forward_from_chat.title || "a chat";
    } else if (message.forward_sender_name) {
      forwardedFrom = message.forward_sender_name;
    }
    console.log(`[Telegram] Forwarded message detected from: ${forwardedFrom}`);
  }

  let text = "";
  let attachment: AttachmentRow | undefined;

  // Handle text message
  if (message.text) {
    text = message.text.trim();
  }
  // Handle voice message (voice notes)
  else if (message.voice) {
    console.log(`[Telegram] Voice message received from ${fromId}, file ID: ${message.voice.file_id}`);
    
    const file = await downloadTelegramFile(message.voice.file_id);
    if (!file) {
      try {
        await replyFn("Sorry, I couldn't download your voice message. Please try again or type your message.");
      } catch (sendErr) {
        console.error("[Telegram] Failed to send voice download error:", sendErr);
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    
    // Force OGG mime type for Telegram voice messages (they're always OGG/Opus)
    const mimeType = message.voice.mime_type || "audio/ogg";
    const transcription = await transcribeAudio(file.buffer, mimeType);
    
    if (!transcription.success) {
      try {
        await replyFn(transcription.error);
      } catch (sendErr) {
        console.error("[Telegram] Failed to send transcription error:", sendErr);
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    
    text = transcription.text;
    console.log(`[Telegram] Voice message transcribed: "${text.slice(0, 100)}${text.length > 100 ? "..." : ""}"`);
  }
  // Handle audio file
  else if (message.audio) {
    console.log(`[Telegram] Audio file received from ${fromId}, file ID: ${message.audio.file_id}`);
    
    const file = await downloadTelegramFile(message.audio.file_id);
    if (!file) {
      try {
        await replyFn("Sorry, I couldn't download your audio file. Please try again or type your message.");
      } catch (sendErr) {
        console.error("[Telegram] Failed to send audio download error:", sendErr);
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    
    const mimeType = message.audio.mime_type || file.mimeType;
    const transcription = await transcribeAudio(file.buffer, mimeType);
    
    if (!transcription.success) {
      try {
        await replyFn(transcription.error);
      } catch (sendErr) {
        console.error("[Telegram] Failed to send transcription error:", sendErr);
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    
    text = transcription.text;
    console.log(`[Telegram] Audio file transcribed: "${text.slice(0, 100)}${text.length > 100 ? "..." : ""}"`);
  }
  // Handle photo
  else if (message.photo && message.photo.length > 0) {
    // Get the largest photo (last in array)
    const photo = message.photo[message.photo.length - 1];
    console.log(`[Telegram] Photo received from ${fromId}, file ID: ${photo.file_id}`);
    
    const userId = await resolveUserFromPlatform("telegram", fromId);
    if (!userId) {
      try {
        await replyFn("Please link your account first before sending images. Send LINK followed by your 6-digit code.");
      } catch (sendErr) {
        console.error("[Telegram] Failed to send link prompt:", sendErr);
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    
    const file = await downloadTelegramFile(photo.file_id);
    if (!file) {
      try {
        await replyFn("Sorry, I couldn't download your image. Please try again.");
      } catch (sendErr) {
        console.error("[Telegram] Failed to send photo download error:", sendErr);
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    
    try {
      const result = await uploadAttachment({
        userId,
        buffer: file.buffer,
        fileName: `image_${Date.now()}.${getExtensionFromMime(file.mimeType)}`,
        mimeType: file.mimeType,
      });
      attachment = result.attachment;
      
      // Use caption as text, or extracted content, or default message
      text = message.caption?.trim() || 
             (result.analysisResult?.content ? `[Image: ${result.analysisResult.content}]` : "") ||
             "I'm sharing an image with you";
      
      console.log(`[Telegram] Photo uploaded: ${attachment.id}, extracted: ${result.analysisResult?.status}`);
    } catch (err) {
      console.error("[Telegram] Failed to upload photo:", err);
      try {
        await replyFn("Sorry, I couldn't process your image. Please try again.");
      } catch (sendErr) {
        console.error("[Telegram] Failed to send upload error:", sendErr);
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }
  }
  // Handle document
  else if (message.document) {
    console.log(`[Telegram] Document received from ${fromId}, file ID: ${message.document.file_id}`);
    
    const userId = await resolveUserFromPlatform("telegram", fromId);
    if (!userId) {
      try {
        await replyFn("Please link your account first before sending documents. Send LINK followed by your 6-digit code.");
      } catch (sendErr) {
        console.error("[Telegram] Failed to send link prompt:", sendErr);
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    
    const file = await downloadTelegramFile(message.document.file_id);
    if (!file) {
      try {
        await replyFn("Sorry, I couldn't download your document. Please try again.");
      } catch (sendErr) {
        console.error("[Telegram] Failed to send document download error:", sendErr);
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    
    try {
      const fileName = message.document.file_name || file.fileName || `document_${Date.now()}.${getExtensionFromMime(file.mimeType)}`;
      const mimeType = message.document.mime_type || file.mimeType;
      
      const result = await uploadAttachment({
        userId,
        buffer: file.buffer,
        fileName,
        mimeType,
      });
      attachment = result.attachment;
      
      // Use caption as text, or extracted content preview, or default message
      const extractedPreview = result.analysisResult?.content?.slice(0, 200);
      text = message.caption?.trim() || 
             (extractedPreview ? `[Document "${fileName}": ${extractedPreview}...]` : `[Document: ${fileName}]`) ||
             `I'm sharing a document: ${fileName}`;
      
      console.log(`[Telegram] Document uploaded: ${attachment.id}, extracted: ${result.analysisResult?.status}`);
    } catch (err) {
      console.error("[Telegram] Failed to upload document:", err);
      try {
        await replyFn("Sorry, I couldn't process your document. Please try again.");
      } catch (sendErr) {
        console.error("[Telegram] Failed to send upload error:", sendErr);
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }
  }
  // Handle video
  else if (message.video) {
    console.log(`[Telegram] Video received from ${fromId}, file ID: ${message.video.file_id}`);
    
    const userId = await resolveUserFromPlatform("telegram", fromId);
    if (!userId) {
      try {
        await replyFn("Please link your account first before sending videos. Send LINK followed by your 6-digit code.");
      } catch (sendErr) {
        console.error("[Telegram] Failed to send link prompt:", sendErr);
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    
    const file = await downloadTelegramFile(message.video.file_id);
    if (!file) {
      try {
        await replyFn("Sorry, I couldn't download your video. Please try again.");
      } catch (sendErr) {
        console.error("[Telegram] Failed to send video download error:", sendErr);
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    
    try {
      const mimeType = message.video.mime_type || file.mimeType;
      
      const result = await uploadAttachment({
        userId,
        buffer: file.buffer,
        fileName: `video_${Date.now()}.${getExtensionFromMime(mimeType)}`,
        mimeType,
      }, false); // Don't analyze video content (not supported yet)
      attachment = result.attachment;
      
      // Use caption as text or default message
      text = message.caption?.trim() || "I'm sharing a video with you";
      
      console.log(`[Telegram] Video uploaded: ${attachment.id}`);
    } catch (err) {
      console.error("[Telegram] Failed to upload video:", err);
      try {
        await replyFn("Sorry, I couldn't process your video. Please try again.");
      } catch (sendErr) {
        console.error("[Telegram] Failed to send upload error:", sendErr);
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }
  }
  // Skip other message types (stickers, contacts, location, etc.)
  else {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (!text) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Process messages sequentially per user to prevent race conditions
  const sessionKey = `telegram:${fromId}`;
  await processWithSessionQueue(sessionKey, async () => {
    try {
      await processIncomingMessage("telegram", fromId, text, replyFn, undefined, attachment, isForwarded);
    } catch (err) {
      console.error("Telegram webhook processIncomingMessage error:", err);
      try {
        await replyFn("Something went wrong. Please try again or contact support.");
      } catch (sendErr) {
        console.error("Telegram sendMessage error after failure:", sendErr);
      }
    }
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
