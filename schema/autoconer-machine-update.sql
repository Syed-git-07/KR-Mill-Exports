-- ============================================
-- AUTOCONER MACHINE MASTER - SCHEMA UPDATE
-- ============================================
-- This script adds missing fields to autoconer_machines table
-- Based on VB6 application form analysis
-- Run this in Supabase SQL Editor
-- ============================================
-- 
-- FIELD DEFINITIONS:
-- mc_id: Serial number (1, 2, 3... 34) - unique per machine, auto-generated
-- group_id: Machine group from series (AC5 = 5, AC2A = 2, etc.)
-- ============================================

-- ============================================
-- STEP 1: ADD MISSING COLUMNS
-- ============================================

-- Add mc_id column (Machine ID - serial number)
ALTER TABLE autoconer_machines 
ADD COLUMN IF NOT EXISTS mc_id INTEGER;

-- Add group_id column (Machine group from series name)
ALTER TABLE autoconer_machines 
ADD COLUMN IF NOT EXISTS group_id INTEGER DEFAULT 5;

-- Add model column (Machine model)
ALTER TABLE autoconer_machines 
ADD COLUMN IF NOT EXISTS model TEXT;

-- Add from_drum column (Drum range start)
ALTER TABLE autoconer_machines 
ADD COLUMN IF NOT EXISTS from_drum INTEGER;

-- Add to_drum column (Drum range end)
ALTER TABLE autoconer_machines 
ADD COLUMN IF NOT EXISTS to_drum INTEGER;

-- Add no_of_drums column (Total drums count)
ALTER TABLE autoconer_machines 
ADD COLUMN IF NOT EXISTS no_of_drums INTEGER DEFAULT 0;

-- Add speed column (Machine speed)
ALTER TABLE autoconer_machines 
ADD COLUMN IF NOT EXISTS speed INTEGER;

-- Add count column (Yarn count - text reference)
ALTER TABLE autoconer_machines 
ADD COLUMN IF NOT EXISTS count TEXT;

-- Add installed_date column (Installation date)
ALTER TABLE autoconer_machines 
ADD COLUMN IF NOT EXISTS installed_date DATE;

-- Add direct_prod_entry column (Direct production entry flag)
ALTER TABLE autoconer_machines 
ADD COLUMN IF NOT EXISTS direct_prod_entry BOOLEAN DEFAULT false;

-- ============================================
-- STEP 2: CREATE INDEXES FOR NEW COLUMNS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_autoconer_machines_mc_id ON autoconer_machines(mc_id);
CREATE INDEX IF NOT EXISTS idx_autoconer_machines_group_id ON autoconer_machines(group_id);
CREATE INDEX IF NOT EXISTS idx_autoconer_machines_is_active ON autoconer_machines(is_active);

-- ============================================
-- STEP 3: ENABLE RLS AND CREATE POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE autoconer_machines ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (to avoid duplicates)
DROP POLICY IF EXISTS "Enable read access for all users" ON autoconer_machines;
DROP POLICY IF EXISTS "Enable insert for all users" ON autoconer_machines;
DROP POLICY IF EXISTS "Enable update for all users" ON autoconer_machines;
DROP POLICY IF EXISTS "Enable delete for all users" ON autoconer_machines;

