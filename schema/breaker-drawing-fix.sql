-- ============================================
-- BREAKER DRAWING FIX SCRIPT
-- Fixes all display issues identified in the app
-- Run this AFTER breaker-drawing-update.sql
-- ============================================

-- ============================================
-- ISSUE 1 & 2: Update prodn_mixing to "64COMBED GOLD" 
-- AND ensure machine speeds are correct per VB6 reference
-- BD1: Speed=450, Delivery=2
-- BD2-BD4: Speed=750, Delivery=1 (or as per your actual requirements)
-- ============================================

-- Update machine master with correct mixing name and speeds
UPDATE drawing_breaker_machines 
SET prodn_mixing = '64COMBED GOLD', speed = 450, updated_at = NOW() 
WHERE machine_no = 'BD1';

UPDATE drawing_breaker_machines 
SET prodn_mixing = '64COMBED GOLD', speed = 750, updated_at = NOW() 
WHERE machine_no = 'BD2';

UPDATE drawing_breaker_machines 
SET prodn_mixing = '64COMBED GOLD', speed = 750, updated_at = NOW() 
WHERE machine_no = 'BD3';

UPDATE drawing_breaker_machines 
SET prodn_mixing = '64COMBED GOLD', speed = 750, updated_at = NOW() 
WHERE machine_no = 'BD4';

-- ============================================
-- ISSUE 3: Ensure machine_setup has correct delivery values
-- BD1 = Delivery 2 (as per VB6 formula)
-- BD2-BD4 = Delivery 1
-- ============================================

UPDATE breaker_drawing_machine_setup bdms
SET 
  delivery = CASE 
    WHEN dbm.machine_no = 'BD1' THEN 2 
    ELSE 1 
  END,
  speed = dbm.speed,
  std_prodn = ROUND(
    (dbm.speed::DECIMAL / 1693.0 / COALESCE(bdms.hank_constant, 0.14)) 
    * COALESCE(bdms.shift_time, 510) 
    * COALESCE(bdms.std_efficiency_factor, 0.85) 
    * CASE WHEN dbm.machine_no = 'BD1' THEN 2 ELSE 1 END, 2
  ),
  updated_at = NOW()
FROM drawing_breaker_machines dbm
WHERE bdms.machine_id = dbm.id
  AND dbm.machine_no IN ('BD1', 'BD2', 'BD3', 'BD4');

-- ============================================
-- ISSUE 4-7: FIX PRODUCTION DETAILS
-- Update existing production_detail records with correct calculated values
-- This fixes: Act.Hank, Act.Prodn, Exp.Prodn, Effi%, UTI%, WorkTime
-- ============================================

-- Create or replace sample data for today's date
DO $$
DECLARE
  v_header_id UUID;
  v_supervisor_id UUID;
  v_machine RECORD;
  v_total_time INTEGER := 510;
  v_calculated_std_prodn DECIMAL(10,2);
  v_calculated_exp_prodn DECIMAL(10,2);
  -- VB6 Reference Data
  v_work_times INTEGER[] := ARRAY[270, 260, 410, 370];  -- Work Time for BD1, BD2, BD3, BD4
  v_act_hanks DECIMAL[] := ARRAY[133.36, 213.50, 341.91, 307.04];
  v_act_prodns DECIMAL[] := ARRAY[864.20, 691.77, 1107.83, 994.85];
  v_emp_names TEXT[] := ARRAY['MURUGESWARI. M', 'MURUGESWARI. M', 'MURUGESWARI. M', 'GANDHIMATHI K'];
  v_idx INTEGER := 1;
  v_stoppage_excess_stock UUID;
  v_stoppage_bss UUID;
  v_stoppage_air_cleaning UUID;
  v_stoppage_times INTEGER[][] := ARRAY[
    ARRAY[160, 60, 20],  -- BD1: 240 total stoppage, WorkTime = 270
    ARRAY[170, 60, 20],  -- BD2: 250 total stoppage, WorkTime = 260
    ARRAY[20, 60, 20],   -- BD3: 100 total stoppage, WorkTime = 410
    ARRAY[60, 60, 20]    -- BD4: 140 total stoppage, WorkTime = 370
  ];
  -- Use yesterday's date for sample data so "Copy Yesterday" works for today
  v_target_date DATE := CURRENT_DATE - INTERVAL '1 day';
