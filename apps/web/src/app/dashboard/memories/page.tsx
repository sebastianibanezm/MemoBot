"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

interface Memory {
  id: string;
  title: string | null;
  content: string;
  summary: string | null;
  category_id: string | null;
  category_name: string | null;
  tags: string[];
  source_platform: string | null;
  created_at: string;
  updated_at: string;
  occurred_at: string | null;
}

interface Category {
  id: string;
  name: string;
  memory_count: number;
}

interface Tag {
  id: string;
  name: string;
  usage_count: number;
}

export default function MemoriesPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "grid">("list");
  const [page, setPage] = useState(0);
  const limit = 20;

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(0); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [selectedCategoryIds, selectedTagIds]);

  // Fetch categories and tags on mount
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

  // Fetch memories with search and filters
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(page * limit));
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (selectedCategoryIds.length > 0) params.set("categories", selectedCategoryIds.join(","));
    if (selectedTagIds.length > 0) params.set("tags", selectedTagIds.join(","));

    fetch(`/api/memories?${params.toString()}`)
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
  }, [page, debouncedSearch, selectedCategoryIds, selectedTagIds]);

  const toggleCategory = useCallback((categoryId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  }, []);

  const toggleTag = useCallback((tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setDebouncedSearch("");
    setSelectedCategoryIds([]);
    setSelectedTagIds([]);
  }, []);

  const hasActiveFilters = debouncedSearch || selectedCategoryIds.length > 0 || selectedTagIds.length > 0;

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

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search memories by title or content..."
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--card)] border border-[var(--card-border)] rounded text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18"/>
                <path d="m6 6 12 12"/>
              </svg>
            </button>
          )}
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Category Filter */}
          <div className="relative" ref={categoryDropdownRef}>
            <button
              type="button"
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className={`px-3 py-2 bg-[var(--card)] border rounded text-xs tracking-wider transition-colors flex items-center gap-2 ${
                selectedCategoryIds.length > 0
                  ? "border-[var(--accent)] text-[var(--foreground)]"
                  : "border-[var(--card-border)] text-[var(--foreground)]"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 7h-7m7 10h-7M4 4h.01M4 12h.01M4 20h.01M8 4v0a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v0a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1ZM8 12v0a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v0a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1ZM8 20v0a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v0a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1Z"/>
              </svg>
              {selectedCategoryIds.length > 0 ? (
                <span>{selectedCategoryIds.length} CATEGOR{selectedCategoryIds.length > 1 ? "IES" : "Y"} SELECTED</span>
              ) : (
                <span>FILTER BY CATEGORIES</span>
              )}
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </button>

            {/* Category Dropdown */}
            {showCategoryDropdown && (
              <div className="absolute top-full left-0 mt-1 w-64 max-h-64 overflow-y-auto bg-[var(--card)] border border-[var(--card-border)] rounded shadow-lg z-20">
                {categories.length === 0 ? (
                  <div className="p-3 text-xs text-[var(--muted)]">No categories available</div>
                ) : (
                  <div className="p-2 space-y-1">
                    {categories.map((cat) => (
                      <label
                        key={cat.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--background-alt)] cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCategoryIds.includes(cat.id)}
                          onChange={() => toggleCategory(cat.id)}
                          className="w-4 h-4 rounded border-[var(--card-border)] text-[var(--accent)] focus:ring-[var(--accent)] focus:ring-offset-0 bg-[var(--background)]"
                        />
                        <span className="text-xs text-[var(--foreground)] flex-1">
                          {cat.name}
                        </span>
                        <span className="text-[10px] text-[var(--muted)]">
                          {cat.memory_count}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tag Filter */}
          <div className="relative" ref={tagDropdownRef}>
            <button
              type="button"
              onClick={() => setShowTagDropdown(!showTagDropdown)}
              className={`px-3 py-2 bg-[var(--card)] border rounded text-xs tracking-wider transition-colors flex items-center gap-2 ${
                selectedTagIds.length > 0
                  ? "border-[var(--accent)] text-[var(--foreground)]"
                  : "border-[var(--card-border)] text-[var(--foreground)]"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/>
                <path d="M7 7h.01"/>
              </svg>
              {selectedTagIds.length > 0 ? (
                <span>{selectedTagIds.length} TAG{selectedTagIds.length > 1 ? "S" : ""} SELECTED</span>
              ) : (
                <span>FILTER BY TAGS</span>
              )}
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </button>

            {/* Tag Dropdown */}
            {showTagDropdown && (
              <div className="absolute top-full left-0 mt-1 w-64 max-h-64 overflow-y-auto bg-[var(--card)] border border-[var(--card-border)] rounded shadow-lg z-20">
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

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-3 py-2 text-xs tracking-wider text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18"/>
                <path d="m6 6 12 12"/>
              </svg>
              CLEAR FILTERS
            </button>
          )}
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-[var(--muted)] tracking-wider">ACTIVE FILTERS:</span>
            {debouncedSearch && (
              <span className="text-[10px] px-2 py-1 rounded bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30 flex items-center gap-1">
                &quot;{debouncedSearch}&quot;
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="hover:text-[var(--foreground)]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18"/>
                    <path d="m6 6 12 12"/>
                  </svg>
                </button>
              </span>
            )}
            {selectedCategoryIds.map((categoryId) => {
              const category = categories.find((c) => c.id === categoryId);
              return category ? (
                <span
                  key={categoryId}
                  className="text-[10px] px-2 py-1 rounded bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30 flex items-center gap-1"
                >
                  {category.name.toUpperCase()}
                  <button
                    type="button"
                    onClick={() => toggleCategory(categoryId)}
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
                    {/* Category and Tags */}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {m.category_name && (
                        <span className="badge text-[10px]">
                          {m.category_name.toUpperCase()}
                        </span>
                      )}
                      {m.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-2 py-0.5 rounded bg-[var(--background-alt)] text-[var(--muted)] border border-[var(--card-border)]"
                        >
                          #{tag}
                        </span>
                      ))}
                      {m.tags.length > 3 && (
                        <span className="text-[10px] text-[var(--muted-light)]">
                          +{m.tags.length - 3} more
                        </span>
                      )}
                    </div>
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
              <div className="flex items-start justify-between gap-2 mb-2">
                <h2 className="font-medium text-[var(--foreground)] line-clamp-1 flex-1">
                  {m.title || "(UNTITLED)"}
                </h2>
                {m.category_name && (
                  <span className="badge text-[10px] flex-shrink-0">
                    {m.category_name.toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--muted)] line-clamp-2">
                {m.summary || m.content}
              </p>
              {/* Tags */}
              {m.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {m.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--background-alt)] text-[var(--muted)] border border-[var(--card-border)]"
                    >
                      #{tag}
                    </span>
                  ))}
                  {m.tags.length > 3 && (
                    <span className="text-[10px] text-[var(--muted-light)]">
                      +{m.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
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
