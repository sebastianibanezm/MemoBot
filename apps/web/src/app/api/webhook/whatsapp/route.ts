/**
 * WhatsApp Cloud API webhook (PLAN.md Phase 5).
 * GET: verification — hub.mode, hub.verify_token, hub.challenge; return challenge if token matches.
 * POST: verify X-Hub-Signature-256, parse entry/changes/messages, run message router, reply via Cloud API.
 * Supports text messages, interactive buttons, and voice notes (via Whisper transcription).
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { processIncomingMessage } from "@/lib/message-router";
import { transcribeAudio } from "@/lib/services/transcription";

const GRAPH_API = "https://graph.facebook.com/v21.0";

/**
 * Simple in-memory message deduplication cache.
 * Prevents duplicate processing when WhatsApp retries webhooks.
 * TTL: 5 minutes (300000ms)
 */
const processedMessages = new Map<string, number>();
const MESSAGE_DEDUP_TTL_MS = 5 * 60 * 1000;

function isMessageProcessed(messageId: string): boolean {
  const now = Date.now();
  
  // Clean up expired entries
  for (const [id, timestamp] of processedMessages) {
    if (now - timestamp > MESSAGE_DEDUP_TTL_MS) {
      processedMessages.delete(id);
    }
  }
  
  if (processedMessages.has(messageId)) {
    console.log(`[WhatsApp] Skipping duplicate message: ${messageId}`);
    return true;
  }
  
  processedMessages.set(messageId, now);
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
    console.error(`[WhatsApp] Session queue error for ${sessionKey}:`, err);
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
 * Download media file from WhatsApp Cloud API.
 * Step 1: GET /{mediaId} to get the media URL
 * Step 2: GET the media URL with Bearer token to download the file
 * 
 * @param mediaId - The WhatsApp media ID
 * @returns Object with buffer and mimeType, or null if download fails
 */
async function downloadWhatsAppMedia(
  mediaId: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const token = getEnv("WHATSAPP_ACCESS_TOKEN");
  if (!token) {
    console.error("[WhatsApp] WHATSAPP_ACCESS_TOKEN not set for media download");
    return null;
  }

  try {
    // Step 1: Get the media URL
    const mediaInfoUrl = `${GRAPH_API}/${mediaId}`;
    console.log(`[WhatsApp] Fetching media info: ${mediaId}`);
    
    const infoRes = await fetch(mediaInfoUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!infoRes.ok) {
      const err = await infoRes.text();
      console.error(`[WhatsApp] Failed to get media info: ${infoRes.status} ${err}`);
      return null;
    }

    const mediaInfo = await infoRes.json() as { url?: string; mime_type?: string };
    const mediaUrl = mediaInfo.url;
    const mimeType = mediaInfo.mime_type ?? "audio/ogg";

    if (!mediaUrl) {
      console.error("[WhatsApp] No URL in media info response");
      return null;
    }

    // Step 2: Download the actual media file
    console.log(`[WhatsApp] Downloading media: ${mimeType}`);
    
    const mediaRes = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!mediaRes.ok) {
      const err = await mediaRes.text();
      console.error(`[WhatsApp] Failed to download media: ${mediaRes.status} ${err}`);
      return null;
    }

    const arrayBuffer = await mediaRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`[WhatsApp] Downloaded media: ${buffer.length} bytes`);
    
    return { buffer, mimeType };
  } catch (error) {
    console.error("[WhatsApp] Media download error:", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * GET: Webhook verification. Meta sends hub.mode=subscribe, hub.verify_token, hub.challenge.
 * Return hub.challenge as plain text if verify_token matches WHATSAPP_VERIFY_TOKEN.
 */
export async function GET(request: NextRequest) {
  const verifyToken = getEnv("WHATSAPP_VERIFY_TOKEN");
  if (!verifyToken) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode !== "subscribe" || token !== verifyToken || !challenge) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return new NextResponse(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

/**
 * Verify X-Hub-Signature-256: HMAC-SHA256(rawBody, appSecret) = "sha256=" + hex.
 */
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = getEnv("WHATSAPP_APP_SECRET");
  if (!appSecret || !signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }
  const expected = signatureHeader.slice(7).toLowerCase();
  const hmac = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(hmac, "hex"));
  } catch {
    return false;
  }
}

/** WhatsApp webhook payload (subset we use). */
interface WhatsAppWebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      value?: {
        messaging_product?: string;
        metadata?: { phone_number_id?: string };
        messages?: Array<{
          from?: string;
          id?: string;
          type?: string;  // "text" | "interactive" | "audio"
          text?: { body?: string };
          interactive?: {
            type?: string;  // "button_reply"
            button_reply?: {
              id?: string;    // e.g., "save_memory", "create_reminder"
              title?: string;
            };
          };
          audio?: {
            id?: string;        // Media ID to download the audio file
            mime_type?: string; // e.g., "audio/ogg; codecs=opus"
          };
        }>;
      };
      field?: string;
    }>;
  }>;
}