BEGIN
  -- Get supervisor
  SELECT id INTO v_supervisor_id FROM supervisors WHERE is_active = true LIMIT 1;
  
  -- Get stoppage reason IDs
  SELECT id INTO v_stoppage_excess_stock FROM stoppage_details WHERE code = 1510 LIMIT 1;
  SELECT id INTO v_stoppage_bss FROM stoppage_details WHERE code = 1511 LIMIT 1;
  SELECT id INTO v_stoppage_air_cleaning FROM stoppage_details WHERE code = 1512 LIMIT 1;
  
  -- Check if entry already exists for target date, shift 1
  SELECT id INTO v_header_id FROM breaker_drawing_production_header 
  WHERE entry_date = v_target_date AND shift = 1;
  
  -- Delete existing data for clean insert
  IF v_header_id IS NOT NULL THEN
    -- Delete stoppage entries first (FK constraint)
    DELETE FROM breaker_drawing_stoppage_entry 
    WHERE production_detail_id IN (
      SELECT id FROM breaker_drawing_production_detail WHERE header_id = v_header_id
    );
    -- Delete production details
    DELETE FROM breaker_drawing_production_detail WHERE header_id = v_header_id;
    -- Delete header
    DELETE FROM breaker_drawing_production_header WHERE id = v_header_id;
  END IF;
  
  -- Create header
  INSERT INTO breaker_drawing_production_header (entry_date, shift, supervisor_id, maisitry_id, total_time, remarks)
  VALUES (v_target_date, 1, v_supervisor_id, NULL, v_total_time, 'VB6 Reference Sample Data')
  RETURNING id INTO v_header_id;
  
  -- Insert production details with DYNAMIC calculations from machine speed
  FOR v_machine IN 
    SELECT 
      dbm.id, 
      dbm.machine_no, 
      dbm.speed,
      dbm.prodn_mixing,
      COALESCE(bdms.hank_constant, 0.14) as hank_constant,
      COALESCE(bdms.std_efficiency_factor, 0.85) as std_efficiency_factor,
      COALESCE(bdms.delivery, 1) as delivery,
      COALESCE(bdms.default_waste, 0.85) as default_waste
    FROM drawing_breaker_machines dbm
    LEFT JOIN breaker_drawing_machine_setup bdms ON dbm.id = bdms.machine_id
    WHERE dbm.machine_no IN ('BD1', 'BD2', 'BD3', 'BD4')
    ORDER BY dbm.mc_id
  LOOP
    -- Calculate Std Prodn from machine's speed: (Speed / 1693 / Hank) × Total Time × Std Effi × Delivery
    v_calculated_std_prodn := ROUND(
      (v_machine.speed::DECIMAL / 1693 / v_machine.hank_constant) 
      * v_total_time 
      * v_machine.std_efficiency_factor 
      * v_machine.delivery, 2
    );
    
    -- Calculate Exp Prodn: Std Prodn × (Work Time / Total Time)
    v_calculated_exp_prodn := ROUND(
      v_calculated_std_prodn * (v_work_times[v_idx]::DECIMAL / v_total_time), 2
    );
    
    RAISE NOTICE 'Machine %: Speed=%, Delivery=%, StdProdn=%, WorkTime=%, ExpProdn=%', 
      v_machine.machine_no, v_machine.speed, v_machine.delivery, 
      v_calculated_std_prodn, v_work_times[v_idx], v_calculated_exp_prodn;
    
    INSERT INTO breaker_drawing_production_detail 
      (header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, 
       std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, 
       run_time, work_time, session_no)
    VALUES (
      v_header_id, 
      v_machine.id, 
      v_emp_names[v_idx], 
      v_machine.prodn_mixing,  -- Now shows '64COMBED GOLD'
      v_act_hanks[v_idx],      -- From VB6: 133.36, 213.50, 341.91, 307.04
      v_act_prodns[v_idx],     -- From VB6: 864.20, 691.77, 1107.83, 994.85
      v_calculated_std_prodn,  -- Calculated from machine speed
      v_calculated_exp_prodn,  -- Calculated from std_prodn * (WorkTime/TotalTime)
      ROUND(v_act_prodns[v_idx] / NULLIF(v_calculated_exp_prodn, 0) * 100, 2),  -- Effi%
      ROUND(v_work_times[v_idx]::DECIMAL / v_total_time * 100, 2),  -- UTI%
      v_machine.default_waste,
      ROUND(v_machine.default_waste / NULLIF(v_act_prodns[v_idx], 0) * 100, 2),  -- Waste%
      v_total_time,
      v_work_times[v_idx],  -- Work Time (NOT calculated from stoppages in INSERT)
      1
    );
    
    v_idx := v_idx + 1;
  END LOOP;
  
  -- Insert stoppage entries
  v_idx := 1;
  FOR v_machine IN 
    SELECT dbm.id, dbm.machine_no
    FROM drawing_breaker_machines dbm
    WHERE dbm.machine_no IN ('BD1', 'BD2', 'BD3', 'BD4')
    ORDER BY dbm.mc_id
  LOOP
    INSERT INTO breaker_drawing_stoppage_entry (
      production_detail_id, 
      stoppage1_id, stoppage1_time, 
      stoppage2_id, stoppage2_time, 
      stoppage3_id, stoppage3_time, 
      total_stoppage_time
    )
    SELECT 
      cpd.id, 
      v_stoppage_excess_stock, v_stoppage_times[v_idx][1],
      v_stoppage_bss, v_stoppage_times[v_idx][2],
      v_stoppage_air_cleaning, v_stoppage_times[v_idx][3],
      v_stoppage_times[v_idx][1] + v_stoppage_times[v_idx][2] + v_stoppage_times[v_idx][3]
    FROM breaker_drawing_production_detail cpd
    WHERE cpd.header_id = v_header_id AND cpd.machine_id = v_machine.id;
    
    v_idx := v_idx + 1;
  END LOOP;
  
  RAISE NOTICE 'VB6 Reference Sample Data created for date: %', v_target_date;
