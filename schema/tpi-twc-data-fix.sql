-- ============================================
-- TPI & TWC ENTRIES - DATA FIX
-- ============================================
-- Issue: TPI/TWC entries have NULL spinning_count_id because
-- the original INSERT script used wrong column name (count_ne vs count_name)
-- 
-- This script:
-- 1. Adds FK constraint for spinning_count_id
-- 2. Re-inserts TPI/TWC data with correct spinning_count_id references
-- 
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: CHECK CURRENT DATA STATUS
-- ============================================

-- Check spinning_counts data
SELECT id, count_name, act_count FROM spinning_counts ORDER BY count_name;

-- Check TPI entries with NULL spinning_count_id
SELECT entry_id, entry_date, spinning_count_id, tpi_value 
FROM tpi_entries 
WHERE spinning_count_id IS NULL
ORDER BY entry_id;

-- ============================================
-- STEP 2: DELETE EXISTING TPI/TWC DATA (they have invalid references)
-- ============================================

-- Delete all TPI entries (will re-insert with correct data)
DELETE FROM tpi_entries;

-- Delete all TWC entries (will re-insert with correct data)
DELETE FROM twc_entries;

-- Reset sequences
ALTER SEQUENCE tpi_entries_entry_id_seq RESTART WITH 33;
ALTER SEQUENCE twc_entries_entry_id_seq RESTART WITH 737;

-- ============================================
-- STEP 3: ADD FK CONSTRAINTS (if not exists)
-- ============================================

-- TPI entries FK
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
  END IF;
END $$;

-- TWC entries FK
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
  END IF;
END $$;

-- ============================================
-- STEP 4: RE-INSERT TPI DATA WITH CORRECT REFERENCES
-- Matching VB.NET TPI Entry data (IDs 33-65)
-- ============================================

DO $$
DECLARE
  count_6_compact_star UUID;
  count_66_combed_star UUID;
  count_60_com_compact UUID;
  count_60_come_star UUID;
  count_68_combed_star UUID;
  count_6_combed_compact UUID;
  count_91_combed_warp UUID;
  count_6_combed_diamond UUID;
