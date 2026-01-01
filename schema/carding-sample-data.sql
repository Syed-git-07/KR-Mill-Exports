-- ============================================
-- CARDING ENTRY - Sample Data Insert Script
-- Run this to insert sample production data
-- ============================================

-- ============================================
-- 1. First, ensure stoppage reasons exist
-- ============================================
DO $$
DECLARE
  dept_carding UUID;
  head_others UUID;
BEGIN
  -- Get department and head IDs
  SELECT id INTO dept_carding FROM departments WHERE dept_name = 'CARDING' LIMIT 1;
  SELECT id INTO head_others FROM stoppage_heads WHERE stoppage_head_name = 'OTHERS' LIMIT 1;
  
  -- Insert carding-specific stoppages if not exists
  IF head_others IS NOT NULL THEN
    INSERT INTO stoppage_details (code, stoppage_name, stoppage_head_id, department_id, short_code, description, is_active) VALUES
    (1500, 'EXCESS STOCK', head_others, dept_carding, 'EXS', 'Excess stock stoppage', true),
    (1501, 'DAILY CLEANING', head_others, dept_carding, 'DC', 'Daily cleaning work', true),
    (1502, 'GEAR BOX WORK', head_others, dept_carding, 'GEW', 'Gear box maintenance', true),
    (1503, 'CARD CLOTHING CHANGE', head_others, dept_carding, 'CCC', 'Card clothing replacement', true),
    (1504, 'COILER PROBLEM', head_others, dept_carding, 'CLP', 'Coiler malfunction', true),
    (1505, 'DOFFER PROBLEM', head_others, dept_carding, 'DFP', 'Doffer issue', true),
    (1506, 'MATERIAL SHORTAGE', head_others, dept_carding, 'MS', 'Material unavailable', true)
    ON CONFLICT (stoppage_head_id, code) DO NOTHING;
    
    RAISE NOTICE 'Stoppage reasons created/verified';
  ELSE
    RAISE NOTICE 'Warning: OTHERS stoppage head not found';
  END IF;
END $$;

-- ============================================
-- 2. Delete existing data for today and recreate
-- ============================================
DO $$
DECLARE
  v_header_id UUID;
  v_supervisor_id UUID;
  v_excess_stock_id UUID;
  v_machine RECORD;
  v_detail_id UUID;
  v_act_hank DECIMAL;
  v_act_prodn DECIMAL;
  v_exp_prodn DECIMAL;
  v_effi_percent DECIMAL;
  v_run_time INTEGER;
  v_machine_count INTEGER := 0;
