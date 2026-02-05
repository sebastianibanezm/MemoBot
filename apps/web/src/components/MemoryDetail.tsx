"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DateTimePicker from "@/components/DateTimePicker";
import { NEON_COLORS, type NeonColorKey } from "@/lib/constants/colors";

interface RelatedMemory {
  id: string;
  title: string | null;
  summary: string | null;
  content: string;
  category_name: string | null;
  similarity_score: number;
  has_reminders?: boolean;
}

interface Reminder {
  id: string;
  title: string;
  summary: string | null;
  remind_at: string;
  channels: string[];
  status: "pending" | "sent" | "failed" | "cancelled";
}

interface Category {
  id: string;
  name: string;
  color: NeonColorKey;
  memory_count: number;
}

interface Tag {
  id: string;
  name: string;
  usage_count: number;
}

interface MemoryDetailProps {
  memory: {
    id: string;
    title: string | null;
    content: string;
    summary: string | null;
    category_id: string | null;
    category_name: string | null;
    tag_ids: string[];
    tag_names: string[];
    source_platform: string | null;
    created_at: string;
    occurred_at: string | null;
  };
  relatedMemories?: RelatedMemory[];
}

interface SearchMemory {
  id: string;
  title: string | null;
  summary: string | null;
  content: string;
}

