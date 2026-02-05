"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

interface Tag {
  id: string;
  name: string;
  usage_count: number;
}

interface Memory {
  id: string;
  title: string;
  summary: string | null;
  created_at: string;
  category_name: string | null;
}

// Calculate optimal bubble sizes based on container size and tag count
function calculateBubbleSizes(
  tagCount: number,
  containerWidth: number,
  containerHeight: number
): { minSize: number; maxSize: number } {
  if (tagCount === 0) return { minSize: 60, maxSize: 120 };
  
  // Estimate available area
  const availableArea = containerWidth * containerHeight * 0.7; // 70% fill factor
  
  // Average area per bubble (accounting for gaps)
  const avgAreaPerBubble = availableArea / tagCount;
  
  // Calculate base size from area (area = π * r², so r = √(area/π))
  const avgRadius = Math.sqrt(avgAreaPerBubble / Math.PI);
  const avgDiameter = avgRadius * 2;
  
  // Set min/max as percentages of average
  // More tags = smaller size range to fit better
  const sizeVariation = Math.max(0.3, 0.6 - (tagCount * 0.01));
  
  let minSize = Math.max(40, avgDiameter * (1 - sizeVariation));
  let maxSize = Math.min(160, avgDiameter * (1 + sizeVariation));
  
  // Ensure minimum readable size
  if (minSize < 40) {
    const scale = 40 / minSize;
    minSize = 40;
    maxSize = Math.min(160, maxSize * scale);
  }
  
  // Cap sizes for very few tags
  if (tagCount <= 3) {
    maxSize = Math.min(maxSize, 120);
  }
  
  return { minSize, maxSize };
}

// Seeded random number generator
function createSeededRandom(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

// Seeded shuffle for consistent random order
function seededShuffle<T>(array: T[], seed: number): T[] {
  const shuffled = [...array];
  let currentIndex = shuffled.length;
  const random = createSeededRandom(seed);

  while (currentIndex > 0) {
    const randomIndex = Math.floor(random() * currentIndex);
    currentIndex--;
    [shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex]!, shuffled[currentIndex]!];
  }

  return shuffled;
}


// Generate random float animation parameters for each bubble
function generateBubbleAnimation(index: number, size: number) {
  // Use index to create unique but consistent animations
  const seed = index * 1.618; // Golden ratio for nice distribution
  const seed2 = index * 2.718; // Different seed for variety
  
  // Slower, more noticeable movement - 8 to 14 seconds per cycle
  const duration = 8 + (seed % 6);
  const delay = (seed * 0.5) % 3; // 0-3 seconds delay
  
  // Larger bubbles move slower and less distance, but still noticeable
  const movementScale = Math.max(0.5, 1 - (size / 250));
  
  // Increased movement range - 15-25px for smaller bubbles
  const xRange = 20 * movementScale;
  const yRange = 18 * movementScale;
  
  // Create varied movement patterns using different trig functions
  const xOffset1 = Math.sin(seed) * xRange;
  const xOffset2 = Math.cos(seed2) * xRange * 0.7;
  const yOffset1 = Math.cos(seed * 1.3) * yRange;
  const yOffset2 = Math.sin(seed2 * 0.8) * yRange * 0.6;
  
  // Create a wandering path with more keyframes for smoother movement
  return {
    animate: {
      x: [
        0, 
        xOffset1, 
        xOffset1 * 0.3 + xOffset2, 
        -xOffset2, 
        -xOffset1 * 0.8, 
        -xOffset1 * 0.4 + xOffset2 * 0.5,
        xOffset2 * 0.6,
        0
      ],
      y: [
        0, 
        -yOffset1, 
        -yOffset1 * 0.5 + yOffset2, 
        yOffset2 * 0.8, 
        yOffset1 * 0.6, 
        yOffset1 * 0.3 - yOffset2 * 0.4,
        -yOffset2 * 0.5,
        0
      ],
    },
    transition: {
      duration,
      delay,
      repeat: Infinity,
      ease: "easeInOut" as const,
      times: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1], // Even distribution
    },
  };
}

