"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Memory {
  id: string;
  title: string | null;
  content: string;
  summary: string | null;
  category_id: string | null;
  source_platform: string | null;
  created_at: string;
  updated_at: string;
  occurred_at: string | null;
}

export default function MemoriesPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "grid">("list");
  const [page, setPage] = useState(0);
  const limit = 20;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/memories?limit=${limit}&offset=${page * limit}`)
      .then((res) => (res.ok ? res.json() : { memories: [], total: 0 }))
      .then((data) => {
        if (!cancelled) {
          setMemories(data.memories ?? []);
          setTotal(data.total ?? 0);
        }
      })
      .catch(() => {
        if (!cancelled) setMemories([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 pb-20 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 
            className="text-3xl font-display tracking-widest text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
          >
            MEMORIES
          </h1>
          <p className="text-xs text-[var(--muted)] tracking-wider mt-1">
            <span className="text-[var(--accent)]">//</span> {total} RECORDS FOUND
          </p>
        </div>
        
        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-[var(--card)] border border-[var(--card-border)] rounded p-1">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`px-3 py-1.5 rounded text-xs tracking-wider transition-all ${
              view === "list" 
                ? "bg-[var(--accent)] text-[var(--foreground)]" 
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            LIST
          </button>
          <button
            type="button"
            onClick={() => setView("grid")}
            className={`px-3 py-1.5 rounded text-xs tracking-wider transition-all ${
              view === "grid" 
                ? "bg-[var(--accent)] text-[var(--foreground)]" 
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            GRID
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-[var(--muted)] text-sm tracking-wider">
          <span className="text-[var(--accent)]">&gt;</span> LOADING MEMORY ARCHIVE...
        </div>
      ) : memories.length === 0 ? (
        <div className="card-dystopian p-8 text-center">
          <p className="text-[var(--muted)] mb-2">NO MEMORIES FOUND</p>
          <p className="text-xs text-[var(--muted-light)]">
            Add memories via WhatsApp, Telegram, or the agent to populate your archive.
          </p>
        </div>
      ) : view === "list" ? (
        <ul className="space-y-3">
          {memories.map((m) => (
            <li key={m.id}>
              <Link
                href={`/dashboard/memories/${m.id}`}
                className="card-dystopian glitch-hover block p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-medium text-[var(--foreground)] truncate">
                      {m.title || "(UNTITLED)"}
                    </h2>
                    <p className="text-sm text-[var(--muted)] mt-1 line-clamp-2">
                      {m.summary || m.content}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-[var(--muted-light)] tracking-wider">
                      {new Date(m.created_at).toLocaleDateString()}
                    </p>
                    {m.source_platform && (
                      <span className="badge-muted text-[10px] mt-1 inline-block">
                        {m.source_platform.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {memories.map((m) => (
            <Link
              key={m.id}
              href={`/dashboard/memories/${m.id}`}
              className="card-dystopian glitch-hover block p-4"
            >
              <h2 className="font-medium text-[var(--foreground)] line-clamp-1 mb-2">
                {m.title || "(UNTITLED)"}
              </h2>
              <p className="text-sm text-[var(--muted)] line-clamp-3">
                {m.summary || m.content}
              </p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--card-border)]">
                <p className="text-xs text-[var(--muted-light)] tracking-wider">
                  {new Date(m.created_at).toLocaleDateString()}
                </p>
                {m.source_platform && (
                  <span className="badge-muted text-[10px]">
                    {m.source_platform.toUpperCase()}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="btn-outline text-xs disabled:opacity-30 disabled:cursor-not-allowed"
          >
            PREV
          </button>
          <span className="text-[var(--muted)] text-sm tracking-wider">
            PAGE {page + 1} OF {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="btn-outline text-xs disabled:opacity-30 disabled:cursor-not-allowed"
          >
            NEXT
          </button>
        </div>
      )}
    </div>
  );
}
