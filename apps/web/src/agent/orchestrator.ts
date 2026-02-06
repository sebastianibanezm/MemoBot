/**
 * MemoBot agent orchestrator: agentic loop with OpenAI tool-use.
 */

import OpenAI from "openai";
import { MEMOBOT_SYSTEM_PROMPT } from "./system-prompt";
import { MEMOBOT_TOOLS } from "./tools";
import { handleToolCall } from "./tool-handlers";
import { RAG_CONTEXT_DEFAULTS } from "../lib/rag-config";
import { createServerSupabase } from "../lib/supabase/server";
import { timed } from "../lib/timing";

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Please add it to your .env.local file."
    );
  }
  return new OpenAI({ apiKey });
}

// Convert our tool format to OpenAI's function format
function convertToolsToOpenAI(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return MEMOBOT_TOOLS.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description || "",
      parameters: {
        type: "object",
        properties: tool.input_schema.properties || {},
        required: tool.input_schema.required || [],
      },
    },
  }));
}

// Pre-compute OpenAI tools at module load time for efficiency
const OPENAI_TOOLS = convertToolsToOpenAI();

/**
 * Determine if a query is simple enough for a faster/smaller model.
 * Simple queries: button clicks, confirmations, short follow-ups.
 */
function shouldUseFastModel(
  message: string,
  messageHistory: Array<{ role: "user" | "assistant"; content: string }>,
  buttonId?: string
): boolean {
  // Button clicks are predetermined flows - use fast model
  if (buttonId) {
    return true;
  }

  const trimmed = message.trim();
  const wordCount = trimmed.split(/\s+/).length;

  // Very short messages (1-3 words) during ongoing conversation
  if (wordCount <= 3 && messageHistory.length > 0) {
    return true;
  }

  // Confirmation patterns
  const confirmationPatterns = [
    /^(yes|no|yep|nope|yeah|nah|sure|ok|okay|done|save|cancel|skip)\.?$/i,
    /^(save it|looks good|that's right|that's correct|perfect|great)\.?$/i,
    /^(go ahead|confirm|approved|yes please|no thanks)\.?$/i,
  ];

  if (confirmationPatterns.some((p) => p.test(trimmed))) {
    return true;
  }

  // Short additions during memory capture (less than 10 words, likely answering a question)
  if (wordCount <= 10 && messageHistory.length >= 2) {
    const lastAssistantMessage = messageHistory
      .slice()
      .reverse()
      .find((m) => m.role === "assistant");

    // If last assistant message asked a question, this is likely a simple answer
    if (lastAssistantMessage?.content?.includes("?")) {
      return true;
    }
  }

  return false;
}

/** Attachment info passed to the orchestrator */
export interface AttachmentInfo {
  id: string;
  fileName: string;
  fileType: string;
  extractedContent: string | null;
}

export interface ConversationContext {
  userId: string;
  sessionId: string;
  platform: "whatsapp" | "telegram" | "web";
  messageHistory: Array<{ role: "user" | "assistant"; content: string }>;
  buttonId?: string;  // Button ID if user clicked an interactive button (WhatsApp only)
  attachment?: AttachmentInfo;  // Attachment info if user sent a file
  isForwarded?: boolean;  // True if message was forwarded (Telegram/WhatsApp)
}

export interface RetrievedMemory {
  id: string;
  title: string | null;
  content_preview: string;
}

/** Button suggestion from tool handlers */
export interface SuggestedButton {
  id: string;
  title: string;
}

export interface ProcessMessageResult {
  reply: string;
  retrievedMemories: RetrievedMemory[];
  createdMemory: RetrievedMemory | null;
  suggestedButtons?: SuggestedButton[];
}

/**
 * Process one user message: run OpenAI with tools and agentic loop until done.
 */