/** Button structure for interactive messages */
export interface WhatsAppButton {
  id: string;
  title: string;  // max 20 chars
}

/**
 * Send a text message via WhatsApp Cloud API.
 */
async function sendWhatsAppMessage(phoneNumberId: string, to: string, text: string): Promise<void> {
  const token = getEnv("WHATSAPP_ACCESS_TOKEN");
  if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN not set");
  const url = `${GRAPH_API}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/\D/g, ""),
      type: "text",
      text: { body: text },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp sendMessage failed: ${res.status} ${err}`);
  }
}

/**
 * Send an interactive message with reply buttons via WhatsApp Cloud API.
 * Supports up to 3 buttons, each with max 20 character titles.
 */
async function sendWhatsAppInteractiveMessage(
  phoneNumberId: string,
  to: string,
  bodyText: string,
  buttons: WhatsAppButton[]
): Promise<void> {
  const token = getEnv("WHATSAPP_ACCESS_TOKEN");
  if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN not set");
  
  const url = `${GRAPH_API}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/\D/g, ""),
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: buttons.slice(0, 3).map((btn) => ({
            type: "reply",
            reply: { 
              id: btn.id, 
              title: btn.title.slice(0, 20)  // Enforce max 20 chars
            },
          })),
        },
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp interactive message failed: ${res.status} ${err}`);
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: WhatsAppWebhookPayload;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.object !== "whatsapp_business_account" || !Array.isArray(body.entry)) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const phoneNumberId = getEnv("WHATSAPP_PHONE_NUMBER_ID");
  if (!phoneNumberId) {
    console.error("WHATSAPP_PHONE_NUMBER_ID not set");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  for (const entry of body.entry) {
    const changes = entry.changes ?? [];
    for (const change of changes) {
      if (change.field !== "messages") continue;
      const value = change.value;
      if (!value?.messages) continue;
      for (const msg of value.messages) {
        const from = msg.from ?? "";
        const messageId = msg.id ?? "";
        if (!from) continue;
        
        // Skip duplicate messages (WhatsApp retries)
        if (messageId && isMessageProcessed(messageId)) {
          continue;
        }

        // Reply function that supports optional buttons
        const replyFn = async (replyText: string, options?: { buttons?: WhatsAppButton[] }) => {
          if (options?.buttons && options.buttons.length > 0) {
            await sendWhatsAppInteractiveMessage(phoneNumberId, from, replyText, options.buttons);
          } else {
            await sendWhatsAppMessage(phoneNumberId, from, replyText);
          }
        };
        
        // Extract message content from text, button click, OR voice note
        let text = "";
        let buttonId: string | undefined;
        
        if (msg.type === "text" && msg.text?.body) {
          text = msg.text.body.trim();
        } else if (msg.type === "interactive" && msg.interactive?.button_reply) {
          buttonId = msg.interactive.button_reply.id;
          text = msg.interactive.button_reply.title ?? "";
          console.log(`[WhatsApp] Button clicked: ${buttonId} ("${text}")`);
        } else if (msg.type === "audio" && msg.audio?.id) {
          // Handle voice note: download and transcribe
          console.log(`[WhatsApp] Voice note received from ${from}, media ID: ${msg.audio.id}`);
          
          const media = await downloadWhatsAppMedia(msg.audio.id);
          if (!media) {
            // Failed to download media - send error message
            try {
              await replyFn("Sorry, I couldn't download your voice message. Please try again or type your message.");
            } catch (sendErr) {
              console.error("[WhatsApp] Failed to send media download error:", sendErr);
            }
            continue;
          }
          
          const transcription = await transcribeAudio(media.buffer, media.mimeType);
          if (!transcription.success) {
            // Transcription failed - send error message
            try {
              await replyFn(transcription.error);
            } catch (sendErr) {
              console.error("[WhatsApp] Failed to send transcription error:", sendErr);
            }
            continue;
          }
          
          text = transcription.text;
          console.log(`[WhatsApp] Voice note transcribed: "${text.slice(0, 100)}${text.length > 100 ? "..." : ""}"`);
        } else {
          // Skip unsupported message types (images, videos, documents, etc.)
          continue;
        }
        
        if (!text) continue;

        // Process messages sequentially per user to prevent race conditions
        const sessionKey = `whatsapp:${from}`;
        await processWithSessionQueue(sessionKey, async () => {
          try {
            await processIncomingMessage("whatsapp", from, text, replyFn, buttonId);
          } catch (err) {
            console.error("WhatsApp webhook processIncomingMessage error:", err);
            try {
              await replyFn("Something went wrong. Please try again or contact support.");
            } catch (sendErr) {
              console.error("WhatsApp sendMessage error after failure:", sendErr);
            }
          }
        });
      }
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
