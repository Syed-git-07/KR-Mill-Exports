-- ============================================
-- TPI & TWC ENTRY MASTER - SCHEMA UPDATE
-- ============================================
-- This script updates tpi_entries and twc_entries tables
-- Based on VB6 application form analysis
-- Run this in Supabase SQL Editor
-- ============================================
-- 
-- VB6 FORM FIELDS:
-- TPI Entry: Date, Count (dropdown), TPI value
-- TWC Entry: Date, Count (dropdown), TWC value
-- 
-- VB6 GRID COLUMNS:
-- id (serial 33, 34, 35...), sdate (DD-Mon-YY), countname, TPI/TWC
-- 
-- NOTE: spinning_counts table uses column "count_name" (not count_ne)
-- ============================================

-- ============================================
-- STEP 1: ADD SERIAL ID COLUMN TO TPI_ENTRIES
-- ============================================

-- Add entry_id column for VB6-like sequential display
ALTER TABLE tpi_entries 
ADD COLUMN IF NOT EXISTS entry_id SERIAL;

-- Create sequence starting from 66 (after existing 33 records)
DROP SEQUENCE IF EXISTS tpi_entries_entry_id_seq CASCADE;
CREATE SEQUENCE tpi_entries_entry_id_seq START WITH 66;

-- Only set default if column was just added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tpi_entries' 
    AND column_name = 'entry_id' 
    AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE tpi_entries ALTER COLUMN entry_id SET DEFAULT nextval('tpi_entries_entry_id_seq');
  END IF;
END $$;

-- ============================================
-- STEP 2: ADD SERIAL ID COLUMN TO TWC_ENTRIES
-- ============================================

-- Add entry_id column for VB6-like sequential display
ALTER TABLE twc_entries 
ADD COLUMN IF NOT EXISTS entry_id SERIAL;

-- Create sequence for twc entry_id (starting from 770)
DROP SEQUENCE IF EXISTS twc_entries_entry_id_seq CASCADE;
CREATE SEQUENCE twc_entries_entry_id_seq START WITH 770;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'twc_entries' 
    AND column_name = 'entry_id' 
    AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE twc_entries ALTER COLUMN entry_id SET DEFAULT nextval('twc_entries_entry_id_seq');
  END IF;
END $$;

-- ============================================
-- STEP 3: CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_tpi_entries_entry_id ON tpi_entries(entry_id);
CREATE INDEX IF NOT EXISTS idx_tpi_entries_spinning_count_id ON tpi_entries(spinning_count_id);
CREATE INDEX IF NOT EXISTS idx_twc_entries_entry_id ON twc_entries(entry_id);
CREATE INDEX IF NOT EXISTS idx_twc_entries_spinning_count_id ON twc_entries(spinning_count_id);

-- ============================================
-- STEP 4: ENABLE RLS AND CREATE POLICIES
-- ============================================

-- Enable RLS on tpi_entries
ALTER TABLE tpi_entries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (to avoid duplicates)
DROP POLICY IF EXISTS "Enable read access for all users" ON tpi_entries;
DROP POLICY IF EXISTS "Enable insert for all users" ON tpi_entries;
DROP POLICY IF EXISTS "Enable update for all users" ON tpi_entries;
DROP POLICY IF EXISTS "Enable delete for all users" ON tpi_entries;

-- Create RLS policies for tpi_entries (anonymous access)
CREATE POLICY "Enable read access for all users" 
ON tpi_entries FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON tpi_entries FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON tpi_entries FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON tpi_entries FOR DELETE USING (true);

-- Enable RLS on twc_entries
ALTER TABLE twc_entries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (to avoid duplicates)
DROP POLICY IF EXISTS "Enable read access for all users" ON twc_entries;
DROP POLICY IF EXISTS "Enable insert for all users" ON twc_entries;
DROP POLICY IF EXISTS "Enable update for all users" ON twc_entries;
DROP POLICY IF EXISTS "Enable delete for all users" ON twc_entries;

-- Create RLS policies for twc_entries (anonymous access)
CREATE POLICY "Enable read access for all users" 
ON twc_entries FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON twc_entries FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON twc_entries FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON twc_entries FOR DELETE USING (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON tpi_entries TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON twc_entries TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE tpi_entries_entry_id_seq TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE twc_entries_entry_id_seq TO anon, authenticated;

-- ============================================
-- STEP 5: UPDATE EXISTING DATA WITH ENTRY_IDs
-- ============================================

-- Update TPI entries with sequential entry_id (33-65 based on VB6 data)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY entry_date, created_at) + 32 as new_entry_id
  FROM tpi_entries
)
UPDATE tpi_entries t
SET entry_id = n.new_entry_id
FROM numbered n
WHERE t.id = n.id;

-- Update TWC entries with sequential entry_id (737-769 based on VB6 data)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY entry_date, created_at) + 736 as new_entry_id
  FROM twc_entries
)
UPDATE twc_entries t
SET entry_id = n.new_entry_id
FROM numbered n
WHERE t.id = n.id;

