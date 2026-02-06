/**
 * Daily Digest Service: sends nightly prompts to users encouraging them to capture memories.
 * Called by the cron endpoint.
 */

import { createServerSupabase } from "../supabase/server";

// Rotating prompt messages to keep the digest feeling fresh
const DIGEST_PROMPTS = [
  "Hey! 👋 Anything worth remembering from today? A conversation, a meal, a thought, an idea? Just tell me and I'll save it.",
  "End of day check-in! 🌙 What happened today that you'd want to remember later? Big or small, I'll capture it for you.",
  "Hi! What was the highlight of your day? 🌟 Even a quick note helps — I'll take care of organizing it.",
  "Before the day wraps up — any moments, ideas, or plans worth saving? Just share and I'll do the rest. 📝",
  "Hey! Did anything interesting happen today? 🤔 A decision you made, something you learned, or a plan that took shape? Tell me!",
  "Quick check: anything you'd hate to forget from today? A name, a date, an experience? Send it over! 💡",
  "Evening! 🌆 What's one thing from today worth holding onto? I'm here to help you remember.",
];

interface UserDueForDigest {
  userId: string;
  platforms: Array<{ platform: string; platformUserId: string }>;
  consecutiveIgnores: number;
}

/**
 * Get users who are due for a daily digest right now.
 * Looks for users where:
 * - daily_digest_enabled = true
 * - current time in their timezone matches their daily_digest_time (within 5 min window)
 * - last_sent is either null or more than 20 hours ago (prevents double-sends)
 * - consecutive_ignores < 7 (back off after a week of ignoring)
 */
export async function getUsersDueForDigest(): Promise<UserDueForDigest[]> {
  const supabase = createServerSupabase();
  
  // Get all users with digest enabled
  const { data: settings, error } = await supabase
    .from("user_settings")
    .select("user_id, daily_digest_time, daily_digest_timezone, daily_digest_last_sent, daily_digest_consecutive_ignores")
    .eq("daily_digest_enabled", true)
    .lt("daily_digest_consecutive_ignores", 7); // Stop after 7 consecutive ignores
  
  if (error || !settings) {
    console.error("[daily-digest] Failed to fetch settings:", error?.message);
    return [];
  }
  
  const now = new Date();
  const dueUsers: UserDueForDigest[] = [];
  
  for (const setting of settings) {
    // Check if enough time has passed since last send (20h buffer)
    if (setting.daily_digest_last_sent) {
      const lastSent = new Date(setting.daily_digest_last_sent);
      const hoursSinceLast = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLast < 20) continue;
    }
    
    // Check if current time in user's timezone matches their preferred time (±5 min)
    try {
      const userNow = new Date(now.toLocaleString("en-US", { timeZone: setting.daily_digest_timezone || "UTC" }));
      const [targetHour, targetMinute] = (setting.daily_digest_time || "20:00").split(":").map(Number);
      const userMinutes = userNow.getHours() * 60 + userNow.getMinutes();
      const targetMinutes = targetHour * 60 + targetMinute;
      
      if (Math.abs(userMinutes - targetMinutes) > 5) continue;
    } catch {
      // Invalid timezone, skip
      continue;
    }
    
    // Get platform links for this user
    const { data: links } = await supabase
      .from("platform_links")
      .select("platform, platform_user_id")
      .eq("user_id", setting.user_id);
    
    if (!links || links.length === 0) continue;
    
    dueUsers.push({
      userId: setting.user_id,
      platforms: links.map(l => ({ platform: l.platform, platformUserId: l.platform_user_id })),
      consecutiveIgnores: setting.daily_digest_consecutive_ignores ?? 0,
    });
  }
  
  return dueUsers;
}

/**
 * Get a digest prompt, varying based on consecutive ignores.
 */
export function getDigestPrompt(consecutiveIgnores: number): string {
  // Use a random prompt, but could be smarter based on ignore count
  const index = Math.floor(Math.random() * DIGEST_PROMPTS.length);
  return DIGEST_PROMPTS[index];
}

/**
 * Send digest notifications to a user on all their linked platforms.
 */
export async function sendDigestToUser(
  userId: string,
  platforms: Array<{ platform: string; platformUserId: string }>,
  prompt: string
): Promise<{ sent: boolean; channels: string[] }> {
  const sentChannels: string[] = [];
  
  for (const { platform, platformUserId } of platforms) {
    try {
      if (platform === "whatsapp") {
        const token = process.env.WHATSAPP_ACCESS_TOKEN;
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        if (token && phoneNumberId) {
          const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: platformUserId.replace(/\D/g, ""),
              type: "text",
              text: { body: prompt },
            }),
          });
          if (res.ok) {
            sentChannels.push("whatsapp");
          } else {
            console.error(`[daily-digest] WhatsApp send failed for ${userId}:`, await res.text());
          }
        }
      } else if (platform === "telegram") {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (token) {
          const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: platformUserId,
              text: prompt,
            }),
          });
          if (res.ok) {
            sentChannels.push("telegram");
          } else {
            console.error(`[daily-digest] Telegram send failed for ${userId}:`, await res.text());
          }
        }
      }
    } catch (err) {
      console.error(`[daily-digest] Failed to send to ${platform} for user ${userId}:`, err);
    }
  }
  
  return { sent: sentChannels.length > 0, channels: sentChannels };
}

/**
 * Process all due daily digests. Called by the cron endpoint.
 */
export async function processDailyDigests(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const supabase = createServerSupabase();
  const dueUsers = await getUsersDueForDigest();
  
  let sent = 0;
  let failed = 0;
  
  for (const user of dueUsers) {
    const prompt = getDigestPrompt(user.consecutiveIgnores);
    const result = await sendDigestToUser(user.userId, user.platforms, prompt);
    
    if (result.sent) {
      sent++;
      // Update last_sent timestamp and increment consecutive ignores
      // (ignores will be reset to 0 when user sends a message)
      await supabase
        .from("user_settings")
        .update({
          daily_digest_last_sent: new Date().toISOString(),
          daily_digest_consecutive_ignores: user.consecutiveIgnores + 1,
        })
        .eq("user_id", user.userId);
    } else {
      failed++;
    }
  }
  
  return { processed: dueUsers.length, sent, failed };
}