export async function processMessage(
  userMessage: string,
  context: ConversationContext
): Promise<ProcessMessageResult> {
  const { userId, sessionId, platform, messageHistory, buttonId, attachment, isForwarded } = context;

  // === FORWARDED MESSAGE HANDLING (bypass LLM for instant save) ===
  if (isForwarded && userMessage.trim().length > 0) {
    console.log("[orchestrator] Forwarded message detected, using quick save");
    
    const supabase = createServerSupabase();
    
    // Set session to MEMORY_DRAFT with quick_save flag
    await supabase
      .from("conversation_sessions")
      .update({
        current_state: "MEMORY_DRAFT",
        memory_draft: {
          content_parts: [userMessage],
          started_at: new Date().toISOString(),
          enrichment_count: 0,
          quick_save: true,
          forwarded: true,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    // Directly call the tool handlers to generate draft + finalize
    const toolContext = { userId, sessionId, platform, attachmentId: attachment?.id };
    
    const draftResult = await handleToolCall("generate_memory_draft", { request_confirmation: false }, toolContext);
    
    if (draftResult && typeof draftResult === "object" && "error" in draftResult) {
      return {
        reply: "I couldn't save that forwarded message. Please try again.",
        retrievedMemories: [],
        createdMemory: null,
        suggestedButtons: [{ id: "new_memory", title: "New Memory" }],
      };
    }
    
    const finalizeResult = await handleToolCall("finalize_memory", {}, toolContext) as {
      status?: string;
      memory?: { id: string; title: string; category?: string; tags?: string[] };
    };
    
    if (finalizeResult?.status === "memory_saved" && finalizeResult.memory) {
      const memory = finalizeResult.memory;
      return {
        reply: `📌 Saved forwarded message!\n\n*${memory.title}*\nCategory: ${memory.category || "General"}\nTags: ${memory.tags?.join(", ") || "none"}`,
        retrievedMemories: [],
        createdMemory: {
          id: memory.id,
          title: memory.title,
          content_preview: userMessage.slice(0, 200),
        },
        suggestedButtons: [{ id: "new_memory", title: "New Memory" }],
      };
    }
    
    return {
      reply: "I saved your forwarded message! ✅",
      retrievedMemories: [],
      createdMemory: null,
      suggestedButtons: [{ id: "new_memory", title: "New Memory" }],
    };
  }

  // === QUICK RESPONSE PATTERNS (bypass LLM for common messages) ===
  // Only apply for messages without attachments or button clicks
  if (!attachment && !buttonId) {
    const normalizedMessage = userMessage.toLowerCase().trim();

    // Quick responses for greetings (only when no prior context)
    const GREETING_RESPONSES: Record<string, string> = {
      "hi": "Hi! How can I help you today? Tap 'New Memory' to save something, or just tell me what's on your mind.",
      "hello": "Hello! How can I help you today? Tap 'New Memory' to save something, or just tell me what's on your mind.",
      "hey": "Hey! How can I help you today? Tap 'New Memory' to save something, or just tell me what's on your mind.",
      "hola": "Hola! How can I help you today? Tap 'New Memory' to save something, or just tell me what's on your mind.",
      "good morning": "Good morning! How can I help you today?",
      "good afternoon": "Good afternoon! How can I help you today?",
      "good evening": "Good evening! How can I help you today?",
    };

    // Quick responses for thank you / goodbye (any context)
    const UNIVERSAL_RESPONSES: Record<string, string> = {
      "thanks": "You're welcome! Let me know if you need anything else.",
      "thank you": "You're welcome! Let me know if you need anything else.",
      "thanks!": "You're welcome! Let me know if you need anything else.",
      "thank you!": "You're welcome! Let me know if you need anything else.",
      "thx": "You're welcome! Let me know if you need anything else.",
      "ty": "You're welcome! Let me know if you need anything else.",
      "bye": "Goodbye! Your memories are safe with me. Come back anytime!",
      "goodbye": "Goodbye! Your memories are safe with me. Come back anytime!",
      "ok": "Got it! Let me know if there's anything else.",
      "okay": "Got it! Let me know if there's anything else.",
      "cool": "Great! Let me know if you need anything else.",
      "nice": "Glad I could help! Anything else?",
    };

    // Check universal responses first (work in any context)
    if (UNIVERSAL_RESPONSES[normalizedMessage]) {
      return {
        reply: UNIVERSAL_RESPONSES[normalizedMessage],
        retrievedMemories: [],
        createdMemory: null,
        suggestedButtons: [{ id: "new_memory", title: "New Memory" }],
      };
    }

    // Check greeting responses only for first message (no history)
    if (messageHistory.length === 0 && GREETING_RESPONSES[normalizedMessage]) {
      return {
        reply: GREETING_RESPONSES[normalizedMessage],
        retrievedMemories: [],
        createdMemory: null,
        suggestedButtons: [{ id: "new_memory", title: "New Memory" }],
      };
    }
  }
  // === END QUICK RESPONSE PATTERNS ===

  // Map button IDs to commands the agent understands
  let effectiveMessage = userMessage;
  
  // If there's an attachment, include its context in the message
  if (attachment) {
    const attachmentContext = attachment.extractedContent
      ? `\n\n[Attached file: "${attachment.fileName}" (${attachment.fileType}). Extracted content: ${attachment.extractedContent}]`
      : `\n\n[Attached file: "${attachment.fileName}" (${attachment.fileType})]`;
    effectiveMessage = userMessage + attachmentContext;
  }
  
  if (buttonId === "save_memory") {
    effectiveMessage = "Save it";
  } else if (buttonId === "create_reminder") {
    // Fetch the last created memory ID from the session to ensure correct reminder creation
    const supabase = createServerSupabase();
    const { data: session } = await supabase
      .from("conversation_sessions")
      .select("memory_draft")
      .eq("id", sessionId)
      .single();
    
    const draft = session?.memory_draft as { last_created_memory_id?: string; last_created_memory_title?: string } | null;
    if (draft?.last_created_memory_id) {
      effectiveMessage = `Yes, create a reminder for the memory I just saved. The memory ID is ${draft.last_created_memory_id} and the title is "${draft.last_created_memory_title || 'Untitled'}".`;
      console.log(`[orchestrator] create_reminder button clicked for memory: ${draft.last_created_memory_id}`);
    } else {
      effectiveMessage = "Yes, create a reminder for this memory";
    }
  } else if (buttonId === "new_memory") {
    effectiveMessage = "I want to create a new memory";
  }

  const openai = getOpenAIClient();

  const maxHistory = RAG_CONTEXT_DEFAULTS.maxMessageHistoryForContext;
  
  // Filter and sanitize message history to ensure all content is a valid string
  // Skip any entries where content is not a string (corrupted from previous bug)
  const sanitizedHistory = messageHistory
    .slice(-maxHistory)
    .filter((m) => 
      (m.role === "user" || m.role === "assistant") && 
      typeof m.content === "string" && 
      m.content.trim().length > 0
    )
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
  
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: MEMOBOT_SYSTEM_PROMPT },
    ...sanitizedHistory,
    { role: "user", content: effectiveMessage },
  ];

  // Smart model routing: use gpt-4o-mini for simple interactions
  const useFastModel = shouldUseFastModel(effectiveMessage, messageHistory, buttonId);
  const selectedModel = useFastModel ? "gpt-4o-mini" : "gpt-4o";

  let response = await timed(`openai.chat.${selectedModel}`, () =>
    openai.chat.completions.create({
      model: selectedModel,
      max_tokens: 1024,
      messages,
      tools: OPENAI_TOOLS,
      tool_choice: "auto",
    })
  );

  let assistantMessage = response.choices[0]?.message;
  
  // Track retrieved memories from search_memories calls
  const retrievedMemories: RetrievedMemory[] = [];
  
  // Track created memory from finalize_memory calls
  let createdMemory: RetrievedMemory | null = null;
  
  // Track suggested buttons from the last tool call that provided them
  let suggestedButtons: SuggestedButton[] | undefined;

  // Agentic loop: process tool calls until done (PARALLELIZED)
  while (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
    // Add assistant message with tool calls to history
    messages.push(assistantMessage);

    // Process all tool calls in parallel
    const toolCallPromises = assistantMessage.tool_calls
      .filter((toolCall) => toolCall.type === "function")
      .map(async (toolCall) => {
        const functionCall = toolCall as OpenAI.Chat.Completions.ChatCompletionMessageToolCall & {
          type: "function";
          function: { name: string; arguments: string };
        };

        const toolName = functionCall.function.name;
        let toolInput: Record<string, unknown> = {};

        try {
          toolInput = JSON.parse(functionCall.function.arguments || "{}");
        } catch {
          toolInput = {};
        }

        const result = await handleToolCall(toolName, toolInput, {
          userId,
          sessionId,
          platform,
          attachmentId: attachment?.id,
        });

        return {
          toolCall,
          toolName,
          result,
        };
      });

    // Wait for all tool calls to complete
    const toolResults = await Promise.all(toolCallPromises);

    // Process results and update tracking variables
    for (const { toolCall, toolName, result } of toolResults) {
      // Capture memories from search_memories tool calls
      if (toolName === "search_memories" && result && typeof result === "object") {
        const searchResult = result as { memories?: RetrievedMemory[] };
        if (searchResult.memories && Array.isArray(searchResult.memories)) {
          for (const memory of searchResult.memories) {
            if (!retrievedMemories.some((m) => m.id === memory.id)) {
              retrievedMemories.push({
                id: memory.id,
                title: memory.title,
                content_preview: memory.content_preview,
              });
            }
          }
        }
      }

      // Capture created memory from finalize_memory tool calls
      if (toolName === "finalize_memory" && result && typeof result === "object") {
        const finalizeResult = result as {
          status?: string;
          memory?: { id: string; title: string; content_preview: string };
        };
        if (finalizeResult.status === "memory_saved" && finalizeResult.memory) {
          createdMemory = {
            id: finalizeResult.memory.id,
            title: finalizeResult.memory.title,
            content_preview: finalizeResult.memory.content_preview,
          };
        }
      }

      // Capture suggested buttons from any tool result
      if (result && typeof result === "object") {
        const resultWithButtons = result as { suggested_buttons?: SuggestedButton[] };
        if (resultWithButtons.suggested_buttons && Array.isArray(resultWithButtons.suggested_buttons)) {
          suggestedButtons = resultWithButtons.suggested_buttons;
        }
      }

      // Add tool result to messages
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }

    // Continue the conversation with the same model for consistency
    response = await timed(`openai.chat.${selectedModel}.continue`, () =>
      openai.chat.completions.create({
        model: selectedModel,
        max_tokens: 1024,
        messages,
        tools: OPENAI_TOOLS,
        tool_choice: "auto",
      })
    );

    assistantMessage = response.choices[0]?.message;
  }

  // Default to "New Memory" button for conversational responses (greetings, search results, etc.)
  // This gives users an easy way to start creating a memory at any time
  const finalButtons = suggestedButtons ?? [{ id: "new_memory", title: "New Memory" }];

  return {
    reply: assistantMessage?.content?.trim() ?? "I'm not sure how to respond to that.",
    retrievedMemories,
    createdMemory,
    suggestedButtons: finalButtons,
  };
}
