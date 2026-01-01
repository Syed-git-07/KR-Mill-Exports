-- ============================================
-- FINISHER DRAWING ENTRY MODULE - Schema Fixes
-- Created: 26-Dec-2025
-- ============================================
-- This file contains fixes for the Finisher Drawing Entry module
-- to resolve update issues and add missing columns
-- ============================================

-- ============================================
-- 1. ADD MISSING COLUMN: is_full_stoppage
-- The code references this column but it was not in original schema
-- ============================================
ALTER TABLE finisher_drawing_stoppage_entry 
ADD COLUMN IF NOT EXISTS is_full_stoppage BOOLEAN DEFAULT false;

COMMENT ON COLUMN finisher_drawing_stoppage_entry.is_full_stoppage IS 
  'Indicates if this stoppage was applied via Full Stoppage feature (applies to all machines)';

-- ============================================
-- 2. FIX: Add missing prodn_mixing column to machine_setup if not exists
-- This is referenced in the UI but may be missing
-- ============================================
ALTER TABLE finisher_drawing_machine_setup 
ADD COLUMN IF NOT EXISTS prodn_mixing VARCHAR(100);

-- Update machine setup with mixing from machine master
UPDATE finisher_drawing_machine_setup ms
SET prodn_mixing = m.prodn_mixing
FROM drawing_finisher_machines m
WHERE ms.machine_id = m.id
  AND (ms.prodn_mixing IS NULL OR ms.prodn_mixing = '');

-- ============================================
-- 3. ENSURE RLS POLICIES ARE CORRECTLY SET
-- Re-create policies to ensure they work correctly
-- ============================================

-- Drop and recreate policies for finisher_drawing_stoppage_entry
DROP POLICY IF EXISTS "Enable read access for all users" ON finisher_drawing_stoppage_entry;
DROP POLICY IF EXISTS "Enable insert for all users" ON finisher_drawing_stoppage_entry;
DROP POLICY IF EXISTS "Enable update for all users" ON finisher_drawing_stoppage_entry;
DROP POLICY IF EXISTS "Enable delete for all users" ON finisher_drawing_stoppage_entry;

CREATE POLICY "Enable read access for all users" ON finisher_drawing_stoppage_entry 
  FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON finisher_drawing_stoppage_entry 
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON finisher_drawing_stoppage_entry 
  FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON finisher_drawing_stoppage_entry 
  FOR DELETE USING (true);

-- Drop and recreate policies for finisher_drawing_production_detail
DROP POLICY IF EXISTS "Enable read access for all users" ON finisher_drawing_production_detail;
DROP POLICY IF EXISTS "Enable insert for all users" ON finisher_drawing_production_detail;
DROP POLICY IF EXISTS "Enable update for all users" ON finisher_drawing_production_detail;
DROP POLICY IF EXISTS "Enable delete for all users" ON finisher_drawing_production_detail;

CREATE POLICY "Enable read access for all users" ON finisher_drawing_production_detail 
  FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON finisher_drawing_production_detail 
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON finisher_drawing_production_detail 
  FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON finisher_drawing_production_detail 
  FOR DELETE USING (true);

-- Drop and recreate policies for finisher_drawing_machine_setup
DROP POLICY IF EXISTS "Enable read access for all users" ON finisher_drawing_machine_setup;
DROP POLICY IF EXISTS "Enable insert for all users" ON finisher_drawing_machine_setup;
DROP POLICY IF EXISTS "Enable update for all users" ON finisher_drawing_machine_setup;
DROP POLICY IF EXISTS "Enable delete for all users" ON finisher_drawing_machine_setup;

CREATE POLICY "Enable read access for all users" ON finisher_drawing_machine_setup 
  FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON finisher_drawing_machine_setup 
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON finisher_drawing_machine_setup 
  FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON finisher_drawing_machine_setup 
  FOR DELETE USING (true);

-- Drop and recreate policies for finisher_drawing_production_header
DROP POLICY IF EXISTS "Enable read access for all users" ON finisher_drawing_production_header;
DROP POLICY IF EXISTS "Enable insert for all users" ON finisher_drawing_production_header;
DROP POLICY IF EXISTS "Enable update for all users" ON finisher_drawing_production_header;
DROP POLICY IF EXISTS "Enable delete for all users" ON finisher_drawing_production_header;

