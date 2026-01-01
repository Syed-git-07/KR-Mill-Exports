-- ============================================
-- BREAKER DRAWING COMPREHENSIVE FIX
-- Fixes: WorkTime, Exp.Prodn, Std.Effi display, Act.Effi
-- Creates data for Dec 22 and Dec 23, 2025
-- ============================================

-- ============================================
-- STEP 1: Update machine master data
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

-- ============================================
-- STEP 2: Update machine_setup 
-- Note: std_efficiency_factor stored as 0.85, displayed as 85
-- ============================================

UPDATE breaker_drawing_machine_setup 
SET delivery = 2, speed = 450, std_prodn = 1646.06, 
    std_efficiency_factor = 0.85, hank_constant = 0.14, updated_at = NOW()
WHERE machine_id = (SELECT id FROM drawing_breaker_machines WHERE machine_no = 'BD1');

UPDATE breaker_drawing_machine_setup 
SET delivery = 1, speed = 750, std_prodn = 1371.72,
    std_efficiency_factor = 0.85, hank_constant = 0.14, updated_at = NOW()
WHERE machine_id = (SELECT id FROM drawing_breaker_machines WHERE machine_no = 'BD2');

UPDATE breaker_drawing_machine_setup 
SET delivery = 1, speed = 750, std_prodn = 1371.72,
    std_efficiency_factor = 0.85, hank_constant = 0.14, updated_at = NOW()
WHERE machine_id = (SELECT id FROM drawing_breaker_machines WHERE machine_no = 'BD3');

UPDATE breaker_drawing_machine_setup 
SET delivery = 1, speed = 750, std_prodn = 1371.72,
    std_efficiency_factor = 0.85, hank_constant = 0.14, updated_at = NOW()
WHERE machine_id = (SELECT id FROM drawing_breaker_machines WHERE machine_no = 'BD4');

-- ============================================
-- STEP 3: Clean up existing data for Dec 22 and Dec 23
-- ============================================

-- Delete Dec 22 data
DELETE FROM breaker_drawing_stoppage_entry 
WHERE production_detail_id IN (
  SELECT bdpd.id FROM breaker_drawing_production_detail bdpd
  JOIN breaker_drawing_production_header bdph ON bdpd.header_id = bdph.id
  WHERE bdph.entry_date = '2025-12-22' AND bdph.shift = 1
);

DELETE FROM breaker_drawing_production_detail 
WHERE header_id IN (
  SELECT id FROM breaker_drawing_production_header 
  WHERE entry_date = '2025-12-22' AND shift = 1
);

DELETE FROM breaker_drawing_production_header 
WHERE entry_date = '2025-12-22' AND shift = 1;

-- Delete Dec 23 data
DELETE FROM breaker_drawing_stoppage_entry 
WHERE production_detail_id IN (
  SELECT bdpd.id FROM breaker_drawing_production_detail bdpd
  JOIN breaker_drawing_production_header bdph ON bdpd.header_id = bdph.id
  WHERE bdph.entry_date = '2025-12-23' AND bdph.shift = 1
);

DELETE FROM breaker_drawing_production_detail 
WHERE header_id IN (
  SELECT id FROM breaker_drawing_production_header 
  WHERE entry_date = '2025-12-23' AND shift = 1
);

DELETE FROM breaker_drawing_production_header 
WHERE entry_date = '2025-12-23' AND shift = 1;

-- ============================================
-- STEP 4: Create Dec 22 header and data (for Copy Yesterday)
-- VB6 Reference Data with correct WorkTime calculations
-- ============================================

INSERT INTO breaker_drawing_production_header (entry_date, shift, total_time, remarks)
VALUES ('2025-12-22', 1, 510, 'VB6 Reference Data');

-- BD1: Stoppage=240, WorkTime=270, StdProdn=1646.06, ExpProdn=871.44, ActEffi=99.17%
INSERT INTO breaker_drawing_production_detail 
(header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, run_time, work_time)
SELECT 
  h.id, m.id, 'MURUGESWARI. M', '64COMBED GOLD',
  133.36, 864.20, 1646.06, 871.44, 99.17, 52.94, 0.85, 0.10, 510, 270
