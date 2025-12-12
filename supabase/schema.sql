-- Dopple Studio Database Schema
-- Clean, normalized design for activity configurations

-- Drop existing tables if they exist (fresh start)
DROP TABLE IF EXISTS activity_input_mappings CASCADE;
DROP TABLE IF EXISTS activity_bubbles CASCADE;
DROP TABLE IF EXISTS activities CASCADE;

-- ============================================
-- ACTIVITIES TABLE (main entity)
-- ============================================
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Basic Info
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  icon_url TEXT,
  description TEXT DEFAULT 'Activity description',

  -- Activity Color (RGBA 0-1 range)
  color_r REAL DEFAULT 1.0,
  color_g REAL DEFAULT 1.0,
  color_b REAL DEFAULT 1.0,
  color_a REAL DEFAULT 1.0,

  -- Unlock Settings
  required_level INTEGER DEFAULT 1 CHECK (required_level >= 1 AND required_level <= 100),
  is_locked BOOLEAN DEFAULT false,
  should_unlock_by_lumi BOOLEAN DEFAULT false,

  -- Recipe Settings
  recipe_name TEXT DEFAULT 'Activity Unlock Recipe',
  recipe_description TEXT DEFAULT 'Provide the required items to unlock this activity',

  -- Input Settings
  use_default_mapping BOOLEAN DEFAULT true,
  input_update_rate REAL DEFAULT 0.01,

  -- Animation & Behavior
  departure_emotion TEXT DEFAULT 'Idle',
  arrival_emotion TEXT DEFAULT 'CreateBluePrints',
  level_up_move_speed REAL DEFAULT 20.0,
  enable_on_arrival BOOLEAN DEFAULT true,
  enable_delay REAL DEFAULT 1.0,
  play_enable_effect BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ACTIVITY BUBBLES TABLE (recipe requirements)
-- ============================================
CREATE TABLE activity_bubbles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,

  display_name TEXT,
  bubble_type INTEGER DEFAULT 0 CHECK (bubble_type IN (0, 1, 2)), -- 0: Color, 1: Item, 2: Empty

  -- Color bubble settings
  color_name TEXT,
  bg_color_r REAL DEFAULT 1.0,
  bg_color_g REAL DEFAULT 1.0,
  bg_color_b REAL DEFAULT 1.0,
  bg_color_a REAL DEFAULT 1.0,
  color_tolerance REAL DEFAULT 0.15,
  use_hsv_matching BOOLEAN DEFAULT false,

  -- Item bubble settings
  item_ids TEXT[] DEFAULT '{}',

  -- Ordering
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ACTIVITY INPUT MAPPINGS TABLE
-- ============================================
CREATE TABLE activity_input_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,

  mapping_name TEXT DEFAULT 'New Mapping',
  enabled BOOLEAN DEFAULT true,

  -- Input configuration
  device_input INTEGER DEFAULT 0, -- 0: None, 2: BackBtn, 3: FrontBtn, 4-9: gyro/gestures
  keyboard_key TEXT DEFAULT '',   -- JS key value: 'ArrowLeft', 'Space', etc.
  key_action INTEGER DEFAULT 0,   -- 0: Press, 1: Hold, 2: Toggle, 3: Continuous

  -- Gyro settings
  gyro_threshold REAL DEFAULT 0.2,
  gyro_sensitivity REAL DEFAULT 1.0,

  -- Ordering
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX activities_user_id_idx ON activities(user_id);
CREATE INDEX activities_created_at_idx ON activities(created_at DESC);
CREATE INDEX activity_bubbles_activity_id_idx ON activity_bubbles(activity_id);
CREATE INDEX activity_input_mappings_activity_id_idx ON activity_input_mappings(activity_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_bubbles ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_input_mappings ENABLE ROW LEVEL SECURITY;

-- Activities policies
CREATE POLICY "Users can view own activities"
  ON activities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Public can view activities by id"
  ON activities FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own activities"
  ON activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activities"
  ON activities FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own activities"
  ON activities FOR DELETE
  USING (auth.uid() = user_id);

-- Bubbles policies (inherit from parent activity)
CREATE POLICY "Users can view bubbles for own activities"
  ON activity_bubbles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM activities WHERE activities.id = activity_bubbles.activity_id
  ));

CREATE POLICY "Users can insert bubbles for own activities"
  ON activity_bubbles FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM activities
    WHERE activities.id = activity_bubbles.activity_id
    AND activities.user_id = auth.uid()
  ));

CREATE POLICY "Users can update bubbles for own activities"
  ON activity_bubbles FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM activities
    WHERE activities.id = activity_bubbles.activity_id
    AND activities.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete bubbles for own activities"
  ON activity_bubbles FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM activities
    WHERE activities.id = activity_bubbles.activity_id
    AND activities.user_id = auth.uid()
  ));

-- Input mappings policies (inherit from parent activity)
CREATE POLICY "Users can view mappings for own activities"
  ON activity_input_mappings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM activities WHERE activities.id = activity_input_mappings.activity_id
  ));

CREATE POLICY "Users can insert mappings for own activities"
  ON activity_input_mappings FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM activities
    WHERE activities.id = activity_input_mappings.activity_id
    AND activities.user_id = auth.uid()
  ));

CREATE POLICY "Users can update mappings for own activities"
  ON activity_input_mappings FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM activities
    WHERE activities.id = activity_input_mappings.activity_id
    AND activities.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete mappings for own activities"
  ON activity_input_mappings FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM activities
    WHERE activities.id = activity_input_mappings.activity_id
    AND activities.user_id = auth.uid()
  ));

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
