-- ============================================
-- BREAKER DRAWING SIMPLE FIX
-- Run each section separately if needed
-- ============================================

-- ============================================
-- STEP 1: Update machine master with correct mixing and speeds
-- ============================================

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

-- Verify Step 1
SELECT machine_no, speed, prodn_mixing FROM drawing_breaker_machines 
WHERE machine_no IN ('BD1', 'BD2', 'BD3', 'BD4') ORDER BY mc_id;

-- ============================================
-- STEP 2: Update machine_setup with correct delivery values
-- ============================================

-- BD1 delivery = 2, std_prodn = 1646.06
UPDATE breaker_drawing_machine_setup 
SET delivery = 2, speed = 450, std_prodn = 1646.06, updated_at = NOW()
WHERE machine_id = (SELECT id FROM drawing_breaker_machines WHERE machine_no = 'BD1');

-- BD2-BD4 delivery = 1, std_prodn = 1371.72
UPDATE breaker_drawing_machine_setup 
SET delivery = 1, speed = 750, std_prodn = 1371.72, updated_at = NOW()
WHERE machine_id = (SELECT id FROM drawing_breaker_machines WHERE machine_no = 'BD2');

UPDATE breaker_drawing_machine_setup 
SET delivery = 1, speed = 750, std_prodn = 1371.72, updated_at = NOW()
WHERE machine_id = (SELECT id FROM drawing_breaker_machines WHERE machine_no = 'BD3');

UPDATE breaker_drawing_machine_setup 
SET delivery = 1, speed = 750, std_prodn = 1371.72, updated_at = NOW()
WHERE machine_id = (SELECT id FROM drawing_breaker_machines WHERE machine_no = 'BD4');

-- Verify Step 2
SELECT dbm.machine_no, dbm.speed, bdms.delivery, bdms.std_prodn
FROM breaker_drawing_machine_setup bdms
JOIN drawing_breaker_machines dbm ON bdms.machine_id = dbm.id
WHERE dbm.machine_no IN ('BD1', 'BD2', 'BD3', 'BD4') ORDER BY dbm.mc_id;

-- ============================================
-- STEP 3: Create yesterday's sample data header
-- (Run this if you want "Copy Yesterday" to work)
-- ============================================

-- First delete any existing data for yesterday shift 1
DELETE FROM breaker_drawing_stoppage_entry 
WHERE production_detail_id IN (
  SELECT bdpd.id FROM breaker_drawing_production_detail bdpd
  JOIN breaker_drawing_production_header bdph ON bdpd.header_id = bdph.id
  WHERE bdph.entry_date = CURRENT_DATE - INTERVAL '1 day' AND bdph.shift = 1
);

DELETE FROM breaker_drawing_production_detail 
WHERE header_id IN (
  SELECT id FROM breaker_drawing_production_header 
  WHERE entry_date = CURRENT_DATE - INTERVAL '1 day' AND shift = 1
);

DELETE FROM breaker_drawing_production_header 
WHERE entry_date = CURRENT_DATE - INTERVAL '1 day' AND shift = 1;

-- Create header for yesterday
INSERT INTO breaker_drawing_production_header (entry_date, shift, total_time, remarks)
VALUES (CURRENT_DATE - INTERVAL '1 day', 1, 510, 'VB6 Sample Data');

-- ============================================
-- STEP 4: Insert production details for yesterday
-- ============================================

-- BD1: WorkTime=270, ActHank=133.36, ActProdn=864.20, StdProdn=1646.06, ExpProdn=871.44
INSERT INTO breaker_drawing_production_detail 
(header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, run_time, work_time)
SELECT 
  h.id,
  m.id,
  'MURUGESWARI. M',
  '64COMBED GOLD',
  133.36,
  864.20,
  1646.06,
  871.44,
  99.17,
  52.94,
  0.85,
  0.10,
  510,
  270
FROM breaker_drawing_production_header h, drawing_breaker_machines m
WHERE h.entry_date = CURRENT_DATE - INTERVAL '1 day' AND h.shift = 1 AND m.machine_no = 'BD1';

-- BD2: WorkTime=260, ActHank=213.50, ActProdn=691.77, StdProdn=1371.72, ExpProdn=699.11
INSERT INTO breaker_drawing_production_detail 
(header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, run_time, work_time)
SELECT 
  h.id,
  m.id,
  'MURUGESWARI. M',
  '64COMBED GOLD',
  213.50,
  691.77,
  1371.72,
  699.11,
  98.95,
  50.98,
  0.85,
  0.12,
  510,
  260
FROM breaker_drawing_production_header h, drawing_breaker_machines m
WHERE h.entry_date = CURRENT_DATE - INTERVAL '1 day' AND h.shift = 1 AND m.machine_no = 'BD2';

