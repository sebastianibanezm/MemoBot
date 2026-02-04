#!/usr/bin/env node
/**
 * Set Telegram webhook URL. Usage: node scripts/set-telegram-webhook.mjs <public_base_url>
 * Reads TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET from .env.local
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env.local");

const env = {};
fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
});

const token = env.TELEGRAM_BOT_TOKEN;
const secret = env.TELEGRAM_WEBHOOK_SECRET;
const baseUrl = process.argv[2] || "https://elaina-nonseparable-complexionally.ngrok-free.dev";
const url = `${baseUrl.replace(/\/$/, "")}/api/webhook/telegram`;

if (!token || !secret) {
  console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_WEBHOOK_SECRET in .env.local");
  process.exit(1);
}

const body = new URLSearchParams({ url, secret_token: secret }).toString();
const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body,
});
const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  console.error("Telegram API returned non-JSON:", text.slice(0, 200));
  process.exit(1);
}
if (json.ok) {
  console.log("Webhook set successfully:", url);
} else {
  console.error("Telegram API error:", json);
  process.exit(1);
}
