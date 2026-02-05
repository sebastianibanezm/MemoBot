/**
 * Email service using Resend for sending reminder notifications.
 */

import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export interface ReminderEmailData {
  memoryTitle: string;
  memorySummary?: string | null;
  reminderTitle: string;
  reminderSummary?: string | null;
  remindAt: Date;
  memoryUrl: string;
}

/**
 * Send a reminder notification email.
 */
export async function sendReminderEmail(
  to: string,
  data: ReminderEmailData
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResendClient();
    const fromEmail = process.env.RESEND_FROM_EMAIL || "reminders@memobot.app";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://memobot.app";

    const formattedDate = data.remindAt.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const { error } = await resend.emails.send({
      from: `MemoBot <${fromEmail}>`,
      to: [to],
      subject: `Reminder: ${data.reminderTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>MemoBot Reminder</title>
        </head>
        <body style="font-family: 'IBM Plex Mono', monospace; background-color: #0a0a0a; color: #e8e4db; padding: 40px 20px; margin: 0;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #111; border: 1px solid #00b34a; padding: 30px;">
            <div style="border-bottom: 1px solid #333; padding-bottom: 20px; margin-bottom: 20px;">
              <h1 style="color: #00b34a; font-size: 24px; margin: 0;">MEMOBOT REMINDER</h1>
              <p style="color: #888; font-size: 12px; margin: 5px 0 0 0;">${formattedDate}</p>
            </div>
            
            <div style="margin-bottom: 25px;">
              <h2 style="color: #00b34a; font-size: 18px; margin: 0 0 10px 0;">${escapeHtml(data.reminderTitle)}</h2>
              ${data.reminderSummary ? `<p style="color: #aaa; font-size: 14px; margin: 0; font-style: italic;">${escapeHtml(data.reminderSummary)}</p>` : ""}
            </div>
            
            <div style="background-color: #1a1a1a; border-left: 3px solid #00b34a; padding: 15px; margin-bottom: 25px;">
              <h3 style="color: #e8e4db; font-size: 14px; margin: 0 0 8px 0;">LINKED MEMORY</h3>
              <p style="color: #fff; font-size: 16px; margin: 0 0 5px 0; font-weight: bold;">${escapeHtml(data.memoryTitle)}</p>
              ${data.memorySummary ? `<p style="color: #888; font-size: 13px; margin: 0;">${escapeHtml(data.memorySummary)}</p>` : ""}
            </div>
            
            <div style="text-align: center; padding-top: 20px; border-top: 1px solid #333;">
              <a href="${data.memoryUrl}" style="display: inline-block; background-color: #00b34a; color: #000; text-decoration: none; padding: 12px 30px; font-weight: bold; font-size: 14px;">VIEW MEMORY</a>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #333; text-align: center;">
              <p style="color: #555; font-size: 11px; margin: 0;">
                This reminder was sent by MemoBot. <a href="${appUrl}/dashboard/reminders" style="color: #00b34a;">Manage your reminders</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
MemoBot Reminder
${formattedDate}

${data.reminderTitle}
${data.reminderSummary || ""}

LINKED MEMORY:
${data.memoryTitle}
${data.memorySummary || ""}

View memory: ${data.memoryUrl}
      `.trim(),
    });

    if (error) {
      console.error("Resend email error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Email send error:", message);
    return { success: false, error: message };
  }
}

/**
 * Escape HTML special characters to prevent XSS.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
