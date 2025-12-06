-- Supplemental Migration: Fix Missing user_id on special_structures
-- Date: 2025-12-06
-- Purpose: Add user_id column to special_structures table if missed in previous migration

-- Add user_id to special_structures
ALTER TABLE special_structures 
ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_special_structures_user_id ON special_structures(user_id);

-- Add comment
COMMENT ON COLUMN special_structures.user_id IS 'NULL = default/master data (protected), non-NULL = user custom copy';

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'special_structures' AND column_name = 'user_id';
