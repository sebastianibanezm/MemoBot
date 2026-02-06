"use client";

import { useState, useRef, useEffect, FormEvent, DragEvent, ChangeEvent } from "react";
import Link from "next/link";

interface RetrievedMemory {
  id: string;
  title: string | null;
  content_preview: string;
  attachment_count?: number;
}

interface SuggestedButton {
  id: string;
  title: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  memories?: RetrievedMemory[];
  createdMemory?: RetrievedMemory;
  suggestedButtons?: SuggestedButton[];
}

interface PendingAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: "uploading" | "ready" | "error";
  error?: string;
  previewUrl?: string;
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

// Created memory card shown after memory is saved
function CreatedMemoryCard({ memory }: { memory: RetrievedMemory }) {
  return (
    <div className="flex justify-start mb-2">
      <div className="max-w-[90%]">
        <div className="text-xs text-[var(--muted)] mb-2 font-mono">
          <span className="text-[var(--accent)]">//</span> Memory saved:
        </div>
        <Link
          href={`/dashboard/memories/${memory.id}`}
          className="group block"
        >
          <div className="bg-[var(--accent)]/10 border border-[var(--accent)]/30 hover:border-[var(--accent)]/60 rounded-md px-4 py-3 transition-all cursor-pointer max-w-[280px]">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[var(--accent)] text-sm">&#10003;</span>
              <div className="text-sm font-medium text-[var(--foreground)] truncate group-hover:text-[var(--accent)] transition-colors">
                {memory.title || "Untitled"}
              </div>
            </div>
            <div className="text-xs text-[var(--muted)] line-clamp-2">
              {memory.content_preview}
            </div>
            <div className="text-xs text-[var(--accent)] mt-2 opacity-70 group-hover:opacity-100 transition-opacity">
              Click to view memory →
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

// Quick action buttons shown after assistant messages
function ActionButtons({ 
  buttons, 
  onButtonClick, 
  disabled 
}: { 
  buttons: SuggestedButton[]; 
  onButtonClick: (button: SuggestedButton) => void;
  disabled: boolean;
}) {
  if (buttons.length === 0) return null;

  return (
    <div className="flex justify-start mt-2">
      <div className="flex flex-wrap gap-2">
        {buttons.map((button) => (
          <button
            key={button.id}
            onClick={() => onButtonClick(button)}
            disabled={disabled}
            className="px-3 py-1.5 text-xs font-mono rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 hover:border-[var(--accent)]/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {button.title}
          </button>
        ))}
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
      suggestedButtons: [{ id: "new_memory", title: "New Memory" }],
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusPhase, setStatusPhase] = useState(0);
  const [currentMode, setCurrentMode] = useState<"recall" | "create">("recall");
  const [isInCreateSession, setIsInCreateSession] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [latestButtons, setLatestButtons] = useState<SuggestedButton[]>([
    { id: "new_memory", title: "New Memory" },
  ]);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const phaseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Get the appropriate status phases based on current mode
  const STATUS_PHASES = currentMode === "create" ? CREATE_STATUS_PHASES : RECALL_STATUS_PHASES;

  // Auto-scroll to bottom of messages container when messages change or loading state changes
  // Uses scrollTop instead of scrollIntoView to avoid affecting page scroll
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
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

  // Core function to send a message (used by form submit and button clicks)
  const sendMessage = async (messageText: string, attachmentIds: string[] = []) => {
    // Detect intent and set mode
    const intent = detectIntent(messageText);
    
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
      content: messageText,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setStatusPhase(0); // Reset to first phase
    setIsLoading(true);
    setLatestButtons([]); // Clear buttons while loading

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: messageText,
          attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
        }),
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
        createdMemory: data.createdMemory,
        suggestedButtons: data.suggestedButtons,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Update latest buttons for display
      if (data.suggestedButtons && data.suggestedButtons.length > 0) {
        setLatestButtons(data.suggestedButtons);
      } else {
        setLatestButtons([{ id: "new_memory", title: "New Memory" }]);
      }

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
      setLatestButtons([{ id: "new_memory", title: "New Memory" }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    // Get ready attachments and clear them
    const readyAttachments = pendingAttachments.filter((a) => a.status === "ready");
    const attachmentIds = readyAttachments.map((a) => a.id);
    
    // Clear pending attachments and revoke preview URLs
    pendingAttachments.forEach((att) => {
      if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
    });
    setPendingAttachments([]);

    await sendMessage(trimmedInput, attachmentIds);
  };

  // Handle button clicks - convert button ID to the appropriate message
  const handleButtonClick = async (button: SuggestedButton) => {
    if (isLoading) return;

    let messageText: string;
    switch (button.id) {
      case "new_memory":
        messageText = "I want to create a new memory";
        break;
      case "save_memory":
        messageText = "Save it";
        break;
      case "create_reminder":
        messageText = "Yes, create a reminder for this memory";
        break;
      default:
        messageText = button.title;
    }

    await sendMessage(messageText);
  };

  // Handle file selection from input
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFilesUpload(Array.from(files));
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  // Handle drag events
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFilesUpload(Array.from(files));
    }
  };

  // Upload files
  const handleFilesUpload = async (files: File[]) => {
    for (const file of files) {
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      
      // Create preview URL for images
      let previewUrl: string | undefined;
      if (file.type.startsWith("image/")) {
        previewUrl = URL.createObjectURL(file);
      }

      // Add pending attachment with uploading status
      setPendingAttachments((prev) => [
        ...prev,
        {
          id: tempId,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          status: "uploading",
          previewUrl,
        },
      ]);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/attachments/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Upload failed");
        }

        const data = await response.json();
        
        // Update attachment with real ID and ready status
        setPendingAttachments((prev) =>
          prev.map((att) =>
            att.id === tempId
              ? { ...att, id: data.attachment.id, status: "ready" as const }
              : att
          )
        );
      } catch (error) {
        console.error("File upload error:", error);
        // Update attachment with error status
        setPendingAttachments((prev) =>
          prev.map((att) =>
            att.id === tempId
              ? {
                  ...att,
                  status: "error" as const,
                  error: error instanceof Error ? error.message : "Upload failed",
                }
              : att
          )
        );
      }
    }
  };

  // Remove pending attachment
  const removeAttachment = (attachmentId: string) => {
    setPendingAttachments((prev) => {
      const att = prev.find((a) => a.id === attachmentId);
      if (att?.previewUrl) {
        URL.revokeObjectURL(att.previewUrl);
      }
      return prev.filter((a) => a.id !== attachmentId);
    });
  };

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div 
      className={`relative w-full h-[65vh] min-h-[400px] max-h-[700px] rounded-lg overflow-hidden border bg-[var(--background-alt)] transition-colors ${
        isDragging 
          ? "border-[var(--accent)] border-2 bg-[var(--accent)]/5" 
          : "border-[var(--card-border)]"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--background-alt)]/90 pointer-events-none">
          <div className="text-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-[var(--accent)] mb-2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p className="text-[var(--accent)] font-mono text-sm">Drop file to attach</p>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf,.txt,.md,.doc,.docx,video/*,audio/*"
        onChange={handleFileSelect}
        multiple
      />

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
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((message, index) => {
            const isLastMessage = index === messages.length - 1;
            const isLastAssistant = message.role === "assistant" && isLastMessage;
            
            return (
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
                {/* Show created memory card after the assistant's save confirmation */}
                {message.role === "assistant" && message.createdMemory && (
                  <div className="mt-3">
                    <CreatedMemoryCard memory={message.createdMemory} />
                  </div>
                )}
                {/* Show action buttons after the last assistant message */}
                {isLastAssistant && !isLoading && latestButtons.length > 0 && (
                  <ActionButtons 
                    buttons={latestButtons} 
                    onButtonClick={handleButtonClick}
                    disabled={isLoading}
                  />
                )}
              </div>
            );
          })}

          {/* Loading Indicator with Status */}
          {isLoading && (
            <ThinkingIndicator 
              statusMessage={STATUS_PHASES[statusPhase].message} 
            />
          )}
        </div>

        {/* Pending Attachments */}
        {pendingAttachments.length > 0 && (
          <div className="px-4 py-2 bg-[var(--card)] border-t border-[var(--card-border)]">
            <div className="flex flex-wrap gap-2">
              {pendingAttachments.map((att) => (
                <div
                  key={att.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md border text-xs ${
                    att.status === "error"
                      ? "bg-red-500/10 border-red-500/30 text-red-400"
                      : att.status === "uploading"
                      ? "bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--muted)]"
                      : "bg-[var(--background-alt)] border-[var(--card-border)] text-[var(--foreground)]"
                  }`}
                >
                  {/* File icon or preview */}
                  {att.previewUrl ? (
                    <img
                      src={att.previewUrl}
                      alt={att.fileName}
                      className="w-6 h-6 rounded object-cover"
                    />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                    </svg>
                  )}
                  <span className="truncate max-w-[120px]">{att.fileName}</span>
                  <span className="text-[var(--muted)]">({formatFileSize(att.fileSize)})</span>
                  {att.status === "uploading" && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-[var(--accent)]">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                  )}
                  {att.status === "error" && (
                    <span title={att.error}>!</span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="ml-1 p-0.5 hover:text-red-400 transition-colors"
                    title="Remove attachment"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18"/>
                      <path d="m6 6 12 12"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <form
          onSubmit={handleSubmit}
          className="px-4 py-3 bg-[var(--card)] border-t border-[var(--card-border)]"
        >
          <div className="flex items-center gap-3">
            <span className="text-[var(--accent)] font-mono text-sm">&gt;</span>
            
            {/* Attachment button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="p-1.5 text-[var(--muted)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
              title="Attach file"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message or drop a file..."
              disabled={isLoading}
              className="flex-1 bg-transparent border-none outline-none text-[var(--foreground)] placeholder:text-[var(--muted-light)] text-sm font-mono"
            />
            <button
              type="submit"
              disabled={(!input.trim() && pendingAttachments.filter(a => a.status === "ready").length === 0) || isLoading || pendingAttachments.some(a => a.status === "uploading")}
              className="btn-accent btn-sm"
            >
              SEND
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
