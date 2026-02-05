/**
 * Reminder service: CRUD operations and processing for scheduled reminders.
 */

import { createServerSupabase } from "../supabase/server";
import {
  sendReminderNotification,
  NotificationChannel,
  ReminderNotificationData,
  UserNotificationConfig,
  NotificationResult,
} from "./notifications";

export type ReminderStatus = "pending" | "sent" | "failed" | "cancelled";

export interface ReminderRow {
  id: string;
  user_id: string;
  memory_id: string;
  title: string;
  summary: string | null;
  remind_at: string;
  channels: string[];
  status: ReminderStatus;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReminderWithMemory extends ReminderRow {
  memory?: {
    id: string;
    title: string | null;
    content: string;
    summary: string | null;
  };
}

export interface CreateReminderInput {
  userId: string;
  memoryId: string;
  title: string;
  summary?: string | null;
  remindAt: string | Date;
  channels?: NotificationChannel[];
}

export interface UpdateReminderInput {
  title?: string;
  summary?: string | null;
  remindAt?: string | Date;
  channels?: NotificationChannel[];
  status?: ReminderStatus;
}

export interface ListRemindersOptions {
  status?: ReminderStatus | ReminderStatus[];
  upcoming?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Create a new reminder.
 */
export async function createReminder(input: CreateReminderInput): Promise<ReminderRow> {
  const supabase = createServerSupabase();
  
  // Set user context for RLS
  await supabase.rpc("set_current_user_id", { user_id: input.userId });
  
  const remindAt = input.remindAt instanceof Date 
    ? input.remindAt.toISOString() 
    : input.remindAt;

  const { data, error } = await supabase
    .from("reminders")
    .insert({
      user_id: input.userId,
      memory_id: input.memoryId,
      title: input.title,
      summary: input.summary ?? null,
      remind_at: remindAt,
      channels: input.channels ?? ["email"],
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create reminder: ${error.message}`);
  }

  return data as ReminderRow;
}

/**
 * Get a reminder by ID.
 */
export async function getReminderById(
  userId: string,
  reminderId: string
): Promise<ReminderWithMemory | null> {
  const supabase = createServerSupabase();
  
  // Set user context for RLS
  await supabase.rpc("set_current_user_id", { user_id: userId });

  const { data, error } = await supabase
    .from("reminders")
    .select(`
      *,
      memory:memories(id, title, content, summary)
    `)
    .eq("user_id", userId)
    .eq("id", reminderId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to get reminder: ${error.message}`);
  }

  return (data as ReminderWithMemory) ?? null;
}

/**
 * List reminders for a user with optional filtering.
 */
export async function listReminders(
  userId: string,
  options: ListRemindersOptions = {}
): Promise<ReminderWithMemory[]> {
  const supabase = createServerSupabase();
  const { status, upcoming, limit = 50, offset = 0 } = options;

  // Set user context for RLS
  await supabase.rpc("set_current_user_id", { user_id: userId });

  let query = supabase
    .from("reminders")
    .select(`
      *,
      memory:memories(id, title, content, summary)
    `)
    .eq("user_id", userId);

  if (status) {
    if (Array.isArray(status)) {
      query = query.in("status", status);
    } else {
      query = query.eq("status", status);
    }
  }

  if (upcoming) {
    query = query
      .gte("remind_at", new Date().toISOString())
      .eq("status", "pending");
  }

  query = query
    .order("remind_at", { ascending: upcoming ?? true })
    .range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list reminders: ${error.message}`);
  }

  return (data as ReminderWithMemory[]) ?? [];
}

/**
 * Update a reminder.
 */
export async function updateReminder(
  userId: string,
  reminderId: string,
  input: UpdateReminderInput
): Promise<ReminderRow> {
  const supabase = createServerSupabase();

  // Set user context for RLS
  await supabase.rpc("set_current_user_id", { user_id: userId });

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) update.title = input.title;
  if (input.summary !== undefined) update.summary = input.summary;
  if (input.channels !== undefined) update.channels = input.channels;
  if (input.status !== undefined) update.status = input.status;
  if (input.remindAt !== undefined) {
    update.remind_at = input.remindAt instanceof Date 
      ? input.remindAt.toISOString() 
      : input.remindAt;
  }

  const { data, error } = await supabase
    .from("reminders")
    .update(update)
    .eq("user_id", userId)
    .eq("id", reminderId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update reminder: ${error.message}`);
  }

