-- MemoBot: Initial multi-user schema
-- Run in Supabase SQL Editor or: supabase db push

-- Ensure uuid_generate_v4() is found (Supabase may have uuid-ossp in extensions schema)
SET search_path TO public, extensions;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

-- ============================================================
-- USERS & AUTHENTICATION
-- ============================================================

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE platform_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('whatsapp', 'telegram')),
  platform_user_id TEXT NOT NULL,
  platform_username TEXT,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (platform, platform_user_id)
);

CREATE INDEX idx_platform_links_lookup ON platform_links(platform, platform_user_id);
CREATE INDEX idx_platform_links_user ON platform_links(user_id);

CREATE TABLE link_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('whatsapp', 'telegram')),
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_link_codes_lookup ON link_codes(platform, code) WHERE used_at IS NULL;

-- ============================================================
-- CATEGORIES (per-user)
-- ============================================================

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  embedding vector(512),
  memory_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, name)
);

CREATE INDEX idx_categories_user ON categories(user_id);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_embedding ON categories USING hnsw (embedding vector_cosine_ops);

-- ============================================================
-- TAGS (per-user)
-- ============================================================

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  embedding vector(512),
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, normalized_name)
);

CREATE INDEX idx_tags_user ON tags(user_id);
CREATE INDEX idx_tags_normalized ON tags(user_id, normalized_name);
CREATE INDEX idx_tags_embedding ON tags USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_tags_usage ON tags(user_id, usage_count DESC);

-- ============================================================
-- MEMORIES (per-user)
-- ============================================================

CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  summary TEXT,
  embedding vector(512),
  fts tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', content), 'B')
  ) STORED,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  source_platform TEXT CHECK (source_platform IN ('whatsapp', 'telegram', 'web')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  occurred_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  local_file_path TEXT,
  google_drive_id TEXT,
  dropbox_path TEXT,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_memories_user ON memories(user_id);
CREATE INDEX idx_memories_user_category ON memories(user_id, category_id);
CREATE INDEX idx_memories_embedding ON memories USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_memories_fts ON memories USING gin(fts);
CREATE INDEX idx_memories_user_created ON memories(user_id, created_at DESC);
CREATE INDEX idx_memories_sync ON memories(sync_status) WHERE sync_status = 'pending';

-- ============================================================
-- MEMORY-TAGS JUNCTION
-- ============================================================

CREATE TABLE memory_tags (
  memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (memory_id, tag_id)
);

CREATE INDEX idx_memory_tags_tag ON memory_tags(tag_id);

-- ============================================================
-- MEMORY RELATIONSHIPS
-- ============================================================

CREATE TABLE memory_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  memory_a_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  memory_b_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  relationship_type TEXT DEFAULT 'related',
  similarity_score DECIMAL(3,2) CHECK (similarity_score BETWEEN 0 AND 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_self_relationship CHECK (memory_a_id != memory_b_id)
);

CREATE UNIQUE INDEX unique_memory_pair ON memory_relationships (
  LEAST(memory_a_id, memory_b_id),
  GREATEST(memory_a_id, memory_b_id)
);
CREATE INDEX idx_relationships_a ON memory_relationships(memory_a_id);
CREATE INDEX idx_relationships_b ON memory_relationships(memory_b_id);

-- ============================================================
-- CONVERSATION SESSIONS
-- ============================================================

CREATE TABLE conversation_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_user_id TEXT NOT NULL,
  current_state TEXT DEFAULT 'CONVERSATION' CHECK (current_state IN (
    'CONVERSATION',
    'MEMORY_CAPTURE',
    'MEMORY_ENRICHMENT',
    'MEMORY_DRAFT',
    'LINKING'
  )),
  memory_draft JSONB DEFAULT '{}',
  message_history JSONB DEFAULT '[]',
  enrichment_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX idx_sessions_platform ON conversation_sessions(platform, platform_user_id);
CREATE INDEX idx_sessions_user ON conversation_sessions(user_id);

-- ============================================================
-- USER SETTINGS (per-user)
-- ============================================================

CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claude_api_key TEXT,
  openai_api_key TEXT,
  local_backup_enabled BOOLEAN DEFAULT true,
  local_backup_path TEXT,
  google_drive_enabled BOOLEAN DEFAULT false,
  google_drive_folder_id TEXT,
  google_refresh_token TEXT,
  dropbox_enabled BOOLEAN DEFAULT false,
  dropbox_refresh_token TEXT,
  default_category_id UUID REFERENCES categories(id),
  enrichment_questions_max INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY categories_user_isolation ON categories
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY tags_user_isolation ON tags
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY memories_user_isolation ON memories
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY memory_tags_user_isolation ON memory_tags
  FOR ALL USING (
    memory_id IN (SELECT id FROM memories WHERE user_id = current_setting('app.current_user_id', true))
  );

CREATE POLICY relationships_user_isolation ON memory_relationships
  FOR ALL USING (
    memory_a_id IN (SELECT id FROM memories WHERE user_id = current_setting('app.current_user_id', true))
  );

CREATE POLICY sessions_user_isolation ON conversation_sessions
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY settings_user_isolation ON user_settings
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY platform_links_user_isolation ON platform_links
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

-- ============================================================
-- HELPER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION set_current_user_id(user_id TEXT)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user_id', user_id, true);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VECTOR SEARCH FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION match_memories(
  p_user_id TEXT,
  query_embedding vector(512),
  match_count INT DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  category_id UUID,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.title,
    m.content,
    m.category_id,
    1 - (m.embedding <=> query_embedding) AS similarity,
    m.created_at
  FROM memories m
  WHERE
    m.user_id = p_user_id
    AND m.deleted_at IS NULL
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION hybrid_search_memories(
  p_user_id TEXT,
  query_text TEXT,
  query_embedding vector(512),
  match_count INT DEFAULT 10,
  full_text_weight FLOAT DEFAULT 1.0,
  semantic_weight FLOAT DEFAULT 1.5,
  rrf_k INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  category_id UUID,
  score FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH full_text AS (
    SELECT m.id, ROW_NUMBER() OVER (ORDER BY ts_rank_cd(m.fts, websearch_to_tsquery(query_text)) DESC) AS rank_ix
    FROM memories m
    WHERE m.user_id = p_user_id AND m.deleted_at IS NULL AND m.fts @@ websearch_to_tsquery(query_text)
    LIMIT match_count * 2
  ),
  semantic AS (
    SELECT m.id, ROW_NUMBER() OVER (ORDER BY m.embedding <=> query_embedding) AS rank_ix
    FROM memories m
    WHERE m.user_id = p_user_id AND m.deleted_at IS NULL
    LIMIT match_count * 2
  )
  SELECT
    m.id, m.title, m.content, m.category_id,
    (COALESCE(1.0 / (rrf_k + ft.rank_ix), 0.0) * full_text_weight +
     COALESCE(1.0 / (rrf_k + s.rank_ix), 0.0) * semantic_weight) AS score
  FROM full_text ft
  FULL OUTER JOIN semantic s ON ft.id = s.id
  JOIN memories m ON COALESCE(ft.id, s.id) = m.id
  ORDER BY score DESC
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION get_memory_network(
  p_user_id TEXT,
  query_embedding vector(512),
  initial_count INT DEFAULT 5,
  related_count INT DEFAULT 3,
  similarity_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  degree INT,
  relevance_score FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE
  direct AS (
    SELECT m.id, m.title, m.content, 0 AS degree,
           (1 - (m.embedding <=> query_embedding)) AS relevance_score,
           m.embedding
    FROM memories m
    WHERE m.user_id = p_user_id
      AND m.deleted_at IS NULL
      AND (1 - (m.embedding <=> query_embedding)) > similarity_threshold
    ORDER BY m.embedding <=> query_embedding
    LIMIT initial_count
  ),
  first_degree AS (
    SELECT DISTINCT ON (rel_m.id)
      rel_m.id, rel_m.title, rel_m.content, 1 AS degree,
      GREATEST(mr.similarity_score::float, (1 - (rel_m.embedding <=> d.embedding)) * 0.8) AS relevance_score,
      rel_m.embedding
    FROM direct d
    JOIN memory_relationships mr ON d.id = mr.memory_a_id OR d.id = mr.memory_b_id
    JOIN memories rel_m ON rel_m.id = CASE
      WHEN mr.memory_a_id = d.id THEN mr.memory_b_id
      ELSE mr.memory_a_id
    END
    WHERE rel_m.user_id = p_user_id AND rel_m.deleted_at IS NULL AND rel_m.id NOT IN (SELECT id FROM direct)
    ORDER BY rel_m.id, relevance_score DESC
    LIMIT initial_count * related_count
  ),
  second_degree AS (
    SELECT DISTINCT ON (rel_m.id)
      rel_m.id, rel_m.title, rel_m.content, 2 AS degree,
      GREATEST((mr.similarity_score::float) * 0.7, (1 - (rel_m.embedding <=> fd.embedding)) * 0.6) AS relevance_score,
      rel_m.embedding
    FROM first_degree fd
    JOIN memory_relationships mr ON fd.id = mr.memory_a_id OR fd.id = mr.memory_b_id
    JOIN memories rel_m ON rel_m.id = CASE
      WHEN mr.memory_a_id = fd.id THEN mr.memory_b_id
      ELSE mr.memory_a_id
    END
    WHERE rel_m.user_id = p_user_id
      AND rel_m.deleted_at IS NULL
      AND rel_m.id NOT IN (SELECT id FROM direct)
      AND rel_m.id NOT IN (SELECT id FROM first_degree)
    ORDER BY rel_m.id, relevance_score DESC
    LIMIT initial_count * related_count * related_count
  )
  SELECT combined.id, combined.title, combined.content, combined.degree, combined.relevance_score
  FROM (
    SELECT id, title, content, degree, relevance_score FROM direct
    UNION ALL
    SELECT id, title, content, degree, relevance_score FROM first_degree
    UNION ALL
    SELECT id, title, content, degree, relevance_score FROM second_degree
  ) combined
  ORDER BY degree ASC, relevance_score DESC;
END;
$$;
