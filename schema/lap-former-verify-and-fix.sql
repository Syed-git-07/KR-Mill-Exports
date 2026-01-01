-- =====================================================
-- LAP FORMER ENTRY MODULE - Verification and Fix Script
-- =====================================================
-- Run this script in Supabase SQL Editor to:
-- 1. Verify the sample data exists
-- 2. Fix any missing data
-- 3. Add missing columns if needed
-- =====================================================

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- 1. Check if lap_former_machines exist
SELECT 'LAP FORMER MACHINES' as check_name, COUNT(*) as count 
FROM lap_former_machines 
WHERE machine_no IN ('LF1', 'LF2', 'LF3');

-- 2. Check machine speeds (should be 120, 90, 90)
SELECT machine_no, speed, prodn_mixing, make_name 
FROM lap_former_machines 
WHERE machine_no IN ('LF1', 'LF2', 'LF3')
ORDER BY mc_id;

-- 3. Check machine setup exists
SELECT 'MACHINE SETUP' as check_name, COUNT(*) as count 
FROM lap_former_machine_setup;

-- 4. Check machine setup with calculated values
SELECT 
  m.machine_no,
  s.speed,
  s.hank_constant,
  s.std_efficiency_factor,
  s.std_prodn,
  s.divisor_constant,
  s.delivery
FROM lap_former_machine_setup s
JOIN lap_former_machines m ON s.machine_id = m.id
ORDER BY m.mc_id;

-- 5. Check if sample data header exists (22-Apr-2025)
SELECT 'SAMPLE HEADER (22-Apr-2025)' as check_name, COUNT(*) as count 
FROM lap_former_production_header 
WHERE entry_date = '2025-04-22' AND shift = 1;

-- 6. Check sample production details
SELECT 
  m.machine_no as "Mc.No.",
  d.employee_name as "Emp.Name",
  d.prodn_mixing as "Mixing",
  d.act_hank as "Act.Hank",
  d.act_prodn as "Act.Prodn",
  d.exp_prodn as "Exp.Prodn",
  d.std_prodn as "Std.Prodn",
  d.waste as "Waste",
  d.waste_percent as "Waste%",
  d.effi_percent as "Act.Effi",
  d.uti_percent as "UTI",
  d.run_time as "Run Time",
  d.work_time as "WorkTime"
FROM lap_former_production_detail d
JOIN lap_former_machines m ON d.machine_id = m.id
JOIN lap_former_production_header h ON d.header_id = h.id
WHERE h.entry_date = '2025-04-22' AND h.shift = 1
ORDER BY m.mc_id;

-- 7. Check stoppage entries
SELECT 
  m.machine_no,
  s.stoppage1_time,
  s.stoppage2_time,
  s.total_stoppage_time,
  s.is_full_stoppage
FROM lap_former_stoppage_entry s
JOIN lap_former_production_detail d ON s.production_detail_id = d.id
JOIN lap_former_machines m ON d.machine_id = m.id
JOIN lap_former_production_header h ON d.header_id = h.id
WHERE h.entry_date = '2025-04-22' AND h.shift = 1
ORDER BY m.mc_id;

-- 8. Check stoppage reasons (code >= 1500)
SELECT id, code, stoppage_name, short_code 
FROM stoppage_details 
WHERE code >= 1500 AND code <= 1530
ORDER BY code;

-- ============================================
-- FIX: Ensure Machine Speeds are Correct
-- ============================================
UPDATE lap_former_machines SET speed = 120 WHERE machine_no = 'LF1';
UPDATE lap_former_machines SET speed = 90 WHERE machine_no = 'LF2';
UPDATE lap_former_machines SET speed = 90 WHERE machine_no = 'LF3';
UPDATE lap_former_machines SET prodn_mixing = '64COMBED GOLD' WHERE machine_no IN ('LF1', 'LF2', 'LF3');
UPDATE lap_former_machines SET make_name = 'LMW' WHERE machine_no IN ('LF1', 'LF2', 'LF3') AND make_name IS NULL;

