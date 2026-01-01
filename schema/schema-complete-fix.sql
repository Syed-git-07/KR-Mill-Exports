-- ============================================
-- SCHEMA UPDATES NEEDED
-- Based on comparison between complete-schema.sql and plan.md
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- ISSUE 1: SUPERVISORS TABLE - ENSURE DATA EXISTS
-- ============================================

-- Check current supervisors count
DO $$
DECLARE
  supervisor_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO supervisor_count FROM supervisors;
  
  IF supervisor_count = 0 THEN
    RAISE NOTICE 'No supervisors found! Inserting sample data from plan.md...';
    
    -- Insert supervisors from plan.md (all in RING SPINNING department)
    INSERT INTO supervisors (supervisor_name, department_id, is_active)
    SELECT 
      supervisor_name,
      (SELECT id FROM departments WHERE dept_name = 'RING SPINNING' LIMIT 1),
      true
    FROM (VALUES
      ('nil'),
      ('CHINNADURA.R'),
      ('SUBRAMANIAN.A'),
      ('A.NAMBRI RAJ'),
      ('SAKARA.RAM.G'),
      ('BALASUBRAMANIAN'),
      ('SASIKUMAR'),
      ('THANGARA.J.P'),
      ('KALINITH.M.K'),
      ('PRAKASH Y'),
      ('N ESTHIAPPAN')
    ) AS t(supervisor_name)
    ON CONFLICT (supervisor_name) DO NOTHING;
    
    RAISE NOTICE 'Sample supervisors inserted.';
  ELSE
    RAISE NOTICE 'Found % supervisors in table.', supervisor_count;
  END IF;
END $$;

-- ============================================
-- ISSUE 2: VERIFY CODE COLUMN EXISTS
-- ============================================

DO $$
BEGIN
  -- Check if code column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'supervisors' AND column_name = 'code'
  ) THEN
    RAISE EXCEPTION 'Code column missing! Run supabase-supervisor-schema-fix.sql first';
  ELSE
    RAISE NOTICE 'Code column exists - OK';
  END IF;
END $$;

-- ============================================
-- ISSUE 3: ENSURE ALL SUPERVISORS HAVE CODES
-- ============================================

DO $$
DECLARE
  null_code_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_code_count FROM supervisors WHERE code IS NULL;
  
  IF null_code_count > 0 THEN
    RAISE NOTICE 'Found % supervisors without codes. Fixing...', null_code_count;
    
    -- Assign codes to supervisors without codes
    WITH numbered AS (
      SELECT 
        id,
        ROW_NUMBER() OVER (ORDER BY created_at) + 
        COALESCE((SELECT MAX(code) FROM supervisors WHERE code IS NOT NULL), 0) as new_code
      FROM supervisors
      WHERE code IS NULL
    )
    UPDATE supervisors s
    SET code = n.new_code
    FROM numbered n
    WHERE s.id = n.id;
    
    RAISE NOTICE 'Assigned codes to % supervisors.', null_code_count;
  ELSE
    RAISE NOTICE 'All supervisors have codes - OK';
  END IF;
END $$;

-- ============================================
-- ISSUE 4: ADD MISSING RLS POLICIES (if needed)
-- ============================================

-- Enable RLS if not already enabled
ALTER TABLE supervisors ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (to avoid duplicates)
DROP POLICY IF EXISTS "Enable read access for all users" ON supervisors;
DROP POLICY IF EXISTS "Enable insert for all users" ON supervisors;
DROP POLICY IF EXISTS "Enable update for all users" ON supervisors;
DROP POLICY IF EXISTS "Enable delete for all users" ON supervisors;

