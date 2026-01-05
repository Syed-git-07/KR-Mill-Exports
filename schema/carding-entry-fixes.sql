-- ============================================
-- CARDING ENTRY FIXES - SQL Migration
-- Date: 2025-01-02
-- Updated: 2026-01-02
-- ============================================

-- 1. Add total_stoppage_mins column to carding_production_detail for easier reference
ALTER TABLE carding_production_detail 
ADD COLUMN IF NOT EXISTS total_stoppage_mins INTEGER DEFAULT 135;

-- 2. Update existing carding_production_detail records with stoppage from carding_stoppage_entry
UPDATE carding_production_detail cpd
SET total_stoppage_mins = COALESCE(
    (SELECT total_stoppage_time FROM carding_stoppage_entry cse WHERE cse.production_detail_id = cpd.id),
    135
);

-- 3. Update carding machine descriptions with model type (based on image showing CA18-CA22 with LC300A V3)
-- First update CA18-CA20 to have LC300A V3 model and description
UPDATE carding_machines 
SET 
    model = 'LC300A V3',
    description = 'LC300A V3'
WHERE machine_no IN ('CA18', 'CA19', 'CA20');

-- CA21-CA22 should have LC300AV3 (without space based on image)
UPDATE carding_machines 
SET 
    model = 'LC300AV3',
    description = 'LC300AV3'
WHERE machine_no IN ('CA21', 'CA22');

-- CA2 has LC300A (older model)
UPDATE carding_machines 
SET 
    model = 'LC300A',
    description = 'LC300A'
WHERE machine_no = 'CA2';

-- 4. Sync total_stoppage_mins with carding_stoppage_entry.total_stoppage_time for all records
-- Also update work_time and uti_percent
UPDATE carding_production_detail cpd
SET 
    total_stoppage_mins = COALESCE(cse.total_stoppage_time, 135),
    run_time = 510,
    work_time = 510 - COALESCE(cse.total_stoppage_time, 135),
    uti_percent = ROUND(((510 - COALESCE(cse.total_stoppage_time, 135))::DECIMAL / 510) * 100, 2)
FROM carding_stoppage_entry cse
WHERE cpd.id = cse.production_detail_id;

-- 5. Verify the changes
SELECT 
    cm.machine_no,
    cm.description,
    cm.model,
    cpd.run_time,
    cpd.work_time,
    cpd.total_stoppage_mins,
    cpd.uti_percent
FROM carding_production_detail cpd
JOIN carding_machines cm ON cpd.machine_id = cm.id
JOIN carding_production_header cph ON cpd.header_id = cph.id
WHERE cph.entry_date >= '2025-01-01'
ORDER BY cm.mc_id
LIMIT 25;