-- BD3: WorkTime=410, ActHank=341.91, ActProdn=1107.83, StdProdn=1371.72, ExpProdn=1102.51
INSERT INTO breaker_drawing_production_detail 
(header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, run_time, work_time)
SELECT 
  h.id,
  m.id,
  'MURUGESWARI. M',
  '64COMBED GOLD',
  341.91,
  1107.83,
  1371.72,
  1102.51,
  100.48,
  80.39,
  0.85,
  0.08,
  510,
  410
FROM breaker_drawing_production_header h, drawing_breaker_machines m
WHERE h.entry_date = CURRENT_DATE - INTERVAL '1 day' AND h.shift = 1 AND m.machine_no = 'BD3';

-- BD4: WorkTime=370, ActHank=307.04, ActProdn=994.85, StdProdn=1371.72, ExpProdn=995.22
INSERT INTO breaker_drawing_production_detail 
(header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, run_time, work_time)
SELECT 
  h.id,
  m.id,
  'GANDHIMATHI K',
  '64COMBED GOLD',
  307.04,
  994.85,
  1371.72,
  995.22,
  99.96,
  72.55,
  0.85,
  0.09,
  510,
  370
FROM breaker_drawing_production_header h, drawing_breaker_machines m
WHERE h.entry_date = CURRENT_DATE - INTERVAL '1 day' AND h.shift = 1 AND m.machine_no = 'BD4';

-- ============================================
-- STEP 5: Insert stoppage entries for yesterday
-- ============================================

-- BD1: 160 + 60 + 20 = 240
INSERT INTO breaker_drawing_stoppage_entry (production_detail_id, stoppage1_time, stoppage2_time, stoppage3_time, total_stoppage_time)
SELECT pd.id, 160, 60, 20, 240
FROM breaker_drawing_production_detail pd
JOIN breaker_drawing_production_header h ON pd.header_id = h.id
JOIN drawing_breaker_machines m ON pd.machine_id = m.id
WHERE h.entry_date = CURRENT_DATE - INTERVAL '1 day' AND h.shift = 1 AND m.machine_no = 'BD1';

-- BD2: 170 + 60 + 20 = 250
INSERT INTO breaker_drawing_stoppage_entry (production_detail_id, stoppage1_time, stoppage2_time, stoppage3_time, total_stoppage_time)
SELECT pd.id, 170, 60, 20, 250
FROM breaker_drawing_production_detail pd
JOIN breaker_drawing_production_header h ON pd.header_id = h.id
JOIN drawing_breaker_machines m ON pd.machine_id = m.id
WHERE h.entry_date = CURRENT_DATE - INTERVAL '1 day' AND h.shift = 1 AND m.machine_no = 'BD2';

-- BD3: 20 + 60 + 20 = 100
INSERT INTO breaker_drawing_stoppage_entry (production_detail_id, stoppage1_time, stoppage2_time, stoppage3_time, total_stoppage_time)
SELECT pd.id, 20, 60, 20, 100
FROM breaker_drawing_production_detail pd
JOIN breaker_drawing_production_header h ON pd.header_id = h.id
JOIN drawing_breaker_machines m ON pd.machine_id = m.id
WHERE h.entry_date = CURRENT_DATE - INTERVAL '1 day' AND h.shift = 1 AND m.machine_no = 'BD3';

-- BD4: 60 + 60 + 20 = 140
INSERT INTO breaker_drawing_stoppage_entry (production_detail_id, stoppage1_time, stoppage2_time, stoppage3_time, total_stoppage_time)
SELECT pd.id, 60, 60, 20, 140
FROM breaker_drawing_production_detail pd
JOIN breaker_drawing_production_header h ON pd.header_id = h.id
JOIN drawing_breaker_machines m ON pd.machine_id = m.id
WHERE h.entry_date = CURRENT_DATE - INTERVAL '1 day' AND h.shift = 1 AND m.machine_no = 'BD4';

-- ============================================
-- VERIFICATION: Check yesterday's data
-- ============================================

SELECT 
  dbm.machine_no as "Mc.No.",
  bdpd.employee_name as "Emp.Name",
  bdpd.prodn_mixing as "Mixing",
  bdpd.act_hank as "Act.Hank",
  bdpd.act_prodn as "Act.Prodn",
  bdpd.std_prodn as "Std.Prodn",
  bdpd.exp_prodn as "Exp.Prodn",
  bdpd.effi_percent as "Effi%",
  bdpd.uti_percent as "UTI%",
  bdpd.work_time as "WorkTime",
  bdse.total_stoppage_time as "Stoppage"
FROM breaker_drawing_production_detail bdpd
JOIN drawing_breaker_machines dbm ON bdpd.machine_id = dbm.id
JOIN breaker_drawing_production_header bdph ON bdpd.header_id = bdph.id
LEFT JOIN breaker_drawing_stoppage_entry bdse ON bdse.production_detail_id = bdpd.id
WHERE bdph.entry_date = CURRENT_DATE - INTERVAL '1 day' AND bdph.shift = 1
ORDER BY dbm.mc_id;

SELECT 'Done! Yesterday data ready. Use Copy Yesterday button in app.' as status;
