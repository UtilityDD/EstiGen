-- Migration to change Primary Key strategy for "Fork & Own" support
-- This allows multiple rows with the same 'id' (e.g. 'pole-1') as long as they belong to different users.

-- 1. Enable UUID extension if not exists
create extension if not exists "uuid-ossp";

-- ==========================================
-- TABLE: structures
-- ==========================================

-- Add new physical ID column
ALTER TABLE structures ADD COLUMN IF NOT EXISTS record_id UUID DEFAULT uuid_generate_v4();

-- Drop existing PK (assuming it was on 'id')
-- Note: You might need to check your exact constraint name if this fails. 
-- Usually it is 'structures_pkey'.
ALTER TABLE structures DROP CONSTRAINT IF EXISTS structures_pkey;

-- Set new PK
ALTER TABLE structures ADD PRIMARY KEY (record_id);

-- Add Logic Constraints
-- 1. Default items must be unique by ID
CREATE UNIQUE INDEX IF NOT EXISTS structures_id_default_idx ON structures (id) WHERE user_id IS NULL;

-- 2. User items must be unique by ID per User
CREATE UNIQUE INDEX IF NOT EXISTS structures_id_user_idx ON structures (id, user_id) WHERE user_id IS NOT NULL;


-- ==========================================
-- TABLE: special_structures
-- ==========================================

ALTER TABLE special_structures ADD COLUMN IF NOT EXISTS record_id UUID DEFAULT uuid_generate_v4();
ALTER TABLE special_structures DROP CONSTRAINT IF EXISTS special_structures_pkey;
ALTER TABLE special_structures ADD PRIMARY KEY (record_id);

CREATE UNIQUE INDEX IF NOT EXISTS special_structures_id_default_idx ON special_structures (id) WHERE user_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS special_structures_id_user_idx ON special_structures (id, user_id) WHERE user_id IS NOT NULL;


-- ==========================================
-- TABLE: materials
-- ==========================================
-- Note: 'materials' might use 'Materials Code' or 'mat_sl' as ID. Adjusting based on standard schema.
-- Checking if 'id' exists. If not, we skip adding constraints on 'id' and just add record_id.
-- Assuming standard EstiGen schema has 'id' or we treat 'Materials Code' as the logical ID.

ALTER TABLE materials ADD COLUMN IF NOT EXISTS record_id UUID DEFAULT uuid_generate_v4();
ALTER TABLE materials DROP CONSTRAINT IF EXISTS materials_pkey;
ALTER TABLE materials ADD PRIMARY KEY (record_id);

-- Optional: Add constraints if you have a logical ID column (e.g. 'code')
-- CREATE UNIQUE INDEX IF NOT EXISTS materials_code_default_idx ON materials ("Materials Code") WHERE user_id IS NULL;
-- CREATE UNIQUE INDEX IF NOT EXISTS materials_code_user_idx ON materials ("Materials Code", user_id) WHERE user_id IS NOT NULL;


-- ==========================================
-- TABLE: labour
-- ==========================================

ALTER TABLE labour ADD COLUMN IF NOT EXISTS record_id UUID DEFAULT uuid_generate_v4();
ALTER TABLE labour DROP CONSTRAINT IF EXISTS labour_pkey;
ALTER TABLE labour ADD PRIMARY KEY (record_id);
