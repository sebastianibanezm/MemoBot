/**
 * WhatsApp Cloud API webhook (PLAN.md Phase 5).
 * GET: verification — hub.mode, hub.verify_token, hub.challenge; return challenge if token matches.
 * POST: verify X-Hub-Signature-256, parse entry/changes/messages, run message router, reply via Cloud API.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { processIncomingMessage } from "@/lib/message-router";

const GRAPH_API = "https://graph.facebook.com/v21.0";

function getEnv(name: string): string | undefined {
  return process.env[name];
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
          type?: string;
          text?: { body?: string };
        }>;
      };
      field?: string;
    }>;
  }>;
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
        if (msg.type !== "text" || !msg.text?.body) continue;
        const from = msg.from ?? "";
        const text = msg.text.body.trim();
        if (!from) continue;

        const replyFn = async (replyText: string) => {
          await sendWhatsAppMessage(phoneNumberId, from, replyText);
        };

        try {
          await processIncomingMessage("whatsapp", from, text, replyFn);
        } catch (err) {
          console.error("WhatsApp webhook processIncomingMessage error:", err);
          try {
            await replyFn("Something went wrong. Please try again or contact support.");
          } catch (sendErr) {
            console.error("WhatsApp sendMessage error after failure:", sendErr);
          }
          return NextResponse.json(
            { error: "Processing failed" },
            { status: 500 }
          );
        }
      }
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
