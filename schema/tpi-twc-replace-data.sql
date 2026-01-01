-- ============================================
-- TPI & TWC ENTRIES - REPLACE EXISTING DATA
-- ============================================
-- This script replaces existing TPI/TWC data with correct values
-- Safe to run multiple times - will delete existing and re-insert
-- 
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: TRUNCATE EXISTING DATA (faster than DELETE)
-- ============================================

-- Truncate TPI entries and reset sequence
TRUNCATE TABLE tpi_entries RESTART IDENTITY CASCADE;

-- Truncate TWC entries and reset sequence  
TRUNCATE TABLE twc_entries RESTART IDENTITY CASCADE;

-- ============================================
-- STEP 2: RESET SEQUENCES TO MATCH VB.NET IDs
-- ============================================

-- TPI starts from 33 (VB.NET)
ALTER SEQUENCE tpi_entries_entry_id_seq RESTART WITH 33;

-- TWC starts from 737 (VB.NET)
ALTER SEQUENCE twc_entries_entry_id_seq RESTART WITH 737;

-- ============================================
-- STEP 3: INSERT TPI DATA (IDs 33-65)
-- Matching VB.NET TPI Entry module exactly
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
  -- Get spinning count IDs using count_name
  SELECT id INTO count_6_compact_star FROM spinning_counts WHERE count_name = '6 COMPACT STAR';
  SELECT id INTO count_66_combed_star FROM spinning_counts WHERE count_name = '66 COMBED STAR';
  SELECT id INTO count_60_com_compact FROM spinning_counts WHERE count_name = '60COM COMPACT';
  SELECT id INTO count_60_come_star FROM spinning_counts WHERE count_name = '60COME STAR';
  SELECT id INTO count_68_combed_star FROM spinning_counts WHERE count_name = '68 COMBED STAR';
  SELECT id INTO count_6_combed_compact FROM spinning_counts WHERE count_name = '6 COMBED COMPACT';
  SELECT id INTO count_91_combed_warp FROM spinning_counts WHERE count_name = '91 COMBED WARP';
  SELECT id INTO count_6_combed_diamond FROM spinning_counts WHERE count_name = '6 COMBED DIAMOND';

  -- Verify counts exist
  IF count_68_combed_star IS NULL THEN
    RAISE EXCEPTION 'Count "68 COMBED STAR" not found in spinning_counts table!';
  END IF;

  -- Insert TPI Entry data (IDs 33-65)
  INSERT INTO tpi_entries (entry_date, spinning_count_id, tpi_value, shift, remarks) VALUES
  -- id 33-42 (Jan 2018 - Sep 2018)
  ('2018-01-02', count_6_compact_star, 29.35, 'A', 'Quality test'),         -- 33
  ('2018-02-04', count_66_combed_star, 30.81, 'B', 'Regular monitoring'),   -- 34
  ('2018-02-08', count_60_com_compact, 33.95, 'A', 'Quality check'),        -- 35
  ('2018-02-23', count_60_com_compact, 33.13, 'C', 'Shift test'),           -- 36
  ('2018-06-18', count_66_combed_star, 31.56, 'A', 'Quality test'),         -- 37
  ('2018-06-18', count_60_come_star, 27.96, 'B', 'Parallel test'),          -- 38
  ('2018-07-10', count_60_come_star, 27.29, 'A', 'Morning shift'),          -- 39
  ('2018-07-10', count_66_combed_star, 30.81, 'B', 'Evening shift'),        -- 40
  ('2018-08-28', count_6_compact_star, 28.60, 'A', 'Quality monitoring'),   -- 41
  ('2018-09-02', count_6_compact_star, 29.35, 'B', 'Regular test'),         -- 42
  -- id 43-52 (Mar 2019 - Jan 2020)
  ('2019-03-17', count_68_combed_star, 31.56, 'A', 'Quality check'),        -- 43
  ('2019-04-05', count_66_combed_star, 31.56, 'B', 'Shift monitoring'),     -- 44
  ('2019-04-16', count_6_combed_compact, 33.95, 'A', 'Production test'),    -- 45
  ('2019-06-12', count_60_come_star, 27.96, 'C', 'Quality test'),           -- 46
  ('2019-06-29', count_6_compact_star, 30.07, 'A', 'Regular monitoring'),   -- 47
  ('2019-10-25', count_60_come_star, 27.29, 'B', 'Quality check'),          -- 48
  ('2019-11-14', count_6_combed_compact, 33.13, 'A', 'Production test'),    -- 49
  ('2019-12-05', count_66_combed_star, 30.81, 'B', 'Quality monitoring'),   -- 50
  ('2019-12-06', count_60_come_star, 27.96, 'A', 'Regular test'),           -- 51
  ('2020-01-13', count_6_compact_star, 29.35, 'C', 'Shift test'),           -- 52
  -- id 53-57 (Aug 2021 - Jul 2022)
  ('2021-08-27', count_6_combed_compact, 33.95, 'A', 'Quality check'),      -- 53
  ('2021-09-21', count_68_combed_star, 4.00, 'B', 'Test sample'),           -- 54
  ('2021-09-20', count_68_combed_star, 31.56, 'A', 'Quality test'),         -- 55
  ('2022-02-18', count_68_combed_star, 32.34, 'B', 'Production monitoring'), -- 56
  ('2022-07-30', count_91_combed_warp, 39.35, 'A', 'Warp yarn test'),       -- 57
  -- id 58-65 (Nov 2022 - Dec 2024)
  ('2022-11-24', count_68_combed_star, 33.13, 'C', 'Quality check'),        -- 58
  ('2022-12-30', count_6_combed_compact, 33.13, 'A', 'Regular test'),       -- 59
  ('2023-01-06', count_68_combed_star, 31.57, 'B', 'Quality monitoring'),   -- 60
  ('2024-01-29', count_68_combed_star, 32.34, 'A', 'Production test'),      -- 61
  ('2024-02-23', count_6_combed_diamond, 32.34, 'B', 'Quality check'),      -- 62
  ('2024-12-13', count_68_combed_star, 33.13, 'A', 'Regular monitoring'),   -- 63
  ('2024-12-04', count_68_combed_star, 3.00, 'B', 'Test sample'),           -- 64
  ('2024-12-14', count_68_combed_star, 33.13, 'C', 'Quality test');         -- 65

  RAISE NOTICE 'TPI entries inserted: 33 records (IDs 33-65)';