-- Create RLS policies for anonymous access
CREATE POLICY "Enable read access for all users" 
ON supervisors FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON supervisors FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON supervisors FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON supervisors FOR DELETE USING (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON supervisors TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE supervisors_code_seq TO anon, authenticated;

-- ============================================
-- ISSUE 5: ADD MISSING RLS TO OTHER TABLES
-- ============================================

-- AUTOCONER_MACHINES
ALTER TABLE autoconer_machines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON autoconer_machines;
CREATE POLICY "Enable read access for all users" ON autoconer_machines FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all users" ON autoconer_machines;
CREATE POLICY "Enable insert for all users" ON autoconer_machines FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for all users" ON autoconer_machines;
CREATE POLICY "Enable update for all users" ON autoconer_machines FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable delete for all users" ON autoconer_machines;
CREATE POLICY "Enable delete for all users" ON autoconer_machines FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON autoconer_machines TO anon, authenticated;

-- SPINNING_MACHINES
ALTER TABLE spinning_machines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON spinning_machines;
CREATE POLICY "Enable read access for all users" ON spinning_machines FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all users" ON spinning_machines;
CREATE POLICY "Enable insert for all users" ON spinning_machines FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for all users" ON spinning_machines;
CREATE POLICY "Enable update for all users" ON spinning_machines FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable delete for all users" ON spinning_machines;
CREATE POLICY "Enable delete for all users" ON spinning_machines FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON spinning_machines TO anon, authenticated;

-- STOPPAGE_HEADS
ALTER TABLE stoppage_heads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON stoppage_heads;
CREATE POLICY "Enable read access for all users" ON stoppage_heads FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all users" ON stoppage_heads;
CREATE POLICY "Enable insert for all users" ON stoppage_heads FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for all users" ON stoppage_heads;
CREATE POLICY "Enable update for all users" ON stoppage_heads FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable delete for all users" ON stoppage_heads;
CREATE POLICY "Enable delete for all users" ON stoppage_heads FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON stoppage_heads TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE stoppage_heads_code_seq TO anon, authenticated;

-- STOPPAGE_DETAILS
ALTER TABLE stoppage_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON stoppage_details;
CREATE POLICY "Enable read access for all users" ON stoppage_details FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all users" ON stoppage_details;
CREATE POLICY "Enable insert for all users" ON stoppage_details FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for all users" ON stoppage_details;
CREATE POLICY "Enable update for all users" ON stoppage_details FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable delete for all users" ON stoppage_details;
CREATE POLICY "Enable delete for all users" ON stoppage_details FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON stoppage_details TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE stoppage_details_code_seq TO anon, authenticated;

-- TPI_ENTRIES
ALTER TABLE tpi_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON tpi_entries;
CREATE POLICY "Enable read access for all users" ON tpi_entries FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all users" ON tpi_entries;
CREATE POLICY "Enable insert for all users" ON tpi_entries FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for all users" ON tpi_entries;
CREATE POLICY "Enable update for all users" ON tpi_entries FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable delete for all users" ON tpi_entries;
CREATE POLICY "Enable delete for all users" ON tpi_entries FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON tpi_entries TO anon, authenticated;

-- TWC_ENTRIES
ALTER TABLE twc_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON twc_entries;
CREATE POLICY "Enable read access for all users" ON twc_entries FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all users" ON twc_entries;
CREATE POLICY "Enable insert for all users" ON twc_entries FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for all users" ON twc_entries;
CREATE POLICY "Enable update for all users" ON twc_entries FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable delete for all users" ON twc_entries;
CREATE POLICY "Enable delete for all users" ON twc_entries FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON twc_entries TO anon, authenticated;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- 1. Check supervisors data
SELECT 
  s.code,
  s.supervisor_name,
  d.dept_name as department,
  s.is_active
FROM supervisors s
LEFT JOIN departments d ON s.department_id = d.id
ORDER BY s.code;

-- 2. Check RLS on all tables
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 3. Count policies per table
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- 4. Check supervisors query (as app would do)
SELECT 
  s.*,
  departments.id as dept_id,
  departments.dept_name
FROM supervisors s
LEFT JOIN departments ON s.department_id = departments.id
ORDER BY s.code;

-- Expected Result:
-- - 11 supervisors with codes 1-11
-- - All assigned to RING SPINNING department
-- - All tables should have RLS enabled
-- - Each table should have 4 policies (SELECT, INSERT, UPDATE, DELETE)
