-- ============================================
-- UPDATE BREAKER DRAWING SAMPLE DATA
-- Update stoppage entries for today to match VB6 data
-- Run this to test with correct values
-- ============================================

-- Update stoppage entries for today's data with VB6-like stoppages
DO $$
DECLARE
  v_header_id UUID;
  v_machine_bd1 UUID;
  v_machine_bd2 UUID;
  v_machine_bd3 UUID;
  v_machine_bd4 UUID;
  v_detail_bd1 UUID;
  v_detail_bd2 UUID;
  v_detail_bd3 UUID;
  v_detail_bd4 UUID;
  v_stoppage_excess_stock UUID;
  v_stoppage_bss UUID;
  v_stoppage_air_cleaning UUID;
BEGIN
  -- Get today's header
  SELECT id INTO v_header_id FROM breaker_drawing_production_header 
  WHERE entry_date = CURRENT_DATE AND shift = 1;
  
  IF v_header_id IS NULL THEN
    RAISE NOTICE 'No entry found for today. Please create entry first.';
    RETURN;
  END IF;
  
  -- Get stoppage reason IDs
  SELECT id INTO v_stoppage_excess_stock FROM stoppage_details WHERE code = 1510 LIMIT 1;
  SELECT id INTO v_stoppage_bss FROM stoppage_details WHERE code = 1511 LIMIT 1;
  SELECT id INTO v_stoppage_air_cleaning FROM stoppage_details WHERE code = 1512 LIMIT 1;
  
  -- Get machine IDs
  SELECT id INTO v_machine_bd1 FROM drawing_breaker_machines WHERE machine_no = 'BD1';
  SELECT id INTO v_machine_bd2 FROM drawing_breaker_machines WHERE machine_no = 'BD2';
  SELECT id INTO v_machine_bd3 FROM drawing_breaker_machines WHERE machine_no = 'BD3';
  SELECT id INTO v_machine_bd4 FROM drawing_breaker_machines WHERE machine_no = 'BD4';
  
  -- Get production detail IDs
  SELECT id INTO v_detail_bd1 FROM breaker_drawing_production_detail WHERE header_id = v_header_id AND machine_id = v_machine_bd1;
  SELECT id INTO v_detail_bd2 FROM breaker_drawing_production_detail WHERE header_id = v_header_id AND machine_id = v_machine_bd2;
  SELECT id INTO v_detail_bd3 FROM breaker_drawing_production_detail WHERE header_id = v_header_id AND machine_id = v_machine_bd3;
  SELECT id INTO v_detail_bd4 FROM breaker_drawing_production_detail WHERE header_id = v_header_id AND machine_id = v_machine_bd4;
  
  -- Update stoppage for BD1: 160 + 60 + 20 = 240 mins (WorkTime = 270)
  UPDATE breaker_drawing_stoppage_entry
  SET stoppage1_id = v_stoppage_excess_stock,
      stoppage1_time = 160,
      stoppage2_id = v_stoppage_bss,
      stoppage2_time = 60,
      stoppage3_id = v_stoppage_air_cleaning,
      stoppage3_time = 20,
      total_stoppage_time = 240
  WHERE production_detail_id = v_detail_bd1;
  
  -- Update stoppage for BD2: 170 + 60 + 20 = 250 mins (WorkTime = 260)
  UPDATE breaker_drawing_stoppage_entry
  SET stoppage1_id = v_stoppage_excess_stock,
      stoppage1_time = 170,
      stoppage2_id = v_stoppage_bss,
      stoppage2_time = 60,
      stoppage3_id = v_stoppage_air_cleaning,
      stoppage3_time = 20,
      total_stoppage_time = 250
  WHERE production_detail_id = v_detail_bd2;
  
  -- Update stoppage for BD3: 20 + 60 + 20 = 100 mins (WorkTime = 410)
  UPDATE breaker_drawing_stoppage_entry
  SET stoppage1_id = v_stoppage_excess_stock,
      stoppage1_time = 20,
      stoppage2_id = v_stoppage_bss,
      stoppage2_time = 60,
      stoppage3_id = v_stoppage_air_cleaning,
      stoppage3_time = 20,
      total_stoppage_time = 100
  WHERE production_detail_id = v_detail_bd3;
  
  -- Update stoppage for BD4: 60 + 60 + 20 = 140 mins (WorkTime = 370)
  UPDATE breaker_drawing_stoppage_entry
  SET stoppage1_id = v_stoppage_excess_stock,
      stoppage1_time = 60,
      stoppage2_id = v_stoppage_bss,
      stoppage2_time = 60,
      stoppage3_id = v_stoppage_air_cleaning,
      stoppage3_time = 20,
      total_stoppage_time = 140
  WHERE production_detail_id = v_detail_bd4;
  
  -- Update production details with VB6 Act.Hank and Act.Prodn values
  -- BD1: Act.Hank=133.36, Act.Prodn=864.20
  UPDATE breaker_drawing_production_detail
  SET act_hank = 133.36, act_prodn = 864.20, waste = 0.85
  WHERE id = v_detail_bd1;
  
  -- BD2: Act.Hank=213.50, Act.Prodn=691.77
  UPDATE breaker_drawing_production_detail
  SET act_hank = 213.50, act_prodn = 691.77, waste = 0.85
  WHERE id = v_detail_bd2;
  
  -- BD3: Act.Hank=341.91, Act.Prodn=1107.83
  UPDATE breaker_drawing_production_detail
  SET act_hank = 341.91, act_prodn = 1107.83, waste = 0.85
  WHERE id = v_detail_bd3;
  
  -- BD4: Act.Hank=307.04, Act.Prodn=994.85
  UPDATE breaker_drawing_production_detail
  SET act_hank = 307.04, act_prodn = 994.85, waste = 0.85
  WHERE id = v_detail_bd4;
  
  RAISE NOTICE 'Updated stoppage and production data for today';
END $$;

-- Verify the updates
SELECT 
  dbm.machine_no as "Mc.No.",
  bdpd.act_hank as "Act.Hank",
  bdpd.act_prodn as "Act.Prodn",
  bdse.stoppage1_time as "Stop1",
  bdse.stoppage2_time as "Stop2",
  bdse.stoppage3_time as "Stop3",
  bdse.total_stoppage_time as "Total Stop",
  510 - bdse.total_stoppage_time as "WorkTime"
FROM breaker_drawing_production_detail bdpd
JOIN drawing_breaker_machines dbm ON bdpd.machine_id = dbm.id
JOIN breaker_drawing_production_header bdph ON bdpd.header_id = bdph.id
LEFT JOIN breaker_drawing_stoppage_entry bdse ON bdse.production_detail_id = bdpd.id
WHERE bdph.entry_date = CURRENT_DATE AND bdph.shift = 1
ORDER BY dbm.mc_id;

SELECT 'Sample data updated for today' as status;
