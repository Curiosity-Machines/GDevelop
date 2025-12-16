-- Migration: Add bundle support to activities
-- Run this migration to add zip bundle upload functionality

-- Add bundle columns to activities table
ALTER TABLE activities
ADD COLUMN IF NOT EXISTS bundle_path TEXT,
ADD COLUMN IF NOT EXISTS entry_point TEXT;

-- Create the storage bucket for activity bundles (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('activity-bundles', 'activity-bundles', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for activity-bundles bucket
-- Users can upload to their own folder
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can upload own bundles'
  ) THEN
    CREATE POLICY "Users can upload own bundles"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'activity-bundles' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END
$$;

-- Users can update their own bundles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own bundles'
  ) THEN
    CREATE POLICY "Users can update own bundles"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'activity-bundles' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END
$$;

-- Users can delete their own bundles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own bundles'
  ) THEN
    CREATE POLICY "Users can delete own bundles"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'activity-bundles' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END
$$;

-- Public read access for all bundles (needed for serving content)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public can read bundles'
  ) THEN
    CREATE POLICY "Public can read bundles"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'activity-bundles');
  END IF;
END
$$;