END $$;

-- ============================================
-- STEP 4: INSERT TWC DATA (IDs 737-769)
-- Matching VB.NET TWC Entry module exactly
-- ============================================

DO $$
DECLARE
  count_68_combed_star UUID;
  count_6_combed_diamond UUID;
BEGIN
  -- Get spinning count IDs
  SELECT id INTO count_68_combed_star FROM spinning_counts WHERE count_name = '68 COMBED STAR';
  SELECT id INTO count_6_combed_diamond FROM spinning_counts WHERE count_name = '6 COMBED DIAMOND';
  
  -- Fallback for diamond count
  IF count_6_combed_diamond IS NULL THEN
    count_6_combed_diamond := count_68_combed_star;
    RAISE NOTICE 'Using 68 COMBED STAR as fallback for 6 COMBED DIAMOND';
  END IF;

  -- Insert TWC Entry data (IDs 737-769)
  INSERT INTO twc_entries (entry_date, spinning_count_id, twc_value, shift, remarks) VALUES
  -- id 737-746 (May-Jul 2024)
  ('2024-05-20', count_68_combed_star, 2.5, 'A', 'Quality test'),      -- 737
  ('2024-05-24', count_68_combed_star, 2.0, 'B', 'Regular monitoring'), -- 738
  ('2024-05-27', count_6_combed_diamond, 2.0, 'A', 'Diamond test'),     -- 739
  ('2024-06-02', count_68_combed_star, 3.0, 'C', 'Shift test'),         -- 740
  ('2024-06-02', count_6_combed_diamond, 3.0, 'A', 'Quality check'),    -- 741
  ('2024-06-16', count_68_combed_star, 3.5, 'B', 'Production'),         -- 742
  ('2024-06-29', count_68_combed_star, 2.0, 'A', 'Quality test'),       -- 743
  ('2024-07-04', count_68_combed_star, 3.0, 'B', 'Regular test'),       -- 744
  ('2024-07-14', count_68_combed_star, 3.5, 'C', 'Shift monitoring'),   -- 745
  ('2024-07-25', count_68_combed_star, 3.0, 'A', 'Quality check'),      -- 746
  -- id 747-758 (Jul-Nov 2024)
  ('2024-07-28', count_68_combed_star, 2.5, 'B', 'Production test'),    -- 747
  ('2024-08-04', count_68_combed_star, 3.5, 'A', 'Quality monitoring'), -- 748
  ('2024-08-23', count_68_combed_star, 2.0, 'B', 'Regular test'),       -- 749
  ('2024-08-29', count_68_combed_star, 3.5, 'C', 'Shift test'),         -- 750
  ('2024-09-15', count_68_combed_star, 3.0, 'A', 'Quality check'),      -- 751
  ('2024-10-05', count_68_combed_star, 2.5, 'B', 'Production'),         -- 752
  ('2024-10-13', count_68_combed_star, 2.0, 'A', 'Quality test'),       -- 753
  ('2024-10-17', count_68_combed_star, 2.5, 'B', 'Regular monitoring'), -- 754
  ('2024-10-20', count_68_combed_star, 3.0, 'C', 'Shift test'),         -- 755
  ('2024-11-20', count_68_combed_star, 3.5, 'A', 'Quality check'),      -- 756
  ('2024-11-26', count_68_combed_star, 3.0, 'B', 'Production test'),    -- 757
  ('2024-11-29', count_68_combed_star, 2.5, 'A', 'Quality monitoring'), -- 758
  -- id 759-769 (Dec 2024 - Apr 2025)
  ('2024-12-06', count_68_combed_star, 3.5, 'B', 'Regular test'),       -- 759
  ('2024-12-14', count_68_combed_star, 3.0, 'C', 'Shift monitoring'),   -- 760
  ('2024-12-22', count_68_combed_star, 2.5, 'A', 'Quality check'),      -- 761
  ('2025-01-10', count_68_combed_star, 3.5, 'B', 'Production'),         -- 762
  ('2025-03-05', count_68_combed_star, 3.0, 'A', 'Quality test'),       -- 763
  ('2025-03-09', count_68_combed_star, 2.5, 'B', 'Regular test'),       -- 764
  ('2025-03-29', count_68_combed_star, 3.0, 'C', 'Shift test'),         -- 765
  ('2025-03-31', count_68_combed_star, 3.5, 'A', 'Quality check'),      -- 766
  ('2025-04-07', count_68_combed_star, 3.0, 'B', 'Production test'),    -- 767
  ('2025-04-18', count_68_combed_star, 3.5, 'A', 'Quality monitoring'), -- 768
  ('2025-04-20', count_68_combed_star, 4.0, 'B', 'Final test');         -- 769

  RAISE NOTICE 'TWC entries inserted: 33 records (IDs 737-769)';