export default function TagsPage() {
  const router = useRouter();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [mergeStatus, setMergeStatus] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 500 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Expandable tag list state
  const [expandedTagId, setExpandedTagId] = useState<string | null>(null);
  const [tagMemories, setTagMemories] = useState<Record<string, Memory[]>>({});
  const [loadingMemories, setLoadingMemories] = useState<string | null>(null);
  const [tagSearch, setTagSearch] = useState("");

  // Fetch memories for a tag
  const fetchMemoriesForTag = async (tagId: string) => {
    if (tagMemories[tagId]) return; // Already loaded
    
    setLoadingMemories(tagId);
    try {
      const res = await fetch(`/api/memories?tags=${tagId}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setTagMemories(prev => ({ ...prev, [tagId]: data.memories ?? [] }));
      }
    } catch (e) {
      console.error("Failed to fetch memories for tag:", e);
    } finally {
      setLoadingMemories(null);
    }
  };

  // Toggle tag expansion
  const toggleTag = (tagId: string) => {
    if (expandedTagId === tagId) {
      setExpandedTagId(null);
    } else {
      setExpandedTagId(tagId);
      fetchMemoriesForTag(tagId);
    }
  };

  // Navigate to memory
  const goToMemory = (memoryId: string) => {
    router.push(`/dashboard/memories?id=${memoryId}`);
  };

  // Measure container size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [loading, tags]);

  // Auto-merge similar tags on load
  useEffect(() => {
    fetch("/api/tags/merge", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data.merged > 0) {
          setMergeStatus(`Merged ${data.merged} similar tags`);
          // Clear status after 3 seconds
          setTimeout(() => setMergeStatus(null), 3000);
        }
      })
      .catch(() => {/* ignore merge errors */});
  }, []);

  useEffect(() => {
    fetch("/api/tags")
      .then((res) => (res.ok ? res.json() : { tags: [] }))
      .then((data) => setTags(data.tags ?? []))
      .catch(() => setTags([]))
      .finally(() => setLoading(false));
  }, [mergeStatus]); // Refetch when merge completes

  // Calculate dynamic bubble sizes based on container and tag count
  const { minSize, maxSize } = useMemo(() => {
    return calculateBubbleSizes(tags.length, containerSize.width, containerSize.height);
  }, [tags.length, containerSize.width, containerSize.height]);

  const maxCount = Math.max(...tags.map((t) => t.usage_count), 1);
  const totalUsage = tags.reduce((sum, t) => sum + t.usage_count, 0);

  // Shuffle tags for random visual arrangement (use consistent seed based on tag count)
  const shuffledTags = useMemo(() => {
    if (tags.length === 0) return [];
    // Use sum of tag IDs as seed for consistent shuffle per user's tag set
    const seed = tags.reduce((sum, t) => sum + t.id.charCodeAt(0), 0);
    return seededShuffle(tags, seed);
  }, [tags]);

  // Calculate sizes for all bubbles
  const bubbleSizes = useMemo(() => {
    const sizeRange = maxSize - minSize;
    return shuffledTags.map((tag) => {
      const ratio = maxCount > 1 ? (tag.usage_count - 1) / (maxCount - 1) : 0;
      return minSize + (sizeRange * ratio);
    });
  }, [shuffledTags, minSize, maxSize, maxCount]);

  // Memoize bubble animations to prevent regeneration on every render
  const bubbleAnimations = useMemo(() => {
    return shuffledTags.map((_, index) => {
      const size = bubbleSizes[index] || 60;
      return generateBubbleAnimation(index, size);
    });
  }, [shuffledTags, bubbleSizes]);

  // Tags sorted by usage for the list view
  const sortedTags = useMemo(() => {
    return [...tags].sort((a, b) => b.usage_count - a.usage_count);
  }, [tags]);

  // Filtered tags based on search
  const filteredTags = useMemo(() => {
    if (!tagSearch.trim()) return sortedTags;
    const search = tagSearch.toLowerCase().trim();
    return sortedTags.filter(tag => 
      tag.name.toLowerCase().includes(search)
    );
  }, [sortedTags, tagSearch]);

  return (
    <div className="p-4 h-[calc(100vh-80px)] flex flex-col overflow-hidden">
      {/* Header - compact */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 
            className="text-2xl font-display tracking-widest text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
          >
            TAG CLOUD
          </h1>
          <p className="text-xs text-[var(--muted)] tracking-wider">
            <span className="text-[var(--accent)]">//</span> {tags.length} UNIQUE TAGS | {totalUsage} TOTAL ASSOCIATIONS
          </p>
        </div>
        
        {/* Merge Status Notification */}
        {mergeStatus && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="px-3 py-1.5 bg-[var(--accent-muted)] border border-[var(--accent)] rounded text-xs text-[var(--accent)] tracking-wider"
          >
            <span className="text-[var(--accent)]">&gt;</span> {mergeStatus.toUpperCase()}
          </motion.div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-[var(--muted)] text-sm tracking-wider flex-1 flex items-center justify-center">
          <span className="text-[var(--accent)]">&gt;</span> SCANNING TAG REGISTRY...
        </div>
      ) : tags.length === 0 ? (
        <div className="card-dystopian p-8 text-center flex-1 flex items-center justify-center">
          <div>
            <p className="text-[var(--muted)] mb-2">NO TAGS FOUND</p>
            <p className="text-xs text-[var(--muted-light)]">
              Tags are extracted automatically when you add memories.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden gap-4">
          {/* Bubble Container - fixed height */}
          <div 
            ref={containerRef}
            className="card-dystopian overflow-hidden h-[45%] min-h-[200px] flex flex-wrap gap-2 p-4 items-center justify-around content-around flex-shrink-0"
          >
          {/* Animated Tag Bubbles */}
          {shuffledTags.map((t, index) => {
            const size = bubbleSizes[index] || 60;
            const ratio = maxCount > 1 ? (t.usage_count - 1) / (maxCount - 1) : 0;
            
            // Dynamic font size based on bubble size (proportional scaling)
            const fontSize = Math.max(8, Math.min(16, size * 0.12));
            const countSize = Math.max(7, Math.min(12, size * 0.09));
            
            // Determine if this is the most used tag
            const isHot = t.usage_count === maxCount && maxCount > 1;
            
            // Calculate opacity based on usage (more used = more opaque)
            const opacity = 0.4 + (ratio * 0.6);
            
            // Get animation for this bubble
            const animation = bubbleAnimations[index];
            
            return (
              // Outer wrapper for floating animation
              <motion.div
                key={t.id}
                animate={animation?.animate}
                transition={animation?.transition}
                style={{ display: 'inline-block' }}
              >
                {/* Inner element for entrance animation and hover */}
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ 
                    opacity: 1, 
                    scale: 1,
                  }}
                  transition={{
                    opacity: { duration: 0.3, delay: index * 0.03 },
                    scale: { duration: 0.4, delay: index * 0.03, type: "spring", stiffness: 200 },
                  }}
                  whileHover={{ 
                    scale: 1.15, 
                    zIndex: 50,
                    transition: { duration: 0.2, type: "tween" }
                  }}
                  className={`group relative flex flex-col items-center justify-center rounded-full border-2 cursor-default ${
                    isHot 
                      ? "border-[var(--accent)] bg-[var(--accent)]" 
                      : "border-[var(--card-border)] hover:border-[var(--accent)]"
                  }`}
                  style={{ 
                    width: `${size}px`, 
                    height: `${size}px`,
                    backgroundColor: isHot 
                      ? 'var(--accent)' 
                      : `rgba(var(--accent-rgb, 0, 179, 74), ${opacity * 0.3})`,
                    boxShadow: isHot 
                      ? '0 0 20px rgba(var(--accent-rgb, 0, 179, 74), 0.5)' 
                      : 'none'
                  }}
                  title={`${t.name}: ${t.usage_count} ${t.usage_count === 1 ? 'use' : 'uses'}`}
                >
                {/* Pulse ring for hot tags */}
                {isHot && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-[var(--accent)]"
                    animate={{ 
                      scale: [1, 1.3, 1.3],
                      opacity: [0.8, 0, 0]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeOut"
                    }}
                  />
                )}
                
                {/* Tag Name - dynamically sized */}
                <span 
                  className={`text-center font-medium leading-tight px-1 ${
                    isHot ? "text-white" : "text-[var(--foreground)]"
                  }`}
                  style={{ 
                    fontSize: `${fontSize}px`,
                    maxWidth: `${size - 8}px`,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: size > 80 ? 2 : 1,
                    WebkitBoxOrient: 'vertical',
                    wordBreak: 'break-word',
                    lineHeight: 1.1,
                  }}
                >
                  {t.name.toUpperCase()}
                </span>
                
                {/* Usage Count - dynamically sized */}
                <span 
                  className={`font-mono ${
                    isHot 
                      ? "text-white/80" 
                      : "text-[var(--muted)]"
                  }`}
                  style={{
                    fontSize: `${countSize}px`,
                    marginTop: `${Math.max(1, size * 0.02)}px`,
                  }}
                >
                  {t.usage_count}
                </span>
                </motion.div>
              </motion.div>
            );
          })}
          </div>

          {/* Tag List Section */}
          <div className="card-dystopian flex-1 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-[var(--card-border)] flex-shrink-0">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-sm font-medium tracking-wider text-[var(--foreground)] flex-shrink-0">
                  <span className="text-[var(--accent)]">//</span> ALL TAGS
                </h2>
                
                {/* Search Input */}
                <div className="relative flex-1 max-w-xs">
                  <input
                    type="text"
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    placeholder="Search tags..."
                    className="w-full px-3 py-1.5 text-xs bg-[var(--background)] border border-[var(--card-border)] rounded text-[var(--foreground)] placeholder:text-[var(--muted-light)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                  {tagSearch && (
                    <button
                      onClick={() => setTagSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18"/>
                        <path d="m6 6 12 12"/>
                      </svg>
                    </button>
                  )}
                </div>
                
                {/* Result count */}
                <span className="text-[10px] text-[var(--muted)] font-mono flex-shrink-0">
                  {filteredTags.length}/{sortedTags.length}
                </span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {filteredTags.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-[var(--muted)]">
                  No tags match &quot;{tagSearch}&quot;
                </div>
              ) : filteredTags.map((tag) => (
                <div key={tag.id} className="border-b border-[var(--card-border)] last:border-b-0">
                  {/* Tag Row */}
                  <button
                    onClick={() => toggleTag(tag.id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--background-alt)] transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[var(--accent)] text-xs">
                        {expandedTagId === tag.id ? '▼' : '▶'}
                      </span>
                      <span className="text-sm text-[var(--foreground)] font-medium">
                        #{tag.name}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--muted)] font-mono bg-[var(--background-alt)] px-2 py-0.5 rounded">
                      {tag.usage_count} {tag.usage_count === 1 ? 'memory' : 'memories'}
                    </span>
                  </button>
                  
                  {/* Expanded Memory List */}
                  <AnimatePresence>
                    {expandedTagId === tag.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden bg-[var(--background-alt)]"
                      >
                        {loadingMemories === tag.id ? (
                          <div className="px-8 py-4 text-xs text-[var(--muted)]">
                            <span className="text-[var(--accent)]">&gt;</span> Loading memories...
                          </div>
                        ) : tagMemories[tag.id]?.length === 0 ? (
                          <div className="px-8 py-4 text-xs text-[var(--muted)]">
                            No memories found with this tag.
                          </div>
                        ) : (
                          <div className="py-1">
                            {tagMemories[tag.id]?.map((memory) => (
                              <button
                                key={memory.id}
                                onClick={() => goToMemory(memory.id)}
                                className="w-full px-8 py-2 flex items-center justify-between hover:bg-[var(--card-hover)] transition-colors text-left group"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs text-[var(--foreground)] truncate group-hover:text-[var(--accent)]">
                                    {memory.title}
                                  </div>
                                  {memory.summary && (
                                    <div className="text-[10px] text-[var(--muted)] truncate mt-0.5">
                                      {memory.summary}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                                  {memory.category_name && (
                                    <span className="text-[10px] text-[var(--muted-light)] bg-[var(--background)] px-1.5 py-0.5 rounded">
                                      {memory.category_name}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-[var(--muted-light)] font-mono">
                                    {new Date(memory.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
