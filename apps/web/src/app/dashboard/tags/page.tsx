"use client";

import { useState, useEffect } from "react";

interface Tag {
  id: string;
  name: string;
  usage_count: number;
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tags")
      .then((res) => (res.ok ? res.json() : { tags: [] }))
      .then((data) => setTags(data.tags ?? []))
      .catch(() => setTags([]))
      .finally(() => setLoading(false));
  }, []);

  const maxCount = Math.max(...tags.map((t) => t.usage_count), 1);
  const totalUsage = tags.reduce((sum, t) => sum + t.usage_count, 0);

  return (
    <div className="p-6 pb-20 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 
          className="text-3xl font-display tracking-widest text-[var(--foreground)]"
          style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
        >
          TAG CLOUD
        </h1>
        <p className="text-xs text-[var(--muted)] tracking-wider mt-1">
          <span className="text-[var(--accent)]">//</span> {tags.length} UNIQUE TAGS | {totalUsage} TOTAL ASSOCIATIONS
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-[var(--muted)] text-sm tracking-wider">
          <span className="text-[var(--accent)]">&gt;</span> SCANNING TAG REGISTRY...
        </div>
      ) : tags.length === 0 ? (
        <div className="card-dystopian p-8 text-center">
          <p className="text-[var(--muted)] mb-2">NO TAGS FOUND</p>
          <p className="text-xs text-[var(--muted-light)]">
            Tags are extracted automatically when you add memories.
          </p>
        </div>
      ) : (
        <div className="card-dystopian p-6">
          <div className="flex flex-wrap gap-3">
            {tags.map((t) => {
              const scale = maxCount > 0 ? 0.75 + (t.usage_count / maxCount) * 0.6 : 1;
              const isHot = t.usage_count === maxCount && maxCount > 1;
              
              return (
                <span
                  key={t.id}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded border transition-all cursor-default hover:border-[var(--accent)] ${
                    isHot 
                      ? "border-[var(--accent)] bg-[var(--accent-muted)]" 
                      : "border-[var(--card-border)] bg-[var(--background)]"
                  }`}
                  style={{ fontSize: `${scale}rem` }}
                >
                  <span className={isHot ? "text-[var(--accent-dark)]" : "text-[var(--foreground)]"}>
                    {t.name.toUpperCase()}
                  </span>
                  <span className="text-xs text-[var(--muted)] font-mono">
                    [{t.usage_count}]
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