END $$;

-- ============================================
-- STEP 5: REFRESH POSTGREST SCHEMA CACHE
-- ============================================

NOTIFY pgrst, 'reload schema';

-- ============================================
-- STEP 6: VERIFY THE DATA
-- ============================================

-- Show TPI summary
SELECT 
  'TPI Entries' as table_name,
  COUNT(*) as total_records,
  MIN(entry_id) as min_id,
  MAX(entry_id) as max_id,
  COUNT(spinning_count_id) as with_count_id
FROM tpi_entries;

-- Show TWC summary
SELECT 
  'TWC Entries' as table_name,
  COUNT(*) as total_records,
  MIN(entry_id) as min_id,
  MAX(entry_id) as max_id,
  COUNT(spinning_count_id) as with_count_id
FROM twc_entries;

-- Preview TPI data (latest 10)
SELECT 
  t.entry_id as "id",
  TO_CHAR(t.entry_date, 'DD-Mon-YY') as "sdate",
  sc.count_name as "countname",
  t.tpi_value as "TPI"
FROM tpi_entries t
LEFT JOIN spinning_counts sc ON t.spinning_count_id = sc.id
ORDER BY t.entry_id DESC
LIMIT 10;

-- Preview TWC data (latest 10)
SELECT 
  t.entry_id as "id",
  TO_CHAR(t.entry_date, 'DD-Mon-YY') as "sdate",
  sc.count_name as "countname",
  t.twc_value as "TWC"
FROM twc_entries t
LEFT JOIN spinning_counts sc ON t.spinning_count_id = sc.id
ORDER BY t.entry_id DESC
LIMIT 10;
