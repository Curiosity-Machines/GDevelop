-- Add version column with default of 1 for existing and new rows
ALTER TABLE activities ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- Trigger function to auto-increment version on update
CREATE OR REPLACE FUNCTION increment_activity_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to activities table
CREATE TRIGGER activity_version_increment
  BEFORE UPDATE ON activities
  FOR EACH ROW
  EXECUTE FUNCTION increment_activity_version();