BEGIN
  -- Get supervisor
  SELECT id INTO v_supervisor_id FROM supervisors WHERE is_active = true LIMIT 1;
  
  -- Get stoppage reason
  SELECT id INTO v_excess_stock_id FROM stoppage_details WHERE stoppage_name ILIKE '%EXCESS STOCK%' LIMIT 1;
  
  -- Delete existing entry for today if exists
  DELETE FROM carding_production_header WHERE entry_date = CURRENT_DATE AND shift = 1;
  
  -- Create header for today
  INSERT INTO carding_production_header (entry_date, shift, supervisor_id, maisitry_id, total_time, remarks)
  VALUES (CURRENT_DATE, 1, v_supervisor_id, NULL, 510, 'Sample data with VB6 values')
  RETURNING id INTO v_header_id;
  
  RAISE NOTICE 'Created header: %', v_header_id;
  
  -- Insert production details with varying sample data for each machine
  FOR v_machine IN 
    SELECT id, machine_no, prodn_mixing, mc_id
    FROM carding_machines 
    WHERE is_active = true 
    ORDER BY mc_id
  LOOP
    v_machine_count := v_machine_count + 1;
    
    -- Generate sample values based on machine number pattern
    CASE 
      WHEN v_machine.machine_no = 'CA1' THEN
        v_act_hank := 64.72; v_act_prodn := 225.82; v_exp_prodn := 217.07; v_effi_percent := 104.03; v_run_time := 375;
      WHEN v_machine.machine_no = 'CA2' THEN
        v_act_hank := 62.05; v_act_prodn := 216.49; v_exp_prodn := 217.07; v_effi_percent := 99.73; v_run_time := 375;
      WHEN v_machine.machine_no = 'CA3' THEN
        v_act_hank := 63.64; v_act_prodn := 222.05; v_exp_prodn := 217.07; v_effi_percent := 102.29; v_run_time := 375;
      WHEN v_machine.machine_no = 'CA4' THEN
        v_act_hank := 63.49; v_act_prodn := 221.52; v_exp_prodn := 217.07; v_effi_percent := 102.05; v_run_time := 375;
      WHEN v_machine.machine_no = 'CA5' THEN
        v_act_hank := 60.93; v_act_prodn := 212.58; v_exp_prodn := 217.07; v_effi_percent := 97.93; v_run_time := 375;
      WHEN v_machine.machine_no = 'CA6' THEN
        v_act_hank := 62.98; v_act_prodn := 219.75; v_exp_prodn := 217.07; v_effi_percent := 101.23; v_run_time := 375;
      WHEN v_machine.machine_no = 'CA7' THEN
        v_act_hank := 62.31; v_act_prodn := 217.40; v_exp_prodn := 217.07; v_effi_percent := 100.15; v_run_time := 375;
      WHEN v_machine.machine_no = 'CA8' THEN
        v_act_hank := 10.37; v_act_prodn := 36.18; v_exp_prodn := 43.41; v_effi_percent := 83.34; v_run_time := 75;
      WHEN v_machine.machine_no = 'CA9' THEN
        v_act_hank := 40.58; v_act_prodn := 141.60; v_exp_prodn := 217.07; v_effi_percent := 65.23; v_run_time := 375;
      WHEN v_machine.machine_no = 'CA10' THEN
        v_act_hank := 42.02; v_act_prodn := 146.62; v_exp_prodn := 217.07; v_effi_percent := 67.55; v_run_time := 375;
      WHEN v_machine.machine_no = 'CA11' THEN
        v_act_hank := 60.61; v_act_prodn := 196.37; v_exp_prodn := 208.39; v_effi_percent := 94.23; v_run_time := 360;
      WHEN v_machine.machine_no = 'CA12' THEN
        v_act_hank := 52.90; v_act_prodn := 171.40; v_exp_prodn := 208.39; v_effi_percent := 82.25; v_run_time := 360;
      WHEN v_machine.machine_no = 'CA13' THEN
        v_act_hank := 60.04; v_act_prodn := 209.48; v_exp_prodn := 208.39; v_effi_percent := 100.52; v_run_time := 360;
      WHEN v_machine.machine_no = 'CA14' THEN
        v_act_hank := 58.48; v_act_prodn := 204.05; v_exp_prodn := 208.39; v_effi_percent := 97.92; v_run_time := 360;
      WHEN v_machine.machine_no = 'CA15' THEN
        v_act_hank := 50.99; v_act_prodn := 177.89; v_exp_prodn := 179.44; v_effi_percent := 99.14; v_run_time := 310;
      WHEN v_machine.machine_no = 'CA16' THEN
        v_act_hank := 50.30; v_act_prodn := 175.51; v_exp_prodn := 179.44; v_effi_percent := 97.81; v_run_time := 310;
      WHEN v_machine.machine_no = 'CA17' THEN
        v_act_hank := 52.16; v_act_prodn := 169.01; v_exp_prodn := 167.87; v_effi_percent := 100.68; v_run_time := 290;
      ELSE
        -- For other machines (CA18-CA22), use default values
        v_act_hank := 60.00 + (random() * 5);
        v_act_prodn := 210.00 + (random() * 20);
        v_exp_prodn := 217.07;
        v_effi_percent := (v_act_prodn / v_exp_prodn) * 100;
        v_run_time := 375;
    END CASE;
    
    -- Insert production detail
    INSERT INTO carding_production_detail 
      (header_id, machine_id, employee_name, count_mixing, act_hank, act_prodn, 
       exp_prodn, effi_percent, uti_percent, waste, waste_percent, run_time, work_time, session_no)
    VALUES
      (v_header_id, v_machine.id, 'SANKARESWARI G', COALESCE(v_machine.prodn_mixing, '64COMBED GOLD'), 
       v_act_hank, v_act_prodn, v_exp_prodn, v_effi_percent, 
       (v_run_time::DECIMAL / 510 * 100), 0.34, (0.34 / v_act_prodn * 100), 
       v_run_time, v_run_time, 1)
    RETURNING id INTO v_detail_id;
    
    -- Create stoppage entry
    INSERT INTO carding_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, total_stoppage_time)
    VALUES (v_detail_id, v_excess_stock_id, 510 - v_run_time, 510 - v_run_time);
    
  END LOOP;
  
  RAISE NOTICE 'Created % production details with stoppage entries', v_machine_count;
END $$;

-- ============================================
-- 3. Verification Query
-- ============================================
SELECT 
  cm.machine_no,
  cpd.employee_name,
  cpd.act_hank,
  cpd.act_prodn,
  cpd.exp_prodn,
  cpd.effi_percent,
  cpd.uti_percent,
  COALESCE(cse.total_stoppage_time, 0) as stoppage,
  cpd.run_time,
  cpd.work_time
FROM carding_production_detail cpd
JOIN carding_machines cm ON cpd.machine_id = cm.id
JOIN carding_production_header cph ON cpd.header_id = cph.id
LEFT JOIN carding_stoppage_entry cse ON cse.production_detail_id = cpd.id
WHERE cph.entry_date = CURRENT_DATE AND cph.shift = 1
ORDER BY cm.mc_id;