-- Create RLS policies for anonymous access
CREATE POLICY "Enable read access for all users" 
ON autoconer_machines FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON autoconer_machines FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON autoconer_machines FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON autoconer_machines FOR DELETE USING (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON autoconer_machines TO anon, authenticated;

-- ============================================
-- STEP 4: DELETE EXISTING DATA AND INSERT FRESH
-- ============================================

-- Clear existing data
TRUNCATE TABLE autoconer_machines;

-- Insert complete Autoconer Machine Data (34 records from VB6 application)
-- mc_id: Serial number (1-34) - unique per machine
-- group_id: Machine group from series (AC5 = 5, AC2A = 2)
INSERT INTO autoconer_machines (
  mc_id, machine_no, description, make_name, act_effi, is_active,
  group_id, model, from_drum, to_drum, no_of_drums,
  speed, count, installed_date, direct_prod_entry
) VALUES
  -- mc_id 1: AC4-5 (Group 4)
  (1, 'AC4-5', 'AC4-5', 'MURT', 0, true, 4, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC5 Series (Group 5) - mc_id 2-6
  (2, 'AC5-1', 'AC5-1', 'MURT', 80, true, 5, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (3, 'AC5-2', 'AC5-2', 'MURT', 80, true, 5, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (4, 'AC5-3', 'AC5-3', 'MURT', 80, true, 5, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (5, 'AC5-4', 'AC5-4', 'MURT', 80, true, 5, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (6, 'AC5-5', 'AC5-5', 'MURT', 80, true, 5, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC6 Series (Group 6) - mc_id 7-11
  (7, 'AC6-1', 'AC6-1', 'MURT', 82, true, 6, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (8, 'AC6-2', 'AC6-2', 'MURT', 0, true, 6, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (9, 'AC6-3', 'AC6-3', 'MURT', 0, true, 6, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (10, 'AC6-4', 'AC6-4', 'MURT', 0, true, 6, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (11, 'AC6-5', 'AC6-5', 'MURT', 0, true, 6, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC7 Series (Group 7) - mc_id 12-16
  (12, 'AC7-1', 'AC7-1', 'MURT', 0, true, 7, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (13, 'AC7-2', 'AC7-2', 'MURT', 0, true, 7, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (14, 'AC7-3', 'AC7-3', 'MURT', 0, true, 7, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (15, 'AC7-4', 'AC7-4', 'MURT', 0, true, 7, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (16, 'AC7-5', 'AC7-5', 'MURT', 0, true, 7, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC8 Series (Group 8) - mc_id 17-21
  (17, 'AC8-1', 'AC8-1', 'MURT', 0, true, 8, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (18, 'AC8-2', 'AC8-2', 'MURT', 0, true, 8, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (19, 'AC8-3', 'AC8-3', 'MURT', 0, true, 8, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (20, 'AC8-4', 'AC8-4', 'MURT', 0, true, 8, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (21, 'AC8-5', 'AC8-5', 'MURT', 0, true, 8, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC9 Series (Group 9) - mc_id 22-23
  (22, 'AC9-1', 'AC9-1', 'MURT', 0, true, 9, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (23, 'AC9-2', 'AC9-2', 'MURT', 0, true, 9, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC10 Series (Group 10) - mc_id 24-25
  (24, 'AC10-1', 'AC10-1', 'MURT', 0, true, 10, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (25, 'AC10-2', 'AC10-2', 'MURT', 0, true, 10, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC11 Series (Group 11) - mc_id 26-27
  (26, 'AC11-1', 'AC11-1', 'MURT', 0, true, 11, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (27, 'AC11-2', 'AC11-2', 'MURT', 0, true, 11, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC12 Series (Group 12) - mc_id 28-29
  (28, 'AC12-1', 'AC12-1', 'MURT', 82, true, 12, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (29, 'AC12-2', 'AC12-2', 'MURT', 0, true, 12, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC13 Series (Group 13) - mc_id 30-31
  (30, 'AC13-1', 'AC13-1', 'MURT', 82, true, 13, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (31, 'AC13-2', 'AC13-2', 'MURT', 82, true, 13, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC14 Series (Group 14) - mc_id 32
  (32, 'AC14-1', 'AC14-1', 'MURT', 0, true, 14, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC2A Series (Group 2) - mc_id 33-34
  (33, 'AC2A-1', 'AC2A-1', 'MURT', 0, true, 2, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (34, 'AC2A-2', 'AC2A-2', 'MURT', 0, true, 2, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);

-- ============================================
-- STEP 5: ADD UNIQUE CONSTRAINT ON MC_ID
-- ============================================
ALTER TABLE autoconer_machines DROP CONSTRAINT IF EXISTS autoconer_machines_mc_id_unique;
ALTER TABLE autoconer_machines ADD CONSTRAINT autoconer_machines_mc_id_unique UNIQUE (mc_id);

-- ============================================
-- STEP 6: VERIFY THE UPDATE
-- ============================================

-- Check table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'autoconer_machines'
ORDER BY ordinal_position;

-- Check data count
SELECT COUNT(*) as total_machines FROM autoconer_machines;

-- View all machines ordered by mc_id
SELECT 
  mc_id as "Mc ID",
  group_id as "Group",
  machine_no as "M/c No.",
  description as "Description",
  make_name as "Make Name",
  act_effi as "ActEffi",
  is_active as "Active"
FROM autoconer_machines
ORDER BY mc_id;

-- Summary by group
SELECT 
  group_id as "Group",
  COUNT(*) as "Count",
  STRING_AGG(machine_no, ', ' ORDER BY mc_id) as "Machines"
FROM autoconer_machines
GROUP BY group_id
ORDER BY group_id;
