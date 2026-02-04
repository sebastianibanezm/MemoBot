# MemoBot: Complete Development Plan for Cursor AI Implementation

**MemoBot** is a multi-user AI memory assistant accessible via WhatsApp and Telegram that enriches, categorizes, tags, and stores memories with semantic search and relationship discovery. Each user has their own isolated memory vault.

---

## System architecture overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │  WhatsApp Chat   │  │  Telegram Chat   │  │  Web Dashboard (Next.js) │   │
│  │  (Cloud API)     │  │  (Bot API)       │  │  Clerk Auth + UI         │   │
│  └────────┬─────────┘  └────────┬─────────┘  └───────────┬──────────────┘   │
└───────────┼─────────────────────┼────────────────────────┼──────────────────┘
            │                     │                        │
            ▼                     ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND SERVER (Node.js)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    AUTHENTICATION LAYER                              │    │
│  │  Clerk JWT verification │ Platform account linking │ User resolution │    │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                  │                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    WEBHOOK HANDLERS                                  │    │
│  │  /webhook/whatsapp  │  /webhook/telegram  │  /api/* (Clerk auth)    │    │
│  └───────────────────────────────┬─────────────────────────────────────┘    │
│                                  ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    MESSAGE ROUTER                                    │    │
│  │  User resolution • Platform-agnostic processing • Session mgmt      │    │
│  └───────────────────────────────┬─────────────────────────────────────┘    │
│                                  ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    AI AGENT (Claude API)                             │    │
│  │  • Follow-up generation • Category assignment • Tag extraction       │    │
│  │  • Relationship detection • Query understanding • RAG orchestration  │    │
│  └───────────────────────────────┬─────────────────────────────────────┘    │
│                                  ▼                                           │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────┐    │
│  │ Embedding      │  │ Categorizer    │  │ Sync Service               │    │
│  │ Service        │  │ + Tagger       │  │ (Local/GDrive/Dropbox)     │    │
│  │ (OpenAI)       │  │ (per-user)     │  │ (per-user config)          │    │
│  └────────┬───────┘  └────────┬───────┘  └────────────┬───────────────┘    │
└───────────┼───────────────────┼────────────────────────┼────────────────────┘
            │                   │                        │
            ▼                   ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┐  ┌──────────────────────────┐ │
│  │            SUPABASE                       │  │    FILE STORAGE          │ │
│  │  ┌──────────────────────────────────┐    │  │  (per-user isolated)     │ │
│  │  │  PostgreSQL + pgvector           │    │  │  ┌────────────────────┐  │ │
│  │  │  • users (linked to Clerk)       │    │  │  │  Local / GDrive /  │  │ │
│  │  │  • platform_links                │    │  │  │  Dropbox           │  │ │
│  │  │  • memories (user_id scoped)     │    │  │  └────────────────────┘  │ │
│  │  │  • categories (user_id scoped)   │    │  │                          │ │
│  │  │  • tags (user_id scoped)         │    │  │                          │ │
│  │  │  • memory_relationships          │    │  │                          │ │
│  │  └──────────────────────────────────┘    │  │                          │ │
│  │  ┌──────────────────────────────────┐    │  │                          │ │
│  │  │  Row Level Security (RLS)        │    │  │                          │ │
│  │  │  All queries filtered by user_id │    │  │                          │ │
│  │  └──────────────────────────────────┘    │  │                          │ │
│  └──────────────────────────────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Clerk authentication integration

### Account linking flow (WhatsApp/Telegram → Clerk User)

Since WhatsApp/Telegram users can't directly authenticate with Clerk, we need a linking mechanism:

```
┌─────────────────────────────────────────────────────────────────┐
│                     ACCOUNT LINKING FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User signs up/logs in via Web Dashboard (Clerk)             │
│                         ↓                                        │
│  2. User goes to Settings → "Link WhatsApp" or "Link Telegram"  │
│                         ↓                                        │
│  3. System generates 6-digit code (valid 10 min, single-use)    │
│                         ↓                                        │
│  4. User sends code to MemoBot via WhatsApp/Telegram            │
│     Example: User texts "LINK 847291" to the bot                │
│                         ↓                                        │
│  5. Bot verifies code → Links platform_user_id to clerk_user_id │
│                         ↓                                        │
│  6. All future messages from that number/account are linked     │
│     to the authenticated Clerk user                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Clerk setup requirements

**1. Create Clerk Application**
```
- Go to clerk.com → Create application
- Enable Email/Password authentication
- Optionally enable Google/GitHub OAuth
- Note: Application ID and API keys
```

**2. Configure Clerk for Next.js**
```bash
npm install @clerk/nextjs
```

**3. Environment variables**
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

### Backend JWT verification

```typescript
// src/middleware/auth.ts
import { createClerkClient } from '@clerk/backend';

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// For API routes (web dashboard)
export async function verifyClerkToken(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  
  const token = authHeader.slice(7);
  
  try {
    const { sub: userId } = await clerk.verifyToken(token);
    return userId;
  } catch {
    return null;
  }
}

// For messaging webhooks - resolve user from platform link
export async function resolveUserFromPlatform(
  platform: 'whatsapp' | 'telegram',
  platformUserId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('platform_links')
    .select('user_id')
    .eq('platform', platform)
    .eq('platform_user_id', platformUserId)
    .single();
  
  return data?.user_id ?? null;
}
```

---

## Supabase database schema (multi-user)

### Complete SQL schema with user isolation

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

-- ============================================================
-- USERS & AUTHENTICATION
-- ============================================================

-- Users table (synced from Clerk)
CREATE TABLE users (
  id TEXT PRIMARY KEY,  -- Clerk user ID (e.g., "user_2abc123")
  email TEXT UNIQUE,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform links (WhatsApp/Telegram → Clerk User)
CREATE TABLE platform_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('whatsapp', 'telegram')),
  platform_user_id TEXT NOT NULL,  -- Phone number or Telegram user ID
  platform_username TEXT,  -- Telegram username if available
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Each platform account can only be linked to one user
  UNIQUE (platform, platform_user_id)
);

CREATE INDEX idx_platform_links_lookup ON platform_links(platform, platform_user_id);
CREATE INDEX idx_platform_links_user ON platform_links(user_id);

-- Link codes for account connection
CREATE TABLE link_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('whatsapp', 'telegram')),
  code TEXT NOT NULL,  -- 6-digit code
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
  
  -- Category names unique per user
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
  
  -- Tag names unique per user
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
  
  -- Content
  title TEXT,
  content TEXT NOT NULL,
  summary TEXT,
  
  -- Vector embedding
  embedding vector(512),
  
  -- Full-text search
  fts tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', content), 'B')
  ) STORED,
  
  -- Classification
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  
  -- Source tracking
  source_platform TEXT CHECK (source_platform IN ('whatsapp', 'telegram', 'web')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  occurred_at TIMESTAMPTZ,
  
  -- Sync tracking
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  local_file_path TEXT,
  google_drive_id TEXT,
  dropbox_path TEXT,
  
  -- Soft delete
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
  
  CONSTRAINT unique_memory_pair UNIQUE (
    LEAST(memory_a_id, memory_b_id),
    GREATEST(memory_a_id, memory_b_id)
  ),
  CONSTRAINT no_self_relationship CHECK (memory_a_id != memory_b_id)
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
  
  -- State machine (CONVERSATION is default - not expecting memory creation)
  current_state TEXT DEFAULT 'CONVERSATION' CHECK (current_state IN (
    'CONVERSATION',      -- Default: answering questions, general chat
    'MEMORY_CAPTURE',    -- User said "memory" - collecting initial content
    'MEMORY_ENRICHMENT', -- Asking follow-up questions (max 2-3)
    'MEMORY_DRAFT',      -- Showing draft for user confirmation
    'LINKING'            -- Account linking flow
  )),
  
  -- Draft memory being built (JSON with content_parts, title, etc.)
  memory_draft JSONB DEFAULT '{}',
  
  -- Conversation history for context (last N messages for Claude)
  message_history JSONB DEFAULT '[]',
  
  -- Tracking
  enrichment_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')  -- Longer expiry
);

CREATE INDEX idx_sessions_platform ON conversation_sessions(platform, platform_user_id);
CREATE INDEX idx_sessions_user ON conversation_sessions(user_id);

-- ============================================================
-- USER SETTINGS (per-user)
-- ============================================================

CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Optional user-provided API keys
  claude_api_key TEXT,
  openai_api_key TEXT,
  
  -- Storage preferences
  local_backup_enabled BOOLEAN DEFAULT true,
  local_backup_path TEXT,
  google_drive_enabled BOOLEAN DEFAULT false,
  google_drive_folder_id TEXT,
  google_refresh_token TEXT,
  dropbox_enabled BOOLEAN DEFAULT false,
  dropbox_refresh_token TEXT,
  
  -- Preferences
  default_category_id UUID REFERENCES categories(id),
  enrichment_questions_max INTEGER DEFAULT 3,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_links ENABLE ROW LEVEL SECURITY;

-- Categories: users can only access their own
CREATE POLICY categories_user_isolation ON categories
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

-- Tags: users can only access their own  
CREATE POLICY tags_user_isolation ON tags
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

-- Memories: users can only access their own
CREATE POLICY memories_user_isolation ON memories
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

-- Memory tags: through memory ownership
CREATE POLICY memory_tags_user_isolation ON memory_tags
  FOR ALL USING (
    memory_id IN (SELECT id FROM memories WHERE user_id = current_setting('app.current_user_id', true))
  );

-- Relationships: through memory ownership
CREATE POLICY relationships_user_isolation ON memory_relationships
  FOR ALL USING (
    memory_a_id IN (SELECT id FROM memories WHERE user_id = current_setting('app.current_user_id', true))
  );

-- Sessions: users can only access their own
CREATE POLICY sessions_user_isolation ON conversation_sessions
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

-- Settings: users can only access their own
CREATE POLICY settings_user_isolation ON user_settings
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

-- Platform links: users can only see their own
CREATE POLICY platform_links_user_isolation ON platform_links
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

-- ============================================================
-- HELPER FUNCTION: Set current user for RLS
-- ============================================================

CREATE OR REPLACE FUNCTION set_current_user_id(user_id TEXT)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user_id', user_id, true);
END;
$$ LANGUAGE plpgsql;
```

### SQL functions for vector search (user-scoped)

```sql
-- User-scoped semantic search
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

-- User-scoped hybrid search
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

-- User-scoped 2-degree network retrieval
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
      GREATEST(mr.similarity_score, (1 - (rel_m.embedding <=> d.embedding)) * 0.8) AS relevance_score,
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
      GREATEST(mr.similarity_score * 0.7, (1 - (rel_m.embedding <=> fd.embedding)) * 0.6) AS relevance_score,
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
  SELECT id, title, content, degree, relevance_score
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
```

---

## Account linking implementation

### Generate link code (backend API)

```typescript
// src/api/link-code.ts
import { randomInt } from 'crypto';

export async function generateLinkCode(
  userId: string, 
  platform: 'whatsapp' | 'telegram'
): Promise<string> {
  // Generate 6-digit code
  const code = randomInt(100000, 999999).toString();
  
  // Expire any existing unused codes for this user/platform
  await supabase
    .from('link_codes')
    .update({ expires_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('platform', platform)
    .is('used_at', null);
  
  // Create new code
  await supabase.from('link_codes').insert({
    user_id: userId,
    platform,
    code,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()  // 10 min
  });
  
  return code;
}
```

### Verify link code (webhook handler)

```typescript
// src/services/account-linking.ts
export async function verifyAndLinkAccount(
  platform: 'whatsapp' | 'telegram',
  platformUserId: string,
  code: string
): Promise<{ success: boolean; message: string }> {
  // Find valid code
  const { data: linkCode, error } = await supabase
    .from('link_codes')
    .select('*')
    .eq('platform', platform)
    .eq('code', code)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .single();
  
  if (error || !linkCode) {
    return { success: false, message: 'Invalid or expired code. Please generate a new one from the dashboard.' };
  }
  
  // Check if platform account already linked
  const { data: existingLink } = await supabase
    .from('platform_links')
    .select('user_id')
    .eq('platform', platform)
    .eq('platform_user_id', platformUserId)
    .single();
  
  if (existingLink) {
    return { success: false, message: 'This account is already linked to a MemoBot user.' };
  }
  
  // Create the link
  await supabase.from('platform_links').insert({
    user_id: linkCode.user_id,
    platform,
    platform_user_id: platformUserId
  });
  
  // Mark code as used
  await supabase
    .from('link_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', linkCode.id);
  
  return { success: true, message: '✅ Account linked successfully! You can now use MemoBot. Try asking me about anything, or say "memory" to create a new memory.' };
}
```

---

## Agent architecture (Claude tool-use pattern)

MemoBot uses Claude's native **tool-use (function calling)** capability for structured actions. The agent operates in **conversation mode by default**, using RAG to answer questions about past memories. Users explicitly enter **memory creation mode** by saying "memory".

### Conversation state machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MEMOBOT STATE MACHINE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      CONVERSATION (default)                          │   │
│   │   • Greets user: "How can I help you today?"                        │   │
│   │   • Answers questions using RAG (2-degree memory retrieval)         │   │
│   │   • General chat and assistance                                      │   │
│   │   • Detects intent to create memory                                  │   │
│   └─────────────────────────────┬───────────────────────────────────────┘   │
│                                 │                                            │
│                    User says "memory" or                                     │
│                    "I want to save something"                                │
│                                 │                                            │
│                                 ▼                                            │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      MEMORY_CAPTURE                                  │   │
│   │   • "What would you like to remember?"                              │   │
│   │   • Captures initial memory content                                  │   │
│   └─────────────────────────────┬───────────────────────────────────────┘   │
│                                 │                                            │
│                         Content received                                     │
│                                 │                                            │
│                                 ▼                                            │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      MEMORY_ENRICHMENT                               │   │
│   │   • Asks 1-3 contextual follow-up questions                         │   │
│   │   • User can say "done" or "save" to skip                           │   │
│   │   • Automatically proceeds when enough detail gathered              │   │
│   └─────────────────────────────┬───────────────────────────────────────┘   │
│                                 │                                            │
│                    User says "done"/"save" OR                                │
│                    Agent determines enough info                              │
│                                 │                                            │
│                                 ▼                                            │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      MEMORY_DRAFT                                    │   │
│   │   • Shows formatted draft with title, summary, category, tags       │   │
│   │   • User can: "confirm", "edit", or "cancel"                        │   │
│   └─────────────────────────────┬───────────────────────────────────────┘   │
│                                 │                                            │
│              ┌──────────────────┼──────────────────┐                        │
│              │                  │                  │                        │
│         "confirm"            "edit"            "cancel"                     │
│              │                  │                  │                        │
│              ▼                  │                  ▼                        │
│   ┌──────────────────┐         │       ┌──────────────────┐                │
│   │  MEMORY_STORE    │         │       │  Return to       │                │
│   │  • Save to DB    │         │       │  CONVERSATION    │                │
│   │  • Categorize    │         │       └──────────────────┘                │
│   │  • Tag           │         │                                            │
│   │  • Find related  │         └───────► Back to MEMORY_CAPTURE            │
│   │  • Vectorize     │                                                      │
│   │  • Sync files    │                                                      │
│   └────────┬─────────┘                                                      │
│            │                                                                 │
│            ▼                                                                 │
│   ┌──────────────────┐                                                      │
│   │  Return to       │                                                      │
│   │  CONVERSATION    │                                                      │
│   └──────────────────┘                                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Agent system prompt

```typescript
// src/agent/system-prompt.ts
export const MEMOBOT_SYSTEM_PROMPT = `You are MemoBot, a personal memory assistant. You help users capture, organize, and recall their memories and notes.

## Your Personality
- Warm, helpful, and conversational
- You remember context within the current conversation
- You're genuinely interested in helping users preserve their memories
- You keep responses concise for chat interfaces (WhatsApp/Telegram)

## Your Capabilities
1. **Conversation Mode (default)**: Chat naturally, answer questions about past memories using your search tools
2. **Memory Creation Mode**: When user says "memory" or expresses intent to save something, guide them through capturing a new memory

## How to Handle Messages

### In Conversation Mode:
- Greet new users warmly: "Hi! I'm MemoBot. I can help you save and recall your memories. How can I help you today?"
- When user asks about past memories, use the search_memories tool to find relevant ones
- When user wants to create a memory, transition to Memory Creation Mode
- Keep responses brief and natural

### Trigger phrases for Memory Creation Mode:
- "memory" (explicit command)
- "I want to remember..."
- "Save this..."
- "Note that..."
- "Don't let me forget..."

### In Memory Creation Mode:
1. Ask what they'd like to remember
2. After they share, ask 1-2 enriching questions (context, feelings, why it matters)
3. When ready, generate a draft and ask for confirmation
4. On confirm, save the memory and return to conversation

## Important Rules
- NEVER make up memories - only reference what you find via search
- Keep responses SHORT - this is chat, not email
- When searching returns no results, say so honestly
- Always confirm before saving a memory
- If user seems confused, explain your capabilities briefly

## Available Tools
You have access to tools for searching memories, creating memories, and managing the memory creation flow. Use them appropriately based on user intent.
`;
```

### Tool definitions (Claude tool-use format)

```typescript
// src/agent/tools.ts
import Anthropic from '@anthropic-ai/sdk';

export const MEMOBOT_TOOLS: Anthropic.Tool[] = [
  // ============================================================
  // SEARCH & RETRIEVAL TOOLS
  // ============================================================
  {
    name: "search_memories",
    description: "Search the user's memories using natural language. Returns relevant memories with their content, category, and tags. Use this when the user asks about past memories or wants to recall something.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Natural language search query describing what to find"
        },
        limit: {
          type: "number",
          description: "Maximum number of memories to return (default: 5, max: 10)"
        },
        include_related: {
          type: "boolean",
          description: "Whether to include related memories (2-degree network). Default: true"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "get_memory_by_id",
    description: "Retrieve a specific memory by its ID. Use when you need full details of a known memory.",
    input_schema: {
      type: "object" as const,
      properties: {
        memory_id: {
          type: "string",
          description: "UUID of the memory to retrieve"
        }
      },
      required: ["memory_id"]
    }
  },
  {
    name: "list_recent_memories",
    description: "List the user's most recent memories. Use when user asks 'what have I saved recently?' or similar.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Number of memories to return (default: 5, max: 20)"
        },
        category: {
          type: "string",
          description: "Optional: filter by category name"
        }
      },
      required: []
    }
  },
  {
    name: "list_categories",
    description: "List all categories the user has. Use when user asks about their categories or how memories are organized.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: []
    }
  },
  {
    name: "list_tags",
    description: "List all tags the user has, optionally filtered. Use when user asks about their tags.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Number of tags to return (default: 20)"
        }
      },
      required: []
    }
  },

  // ============================================================
  // MEMORY CREATION TOOLS
  // ============================================================
  {
    name: "start_memory_capture",
    description: "Begin the memory creation flow. Call this when user wants to create a new memory. Returns a session ID for the memory draft.",
    input_schema: {
      type: "object" as const,
      properties: {
        initial_content: {
          type: "string",
          description: "Optional initial content if user already provided some"
        }
      },
      required: []
    }
  },
  {
    name: "add_to_memory_draft",
    description: "Add content to the current memory draft. Use during the capture/enrichment phase.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string",
          description: "Additional content to add to the memory"
        },
        is_answer_to_question: {
          type: "boolean",
          description: "Whether this content is an answer to an enrichment question"
        }
      },
      required: ["content"]
    }
  },
  {
    name: "generate_memory_draft",
    description: "Generate a formatted draft from the captured content. Call this when enough information has been gathered.",
    input_schema: {
      type: "object" as const,
      properties: {
        request_confirmation: {
          type: "boolean",
          description: "Whether to ask user to confirm (default: true)"
        }
      },
      required: []
    }
  },
  {
    name: "finalize_memory",
    description: "Save the memory to the database. Only call after user confirms the draft. This will categorize, tag, find relationships, vectorize, and sync the memory.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "Optional title override (otherwise auto-generated)"
        },
        category_override: {
          type: "string",
          description: "Optional category name override"
        },
        tags_override: {
          type: "array",
          items: { type: "string" },
          description: "Optional tags override (array of 3 tag names)"
        }
      },
      required: []
    }
  },
  {
    name: "cancel_memory_draft",
    description: "Cancel the current memory creation and discard the draft.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: []
    }
  },

  // ============================================================
  // MEMORY MANAGEMENT TOOLS
  // ============================================================
  {
    name: "update_memory",
    description: "Update an existing memory. Use when user wants to edit a saved memory.",
    input_schema: {
      type: "object" as const,
      properties: {
        memory_id: {
          type: "string",
          description: "UUID of the memory to update"
        },
        title: {
          type: "string",
          description: "New title"
        },
        content: {
          type: "string", 
          description: "New content"
        },
        category: {
          type: "string",
          description: "New category name"
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "New tags (array of tag names)"
        }
      },
      required: ["memory_id"]
    }
  },
  {
    name: "delete_memory",
    description: "Delete a memory. Always confirm with user before calling this.",
    input_schema: {
      type: "object" as const,
      properties: {
        memory_id: {
          type: "string",
          description: "UUID of the memory to delete"
        }
      },
      required: ["memory_id"]
    }
  },

  // ============================================================
  // SESSION & STATE TOOLS
  // ============================================================
  {
    name: "get_session_state",
    description: "Get the current conversation state and any active memory draft. Useful for understanding context.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: []
    }
  },
  {
    name: "set_session_state",
    description: "Update the conversation state. Used internally to track memory creation flow.",
    input_schema: {
      type: "object" as const,
      properties: {
        state: {
          type: "string",
          enum: ["CONVERSATION", "MEMORY_CAPTURE", "MEMORY_ENRICHMENT", "MEMORY_DRAFT"],
          description: "The new conversation state"
        }
      },
      required: ["state"]
    }
  }
];
```

### Tool handler implementation

```typescript
// src/agent/tool-handlers.ts
import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from '../services/embedding';
import { assignCategory } from '../services/categorizer';
import { extractAndAssignTags } from '../services/tagger';
import { findRelatedMemories, createRelationships } from '../services/relationships';
import { syncMemoryToStorage } from '../services/sync';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ToolContext {
  userId: string;
  sessionId: string;
  platform: 'whatsapp' | 'telegram' | 'web';
}

export async function handleToolCall(
  toolName: string,
  toolInput: Record<string, any>,
  context: ToolContext
): Promise<any> {
  const { userId, sessionId } = context;
  
  // Set RLS context
  await supabase.rpc('set_current_user_id', { user_id: userId });
  
  switch (toolName) {
    // ========== SEARCH TOOLS ==========
    case 'search_memories': {
      const { query, limit = 5, include_related = true } = toolInput;
      const embedding = await generateEmbedding(query);
      
      if (include_related) {
        const { data } = await supabase.rpc('get_memory_network', {
          p_user_id: userId,
          query_embedding: embedding,
          initial_count: limit,
          related_count: 3,
          similarity_threshold: 0.5
        });
        return formatMemoryResults(data);
      } else {
        const { data } = await supabase.rpc('match_memories', {
          p_user_id: userId,
          query_embedding: embedding,
          match_count: limit,
          match_threshold: 0.6
        });
        return formatMemoryResults(data);
      }
    }
    
    case 'get_memory_by_id': {
      const { memory_id } = toolInput;
      const { data, error } = await supabase
        .from('memories')
        .select(`
          *,
          category:categories(name),
          tags:memory_tags(tag:tags(name))
        `)
        .eq('id', memory_id)
        .eq('user_id', userId)
        .single();
      
      if (error) return { error: 'Memory not found' };
      return formatSingleMemory(data);
    }
    
    case 'list_recent_memories': {
      const { limit = 5, category } = toolInput;
      let query = supabase
        .from('memories')
        .select(`
          id, title, summary, created_at,
          category:categories(name),
          tags:memory_tags(tag:tags(name))
        `)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(Math.min(limit, 20));
      
      if (category) {
        query = query.eq('categories.name', category);
      }
      
      const { data } = await query;
      return formatMemoryList(data);
    }
    
    case 'list_categories': {
      const { data } = await supabase
        .from('categories')
        .select('name, description, memory_count')
        .eq('user_id', userId)
        .order('memory_count', { ascending: false });
      return { categories: data };
    }
    
    case 'list_tags': {
      const { limit = 20 } = toolInput;
      const { data } = await supabase
        .from('tags')
        .select('name, usage_count')
        .eq('user_id', userId)
        .order('usage_count', { ascending: false })
        .limit(limit);
      return { tags: data };
    }
    
    // ========== MEMORY CREATION TOOLS ==========
    case 'start_memory_capture': {
      const { initial_content } = toolInput;
      
      await supabase
        .from('conversation_sessions')
        .update({
          current_state: 'MEMORY_CAPTURE',
          memory_draft: {
            content_parts: initial_content ? [initial_content] : [],
            started_at: new Date().toISOString(),
            enrichment_count: 0
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
      
      return { 
        status: 'capture_started',
        message: initial_content 
          ? 'Got it! Can you tell me more about this?' 
          : 'What would you like to remember?'
      };
    }
    
    case 'add_to_memory_draft': {
      const { content, is_answer_to_question = false } = toolInput;
      
      // Get current draft
      const { data: session } = await supabase
        .from('conversation_sessions')
        .select('memory_draft')
        .eq('id', sessionId)
        .single();
      
      const draft = session?.memory_draft || { content_parts: [], enrichment_count: 0 };
      draft.content_parts.push(content);
      if (is_answer_to_question) {
        draft.enrichment_count = (draft.enrichment_count || 0) + 1;
      }
      
      await supabase
        .from('conversation_sessions')
        .update({ 
          memory_draft: draft,
          current_state: 'MEMORY_ENRICHMENT',
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
      
      return { 
        status: 'content_added',
        enrichment_count: draft.enrichment_count,
        total_parts: draft.content_parts.length
      };
    }
    
    case 'generate_memory_draft': {
      // Get session with draft
      const { data: session } = await supabase
        .from('conversation_sessions')
        .select('memory_draft')
        .eq('id', sessionId)
        .single();
      
      const draft = session?.memory_draft;
      if (!draft?.content_parts?.length) {
        return { error: 'No content captured yet' };
      }
      
      // Combine all content parts
      const fullContent = draft.content_parts.join('\n\n');
      
      // Generate title and summary using Claude (separate call)
      const { title, summary } = await generateTitleAndSummary(fullContent);
      
      // Preview category and tags
      const categories = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId);
      const categoryPreview = await previewCategory(fullContent, categories.data || []);
      
      const tags = await supabase
        .from('tags')
        .select('*')
        .eq('user_id', userId);
      const tagsPreview = await previewTags(fullContent, tags.data || []);
      
      // Update session state
      await supabase
        .from('conversation_sessions')
        .update({
          current_state: 'MEMORY_DRAFT',
          memory_draft: {
            ...draft,
            title,
            summary,
            full_content: fullContent,
            preview_category: categoryPreview,
            preview_tags: tagsPreview
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
      
      return {
        status: 'draft_ready',
        draft: {
          title,
          summary,
          content_preview: fullContent.slice(0, 200) + (fullContent.length > 200 ? '...' : ''),
          category: categoryPreview,
          tags: tagsPreview
        }
      };
    }
    
    case 'finalize_memory': {
      const { title_override, category_override, tags_override } = toolInput;
      
      // Get session draft
      const { data: session } = await supabase
        .from('conversation_sessions')
        .select('memory_draft')
        .eq('id', sessionId)
        .single();
      
      const draft = session?.memory_draft;
      if (!draft?.full_content) {
        return { error: 'No draft to finalize' };
      }
      
      // Generate embedding
      const embedding = await generateEmbedding(draft.full_content);
      
      // Assign category
      const category = await assignCategory(
        userId,
        category_override || draft.full_content
      );
      
      // Assign tags
      const tags = tags_override 
        ? await getOrCreateTags(userId, tags_override)
        : await extractAndAssignTags(userId, draft.full_content);
      
      // Create memory
      const { data: memory, error } = await supabase
        .from('memories')
        .insert({
          user_id: userId,
          title: title_override || draft.title,
          content: draft.full_content,
          summary: draft.summary,
          embedding,
          category_id: category.id,
          source_platform: context.platform
        })
        .select()
        .single();
      
      if (error) {
        return { error: 'Failed to save memory' };
      }
      
      // Link tags
      await supabase.from('memory_tags').insert(
        tags.map(t => ({ memory_id: memory.id, tag_id: t.id }))
      );
      
      // Find and create relationships
      const relatedMemories = await findRelatedMemories(userId, memory.id, embedding);
      await createRelationships(memory.id, relatedMemories);
      
      // Update category count
      await supabase.rpc('increment_category_count', { category_id: category.id });
      
      // Sync to file storage (async, don't wait)
      syncMemoryToStorage(userId, memory, category, tags).catch(console.error);
      
      // Reset session
      await supabase
        .from('conversation_sessions')
        .update({
          current_state: 'CONVERSATION',
          memory_draft: {},
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
      
      return {
        status: 'memory_saved',
        memory: {
          id: memory.id,
          title: memory.title,
          category: category.name,
          tags: tags.map(t => t.name),
          related_count: relatedMemories.length
        }
      };
    }
    
    case 'cancel_memory_draft': {
      await supabase
        .from('conversation_sessions')
        .update({
          current_state: 'CONVERSATION',
          memory_draft: {},
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
      
      return { status: 'draft_cancelled' };
    }
    
    // ========== MANAGEMENT TOOLS ==========
    case 'update_memory': {
      const { memory_id, ...updates } = toolInput;
      
      const updateData: any = { updated_at: new Date().toISOString() };
      if (updates.title) updateData.title = updates.title;
      if (updates.content) {
        updateData.content = updates.content;
        updateData.embedding = await generateEmbedding(updates.content);
      }
      
      const { error } = await supabase
        .from('memories')
        .update(updateData)
        .eq('id', memory_id)
        .eq('user_id', userId);
      
      if (error) return { error: 'Failed to update memory' };
      return { status: 'memory_updated' };
    }
    
    case 'delete_memory': {
      const { memory_id } = toolInput;
      
      // Soft delete
      const { error } = await supabase
        .from('memories')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', memory_id)
        .eq('user_id', userId);
      
      if (error) return { error: 'Failed to delete memory' };
      return { status: 'memory_deleted' };
    }
    
    // ========== SESSION TOOLS ==========
    case 'get_session_state': {
      const { data: session } = await supabase
        .from('conversation_sessions')
        .select('current_state, memory_draft')
        .eq('id', sessionId)
        .single();
      
      return {
        state: session?.current_state || 'CONVERSATION',
        has_draft: !!session?.memory_draft?.content_parts?.length,
        draft_parts: session?.memory_draft?.content_parts?.length || 0
      };
    }
    
    case 'set_session_state': {
      const { state } = toolInput;
      await supabase
        .from('conversation_sessions')
        .update({ 
          current_state: state,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
      
      return { status: 'state_updated', new_state: state };
    }
    
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// Helper functions
function formatMemoryResults(data: any[]): any {
  if (!data?.length) {
    return { memories: [], message: 'No memories found' };
  }
  
  return {
    memories: data.map(m => ({
      id: m.id,
      title: m.title,
      content_preview: m.content?.slice(0, 150) + '...',
      degree: m.degree,  // 0 = direct match, 1 = first-degree, 2 = second-degree
      relevance: m.relevance_score
    }))
  };
}

function formatSingleMemory(data: any): any {
  return {
    id: data.id,
    title: data.title,
    content: data.content,
    summary: data.summary,
    category: data.category?.name,
    tags: data.tags?.map((t: any) => t.tag.name),
    created_at: data.created_at
  };
}

function formatMemoryList(data: any[]): any {
  return {
    memories: data?.map(m => ({
      id: m.id,
      title: m.title,
      summary: m.summary,
      category: m.category?.name,
      tags: m.tags?.map((t: any) => t.tag.name),
      created_at: m.created_at
    })) || []
  };
}
```

### Agent orchestrator (main message handler)

```typescript
// src/agent/orchestrator.ts
import Anthropic from '@anthropic-ai/sdk';
import { MEMOBOT_SYSTEM_PROMPT } from './system-prompt';
import { MEMOBOT_TOOLS } from './tools';
import { handleToolCall } from './tool-handlers';

const anthropic = new Anthropic();

interface ConversationContext {
  userId: string;
  sessionId: string;
  platform: 'whatsapp' | 'telegram' | 'web';
  messageHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export async function processMessage(
  userMessage: string,
  context: ConversationContext
): Promise<string> {
  const { userId, sessionId, platform, messageHistory } = context;
  
  // Build messages array with history
  const messages: Anthropic.MessageParam[] = [
    ...messageHistory.slice(-10),  // Keep last 10 messages for context
    { role: 'user', content: userMessage }
  ];
  
  // Initial Claude call
  let response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: MEMOBOT_SYSTEM_PROMPT,
    tools: MEMOBOT_TOOLS,
    messages
  });
  
  // Agentic loop: process tool calls until done
  while (response.stop_reason === 'tool_use') {
    const assistantMessage = response.content;
    const toolUseBlocks = assistantMessage.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );
    
    // Process all tool calls
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    
    for (const toolUse of toolUseBlocks) {
      const result = await handleToolCall(
        toolUse.name,
        toolUse.input as Record<string, any>,
        { userId, sessionId, platform }
      );
      
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result)
      });
    }
    
    // Continue conversation with tool results
    messages.push({ role: 'assistant', content: assistantMessage });
    messages.push({ role: 'user', content: toolResults });
    
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: MEMOBOT_SYSTEM_PROMPT,
      tools: MEMOBOT_TOOLS,
      messages
    });
  }
  
  // Extract final text response
  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  );
  
  return textBlock?.text || "I'm not sure how to respond to that.";
}
```

### Updated message router

```typescript
// src/services/message-router.ts
import { processMessage } from '../agent/orchestrator';
import { verifyAndLinkAccount } from './account-linking';
import { resolveUserFromPlatform } from './user-resolver';
import { getOrCreateSession, updateSessionHistory } from './session';

export async function processIncomingMessage(
  platform: 'whatsapp' | 'telegram',
  platformUserId: string,
  text: string,
  replyFn: (message: string) => Promise<void>
): Promise<void> {
  const trimmedText = text.trim();
  
  // Check for link command: "LINK 123456"
  const linkMatch = trimmedText.match(/^LINK\s+(\d{6})$/i);
  if (linkMatch) {
    const result = await verifyAndLinkAccount(platform, platformUserId, linkMatch[1]);
    await replyFn(result.message);
    return;
  }
  
  // Resolve user from platform link
  const userId = await resolveUserFromPlatform(platform, platformUserId);
  
  if (!userId) {
    await replyFn(
      `👋 Welcome to MemoBot!\n\n` +
      `I can help you capture and recall your memories. To get started, link your account:\n\n` +
      `1. Sign up at https://memobot.app\n` +
      `2. Go to Settings → Link ${platform === 'whatsapp' ? 'WhatsApp' : 'Telegram'}\n` +
      `3. Send the 6-digit code here\n\n` +
      `Example: LINK 123456`
    );
    return;
  }
  
  // Get or create session
  const session = await getOrCreateSession(userId, platform, platformUserId);
  
  // Process through agent
  const response = await processMessage(trimmedText, {
    userId,
    sessionId: session.id,
    platform,
    messageHistory: session.message_history || []
  });
  
  // Update session history
  await updateSessionHistory(session.id, [
    { role: 'user', content: trimmedText },
    { role: 'assistant', content: response }
  ]);
  
  // Send response
  await replyFn(response);
}
```

---

## Agent skills summary

| Skill | Tool(s) Used | Description |
|-------|--------------|-------------|
| **Conversational Q&A** | `search_memories`, `get_memory_by_id` | Answer questions about past memories using RAG with 2-degree relationship expansion |
| **Memory Browsing** | `list_recent_memories`, `list_categories`, `list_tags` | Help users explore their memory collection |
| **Memory Capture** | `start_memory_capture`, `add_to_memory_draft` | Begin and collect content for a new memory |
| **Intelligent Enrichment** | Agent reasoning + `add_to_memory_draft` | Ask follow-up questions to enrich memory context |
| **Draft Generation** | `generate_memory_draft` | Create formatted preview with auto-generated title, category, tags |
| **Memory Finalization** | `finalize_memory` | Save memory with categorization, tagging, relationships, vectorization, and file sync |
| **Memory Management** | `update_memory`, `delete_memory` | Edit or remove existing memories |
| **Session Awareness** | `get_session_state`, `set_session_state` | Track conversation flow and memory creation progress |

---

## Enrichment question generation

The agent uses Claude's reasoning to generate contextual follow-up questions. Here's the prompt pattern:

```typescript
// src/agent/enrichment.ts
export const ENRICHMENT_PROMPT = `Based on the memory content so far, generate ONE follow-up question to enrich it.

Memory content:
{content}

Questions already asked: {count}

Guidelines:
- Ask about context, emotions, significance, or specific details
- Make questions conversational and empathetic
- If content is already detailed (3+ paragraphs or covers who/what/when/where/why), return null
- Maximum 3 questions total - if count >= 2, lean toward completing

Return JSON:
{
  "should_ask": boolean,
  "question": "Your question here" | null,
  "reasoning": "Brief explanation"
}`;
```

---

## Frontend with Clerk (Next.js)

### Clerk middleware setup

```typescript
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/',
  '/api/webhook/(.*)',  // Webhooks don't use Clerk auth
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
```

### Layout with Clerk provider

```typescript
// app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#00FFFF',
          colorBackground: '#0A0A0F',
          colorText: '#E0E0E0',
        },
      }}
    >
      <html lang="en" className="dark">
        <body className="bg-cyber-black text-gray-100">{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

### Dashboard layout with user sync

```typescript
// app/(dashboard)/layout.tsx
import { currentUser } from '@clerk/nextjs/server';
import { syncClerkUser } from '@/lib/supabase/user-sync';
import { Sidebar } from '@/components/layout/sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  
  if (user) {
    // Sync Clerk user to Supabase on each request (idempotent)
    await syncClerkUser({
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      avatarUrl: user.imageUrl,
    });
  }
  
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
```

### Account linking settings page

```typescript
// app/(dashboard)/settings/linking/page.tsx
'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MessageCircle, Send, Copy, Check } from 'lucide-react';

export default function AccountLinkingPage() {
  const { user } = useUser();
  const [whatsappCode, setWhatsappCode] = useState<string | null>(null);
  const [telegramCode, setTelegramCode] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<PlatformLink[]>([]);
  
  const generateCode = async (platform: 'whatsapp' | 'telegram') => {
    const res = await fetch('/api/link-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform }),
    });
    const { code } = await res.json();
    
    if (platform === 'whatsapp') setWhatsappCode(code);
    else setTelegramCode(code);
  };
  
  const copyCode = (code: string, platform: string) => {
    navigator.clipboard.writeText(`LINK ${code}`);
    setCopied(platform);
    setTimeout(() => setCopied(null), 2000);
  };
  
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-mono text-neon-cyan">Link Messaging Accounts</h1>
      
      {/* WhatsApp Card */}
      <Card className="p-6 bg-cyber-navy border-neon-cyan/20">
        <div className="flex items-center gap-3 mb-4">
          <MessageCircle className="w-6 h-6 text-green-500" />
          <h2 className="text-lg font-semibold">WhatsApp</h2>
        </div>
        
        {!whatsappCode ? (
          <Button onClick={() => generateCode('whatsapp')} variant="outline">
            Generate Link Code
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              Send this message to MemoBot on WhatsApp:
            </p>
            <div className="flex items-center gap-2 p-3 bg-cyber-black rounded font-mono">
              <span className="text-neon-cyan">LINK {whatsappCode}</span>
              <Button size="sm" variant="ghost" onClick={() => copyCode(whatsappCode, 'whatsapp')}>
                {copied === 'whatsapp' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-gray-500">Code expires in 10 minutes</p>
          </div>
        )}
      </Card>
      
      {/* Telegram Card */}
      <Card className="p-6 bg-cyber-navy border-neon-cyan/20">
        <div className="flex items-center gap-3 mb-4">
          <Send className="w-6 h-6 text-blue-500" />
          <h2 className="text-lg font-semibold">Telegram</h2>
        </div>
        
        {!telegramCode ? (
          <Button onClick={() => generateCode('telegram')} variant="outline">
            Generate Link Code
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              Send this message to @MemoBot_bot on Telegram:
            </p>
            <div className="flex items-center gap-2 p-3 bg-cyber-black rounded font-mono">
              <span className="text-neon-cyan">LINK {telegramCode}</span>
              <Button size="sm" variant="ghost" onClick={() => copyCode(telegramCode, 'telegram')}>
                {copied === 'telegram' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-gray-500">Code expires in 10 minutes</p>
          </div>
        )}
      </Card>
      
      {/* Linked Accounts */}
      <Card className="p-6 bg-cyber-navy border-neon-cyan/20">
        <h2 className="text-lg font-semibold mb-4">Linked Accounts</h2>
        {linkedAccounts.length === 0 ? (
          <p className="text-gray-400">No accounts linked yet.</p>
        ) : (
          <ul className="space-y-2">
            {linkedAccounts.map((link) => (
              <li key={link.id} className="flex justify-between items-center">
                <span>{link.platform}: {link.platform_user_id}</span>
                <Button size="sm" variant="destructive">Unlink</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
```

---

## Environment variables (complete)

```env
# ===================
# CLERK AUTHENTICATION
# ===================
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# ===================
# SUPABASE
# ===================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# ===================
# AI SERVICES
# ===================
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# ===================
# TELEGRAM
# ===================
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_WEBHOOK_SECRET=your-random-secret

# ===================
# WHATSAPP (Meta Cloud API)
# ===================
WHATSAPP_ACCESS_TOKEN=EAAxx...
WHATSAPP_PHONE_NUMBER_ID=1234567890
WHATSAPP_BUSINESS_ACCOUNT_ID=0987654321
WHATSAPP_VERIFY_TOKEN=your-verify-string

# ===================
# GOOGLE DRIVE (optional)
# ===================
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=https://memobot.app/auth/google/callback

# ===================
# DROPBOX (optional)
# ===================
DROPBOX_APP_KEY=xxx
DROPBOX_APP_SECRET=xxx

# ===================
# APPLICATION
# ===================
NODE_ENV=development
BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## GitHub repository setup

### Repository structure

MemoBot uses a **monorepo** structure with both frontend and backend in the same repository:

```
memobot/
├── .github/
│   └── workflows/
│       ├── frontend-deploy.yml      # Vercel auto-handles, but useful for checks
│       ├── backend-deploy.yml       # Railway deployment
│       └── pr-checks.yml            # Lint, type-check, test on PRs
├── apps/
│   ├── web/                         # Next.js frontend (deployed to Vercel)
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── public/
│   │   ├── next.config.js
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── api/                         # Node.js backend (deployed to Railway)
│       ├── src/
│       │   ├── webhooks/
│       │   ├── services/
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   └── shared/                      # Shared types, utilities
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
├── supabase/
│   └── migrations/                  # SQL migration files
│       ├── 001_initial_schema.sql
│       ├── 002_rls_policies.sql
│       └── 003_search_functions.sql
├── package.json                     # Root workspace config
├── turbo.json                       # Turborepo config (optional)
├── .env.example
├── .gitignore
└── README.md
```

### Initial repository setup

```bash
# Create the repository
mkdir memobot && cd memobot
git init

# Initialize workspace (using pnpm, but npm/yarn work too)
pnpm init

# Create workspace structure
mkdir -p apps/web apps/api packages/shared supabase/migrations .github/workflows

# Initialize each package
cd apps/web && pnpm init && cd ../..
cd apps/api && pnpm init && cd ../..
cd packages/shared && pnpm init && cd ../..
```

### Root package.json (workspace config)

```json
{
  "name": "memobot",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "test": "turbo run test"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.3.0"
  }
}
```

### .gitignore

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
.next/
dist/
.turbo/

# Environment files (NEVER commit these)
.env
.env.local
.env.production
.env*.local

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Testing
coverage/

# Vercel
.vercel/
```

### .env.example (commit this as reference)

```env
# ===================
# CLERK AUTHENTICATION
# ===================
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# ===================
# SUPABASE
# ===================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# ===================
# AI SERVICES
# ===================
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# ===================
# TELEGRAM
# ===================
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

# ===================
# WHATSAPP
# ===================
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_VERIFY_TOKEN=

# ===================
# APPLICATION
# ===================
NEXT_PUBLIC_APP_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001
```

---

## Vercel deployment (Frontend)

### Step 1: Connect GitHub to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "Add New Project"
3. Import your `memobot` repository
4. **Important:** Set the Root Directory to `apps/web`

### Step 2: Configure build settings

Vercel should auto-detect Next.js, but verify these settings:

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Root Directory | `apps/web` |
| Build Command | `cd ../.. && pnpm install && pnpm build --filter=web` |
| Output Directory | `.next` |
| Install Command | `pnpm install` |

**Alternative (simpler):** If not using a monorepo workspace, just set Root Directory to `apps/web` and use default commands.

### Step 3: Environment variables in Vercel

Go to Project Settings → Environment Variables and add:

| Variable | Environment | Notes |
|----------|-------------|-------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | All | From Clerk dashboard |
| `CLERK_SECRET_KEY` | All | From Clerk dashboard (sensitive) |
| `NEXT_PUBLIC_SUPABASE_URL` | All | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | All | Supabase service role (sensitive) |
| `ANTHROPIC_API_KEY` | All | For AI features in API routes |
| `OPENAI_API_KEY` | All | For embeddings |
| `NEXT_PUBLIC_APP_URL` | Production | `https://memobot.app` or your domain |
| `NEXT_PUBLIC_APP_URL` | Preview | `https://memobot-preview.vercel.app` |
| `BACKEND_URL` | Production | Your Railway backend URL |

**Tip:** Use different values for Production vs Preview environments to isolate testing.

### Step 4: Configure Clerk for production

In your Clerk Dashboard:

1. Go to **Domains** → Add your Vercel domain (`memobot.app` or `*.vercel.app`)
2. Go to **API Keys** → Create production keys
3. Update Vercel environment variables with production Clerk keys

### Step 5: vercel.json configuration

Create `apps/web/vercel.json`:

```json
{
  "framework": "nextjs",
  "regions": ["iad1"],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET, POST, PUT, DELETE, OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type, Authorization" }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/webhook/:path*",
      "destination": "/api/webhook/:path*"
    }
  ]
}
```

### Step 6: Custom domain setup

1. In Vercel Project → Settings → Domains
2. Add your domain: `memobot.app`
3. Add `www.memobot.app` and redirect to apex
4. Update DNS records as instructed:
   - A record: `76.76.21.21`
   - Or CNAME: `cname.vercel-dns.com`
5. Wait for SSL certificate (automatic)

### Step 7: Deploy previews (automatic)

Every pull request automatically gets a preview deployment:
- Preview URL: `memobot-git-{branch}-{username}.vercel.app`
- Comments posted to PR with deployment status
- Preview uses "Preview" environment variables

---

## GitHub Actions workflows

### PR checks workflow

Create `.github/workflows/pr-checks.yml`:

```yaml
name: PR Checks

on:
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
          
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        
      - name: Type check
        run: pnpm type-check
        
      - name: Lint
        run: pnpm lint
        
      - name: Run tests
        run: pnpm test
        env:
          # Use test/mock values
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.TEST_CLERK_KEY }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
          
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        
      - name: Build all packages
        run: pnpm build
        env:
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.TEST_CLERK_KEY }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY }}
```

### Backend deployment workflow (Railway)

Create `.github/workflows/deploy-backend.yml`:

```yaml
name: Deploy Backend to Railway

on:
  push:
    branches: [main]
    paths:
      - 'apps/api/**'
      - 'packages/shared/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Railway CLI
        run: npm install -g @railway/cli
        
      - name: Deploy to Railway
        run: railway up --service api
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

---

## Deployment checklist

### Pre-deployment

```markdown
- [ ] All environment variables set in Vercel
- [ ] Clerk production keys configured
- [ ] Supabase project created with schema migrated
- [ ] Domain DNS configured
- [ ] SSL certificate issued (automatic with Vercel)
```

### Post-deployment verification

```markdown
- [ ] Homepage loads correctly
- [ ] Clerk sign-up/sign-in works
- [ ] User sync to Supabase works (check database)
- [ ] API routes respond (test /api/health)
- [ ] Environment variables accessible (no undefined errors)
```

### Webhook configuration (after backend deployed)

```markdown
- [ ] Update Telegram webhook URL to production
      curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
        -d "url=https://api.memobot.app/webhook/telegram"
        
- [ ] Update WhatsApp webhook in Meta dashboard
      Callback URL: https://api.memobot.app/webhook/whatsapp
      
- [ ] Test message flow end-to-end
```

---

## CI/CD flow summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CI/CD PIPELINE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Developer pushes to feature branch                                         │
│                    ↓                                                         │
│  GitHub Actions: Lint + Type-check + Test                                   │
│                    ↓                                                         │
│  Developer opens Pull Request to main                                        │
│                    ↓                                                         │
│  Vercel: Auto-deploys preview (preview.memobot.vercel.app)                  │
│  GitHub Actions: PR checks run                                               │
│                    ↓                                                         │
│  Code review + Approval                                                      │
│                    ↓                                                         │
│  Merge to main                                                               │
│                    ↓                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  PARALLEL DEPLOYMENTS                                                │    │
│  │                                                                       │    │
│  │  Vercel: Auto-deploys frontend to memobot.app                        │    │
│  │  Railway: Deploys backend via GitHub Action (if api/ changed)        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                    ↓                                                         │
│  Deployment complete → Verify in production                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Rollback procedures

### Vercel rollback (frontend)

1. Go to Vercel Dashboard → Deployments
2. Find the last working deployment
3. Click "..." → "Promote to Production"
4. Instant rollback, no rebuild needed

### Railway rollback (backend)

1. Go to Railway Dashboard → Deployments
2. Click on previous successful deployment
3. Click "Rollback" button

### Database rollback

For Supabase schema issues:
1. Go to Supabase Dashboard → SQL Editor
2. Run compensating migration or restore from backup
3. Supabase has point-in-time recovery on Pro plans

---

## Updated development phases

### Phase 1: Foundation + Auth (Days 1-4)
- [ ] Create Next.js project with Clerk
- [ ] Configure Clerk authentication
- [ ] Create Supabase project with multi-user schema
- [ ] Run all migrations including RLS policies
- [ ] Implement Clerk → Supabase user sync
- [ ] Test user creation and isolation

### Phase 2: Core Services + Agent Architecture (Days 5-10)
- [ ] Implement embedding service (OpenAI text-embedding-3-small)
- [ ] Implement memory CRUD (user-scoped)
- [ ] Implement category/tag services (user-scoped)
- [ ] Implement relationship detection
- [ ] **Implement agent system prompt**
- [ ] **Define all agent tools (Claude tool-use JSON schema)**
- [ ] **Implement tool handlers for each tool**
- [ ] **Implement agent orchestrator with agentic loop**
- [ ] **Implement enrichment question generation**
- [ ] Create test harness for services and agent

### Phase 3: Account Linking (Days 11-12)
- [ ] Implement link code generation API
- [ ] Implement code verification in message router
- [ ] Create linking UI in settings (generate code, show linked accounts)
- [ ] Test full linking flow end-to-end

### Phase 4: Telegram Integration (Days 13-15)
- [ ] Set up Telegram bot via BotFather
- [ ] Implement webhook handler with signature verification
- [ ] Connect webhook to message router → agent orchestrator
- [ ] Test conversation flow (greet → chat → memory creation → confirm)
- [ ] Test RAG queries returning real memories

### Phase 5: WhatsApp Integration (Days 16-18)
- [ ] Set up Meta Cloud API (developer account, app, phone number)
- [ ] Implement webhook verification endpoint
- [ ] Implement message handler connected to agent
- [ ] Test full flow end-to-end (same as Telegram)

### Phase 6: RAG + Querying (Days 19-20)
- [ ] Fine-tune hybrid search weights
- [ ] Test 2-degree network retrieval quality
- [ ] Optimize context building for Claude
- [ ] Test query handling returns useful answers

### Phase 7: File Sync (Days 21-23)
- [ ] Implement local backup (markdown in category folders)
- [ ] Add Google Drive OAuth flow + sync
- [ ] Add Dropbox OAuth flow + sync
- [ ] Test sync queue processing

### Phase 8: Frontend Dashboard (Days 24-28)
- [ ] Build cyberpunk theme (Tailwind config)
- [ ] Memory list/detail pages
- [ ] Category/tag browsers
- [ ] Relationship graph visualization
- [ ] Settings pages (linking, sync config)

### Phase 9: GitHub Setup + Deployment (Days 29-32)
- [ ] Initialize GitHub repository with monorepo structure
- [ ] Set up branch protection rules (require PR reviews)
- [ ] Create .github/workflows for PR checks
- [ ] Connect repository to Vercel
- [ ] Configure Vercel build settings (Root Directory: apps/web)
- [ ] Add all environment variables to Vercel
- [ ] Configure Clerk production domain
- [ ] Set up custom domain in Vercel
- [ ] Deploy backend to Railway
- [ ] Update Telegram webhook to production URL
- [ ] Update WhatsApp webhook in Meta dashboard
- [ ] End-to-end production testing
- [ ] Set up monitoring and alerts

---

## Implementation checklist for Cursor

```markdown
## Phase 1: Foundation + Auth

### Clerk Setup
- [ ] Install @clerk/nextjs
- [ ] Configure ClerkProvider with cyberpunk theme
- [ ] Create sign-in and sign-up pages
- [ ] Add middleware.ts for route protection
- [ ] Test authentication flow

### Supabase Setup
- [ ] Create Supabase project
- [ ] Enable pgvector extension
- [ ] Run complete SQL schema (users, platform_links, memories, etc.)
- [ ] Run RLS policies
- [ ] Create SQL functions for search
- [ ] Generate TypeScript types

### User Sync
- [ ] Create user sync function (Clerk → Supabase)
- [ ] Call sync in dashboard layout
- [ ] Verify user isolation with RLS

## Phase 2: Core Services + Agent Architecture

### Data Services
- [ ] EmbeddingService with OpenAI text-embedding-3-small (512 dimensions)
- [ ] MemoryService (CRUD, user-scoped)
- [ ] CategoryService (matching, creation, user-scoped)
- [ ] TagService (extraction, normalization, user-scoped)
- [ ] RelationshipService (detection, bidirectional linking)
- [ ] RetrievalService (hybrid search, network expansion)

### Agent Architecture
- [ ] Create agent system prompt (src/agent/system-prompt.ts)
- [ ] Define tool schemas in Claude tool-use format (src/agent/tools.ts):
  - [ ] search_memories
  - [ ] get_memory_by_id
  - [ ] list_recent_memories
  - [ ] list_categories
  - [ ] list_tags
  - [ ] start_memory_capture
  - [ ] add_to_memory_draft
  - [ ] generate_memory_draft
  - [ ] finalize_memory
  - [ ] cancel_memory_draft
  - [ ] update_memory
  - [ ] delete_memory
  - [ ] get_session_state
  - [ ] set_session_state
- [ ] Implement tool handlers (src/agent/tool-handlers.ts)
- [ ] Implement agent orchestrator with agentic loop (src/agent/orchestrator.ts)
- [ ] Implement enrichment question generation logic
- [ ] Test agent in isolation with mock inputs

## Phase 3: Account Linking
- [ ] POST /api/link-code endpoint
- [ ] Link code verification function
- [ ] Message router with LINK command detection
- [ ] Unlinked user welcome message
- [ ] Settings UI for linking
- [ ] Display linked accounts

## Phase 4: Telegram
- [ ] Create bot via BotFather
- [ ] Webhook handler (/api/webhook/telegram)
- [ ] User resolution middleware
- [ ] Conversation state machine
- [ ] Response formatting

## Phase 5: WhatsApp
- [ ] Meta Developer setup
- [ ] Webhook verification endpoint
- [ ] Message handler
- [ ] User resolution
- [ ] Test full flow

## Phase 6: RAG
- [ ] Hybrid search implementation
- [ ] 2-degree network retrieval
- [ ] Context building for Claude
- [ ] Query classification
- [ ] Response generation

## Phase 7: File Sync
- [ ] Markdown generator with frontmatter
- [ ] Local filesystem writer
- [ ] Google Drive OAuth flow
- [ ] Dropbox OAuth flow
- [ ] Sync queue processor

## Phase 8: Dashboard
- [ ] Tailwind cyberpunk config
- [ ] Memory grid/list views
- [ ] Memory detail with markdown
- [ ] Category sidebar
- [ ] Tag cloud
- [ ] Force-directed graph
- [ ] Search command palette
- [ ] Settings pages

## Phase 9: GitHub + Vercel Deployment

### GitHub Setup
- [ ] Create GitHub repository
- [ ] Set up monorepo structure (apps/web, apps/api, packages/shared)
- [ ] Create root package.json with workspaces
- [ ] Add .gitignore and .env.example
- [ ] Set up branch protection on main
- [ ] Create PR checks workflow (.github/workflows/pr-checks.yml)
- [ ] Create backend deploy workflow (.github/workflows/deploy-backend.yml)

### Vercel Configuration
- [ ] Connect GitHub repo to Vercel
- [ ] Set Root Directory to apps/web
- [ ] Configure build command for monorepo
- [ ] Add all environment variables:
  - [ ] NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  - [ ] CLERK_SECRET_KEY
  - [ ] NEXT_PUBLIC_SUPABASE_URL
  - [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
  - [ ] SUPABASE_SERVICE_ROLE_KEY
  - [ ] ANTHROPIC_API_KEY
  - [ ] OPENAI_API_KEY
  - [ ] NEXT_PUBLIC_APP_URL
  - [ ] BACKEND_URL
- [ ] Create vercel.json with headers config
- [ ] Set up custom domain
- [ ] Configure DNS records
- [ ] Verify SSL certificate active

### Clerk Production Setup
- [ ] Add production domain in Clerk dashboard
- [ ] Create production API keys
- [ ] Update Vercel env vars with production keys
- [ ] Test sign-up/sign-in flow on production domain

### Backend Deployment (Railway)
- [ ] Create Railway project
- [ ] Connect GitHub repo
- [ ] Configure environment variables
- [ ] Deploy and verify health endpoint
- [ ] Note production URL for webhooks

### Webhook Configuration
- [ ] Update Telegram webhook:
      curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
        -d "url=https://api.memobot.app/webhook/telegram" \
        -d "secret_token=<WEBHOOK_SECRET>"
- [ ] Update WhatsApp webhook in Meta Developer Console
- [ ] Test Telegram message flow
- [ ] Test WhatsApp message flow

### Production Verification
- [ ] Homepage loads
- [ ] Authentication works (sign up, sign in, sign out)
- [ ] User syncs to Supabase
- [ ] Link code generation works
- [ ] Telegram linking works
- [ ] WhatsApp linking works
- [ ] Memory creation works end-to-end
- [ ] Memory search/RAG works
- [ ] File sync works (if enabled)
```