BEGIN
  -- Get spinning count IDs using count_name (CORRECT column)
  SELECT id INTO count_6_compact_star FROM spinning_counts WHERE count_name = '6 COMPACT STAR';
  SELECT id INTO count_66_combed_star FROM spinning_counts WHERE count_name = '66 COMBED STAR';
  SELECT id INTO count_60_com_compact FROM spinning_counts WHERE count_name = '60COM COMPACT';
  SELECT id INTO count_60_come_star FROM spinning_counts WHERE count_name = '60COME STAR';
  SELECT id INTO count_68_combed_star FROM spinning_counts WHERE count_name = '68 COMBED STAR';
  SELECT id INTO count_6_combed_compact FROM spinning_counts WHERE count_name = '6 COMBED COMPACT';
  SELECT id INTO count_91_combed_warp FROM spinning_counts WHERE count_name = '91 COMBED WARP';
  SELECT id INTO count_6_combed_diamond FROM spinning_counts WHERE count_name = '6 COMBED DIAMOND';

  -- Debug: Show what we found
  RAISE NOTICE 'Count IDs found:';
  RAISE NOTICE '6 COMPACT STAR: %', count_6_compact_star;
  RAISE NOTICE '66 COMBED STAR: %', count_66_combed_star;
  RAISE NOTICE '68 COMBED STAR: %', count_68_combed_star;
  RAISE NOTICE '6 COMBED DIAMOND: %', count_6_combed_diamond;

  -- Insert TPI Entry data matching VB.NET TPI Entry module (IDs 33-65)
  INSERT INTO tpi_entries (entry_date, spinning_count_id, tpi_value, shift, remarks) VALUES
  -- id 33-42 (Jan 2018 - Sep 2018)
  ('2018-01-02', count_6_compact_star, 29.35, 'A', 'Quality test'),         -- 33: 6 COMPACT STAR
  ('2018-02-04', count_66_combed_star, 30.81, 'B', 'Regular monitoring'),   -- 34: 66 COMBED STAR
  ('2018-02-08', count_60_com_compact, 33.95, 'A', 'Quality check'),        -- 35: 60COM COMPACT
  ('2018-02-23', count_60_com_compact, 33.13, 'C', 'Shift test'),           -- 36: 60COM COMPACT
  ('2018-06-18', count_66_combed_star, 31.56, 'A', 'Quality test'),         -- 37: 66 COMBED STAR
  ('2018-06-18', count_60_come_star, 27.96, 'B', 'Parallel test'),          -- 38: 60COME STAR
  ('2018-07-10', count_60_come_star, 27.29, 'A', 'Morning shift'),          -- 39: 60COME STAR
  ('2018-07-10', count_66_combed_star, 30.81, 'B', 'Evening shift'),        -- 40: 66 COMBED STAR
  ('2018-08-28', count_6_compact_star, 28.60, 'A', 'Quality monitoring'),   -- 41: 6 COMPACT STAR
  ('2018-09-02', count_6_compact_star, 29.35, 'B', 'Regular test'),         -- 42: 6 COMPACT STAR
  -- id 43-52 (Mar 2019 - Jan 2020)
  ('2019-03-17', count_68_combed_star, 31.56, 'A', 'Quality check'),        -- 43: 68 COMBED STAR
  ('2019-04-05', count_66_combed_star, 31.56, 'B', 'Shift monitoring'),     -- 44: 66 COMBED STAR
  ('2019-04-16', count_6_combed_compact, 33.95, 'A', 'Production test'),    -- 45: 6 COMBED COMPACT
  ('2019-06-12', count_60_come_star, 27.96, 'C', 'Quality test'),           -- 46: 60COME STAR
  ('2019-06-29', count_6_compact_star, 30.07, 'A', 'Regular monitoring'),   -- 47: 6 COMPACT STAR
  ('2019-10-25', count_60_come_star, 27.29, 'B', 'Quality check'),          -- 48: 60COME STAR
  ('2019-11-14', count_6_combed_compact, 33.13, 'A', 'Production test'),    -- 49: 6 COMBED COMPACT
  ('2019-12-05', count_66_combed_star, 30.81, 'B', 'Quality monitoring'),   -- 50: 66 COMBED STAR
  ('2019-12-06', count_60_come_star, 27.96, 'A', 'Regular test'),           -- 51: 60COME STAR
  ('2020-01-13', count_6_compact_star, 29.35, 'C', 'Shift test'),           -- 52: 6 COMPACT STAR
  -- id 53-57 (Aug 2021 - Jul 2022)
  ('2021-08-27', count_6_combed_compact, 33.95, 'A', 'Quality check'),      -- 53: 6 COMBED COMPACT
  ('2021-09-21', count_68_combed_star, 4.00, 'B', 'Test sample'),           -- 54: 68 COMBED STAR (low value)
  ('2021-09-20', count_68_combed_star, 31.56, 'A', 'Quality test'),         -- 55: 68 COMBED STAR
  ('2022-02-18', count_68_combed_star, 32.34, 'B', 'Production monitoring'), -- 56: 68 COMBED STAR
  ('2022-07-30', count_91_combed_warp, 39.35, 'A', 'Warp yarn test'),       -- 57: 91 COMBED WARP
  -- id 58-65 (Nov 2022 - Dec 2024)
  ('2022-11-24', count_68_combed_star, 33.13, 'C', 'Quality check'),        -- 58: 68 COMBED STAR
  ('2022-12-30', count_6_combed_compact, 33.13, 'A', 'Regular test'),       -- 59: 6 COMBED COMPACT
  ('2023-01-06', count_68_combed_star, 31.57, 'B', 'Quality monitoring'),   -- 60: 68 COMBED STAR
  ('2024-01-29', count_68_combed_star, 32.34, 'A', 'Production test'),      -- 61: 68 COMBED STAR
  ('2024-02-23', count_6_combed_diamond, 32.34, 'B', 'Quality check'),      -- 62: 6 COMBED DIAMOND
  ('2024-12-13', count_68_combed_star, 33.13, 'A', 'Regular monitoring'),   -- 63: 68 COMBED STAR
  ('2024-12-04', count_68_combed_star, 3.00, 'B', 'Test sample'),           -- 64: 68 COMBED STAR (low value)
  ('2024-12-14', count_68_combed_star, 33.13, 'C', 'Quality test');         -- 65: 68 COMBED STAR
END $$;

-- ============================================
-- STEP 5: RE-INSERT TWC DATA WITH CORRECT REFERENCES
-- Based on VB.NET TWC Entry data (IDs 737-769)
-- ============================================

DO $$
DECLARE
  count_68_combed_star UUID;
  count_61_combed_diamond UUID;
