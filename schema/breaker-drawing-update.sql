-- ============================================
-- BREAKER DRAWING ENTRY - UPDATE SCRIPT
-- This script updates calculations to reference speed from machine table
-- Run this AFTER the main breaker-drawing-setup.sql AND supabase-setup.sql
-- ============================================

-- ============================================
-- 1. UPDATE drawing_breaker_machines WITH CORRECT SPEEDS
-- Speed is the SOURCE OF TRUTH - stored in machine table, not setup table
-- Based on VB6 Machine Setup screenshot:
-- BD1: Speed=450, Delivery=2
-- BD2: Speed=750, Delivery=1
-- BD3: Speed=750, Delivery=1
-- BD4: Speed=750, Delivery=1
-- ============================================
UPDATE drawing_breaker_machines SET speed = 450, updated_at = NOW() WHERE machine_no = 'BD1';
UPDATE drawing_breaker_machines SET speed = 750, updated_at = NOW() WHERE machine_no = 'BD2';
UPDATE drawing_breaker_machines SET speed = 750, updated_at = NOW() WHERE machine_no = 'BD3';
UPDATE drawing_breaker_machines SET speed = 750, updated_at = NOW() WHERE machine_no = 'BD4';

-- ============================================
-- 2. SYNC breaker_drawing_machine_setup WITH MACHINE SPEEDS
-- This ensures setup table has consistent data with machine table
-- Formula: Std Prodn = (Speed / 1693 / Hank) × Total Time × Std Effi × Delivery
-- ============================================
UPDATE breaker_drawing_machine_setup bdms
SET 
  speed = dbm.speed,
  std_prodn = ROUND(
    (dbm.speed::DECIMAL / 1693 / COALESCE(bdms.hank_constant, 0.14)) 
    * COALESCE(bdms.shift_time, 510) 
    * COALESCE(bdms.std_efficiency_factor, 0.85) 
    * COALESCE(bdms.delivery, 1), 2
  ),
  updated_at = NOW()
FROM drawing_breaker_machines dbm
WHERE bdms.machine_id = dbm.id
  AND dbm.machine_no IN ('BD1', 'BD2', 'BD3', 'BD4');

-- ============================================
-- 3. POSTGRESQL HELPER FUNCTIONS FOR APP-SIDE CALCULATIONS
-- These functions can be called from the app via Supabase RPC
-- ============================================

