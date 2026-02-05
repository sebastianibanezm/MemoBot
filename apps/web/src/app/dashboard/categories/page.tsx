"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ColorPicker } from "@/components/ColorPicker";
import { NEON_COLORS, type NeonColorKey } from "@/lib/constants/colors";

interface Category {
  id: string;
  name: string;
  description: string | null;
  color: NeonColorKey;
  memory_count: number;
}

interface Memory {
  id: string;
  title: string;
  summary: string | null;
  created_at: string;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState<NeonColorKey>("neon-cyan");
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Expand/collapse state
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categoryMemories, setCategoryMemories] = useState<Record<string, Memory[]>>({});
  const [loadingMemories, setLoadingMemories] = useState<Set<string>>(new Set());

  const fetchCategories = () => {
    fetch("/api/categories")
      .then((res) => (res.ok ? res.json() : { categories: [] }))
      .then((data) => setCategories(data.categories ?? []))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  };

  const fetchMemoriesForCategory = useCallback(async (categoryId: string) => {
    if (categoryMemories[categoryId]) return; // Already loaded
    
    setLoadingMemories((prev) => new Set(prev).add(categoryId));
    
    try {
      const res = await fetch(`/api/memories?categories=${categoryId}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setCategoryMemories((prev) => ({
          ...prev,
          [categoryId]: data.memories ?? [],
        }));
      }
    } catch (e) {
      console.error("Failed to fetch memories for category:", e);
    } finally {
      setLoadingMemories((prev) => {
        const next = new Set(prev);
        next.delete(categoryId);
        return next;
      });
    }
  }, [categoryMemories]);

  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
        // Fetch memories when expanding
        fetchMemoriesForCategory(categoryId);
      }
      return next;
    });
  }, [fetchMemoriesForCategory]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const totalMemories = categories.reduce((sum, c) => sum + c.memory_count, 0);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      setError("Please enter a category name");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          color: newCategoryColor,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create category");
      }

      // Reset form and refresh list
      setNewCategoryName("");
      setNewCategoryColor("neon-cyan");
      setShowAddModal(false);
      fetchCategories();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create category");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/categories/${categoryId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete category");
      }

      setDeleteConfirm(null);
      fetchCategories();
    } catch (e) {
      console.error("Failed to delete category:", e);
    } finally {
      setIsDeleting(false);
    }
  };

  const getCategoryColor = (colorKey: string): { hex: string; glow: string } => {
    const color = NEON_COLORS[colorKey as NeonColorKey];
    return color ?? NEON_COLORS["neon-cyan"];
  };

  return (
    <div className="p-6 pb-20 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
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
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-accent btn-sm"
        >
          <span className="text-lg leading-none">+</span>
          ADD CATEGORY
        </button>
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
            Create a category to get started, or they will be created automatically when you add memories.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {categories.map((c) => {
            const color = getCategoryColor(c.color);
            const isExpanded = expandedCategories.has(c.id);
            const memories = categoryMemories[c.id] ?? [];
            const isLoadingMemories = loadingMemories.has(c.id);
            
            return (
              <li key={c.id} className="relative group">
                {/* Category Header - Clickable to expand/collapse */}
                <button
                  onClick={() => toggleCategory(c.id)}
                  className="card-dystopian glitch-hover block w-full p-4 transition-all duration-300 text-left"
                  style={{
                    borderLeft: `3px solid ${color.hex}`,
                    boxShadow: `inset 0 0 20px ${color.glow.replace("0.5", "0.1")}`,
                    borderBottomLeftRadius: isExpanded ? 0 : undefined,
                    borderBottomRightRadius: isExpanded ? 0 : undefined,
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        {/* Chevron indicator */}
                        <svg 
                          className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                          style={{ color: color.hex }}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor: color.hex,
                            boxShadow: `0 0 8px ${color.glow}`,
                          }}
                        />
                        <span 
                          className="font-medium tracking-wide"
                          style={{ color: color.hex }}
                        >
                          {c.name.toUpperCase()}
                        </span>
                      </div>
                      {c.description && (
                        <p className="text-xs text-[var(--muted)] mt-2 line-clamp-2 pl-9">
                          {c.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-sm text-[var(--muted)]">
                        {c.memory_count} {c.memory_count === 1 ? "memory" : "memories"}
                      </span>
                    </div>
                  </div>
                </button>
                
                {/* Expanded Memories List */}
                {isExpanded && (
                  <div 
                    className="border border-t-0 border-[var(--card-border)] bg-[var(--card)]/50 rounded-b"
                    style={{
                      borderLeft: `3px solid ${color.hex}`,
                    }}
                  >
                    {isLoadingMemories ? (
                      <div className="p-4 text-xs text-[var(--muted)] tracking-wider">
                        <span className="text-[var(--accent)]">&gt;</span> LOADING MEMORIES...
                      </div>
                    ) : memories.length === 0 ? (
                      <div className="p-4 text-xs text-[var(--muted)]">
                        No memories in this category yet.
                      </div>
                    ) : (
                      <ul className="divide-y divide-[var(--card-border)]">
                        {memories.map((m) => (
                          <li key={m.id}>
                            <Link
                              href={`/dashboard/memories/${m.id}`}
                              className="block p-4 hover:bg-[var(--accent)]/5 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-medium text-[var(--foreground)] truncate">
                                    {m.title || "Untitled Memory"}
                                  </h4>
                                  {m.summary && (
                                    <p className="text-xs text-[var(--muted)] mt-1 line-clamp-2">
                                      {m.summary}
                                    </p>
                                  )}
                                </div>
                                <div className="shrink-0 text-xs text-[var(--muted-light)]">
                                  {formatDate(m.created_at)}
                                </div>
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                
                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDeleteConfirm(c.id);
                  }}
                  className="absolute bottom-3 right-3 w-7 h-7 rounded bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-500/20 z-10"
                  title="Delete category"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Add Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg max-w-md w-full p-6">
            <h2 
              className="text-xl font-display tracking-widest text-[var(--foreground)] mb-4"
              style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
            >
              CREATE CATEGORY
            </h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-500 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                  Category Name
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Enter category name..."
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
                  maxLength={50}
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                  Color
                </label>
                <ColorPicker
                  value={newCategoryColor}
                  onChange={setNewCategoryColor}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewCategoryName("");
                  setNewCategoryColor("neon-cyan");
                  setError(null);
                }}
                className="btn-ghost btn-sm flex-1"
              >
                CANCEL
              </button>
              <button
                onClick={handleCreateCategory}
                disabled={isCreating || !newCategoryName.trim()}
                className="btn-accent btn-sm flex-1"
              >
                {isCreating ? "CREATING..." : "CREATE"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg max-w-sm w-full p-6">
            <h2 
              className="text-xl font-display tracking-widest text-[var(--foreground)] mb-2"
              style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
            >
              DELETE CATEGORY
            </h2>
            
            <p className="text-sm text-[var(--muted)] mb-4">
              Are you sure you want to delete this category? Memories in this category will become uncategorized.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn-ghost btn-sm flex-1"
              >
                CANCEL
              </button>
              <button
                onClick={() => handleDeleteCategory(deleteConfirm)}
                disabled={isDeleting}
                className="btn-danger-solid btn-sm flex-1 flex items-center justify-center gap-1"
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
