-- Lap Former Module Fixes - January 2026
-- This script adds the total_stoppage_mins column and updates machine descriptions

-- ============================================
-- 1. Add total_stoppage_mins column to lap_former_production_detail
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lap_former_production_detail' 
    AND column_name = 'total_stoppage_mins'
  ) THEN
    ALTER TABLE lap_former_production_detail 
    ADD COLUMN total_stoppage_mins INTEGER DEFAULT 0;
    
    RAISE NOTICE 'Added total_stoppage_mins column to lap_former_production_detail';
  ELSE
    RAISE NOTICE 'total_stoppage_mins column already exists';
  END IF;
END $$;

-- ============================================
-- 2. Update existing production details with stoppage data
-- ============================================
UPDATE lap_former_production_detail pd
SET total_stoppage_mins = COALESCE(
  (SELECT total_stoppage_time FROM lap_former_stoppage_entry 
   WHERE production_detail_id = pd.id LIMIT 1), 0
)
WHERE total_stoppage_mins IS NULL OR total_stoppage_mins = 0;

-- ============================================
-- 3. Update Lap Former Machine Descriptions
-- Match the format shown in the image: "LABFORMER 1", "LABFORMER 2", etc.
-- ============================================
UPDATE lap_former_machines SET description = 'LABFORMER 1' WHERE machine_no = 'LF1';
UPDATE lap_former_machines SET description = 'LABFORMER 2' WHERE machine_no = 'LF2';
UPDATE lap_former_machines SET description = 'LABFORMER 3' WHERE machine_no = 'LF3';

-- For any additional machines added later (LF4, LF5, etc.)
UPDATE lap_former_machines 
SET description = 'LABFORMER ' || SUBSTRING(machine_no FROM 3)
WHERE machine_no LIKE 'LF%' 
AND (description IS NULL OR description = '' OR description LIKE 'Lap Former Machine%');

-- ============================================
-- 4. Ensure all Lap Former machines have Make = 'LMW'
-- ============================================
UPDATE lap_former_machines 
SET make_name = 'LMW' 
WHERE make_name IS NULL OR make_name = '';

-- ============================================
-- 5. Recalculate work_time based on stoppage for existing records
-- WorkTime = 510 - TotalStoppageTime
-- ============================================
UPDATE lap_former_production_detail pd
SET work_time = 510 - COALESCE(
  (SELECT total_stoppage_time FROM lap_former_stoppage_entry 
   WHERE production_detail_id = pd.id LIMIT 1), 0
),
run_time = 510  -- Run time is always Total Time (510)
WHERE run_time != 510 OR work_time IS NULL;

-- ============================================
-- 6. Add index for better performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_lap_former_production_detail_header 
ON lap_former_production_detail(header_id);

CREATE INDEX IF NOT EXISTS idx_lap_former_stoppage_entry_detail 
ON lap_former_stoppage_entry(production_detail_id);

-- ============================================
-- Verification Queries
-- ============================================
-- Check machine list
SELECT machine_no, description, make_name, speed, is_active 
FROM lap_former_machines ORDER BY mc_id;

-- Check production details with stoppage
SELECT 
  pd.id,
  m.machine_no,
  pd.run_time,
  pd.work_time,
  pd.total_stoppage_mins,
  se.total_stoppage_time as stoppage_entry_time
FROM lap_former_production_detail pd
JOIN lap_former_machines m ON pd.machine_id = m.id
LEFT JOIN lap_former_stoppage_entry se ON se.production_detail_id = pd.id
ORDER BY m.mc_id
LIMIT 10;

-- Formula verification comment:
-- According to lap-former-formula.md:
-- Run Time = Total Time (510) - always fixed at 510
-- Work Time = Total Time (510) - Total Stoppage (Running Time)
-- Std Prodn = Speed / 1693 / 0.0082 × 510 × 0.85 × Delivery
-- Exp Prodn = Std Prodn × (Work Time / 510)
-- Act Effi % = Actual Prodn / Exp Prodn × 100
-- UTI % = Work Time / 510 × 100
