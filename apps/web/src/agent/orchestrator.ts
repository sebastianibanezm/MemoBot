/**
 * MemoBot agent orchestrator: agentic loop with OpenAI tool-use.
 */

import OpenAI from "openai";
import { MEMOBOT_SYSTEM_PROMPT } from "./system-prompt";
import { MEMOBOT_TOOLS } from "./tools";
import { handleToolCall } from "./tool-handlers";
import { RAG_CONTEXT_DEFAULTS } from "../lib/rag-config";
import { createServerSupabase } from "../lib/supabase/server";

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
  const { userId, sessionId, platform, messageHistory, buttonId, attachment } = context;
  
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
  const tools = convertToolsToOpenAI();

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

  let response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1024,
    messages,
    tools,
    tool_choice: "auto",
  });

  let assistantMessage = response.choices[0]?.message;
  
  // Track retrieved memories from search_memories calls
  const retrievedMemories: RetrievedMemory[] = [];
  
  // Track created memory from finalize_memory calls
  let createdMemory: RetrievedMemory | null = null;
  
  // Track suggested buttons from the last tool call that provided them
  let suggestedButtons: SuggestedButton[] | undefined;

  // Agentic loop: process tool calls until done
  while (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
    // Add assistant message with tool calls to history
    messages.push(assistantMessage);

    // Process each tool call
    for (const toolCall of assistantMessage.tool_calls) {
      // Handle function tool calls
      if (toolCall.type !== "function") continue;
      
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

      // Capture memories from search_memories tool calls
      if (toolName === "search_memories" && result && typeof result === "object") {
        const searchResult = result as { memories?: RetrievedMemory[] };
        if (searchResult.memories && Array.isArray(searchResult.memories)) {
          for (const memory of searchResult.memories) {
            // Avoid duplicates
            if (!retrievedMemories.some(m => m.id === memory.id)) {
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
          memory?: { id: string; title: string; content_preview: string } 
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

    // Continue the conversation
    response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1024,
      messages,
      tools,
      tool_choice: "auto",
    });

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
