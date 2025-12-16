-- Dopple Studio Database Schema (Minimal)
-- Simplified schema storing only core activity settings

-- Drop existing tables if they exist (fresh start)
DROP TABLE IF EXISTS activity_input_mappings CASCADE;
DROP TABLE IF EXISTS activity_bubbles CASCADE;
DROP TABLE IF EXISTS activities CASCADE;

-- ============================================
-- ACTIVITIES TABLE (simplified)
-- ============================================
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Core Fields (matching minimal schema)
  name TEXT NOT NULL,              -- activityName (required)
  url TEXT,                        -- url (optional, web URL)
  icon_url TEXT,                   -- iconPath (optional)
  
  -- Bundle Fields (for uploaded zip files)
  bundle_path TEXT,                -- Path to zip file in storage (e.g., "bundles/<user_id>/<activity_id>.zip")
  entry_point TEXT,                -- Entry point within the zip (e.g., "index.html" or "dist/index.html")

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- STORAGE BUCKET FOR ACTIVITY BUNDLES
-- ============================================
-- Note: Run these in the Supabase dashboard SQL editor or via migration

-- Create the storage bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('activity-bundles', 'activity-bundles', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for activity-bundles bucket
-- Users can upload to their own folder
CREATE POLICY "Users can upload own bundles"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'activity-bundles' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update their own bundles
CREATE POLICY "Users can update own bundles"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'activity-bundles' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own bundles
CREATE POLICY "Users can delete own bundles"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'activity-bundles' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Public read access for all bundles (needed for serving content)
CREATE POLICY "Public can read bundles"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'activity-bundles');

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX activities_user_id_idx ON activities(user_id);
CREATE INDEX activities_created_at_idx ON activities(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Users can view their own activities
CREATE POLICY "Users can view own activities"
  ON activities FOR SELECT
  USING (auth.uid() = user_id);

-- Public can view activities by id (for manifest endpoint)
CREATE POLICY "Public can view activities by id"
  ON activities FOR SELECT
  USING (true);

-- Users can insert their own activities
CREATE POLICY "Users can insert own activities"
  ON activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own activities
CREATE POLICY "Users can update own activities"
  ON activities FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own activities
CREATE POLICY "Users can delete own activities"
  ON activities FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON activities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