FROM breaker_drawing_production_header h, drawing_breaker_machines m
WHERE h.entry_date = '2025-12-22' AND h.shift = 1 AND m.machine_no = 'BD1';

-- BD2: Stoppage=250, WorkTime=260, StdProdn=1371.72, ExpProdn=699.31, ActEffi=98.92%
INSERT INTO breaker_drawing_production_detail 
(header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, run_time, work_time)
SELECT 
  h.id, m.id, 'MURUGESWARI. M', '64COMBED GOLD',
  213.50, 691.77, 1371.72, 699.31, 98.92, 50.98, 0.85, 0.12, 510, 260
FROM breaker_drawing_production_header h, drawing_breaker_machines m
WHERE h.entry_date = '2025-12-22' AND h.shift = 1 AND m.machine_no = 'BD2';

-- BD3: Stoppage=100, WorkTime=410, StdProdn=1371.72, ExpProdn=1102.76, ActEffi=100.46%
INSERT INTO breaker_drawing_production_detail 
(header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, run_time, work_time)
SELECT 
  h.id, m.id, 'MURUGESWARI. M', '64COMBED GOLD',
  341.91, 1107.83, 1371.72, 1102.76, 100.46, 80.39, 0.85, 0.08, 510, 410
FROM breaker_drawing_production_header h, drawing_breaker_machines m
WHERE h.entry_date = '2025-12-22' AND h.shift = 1 AND m.machine_no = 'BD3';

-- BD4: Stoppage=140, WorkTime=370, StdProdn=1371.72, ExpProdn=995.17, ActEffi=99.97%
INSERT INTO breaker_drawing_production_detail 
(header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, run_time, work_time)
SELECT 
  h.id, m.id, 'GANDHIMATHI K', '64COMBED GOLD',
  307.04, 994.85, 1371.72, 995.17, 99.97, 72.55, 0.85, 0.09, 510, 370
FROM breaker_drawing_production_header h, drawing_breaker_machines m
WHERE h.entry_date = '2025-12-22' AND h.shift = 1 AND m.machine_no = 'BD4';

-- Insert stoppage entries for Dec 22
INSERT INTO breaker_drawing_stoppage_entry (production_detail_id, stoppage1_time, stoppage2_time, stoppage3_time, total_stoppage_time)
SELECT pd.id, 160, 60, 20, 240
FROM breaker_drawing_production_detail pd
JOIN breaker_drawing_production_header h ON pd.header_id = h.id
JOIN drawing_breaker_machines m ON pd.machine_id = m.id
WHERE h.entry_date = '2025-12-22' AND h.shift = 1 AND m.machine_no = 'BD1';

INSERT INTO breaker_drawing_stoppage_entry (production_detail_id, stoppage1_time, stoppage2_time, stoppage3_time, total_stoppage_time)
SELECT pd.id, 170, 60, 20, 250
FROM breaker_drawing_production_detail pd
JOIN breaker_drawing_production_header h ON pd.header_id = h.id
JOIN drawing_breaker_machines m ON pd.machine_id = m.id
WHERE h.entry_date = '2025-12-22' AND h.shift = 1 AND m.machine_no = 'BD2';

INSERT INTO breaker_drawing_stoppage_entry (production_detail_id, stoppage1_time, stoppage2_time, stoppage3_time, total_stoppage_time)
SELECT pd.id, 20, 60, 20, 100
FROM breaker_drawing_production_detail pd
JOIN breaker_drawing_production_header h ON pd.header_id = h.id
JOIN drawing_breaker_machines m ON pd.machine_id = m.id
WHERE h.entry_date = '2025-12-22' AND h.shift = 1 AND m.machine_no = 'BD3';

