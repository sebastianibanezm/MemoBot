/**
 * MemoBot agent tools in Claude tool-use format (PLAN.md).
 */

export interface MemoBotTool {
  name: string;
  description?: string;
  input_schema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export const MEMOBOT_TOOLS: MemoBotTool[] = [
  // ========== SEARCH & RETRIEVAL ==========
  {
    name: "search_memories",
    description:
      "Search the user's memories using natural language. Returns relevant memories with their content, category, and tags. Use when the user asks about past memories or wants to recall something.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural language search query describing what to find",
        },
        limit: {
          type: "number",
          description: "Maximum number of memories to return (default: 5, max: 10)",
        },
        include_related: {
          type: "boolean",
          description: "Whether to include related memories (2-degree network). Default: true",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_memory_by_id",
    description: "Retrieve a specific memory by its ID. Use when you need full details of a known memory.",
    input_schema: {
      type: "object",
      properties: {
        memory_id: {
          type: "string",
          description: "UUID of the memory to retrieve",
        },
      },
      required: ["memory_id"],
    },
  },
  {
    name: "list_recent_memories",
    description:
      "List the user's most recent memories. Use when user asks 'what have I saved recently?' or similar.",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of memories to return (default: 5, max: 20)",
        },
        category: {
          type: "string",
          description: "Optional: filter by category name",
        },
      },
      required: [],
    },
  },
  {
    name: "list_categories",
    description:
      "List all categories the user has. Use when user asks about their categories or how memories are organized.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_tags",
    description: "List all tags the user has, optionally filtered. Use when user asks about their tags.",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of tags to return (default: 20)",
        },
      },
      required: [],
    },
  },
  // ========== MEMORY CREATION ==========
  {
    name: "start_memory_capture",
    description:
      "Begin the memory creation flow. Call this when user wants to create a new memory. Returns a session ID for the memory draft.",
    input_schema: {
      type: "object",
      properties: {
        initial_content: {
          type: "string",
          description: "Optional initial content if user already provided some",
        },
      },
      required: [],
    },
  },
  {
    name: "add_to_memory_draft",
    description: "Add content to the current memory draft. Use during the capture/enrichment phase.",
    input_schema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Additional content to add to the memory",
        },
        is_answer_to_question: {
          type: "boolean",
          description: "Whether this content is an answer to an enrichment question",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "generate_memory_draft",
    description: "Generate a formatted draft from the captured content. Call when enough information has been gathered.",
    input_schema: {
      type: "object",
      properties: {
        request_confirmation: {
          type: "boolean",
          description: "Whether to ask user to confirm (default: true)",
        },
      },
      required: [],
    },
  },
  {
    name: "finalize_memory",
    description:
      "Save the memory to the database. Only call after user confirms the draft. This will categorize, tag, find relationships, vectorize, and sync the memory.",
    input_schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Optional title override (otherwise auto-generated)",
        },
        category_override: {
          type: "string",
          description: "Optional category name override",
        },
        tags_override: {
          type: "array",
          items: { type: "string" },
          description: "Optional tags override (array of tag names)",
        },
      },
      required: [],
    },
  },
  {
    name: "cancel_memory_draft",
    description: "Cancel the current memory creation and discard the draft.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  // ========== MEMORY MANAGEMENT ==========
  {
    name: "update_memory",
    description: "Update an existing memory. Use when user wants to edit a saved memory.",
    input_schema: {
      type: "object",
      properties: {
        memory_id: { type: "string", description: "UUID of the memory to update" },
        title: { type: "string", description: "New title" },
        content: { type: "string", description: "New content" },
        category: { type: "string", description: "New category name" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "New tags (array of tag names)",
        },
      },
      required: ["memory_id"],
    },
  },
  {
    name: "delete_memory",
    description: "Delete a memory. Always confirm with user before calling this.",
    input_schema: {
      type: "object",
      properties: {
        memory_id: { type: "string", description: "UUID of the memory to delete" },
      },
      required: ["memory_id"],
    },
  },
  // ========== SESSION & STATE ==========
  {
    name: "get_session_state",
    description:
      "Get the current conversation state and any active memory draft. Useful for understanding context.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "set_session_state",
    description: "Update the conversation state. Used internally to track memory creation flow.",
    input_schema: {
      type: "object",
      properties: {
        state: {
          type: "string",
          enum: ["CONVERSATION", "MEMORY_CAPTURE", "MEMORY_ENRICHMENT", "MEMORY_DRAFT"],
          description: "The new conversation state",
        },
      },
      required: ["state"],
    },
  },
  // ========== REMINDERS ==========
  {
    name: "suggest_reminder",
    description:
      "Suggest a reminder for a memory that contains time-sensitive information such as appointments, deadlines, follow-ups, or events. Call this after saving a memory that mentions future dates or time-sensitive content. This presents the suggestion to the user for confirmation.",
    input_schema: {
      type: "object",
      properties: {
        memory_id: {
          type: "string",
          description: "UUID of the memory to set a reminder for",
        },
        suggested_time: {
          type: "string",
          description: "ISO 8601 datetime for when the reminder should be sent",
        },
        reasoning: {
          type: "string",
          description: "Brief explanation of why this reminder is suggested (e.g., 'Meeting with John tomorrow at 3pm')",
        },
      },
      required: ["memory_id", "suggested_time", "reasoning"],
    },
  },
  {
    name: "create_reminder",
    description:
      "Create a reminder for a memory. Call this after the user confirms they want to set a reminder. The reminder will be sent at the specified time via the user's preferred notification channels.",
    input_schema: {
      type: "object",
      properties: {
        memory_id: {
          type: "string",
          description: "UUID of the memory to set a reminder for",
        },
        remind_at: {
          type: "string",
          description: "ISO 8601 datetime for when the reminder should be sent",
        },
        title: {
          type: "string",
          description: "Short title for the reminder",
        },
        summary: {
          type: "string",
          description: "Brief summary or reasoning for the reminder",
        },
        channels: {
          type: "array",
          items: { type: "string", enum: ["whatsapp", "telegram", "email"] },
          description: "Notification channels to use. Defaults to ['email'] if not specified.",
        },
      },
      required: ["memory_id", "remind_at", "title"],
    },
  },
  {
    name: "list_reminders",
    description:
      "List the user's reminders. Use when user asks about their upcoming reminders or reminder history.",
    input_schema: {
      type: "object",
      properties: {
        upcoming_only: {
          type: "boolean",
          description: "If true, only show pending reminders scheduled for the future. Default: true",
        },
        limit: {
          type: "number",
          description: "Number of reminders to return (default: 10, max: 20)",
        },
      },
      required: [],
    },
  },
  {
    name: "cancel_reminder",
    description: "Cancel a pending reminder. Use when user wants to remove an upcoming reminder.",
    input_schema: {
      type: "object",
      properties: {
        reminder_id: {
          type: "string",
          description: "UUID of the reminder to cancel",
        },
      },
      required: ["reminder_id"],
    },
  },
];
