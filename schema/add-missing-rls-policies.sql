-- ============================================
-- ADD MISSING RLS POLICIES
-- ============================================
-- This script adds Row Level Security policies to tables
-- that are currently missing protection
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. AUTOCONER_MACHINES TABLE
-- ============================================
ALTER TABLE autoconer_machines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON autoconer_machines;
DROP POLICY IF EXISTS "Enable insert for all users" ON autoconer_machines;
DROP POLICY IF EXISTS "Enable update for all users" ON autoconer_machines;
DROP POLICY IF EXISTS "Enable delete for all users" ON autoconer_machines;

CREATE POLICY "Enable read access for all users" 
ON autoconer_machines FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON autoconer_machines FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON autoconer_machines FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON autoconer_machines FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON autoconer_machines TO anon, authenticated;

-- ============================================
-- 2. SPINNING_MACHINES TABLE
-- ============================================
ALTER TABLE spinning_machines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON spinning_machines;
DROP POLICY IF EXISTS "Enable insert for all users" ON spinning_machines;
DROP POLICY IF EXISTS "Enable update for all users" ON spinning_machines;
DROP POLICY IF EXISTS "Enable delete for all users" ON spinning_machines;

CREATE POLICY "Enable read access for all users" 
ON spinning_machines FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON spinning_machines FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON spinning_machines FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON spinning_machines FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON spinning_machines TO anon, authenticated;

-- ============================================
-- 3. STOPPAGE_HEADS TABLE
-- ============================================
ALTER TABLE stoppage_heads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON stoppage_heads;
DROP POLICY IF EXISTS "Enable insert for all users" ON stoppage_heads;
DROP POLICY IF EXISTS "Enable update for all users" ON stoppage_heads;
DROP POLICY IF EXISTS "Enable delete for all users" ON stoppage_heads;

CREATE POLICY "Enable read access for all users" 
ON stoppage_heads FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON stoppage_heads FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON stoppage_heads FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON stoppage_heads FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON stoppage_heads TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE stoppage_heads_code_seq TO anon, authenticated;

-- ============================================
-- 4. STOPPAGE_DETAILS TABLE
-- ============================================
ALTER TABLE stoppage_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON stoppage_details;
DROP POLICY IF EXISTS "Enable insert for all users" ON stoppage_details;
DROP POLICY IF EXISTS "Enable update for all users" ON stoppage_details;
DROP POLICY IF EXISTS "Enable delete for all users" ON stoppage_details;

CREATE POLICY "Enable read access for all users" 
ON stoppage_details FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON stoppage_details FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON stoppage_details FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON stoppage_details FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON stoppage_details TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE stoppage_details_code_seq TO anon, authenticated;

-- ============================================
-- 5. TPI_ENTRIES TABLE
-- ============================================
ALTER TABLE tpi_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON tpi_entries;
DROP POLICY IF EXISTS "Enable insert for all users" ON tpi_entries;
DROP POLICY IF EXISTS "Enable update for all users" ON tpi_entries;
DROP POLICY IF EXISTS "Enable delete for all users" ON tpi_entries;

CREATE POLICY "Enable read access for all users" 
ON tpi_entries FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON tpi_entries FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON tpi_entries FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON tpi_entries FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON tpi_entries TO anon, authenticated;

-- ============================================
-- 6. TWC_ENTRIES TABLE
-- ============================================
ALTER TABLE twc_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON twc_entries;
DROP POLICY IF EXISTS "Enable insert for all users" ON twc_entries;
DROP POLICY IF EXISTS "Enable update for all users" ON twc_entries;
DROP POLICY IF EXISTS "Enable delete for all users" ON twc_entries;

CREATE POLICY "Enable read access for all users" 
ON twc_entries FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON twc_entries FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON twc_entries FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON twc_entries FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON twc_entries TO anon, authenticated;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check RLS is enabled on all tables
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN (
    'autoconer_machines',
    'spinning_machines', 
    'stoppage_heads',
    'stoppage_details',
    'tpi_entries',
    'twc_entries'
  )
ORDER BY tablename;

-- Check policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as operation
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN (
    'autoconer_machines',
    'spinning_machines',
    'stoppage_heads',
    'stoppage_details',
    'tpi_entries',
    'twc_entries'
  )
ORDER BY tablename, cmd;

-- Count policies per table
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
