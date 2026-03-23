-- Add optional description to activities
ALTER TABLE activities ADD COLUMN IF NOT EXISTS description TEXT;