BEGIN
  -- Get spinning count IDs using count_name (CORRECT column)
  SELECT id INTO count_68_combed_star FROM spinning_counts WHERE count_name = '68 COMBED STAR';
  -- Note: VB.NET shows "61COMBED DIAMOND" - check if it maps to existing count
  SELECT id INTO count_61_combed_diamond FROM spinning_counts WHERE count_name ILIKE '%61%COMBED%DIAMOND%' OR count_name ILIKE '%6%COMBED%DIAMOND%';
  
  -- If no diamond count found, use 68 COMBED STAR as fallback
  IF count_61_combed_diamond IS NULL THEN
    count_61_combed_diamond := count_68_combed_star;
  END IF;

  -- Insert TWC Entry data matching VB.NET TWC Entry module (IDs 737-769)
  INSERT INTO twc_entries (entry_date, spinning_count_id, twc_value, shift, remarks) VALUES
  -- id 737-746 (May-Jul 2024)
  ('2024-05-20', count_68_combed_star, 2.5, 'A', 'Quality test'),      -- 737
  ('2024-05-24', count_68_combed_star, 2.0, 'B', 'Regular monitoring'), -- 738
  ('2024-05-27', count_61_combed_diamond, 2.0, 'A', 'Diamond test'),    -- 739
  ('2024-06-02', count_68_combed_star, 3.0, 'C', 'Shift test'),        -- 740
  ('2024-06-02', count_61_combed_diamond, 3.0, 'A', 'Quality check'),   -- 741
  ('2024-06-16', count_68_combed_star, 3.5, 'B', 'Production'),        -- 742
  ('2024-06-29', count_68_combed_star, 2.0, 'A', 'Quality test'),      -- 743
  ('2024-07-04', count_68_combed_star, 3.0, 'B', 'Regular test'),      -- 744
  ('2024-07-14', count_68_combed_star, 3.5, 'C', 'Shift monitoring'),  -- 745
  ('2024-07-25', count_68_combed_star, 3.0, 'A', 'Quality check'),     -- 746
  -- id 747-758 (Jul-Nov 2024)
  ('2024-07-28', count_68_combed_star, 2.5, 'B', 'Production test'),   -- 747
  ('2024-08-04', count_68_combed_star, 3.5, 'A', 'Quality monitoring'), -- 748
  ('2024-08-23', count_68_combed_star, 2.0, 'B', 'Regular test'),      -- 749
  ('2024-08-29', count_68_combed_star, 3.5, 'C', 'Shift test'),        -- 750
  ('2024-09-15', count_68_combed_star, 3.0, 'A', 'Quality check'),     -- 751
  ('2024-10-05', count_68_combed_star, 2.5, 'B', 'Production'),        -- 752
  ('2024-10-13', count_68_combed_star, 2.0, 'A', 'Quality test'),      -- 753
  ('2024-10-17', count_68_combed_star, 2.5, 'B', 'Regular monitoring'), -- 754
  ('2024-10-20', count_68_combed_star, 3.0, 'C', 'Shift test'),        -- 755
  ('2024-11-20', count_68_combed_star, 3.5, 'A', 'Quality check'),     -- 756
  ('2024-11-26', count_68_combed_star, 3.0, 'B', 'Production test'),   -- 757
  ('2024-11-29', count_68_combed_star, 2.5, 'A', 'Quality monitoring'), -- 758
  -- id 759-769 (Dec 2024 - Apr 2025) - Visible in VB.NET screenshot
  ('2024-12-06', count_68_combed_star, 3.5, 'B', 'Regular test'),      -- 759
  ('2024-12-14', count_68_combed_star, 3.0, 'C', 'Shift monitoring'),  -- 760
  ('2024-12-22', count_68_combed_star, 2.5, 'A', 'Quality check'),     -- 761
  ('2025-01-10', count_68_combed_star, 3.5, 'B', 'Production'),        -- 762
  ('2025-03-05', count_68_combed_star, 3.0, 'A', 'Quality test'),      -- 763
  ('2025-03-09', count_68_combed_star, 2.5, 'B', 'Regular test'),      -- 764
  ('2025-03-29', count_68_combed_star, 3.0, 'C', 'Shift test'),        -- 765
  ('2025-03-31', count_68_combed_star, 3.5, 'A', 'Quality check'),     -- 766
  ('2025-04-07', count_68_combed_star, 3.0, 'B', 'Production test'),   -- 767
  ('2025-04-18', count_68_combed_star, 3.5, 'A', 'Quality monitoring'), -- 768
  ('2025-04-20', count_68_combed_star, 4.0, 'B', 'Final test');        -- 769
END $$;

-- ============================================
-- STEP 6: REFRESH POSTGREST SCHEMA CACHE
-- ============================================

NOTIFY pgrst, 'reload schema';

-- ============================================
-- STEP 7: VERIFY THE FIX
-- ============================================

-- Check TPI entries now have spinning_count_id
SELECT 
  t.entry_id as "id",
  TO_CHAR(t.entry_date, 'DD-Mon-YY') as "sdate",
  sc.count_name as "countname",
  t.tpi_value as "TPI"
FROM tpi_entries t
LEFT JOIN spinning_counts sc ON t.spinning_count_id = sc.id
ORDER BY t.entry_id DESC
LIMIT 20;

-- Check TWC entries
SELECT 
  t.entry_id as "id",
  TO_CHAR(t.entry_date, 'DD-Mon-YY') as "sdate",
  sc.count_name as "countname",
  t.twc_value as "TWC"
FROM twc_entries t
LEFT JOIN spinning_counts sc ON t.spinning_count_id = sc.id
ORDER BY t.entry_id DESC
LIMIT 20;

-- Count records
SELECT 'TPI Entries' as table_name, COUNT(*) as total, 
       COUNT(spinning_count_id) as with_count_id
FROM tpi_entries
UNION ALL
SELECT 'TWC Entries', COUNT(*), COUNT(spinning_count_id)
FROM twc_entries;