export default function MemoryDetail({ memory, relatedMemories = [] }: MemoryDetailProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form state
  const [title, setTitle] = useState(memory.title || "");
  const [content, setContent] = useState(memory.content);
  const [summary, setSummary] = useState(memory.summary || "");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(memory.category_id);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(memory.tag_ids);

  // Categories and tags data
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  // Link memory state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchMemory[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [isRecomputingRelations, setIsRecomputingRelations] = useState(false);

  // Reminder state
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderSummary, setReminderSummary] = useState("");
  const [reminderAt, setReminderAt] = useState<Date | null>(null);
  const [reminderChannels, setReminderChannels] = useState<string[]>(["email"]);
  const [isCreatingReminder, setIsCreatingReminder] = useState(false);
  const [reminderError, setReminderError] = useState("");
  const [isAnalyzingReminder, setIsAnalyzingReminder] = useState(false);

  // Fetch categories, tags, and reminders on mount
  useEffect(() => {
    fetch("/api/categories")
      .then((res) => (res.ok ? res.json() : { categories: [] }))
      .then((data) => setCategories(data.categories ?? []))
      .catch(() => setCategories([]));

    fetch("/api/tags")
      .then((res) => (res.ok ? res.json() : { tags: [] }))
      .then((data) => setTags(data.tags ?? []))
      .catch(() => setTags([]));
  }, []);

  // Fetch reminders for this memory
  const fetchReminders = useCallback(async () => {
    try {
      const res = await fetch("/api/reminders");
      if (res.ok) {
        const data = await res.json();
        // Filter to only reminders for this memory
        const memoryReminders = (data.reminders ?? []).filter(
          (r: Reminder & { memory_id: string }) => r.memory_id === memory.id
        );
        setReminders(memoryReminders);
      }
    } catch (error) {
      console.error("Failed to fetch reminders:", error);
    }
  }, [memory.id]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setShowTagDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleTag = useCallback((tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }, []);

  // Helper to get category color by ID or name
  const getCategoryColor = useCallback((categoryId: string | null, categoryName: string | null): { hex: string; glow: string } | null => {
    let category: Category | undefined;
    if (categoryId) {
      category = categories.find((c) => c.id === categoryId);
    } else if (categoryName) {
      category = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
    }
    if (!category?.color) return null;
    return NEON_COLORS[category.color] ?? NEON_COLORS["neon-cyan"];
  }, [categories]);

  const selectCategory = useCallback((categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
    setShowCategoryDropdown(false);
  }, []);

  // Get IDs of already related memories to exclude from search (memoized to prevent infinite loops)
  const relatedIds = useMemo(
    () => new Set(relatedMemories.map((r) => r.id)),
    [relatedMemories]
  );

  useEffect(() => {
    if (!showLinkModal) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        // Build URL with optional search parameter
        const url = searchQuery.trim()
          ? `/api/memories?limit=20&search=${encodeURIComponent(searchQuery)}`
          : `/api/memories?limit=20`;
        
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          // Filter out current memory and already related memories
          const filtered = (data.memories ?? []).filter(
            (m: SearchMemory) => m.id !== memory.id && !relatedIds.has(m.id)
          );
          setSearchResults(filtered);
        }
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsSearching(false);
      }
    }, searchQuery ? 300 : 0); // No delay for initial load

    return () => clearTimeout(timeoutId);
  }, [searchQuery, showLinkModal, memory.id, relatedIds]);

  const handleLinkMemory = async (targetMemoryId: string) => {
    setIsLinking(true);
    try {
      const response = await fetch(`/api/memories/${memory.id}/relate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetMemoryId }),
      });

      if (!response.ok) {
        throw new Error("Failed to link memory");
      }

      setShowLinkModal(false);
      setSearchQuery("");
      setSearchResults([]);
      router.refresh();
    } catch (error) {
      console.error("Failed to link:", error);
      alert("Failed to link memory. Please try again.");
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlinkMemory = async (targetMemoryId: string, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation when clicking unlink
    e.stopPropagation();
    
    setUnlinkingId(targetMemoryId);
    try {
      const response = await fetch(
        `/api/memories/${memory.id}/relate?targetMemoryId=${targetMemoryId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to unlink memory");
      }

      router.refresh();
    } catch (error) {
      console.error("Failed to unlink:", error);
      alert("Failed to unlink memory. Please try again.");
    } finally {
      setUnlinkingId(null);
    }
  };

  const handleRecomputeRelations = async () => {
    setIsRecomputingRelations(true);
    try {
      const response = await fetch(
        `/api/memories/${memory.id}/recompute-relations`,
        { method: "POST" }
      );

      if (!response.ok) {
        throw new Error("Failed to find related memories");
      }

      const data = await response.json();
      if (data.relatedCount > 0) {
        router.refresh();
      } else {
        alert("No similar memories found above the similarity threshold.");
      }
    } catch (error) {
      console.error("Failed to recompute relations:", error);
      alert("Failed to find related memories. Please try again.");
    } finally {
      setIsRecomputingRelations(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/memories/${memory.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          summary,
          category_id: selectedCategoryId,
          tag_ids: selectedTagIds,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update memory");
      }

      setIsEditing(false);
      router.refresh();
    } catch (error) {
      console.error("Failed to save:", error);
      alert("Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/memories/${memory.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete memory");
      }

      router.push("/dashboard/memories");
    } catch (error) {
      console.error("Failed to delete:", error);
      alert("Failed to delete memory. Please try again.");
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCancel = () => {
    setTitle(memory.title || "");
    setContent(memory.content);
    setSummary(memory.summary || "");
    setSelectedCategoryId(memory.category_id);
    setSelectedTagIds(memory.tag_ids);
    setIsEditing(false);
  };

  const toggleReminderChannel = useCallback((channel: string) => {
    setReminderChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  }, []);

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    setReminderError("");

    if (!reminderTitle.trim()) {
      setReminderError("Please enter a title");
      return;
    }
    if (!reminderAt) {
      setReminderError("Please select a date and time");
      return;
    }
    if (reminderChannels.length === 0) {
      setReminderError("Please select at least one notification channel");
      return;
    }

    setIsCreatingReminder(true);

    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memory_id: memory.id,
          title: reminderTitle.trim(),
          summary: reminderSummary.trim() || null,
          remind_at: reminderAt!.toISOString(),
          channels: reminderChannels,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create reminder");
      }

      // Reset form and close modal
      setReminderTitle("");
      setReminderSummary("");
      setReminderAt(null);
      setReminderChannels(["email"]);
      setShowReminderModal(false);
      fetchReminders();
    } catch (err) {
      setReminderError(err instanceof Error ? err.message : "Failed to create reminder");
    } finally {
      setIsCreatingReminder(false);
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    try {
      const res = await fetch(`/api/reminders/${reminderId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setReminders((prev) => prev.filter((r) => r.id !== reminderId));
      }
    } catch (error) {
      console.error("Failed to delete reminder:", error);
    }
  };

  const openEditReminderModal = (reminder: Reminder) => {
    // Only allow editing pending reminders
    if (reminder.status !== "pending") return;
    
    setEditingReminderId(reminder.id);
    setReminderTitle(reminder.title);
    setReminderSummary(reminder.summary || "");
    setReminderAt(new Date(reminder.remind_at));
    setReminderChannels(reminder.channels);
    setReminderError("");
    setShowReminderModal(true);
  };

  const handleUpdateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReminderId) return;
    
    setReminderError("");

    if (!reminderTitle.trim()) {
      setReminderError("Please enter a title");
      return;
    }
    if (!reminderAt) {
      setReminderError("Please select a date and time");
      return;
    }
    if (reminderChannels.length === 0) {
      setReminderError("Please select at least one notification channel");
      return;
    }

    setIsCreatingReminder(true);

    try {
      const res = await fetch(`/api/reminders/${editingReminderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: reminderTitle.trim(),
          summary: reminderSummary.trim() || null,
          remind_at: reminderAt.toISOString(),
          channels: reminderChannels,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update reminder");
      }

      // Reset form and close modal
      setReminderTitle("");
      setReminderSummary("");
      setReminderAt(null);
      setReminderChannels(["email"]);
      setEditingReminderId(null);
      setShowReminderModal(false);
      fetchReminders();
    } catch (err) {
      setReminderError(err instanceof Error ? err.message : "Failed to update reminder");
    } finally {
      setIsCreatingReminder(false);
    }
  };

  const openReminderModalWithSuggestions = async () => {
    // Reset form first
    setEditingReminderId(null);
    setReminderTitle("");
    setReminderSummary("");
    setReminderAt(null);
    setReminderChannels(["email"]);
    setReminderError("");
    
    // Open modal immediately
    setShowReminderModal(true);
    setIsAnalyzingReminder(true);

    try {
      const res = await fetch("/api/reminders/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memory_id: memory.id }),
      });

      if (res.ok) {
        const data = await res.json();
        const suggestion = data.suggestion;
        
        if (suggestion) {
          setReminderTitle(suggestion.title || "");
          setReminderSummary(suggestion.summary || "");
          if (suggestion.suggested_time) {
            setReminderAt(new Date(suggestion.suggested_time));
          }
        }
      }
    } catch (error) {
      console.error("Failed to get reminder suggestions:", error);
      // Silently fail - user can still fill in manually
    } finally {
      setIsAnalyzingReminder(false);
    }
  };

  return (
    <div className="p-6 pb-20 max-w-3xl mx-auto">
      {/* Back Link */}
      <Link
        href="/dashboard/memories"
        className="link-accent text-sm inline-flex items-center gap-2 mb-6"
      >
        <span>&larr;</span> BACK TO MEMORIES
      </Link>

      {/* Memory Card */}
      <article className="card-dystopian p-6">
        {/* Header */}
        <header className="mb-6 pb-4 border-b border-[var(--card-border)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Memory title..."
                  className="w-full text-2xl font-display tracking-wider text-[var(--foreground)] bg-[var(--background-alt)] border border-[var(--card-border)] rounded px-3 py-2 focus:outline-none focus:border-[var(--accent)]"
                  style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
                />
              ) : (
                <h1
                  className="text-2xl font-display tracking-wider text-[var(--foreground)] mb-3"
                  style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
                >
                  {memory.title || "(UNTITLED MEMORY)"}
                </h1>
              )}
            </div>

            {/* Action Buttons */}
            {!isEditing && !showDeleteConfirm && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openReminderModalWithSuggestions}
                  className="btn-outline btn-sm flex items-center gap-1.5"
                  title="Set a reminder for this memory"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                  </svg>
                  REMIND
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="btn-accent btn-sm"
                >
                  EDIT
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="btn-danger btn-sm flex items-center justify-center"
                  title="Delete memory"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Metadata - View Mode */}
          {!isEditing && (
            <div className="flex flex-wrap gap-2 text-xs mt-3">
              {memory.category_name && (() => {
                const color = getCategoryColor(memory.category_id, memory.category_name);
                return (
                  <span 
                    className="text-[10px] px-2 py-0.5 rounded border"
                    style={{
                      backgroundColor: color ? `${color.hex}20` : undefined,
                      borderColor: color ? `${color.hex}50` : undefined,
                      color: color?.hex,
                    }}
                  >
                    {memory.category_name.toUpperCase()}
                  </span>
                );
              })()}
              {memory.tag_names.map((t) => (
                <span key={t} className="badge-muted">
                  #{t.toUpperCase()}
                </span>
              ))}
            </div>
          )}

          {/* Metadata - Edit Mode */}
          {isEditing && (
            <div className="mt-4 space-y-3">
              {/* Category Selector */}
              <div>
                <label className="block text-xs text-[var(--accent)] tracking-wider mb-2">
                  CATEGORY
                </label>
                <div className="relative" ref={categoryDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                    className={`w-full px-3 py-2 bg-[var(--background-alt)] border rounded text-xs tracking-wider transition-colors flex items-center justify-between ${
                      selectedCategoryId
                        ? "border-[var(--accent)] text-[var(--foreground)]"
                        : "border-[var(--card-border)] text-[var(--muted)]"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 7h-7m7 10h-7M4 4h.01M4 12h.01M4 20h.01M8 4v0a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v0a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1ZM8 12v0a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v0a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1ZM8 20v0a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v0a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1Z"/>
                      </svg>
                      {selectedCategoryId
                        ? categories.find((c) => c.id === selectedCategoryId)?.name || "SELECT CATEGORY"
                        : "NO CATEGORY"}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6"/>
                    </svg>
                  </button>

                  {showCategoryDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-full max-h-48 overflow-y-auto bg-[var(--card)] border border-[var(--card-border)] rounded shadow-lg z-20">
                      <div className="p-2 space-y-1">
                        <button
                          type="button"
                          onClick={() => selectCategory(null)}
                          className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                            !selectedCategoryId
                              ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                              : "hover:bg-[var(--background-alt)] text-[var(--foreground)]"
                          }`}
                        >
                          No Category
                        </button>
                        {categories.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => selectCategory(cat.id)}
                            className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center justify-between ${
                              selectedCategoryId === cat.id
                                ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                                : "hover:bg-[var(--background-alt)] text-[var(--foreground)]"
                            }`}
                          >
                            <span>{cat.name}</span>
                            <span className="text-[10px] text-[var(--muted)]">{cat.memory_count}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tags Selector */}
              <div>
                <label className="block text-xs text-[var(--accent)] tracking-wider mb-2">
                  TAGS
                </label>
                <div className="relative" ref={tagDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowTagDropdown(!showTagDropdown)}
                    className={`w-full px-3 py-2 bg-[var(--background-alt)] border rounded text-xs tracking-wider transition-colors flex items-center justify-between ${
                      selectedTagIds.length > 0
                        ? "border-[var(--accent)] text-[var(--foreground)]"
                        : "border-[var(--card-border)] text-[var(--muted)]"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/>
                        <path d="M7 7h.01"/>
                      </svg>
                      {selectedTagIds.length > 0 ? (
                        <span>{selectedTagIds.length} TAG{selectedTagIds.length > 1 ? "S" : ""} SELECTED</span>
                      ) : (
                        <span>NO TAGS</span>
                      )}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6"/>
                    </svg>
                  </button>

                  {showTagDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-full max-h-48 overflow-y-auto bg-[var(--card)] border border-[var(--card-border)] rounded shadow-lg z-20">
                      {tags.length === 0 ? (
                        <div className="p-3 text-xs text-[var(--muted)]">No tags available</div>
                      ) : (
                        <div className="p-2 space-y-1">
                          {tags.map((tag) => (
                            <label
                              key={tag.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--background-alt)] cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={selectedTagIds.includes(tag.id)}
                                onChange={() => toggleTag(tag.id)}
                                className="w-4 h-4 rounded border-[var(--card-border)] text-[var(--accent)] focus:ring-[var(--accent)] focus:ring-offset-0 bg-[var(--background)]"
                              />
                              <span className="text-xs text-[var(--foreground)] flex-1">
                                #{tag.name}
                              </span>
                              <span className="text-[10px] text-[var(--muted)]">
                                {tag.usage_count}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Selected Tags Display */}
                {selectedTagIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedTagIds.map((tagId) => {
                      const tag = tags.find((t) => t.id === tagId);
                      return tag ? (
                        <span
                          key={tagId}
                          className="text-[10px] px-2 py-1 rounded bg-[var(--background-alt)] text-[var(--muted)] border border-[var(--card-border)] flex items-center gap-1"
                        >
                          #{tag.name}
                          <button
                            type="button"
                            onClick={() => toggleTag(tagId)}
                            className="hover:text-[var(--foreground)]"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 6 6 18"/>
                              <path d="m6 6 12 12"/>
                            </svg>
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </header>

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-400/30 rounded">
            <p className="text-sm text-[var(--foreground)] mb-4">
              Are you sure you want to delete this memory? This action cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="btn-danger-solid btn-sm flex items-center gap-1"
              >
                {isDeleting ? (
                  "DELETING..."
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    CONFIRM
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="btn-ghost btn-sm"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}

        {/* Summary */}
        {isEditing ? (
          <div className="mb-6">
            <label className="block text-xs text-[var(--accent)] tracking-wider mb-2">
              SUMMARY
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief summary of the memory..."
              rows={2}
              className="w-full text-sm text-[var(--foreground)] bg-[var(--background-alt)] border border-[var(--card-border)] rounded px-3 py-2 focus:outline-none focus:border-[var(--accent)] resize-none"
            />
          </div>
        ) : memory.summary ? (
          <div className="mb-6 p-4 bg-[var(--background-alt)] border-l-2 border-[var(--accent)] rounded-r">
            <p className="text-sm text-[var(--muted)] italic leading-relaxed">
              {memory.summary}
            </p>
          </div>
        ) : null}

        {/* Content */}
        {isEditing ? (
          <div className="mb-6">
            <label className="block text-xs text-[var(--accent)] tracking-wider mb-2">
              CONTENT
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Memory content..."
              rows={10}
              className="w-full text-sm text-[var(--foreground)] bg-[var(--background-alt)] border border-[var(--card-border)] rounded px-3 py-2 focus:outline-none focus:border-[var(--accent)] resize-y font-mono"
            />
          </div>
        ) : (
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-[var(--foreground)] bg-transparent p-0 border-0 text-sm leading-relaxed">
              {memory.content}
            </pre>
          </div>
        )}

        {/* Edit Actions */}
        {isEditing && (
          <div className="flex items-center gap-3 mb-6">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !content.trim()}
              className="btn-accent btn-sm"
            >
              {isSaving ? "SAVING..." : "SAVE CHANGES"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="btn-ghost btn-sm"
            >
              CANCEL
            </button>
          </div>
        )}

        {/* Footer Metadata */}
        <footer className="mt-8 pt-4 border-t border-[var(--card-border)]">
          <div className="flex flex-wrap gap-6 text-xs text-[var(--muted)]">
            <div>
              <span className="text-[var(--accent)] tracking-wider">RELEVANT DATE:</span>{" "}
              {new Date(memory.occurred_at ?? memory.created_at).toLocaleString()}
            </div>
            <div>
              <span className="text-[var(--accent)] tracking-wider">CREATED:</span>{" "}
              {new Date(memory.created_at).toLocaleString()}
            </div>
            {memory.source_platform && (
              <div>
                <span className="text-[var(--accent)] tracking-wider">SOURCE:</span>{" "}
                {memory.source_platform.toUpperCase()}
              </div>
            )}
          </div>
        </footer>
      </article>

      {/* Reminders Section */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-lg font-display tracking-wider text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
          >
            REMINDERS
          </h2>
          <button
            type="button"
            onClick={openReminderModalWithSuggestions}
            className="text-xs text-[var(--accent)] hover:text-[var(--accent-light)] transition-colors"
          >
            + ADD REMINDER
          </button>
        </div>
        {reminders.length > 0 ? (
          <div className="space-y-2">
            {reminders.map((reminder) => {
              const isPast = reminder.status !== "pending" || new Date(reminder.remind_at) <= new Date();
              const isEditable = reminder.status === "pending" && !isPast;
              return (
                <div
                  key={reminder.id}
                  onClick={() => isEditable && openEditReminderModal(reminder)}
                  className={`card-dystopian p-3 flex items-center justify-between gap-4 ${isPast ? "opacity-60" : ""} ${isEditable ? "cursor-pointer hover:border-[var(--accent)]/50 transition-colors" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded border ${
                        reminder.status === "pending"
                          ? "bg-[var(--accent)]/20 text-[var(--accent)] border-[var(--accent)]/30"
                          : reminder.status === "sent"
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                      }`}>
                        {reminder.status.toUpperCase()}
                      </span>
                      <div className="flex items-center gap-1">
                        {reminder.channels.map((channel) => (
                          <span key={channel} className="text-[var(--accent)]" title={channel}>
                            {channel === "email" ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect width="20" height="16" x="2" y="4" rx="2"/>
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                              </svg>
                            ) : channel === "whatsapp" ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m22 2-7 20-4-9-9-4Z"/>
                                <path d="M22 2 11 13"/>
                              </svg>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className={`text-sm ${isPast ? "line-through text-[var(--muted)]" : "text-[var(--foreground)]"}`}>
                      {reminder.title}
                    </p>
                    {reminder.summary && (
                      <p className="text-xs text-[var(--muted)] mt-0.5 line-clamp-1">
                        {reminder.summary}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-[var(--muted-light)]">
                      {new Date(reminder.remind_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {!isPast && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteReminder(reminder.id);
                        }}
                        className="text-[var(--muted)] hover:text-red-400 mt-1"
                        title="Delete reminder"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card-dystopian p-6 text-center">
            <p className="text-sm text-[var(--muted)]">No reminders set for this memory</p>
            <button
              type="button"
              onClick={openReminderModalWithSuggestions}
              className="mt-3 text-xs text-[var(--accent)] hover:text-[var(--accent-light)] transition-colors"
            >
              Create your first reminder
            </button>
          </div>
        )}
      </section>

      {/* Related Memories Section */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-lg font-display tracking-wider text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
          >
            RELATED MEMORIES
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRecomputeRelations}
              disabled={isRecomputingRelations}
              className="btn-outline btn-sm flex items-center gap-1.5"
              title="Find similar memories automatically"
            >
              {isRecomputingRelations ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  FINDING...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                  FIND RELATED
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowLinkModal(true)}
              className="btn-accent btn-sm"
            >
              + LINK MEMORY
            </button>
          </div>
        </div>

        {relatedMemories.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {relatedMemories.map((related) => (
              <div key={related.id} className="card-dystopian glitch-hover p-4 transition-all relative group">
                <Link
                  href={`/dashboard/memories/${related.id}`}
                  className="block"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <h3 className="font-medium text-[var(--foreground)] line-clamp-1">
                        {related.title || "(UNTITLED)"}
                      </h3>
                      {related.has_reminders && (
                        <span className="flex-shrink-0 text-[var(--accent)]" title="Has active reminder">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                          </svg>
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30 flex-shrink-0">
                      {Math.round(related.similarity_score * 100)}%
                    </span>
                  </div>
                  <p className="text-sm text-[var(--muted)] line-clamp-2">
                    {related.summary || related.content}
                  </p>
                  {related.category_name && (() => {
                    const color = getCategoryColor(null, related.category_name);
                    return (
                      <div className="mt-2">
                        <span 
                          className="text-[10px] px-2 py-0.5 rounded border"
                          style={{
                            backgroundColor: color ? `${color.hex}20` : undefined,
                            borderColor: color ? `${color.hex}50` : undefined,
                            color: color?.hex,
                          }}
                        >
                          {related.category_name.toUpperCase()}
                        </span>
                      </div>
                    );
                  })()}
                </Link>
                {/* Unlink Button */}
                <button
                  type="button"
                  onClick={(e) => handleUnlinkMemory(related.id, e)}
                  disabled={unlinkingId === related.id}
                  className="absolute top-2 right-2 p-1.5 rounded bg-[var(--card)] border border-[var(--card-border)] text-[var(--muted)] hover:text-red-400 hover:border-red-400/50 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  title="Unlink memory"
                >
                  {unlinkingId === related.id ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18"/>
                      <path d="m6 6 12 12"/>
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="card-dystopian p-6 text-center">
            <p className="text-sm text-[var(--muted)]">No related memories</p>
            <p className="text-xs text-[var(--muted-light)] mt-1">
              Use &quot;Find Related&quot; to discover similar memories, or &quot;Link Memory&quot; to manually connect them
            </p>
          </div>
        )}
      </section>

      {/* Link Memory Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="card-dystopian w-full max-w-lg mx-4 p-6 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3
                className="text-lg font-display tracking-wider text-[var(--foreground)]"
                style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
              >
                LINK A MEMORY
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowLinkModal(false);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                &times;
              </button>
            </div>

            <div className="relative mb-4">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter memories..."
                className="w-full pl-9 pr-3 py-2 text-sm text-[var(--foreground)] bg-[var(--background-alt)] border border-[var(--card-border)] rounded focus:outline-none focus:border-[var(--accent)]"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18"/>
                    <path d="m6 6 12 12"/>
                  </svg>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto min-h-[200px]">
              {isSearching ? (
                <div className="text-center py-8 text-sm text-[var(--muted)]">
                  <span className="text-[var(--accent)]">&gt;</span> Loading memories...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8 text-sm text-[var(--muted)]">
                  {searchQuery ? "No memories match your search" : "No other memories available to link"}
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => handleLinkMemory(result.id)}
                      disabled={isLinking}
                      className="w-full text-left p-3 rounded border border-[var(--card-border)] hover:border-[var(--accent)] hover:bg-[var(--background-alt)] transition-all disabled:opacity-50"
                    >
                      <div className="font-medium text-[var(--foreground)] text-sm truncate">
                        {result.title || "(UNTITLED)"}
                      </div>
                      <div className="text-xs text-[var(--muted)] line-clamp-2 mt-1">
                        {result.summary || result.content}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Reminder Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg w-full max-w-md mx-4 overflow-hidden">
            <div className="p-4 border-b border-[var(--card-border)] flex items-center justify-between">
              <h3
                className="text-lg font-display tracking-wider text-[var(--foreground)]"
                style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
              >
                {editingReminderId ? "EDIT REMINDER" : "SET REMINDER"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowReminderModal(false);
                  setEditingReminderId(null);
                  setReminderTitle("");
                  setReminderSummary("");
                  setReminderAt(null);
                  setReminderChannels(["email"]);
                  setReminderError("");
                }}
                className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18"/>
                  <path d="m6 6 12 12"/>
                </svg>
              </button>
            </div>

            <form onSubmit={editingReminderId ? handleUpdateReminder : handleCreateReminder} className="p-4 space-y-4">
              {reminderError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
                  {reminderError}
                </div>
              )}

              {/* AI Analysis Loading (only for new reminders) */}
              {isAnalyzingReminder && !editingReminderId && (
                <div className="p-3 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-[var(--accent)]">Analyzing memory for suggestions...</span>
                </div>
              )}

              {/* Memory Info */}
              <div className="p-3 bg-[var(--background-alt)] border border-[var(--card-border)] rounded">
                <p className="text-[10px] text-[var(--muted)] tracking-wider mb-1">LINKED MEMORY</p>
                <p className="text-sm text-[var(--foreground)]">{memory.title || "(Untitled)"}</p>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1.5 tracking-wider">
                  REMINDER TITLE *
                </label>
                <input
                  type="text"
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                  placeholder={isAnalyzingReminder ? "Loading suggestion..." : "e.g., Follow up on this"}
                  disabled={isAnalyzingReminder}
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
                />
              </div>

              {/* Summary */}
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1.5 tracking-wider">
                  NOTES (OPTIONAL)
                </label>
                <textarea
                  value={reminderSummary}
                  onChange={(e) => setReminderSummary(e.target.value)}
                  placeholder={isAnalyzingReminder ? "Loading suggestion..." : "Any additional notes..."}
                  disabled={isAnalyzingReminder}
                  rows={2}
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] resize-none disabled:opacity-50"
                />
              </div>

              {/* Date/Time */}
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1.5 tracking-wider">
                  REMIND AT *
                </label>
                <DateTimePicker
                  selected={reminderAt}
                  onChange={(date) => setReminderAt(date)}
                  minDate={new Date()}
                  placeholder="Select date and time..."
                />
              </div>

              {/* Channels */}
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1.5 tracking-wider">
                  NOTIFICATION CHANNELS *
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "email", label: "Email" },
                    { id: "whatsapp", label: "WhatsApp" },
                    { id: "telegram", label: "Telegram" },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleReminderChannel(id)}
                      className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                        reminderChannels.includes(id)
                          ? "bg-[var(--accent)] border-[var(--accent)] text-black"
                          : "bg-[var(--background)] border-[var(--card-border)] text-[var(--muted)] hover:border-[var(--accent)]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isCreatingReminder}
                  className="btn-accent text-xs flex-1 disabled:opacity-50"
                >
                  {isCreatingReminder 
                    ? (editingReminderId ? "UPDATING..." : "CREATING...") 
                    : (editingReminderId ? "UPDATE REMINDER" : "SET REMINDER")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowReminderModal(false);
                    setEditingReminderId(null);
                    setReminderTitle("");
                    setReminderSummary("");
                    setReminderAt(null);
                    setReminderChannels(["email"]);
                    setReminderError("");
                  }}
                  className="btn-outline text-xs"
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
