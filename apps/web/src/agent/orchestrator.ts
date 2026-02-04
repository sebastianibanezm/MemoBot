/**
 * MemoBot agent orchestrator: agentic loop with Claude tool-use (PLAN.md Phase 6 RAG).
 */

import Anthropic from "@anthropic-ai/sdk";
import { MEMOBOT_SYSTEM_PROMPT } from "./system-prompt";
import { MEMOBOT_TOOLS } from "./tools";
import { handleToolCall } from "./tool-handlers";
import { RAG_CONTEXT_DEFAULTS } from "../lib/rag-config";

const anthropic = new Anthropic();

export interface ConversationContext {
  userId: string;
  sessionId: string;
  platform: "whatsapp" | "telegram" | "web";
  messageHistory: Array<{ role: "user" | "assistant"; content: string }>;
}

type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: unknown };
type TextBlock = { type: "text"; text: string };
type ToolResultBlock = { type: "tool_result"; tool_use_id: string; content: string };

// SDK expects MessageParam[] with content: string | ContentBlockParam[]; we build compatible messages and cast
type SDKMessageParam = { role: "user" | "assistant"; content: string | unknown[] };

/**
 * Process one user message: run Claude with tools and agentic loop until done.
 */
export async function processMessage(
  userMessage: string,
  context: ConversationContext
): Promise<string> {
  const { userId, sessionId, platform, messageHistory } = context;

  const maxHistory = RAG_CONTEXT_DEFAULTS.maxMessageHistoryForContext;
  const messages: SDKMessageParam[] = [
    ...messageHistory.slice(-maxHistory).map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  let response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: MEMOBOT_SYSTEM_PROMPT,
    tools: MEMOBOT_TOOLS,
    messages: messages as Parameters<Anthropic["messages"]["create"]>[0]["messages"],
  });

  while (response.stop_reason === "tool_use") {
    const assistantContent = response.content;
    const toolUseBlocks = assistantContent.filter(
      (b): b is ToolUseBlock => (b as { type: string }).type === "tool_use"
    );

    const toolResults: ToolResultBlock[] = [];
    for (const block of toolUseBlocks) {
      const result = await handleToolCall(
        block.name,
        (block.input ?? {}) as Record<string, unknown>,
        { userId, sessionId, platform }
      );
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    messages.push({ role: "assistant", content: assistantContent });
    messages.push({ role: "user", content: toolResults });

    response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: MEMOBOT_SYSTEM_PROMPT,
      tools: MEMOBOT_TOOLS,
      messages: messages as Parameters<Anthropic["messages"]["create"]>[0]["messages"],
    });
  }

  const textBlock = response.content.find(
    (b) => (b as { type: string }).type === "text"
  ) as TextBlock | undefined;
  return textBlock?.text?.trim() ?? "I'm not sure how to respond to that.";
}