-- ============================================
-- STEP 6: ADD UNIQUE CONSTRAINT ON ENTRY_ID
-- ============================================
ALTER TABLE tpi_entries DROP CONSTRAINT IF EXISTS tpi_entries_entry_id_unique;
ALTER TABLE tpi_entries ADD CONSTRAINT tpi_entries_entry_id_unique UNIQUE (entry_id);

ALTER TABLE twc_entries DROP CONSTRAINT IF EXISTS twc_entries_entry_id_unique;
ALTER TABLE twc_entries ADD CONSTRAINT twc_entries_entry_id_unique UNIQUE (entry_id);

-- ============================================
-- STEP 7: CREATE VIEWS FOR GRID DISPLAY
-- ============================================

-- TPI Entry View (matches VB6 grid format)
CREATE OR REPLACE VIEW tpi_entries_view AS
SELECT 
  t.id,
  t.entry_id,
  t.entry_date,
  TO_CHAR(t.entry_date, 'DD-Mon-YY') as sdate,
  sc.count_name as countname,
  t.tpi_value as tpi,
  t.spinning_count_id,
  t.machine_id,
  t.shift,
  t.remarks,
  t.created_at,
  t.updated_at
FROM tpi_entries t
LEFT JOIN spinning_counts sc ON t.spinning_count_id = sc.id
ORDER BY t.entry_id DESC;

-- TWC Entry View (matches VB6 grid format)
CREATE OR REPLACE VIEW twc_entries_view AS
SELECT 
  t.id,
  t.entry_id,
  t.entry_date,
  TO_CHAR(t.entry_date, 'DD-Mon-YY') as sdate,
  sc.count_name as countname,
  t.twc_value as twc,
  t.spinning_count_id,
  t.machine_id,
  t.shift,
  t.remarks,
  t.created_at,
  t.updated_at
FROM twc_entries t
LEFT JOIN spinning_counts sc ON t.spinning_count_id = sc.id
ORDER BY t.entry_id DESC;

-- Grant permissions on views
GRANT SELECT ON tpi_entries_view TO anon, authenticated;
GRANT SELECT ON twc_entries_view TO anon, authenticated;

-- ============================================
-- STEP 8: VERIFY THE UPDATE
-- ============================================

-- Check TPI entries table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'tpi_entries'
ORDER BY ordinal_position;

-- Check TWC entries table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'twc_entries'
ORDER BY ordinal_position;

-- Check TPI data count
SELECT COUNT(*) as total_tpi_entries FROM tpi_entries;

-- Check TWC data count
SELECT COUNT(*) as total_twc_entries FROM twc_entries;

-- View TPI entries (VB6 format)
SELECT 
  entry_id as "id",
  sdate,
  countname,
  tpi as "TPI"
FROM tpi_entries_view
ORDER BY entry_id
LIMIT 20;

-- View TWC entries (VB6 format)
SELECT 
  entry_id as "id",
  sdate,
  countname,
  twc as "TWC"
FROM twc_entries_view
ORDER BY entry_id
LIMIT 20;

-- ============================================
-- STEP 9: ADDITIONAL SAMPLE DATA (if needed)
-- ============================================

-- Add more recent TPI entries to match VB6 image data
DO $$
DECLARE
  count_68_combed_star UUID;
  count_6_combed_diamond UUID;
  count_6_combed_compact UUID;
  count_91_combed_warp UUID;
BEGIN
  -- Get spinning count IDs
  SELECT id INTO count_68_combed_star FROM spinning_counts WHERE count_name = '68 COMBED STAR';
  SELECT id INTO count_6_combed_diamond FROM spinning_counts WHERE count_name = '6 COMBED DIAMOND';
  SELECT id INTO count_6_combed_compact FROM spinning_counts WHERE count_name = '6 COMBED COMPACT';
  SELECT id INTO count_91_combed_warp FROM spinning_counts WHERE count_name = '91 COMBED WARP';

  -- Only insert if these records don't exist (check by date)
  IF NOT EXISTS (SELECT 1 FROM tpi_entries WHERE entry_date = '2024-12-14') THEN
    INSERT INTO tpi_entries (entry_date, spinning_count_id, tpi_value, shift) VALUES
    ('2024-12-14', count_68_combed_star, 3.0, 'A');
  END IF;

END $$;

-- ============================================
-- NOTES FOR APPLICATION DEVELOPMENT
-- ============================================
-- 
-- TPI Entry Form Fields (matching VB6):
-- 1. Date - Date picker (entry_date)
-- 2. Count - Dropdown from spinning_counts (spinning_count_id -> count_name)
-- 3. TPI - Decimal input (tpi_value)
-- 
-- Grid Columns:
-- 1. id - Use entry_id (sequential integer like VB6)
-- 2. sdate - Formatted date (DD-Mon-YY)
-- 3. countname - From joined spinning_counts table
-- 4. TPI - tpi_value
-- 
-- Extra fields (machine_id, shift, remarks) are optional
-- and can be hidden from the basic form to match VB6 simplicity.
-- 
-- Query Example for Grid:
-- SELECT entry_id as id, 
--        TO_CHAR(entry_date, 'DD-Mon-YY') as sdate,
--        sc.count_name as countname,
--        tpi_value as "TPI"
-- FROM tpi_entries t
-- JOIN spinning_counts sc ON t.spinning_count_id = sc.id
-- ORDER BY entry_id;
-- ============================================