-- 3a. Calculate Std Prodn
-- Usage: SELECT calculate_breaker_drawing_std_prodn(450, 0.14, 510, 0.85, 2);
DROP FUNCTION IF EXISTS calculate_breaker_drawing_std_prodn(DECIMAL, DECIMAL, INTEGER, DECIMAL, INTEGER);
CREATE OR REPLACE FUNCTION calculate_breaker_drawing_std_prodn(
  p_speed DECIMAL,
  p_hank_constant DECIMAL DEFAULT 0.14,
  p_total_time INTEGER DEFAULT 510,
  p_std_efficiency_factor DECIMAL DEFAULT 0.85,
  p_delivery INTEGER DEFAULT 1
) RETURNS DECIMAL AS $$
BEGIN
  -- Formula: (Speed / 1693 / Hank) × Total Time × Std Effi × Delivery
  RETURN ROUND(
    (p_speed / 1693.0 / p_hank_constant) 
    * p_total_time 
    * p_std_efficiency_factor 
    * p_delivery, 2
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3b. Calculate Exp Prodn
-- Usage: SELECT calculate_breaker_drawing_exp_prodn(1371.72, 430, 510);
DROP FUNCTION IF EXISTS calculate_breaker_drawing_exp_prodn(DECIMAL, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION calculate_breaker_drawing_exp_prodn(
  p_std_prodn DECIMAL,
  p_work_time INTEGER,
  p_total_time INTEGER DEFAULT 510
) RETURNS DECIMAL AS $$
BEGIN
  -- Formula: Std Prodn × (Work Time / Total Time)
  IF p_total_time = 0 THEN RETURN 0; END IF;
  RETURN ROUND(p_std_prodn * (p_work_time::DECIMAL / p_total_time), 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3c. Calculate all production fields from machine_id
-- Usage: SELECT * FROM calculate_breaker_drawing_production('uuid-here', 864.20, 270);
DROP FUNCTION IF EXISTS calculate_breaker_drawing_production(UUID, DECIMAL, INTEGER, DECIMAL, INTEGER);
CREATE OR REPLACE FUNCTION calculate_breaker_drawing_production(
  p_machine_id UUID,
  p_act_prodn DECIMAL,
  p_work_time INTEGER,
  p_waste DECIMAL DEFAULT 0.85,
  p_total_time INTEGER DEFAULT 510
) RETURNS TABLE (
  speed DECIMAL,
  std_prodn DECIMAL,
  exp_prodn DECIMAL,
  effi_percent DECIMAL,
  uti_percent DECIMAL,
  waste_percent DECIMAL
) AS $$
DECLARE
  v_speed DECIMAL;
  v_hank_constant DECIMAL;
  v_std_efficiency_factor DECIMAL;
  v_delivery INTEGER;
  v_std_prodn DECIMAL;
  v_exp_prodn DECIMAL;
BEGIN
  -- Get speed from machine table (source of truth) and other params from setup
  SELECT 
    dbm.speed,
    COALESCE(bdms.hank_constant, 0.14),
    COALESCE(bdms.std_efficiency_factor, 0.85),
    COALESCE(bdms.delivery, 1)
  INTO v_speed, v_hank_constant, v_std_efficiency_factor, v_delivery
  FROM drawing_breaker_machines dbm
  LEFT JOIN breaker_drawing_machine_setup bdms ON dbm.id = bdms.machine_id
  WHERE dbm.id = p_machine_id;
  
  -- Handle missing machine
  IF v_speed IS NULL THEN
    RAISE EXCEPTION 'Machine not found: %', p_machine_id;
  END IF;
  
  -- Calculate Std Prodn: (Speed / 1693 / Hank) × Total Time × Std Effi × Delivery
  v_std_prodn := ROUND(
    (v_speed / 1693.0 / v_hank_constant) 
    * p_total_time 
    * v_std_efficiency_factor 
    * v_delivery, 2
  );
  
  -- Calculate Exp Prodn: Std Prodn × (Work Time / Total Time)
  v_exp_prodn := ROUND(v_std_prodn * (p_work_time::DECIMAL / p_total_time), 2);
  
  -- Return all calculated values including speed for reference
  RETURN QUERY SELECT
    v_speed as speed,
    v_std_prodn as std_prodn,
    v_exp_prodn as exp_prodn,
    ROUND(p_act_prodn / NULLIF(v_exp_prodn, 0) * 100, 2) as effi_percent,
    ROUND(p_work_time::DECIMAL / p_total_time * 100, 2) as uti_percent,
    ROUND(p_waste / NULLIF(p_act_prodn, 0) * 100, 2) as waste_percent;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 4. CREATE TRIGGER TO AUTO-SYNC SPEED FROM MACHINE TABLE
-- When speed is updated in drawing_breaker_machines, auto-update setup table
-- This makes speed EDITABLE in the app - just update the machine table
-- ============================================
DROP TRIGGER IF EXISTS sync_bd_speed_on_machine_update ON drawing_breaker_machines;
DROP FUNCTION IF EXISTS sync_breaker_drawing_speed();

CREATE OR REPLACE FUNCTION sync_breaker_drawing_speed()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if speed actually changed
  IF OLD.speed IS DISTINCT FROM NEW.speed THEN
    -- Update machine setup when machine speed changes
    UPDATE breaker_drawing_machine_setup 
    SET 
      speed = NEW.speed,
      std_prodn = ROUND(
        (NEW.speed::DECIMAL / 1693.0 / COALESCE(hank_constant, 0.14)) 
        * COALESCE(shift_time, 510) 
        * COALESCE(std_efficiency_factor, 0.85) 
        * COALESCE(delivery, 1), 2
      ),
      updated_at = NOW()
    WHERE machine_id = NEW.id;
    
    RAISE NOTICE 'Speed synced for machine %: % -> %', NEW.machine_no, OLD.speed, NEW.speed;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on drawing_breaker_machines for speed sync
CREATE TRIGGER sync_bd_speed_on_machine_update
  AFTER UPDATE OF speed ON drawing_breaker_machines
  FOR EACH ROW
  EXECUTE FUNCTION sync_breaker_drawing_speed();

-- ============================================
-- 5. UPDATE OR INSERT MACHINE SETUP (UPSERT)
-- Uses speed from machine table, calculates std_prodn dynamically
-- ============================================
INSERT INTO breaker_drawing_machine_setup (
  machine_id, 
  speed, 
  hank_constant, 
  std_efficiency_factor, 
  default_waste, 
  std_prodn, 
  shift_time, 
  default_stoppage, 
  divisor_constant, 
  delivery
)
SELECT 
  dbm.id as machine_id,
  dbm.speed,  -- Speed from machine table (source of truth)
  0.14 as hank_constant,
  0.85 as std_efficiency_factor,
  0.85 as default_waste,
  -- Std Prodn calculated from machine's speed
  ROUND(
    (dbm.speed::DECIMAL / 1693.0 / 0.14) * 510 * 0.85 * 
    CASE WHEN dbm.machine_no = 'BD1' THEN 2 ELSE 1 END, 2
  ) as std_prodn,
  510 as shift_time,
  0 as default_stoppage,
  1693 as divisor_constant,
  CASE WHEN dbm.machine_no = 'BD1' THEN 2 ELSE 1 END as delivery
FROM drawing_breaker_machines dbm
WHERE dbm.machine_no IN ('BD1', 'BD2', 'BD3', 'BD4')
ON CONFLICT (machine_id) DO UPDATE SET
  speed = EXCLUDED.speed,
  std_prodn = EXCLUDED.std_prodn,
  delivery = EXCLUDED.delivery,
  updated_at = NOW();

-- ============================================
-- 6. SAMPLE PRODUCTION DATA WITH DYNAMIC CALCULATIONS
-- All values calculated from machine's speed (source of truth)
-- This section is OPTIONAL - only for testing/demo purposes
-- ============================================
DO $$
DECLARE
  v_header_id UUID;
  v_supervisor_id UUID;
  v_machine RECORD;
  v_total_time INTEGER := 510;
  v_calculated_std_prodn DECIMAL(10,2);
  v_calculated_exp_prodn DECIMAL(10,2);
  -- Sample data from VB6 screenshot
  v_work_times INTEGER[] := ARRAY[270, 260, 410, 370];  -- Work Time for BD1, BD2, BD3, BD4
  v_act_hanks DECIMAL[] := ARRAY[133.36, 213.50, 341.91, 307.04];
  v_act_prodns DECIMAL[] := ARRAY[864.20, 691.77, 1107.83, 994.85];
  v_emp_names TEXT[] := ARRAY['MURUGESWARI. M', 'MURUGESWARI. M', 'MURUGESWARI. M', 'GANDHIMATHI K'];
  v_idx INTEGER := 1;
  v_stoppage_excess_stock UUID;
  v_stoppage_bss UUID;
  v_stoppage_air_cleaning UUID;
  v_stoppage_times INTEGER[][] := ARRAY[
    ARRAY[160, 60, 20],  -- BD1: 240 total stoppage
    ARRAY[170, 60, 20],  -- BD2: 250 total stoppage
    ARRAY[20, 60, 20],   -- BD3: 100 total stoppage
    ARRAY[60, 60, 20]    -- BD4: 140 total stoppage
  ];
BEGIN
  -- Get supervisor
  SELECT id INTO v_supervisor_id FROM supervisors WHERE is_active = true LIMIT 1;
  
  -- Get stoppage reason IDs
  SELECT id INTO v_stoppage_excess_stock FROM stoppage_details WHERE code = 1510 LIMIT 1;
  SELECT id INTO v_stoppage_bss FROM stoppage_details WHERE code = 1511 LIMIT 1;
  SELECT id INTO v_stoppage_air_cleaning FROM stoppage_details WHERE code = 1512 LIMIT 1;
  
  -- Check if entry already exists for sample date
  SELECT id INTO v_header_id FROM breaker_drawing_production_header 
  WHERE entry_date = '2025-04-22' AND shift = 1;
  
  -- Delete existing data for clean insert
  IF v_header_id IS NOT NULL THEN
    DELETE FROM breaker_drawing_production_header WHERE id = v_header_id;
  END IF;
  
  -- Create header
  INSERT INTO breaker_drawing_production_header (entry_date, shift, supervisor_id, maisitry_id, total_time, remarks)
  VALUES ('2025-04-22', 1, v_supervisor_id, NULL, v_total_time, 'Sample data with dynamic calculations from machine speed')
  RETURNING id INTO v_header_id;
  
  -- Insert production details with DYNAMIC calculations from machine speed
  FOR v_machine IN 
    SELECT 
      dbm.id, 
      dbm.machine_no, 
      dbm.speed,  -- Speed from machine table
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
    
    INSERT INTO breaker_drawing_production_detail 
      (header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, 
       std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, 
       run_time, work_time, session_no)
    VALUES (
      v_header_id, 
      v_machine.id, 
      v_emp_names[v_idx], 
      COALESCE(v_machine.prodn_mixing, '64COMBED GOLD'),
      v_act_hanks[v_idx],
      v_act_prodns[v_idx],
      v_calculated_std_prodn,  -- Calculated from machine speed
      v_calculated_exp_prodn,  -- Calculated from std_prodn
      ROUND(v_act_prodns[v_idx] / NULLIF(v_calculated_exp_prodn, 0) * 100, 2),  -- Effi%
      ROUND(v_work_times[v_idx]::DECIMAL / v_total_time * 100, 2),  -- UTI%
      v_machine.default_waste,
      ROUND(v_machine.default_waste / NULLIF(v_act_prodns[v_idx], 0) * 100, 2),  -- Waste%
      v_total_time,
      v_work_times[v_idx],  -- Work Time entered separately
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
  
  RAISE NOTICE 'Sample data created with dynamic speed-based calculations';
END $$;

-- ============================================
-- 7. VERIFICATION QUERIES
-- Run these to verify the updates were applied correctly
-- ============================================

-- 7a. Verify machine speeds (source of truth)
SELECT 
  machine_no as "Machine", 
  speed as "Speed (Source of Truth)", 
  make_name as "Make", 
  prodn_mixing as "Mixing"
FROM drawing_breaker_machines 
WHERE machine_no IN ('BD1', 'BD2', 'BD3', 'BD4')
ORDER BY mc_id;

-- 7b. Verify machine setup is synced with machine speeds
SELECT 
  dbm.machine_no as "Machine",
  dbm.speed as "Machine Speed",
  bdms.speed as "Setup Speed",
  CASE WHEN dbm.speed = bdms.speed THEN '✓ Synced' ELSE '✗ OUT OF SYNC' END as "Status",
  bdms.hank_constant as "Hank",
  bdms.std_efficiency_factor as "Std Effi",
  bdms.delivery as "Delivery",
  bdms.std_prodn as "Std Prodn",
  -- Verify calculation
  ROUND((dbm.speed::DECIMAL / 1693.0 / bdms.hank_constant) * bdms.shift_time * bdms.std_efficiency_factor * bdms.delivery, 2) as "Calculated"
FROM breaker_drawing_machine_setup bdms
JOIN drawing_breaker_machines dbm ON bdms.machine_id = dbm.id
WHERE dbm.machine_no IN ('BD1', 'BD2', 'BD3', 'BD4')
ORDER BY dbm.mc_id;

-- 7c. Verify production details use correct speeds
SELECT 
  dbm.machine_no as "Machine",
  dbm.speed as "Machine Speed",
  bdpd.work_time as "Work Time",
  bdpd.std_prodn as "Std Prodn",
  bdpd.exp_prodn as "Exp Prodn",
  bdpd.act_prodn as "Act Prodn",
  bdpd.effi_percent as "Effi%",
  bdpd.uti_percent as "UTI%"
FROM breaker_drawing_production_detail bdpd
JOIN drawing_breaker_machines dbm ON bdpd.machine_id = dbm.id
JOIN breaker_drawing_production_header bdph ON bdpd.header_id = bdph.id
WHERE bdph.entry_date = '2025-04-22' AND bdph.shift = 1
ORDER BY dbm.mc_id;

-- 7d. Test the calculation function
SELECT 
  'Test calculate_breaker_drawing_production function' as "Test",
  cp.*
FROM drawing_breaker_machines dbm
CROSS JOIN LATERAL calculate_breaker_drawing_production(dbm.id, 864.20, 270, 0.85, 510) cp
WHERE dbm.machine_no = 'BD1';

-- ============================================
-- 8. HELPER: UPDATE MACHINE SPEED (for app use)
-- Example: UPDATE drawing_breaker_machines SET speed = 500 WHERE machine_no = 'BD1';
-- The trigger will automatically recalculate std_prodn in setup table
-- ============================================

SELECT '✓ Breaker Drawing Update Script Complete' as status,
       'Speed is now sourced from drawing_breaker_machines table' as note1,
       'Trigger auto-syncs speed changes to setup table' as note2,
       'Use calculate_breaker_drawing_production() for dynamic calculations' as note3;
