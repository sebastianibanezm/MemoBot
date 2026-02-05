"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import DateTimePicker from "@/components/DateTimePicker";

interface Reminder {
  id: string;
  memory_id: string;
  title: string;
  summary: string | null;
  remind_at: string;
  channels: string[];
  status: "pending" | "sent" | "failed" | "cancelled";
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  memory: {
    id: string;
    title: string | null;
    summary: string | null;
  } | null;
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reminders");
      if (res.ok) {
        const data = await res.json();
        setReminders(data.reminders ?? []);
      }
    } catch (error) {
      console.error("Failed to fetch reminders:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const handleDelete = async (reminderId: string) => {
    try {
      const res = await fetch(`/api/reminders/${reminderId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setReminders((prev) => prev.filter((r) => r.id !== reminderId));
        setDeleteConfirm(null);
      }
    } catch (error) {
      console.error("Failed to delete reminder:", error);
    }
  };

  const handleCancel = async (reminderId: string) => {
    try {
      const res = await fetch(`/api/reminders/${reminderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (res.ok) {
        fetchReminders();
      }
    } catch (error) {
      console.error("Failed to cancel reminder:", error);
    }
  };

  // Separate reminders into upcoming and past
  const now = new Date();
  const upcomingReminders = reminders
    .filter((r) => r.status === "pending" && new Date(r.remind_at) > now)
    .sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime());

  const pastReminders = reminders
    .filter((r) => r.status !== "pending" || new Date(r.remind_at) <= now)
    .sort((a, b) => new Date(b.remind_at).getTime() - new Date(a.remind_at).getTime());

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 0) return "Past due";
    if (diffMins < 60) return `In ${diffMins} min${diffMins !== 1 ? "s" : ""}`;
    if (diffHours < 24) return `In ${diffHours} hour${diffHours !== 1 ? "s" : ""}`;
    if (diffDays < 7) return `In ${diffDays} day${diffDays !== 1 ? "s" : ""}`;
    return formatDate(dateStr);
  };

  const getStatusBadge = (status: Reminder["status"]) => {
    switch (status) {
      case "pending":
        return (
          <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30">
            PENDING
          </span>
        );
      case "sent":
        return (
          <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">
            SENT
          </span>
        );
      case "failed":
        return (
          <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
            FAILED
          </span>
        );
      case "cancelled":
        return (
          <span className="text-[10px] px-2 py-0.5 rounded bg-gray-500/20 text-gray-400 border border-gray-500/30">
            CANCELLED
          </span>
        );
    }
  };

  const getChannelIcons = (channels: string[]) => {
    return channels.map((channel) => {
      switch (channel) {
        case "whatsapp":
          return (
            <span key={channel} title="WhatsApp" className="text-[var(--accent)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </span>
          );
        case "telegram":
          return (
            <span key={channel} title="Telegram" className="text-[var(--accent)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m22 2-7 20-4-9-9-4Z"/>
                <path d="M22 2 11 13"/>
              </svg>
            </span>
          );
        case "email":
          return (
            <span key={channel} title="Email" className="text-[var(--accent)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
            </span>
          );
        default:
          return null;
      }
    });
  };

  const ReminderCard = ({ reminder, isPast }: { reminder: Reminder; isPast: boolean }) => (
    <div
      className={`card-dystopian p-4 ${isPast ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {getStatusBadge(reminder.status)}
            <div className="flex items-center gap-1.5">
              {getChannelIcons(reminder.channels)}
            </div>
            {!isPast && reminder.status === "pending" && (
              <span className="text-xs text-[var(--accent)]">
                {formatRelativeTime(reminder.remind_at)}
              </span>
            )}
          </div>
          <h3 className={`font-medium ${isPast ? "line-through text-[var(--muted)]" : "text-[var(--foreground)]"}`}>
            {reminder.title}
          </h3>
          {reminder.summary && (
            <p className="text-sm text-[var(--muted)] mt-1 line-clamp-2">
              {reminder.summary}
            </p>
          )}
          <p className="text-xs text-[var(--muted-light)] mt-2">
            {formatDate(reminder.remind_at)}
            {reminder.sent_at && ` · Sent: ${formatDate(reminder.sent_at)}`}
          </p>
        </div>
      </div>

      {/* Linked Memory Card */}
      {reminder.memory && (
        <Link
          href={`/dashboard/memories/${reminder.memory.id}`}
          className="block mt-4 p-3 bg-[var(--background-alt)] border border-[var(--card-border)] rounded hover:border-[var(--accent)] transition-colors group"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded bg-[var(--accent)]/10 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-[var(--muted)] tracking-wider mb-0.5">LINKED MEMORY</p>
              <p className="text-sm text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors truncate">
                {reminder.memory.title || "(Untitled)"}
              </p>
              {reminder.memory.summary && (
                <p className="text-xs text-[var(--muted)] mt-1 line-clamp-1">
                  {reminder.memory.summary}
                </p>
              )}
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors flex-shrink-0">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </div>
        </Link>
      )}

      {/* Actions */}
      {!isPast && reminder.status === "pending" && (
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[var(--card-border)]">
          <button
            type="button"
            onClick={() => setEditingReminder(reminder)}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
            </svg>
            EDIT
          </button>
          <button
            type="button"
            onClick={() => handleCancel(reminder.id)}
            className="text-xs text-[var(--muted)] hover:text-yellow-400 transition-colors flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="m15 9-6 6"/>
              <path d="m9 9 6 6"/>
            </svg>
            CANCEL
          </button>
          <button
            type="button"
            onClick={() => setDeleteConfirm(reminder.id)}
            className="text-[var(--muted)] hover:text-red-400 transition-colors flex items-center ml-auto"
            title="Delete reminder"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm === reminder.id && (
        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded">
          <p className="text-xs text-red-400 mb-2">Are you sure you want to delete this reminder?</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleDelete(reminder.id)}
              className="text-xs px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              CONFIRM
            </button>
            <button
              type="button"
              onClick={() => setDeleteConfirm(null)}
              className="text-xs px-3 py-1 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 pb-20 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-3xl font-display tracking-widest text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
          >
            REMINDERS
          </h1>
          <p className="text-xs text-[var(--muted)] tracking-wider mt-1">
            <span className="text-[var(--accent)]">//</span> {upcomingReminders.length} UPCOMING | {pastReminders.length} PAST
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="btn-accent text-xs flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14"/>
            <path d="M5 12h14"/>
          </svg>
          NEW REMINDER
        </button>
      </div>

      {loading ? (
        <div className="text-[var(--muted)] text-sm tracking-wider">
          <span className="text-[var(--accent)]">&gt;</span> LOADING REMINDERS...
        </div>
      ) : reminders.length === 0 ? (
        <div className="card-dystopian p-8 text-center">
          <div className="mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-[var(--muted)]">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
            </svg>
          </div>
          <p className="text-[var(--muted)] mb-2">NO REMINDERS SET</p>
          <p className="text-xs text-[var(--muted-light)] mb-4">
            Create reminders to get notified about important memories.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="btn-outline text-xs"
          >
            CREATE YOUR FIRST REMINDER
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Upcoming Reminders */}
          {upcomingReminders.length > 0 && (
            <section>
              <h2 className="text-sm font-medium tracking-wider text-[var(--foreground)] mb-4 flex items-center gap-2">
                <span className="text-[var(--accent)]">&gt;</span> UPCOMING
                <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30">
                  {upcomingReminders.length}
                </span>
              </h2>
              <div className="space-y-3">
                {upcomingReminders.map((reminder) => (
                  <ReminderCard key={reminder.id} reminder={reminder} isPast={false} />
                ))}
              </div>
            </section>
          )}

          {/* Past Reminders */}
          {pastReminders.length > 0 && (
            <section>
              <h2 className="text-sm font-medium tracking-wider text-[var(--muted)] mb-4 flex items-center gap-2">
                <span className="text-[var(--muted-light)]">&gt;</span> PAST REMINDERS
                <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--card)] text-[var(--muted)] border border-[var(--card-border)]">
                  {pastReminders.length}
                </span>
              </h2>
              <div className="space-y-3">
                {pastReminders.map((reminder) => (
                  <ReminderCard key={reminder.id} reminder={reminder} isPast={true} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Create Reminder Modal */}
      {showCreateModal && (
        <CreateReminderModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchReminders();
          }}
        />
      )}

      {/* Edit Reminder Modal */}
      {editingReminder && (
        <EditReminderModal
          reminder={editingReminder}
          onClose={() => setEditingReminder(null)}
          onUpdated={() => {
            setEditingReminder(null);
            fetchReminders();
          }}
        />
      )}
    </div>
  );
}

// Create Reminder Modal Component
function CreateReminderModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [memories, setMemories] = useState<Array<{ id: string; title: string | null }>>([]);
  const [loadingMemories, setLoadingMemories] = useState(true);
  const [selectedMemoryId, setSelectedMemoryId] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [remindAt, setRemindAt] = useState<Date | null>(null);
  const [channels, setChannels] = useState<string[]>(["email"]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/memories?limit=50")
      .then((res) => (res.ok ? res.json() : { memories: [] }))
      .then((data) => setMemories(data.memories ?? []))
      .catch(() => setMemories([]))
      .finally(() => setLoadingMemories(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedMemoryId) {
      setError("Please select a memory");
      return;
    }
    if (!title.trim()) {
      setError("Please enter a title");
      return;
    }
    if (!remindAt) {
      setError("Please select a date and time");
      return;
    }
    if (channels.length === 0) {
      setError("Please select at least one notification channel");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memory_id: selectedMemoryId,
          title: title.trim(),
          summary: summary.trim() || null,
          remind_at: remindAt!.toISOString(),
          channels,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create reminder");
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create reminder");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleChannel = (channel: string) => {
    setChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-[var(--card-border)] flex items-center justify-between">
          <h2 className="text-lg font-medium tracking-wider">CREATE REMINDER</h2>
          <button type="button" onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/>
              <path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Memory Select */}
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1.5 tracking-wider">
              LINKED MEMORY *
            </label>
            {loadingMemories ? (
              <div className="text-xs text-[var(--muted)]">Loading memories...</div>
            ) : (
              <select
                value={selectedMemoryId}
                onChange={(e) => setSelectedMemoryId(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="">Select a memory...</option>
                {memories.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title || "(Untitled)"}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1.5 tracking-wider">
              REMINDER TITLE *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Meeting with John"
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Summary */}
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1.5 tracking-wider">
              NOTES (OPTIONAL)
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] resize-none"
            />
          </div>

          {/* Date/Time */}
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1.5 tracking-wider">
              REMIND AT *
            </label>
            <DateTimePicker
              selected={remindAt}
              onChange={(date) => setRemindAt(date)}
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
                  onClick={() => toggleChannel(id)}
                  className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                    channels.includes(id)
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
              disabled={submitting}
              className="btn-accent text-xs flex-1 disabled:opacity-50"
            >
              {submitting ? "CREATING..." : "CREATE REMINDER"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-outline text-xs"
            >
              CANCEL
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Reminder Modal Component
function EditReminderModal({
  reminder,
  onClose,
  onUpdated,
}: {
  reminder: Reminder;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [title, setTitle] = useState(reminder.title);
  const [summary, setSummary] = useState(reminder.summary || "");
  const [remindAt, setRemindAt] = useState<Date | null>(new Date(reminder.remind_at));
  const [channels, setChannels] = useState<string[]>(reminder.channels);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Please enter a title");
      return;
    }
    if (!remindAt) {
      setError("Please select a date and time");
      return;
    }
    if (channels.length === 0) {
      setError("Please select at least one notification channel");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/reminders/${reminder.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          summary: summary.trim() || null,
          remind_at: remindAt!.toISOString(),
          channels,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update reminder");
      }

      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update reminder");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleChannel = (channel: string) => {
    setChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-[var(--card-border)] flex items-center justify-between">
          <h2 className="text-lg font-medium tracking-wider">EDIT REMINDER</h2>
          <button type="button" onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/>
              <path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Linked Memory (read-only) */}
          {reminder.memory && (
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1.5 tracking-wider">
                LINKED MEMORY
              </label>
              <div className="px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded text-sm text-[var(--muted)]">
                {reminder.memory.title || "(Untitled)"}
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1.5 tracking-wider">
              REMINDER TITLE *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Summary */}
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1.5 tracking-wider">
              NOTES (OPTIONAL)
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] resize-none"
            />
          </div>

          {/* Date/Time */}
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1.5 tracking-wider">
              REMIND AT *
            </label>
            <DateTimePicker
              selected={remindAt}
              onChange={(date) => setRemindAt(date)}
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
                  onClick={() => toggleChannel(id)}
                  className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                    channels.includes(id)
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
              disabled={submitting}
              className="btn-accent text-xs flex-1 disabled:opacity-50"
            >
              {submitting ? "SAVING..." : "SAVE CHANGES"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-outline text-xs"
            >
              CANCEL
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
