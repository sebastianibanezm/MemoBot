/**
 * MemoBot agent orchestrator: agentic loop with OpenAI tool-use.
 */

import OpenAI from "openai";
import { MEMOBOT_SYSTEM_PROMPT } from "./system-prompt";
import { MEMOBOT_TOOLS } from "./tools";
import { handleToolCall } from "./tool-handlers";
import { RAG_CONTEXT_DEFAULTS } from "../lib/rag-config";

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

export interface ConversationContext {
  userId: string;
  sessionId: string;
  platform: "whatsapp" | "telegram" | "web";
  messageHistory: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface RetrievedMemory {
  id: string;
  title: string | null;
  content_preview: string;
}

export interface ProcessMessageResult {
  reply: string;
  retrievedMemories: RetrievedMemory[];
  createdMemory: RetrievedMemory | null;
}

/**
 * Process one user message: run OpenAI with tools and agentic loop until done.
 */
export async function processMessage(
  userMessage: string,
  context: ConversationContext
): Promise<ProcessMessageResult> {
  const { userId, sessionId, platform, messageHistory } = context;

  const openai = getOpenAIClient();
  const tools = convertToolsToOpenAI();

  const maxHistory = RAG_CONTEXT_DEFAULTS.maxMessageHistoryForContext;
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: MEMOBOT_SYSTEM_PROMPT },
    ...messageHistory.slice(-maxHistory).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
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

  return {
    reply: assistantMessage?.content?.trim() ?? "I'm not sure how to respond to that.",
    retrievedMemories,
    createdMemory,
  };
}
