-- ============================================
-- TPI & TWC ENTRIES - FOREIGN KEY FIX
-- ============================================
-- Issue: Missing FK constraint on spinning_count_id
-- Supabase PostgREST requires FK constraints to enable joins
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 0: FIND AND FIX ORPHAN RECORDS
-- ============================================
-- First, identify records with invalid spinning_count_id

-- View orphan TPI entries (spinning_count_id not in spinning_counts)
SELECT t.id, t.entry_id, t.entry_date, t.spinning_count_id, t.tpi_value
FROM tpi_entries t
WHERE t.spinning_count_id IS NOT NULL 
  AND t.spinning_count_id NOT IN (SELECT id FROM spinning_counts);

-- View orphan TWC entries
SELECT t.id, t.entry_id, t.entry_date, t.spinning_count_id, t.twc_value
FROM twc_entries t
WHERE t.spinning_count_id IS NOT NULL 
  AND t.spinning_count_id NOT IN (SELECT id FROM spinning_counts);

-- ============================================
-- STEP 1: CLEAN UP ORPHAN RECORDS
-- ============================================
-- Option A: Set orphan spinning_count_id to NULL (keeps the record)
UPDATE tpi_entries 
SET spinning_count_id = NULL 
WHERE spinning_count_id IS NOT NULL 
  AND spinning_count_id NOT IN (SELECT id FROM spinning_counts);

UPDATE twc_entries 
SET spinning_count_id = NULL 
WHERE spinning_count_id IS NOT NULL 
  AND spinning_count_id NOT IN (SELECT id FROM spinning_counts);

-- Option B (Alternative): Delete orphan records entirely
-- DELETE FROM tpi_entries 
-- WHERE spinning_count_id IS NOT NULL 
--   AND spinning_count_id NOT IN (SELECT id FROM spinning_counts);

-- DELETE FROM twc_entries 
-- WHERE spinning_count_id IS NOT NULL 
--   AND spinning_count_id NOT IN (SELECT id FROM spinning_counts);

-- ============================================
-- STEP 2: ADD FK CONSTRAINT FOR TPI_ENTRIES
-- ============================================

-- First check if constraint already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tpi_entries_spinning_count_id_fkey'
    AND table_name = 'tpi_entries'
  ) THEN
    ALTER TABLE tpi_entries 
    ADD CONSTRAINT tpi_entries_spinning_count_id_fkey 
    FOREIGN KEY (spinning_count_id) 
    REFERENCES spinning_counts(id) 
    ON DELETE SET NULL;
    
    RAISE NOTICE 'Added FK constraint: tpi_entries_spinning_count_id_fkey';
  ELSE
    RAISE NOTICE 'FK constraint tpi_entries_spinning_count_id_fkey already exists';
  END IF;
END $$;

-- ============================================
-- STEP 3: ADD FK CONSTRAINT FOR TWC_ENTRIES
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'twc_entries_spinning_count_id_fkey'
    AND table_name = 'twc_entries'
  ) THEN
    ALTER TABLE twc_entries 
    ADD CONSTRAINT twc_entries_spinning_count_id_fkey 
    FOREIGN KEY (spinning_count_id) 
    REFERENCES spinning_counts(id) 
    ON DELETE SET NULL;
    
    RAISE NOTICE 'Added FK constraint: twc_entries_spinning_count_id_fkey';
  ELSE
    RAISE NOTICE 'FK constraint twc_entries_spinning_count_id_fkey already exists';
  END IF;
END $$;

-- ============================================
-- STEP 4: VERIFY FK CONSTRAINTS
-- ============================================

-- Check all FK constraints on tpi_entries and twc_entries
SELECT 
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('tpi_entries', 'twc_entries');

-- ============================================
-- STEP 5: REFRESH POSTGREST SCHEMA CACHE
-- ============================================
-- After adding FK constraints, notify PostgREST to refresh its schema cache
-- This happens automatically but can be forced:

NOTIFY pgrst, 'reload schema';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Test that the join works now
SELECT 
  t.entry_id,
  t.entry_date,
  sc.count_name,
  t.tpi_value
FROM tpi_entries t
LEFT JOIN spinning_counts sc ON t.spinning_count_id = sc.id
LIMIT 5;

-- Test TWC join
SELECT 
  t.entry_id,
  t.entry_date,
  sc.count_name,
  t.twc_value
FROM twc_entries t
LEFT JOIN spinning_counts sc ON t.spinning_count_id = sc.id
LIMIT 5;
