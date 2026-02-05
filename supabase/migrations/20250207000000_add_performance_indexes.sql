-- ============================================================
-- PERFORMANCE INDEXES FOR MEMOBOT
-- Created: 2025-02-07
-- Purpose: Optimize query performance for common operations
-- ============================================================

-- Index for faster user-scoped memory queries with embedding
-- This helps the match_memories and hybrid_search_memories functions
CREATE INDEX IF NOT EXISTS idx_memories_user_active 
  ON memories (user_id, created_at DESC) 
  WHERE deleted_at IS NULL;

-- Index for full-text search on memories
CREATE INDEX IF NOT EXISTS idx_memories_fts 
  ON memories USING gin(fts) 
  WHERE deleted_at IS NULL;

-- Indexes for memory_relationships lookups (used in get_memory_network)
CREATE INDEX IF NOT EXISTS idx_memory_relationships_a 
  ON memory_relationships (memory_a_id);

CREATE INDEX IF NOT EXISTS idx_memory_relationships_b 
  ON memory_relationships (memory_b_id);

-- Composite index for relationship lookups with similarity score
CREATE INDEX IF NOT EXISTS idx_memory_relationships_a_score 
  ON memory_relationships (memory_a_id, similarity_score DESC);

CREATE INDEX IF NOT EXISTS idx_memory_relationships_b_score 
  ON memory_relationships (memory_b_id, similarity_score DESC);

-- Index for session lookups (used in every message)
CREATE INDEX IF NOT EXISTS idx_sessions_user_platform 
  ON conversation_sessions (user_id, platform, platform_user_id);

-- Index for category lookups
CREATE INDEX IF NOT EXISTS idx_categories_user 
  ON categories (user_id, name);

-- Index for tag lookups
CREATE INDEX IF NOT EXISTS idx_tags_user 
  ON tags (user_id, name);

-- Index for memory_tags joins
CREATE INDEX IF NOT EXISTS idx_memory_tags_memory 
  ON memory_tags (memory_id);

CREATE INDEX IF NOT EXISTS idx_memory_tags_tag 
  ON memory_tags (tag_id);

-- Index for platform_links (used in account resolution)
CREATE INDEX IF NOT EXISTS idx_platform_links_lookup 
  ON platform_links (platform, platform_user_id);

-- ANALYZE tables to update statistics for query planner
ANALYZE memories;
ANALYZE memory_relationships;
ANALYZE conversation_sessions;
ANALYZE categories;
ANALYZE tags;
ANALYZE memory_tags;
ANALYZE platform_links;
