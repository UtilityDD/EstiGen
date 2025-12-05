-- Migration: Create estimates table for saving generated estimates
-- Author: EstiGen
-- Date: 2024-12-04

-- Create estimates table
CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id TEXT NOT NULL UNIQUE,  -- EST-timestamp format
  work_name TEXT NOT NULL,
  work_category TEXT NOT NULL,
  voltage_levels TEXT[] NOT NULL,
  prepared_by TEXT NOT NULL,
  surveyed_by TEXT NOT NULL,
  
  -- Structure selections
  structures JSONB NOT NULL,  -- {structureId: quantity}
  route_lengths JSONB,        -- {voltage: {length, conductor}}
  
  -- Cost parameters
  gst_percent NUMERIC DEFAULT 18,
  gst_on TEXT DEFAULT 'mat-lab',
  contingency_percent NUMERIC DEFAULT 3,
  contingency_on TEXT DEFAULT 'mat-lab',
  supervision_percent NUMERIC DEFAULT 5,
  supervision_on TEXT DEFAULT 'mat-lab',
  cess_percent NUMERIC DEFAULT 1,
  cess_on TEXT DEFAULT 'mat-lab',
  
  -- Generated results (for quick display without regeneration)
  total_material_cost NUMERIC,
  total_labour_cost NUMERIC,
  grand_total NUMERIC,
  materials JSONB,  -- Full materials breakdown
  labour JSONB,     -- Full labour breakdown
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,  -- For future multi-user support
  
  -- Search/filter helpers
  created_date DATE GENERATED ALWAYS AS (CAST(created_at AS DATE)) STORED
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_estimates_created_at ON estimates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_estimates_estimate_id ON estimates(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimates_work_category ON estimates(work_category);
CREATE INDEX IF NOT EXISTS idx_estimates_created_date ON estimates(created_date);

-- Add comment to table
COMMENT ON TABLE estimates IS 'Stores saved estimate data including all parameters and calculated results';

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_estimates_updated_at
    BEFORE UPDATE ON estimates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) - Enable for future multi-user support
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;

-- For now, allow all operations (update when authentication is added)
CREATE POLICY "Allow all operations for now" ON estimates
    FOR ALL
    USING (true)
    WITH CHECK (true);
