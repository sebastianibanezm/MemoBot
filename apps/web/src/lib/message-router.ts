/**
 * Message router: LINK command detection, unlinked welcome, then agent.
 * Used by Telegram/WhatsApp webhook handlers (Phase 4+).
 * PLAN.md Phase 3.
 */

import { verifyAndLinkAccount, resolveUserFromPlatform } from "./services/account-linking";
import { getOrCreateSession, updateSessionHistory } from "./services/session";
import { processMessage } from "@/agent/orchestrator";
import type { Platform } from "./services/account-linking";
import type { AttachmentRow } from "./services/attachment";

/** Options for rich replies (buttons only supported on WhatsApp) */
export interface ReplyOptions {
  buttons?: Array<{ id: string; title: string }>;
}

export type ReplyFn = (message: string, options?: ReplyOptions) => Promise<void>;

/** Attachment info passed from webhook handlers */
export interface AttachmentInfo {
  id: string;
  fileName: string;
  fileType: string;
  extractedContent: string | null;
}

/**
 * Process an incoming message from a messaging platform.
 * 1. If text is "LINK 123456", verify code and link account → reply with result.
 * 2. Else resolve user from platform_links; if unlinked → reply with welcome + instructions.
 * 3. Else get/create session, run agent, update history, reply with response.
 * 
 * @param buttonId - Optional button ID if user clicked an interactive button (WhatsApp only)
 * @param attachment - Optional attachment uploaded with the message
 */
export async function processIncomingMessage(
  platform: Platform,
  platformUserId: string,
  text: string,
  replyFn: ReplyFn,
  buttonId?: string,
  attachment?: AttachmentRow
): Promise<void> {
  const trimmedText = text.trim();

  const linkMatch = trimmedText.match(/^LINK\s+(\d{6})$/i);
  if (linkMatch) {
    const result = await verifyAndLinkAccount(
      platform,
      platformUserId,
      linkMatch[1]
    );
    await replyFn(result.message);
    return;
  }

  const userId = await resolveUserFromPlatform(platform, platformUserId);
  if (!userId) {
    const platformName =
      platform === "whatsapp" ? "WhatsApp" : "Telegram";
    await replyFn(
      "👋 Welcome to MemoBot!\n\n" +
        "I can help you capture and recall your memories. To get started, link your account:\n\n" +
        "1. Sign up at the MemoBot web dashboard\n" +
        "2. Go to Settings → Link " +
        platformName +
        "\n" +
        "3. Send the 6-digit code here\n\n" +
        "Example: LINK 123456"
    );
    return;
  }

  const { sessionId, session } = await getOrCreateSession(
    userId,
    platform,
    platformUserId
  );
  const messageHistory = (session.message_history ?? []) as Array<{
    role: "user" | "assistant";
    content: string;
  }>;

  // Convert attachment to info format for orchestrator
  const attachmentInfo: AttachmentInfo | undefined = attachment
    ? {
        id: attachment.id,
        fileName: attachment.file_name,
        fileType: attachment.file_type,
        extractedContent: attachment.extracted_content,
      }
    : undefined;

  const result = await processMessage(trimmedText, {
    userId,
    sessionId,
    platform,
    messageHistory,
    buttonId,  // Pass button ID to orchestrator
    attachment: attachmentInfo,  // Pass attachment info to orchestrator
  });

  await updateSessionHistory(sessionId, [
    { role: "user", content: trimmedText },
    { role: "assistant", content: result.reply },
  ]);

  // Pass suggested buttons to reply (only works on WhatsApp)
  await replyFn(result.reply, {
    buttons: platform === "whatsapp" ? result.suggestedButtons : undefined,
  });
}
