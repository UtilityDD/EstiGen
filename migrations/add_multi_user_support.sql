-- Migration: Add Multi-User Support (Fork & Own Model)
-- Date: 2025-12-06
-- Purpose: Allow each user to have custom schedules while protecting default master data

-- ============================================
-- STEP 1: Add user_id columns
-- ============================================

-- Add user_id to structures
ALTER TABLE structures 
ADD COLUMN user_id TEXT DEFAULT NULL;

-- Add user_id to materials  
ALTER TABLE materials
ADD COLUMN user_id TEXT DEFAULT NULL;

-- Add user_id to labour
ALTER TABLE labour
ADD COLUMN user_id TEXT DEFAULT NULL;

-- Add user_id to special_structures
ALTER TABLE special_structures
ADD COLUMN user_id TEXT DEFAULT NULL;

-- ============================================
-- STEP 2: Add indexes for performance
-- ============================================

CREATE INDEX idx_structures_user_id ON structures(user_id);
CREATE INDEX idx_materials_user_id ON materials(user_id);
CREATE INDEX idx_labour_user_id ON labour(user_id);
CREATE INDEX idx_special_structures_user_id ON special_structures(user_id);

-- ============================================
-- STEP 3: Add comments for clarity
-- ============================================

COMMENT ON COLUMN structures.user_id IS 'NULL = default/master data (protected), non-NULL = user custom copy';
COMMENT ON COLUMN materials.user_id IS 'NULL = default/master data (protected), non-NULL = user custom copy';
COMMENT ON COLUMN labour.user_id IS 'NULL = default/master data (protected), non-NULL = user custom copy';
COMMENT ON COLUMN special_structures.user_id IS 'NULL = default/master data (protected), non-NULL = user custom copy';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check column was added
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name IN ('structures', 'materials', 'labour') 
-- AND column_name = 'user_id';

-- Check indexes were created
-- SELECT indexname, tablename 
-- FROM pg_indexes 
-- WHERE indexname LIKE '%user_id%';

-- Verify all existing data has NULL user_id (defaults)
-- SELECT COUNT(*) as default_count FROM structures WHERE user_id IS NULL;
-- SELECT COUNT(*) as default_count FROM materials WHERE user_id IS NULL;
-- SELECT COUNT(*) as default_count FROM labour WHERE user_id IS NULL;
