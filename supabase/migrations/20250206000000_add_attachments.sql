-- MemoBot: Add attachments support for memories
-- Includes attachments table and Supabase Storage bucket configuration

-- ============================================================
-- ATTACHMENTS TABLE
-- ============================================================

CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,  -- MIME type (e.g., 'image/jpeg', 'application/pdf')
  file_size INTEGER NOT NULL,  -- Size in bytes
  storage_path TEXT NOT NULL,  -- Path in Supabase Storage bucket
  extracted_content TEXT,  -- AI-extracted text/description from file
  extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'completed', 'failed', 'unsupported')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: memory_id can be NULL initially for attachments uploaded before memory is created
-- They get linked when the memory is finalized

CREATE INDEX idx_attachments_memory ON attachments(memory_id) WHERE memory_id IS NOT NULL;
CREATE INDEX idx_attachments_user ON attachments(user_id);
CREATE INDEX idx_attachments_user_pending ON attachments(user_id, created_at DESC) WHERE memory_id IS NULL;

-- ============================================================
-- ROW LEVEL SECURITY FOR ATTACHMENTS
-- ============================================================

ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- Users can only see their own attachments
CREATE POLICY attachments_select_own ON attachments
  FOR SELECT USING (user_id = current_setting('app.current_user_id', true));

-- Users can only insert their own attachments
CREATE POLICY attachments_insert_own ON attachments
  FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- Users can only update their own attachments
CREATE POLICY attachments_update_own ON attachments
  FOR UPDATE USING (user_id = current_setting('app.current_user_id', true));

-- Users can only delete their own attachments
CREATE POLICY attachments_delete_own ON attachments
  FOR DELETE USING (user_id = current_setting('app.current_user_id', true));

-- ============================================================
-- SUPABASE STORAGE BUCKET
-- ============================================================

-- Create the storage bucket for memory attachments
-- Note: This uses Supabase's storage extension
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'memory-attachments',
  'memory-attachments',
  false,  -- Private bucket, requires signed URLs
  10485760,  -- 10MB max file size
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

-- ============================================================
-- STORAGE RLS POLICIES
-- ============================================================

-- Policy: Users can upload files to their own folder
CREATE POLICY storage_insert_own ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'memory-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Users can read their own files
CREATE POLICY storage_select_own ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'memory-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Users can delete their own files
CREATE POLICY storage_delete_own ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'memory-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Service role can do anything (for server-side operations)
CREATE POLICY storage_service_role ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'memory-attachments')
  WITH CHECK (bucket_id = 'memory-attachments');

-- ============================================================
-- HELPER FUNCTION: Get attachment count for a memory
-- ============================================================

CREATE OR REPLACE FUNCTION get_memory_attachment_count(memory_uuid UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INTEGER FROM attachments WHERE memory_id = memory_uuid;
$$;