CREATE POLICY "Enable read access for all users" ON finisher_drawing_production_header 
  FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON finisher_drawing_production_header 
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON finisher_drawing_production_header 
  FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON finisher_drawing_production_header 
  FOR DELETE USING (true);

-- ============================================
-- 4. GRANT PERMISSIONS TO ANON AND AUTHENTICATED ROLES
-- Ensure both roles can perform all operations
-- ============================================

-- Stoppage Entry
GRANT SELECT, INSERT, UPDATE, DELETE ON finisher_drawing_stoppage_entry TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON finisher_drawing_stoppage_entry TO authenticated;

-- Production Detail
GRANT SELECT, INSERT, UPDATE, DELETE ON finisher_drawing_production_detail TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON finisher_drawing_production_detail TO authenticated;

-- Machine Setup
GRANT SELECT, INSERT, UPDATE, DELETE ON finisher_drawing_machine_setup TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON finisher_drawing_machine_setup TO authenticated;

-- Production Header
GRANT SELECT, INSERT, UPDATE, DELETE ON finisher_drawing_production_header TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON finisher_drawing_production_header TO authenticated;

-- ============================================
-- 5. FIX: Ensure triggers are working for updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_fd_stoppage_updated_at ON finisher_drawing_stoppage_entry;
CREATE TRIGGER update_fd_stoppage_updated_at 
  BEFORE UPDATE ON finisher_drawing_stoppage_entry 
  FOR EACH ROW EXECUTE FUNCTION update_fd_updated_at();

DROP TRIGGER IF EXISTS update_fd_prod_detail_updated_at ON finisher_drawing_production_detail;
CREATE TRIGGER update_fd_prod_detail_updated_at 
  BEFORE UPDATE ON finisher_drawing_production_detail 
  FOR EACH ROW EXECUTE FUNCTION update_fd_updated_at();

DROP TRIGGER IF EXISTS update_fd_machine_setup_updated_at ON finisher_drawing_machine_setup;
CREATE TRIGGER update_fd_machine_setup_updated_at 
  BEFORE UPDATE ON finisher_drawing_machine_setup 
  FOR EACH ROW EXECUTE FUNCTION update_fd_updated_at();

-- ============================================
-- 6. VERIFICATION QUERIES
-- ============================================

-- Verify the is_full_stoppage column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'finisher_drawing_stoppage_entry' 
    AND column_name = 'is_full_stoppage'
  ) THEN
    RAISE NOTICE '✅ is_full_stoppage column exists';
  ELSE
    RAISE NOTICE '❌ is_full_stoppage column NOT found - check migration';
  END IF;
END $$;

-- Verify all tables are accessible
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Check stoppage_entry
  SELECT COUNT(*) INTO v_count FROM finisher_drawing_stoppage_entry;
  RAISE NOTICE '✅ finisher_drawing_stoppage_entry accessible, rows: %', v_count;
  
  -- Check production_detail
  SELECT COUNT(*) INTO v_count FROM finisher_drawing_production_detail;
  RAISE NOTICE '✅ finisher_drawing_production_detail accessible, rows: %', v_count;
  
  -- Check machine_setup
  SELECT COUNT(*) INTO v_count FROM finisher_drawing_machine_setup;
  RAISE NOTICE '✅ finisher_drawing_machine_setup accessible, rows: %', v_count;
  
  -- Check production_header
  SELECT COUNT(*) INTO v_count FROM finisher_drawing_production_header;
  RAISE NOTICE '✅ finisher_drawing_production_header accessible, rows: %', v_count;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Error accessing tables: %', SQLERRM;
END $$;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ Finisher Drawing Entry Fixes Applied!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '1. Added is_full_stoppage column to stoppage_entry';
  RAISE NOTICE '2. Added prodn_mixing column to machine_setup';
  RAISE NOTICE '3. Re-created RLS policies for all tables';
  RAISE NOTICE '4. Granted permissions to anon and authenticated roles';
  RAISE NOTICE '5. Ensured triggers are working for updated_at';
  RAISE NOTICE '============================================';
END $$;