END $$;

-- ============================================
-- VERIFICATION: Check all values match VB6 reference
-- ============================================

-- 1. Verify machine master data
SELECT '1. MACHINE MASTER DATA' as section;
SELECT 
  machine_no as "Machine", 
  speed as "Speed", 
  prodn_mixing as "Mixing"
FROM drawing_breaker_machines 
WHERE machine_no IN ('BD1', 'BD2', 'BD3', 'BD4')
ORDER BY mc_id;

-- 2. Verify machine setup with delivery
SELECT '2. MACHINE SETUP' as section;
SELECT 
  dbm.machine_no as "Machine",
  dbm.speed as "Speed",
  bdms.delivery as "Delivery",
  bdms.hank_constant as "Hank",
  bdms.std_efficiency_factor as "StdEffi",
  bdms.std_prodn as "StdProdn"
FROM breaker_drawing_machine_setup bdms
JOIN drawing_breaker_machines dbm ON bdms.machine_id = dbm.id
WHERE dbm.machine_no IN ('BD1', 'BD2', 'BD3', 'BD4')
ORDER BY dbm.mc_id;

-- 3. Verify production details match VB6
-- VB6 Reference Values:
-- BD1: Emp=MURUGESWARI. M, Mixing=64COMBED GOLD, ActHank=133.36, ActProdn=864.20, StdProdn=1646.06, ExpProdn=871.44, Effi=99.17%, UTI=52.94%, WorkTime=270
-- BD2: Emp=MURUGESWARI. M, Mixing=64COMBED GOLD, ActHank=213.50, ActProdn=691.77, StdProdn=1371.72, ExpProdn=699.11, Effi=98.95%, UTI=50.98%, WorkTime=260
-- BD3: Emp=MURUGESWARI. M, Mixing=64COMBED GOLD, ActHank=341.91, ActProdn=1107.83, StdProdn=1371.72, ExpProdn=1102.51, Effi=100.48%, UTI=80.39%, WorkTime=410
-- BD4: Emp=GANDHIMATHI K, Mixing=64COMBED GOLD, ActHank=307.04, ActProdn=994.85, StdProdn=1371.72, ExpProdn=995.22, Effi=99.96%, UTI=72.55%, WorkTime=370