INSERT INTO breaker_drawing_stoppage_entry (production_detail_id, stoppage1_time, stoppage2_time, stoppage3_time, total_stoppage_time)
SELECT pd.id, 60, 60, 20, 140
FROM breaker_drawing_production_detail pd
JOIN breaker_drawing_production_header h ON pd.header_id = h.id
JOIN drawing_breaker_machines m ON pd.machine_id = m.id
WHERE h.entry_date = '2025-12-22' AND h.shift = 1 AND m.machine_no = 'BD4';

-- ============================================
-- STEP 5: Create Dec 23 (TODAY) header and data
-- Same VB6 Reference Data
-- ============================================

INSERT INTO breaker_drawing_production_header (entry_date, shift, total_time, remarks)
VALUES ('2025-12-23', 1, 510, 'VB6 Reference Data - Today');

-- BD1: Stoppage=240, WorkTime=270
INSERT INTO breaker_drawing_production_detail 
(header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, run_time, work_time)
SELECT 
  h.id, m.id, 'MURUGESWARI. M', '64COMBED GOLD',
  133.36, 864.20, 1646.06, 871.44, 99.17, 52.94, 0.85, 0.10, 510, 270
FROM breaker_drawing_production_header h, drawing_breaker_machines m
WHERE h.entry_date = '2025-12-23' AND h.shift = 1 AND m.machine_no = 'BD1';

-- BD2: Stoppage=250, WorkTime=260
INSERT INTO breaker_drawing_production_detail 
(header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, run_time, work_time)
SELECT 
  h.id, m.id, 'MURUGESWARI. M', '64COMBED GOLD',
  213.50, 691.77, 1371.72, 699.31, 98.92, 50.98, 0.85, 0.12, 510, 260
FROM breaker_drawing_production_header h, drawing_breaker_machines m
WHERE h.entry_date = '2025-12-23' AND h.shift = 1 AND m.machine_no = 'BD2';

-- BD3: Stoppage=100, WorkTime=410
INSERT INTO breaker_drawing_production_detail 
(header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, run_time, work_time)
SELECT 
  h.id, m.id, 'MURUGESWARI. M', '64COMBED GOLD',
  341.91, 1107.83, 1371.72, 1102.76, 100.46, 80.39, 0.85, 0.08, 510, 410
FROM breaker_drawing_production_header h, drawing_breaker_machines m
WHERE h.entry_date = '2025-12-23' AND h.shift = 1 AND m.machine_no = 'BD3';

-- BD4: Stoppage=140, WorkTime=370
INSERT INTO breaker_drawing_production_detail 
(header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, run_time, work_time)
SELECT 
  h.id, m.id, 'GANDHIMATHI K', '64COMBED GOLD',
  307.04, 994.85, 1371.72, 995.17, 99.97, 72.55, 0.85, 0.09, 510, 370
FROM breaker_drawing_production_header h, drawing_breaker_machines m
WHERE h.entry_date = '2025-12-23' AND h.shift = 1 AND m.machine_no = 'BD4';

-- Insert stoppage entries for Dec 23
INSERT INTO breaker_drawing_stoppage_entry (production_detail_id, stoppage1_time, stoppage2_time, stoppage3_time, total_stoppage_time)
SELECT pd.id, 160, 60, 20, 240
FROM breaker_drawing_production_detail pd
JOIN breaker_drawing_production_header h ON pd.header_id = h.id
JOIN drawing_breaker_machines m ON pd.machine_id = m.id
WHERE h.entry_date = '2025-12-23' AND h.shift = 1 AND m.machine_no = 'BD1';

INSERT INTO breaker_drawing_stoppage_entry (production_detail_id, stoppage1_time, stoppage2_time, stoppage3_time, total_stoppage_time)
SELECT pd.id, 170, 60, 20, 250
FROM breaker_drawing_production_detail pd
JOIN breaker_drawing_production_header h ON pd.header_id = h.id
JOIN drawing_breaker_machines m ON pd.machine_id = m.id
WHERE h.entry_date = '2025-12-23' AND h.shift = 1 AND m.machine_no = 'BD2';

