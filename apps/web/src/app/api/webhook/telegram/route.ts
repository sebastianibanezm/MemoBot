/**
 * Telegram Bot webhook (PLAN.md Phase 4).
 * POST /api/webhook/telegram — verify secret, parse Update, run message router, reply via sendMessage.
 */

import { NextRequest, NextResponse } from "next/server";
import { processIncomingMessage } from "@/lib/message-router";

const TELEGRAM_API = "https://api.telegram.org";

function getEnv(name: string): string | undefined {
  return process.env[name];
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

/**
 * Send a text message to a Telegram chat via Bot API.
 */
async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const token = getEnv("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");
  const url = `${TELEGRAM_API}/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram sendMessage failed: ${res.status} ${err}`);
  }
}

/** Telegram Update payload (subset we use). */
interface TelegramUpdate {
  update_id?: number;
  message?: {
    message_id?: number;
    from?: { id: number; first_name?: string; username?: string };
    chat?: { id: number; type?: string };
    text?: string;
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

  const message = body.message;
  if (!message?.chat?.id || message.from?.id == null) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const text = message.text?.trim();
  const chatId = message.chat.id;
  const fromId = String(message.from.id);

  const replyFn = async (replyText: string) => {
    await sendTelegramMessage(chatId, replyText);
  };

  if (!text) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  try {
    await processIncomingMessage("telegram", fromId, text, replyFn);
  } catch (err) {
    console.error("Telegram webhook processIncomingMessage error:", err);
    try {
      await replyFn(
        "Something went wrong. Please try again or contact support."
      );
    } catch (sendErr) {
      console.error("Telegram sendMessage error after failure:", sendErr);
    }
    return NextResponse.json(
      { error: "Processing failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
