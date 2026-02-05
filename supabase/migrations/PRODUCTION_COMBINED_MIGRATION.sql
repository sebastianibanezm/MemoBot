-- ============================================================
-- MEMOBOT PRODUCTION DATABASE MIGRATION
-- ============================================================
-- Combined migration file for production deployment
-- Run this in Supabase SQL Editor for a new production project
-- Generated: 2026-02-05
-- ============================================================

-- ============================================================
-- MIGRATION 1: Initial Schema (20250203000000)
-- ============================================================

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

-- ============================================================
-- MIGRATION 2: Add Category Color (20250204000000)
-- ============================================================

ALTER TABLE categories ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'neon-cyan';

ALTER TABLE categories ADD CONSTRAINT valid_neon_color CHECK (
  color IS NULL OR color IN (
    'neon-cyan',
    'neon-pink', 
    'neon-green',
    'neon-purple',
    'neon-yellow',
    'neon-orange',
    'neon-blue',
    'neon-red',
    'neon-lime',
    'neon-magenta'
  )
);

-- ============================================================
-- MIGRATION 3: Add Reminders (20250205000000)
-- ============================================================

CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  remind_at TIMESTAMPTZ NOT NULL,
  channels TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reminders_user_id ON reminders(user_id);
CREATE INDEX idx_reminders_remind_at ON reminders(remind_at) WHERE status = 'pending';
CREATE INDEX idx_reminders_memory_id ON reminders(memory_id);
CREATE INDEX idx_reminders_status ON reminders(status);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY reminders_user_isolation ON reminders
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

COMMENT ON TABLE reminders IS 'Stores scheduled reminders linked to memories for notification delivery';
COMMENT ON COLUMN reminders.channels IS 'Array of notification channels: whatsapp, telegram, email';
COMMENT ON COLUMN reminders.status IS 'Reminder status: pending (awaiting send), sent (delivered), failed (delivery error), cancelled (user cancelled)';
COMMENT ON COLUMN reminders.summary IS 'AI-generated reasoning explaining why this reminder was suggested';

-- ============================================================
-- MIGRATION 4: Add Reminder Source Platform (20250205000002)
-- ============================================================

ALTER TABLE reminders 
ADD COLUMN source_platform TEXT DEFAULT 'web' 
CHECK (source_platform IN ('whatsapp', 'telegram', 'web'));

COMMENT ON COLUMN reminders.source_platform IS 'Platform where the reminder was created: whatsapp, telegram, or web';

CREATE INDEX idx_reminders_source_platform ON reminders(source_platform);

-- ============================================================
-- MIGRATION 5: Add Attachments (20250206000000)
-- ============================================================

CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  extracted_content TEXT,
  extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'completed', 'failed', 'unsupported')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attachments_memory ON attachments(memory_id) WHERE memory_id IS NOT NULL;
CREATE INDEX idx_attachments_user ON attachments(user_id);
CREATE INDEX idx_attachments_user_pending ON attachments(user_id, created_at DESC) WHERE memory_id IS NULL;

ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY attachments_select_own ON attachments
  FOR SELECT USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY attachments_insert_own ON attachments
  FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));

CREATE POLICY attachments_update_own ON attachments
  FOR UPDATE USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY attachments_delete_own ON attachments
  FOR DELETE USING (user_id = current_setting('app.current_user_id', true));

-- Storage bucket for attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'memory-attachments',
  'memory-attachments',
  false,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav'
  ]
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY storage_insert_own ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'memory-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY storage_select_own ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'memory-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY storage_delete_own ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'memory-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY storage_service_role ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'memory-attachments')
  WITH CHECK (bucket_id = 'memory-attachments');

CREATE OR REPLACE FUNCTION get_memory_attachment_count(memory_uuid UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INTEGER FROM attachments WHERE memory_id = memory_uuid;
$$;

-- ============================================================
-- MIGRATION 6: Performance Indexes (20250207000000)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_memories_user_active 
  ON memories (user_id, created_at DESC) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_memory_relationships_a_score 
  ON memory_relationships (memory_a_id, similarity_score DESC);

CREATE INDEX IF NOT EXISTS idx_memory_relationships_b_score 
  ON memory_relationships (memory_b_id, similarity_score DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_user_platform 
  ON conversation_sessions (user_id, platform, platform_user_id);

CREATE INDEX IF NOT EXISTS idx_memory_tags_memory 
  ON memory_tags (memory_id);

ANALYZE memories;
ANALYZE memory_relationships;
ANALYZE conversation_sessions;
ANALYZE categories;
ANALYZE tags;
ANALYZE memory_tags;
ANALYZE platform_links;

-- ============================================================
-- MIGRATION 7: Add Stripe Fields (20250208000000)
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_status TEXT DEFAULT 'inactive';

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer 
  ON users(stripe_customer_id) 
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_stripe_status 
  ON users(stripe_status) 
  WHERE stripe_status IS NOT NULL;

COMMENT ON COLUMN users.stripe_customer_id IS 'Stripe Customer ID (cus_xxx)';
COMMENT ON COLUMN users.stripe_subscription_id IS 'Active Stripe Subscription ID (sub_xxx)';
COMMENT ON COLUMN users.stripe_price_id IS 'Current plan price ID (price_xxx)';
COMMENT ON COLUMN users.stripe_current_period_end IS 'Subscription renewal/expiry date';
COMMENT ON COLUMN users.stripe_status IS 'Subscription status: active, past_due, canceled, trialing, inactive';

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- All 8 migrations have been applied.
-- Next steps:
-- 1. Verify tables in Supabase Table Editor
-- 2. Check that RLS is enabled on all tables
-- 3. Collect API keys from Project Settings > API
-- ============================================================