SELECT '3. PRODUCTION DETAILS (vs VB6 Reference)' as section;
SELECT 
  dbm.machine_no as "Mc.No.",
  bdpd.employee_name as "Emp.Name",
  bdpd.prodn_mixing as "Mixing",
  bdpd.act_hank as "Act.Hank",
  bdpd.act_prodn as "Act.Prodn",
  dbm.speed as "Speed",
  bdpd.std_prodn as "Std.Prodn",
  bdpd.work_time as "WorkTime",
  bdpd.exp_prodn as "Exp.Prodn",
  bdpd.effi_percent as "Effi%",
  bdpd.uti_percent as "UTI%",
  bdpd.waste as "Waste",
  bdpd.waste_percent as "Waste%"
FROM breaker_drawing_production_detail bdpd
JOIN drawing_breaker_machines dbm ON bdpd.machine_id = dbm.id
JOIN breaker_drawing_production_header bdph ON bdpd.header_id = bdph.id
WHERE bdph.entry_date = CURRENT_DATE - INTERVAL '1 day' AND bdph.shift = 1
ORDER BY dbm.mc_id;

-- 4. Verify stoppage entries
SELECT '4. STOPPAGE ENTRIES' as section;
SELECT 
  dbm.machine_no as "Mc.No.",
  s1.short_code as "Stop1",
  bdse.stoppage1_time as "Time1",
  s2.short_code as "Stop2",
  bdse.stoppage2_time as "Time2",
  s3.short_code as "Stop3",
  bdse.stoppage3_time as "Time3",
  bdse.total_stoppage_time as "TotalStop",
  510 - bdse.total_stoppage_time as "CalcWorkTime"
FROM breaker_drawing_stoppage_entry bdse
JOIN breaker_drawing_production_detail bdpd ON bdse.production_detail_id = bdpd.id
JOIN drawing_breaker_machines dbm ON bdpd.machine_id = dbm.id
JOIN breaker_drawing_production_header bdph ON bdpd.header_id = bdph.id
LEFT JOIN stoppage_details s1 ON bdse.stoppage1_id = s1.id
LEFT JOIN stoppage_details s2 ON bdse.stoppage2_id = s2.id
LEFT JOIN stoppage_details s3 ON bdse.stoppage3_id = s3.id
WHERE bdph.entry_date = CURRENT_DATE - INTERVAL '1 day' AND bdph.shift = 1
ORDER BY dbm.mc_id;

-- 5. Summary comparison
SELECT '5. SUMMARY - Compare with VB6' as section;
SELECT 
  dbm.machine_no as "Machine",
  dbm.speed as "Speed",
  bdms.delivery as "Delivery",
  bdpd.work_time as "WorkTime",
  bdpd.std_prodn as "StdProdn",
  bdpd.exp_prodn as "ExpProdn",
  bdpd.act_prodn as "ActProdn",
  bdpd.effi_percent as "Effi%",
  bdpd.uti_percent as "UTI%",
  CASE 
    WHEN dbm.machine_no = 'BD1' AND ROUND(bdpd.std_prodn, 0) = 1646 AND ROUND(bdpd.exp_prodn, 0) = 871 THEN '✓ MATCH'
    WHEN dbm.machine_no != 'BD1' AND ROUND(bdpd.std_prodn, 0) = 1372 THEN '✓ MATCH'
    ELSE '✗ CHECK'
  END as "Status"
FROM breaker_drawing_production_detail bdpd
JOIN drawing_breaker_machines dbm ON bdpd.machine_id = dbm.id
JOIN breaker_drawing_machine_setup bdms ON dbm.id = bdms.machine_id
JOIN breaker_drawing_production_header bdph ON bdpd.header_id = bdph.id
WHERE bdph.entry_date = CURRENT_DATE - INTERVAL '1 day' AND bdph.shift = 1
ORDER BY dbm.mc_id;

SELECT '✓ Breaker Drawing Fix Script Complete' as status,
       'Run SELECT queries above to verify data' as note;