-- ============================================
-- FIX: Ensure Machine Setup Exists
-- ============================================
INSERT INTO lap_former_machine_setup (machine_id, speed, hank_constant, std_efficiency_factor, default_waste, std_prodn, shift_time, divisor_constant, delivery)
SELECT 
  id,
  CASE machine_no WHEN 'LF1' THEN 120 ELSE 90 END as speed,
  0.0082 as hank_constant,
  0.85 as std_efficiency_factor,
  0.85 as default_waste,
  CASE machine_no WHEN 'LF1' THEN 3747.14 ELSE 2810.35 END as std_prodn,
  510 as shift_time,
  1693 as divisor_constant,
  1 as delivery
FROM lap_former_machines
WHERE machine_no IN ('LF1', 'LF2', 'LF3')
ON CONFLICT (machine_id) DO UPDATE SET
  speed = EXCLUDED.speed,
  hank_constant = EXCLUDED.hank_constant,
  std_efficiency_factor = EXCLUDED.std_efficiency_factor,
  std_prodn = EXCLUDED.std_prodn,
  divisor_constant = EXCLUDED.divisor_constant,
  delivery = EXCLUDED.delivery;

-- ============================================
-- FIX: Create Stoppage Reasons if Missing
-- ============================================
DO $$
DECLARE
  v_stoppage_head_others UUID;
  v_dept_lap_former UUID;
BEGIN
  -- Get stoppage head for "OTHERS"
  SELECT id INTO v_stoppage_head_others FROM stoppage_heads WHERE stoppage_head_name ILIKE '%OTHER%' LIMIT 1;
  
  -- Get department for LAP FORMER
  SELECT id INTO v_dept_lap_former FROM departments WHERE dept_name ILIKE '%LAP FORMER%' LIMIT 1;
  
  -- Insert Lap Former specific stoppages if they don't exist
  IF v_stoppage_head_others IS NOT NULL THEN
    INSERT INTO stoppage_details (stoppage_head_id, code, stoppage_name, short_code, description, department_id, is_active)
    VALUES 
      (v_stoppage_head_others, 1520, 'EXCESS STOCK', 'EIO', 'Excess stock stoppage - Lap Former', v_dept_lap_former, true),
      (v_stoppage_head_others, 1521, 'SPOOL CHANGE PROBLEM', 'SCP', 'Spool change problem', v_dept_lap_former, true),
      (v_stoppage_head_others, 1522, 'ERECTOR WORK', 'EW', 'Erector work stoppage', v_dept_lap_former, true)
    ON CONFLICT DO NOTHING;
    RAISE NOTICE 'Stoppage reasons created/verified';
  ELSE
    RAISE NOTICE 'WARNING: No stoppage head found for OTHERS';
  END IF;
END $$;

-- ============================================
-- FIX: Create Sample Data for 22-Apr-2025
-- ============================================
DO $$
DECLARE
  v_header_id UUID;
  v_machine_lf1 UUID;
  v_machine_lf2 UUID;
  v_machine_lf3 UUID;
  v_supervisor_id UUID;
  v_stoppage_excess_stock UUID;
  v_stoppage_spool_change UUID;
  v_stoppage_erector_work UUID;
  v_detail_lf1 UUID;
  v_detail_lf2 UUID;
  v_detail_lf3 UUID;
