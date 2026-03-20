-- Add unique constraint on (user_id, name) to support upsert-by-name in deploy CLI
-- This ensures each user has uniquely named activities
CREATE UNIQUE INDEX IF NOT EXISTS activities_user_id_name_idx ON activities(user_id, name);