INSERT INTO breaker_drawing_stoppage_entry (production_detail_id, stoppage1_time, stoppage2_time, stoppage3_time, total_stoppage_time)
SELECT pd.id, 20, 60, 20, 100
FROM breaker_drawing_production_detail pd
JOIN breaker_drawing_production_header h ON pd.header_id = h.id
JOIN drawing_breaker_machines m ON pd.machine_id = m.id
WHERE h.entry_date = '2025-12-23' AND h.shift = 1 AND m.machine_no = 'BD3';

INSERT INTO breaker_drawing_stoppage_entry (production_detail_id, stoppage1_time, stoppage2_time, stoppage3_time, total_stoppage_time)
SELECT pd.id, 60, 60, 20, 140
FROM breaker_drawing_production_detail pd
JOIN breaker_drawing_production_header h ON pd.header_id = h.id
JOIN drawing_breaker_machines m ON pd.machine_id = m.id
WHERE h.entry_date = '2025-12-23' AND h.shift = 1 AND m.machine_no = 'BD4';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check Dec 22 data
SELECT 'Dec 22 Data:' as info;
SELECT 
  dbm.machine_no as "Mc.No.",
  bdpd.employee_name as "Emp.Name",
  bdpd.act_hank as "Act.Hank",
  bdpd.act_prodn as "Act.Prodn",
  bdpd.std_prodn as "Std.Prodn",
  bdpd.exp_prodn as "Exp.Prodn",
  bdpd.effi_percent as "Act.Effi%",
  bdpd.uti_percent as "UTI%",
  bdpd.work_time as "WorkTime",
  bdse.total_stoppage_time as "Stoppage"
FROM breaker_drawing_production_detail bdpd
JOIN drawing_breaker_machines dbm ON bdpd.machine_id = dbm.id
JOIN breaker_drawing_production_header bdph ON bdpd.header_id = bdph.id
LEFT JOIN breaker_drawing_stoppage_entry bdse ON bdse.production_detail_id = bdpd.id
WHERE bdph.entry_date = '2025-12-22' AND bdph.shift = 1
ORDER BY dbm.mc_id;

-- Check Dec 23 data
SELECT 'Dec 23 Data (Today):' as info;
SELECT 
  dbm.machine_no as "Mc.No.",
  bdpd.employee_name as "Emp.Name",
  bdpd.act_hank as "Act.Hank",
  bdpd.act_prodn as "Act.Prodn",
  bdpd.std_prodn as "Std.Prodn",
  bdpd.exp_prodn as "Exp.Prodn",
  bdpd.effi_percent as "Act.Effi%",
  bdpd.uti_percent as "UTI%",
  bdpd.work_time as "WorkTime",
  bdse.total_stoppage_time as "Stoppage"
FROM breaker_drawing_production_detail bdpd
JOIN drawing_breaker_machines dbm ON bdpd.machine_id = dbm.id
JOIN breaker_drawing_production_header bdph ON bdpd.header_id = bdph.id
LEFT JOIN breaker_drawing_stoppage_entry bdse ON bdse.production_detail_id = bdpd.id
WHERE bdph.entry_date = '2025-12-23' AND bdph.shift = 1
ORDER BY dbm.mc_id;

-- Check machine setup
SELECT 'Machine Setup:' as info;
SELECT 
  dbm.machine_no as "Mc.No.",
  dbm.speed as "Speed",
  bdms.std_prodn as "Std.Prodn",
  bdms.std_efficiency_factor * 100 as "Std.Effi",
  bdms.hank_constant as "Hank",
  bdms.delivery as "Delivery"
FROM breaker_drawing_machine_setup bdms
JOIN drawing_breaker_machines dbm ON bdms.machine_id = dbm.id
WHERE dbm.machine_no IN ('BD1', 'BD2', 'BD3', 'BD4')
ORDER BY dbm.mc_id;

SELECT 'Done! Data created for Dec 22 and Dec 23.' as status;