BEGIN
  -- Get machine IDs
  SELECT id INTO v_machine_lf1 FROM lap_former_machines WHERE machine_no = 'LF1';
  SELECT id INTO v_machine_lf2 FROM lap_former_machines WHERE machine_no = 'LF2';
  SELECT id INTO v_machine_lf3 FROM lap_former_machines WHERE machine_no = 'LF3';
  
  -- Get supervisor (any active supervisor)
  SELECT id INTO v_supervisor_id FROM supervisors WHERE is_active = true LIMIT 1;
  
  -- Get stoppage IDs
  SELECT id INTO v_stoppage_excess_stock FROM stoppage_details WHERE code = 1520 LIMIT 1;
  SELECT id INTO v_stoppage_spool_change FROM stoppage_details WHERE code = 1521 LIMIT 1;
  SELECT id INTO v_stoppage_erector_work FROM stoppage_details WHERE code = 1522 LIMIT 1;
  
  -- Only proceed if machines exist
  IF v_machine_lf1 IS NOT NULL AND v_machine_lf2 IS NOT NULL AND v_machine_lf3 IS NOT NULL THEN
    -- Create production header for 22-Apr-2025 Shift 1
    INSERT INTO lap_former_production_header (entry_date, shift, supervisor_id, total_time, remarks)
    VALUES ('2025-04-22', 1, v_supervisor_id, 510, 'Sample Data from VB6')
    ON CONFLICT (entry_date, shift) DO UPDATE SET 
      remarks = 'Sample Data from VB6',
      supervisor_id = EXCLUDED.supervisor_id
    RETURNING id INTO v_header_id;
    
    -- Delete existing details for this header (to avoid duplicates)
    DELETE FROM lap_former_production_detail WHERE header_id = v_header_id;
    
    -- Insert Production Details with CORRECT calculated values
    -- ============================================
    -- LF1: Speed=120, Act.Hank=28.36, Act.Prodn=1568.85
    -- Stoppage: 180 + 120 = 300, WorkTime = 510-300 = 210
    -- StdProdn = 120/1693/0.0082 × 510 × 0.85 × 1 = 3747.14
    -- ExpProdn = 3747.14 × (210/510) = 1542.94
    -- ActEffi = 1568.85 / 1542.94 × 100 = 101.68%
    -- UTI = 210 / 510 × 100 = 41.18%
    -- Waste% = 0.85 / 1568.85 × 100 = 0.05%
    -- ============================================
    INSERT INTO lap_former_production_detail (
      header_id, machine_id, employee_name, prodn_mixing, 
      act_hank, act_prodn, std_prodn, exp_prodn, 
      effi_percent, uti_percent, waste, waste_percent, 
      run_time, work_time, session_no
    )
    VALUES (
      v_header_id, v_machine_lf1, 'MURUGESWARI. M', '64COMBED GOLD',
      28.36, 1568.85, 3747.14, 1542.94,
      101.68, 41.18, 0.85, 0.05,
      510, 210, 1
    )
    RETURNING id INTO v_detail_lf1;
    
    -- LF2: Speed=90, Act.Hank=17.14, Act.Prodn=948.17
    -- Stoppage: 245 + 90 = 335, WorkTime = 510-335 = 175
    INSERT INTO lap_former_production_detail (
      header_id, machine_id, employee_name, prodn_mixing, 
      act_hank, act_prodn, std_prodn, exp_prodn, 
      effi_percent, uti_percent, waste, waste_percent, 
      run_time, work_time, session_no
    )
    VALUES (
      v_header_id, v_machine_lf2, 'MURUGESWARI. M', '64COMBED GOLD',
      17.14, 948.17, 2810.35, 964.34,
      98.32, 34.31, 0.85, 0.09,
      510, 175, 1
    )
    RETURNING id INTO v_detail_lf2;
    
    -- LF3: Speed=90, Act.Hank=24.04, Act.Prodn=1329.87
    -- Stoppage: 270 + 0 = 270, WorkTime = 510-270 = 240
    INSERT INTO lap_former_production_detail (
      header_id, machine_id, employee_name, prodn_mixing, 
      act_hank, act_prodn, std_prodn, exp_prodn, 
      effi_percent, uti_percent, waste, waste_percent, 
      run_time, work_time, session_no
    )
    VALUES (
      v_header_id, v_machine_lf3, 'GANDHIMATHI K', '64COMBED GOLD',
      24.04, 1329.87, 2810.35, 1322.52,
      100.56, 47.06, 0.85, 0.06,
      510, 240, 1
    )
    RETURNING id INTO v_detail_lf3;
    
    -- Insert Stoppage Entries
    -- LF1: Excess Stock (180) + Spool Change (120) = 300
    IF v_detail_lf1 IS NOT NULL THEN
      INSERT INTO lap_former_stoppage_entry (
        production_detail_id, 
        stoppage1_id, stoppage1_time, 
        stoppage2_id, stoppage2_time, 
        total_stoppage_time,
        is_full_stoppage
      )
      VALUES (
        v_detail_lf1, 
        v_stoppage_excess_stock, 180, 
        v_stoppage_spool_change, 120, 
        300,
        false
      )
      ON CONFLICT (production_detail_id) DO UPDATE SET
        stoppage1_id = EXCLUDED.stoppage1_id,
        stoppage1_time = EXCLUDED.stoppage1_time,
        stoppage2_id = EXCLUDED.stoppage2_id,
        stoppage2_time = EXCLUDED.stoppage2_time,
        total_stoppage_time = EXCLUDED.total_stoppage_time;
    END IF;
    
    -- LF2: Excess Stock (245) + Erector Work (90) = 335
    IF v_detail_lf2 IS NOT NULL THEN
      INSERT INTO lap_former_stoppage_entry (
        production_detail_id, 
        stoppage1_id, stoppage1_time, 
        stoppage2_id, stoppage2_time, 
        total_stoppage_time,
        is_full_stoppage
      )
      VALUES (
        v_detail_lf2, 
        v_stoppage_excess_stock, 245, 
        v_stoppage_erector_work, 90, 
        335,
        false
      )
      ON CONFLICT (production_detail_id) DO UPDATE SET
        stoppage1_id = EXCLUDED.stoppage1_id,
        stoppage1_time = EXCLUDED.stoppage1_time,
        stoppage2_id = EXCLUDED.stoppage2_id,
        stoppage2_time = EXCLUDED.stoppage2_time,
        total_stoppage_time = EXCLUDED.total_stoppage_time;
    END IF;
    
    -- LF3: Excess Stock (270) only = 270
    IF v_detail_lf3 IS NOT NULL THEN
      INSERT INTO lap_former_stoppage_entry (
        production_detail_id, 
        stoppage1_id, stoppage1_time, 
        stoppage2_id, stoppage2_time,
        total_stoppage_time,
        is_full_stoppage
      )
      VALUES (
        v_detail_lf3, 
        v_stoppage_excess_stock, 270, 
        NULL, 0,
        270,
        false
      )
      ON CONFLICT (production_detail_id) DO UPDATE SET
        stoppage1_id = EXCLUDED.stoppage1_id,
        stoppage1_time = EXCLUDED.stoppage1_time,
        total_stoppage_time = EXCLUDED.total_stoppage_time;
    END IF;
    
    RAISE NOTICE 'Sample data for 22-Apr-2025 created/updated successfully!';
  ELSE
    RAISE NOTICE 'ERROR: Lap Former machines not found. Please check lap_former_machines table.';
  END IF;
