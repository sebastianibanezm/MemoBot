"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import Link from "next/link";

interface RetrievedMemory {
  id: string;
  title: string | null;
  content_preview: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  memories?: RetrievedMemory[];
}

const INITIAL_GREETING = "How can I help you today?";

// Status messages for RECALL mode (searching existing memories)
const RECALL_STATUS_PHASES = [
  { message: "Searching memory vault", minDuration: 1500 },
  { message: "Recreating stored memory", minDuration: 2000 },
  { message: "Composing response", minDuration: 0 },
];

// Status messages for CREATE mode (saving new memories)
const CREATE_STATUS_PHASES = [
  { message: "Enhancing memory details", minDuration: 2000 },
  { message: "Storing memory in vault", minDuration: 1500 },
  { message: "Composing response", minDuration: 0 },
];

// Patterns that indicate CREATE intent (user wants to save something new)
const CREATE_PATTERNS = [
  /^i want to remember/i,
  /^save this/i,
  /^note that/i,
  /^don'?t let me forget/i,
  /^remember this/i,
  /^memory$/i,
  /^i just\b/i,
  /^today i\b/i,
  /^yesterday\b/i,
  /^last (week|month|year)\b/i,
  /^we (just|recently)\b/i,
  /^i (had|went|saw|met|did|made|bought|got|received|found|discovered|learned|realized|decided|started|finished|completed)\b/i,
];

// Patterns that indicate RECALL intent (user is asking about existing memories)
const RECALL_PATTERNS = [
  /^what do (i|you) have/i,
  /^do you remember/i,
  /^tell me about/i,
  /^what was that/i,
  /^what did i (say|save|note|write)/i,
  /^find my/i,
  /^search for/i,
  /^show me/i,
  /\?$/, // Ends with a question mark
];

// Detect if the message is CREATE or RECALL intent
function detectIntent(message: string): "create" | "recall" | "unknown" {
  const trimmed = message.trim().toLowerCase();
  
  // Check for explicit CREATE patterns first
  for (const pattern of CREATE_PATTERNS) {
    if (pattern.test(message)) {
      return "create";
    }
  }
  
  // Check for RECALL patterns
  for (const pattern of RECALL_PATTERNS) {
    if (pattern.test(message)) {
      return "recall";
    }
  }
  
  // Default: if it's a statement (no question mark), lean toward create
  // If it's a question, lean toward recall
  if (trimmed.endsWith("?")) {
    return "recall";
  }
  
  return "unknown";
}

// Animated dots component that cycles 1 → 2 → 3 → 1 → 2 → 3...
function AnimatedDots() {
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prev) => (prev >= 3 ? 1 : prev + 1));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-block w-6 text-left">
      {".".repeat(dotCount)}
    </span>
  );
}

// Loading indicator with status message
function ThinkingIndicator({ statusMessage }: { statusMessage: string }) {
  return (
    <div className="flex justify-start">
      <div className="bg-[var(--card)] border border-[var(--card-border)] px-4 py-3 rounded-lg">
        <div className="text-xs text-[var(--accent)] mb-1 font-mono">
          MemoBot
        </div>
        <p className="text-sm text-[var(--muted)] font-mono italic">
          {statusMessage}
          <AnimatedDots />
        </p>
      </div>
    </div>
  );
}

