/**
 * Unified notification service for sending reminders across multiple channels.
 * Supports WhatsApp, Telegram, and Email.
 */

import { sendReminderEmail, ReminderEmailData } from "./email";

const GRAPH_API = "https://graph.facebook.com/v21.0";
const TELEGRAM_API = "https://api.telegram.org";

export type NotificationChannel = "whatsapp" | "telegram" | "email";

export interface ReminderNotificationData {
  reminderTitle: string;
  reminderSummary?: string | null;
  memoryTitle: string;
  memorySummary?: string | null;
  memoryId: string;
  remindAt: Date;
}

export interface UserNotificationConfig {
  email?: string | null;
  whatsappNumber?: string | null;
  telegramChatId?: string | null;
}

export interface NotificationResult {
  channel: NotificationChannel;
  success: boolean;
  error?: string;
}

/**
 * Send a WhatsApp message for a reminder.
 */
async function sendWhatsAppReminder(
  to: string,
  data: ReminderNotificationData
): Promise<NotificationResult> {
  try {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneNumberId) {
      return { channel: "whatsapp", success: false, error: "WhatsApp not configured" };
    }

    const formattedDate = data.remindAt.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const message = `🔔 *MEMOBOT REMINDER*\n\n*${data.reminderTitle}*\n${data.reminderSummary ? `\n${data.reminderSummary}\n` : ""}\n📝 Memory: ${data.memoryTitle}\n⏰ ${formattedDate}`;

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
        text: { body: message },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { channel: "whatsapp", success: false, error: `API error: ${res.status} ${err}` };
    }

    return { channel: "whatsapp", success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { channel: "whatsapp", success: false, error: message };
  }
}

/**
 * Send a Telegram message for a reminder.
 */
async function sendTelegramReminder(
  chatId: string,
  data: ReminderNotificationData
): Promise<NotificationResult> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return { channel: "telegram", success: false, error: "Telegram not configured" };
    }

    const formattedDate = data.remindAt.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const message = `🔔 *MEMOBOT REMINDER*\n\n*${escapeMarkdown(data.reminderTitle)}*\n${data.reminderSummary ? `\n${escapeMarkdown(data.reminderSummary)}\n` : ""}\n📝 Memory: ${escapeMarkdown(data.memoryTitle)}\n⏰ ${formattedDate}`;

    const url = `${TELEGRAM_API}/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { channel: "telegram", success: false, error: `API error: ${res.status} ${err}` };
    }

    return { channel: "telegram", success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { channel: "telegram", success: false, error: message };
  }
}

/**
 * Send an email for a reminder.
 */
async function sendEmailReminder(
  to: string,
  data: ReminderNotificationData
): Promise<NotificationResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://memobot.app";
  const memoryUrl = `${appUrl}/dashboard/memories/${data.memoryId}`;

  const emailData: ReminderEmailData = {
    memoryTitle: data.memoryTitle,
    memorySummary: data.memorySummary,
    reminderTitle: data.reminderTitle,
    reminderSummary: data.reminderSummary,
    remindAt: data.remindAt,
    memoryUrl,
  };

  const result = await sendReminderEmail(to, emailData);

  return {
    channel: "email",
    success: result.success,
    error: result.error,
  };
}

/**
 * Send a reminder notification through all specified channels.
 */
export async function sendReminderNotification(
  channels: NotificationChannel[],
  userConfig: UserNotificationConfig,
  data: ReminderNotificationData
): Promise<NotificationResult[]> {
  const results: NotificationResult[] = [];

  const promises = channels.map(async (channel) => {
    switch (channel) {
      case "whatsapp":
        if (userConfig.whatsappNumber) {
          return sendWhatsAppReminder(userConfig.whatsappNumber, data);
        }
        return { channel, success: false, error: "No WhatsApp number linked" };

      case "telegram":
        if (userConfig.telegramChatId) {
          return sendTelegramReminder(userConfig.telegramChatId, data);
        }
        return { channel, success: false, error: "No Telegram chat linked" };

      case "email":
        if (userConfig.email) {
          return sendEmailReminder(userConfig.email, data);
        }
        return { channel, success: false, error: "No email address" };

      default:
        return { channel, success: false, error: "Unknown channel" };
    }
  });

  const settledResults = await Promise.all(promises);
  results.push(...settledResults);

  return results;
}

/**
 * Escape special Markdown characters for Telegram.
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}