END $$;

-- ============================================
-- FINAL VERIFICATION - Should show sample data
-- ============================================
SELECT '=== FINAL VERIFICATION ===' as status;

-- Production data for 22-Apr-2025
SELECT 
  m.machine_no as "Mc.No.",
  d.employee_name as "Emp.Name",
  d.prodn_mixing as "Mixing",
  d.act_hank as "Act.Hank",
  d.act_prodn as "Act.Prodn",
  d.exp_prodn as "Exp.Prodn",
  d.effi_percent as "Act.Effi%",
  d.uti_percent as "UTI%",
  d.waste as "Waste",
  d.waste_percent as "Waste%",
  d.run_time as "RunTime",
  d.work_time as "WorkTime"
FROM lap_former_production_detail d
JOIN lap_former_machines m ON d.machine_id = m.id
JOIN lap_former_production_header h ON d.header_id = h.id
WHERE h.entry_date = '2025-04-22' AND h.shift = 1
ORDER BY m.mc_id;

-- Stoppage data
SELECT 
  m.machine_no,
  sd1.stoppage_name as "Stoppage1",
  s.stoppage1_time as "Time1",
  sd2.stoppage_name as "Stoppage2",
  s.stoppage2_time as "Time2",
  s.total_stoppage_time as "Total"
FROM lap_former_stoppage_entry s
JOIN lap_former_production_detail d ON s.production_detail_id = d.id
JOIN lap_former_machines m ON d.machine_id = m.id
JOIN lap_former_production_header h ON d.header_id = h.id
LEFT JOIN stoppage_details sd1 ON s.stoppage1_id = sd1.id
LEFT JOIN stoppage_details sd2 ON s.stoppage2_id = sd2.id
WHERE h.entry_date = '2025-04-22' AND h.shift = 1
ORDER BY m.mc_id;

SELECT 'Lap Former Verify and Fix Complete!' as status;