// Memory cards shown before the bot's answer
function MemoryCards({ memories }: { memories: RetrievedMemory[] }) {
  if (memories.length === 0) return null;
  
  return (
    <div className="flex justify-start mb-2">
      <div className="max-w-[90%]">
        <div className="text-xs text-[var(--muted)] mb-2 font-mono">
          <span className="text-[var(--accent)]">//</span> Memories retrieved:
        </div>
        <div className="flex flex-wrap gap-2">
          {memories.map((memory) => (
            <Link
              key={memory.id}
              href={`/dashboard/memories/${memory.id}`}
              className="group block"
            >
              <div className="bg-[var(--background-alt)] border border-[var(--card-border)] hover:border-[var(--accent)]/50 rounded-md px-3 py-2 transition-all cursor-pointer max-w-[200px]">
                <div className="text-xs font-medium text-[var(--foreground)] truncate group-hover:text-[var(--accent)] transition-colors">
                  {memory.title || "Untitled"}
                </div>
                <div className="text-xs text-[var(--muted)] truncate mt-0.5">
                  {memory.content_preview.slice(0, 50)}...
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "greeting",
      role: "assistant",
      content: INITIAL_GREETING,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusPhase, setStatusPhase] = useState(0);
  const [currentMode, setCurrentMode] = useState<"recall" | "create">("recall");
  const [isInCreateSession, setIsInCreateSession] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const phaseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Get the appropriate status phases based on current mode
  const STATUS_PHASES = currentMode === "create" ? CREATE_STATUS_PHASES : RECALL_STATUS_PHASES;

  // Auto-scroll to bottom of messages container when messages change or loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Progress through status phases while loading
  useEffect(() => {
    if (isLoading && statusPhase < STATUS_PHASES.length - 1) {
      const currentPhaseDuration = STATUS_PHASES[statusPhase].minDuration;
      phaseTimerRef.current = setTimeout(() => {
        setStatusPhase((prev) => prev + 1);
      }, currentPhaseDuration);
    }

    return () => {
      if (phaseTimerRef.current) {
        clearTimeout(phaseTimerRef.current);
      }
    };
  }, [isLoading, statusPhase]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    // Detect intent and set mode
    const intent = detectIntent(trimmedInput);
    
    // If we're in an active create session, stay in create mode
    // Otherwise, determine based on the message
    if (isInCreateSession) {
      setCurrentMode("create");
    } else if (intent === "create") {
      setCurrentMode("create");
      setIsInCreateSession(true);
    } else {
      setCurrentMode("recall");
    }

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmedInput,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setStatusPhase(0); // Reset to first phase
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmedInput }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data = await response.json();
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.reply || "I'm not sure how to respond to that.",
        memories: data.memories,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Check if the memory creation is complete (memory was saved)
      // or if user cancelled - exit create session
      const replyLower = (data.reply || "").toLowerCase();
      if (
        isInCreateSession &&
        (replyLower.includes("saved") ||
          replyLower.includes("memory has been") ||
          replyLower.includes("stored") ||
          replyLower.includes("cancelled") ||
          replyLower.includes("discarded"))
      ) {
        setIsInCreateSession(false);
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="relative w-full h-[65vh] min-h-[400px] max-h-[700px] rounded-lg overflow-hidden border border-[var(--card-border)] bg-[var(--background-alt)]">
      {/* Chat Container */}
      <div className="flex flex-col h-full">
        {/* Chat Header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-[var(--card)] border-b border-[var(--card-border)]">
          <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="text-xs text-[var(--muted)] tracking-wider font-mono">
            <span className="text-[var(--accent)]">//</span> MEMOBOT.ACTIVE
          </span>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((message) => (
            <div key={message.id}>
              {/* Show memory cards before assistant message */}
              {message.role === "assistant" && message.memories && message.memories.length > 0 && (
                <MemoryCards memories={message.memories} />
              )}
              <div
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-lg ${
                    message.role === "user"
                      ? "bg-[var(--accent)]/20 border border-[var(--accent)]/40 text-[var(--foreground)]"
                      : "bg-[var(--card)] border border-[var(--card-border)] text-[var(--foreground)]"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="text-xs text-[var(--accent)] mb-1 font-mono">
                      MemoBot
                    </div>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.content}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Loading Indicator with Status */}
          {isLoading && (
            <ThinkingIndicator 
              statusMessage={STATUS_PHASES[statusPhase].message} 
            />
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form
          onSubmit={handleSubmit}
          className="px-4 py-3 bg-[var(--card)] border-t border-[var(--card-border)]"
        >
          <div className="flex items-center gap-3">
            <span className="text-[var(--accent)] font-mono text-sm">&gt;</span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              disabled={isLoading}
              className="flex-1 bg-transparent border-none outline-none text-[var(--foreground)] placeholder:text-[var(--muted-light)] text-sm font-mono"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-4 py-2 text-xs font-mono tracking-wider text-[var(--accent)] border border-[var(--accent)] rounded hover:bg-[var(--accent-muted)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              SEND
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