  return data as ReminderRow;
}

/**
 * Delete a reminder.
 */
export async function deleteReminder(
  userId: string,
  reminderId: string
): Promise<void> {
  const supabase = createServerSupabase();

  // Set user context for RLS
  await supabase.rpc("set_current_user_id", { user_id: userId });

  const { error } = await supabase
    .from("reminders")
    .delete()
    .eq("user_id", userId)
    .eq("id", reminderId);

  if (error) {
    throw new Error(`Failed to delete reminder: ${error.message}`);
  }
}

/**
 * Cancel a reminder (soft cancel - sets status to cancelled).
 */
export async function cancelReminder(
  userId: string,
  reminderId: string
): Promise<ReminderRow> {
  return updateReminder(userId, reminderId, { status: "cancelled" });
}

/**
 * Get reminders for a specific memory.
 */
export async function getRemindersForMemory(
  userId: string,
  memoryId: string
): Promise<ReminderRow[]> {
  const supabase = createServerSupabase();

  // Set user context for RLS
  await supabase.rpc("set_current_user_id", { user_id: userId });

  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("user_id", userId)
    .eq("memory_id", memoryId)
    .order("remind_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to get reminders for memory: ${error.message}`);
  }

  return (data as ReminderRow[]) ?? [];
}

/**
 * Process due reminders: find pending reminders that are due and send notifications.
 * This is called by the cron job.
 */
export async function processDueReminders(): Promise<{
  processed: number;
  sent: number;
  failed: number;
  results: Array<{ reminderId: string; notifications: NotificationResult[] }>;
}> {
  const supabase = createServerSupabase();

  // Find all pending reminders that are due
  const { data: dueReminders, error: fetchError } = await supabase
    .from("reminders")
    .select(`
      *,
      memory:memories(id, title, content, summary)
    `)
    .eq("status", "pending")
    .lte("remind_at", new Date().toISOString());

  if (fetchError) {
    throw new Error(`Failed to fetch due reminders: ${fetchError.message}`);
  }

  if (!dueReminders || dueReminders.length === 0) {
    return { processed: 0, sent: 0, failed: 0, results: [] };
  }

  const results: Array<{ reminderId: string; notifications: NotificationResult[] }> = [];
  let sent = 0;
  let failed = 0;

  for (const reminder of dueReminders as ReminderWithMemory[]) {
    try {
      // Get user info for notification config
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("id, email")
        .eq("id", reminder.user_id)
        .single();

      if (userError || !user) {
        console.error(`User not found for reminder ${reminder.id}`);
        failed++;
        continue;
      }

      // Get platform links for WhatsApp/Telegram
      const { data: platformLinks } = await supabase
        .from("platform_links")
        .select("platform, platform_user_id")
        .eq("user_id", reminder.user_id);

      const userConfig: UserNotificationConfig = {
        email: user.email,
      };

      if (platformLinks) {
        for (const link of platformLinks) {
          if (link.platform === "whatsapp") {
            userConfig.whatsappNumber = link.platform_user_id;
          } else if (link.platform === "telegram") {
            userConfig.telegramChatId = link.platform_user_id;
          }
        }
      }

      const notificationData: ReminderNotificationData = {
        reminderTitle: reminder.title,
        reminderSummary: reminder.summary,
        memoryTitle: reminder.memory?.title ?? "Untitled Memory",
        memorySummary: reminder.memory?.summary,
        memoryId: reminder.memory_id,
        remindAt: new Date(reminder.remind_at),
      };

      const channels = reminder.channels as NotificationChannel[];
      const notificationResults = await sendReminderNotification(
        channels,
        userConfig,
        notificationData
      );

      results.push({ reminderId: reminder.id, notifications: notificationResults });

      // Check if any notification succeeded
      const anySuccess = notificationResults.some((r) => r.success);
      const newStatus = anySuccess ? "sent" : "failed";

      // Update reminder status
      await supabase
        .from("reminders")
        .update({
          status: newStatus,
          sent_at: anySuccess ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reminder.id);

      if (anySuccess) {
        sent++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`Error processing reminder ${reminder.id}:`, error);
      failed++;

      // Mark as failed
      await supabase
        .from("reminders")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", reminder.id);
    }
  }

  return {
    processed: dueReminders.length,
    sent,
    failed,
    results,
  };
}
