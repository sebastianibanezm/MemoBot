"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Category {
  id: string;
  name: string;
  memory_count: number;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => (res.ok ? res.json() : { categories: [] }))
      .then((data) => setCategories(data.categories ?? []))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, []);

  const totalMemories = categories.reduce((sum, c) => sum + c.memory_count, 0);

  return (
    <div className="p-6 pb-20 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 
          className="text-3xl font-display tracking-widest text-[var(--foreground)]"
          style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
        >
          CATEGORIES
        </h1>
        <p className="text-xs text-[var(--muted)] tracking-wider mt-1">
          <span className="text-[var(--accent)]">//</span> {categories.length} CLASSIFICATIONS | {totalMemories} TOTAL MEMORIES
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-[var(--muted)] text-sm tracking-wider">
          <span className="text-[var(--accent)]">&gt;</span> LOADING CATEGORY INDEX...
        </div>
      ) : categories.length === 0 ? (
        <div className="card-dystopian p-8 text-center">
          <p className="text-[var(--muted)] mb-2">NO CATEGORIES FOUND</p>
          <p className="text-xs text-[var(--muted-light)]">
            Categories are created automatically when you add memories.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={`/dashboard/memories?categoryId=${c.id}`}
                className="card-dystopian glitch-hover flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--accent)] font-mono">//</span>
                  <span className="font-medium text-[var(--foreground)] tracking-wide">
                    {c.name.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-[var(--muted)]">
                    {c.memory_count} {c.memory_count === 1 ? "memory" : "memories"}
                  </span>
                  <span className="text-[var(--accent)]">&rarr;</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
