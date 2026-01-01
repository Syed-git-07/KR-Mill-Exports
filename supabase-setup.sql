-- KR Production System - Complete Database Setup
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. DEPARTMENT MASTER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code INTEGER NOT NULL UNIQUE,
  dept_name TEXT NOT NULL UNIQUE,
  sl_no INTEGER NOT NULL,
  hok DECIMAL(10,2) NOT NULL DEFAULT 0.2,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_departments_code ON departments(code);
CREATE INDEX IF NOT EXISTS idx_departments_sl_no ON departments(sl_no);

-- Insert Department Master Data (35 departments including HOK-specific departments)
INSERT INTO departments (code, sl_no, dept_name, hok, is_active) VALUES
(0, 0, 'none', 0.2, true),
(1, 1, 'BLOW ROOM', 0.2, true),
(2, 2, 'CARDING', 0.2, true),
(3, 3, 'BREAKER DRAWING', 0.2, true),
(4, 4, 'LAP FORMER', 0.2, true),
(5, 5, 'COMBER', 0.2, true),
(6, 6, 'Finisher Drawing', 0.2, true),
(7, 7, 'SIMPLEX', 0.2, true),
(8, 8, 'SPINNING', 0.2, true),
(9, 9, 'SPINNING DOFFER', 0.2, true),
(10, 10, 'REELIVER', 0.2, true),
(11, 11, 'AUTOCONER', 0.2, true),
(12, 12, 'PACKING', 0.2, true),
(13, 13, 'ELECTRICIAN', 0.2, true),
(14, 14, 'FITTER', 0.2, true),
(15, 15, 'FITTER HELPER', 0.2, true),
(16, 16, 'CLEANING', 0.2, true),
(17, 17, 'SEMI CLEANING', 0.2, true),
(18, 18, 'MIXING', 0.2, true),
(19, 19, 'OHTC', 0.2, true),
(20, 20, 'COMPRESSOR', 0.2, true),
(21, 21, 'WCS', 0.2, true),
(22, 22, 'HF PLANTS', 0.2, true),
(24, 24, 'ULTIMO', 0.2, true),
(25, 25, 'POWER DISTRIBUTION', 0.2, true),
(26, 26, 'SPARE', 0.2, true),
(27, 27, 'SUESSEN EXHAUST', 0.2, true),
(28, 28, 'R.O PLANT (FOG)', 0.2, true),
(29, 29, 'R.O PLANT (HOSTEL)', 0.2, true),
(30, 30, 'STP PLANT', 0.2, true),
(31, 31, 'STP RO (PLANT)', 0.2, true),
(32, 32, 'SIMPLEX SIDER', 0.2, true),
(33, 33, 'MAISTRY', 0.2, true),
(34, 34, 'SPG SIDER', 0.2, true),
(35, 35, 'DRAWING', 0.2, true)
ON CONFLICT (dept_name) DO NOTHING;

-- ============================================
-- 2. SPINNING MACHINE MASTER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS spinning_machines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  frame_no INTEGER,
  machine_no TEXT NOT NULL UNIQUE,
  mc_id TEXT DEFAULT '225',
  description TEXT NOT NULL,
  make_name TEXT NOT NULL DEFAULT 'LMW',
  model TEXT,
  spindles INTEGER NOT NULL DEFAULT 1104,
  group_no INTEGER DEFAULT 0,
  installed_date DATE DEFAULT '2015-04-01',
  is_active BOOLEAN DEFAULT true,
  production_kgs_manual_entry BOOLEAN DEFAULT false,
  direct_hank_entry BOOLEAN DEFAULT true,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_spinning_machines_machine_no ON spinning_machines(machine_no);
CREATE INDEX IF NOT EXISTS idx_spinning_machines_frame_no ON spinning_machines(frame_no);
CREATE INDEX IF NOT EXISTS idx_spinning_machines_mc_id ON spinning_machines(mc_id);
CREATE INDEX IF NOT EXISTS idx_spinning_machines_group_no ON spinning_machines(group_no);

-- Insert Spinning Machine Data (33 machines from plan.md)
INSERT INTO spinning_machines (machine_no, description, make_name, mc_id, spindles, group_no, installed_date, is_active, production_kgs_manual_entry, direct_hank_entry) VALUES
('17', 'RF17', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('18', 'RF18', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('19', 'RF19', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('20', 'RF20', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('21', 'RF21', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('22', 'RF22', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('23', 'RF23', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('24', 'RF24', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('25', 'RF25', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('26', 'RF26', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('27', 'RF27', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('28', 'RF28', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('29', 'RF29', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('30', 'RF30', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('31', 'RF31', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('32', 'RF32', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('33', 'RF33', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('34', 'RF34', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('35', 'RF35', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('36', 'RF36', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('37', 'RF37', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('38', 'RF38', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('39', 'RF39', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('40', 'RF40', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('41', 'RF41', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('42', 'RF42', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('43', 'RF43', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('44', 'RF44', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('45', 'RF45', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('46', 'RF46', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('47', 'RF47', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('1A', 'RF1A', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true),
('2A', 'RF2A', 'LMW', '225', 1104, 0, '2015-04-01', true, false, true);

-- ============================================
-- 3. STOPPAGE HEAD MASTER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS stoppage_heads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code INTEGER NOT NULL UNIQUE,
  stoppage_head_name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sequence for auto-incrementing code
CREATE SEQUENCE IF NOT EXISTS stoppage_heads_code_seq START WITH 1;

-- Create index
CREATE INDEX IF NOT EXISTS idx_stoppage_heads_code ON stoppage_heads(code);

-- Insert Stoppage Head Data (from plan.md)
INSERT INTO stoppage_heads (code, stoppage_head_name, is_active) VALUES
(1, 'CLEANING WORK', true),
(2, 'ELECT. BREAKDOWN', true),
(3, 'ELECT. ROUTINE', true),
(4, 'MAINTEN. BREAKDOWN', true),
(5, 'MAINTEN. ROUTINE', true),
(6, 'POWER. SHOUTDOWN', true),
(7, 'POWER FAILURE', true),
(8, 'OTHERS', true),
(9, 'ERECTION WORK', true),
(10, 'QAO', true);

-- Set sequence to continue from 11
SELECT setval('stoppage_heads_code_seq', 11, false);

-- ============================================
-- 4. STOPPAGE DETAIL MASTER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS stoppage_details (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stoppage_head_id UUID REFERENCES stoppage_heads(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  code INTEGER NOT NULL,
  stoppage_name TEXT NOT NULL,
  description TEXT,
  short_code VARCHAR(10),
  full_stoppage_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stoppage_head_id, code)
);

-- Create sequence for auto-incrementing code
CREATE SEQUENCE IF NOT EXISTS stoppage_details_code_seq START WITH 1447;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_stoppage_details_code ON stoppage_details(code);
CREATE INDEX IF NOT EXISTS idx_stoppage_details_stoppage_head_id ON stoppage_details(stoppage_head_id);
CREATE INDEX IF NOT EXISTS idx_stoppage_details_department_id ON stoppage_details(department_id);
CREATE INDEX IF NOT EXISTS idx_stoppage_details_stoppage_name ON stoppage_details(stoppage_name);

-- Insert Stoppage Detail Data (33 records from VB6 application)
DO $$
DECLARE
  dept_carding UUID;
  dept_spinning UUID;
  dept_autoconer UUID;
  dept_finisher_drawing UUID;
  dept_simplex UUID;
  dept_breaker_drawing UUID;
  dept_comber UUID;
  dept_lap_former UUID;
  head_elect_breakdown UUID;
  head_mainten_breakdown UUID;
  head_mainten_routine UUID;
  head_others UUID;
BEGIN
  -- Get department IDs
  SELECT id INTO dept_carding FROM departments WHERE dept_name = 'CARDING' LIMIT 1;
  SELECT id INTO dept_spinning FROM departments WHERE dept_name = 'SPINNING' LIMIT 1;
  SELECT id INTO dept_autoconer FROM departments WHERE dept_name = 'AUTOCONER' LIMIT 1;
  SELECT id INTO dept_finisher_drawing FROM departments WHERE dept_name = 'Finisher Drawing' LIMIT 1;
  SELECT id INTO dept_simplex FROM departments WHERE dept_name = 'SIMPLEX' LIMIT 1;
  SELECT id INTO dept_breaker_drawing FROM departments WHERE dept_name = 'BREAKER DRAWING' LIMIT 1;
  SELECT id INTO dept_comber FROM departments WHERE dept_name = 'COMBER' LIMIT 1;
  SELECT id INTO dept_lap_former FROM departments WHERE dept_name = 'LAP FORMER' LIMIT 1;

  -- Get stoppage head IDs
  SELECT id INTO head_elect_breakdown FROM stoppage_heads WHERE stoppage_head_name = 'ELECT. BREAKDOWN' LIMIT 1;
  SELECT id INTO head_mainten_breakdown FROM stoppage_heads WHERE stoppage_head_name = 'MAINTEN. BREAKDOWN' LIMIT 1;
  SELECT id INTO head_mainten_routine FROM stoppage_heads WHERE stoppage_head_name = 'MAINTEN. ROUTINE' LIMIT 1;
  SELECT id INTO head_others FROM stoppage_heads WHERE stoppage_head_name = 'OTHERS' LIMIT 1;

  -- Insert 33 stoppage details
  INSERT INTO stoppage_details (code, stoppage_name, stoppage_head_id, department_id, short_code, description, is_active) VALUES
  (1447, 'LAZY WORK', head_elect_breakdown, dept_carding, 'LW', 'Employee lazy work', true),
  (1448, 'SUSSON GEAR BOX PROBLEM', head_mainten_breakdown, dept_spinning, 'SGP', 'Susson gear box malfunction', true),
  (1449, 'ABC RING CHANGE', head_mainten_routine, dept_spinning, 'ARC', 'Ring replacement', true),
  (1450, 'FRONT ROLL PROBLEM', head_mainten_breakdown, dept_spinning, 'FRP', 'Front roll issue', true),
  (1451, 'DOFFING LIMIT PROBLEM', head_mainten_breakdown, dept_spinning, 'DLP', 'Doffing limit sensor issue', true),
  (1452, 'BOTTOM ROLL PROBLEM', head_mainten_breakdown, dept_spinning, 'BRP', 'Bottom roll malfunction', true),
  (1453, 'TPU TRIP', head_elect_breakdown, dept_spinning, 'TT', 'TPU tripped', true),
  (1454, 'ACB TRIP', head_elect_breakdown, dept_autoconer, 'AT', 'ACB circuit breaker trip', true),
  (1455, 'ROLL STAND PROBLEM', head_mainten_breakdown, dept_spinning, 'RSP', 'Roll stand issue', true),
  (1456, 'DRAFTING ROLLER SERVICE', head_mainten_routine, dept_finisher_drawing, 'DRS', 'Drafting roller maintenance', true),
  (1457, 'CONVERTOR PROBLEM', head_elect_breakdown, dept_autoconer, 'CP', 'Convertor failure', true),
  (1458, 'FLYER SERVICE', head_mainten_breakdown, dept_simplex, 'FS', 'Flyer maintenance', true),
  (1459, 'RING RAIL HANDLE PROBLEM', head_mainten_breakdown, dept_spinning, 'RHP', 'Ring rail handle issue', true),
  (1460, 'TOP ARM PRESSURE LOCK PROBLEM', head_mainten_breakdown, dept_finisher_drawing, 'TAP', 'Top arm pressure lock', true),
  (1461, 'DRAFTING ARM NOSE PROBLEM', head_mainten_breakdown, dept_spinning, 'DNP', 'Drafting arm nose issue', true),
  (1462, 'SSB CABLE PROBLEM', head_elect_breakdown, dept_spinning, 'SCP', 'SSB cable fault', true),
  (1463, 'SUCTION PROBLEM', head_elect_breakdown, dept_breaker_drawing, 'SP', 'Suction system failure', true),
  (1464, 'INVERTOR PROGRAME WORK', head_elect_breakdown, dept_spinning, 'IPW', 'Invertor programming', true),
  (1465, 'FIVE LEVEL SETTING', head_mainten_breakdown, dept_carding, 'FLS', 'Five level adjustment', true),
  (1466, 'INDY PROBLEM', head_mainten_routine, dept_simplex, 'IP', 'Individual spindle issue', true),
  (1467, 'BEARING CHANGE', head_mainten_breakdown, dept_comber, 'BC', 'Bearing replacement', true),
  (1468, 'DISMANDLING', head_others, dept_spinning, 'DM', 'Machine dismantling', true),
  (1469, 'PISTON SOFT WORK', head_mainten_breakdown, dept_lap_former, 'PSW', 'Piston soft work', true),
  (1470, 'DRAFTING SERVICES', head_mainten_routine, dept_simplex, 'DS', 'Drafting service', true),
  (1471, 'GEAR BOX PROBLEM', head_mainten_breakdown, dept_spinning, 'GBP', 'Gear box malfunction', true),
  (1472, 'SUCTION PRESSURE PROBLEM', head_mainten_breakdown, dept_carding, 'SPP', 'Suction pressure issue', true),
  (1473, 'CIVIL WORK', head_others, dept_spinning, 'CW', 'Civil construction work', true),
  (1474, 'DRAFTING SETTING WORK', head_mainten_breakdown, dept_lap_former, 'DSW', 'Drafting setting', true),
  (1475, 'CRADLE CLEANING WORK', head_mainten_routine, dept_spinning, 'CCW', 'Cradle cleaning', true),
  (1476, 'DEAD BOX WORK', head_mainten_breakdown, dept_carding, 'DBW', 'Dead box maintenance', true),
  (1477, 'EMPTIES MOVEMENT/CYLINDERS SENSOR PROBLEM', head_elect_breakdown, dept_spinning, 'EMP', 'Empty movement sensor', true),
  (1478, 'EMPTIES MOVEMENT PROBLEM', head_mainten_breakdown, dept_autoconer, 'EMP2', 'Empties movement issue', true),
  (1479, 'LINE LOOKING PROBLEM', head_mainten_breakdown, dept_spinning, 'LLP', 'Line locking problem', true)
  ON CONFLICT (stoppage_head_id, code) DO NOTHING;
END $$;

-- Set sequence to continue from 1480
SELECT setval('stoppage_details_code_seq', 1480, false);

-- ============================================
-- 5. SPINNING COUNT MASTER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS spinning_counts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  count_name VARCHAR(100) NOT NULL UNIQUE,
  short_desc VARCHAR(50),
  act_count DECIMAL(6,2) NOT NULL,
  mixing_name VARCHAR(100),
  fibre VARCHAR(50),
  conv_40s_value DECIMAL(10,2),
  ukg DECIMAL(10,2),
  effi_exp_hank DECIMAL(5,2),
  effi_exp_prodn DECIMAL(5,2),
  is_running_now BOOLEAN DEFAULT FALSE,
  autoconer_active BOOLEAN DEFAULT FALSE,
  sitra_conv_value DECIMAL(10,2),
  cone_weight DECIMAL(10,3),
  effi_actual_prodn DECIMAL(5,2),
  tpi VARCHAR(50),
  speed VARCHAR(50),
  speed_autoconer DECIMAL(10,2),
  tw_con VARCHAR(50),
  waste_percent DECIMAL(5,2),
  doff_loss DECIMAL(5,2),
  auto_effi DECIMAL(5,2),
  hok_cons DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_spinning_counts_count_name ON spinning_counts(count_name);
CREATE INDEX IF NOT EXISTS idx_spinning_counts_is_active ON spinning_counts(is_active);

-- Enable Row Level Security
ALTER TABLE spinning_counts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for all users" ON spinning_counts;
DROP POLICY IF EXISTS "Enable insert for all users" ON spinning_counts;
DROP POLICY IF EXISTS "Enable update for all users" ON spinning_counts;
DROP POLICY IF EXISTS "Enable delete for all users" ON spinning_counts;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON spinning_counts;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON spinning_counts;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON spinning_counts;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON spinning_counts;

-- Create comprehensive policies for anonymous access
-- Policy 1: Public read access (for all users including anon)
CREATE POLICY "Enable read access for all users" 
ON spinning_counts
FOR SELECT 
USING (true);

-- Policy 2: Public insert access (for all users including anon)
CREATE POLICY "Enable insert for all users" 
ON spinning_counts
FOR INSERT 
WITH CHECK (true);

-- Policy 3: Public update access (for all users including anon)
CREATE POLICY "Enable update for all users" 
ON spinning_counts
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- Policy 4: Public delete access (for all users including anon)
CREATE POLICY "Enable delete for all users" 
ON spinning_counts
FOR DELETE 
USING (true);

-- Insert Spinning Count Data (21 counts from VB6 application)
INSERT INTO spinning_counts (count_name, act_count, is_active) VALUES
('60 COMBED GOLD', 60.5, true),
('61 COMBED SPECIAL', 66, true),
('62 COMBED COMPACT', 62, true),
('63 COM GOLD', 64.5, true),
('66 COMBED GOLD', 68.5, true),
('66 COMBED STAR', 68.5, true),
('64 COMBED', 66, true),
('60COME STAR', 60.5, true),
('60COM COMPACT', 60.5, true),
('65 COMBED STAR', 68.5, true),
('60CCT', 60.5, true),
('65COMBED GOLD', 68.5, true),
('60cs STAR', 60.5, true),
('6 COMPACT STAR', 66, true),
('6 COMBED COMPACT', 61.8, true),
('68 COMBED STAR', 69.5, true),
('6 COMBED DIAMOND', 61.8, true),
('92 COMBED WARP', 93, true),
('80 COMBED COMPACT WARP', 80.5, true),
('91 COMBED WARP', 91, true),
('80 COMBED WARP', 80.5, true)
ON CONFLICT (count_name) DO NOTHING;

-- ============================================
-- 6. HOK STRENGTH HEADER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS hok_strength_head (
  hok_id INTEGER PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_shift1 DECIMAL(10,2) DEFAULT 0,
  total_shift2 DECIMAL(10,2) DEFAULT 0,
  total_shift3 DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sequence for hok_id starting from 1150
CREATE SEQUENCE IF NOT EXISTS hok_strength_head_hok_id_seq START WITH 1150 OWNED BY hok_strength_head.hok_id;
ALTER TABLE hok_strength_head ALTER COLUMN hok_id SET DEFAULT nextval('hok_strength_head_hok_id_seq');

-- ============================================
-- 6B. HOK STRENGTH DETAIL TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS hok_strength_detail (
  id SERIAL PRIMARY KEY,
  hok_id INTEGER NOT NULL,
  department_id UUID NOT NULL,
  shift1 DECIMAL(10,1) DEFAULT 0,
  shift2 DECIMAL(10,1) DEFAULT 0,
  shift3 DECIMAL(10,1) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (hok_id) REFERENCES hok_strength_head(hok_id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
  UNIQUE(hok_id, department_id)
);

-- Enable RLS on HOK tables
ALTER TABLE hok_strength_head ENABLE ROW LEVEL SECURITY;
ALTER TABLE hok_strength_detail ENABLE ROW LEVEL SECURITY;

-- RLS policies for hok_strength_head (anonymous access)
CREATE POLICY "Enable read access for all users" 
ON hok_strength_head FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON hok_strength_head FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON hok_strength_head FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON hok_strength_head FOR DELETE USING (true);

-- RLS policies for hok_strength_detail (anonymous access)
CREATE POLICY "Enable read access for all users" 
ON hok_strength_detail FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON hok_strength_detail FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON hok_strength_detail FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON hok_strength_detail FOR DELETE USING (true);

-- NOTE: hok_departments view is kept for reference but app now uses departments table directly
-- Create view for HOK-specific departments (10 departments - LEGACY, not used by app)
CREATE OR REPLACE VIEW hok_departments AS
SELECT id, dept_name, code, sl_no
FROM departments
WHERE dept_name IN (
  'MIXING',
  'BLOW ROOM', 
  'CARDING',
  'DRAWING',
  'SIMPLEX SIDER',
  'SIMPLEX',
  'SPG SIDER',
  'SPINNING DOFFER',
  'MAISTRY',
  'CLEANING'
)
ORDER BY 
  CASE dept_name
    WHEN 'MIXING' THEN 1
    WHEN 'BLOW ROOM' THEN 2
    WHEN 'CARDING' THEN 3
    WHEN 'DRAWING' THEN 4
    WHEN 'SIMPLEX SIDER' THEN 5
    WHEN 'SIMPLEX' THEN 6
    WHEN 'SPG SIDER' THEN 7
    WHEN 'SPINNING DOFFER' THEN 8
    WHEN 'MAISTRY' THEN 9
    WHEN 'CLEANING' THEN 10
  END;

-- Grant permissions on view
GRANT SELECT ON hok_departments TO anon, authenticated;

-- ============================================
-- 7. SUPERVISOR MASTER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS supervisors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code INTEGER UNIQUE NOT NULL,
  supervisor_name TEXT NOT NULL UNIQUE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sequence for auto-incrementing code
CREATE SEQUENCE IF NOT EXISTS supervisors_code_seq START WITH 1;
ALTER TABLE supervisors ALTER COLUMN code SET DEFAULT nextval('supervisors_code_seq');

-- Insert Supervisor Data (from plan.md)
INSERT INTO supervisors (supervisor_name, department_id, is_active) VALUES
('nil', (SELECT id FROM departments WHERE dept_name = 'RING SPINNING'), true),
('CHINNADURA.R', (SELECT id FROM departments WHERE dept_name = 'RING SPINNING'), true),
('SUBRAMANIAN.A', (SELECT id FROM departments WHERE dept_name = 'RING SPINNING'), true),
('A.NAMBRI RAJ', (SELECT id FROM departments WHERE dept_name = 'RING SPINNING'), true),
('SAKARA.RAM.G', (SELECT id FROM departments WHERE dept_name = 'RING SPINNING'), true),
('BALASUBRAMANIAN', (SELECT id FROM departments WHERE dept_name = 'RING SPINNING'), true),
('SASIKUMAR', (SELECT id FROM departments WHERE dept_name = 'RING SPINNING'), true),
('THANGARA.J.P', (SELECT id FROM departments WHERE dept_name = 'RING SPINNING'), true),
('KALINITH.M.K', (SELECT id FROM departments WHERE dept_name = 'RING SPINNING'), true),
('PRAKASH Y', (SELECT id FROM departments WHERE dept_name = 'RING SPINNING'), true),
('N ESTHIAPPAN', (SELECT id FROM departments WHERE dept_name = 'RING SPINNING'), true);

-- ============================================
-- 8. AUTOCONER MACHINE MASTER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS autoconer_machines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_no TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  make_name TEXT NOT NULL DEFAULT 'MURT',
  mc_id INTEGER,
  group_id INTEGER DEFAULT 1,
  model TEXT,
  from_drum INTEGER,
  to_drum INTEGER,
  no_of_drums INTEGER DEFAULT 0,
  speed INTEGER,
  count TEXT,
  act_effi INTEGER DEFAULT 0,
  installed_date DATE DEFAULT '2015-04-01',
  is_active BOOLEAN DEFAULT true,
  direct_prod_entry BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for autoconer_machines
CREATE INDEX IF NOT EXISTS idx_autoconer_machines_mc_id ON autoconer_machines(mc_id);
CREATE INDEX IF NOT EXISTS idx_autoconer_machines_group_id ON autoconer_machines(group_id);
CREATE INDEX IF NOT EXISTS idx_autoconer_machines_is_active ON autoconer_machines(is_active);

-- Enable RLS for autoconer_machines
ALTER TABLE autoconer_machines ENABLE ROW LEVEL SECURITY;

-- RLS policies for autoconer_machines (anonymous access)
CREATE POLICY "Enable read access for all users" 
ON autoconer_machines FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON autoconer_machines FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON autoconer_machines FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON autoconer_machines FOR DELETE USING (true);

-- Insert Autoconer Machine Data (34 records from VB6 application)
-- mc_id: Serial number (1-34) - unique identifier for each machine
-- group_id: Machine group from series name (AC5 = group 5, AC2A = group 2)
INSERT INTO autoconer_machines (
  mc_id, machine_no, description, make_name, act_effi, is_active,
  group_id, model, from_drum, to_drum, no_of_drums,
  speed, count, installed_date, direct_prod_entry
) VALUES
  -- mc_id 1: AC4-5 (Group 4)
  (1, 'AC4-5', 'AC4-5', 'MURT', 0, true, 4, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC5 Series (Group 5) - mc_id 2-6
  (2, 'AC5-1', 'AC5-1', 'MURT', 80, true, 5, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (3, 'AC5-2', 'AC5-2', 'MURT', 80, true, 5, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (4, 'AC5-3', 'AC5-3', 'MURT', 80, true, 5, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (5, 'AC5-4', 'AC5-4', 'MURT', 80, true, 5, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (6, 'AC5-5', 'AC5-5', 'MURT', 80, true, 5, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC6 Series (Group 6) - mc_id 7-11
  (7, 'AC6-1', 'AC6-1', 'MURT', 82, true, 6, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (8, 'AC6-2', 'AC6-2', 'MURT', 0, true, 6, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (9, 'AC6-3', 'AC6-3', 'MURT', 0, true, 6, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (10, 'AC6-4', 'AC6-4', 'MURT', 0, true, 6, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (11, 'AC6-5', 'AC6-5', 'MURT', 0, true, 6, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC7 Series (Group 7) - mc_id 12-16
  (12, 'AC7-1', 'AC7-1', 'MURT', 0, true, 7, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (13, 'AC7-2', 'AC7-2', 'MURT', 0, true, 7, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (14, 'AC7-3', 'AC7-3', 'MURT', 0, true, 7, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (15, 'AC7-4', 'AC7-4', 'MURT', 0, true, 7, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (16, 'AC7-5', 'AC7-5', 'MURT', 0, true, 7, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC8 Series (Group 8) - mc_id 17-21
  (17, 'AC8-1', 'AC8-1', 'MURT', 0, true, 8, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (18, 'AC8-2', 'AC8-2', 'MURT', 0, true, 8, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (19, 'AC8-3', 'AC8-3', 'MURT', 0, true, 8, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (20, 'AC8-4', 'AC8-4', 'MURT', 0, true, 8, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (21, 'AC8-5', 'AC8-5', 'MURT', 0, true, 8, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC9 Series (Group 9) - mc_id 22-23
  (22, 'AC9-1', 'AC9-1', 'MURT', 0, true, 9, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (23, 'AC9-2', 'AC9-2', 'MURT', 0, true, 9, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC10 Series (Group 10) - mc_id 24-25
  (24, 'AC10-1', 'AC10-1', 'MURT', 0, true, 10, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (25, 'AC10-2', 'AC10-2', 'MURT', 0, true, 10, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC11 Series (Group 11) - mc_id 26-27
  (26, 'AC11-1', 'AC11-1', 'MURT', 0, true, 11, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (27, 'AC11-2', 'AC11-2', 'MURT', 0, true, 11, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC12 Series (Group 12) - mc_id 28-29
  (28, 'AC12-1', 'AC12-1', 'MURT', 82, true, 12, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (29, 'AC12-2', 'AC12-2', 'MURT', 0, true, 12, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC13 Series (Group 13) - mc_id 30-31
  (30, 'AC13-1', 'AC13-1', 'MURT', 82, true, 13, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (31, 'AC13-2', 'AC13-2', 'MURT', 82, true, 13, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC14 Series (Group 14) - mc_id 32
  (32, 'AC14-1', 'AC14-1', 'MURT', 0, true, 14, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC2A Series (Group 2) - mc_id 33-34
  (33, 'AC2A-1', 'AC2A-1', 'MURT', 0, true, 2, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (34, 'AC2A-2', 'AC2A-2', 'MURT', 0, true, 2, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);

-- ============================================
-- 9. CARDING MACHINE MASTER TABLE (Preparatory Master)
-- VB6 Grid: McNo, Description, Model, Mixing
-- ============================================
CREATE TABLE IF NOT EXISTS carding_machines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_no TEXT NOT NULL UNIQUE,
  description TEXT,
  make_name TEXT,
  mc_id INTEGER,
  model TEXT,
  prodn_mixing TEXT,
  speed INTEGER,
  prodn_efficiency DECIMAL(5,2) DEFAULT 0,
  installed_date DATE DEFAULT '2015-04-01',
  is_active BOOLEAN DEFAULT true,
  direct_hank_entry BOOLEAN DEFAULT false,
  direct_kgs_entry BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for carding_machines
CREATE INDEX IF NOT EXISTS idx_carding_machines_machine_no ON carding_machines(machine_no);
CREATE INDEX IF NOT EXISTS idx_carding_machines_mc_id ON carding_machines(mc_id);
CREATE INDEX IF NOT EXISTS idx_carding_machines_is_active ON carding_machines(is_active);

-- Enable RLS for carding_machines
ALTER TABLE carding_machines ENABLE ROW LEVEL SECURITY;

-- RLS policies for carding_machines (anonymous access)
CREATE POLICY "Enable read access for all users" 
ON carding_machines FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON carding_machines FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON carding_machines FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON carding_machines FOR DELETE USING (true);

-- Insert Carding Machine Data (22 machines from VB.NET)
INSERT INTO carding_machines (machine_no, description, model, mc_id, is_active) VALUES
('CA1', 'CA1', 'LC300A', 1, true),
('CA2', 'CA2', 'LC300A', 2, true),
('CA3', 'CA3', 'LC300A', 3, true),
('CA4', 'CA4', 'LC300A', 4, true),
('CA5', 'CA5', 'LC300A', 5, true),
('CA6', 'CA6', 'LC300A', 6, true),
('CA7', 'CA7', 'LC300A', 7, true),
('CA8', 'CA8', 'LC300A V3', 8, true),
('CA9', 'CA9', 'LC300A V3', 9, true),
('CA10', 'CA10', 'LC300A V3', 10, true),
('CA11', 'CA11', 'LC300A', 11, true),
('CA12', 'CA12', 'LC300A', 12, true),
('CA13', 'CA13', 'LC300A', 13, true),
('CA14', 'CA14', 'LC300A V3', 14, true),
('CA15', 'CA15', 'LC300A V3', 15, true),
('CA16', 'CA16', 'LC300A V3', 16, true),
('CA17', 'CA17', 'LC300A V3', 17, true),
('CA18', 'CA18', 'LC300A V3', 18, true),
('CA19', 'CA19', 'LC300A V3', 19, true),
('CA20', 'CA20', 'LC300A V3', 20, true),
('CA21', 'CA21', 'LC300AV3', 21, true),
('CA22', 'CA22', 'LC300AV3', 22, true)
ON CONFLICT (machine_no) DO NOTHING;

-- ============================================
-- 10. DRAWING BREAKER MACHINE MASTER TABLE (Preparatory Master)
-- VB6 Grid: McNo, Mixing Name, Description, Make, Speed
-- IDENTICAL STRUCTURE to Carding Machine
-- ============================================
CREATE TABLE IF NOT EXISTS drawing_breaker_machines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_no TEXT NOT NULL UNIQUE,
  description TEXT,
  make_name TEXT,
  mc_id INTEGER,
  model TEXT,
  prodn_mixing TEXT,
  speed INTEGER,
  prodn_efficiency DECIMAL(5,2) DEFAULT 0,
  installed_date DATE DEFAULT '2015-04-01',
  is_active BOOLEAN DEFAULT true,
  direct_hank_entry BOOLEAN DEFAULT false,
  direct_kgs_entry BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for drawing_breaker_machines
CREATE INDEX IF NOT EXISTS idx_drawing_breaker_machines_machine_no ON drawing_breaker_machines(machine_no);
CREATE INDEX IF NOT EXISTS idx_drawing_breaker_machines_mc_id ON drawing_breaker_machines(mc_id);
CREATE INDEX IF NOT EXISTS idx_drawing_breaker_machines_is_active ON drawing_breaker_machines(is_active);

-- Enable RLS for drawing_breaker_machines
ALTER TABLE drawing_breaker_machines ENABLE ROW LEVEL SECURITY;

-- RLS policies for drawing_breaker_machines (anonymous access)
CREATE POLICY "Enable read access for all users" 
ON drawing_breaker_machines FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON drawing_breaker_machines FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON drawing_breaker_machines FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON drawing_breaker_machines FOR DELETE USING (true);

-- Insert Drawing Breaker Machine Data (5 machines from VB.NET)
INSERT INTO drawing_breaker_machines (machine_no, description, make_name, prodn_mixing, speed, mc_id, is_active) VALUES
('BD1', 'BD1', 'LMW', '64', 550, 1, true),
('BD2', 'BD2', 'LMW', '64', 500, 2, true),
('BD3', 'BD3', 'LMW', '64', 800, 3, true),
('BD4', 'BD4', 'LMW', '64', 800, 4, true),
('BD11', 'BD11', 'LMW', '64', 0, 11, true)
ON CONFLICT (machine_no) DO NOTHING;

-- ============================================
-- 11. COMBER MACHINE MASTER TABLE (Preparatory Master)
-- VB6 Grid: McNo, ProdnMixing Name, Description, Make, Speed, McEffi
-- KEY DIFFERENCE: Has mc_effi field (Machine Efficiency) - unique to Comber
-- ============================================
CREATE TABLE IF NOT EXISTS comber_machines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_no TEXT NOT NULL UNIQUE,
  description TEXT,
  make_name TEXT,
  mc_id INTEGER,
  model TEXT,
  prodn_mixing TEXT,
  speed INTEGER,
  prodn_efficiency DECIMAL(5,2) DEFAULT 0,
  mc_effi INTEGER DEFAULT 0,  -- Machine Efficiency (NEW FIELD - unique to Comber)
  installed_date DATE DEFAULT '2015-04-01',
  is_active BOOLEAN DEFAULT true,
  direct_hank_entry BOOLEAN DEFAULT false,
  direct_kgs_entry BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for comber_machines
CREATE INDEX IF NOT EXISTS idx_comber_machines_machine_no ON comber_machines(machine_no);
CREATE INDEX IF NOT EXISTS idx_comber_machines_mc_id ON comber_machines(mc_id);
CREATE INDEX IF NOT EXISTS idx_comber_machines_is_active ON comber_machines(is_active);

-- Enable RLS for comber_machines
ALTER TABLE comber_machines ENABLE ROW LEVEL SECURITY;

-- RLS policies for comber_machines (anonymous access)
CREATE POLICY "Enable read access for all users" 
ON comber_machines FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON comber_machines FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON comber_machines FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON comber_machines FOR DELETE USING (true);

-- Insert Comber Machine Data (13 machines from VB.NET)
INSERT INTO comber_machines (machine_no, description, make_name, prodn_mixing, speed, mc_effi, mc_id, is_active) VALUES
('CO1', 'COMBER 1', 'LMW', '64COMBED GOLD', 350, 93, 1, true),
('CO2', 'COMBER 2', 'LMW', '64COMBED GOLD', 350, 93, 2, true),
('CO3', 'COMBER 3', 'LMW', '64COMBED GOLD', 350, 93, 3, true),
('CO4', 'COMBER 4', 'LMW', '64COMBED GOLD', 350, 93, 4, true),
('CO5', 'COMBER 5', 'LMW', '64COMBED GOLD', 350, 93, 5, true),
('CO6', 'COMBER 6', 'LMW', '64COMBED GOLD', 450, 93, 6, true),
('CO7', 'COMBER 7', 'LMW', '64COMBED GOLD', 400, 93, 7, true),
('CO8', 'COMBER 8', 'LMW', '64COMBED GOLD', 400, 93, 8, true),
('CO9', 'COMBER 9', 'LMW', '64COMBED GOLD', 350, 93, 9, true),
('CO10', 'COMBER 10', 'LMW', '64COMBED GOLD', 350, 93, 10, true),
('CO11', 'COMBER 11', 'LMW', '64COMBED GOLD', 400, 93, 11, true),
('CO12', 'COMBER 12', 'LMW', '64COMBED GOLD', 400, 93, 12, true),
('CO13', 'COMBER 13', 'LMW', '64COMBED GOLD', 400, 93, 13, true)
ON CONFLICT (machine_no) DO NOTHING;

-- ============================================
-- 12. DRAWING FINISHER MACHINE MASTER TABLE (Preparatory Master)
-- VB6 Grid: McNo, Mixing Name, Description, Make, Speed
-- Same structure as Drawing Breaker (NO mc_effi field)
-- ============================================
CREATE TABLE IF NOT EXISTS drawing_finisher_machines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_no TEXT NOT NULL UNIQUE,
  description TEXT,
  make_name TEXT,
  mc_id INTEGER,
  model TEXT,
  prodn_mixing TEXT,
  speed INTEGER,
  prodn_efficiency DECIMAL(5,2) DEFAULT 0,
  installed_date DATE DEFAULT '2015-04-01',
  is_active BOOLEAN DEFAULT true,
  direct_hank_entry BOOLEAN DEFAULT false,
  direct_kgs_entry BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for drawing_finisher_machines
CREATE INDEX IF NOT EXISTS idx_drawing_finisher_machines_machine_no ON drawing_finisher_machines(machine_no);
CREATE INDEX IF NOT EXISTS idx_drawing_finisher_machines_mc_id ON drawing_finisher_machines(mc_id);
CREATE INDEX IF NOT EXISTS idx_drawing_finisher_machines_is_active ON drawing_finisher_machines(is_active);

-- Enable RLS for drawing_finisher_machines
ALTER TABLE drawing_finisher_machines ENABLE ROW LEVEL SECURITY;

-- RLS policies for drawing_finisher_machines (anonymous access)
CREATE POLICY "Enable read access for all users" 
ON drawing_finisher_machines FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON drawing_finisher_machines FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON drawing_finisher_machines FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON drawing_finisher_machines FOR DELETE USING (true);

-- Insert Drawing Finisher Machine Data (5 machines, similar to Drawing Breaker)
INSERT INTO drawing_finisher_machines (machine_no, description, make_name, prodn_mixing, speed, mc_id, is_active) VALUES
('FD1', 'FD1', 'LMW', '64', 550, 1, true),
('FD2', 'FD2', 'LMW', '64', 500, 2, true),
('FD3', 'FD3', 'LMW', '64', 600, 3, true),
('FD4', 'FD4', 'LMW', '64', 600, 4, true),
('FD5', 'FD5', 'LMW', '64', 550, 5, true)
ON CONFLICT (machine_no) DO NOTHING;

-- ============================================
-- 13. SIMPLEX MACHINE MASTER TABLE (Preparatory Master)
-- VB6 Grid: McNo, Mixing Name, Description, Make, Speed, MCEffi, TPI, NoofSpl
-- Has 3 additional fields: mc_effi, tpi, no_of_spindles
-- ============================================
CREATE TABLE IF NOT EXISTS simplex_machines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_no TEXT NOT NULL UNIQUE,
  description TEXT,
  make_name TEXT,
  mc_id INTEGER,
  model TEXT,
  prodn_mixing TEXT,
  speed INTEGER,
  prodn_efficiency DECIMAL(5,2) DEFAULT 0,
  mc_effi INTEGER DEFAULT 0,           -- Machine Efficiency
  tpi DECIMAL(5,2) DEFAULT 0,          -- TPI value (NEW)
  no_of_spindles INTEGER DEFAULT 0,    -- Number of Spindles (NEW)
  installed_date DATE DEFAULT '2015-04-01',
  is_active BOOLEAN DEFAULT true,
  direct_hank_entry BOOLEAN DEFAULT false,
  direct_kgs_entry BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for simplex_machines
CREATE INDEX IF NOT EXISTS idx_simplex_machines_machine_no ON simplex_machines(machine_no);
CREATE INDEX IF NOT EXISTS idx_simplex_machines_mc_id ON simplex_machines(mc_id);
CREATE INDEX IF NOT EXISTS idx_simplex_machines_is_active ON simplex_machines(is_active);

-- Enable RLS for simplex_machines
ALTER TABLE simplex_machines ENABLE ROW LEVEL SECURITY;

-- RLS policies for simplex_machines (anonymous access)
CREATE POLICY "Enable read access for all users" 
ON simplex_machines FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON simplex_machines FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON simplex_machines FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON simplex_machines FOR DELETE USING (true);

-- Insert Simplex Machine Data (10 machines from VB.NET)
INSERT INTO simplex_machines (machine_no, description, make_name, prodn_mixing, speed, mc_effi, tpi, no_of_spindles, mc_id, is_active) VALUES
('1', 'SIMPLEX1', 'LMW', '64COMBED GOLD', 1040, 92, 1.73, 140, 1, true),
('2', 'SIMPLEX2', 'LMW', '64COMBED GOLD', 1040, 92, 1.73, 140, 2, true),
('3', 'SIMPLEX3', 'LMW', '60CCT', 1050, 92, 1.69, 140, 3, true),
('4', 'SIMPLEX4', 'LMW', '60CC', 980, 92, 1.73, 120, 4, true),
('5', 'SIMPLEX5', 'LMW', '60CC', 1050, 92, 1.66, 140, 5, true),
('6', 'SIMPLEX6', 'LMW', '60CC', 980, 92, 1.73, 120, 6, true),
('7', 'SIMPLEX7', 'LMW', '64COMBED GOLD', 1050, 92, 1.69, 120, 7, true),
('8', 'SIMPLEX8', 'LMW', '64COMBED GOLD', 1050, 92, 1.69, 120, 8, true),
('9', 'SIMPLEX9', 'LMW', '60CC', 1040, 92, 1.73, 120, 9, true),
('10', 'SIMPLEX10', 'LMW', '64COMBED GOLD', 960, 92, 1.69, 120, 10, true)
ON CONFLICT (machine_no) DO NOTHING;

-- ============================================
-- 14. LAP FORMER MACHINE MASTER TABLE
-- VB6 Grid: McNo (machine_no), ProdnMixing Name (prodn_mixing), Description (description), Make (make_name), Speed (speed)
-- ============================================
CREATE TABLE IF NOT EXISTS lap_former_machines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_no VARCHAR(20) NOT NULL UNIQUE,
  description VARCHAR(255),
  make_name VARCHAR(100),
  prodn_mixing VARCHAR(100),
  speed INTEGER,
  mc_id INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE lap_former_machines ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Enable read access for all users" 
ON lap_former_machines FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON lap_former_machines FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON lap_former_machines FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON lap_former_machines FOR DELETE USING (true);

-- Insert Lap Former Machine Data (3 machines from VB.NET)
INSERT INTO lap_former_machines (machine_no, description, make_name, prodn_mixing, speed, mc_id, is_active) VALUES
('LF1', 'LABFORMER 1', 'LMW', '60CC', 130, 1, true),
('LF2', 'LABFORMER 2', 'LMW', '64COMBED GOLD', 94, 2, true),
('LF3', 'LABFORMER 3', 'LMW', '64COMBED GOLD', 94, 3, true)
ON CONFLICT (machine_no) DO NOTHING;

-- ============================================
-- 15. TPI ENTRY MASTER TABLE
-- VB6 Grid: id (entry_id), sdate (entry_date), countname (spinning_counts.count_name), TPI (tpi_value)
-- ============================================
CREATE TABLE IF NOT EXISTS tpi_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id SERIAL,  -- Sequential ID for VB6-style display (1, 2, 3...)
  entry_date DATE NOT NULL,
  spinning_count_id UUID REFERENCES spinning_counts(id) ON DELETE CASCADE,
  tpi_value DECIMAL(10,2) NOT NULL,
  machine_id UUID REFERENCES spinning_machines(id) ON DELETE SET NULL,
  shift TEXT CHECK (shift IN ('A', 'B', 'C')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 16. TWC ENTRY MASTER TABLE
-- VB6 Grid: id (entry_id), sdate (entry_date), countname (spinning_counts.count_name), TWC (twc_value)
-- ============================================
CREATE TABLE IF NOT EXISTS twc_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id SERIAL,  -- Sequential ID for VB6-style display (1, 2, 3...)
  entry_date DATE NOT NULL,
  spinning_count_id UUID REFERENCES spinning_counts(id) ON DELETE CASCADE,
  twc_value DECIMAL(10,2) NOT NULL,
  machine_id UUID REFERENCES spinning_machines(id) ON DELETE SET NULL,
  shift TEXT CHECK (shift IN ('A', 'B', 'C')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_departments_dept_name ON departments(dept_name);
CREATE INDEX IF NOT EXISTS idx_spinning_machines_machine_no ON spinning_machines(machine_no);
CREATE INDEX IF NOT EXISTS idx_spinning_machines_frame_no ON spinning_machines(frame_no);
CREATE INDEX IF NOT EXISTS idx_spinning_machines_mc_id ON spinning_machines(mc_id);
CREATE INDEX IF NOT EXISTS idx_spinning_machines_group_no ON spinning_machines(group_no);
CREATE INDEX IF NOT EXISTS idx_stoppage_heads_name ON stoppage_heads(stoppage_head_name);
CREATE INDEX IF NOT EXISTS idx_spinning_counts_count_ne ON spinning_counts(count_ne);
CREATE INDEX IF NOT EXISTS idx_hok_strength_head_date ON hok_strength_head(date);
CREATE INDEX IF NOT EXISTS idx_hok_strength_detail_hok_id ON hok_strength_detail(hok_id);
CREATE INDEX IF NOT EXISTS idx_hok_strength_detail_dept_id ON hok_strength_detail(department_id);
CREATE INDEX IF NOT EXISTS idx_supervisors_name ON supervisors(supervisor_name);
CREATE INDEX IF NOT EXISTS idx_autoconer_machines_machine_no ON autoconer_machines(machine_no);
CREATE INDEX IF NOT EXISTS idx_carding_machines_model ON carding_machines(model);
CREATE INDEX IF NOT EXISTS idx_tpi_entries_date ON tpi_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_tpi_entries_entry_id ON tpi_entries(entry_id);
CREATE INDEX IF NOT EXISTS idx_twc_entries_date ON twc_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_twc_entries_entry_id ON twc_entries(entry_id);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
-- Note: autoconer_machines RLS is already enabled in section 8

-- Enable RLS for tpi_entries
ALTER TABLE tpi_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies for tpi_entries (anonymous access)
CREATE POLICY "Enable read access for all users" 
ON tpi_entries FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON tpi_entries FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON tpi_entries FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON tpi_entries FOR DELETE USING (true);

-- Enable RLS for twc_entries
ALTER TABLE twc_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies for twc_entries (anonymous access)
CREATE POLICY "Enable read access for all users" 
ON twc_entries FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON twc_entries FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON twc_entries FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON twc_entries FOR DELETE USING (true);

-- ============================================
-- 17. CARDING PRODUCTION HEADER TABLE (Preparatory Entry)
-- One record per Date + Shift combination
-- VB6 Fields: Date, Shift, Supervisor, Maisitry
-- ============================================
CREATE TABLE IF NOT EXISTS carding_production_header (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id SERIAL,  -- Sequential ID for VB6-style display
  entry_date DATE NOT NULL,
  shift INTEGER NOT NULL CHECK (shift IN (1, 2, 3)),
  supervisor_id UUID REFERENCES supervisors(id) ON DELETE SET NULL,
  maisitry_id UUID REFERENCES supervisors(id) ON DELETE SET NULL,  -- Maisitry can be NIL
  total_time INTEGER DEFAULT 510,  -- Default shift time in minutes
  remarks TEXT,
  is_locked BOOLEAN DEFAULT false,  -- Lock after verification
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_date, shift)  -- Only one entry per date + shift
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_carding_prod_header_date ON carding_production_header(entry_date);
CREATE INDEX IF NOT EXISTS idx_carding_prod_header_shift ON carding_production_header(shift);
CREATE INDEX IF NOT EXISTS idx_carding_prod_header_entry_id ON carding_production_header(entry_id);

-- Enable RLS
ALTER TABLE carding_production_header ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Enable read access for all users" 
ON carding_production_header FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON carding_production_header FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON carding_production_header FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON carding_production_header FOR DELETE USING (true);

-- ============================================
-- 18. CARDING PRODUCTION DETAIL TABLE (Preparatory Entry)
-- One record per machine per shift
-- VB6 Grid: Mc.No., Emp.Name, Count, Act.Hank, Act.Prodn, Exp.Prodn, Effi%, UTI, Waste, Waste%, Run Time, WorkTime
-- ============================================
CREATE TABLE IF NOT EXISTS carding_production_detail (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  header_id UUID NOT NULL REFERENCES carding_production_header(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES carding_machines(id) ON DELETE CASCADE,
  
  -- Employee (from VB6 dropdown)
  employee_name VARCHAR(100),
  
  -- Count/Mixing (from machine master)
  count_mixing VARCHAR(100),  -- e.g., '64COMBED GOLD'
  
  -- Machine Inputs (from EL Measure Device)
  act_hank DECIMAL(10,2) DEFAULT 0,      -- Actual Hank reading
  act_prodn DECIMAL(10,2) DEFAULT 0,     -- Actual Production (kg)
  
  -- Calculated Fields (based on formula)
  std_prodn DECIMAL(10,2) DEFAULT 0,     -- Standard Production
  exp_prodn DECIMAL(10,2) DEFAULT 0,     -- Expected Production
  effi_percent DECIMAL(10,2) DEFAULT 0,  -- Efficiency % (Performance)
  uti_percent DECIMAL(10,2) DEFAULT 0,   -- Utilization %
  waste DECIMAL(10,4) DEFAULT 0.34,      -- Waste (kg) - default 0.34
  waste_percent DECIMAL(10,4) DEFAULT 0, -- Waste %
  run_time INTEGER DEFAULT 375,          -- Run Time (minutes)
  work_time INTEGER DEFAULT 375,         -- Work Time (minutes)
  
  -- Session tracking
  session_no INTEGER DEFAULT 1,
  
  -- Status
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(header_id, machine_id)  -- One entry per machine per header
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_carding_prod_detail_header ON carding_production_detail(header_id);
CREATE INDEX IF NOT EXISTS idx_carding_prod_detail_machine ON carding_production_detail(machine_id);

-- Enable RLS
ALTER TABLE carding_production_detail ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Enable read access for all users" 
ON carding_production_detail FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON carding_production_detail FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON carding_production_detail FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON carding_production_detail FOR DELETE USING (true);

-- ============================================
-- 19. CARDING STOPPAGE ENTRY TABLE (Preparatory Entry)
-- Multiple stoppages per machine (up to 4 in VB6)
-- VB6 Grid: Mc.No., Session, Effi, Shift Time, Stoppage1, S.Time1, Stoppage2, S.Time2...
-- ============================================
CREATE TABLE IF NOT EXISTS carding_stoppage_entry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  production_detail_id UUID NOT NULL REFERENCES carding_production_detail(id) ON DELETE CASCADE,
  
  -- Stoppage 1
  stoppage1_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage1_time INTEGER DEFAULT 0,  -- Time in minutes
  
  -- Stoppage 2
  stoppage2_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage2_time INTEGER DEFAULT 0,
  
  -- Stoppage 3
  stoppage3_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage3_time INTEGER DEFAULT 0,
  
  -- Stoppage 4
  stoppage4_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage4_time INTEGER DEFAULT 0,
  
  -- Total stoppage (auto-calculated)
  total_stoppage_time INTEGER DEFAULT 0,
  
  -- Full Stoppage (applies to all machines) vs Partial
  is_full_stoppage BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(production_detail_id)  -- One stoppage entry per production detail
);

-- Index
CREATE INDEX IF NOT EXISTS idx_carding_stoppage_prod_detail ON carding_stoppage_entry(production_detail_id);

-- Enable RLS
ALTER TABLE carding_stoppage_entry ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Enable read access for all users" 
ON carding_stoppage_entry FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON carding_stoppage_entry FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON carding_stoppage_entry FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON carding_stoppage_entry FOR DELETE USING (true);

-- ============================================
-- 20. CARDING MACHINE SETUP TABLE (Preparatory Entry)
-- Machine configuration used for calculations
-- ============================================
CREATE TABLE IF NOT EXISTS carding_machine_setup (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES carding_machines(id) ON DELETE CASCADE UNIQUE,
  
  -- Calculation Constants (from VB6 Machine Setup screenshot)
  speed DECIMAL(10,2) DEFAULT 130,         -- Machine Speed (130 from screenshot)
  hank_constant DECIMAL(10,4) DEFAULT 0.13, -- Hank Constant / Sliver Hank
  std_efficiency_factor DECIMAL(5,4) DEFAULT 0.98, -- Standard Efficiency Factor (98%)
  default_waste DECIMAL(10,4) DEFAULT 0.34, -- Default Waste (kg)
  
  -- Std Prodn = (Speed / divisor_constant / hank_constant) × Total Time × std_efficiency_factor
  -- Example: (130 / 1693 / 0.13) × 510 × 0.98 = 295.22 kg
  std_prodn DECIMAL(10,2) DEFAULT 295.22,  -- Standard Production (pre-calculated)
  
  -- Time defaults
  shift_time INTEGER DEFAULT 510,           -- Default shift time (minutes)
  default_stoppage INTEGER DEFAULT 135,     -- Default stoppage time
  
  -- Divisor constant (from formula: Speed/1693/0.13)
  divisor_constant INTEGER DEFAULT 1693,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE carding_machine_setup ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Enable read access for all users" 
ON carding_machine_setup FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON carding_machine_setup FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON carding_machine_setup FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON carding_machine_setup FOR DELETE USING (true);

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_spinning_machines_updated_at BEFORE UPDATE ON spinning_machines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stoppage_heads_updated_at BEFORE UPDATE ON stoppage_heads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stoppage_details_updated_at BEFORE UPDATE ON stoppage_details FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_spinning_counts_updated_at BEFORE UPDATE ON spinning_counts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hok_strength_head_updated_at BEFORE UPDATE ON hok_strength_head FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hok_strength_detail_updated_at BEFORE UPDATE ON hok_strength_detail FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_supervisors_updated_at BEFORE UPDATE ON supervisors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_autoconer_machines_updated_at BEFORE UPDATE ON autoconer_machines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tpi_entries_updated_at BEFORE UPDATE ON tpi_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_twc_entries_updated_at BEFORE UPDATE ON twc_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_carding_prod_header_updated_at BEFORE UPDATE ON carding_production_header FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_carding_prod_detail_updated_at BEFORE UPDATE ON carding_production_detail FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_carding_stoppage_updated_at BEFORE UPDATE ON carding_stoppage_entry FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_carding_machine_setup_updated_at BEFORE UPDATE ON carding_machine_setup FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SAMPLE DATA FOR TRANSACTION TABLES
-- ============================================

-- ============================================
-- TPI ENTRY SAMPLE DATA (33 records from plan.md)
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
  -- Get spinning count IDs using count_name (correct column)
  SELECT id INTO count_6_compact_star FROM spinning_counts WHERE count_name = '6 COMPACT STAR';
  SELECT id INTO count_66_combed_star FROM spinning_counts WHERE count_name = '66 COMBED STAR';
  SELECT id INTO count_60_com_compact FROM spinning_counts WHERE count_name = '60COM COMPACT';
  SELECT id INTO count_60_come_star FROM spinning_counts WHERE count_name = '60COME STAR';
  SELECT id INTO count_68_combed_star FROM spinning_counts WHERE count_name = '68 COMBED STAR';
  SELECT id INTO count_6_combed_compact FROM spinning_counts WHERE count_name = '6 COMBED COMPACT';
  SELECT id INTO count_91_combed_warp FROM spinning_counts WHERE count_name = '91 COMBED WARP';
  SELECT id INTO count_6_combed_diamond FROM spinning_counts WHERE count_name = '6 COMBED DIAMOND';

  -- Insert TPI Entry data
  INSERT INTO tpi_entries (entry_date, spinning_count_id, tpi_value, shift, remarks) VALUES
  ('2018-01-02', count_6_compact_star, 29.35, 'A', 'Quality test'),
  ('2018-02-04', count_66_combed_star, 30.81, 'B', 'Regular monitoring'),
  ('2018-02-08', count_60_com_compact, 33.95, 'A', 'Quality check'),
  ('2018-02-23', count_60_com_compact, 33.13, 'C', 'Shift test'),
  ('2018-06-18', count_66_combed_star, 31.56, 'A', 'Quality test'),
  ('2018-06-18', count_60_come_star, 27.96, 'B', 'Parallel test'),
  ('2018-07-10', count_60_come_star, 27.29, 'A', 'Morning shift'),
  ('2018-07-10', count_66_combed_star, 30.81, 'B', 'Evening shift'),
  ('2018-08-28', count_6_compact_star, 28.60, 'A', 'Quality monitoring'),
  ('2018-09-02', count_6_compact_star, 29.35, 'B', 'Regular test'),
  ('2019-03-17', count_68_combed_star, 31.56, 'A', 'Quality check'),
  ('2019-04-05', count_66_combed_star, 31.56, 'B', 'Shift monitoring'),
  ('2019-04-16', count_6_combed_compact, 33.95, 'A', 'Production test'),
  ('2019-06-12', count_60_come_star, 27.96, 'C', 'Quality test'),
  ('2019-06-29', count_6_compact_star, 30.07, 'A', 'Regular monitoring'),
  ('2019-10-25', count_60_come_star, 27.29, 'B', 'Quality check'),
  ('2019-11-14', count_6_combed_compact, 33.13, 'A', 'Production test'),
  ('2019-12-05', count_66_combed_star, 30.81, 'B', 'Quality monitoring'),
  ('2019-12-06', count_60_come_star, 27.96, 'A', 'Regular test'),
  ('2020-01-13', count_6_compact_star, 29.35, 'C', 'Shift test'),
  ('2021-08-27', count_6_combed_compact, 33.95, 'A', 'Quality check'),
  ('2021-09-21', count_68_combed_star, 4.00, 'B', 'Test error - retest required'),
  ('2021-09-20', count_68_combed_star, 31.56, 'A', 'Quality test'),
  ('2022-02-18', count_68_combed_star, 32.34, 'B', 'Production monitoring'),
  ('2022-07-30', count_91_combed_warp, 39.35, 'A', 'Warp yarn test'),
  ('2022-11-24', count_68_combed_star, 33.13, 'C', 'Quality check'),
  ('2022-12-30', count_6_combed_compact, 33.13, 'A', 'Regular test'),
  ('2023-01-06', count_68_combed_star, 31.57, 'B', 'Quality monitoring'),
  ('2024-01-29', count_68_combed_star, 32.34, 'A', 'Production test'),
  ('2024-02-23', count_6_combed_diamond, 32.34, 'B', 'Quality check'),
  ('2024-12-13', count_68_combed_star, 33.13, 'A', 'Regular monitoring'),
  ('2024-12-04', count_68_combed_star, 5.00, 'B', 'Test error - retest required'),
  ('2024-12-13', count_68_combed_star, 33.13, 'C', 'Quality test');
END $$;

-- ============================================
-- TWC ENTRY SAMPLE DATA (33 records from plan.md)
-- ============================================

DO $$
DECLARE
  count_68_combed_star UUID;
  count_6_combed_diamond UUID;
BEGIN
  -- Get spinning count IDs using count_name (correct column)
  SELECT id INTO count_68_combed_star FROM spinning_counts WHERE count_name = '68 COMBED STAR';
  SELECT id INTO count_6_combed_diamond FROM spinning_counts WHERE count_name = '6 COMBED DIAMOND';

  -- Insert TWC Entry data matching VB.NET (IDs 737-769)
  INSERT INTO twc_entries (entry_date, spinning_count_id, twc_value, shift, remarks) VALUES
  ('2024-05-20', count_68_combed_star, 2.5, 'A', 'Quality test'),       -- 737
  ('2024-05-24', count_68_combed_star, 2.0, 'B', 'Regular monitoring'), -- 738
  ('2024-05-27', count_6_combed_diamond, 2.0, 'A', 'Diamond test'),     -- 739
  ('2024-06-02', count_68_combed_star, 3.0, 'C', 'Shift test'),         -- 740
  ('2024-06-02', count_6_combed_diamond, 3.0, 'A', 'Quality check'),    -- 741
  ('2024-06-16', count_68_combed_star, 3.5, 'B', 'Production'),         -- 742
  ('2024-06-29', count_68_combed_star, 2.0, 'A', 'Quality test'),       -- 743
  ('2024-07-04', count_68_combed_star, 3.0, 'B', 'Regular test'),       -- 744
  ('2024-07-14', count_68_combed_star, 3.5, 'C', 'Shift monitoring'),   -- 745
  ('2024-07-25', count_68_combed_star, 3.0, 'A', 'Quality check'),      -- 746
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
END $$;

-- ============================================
-- HOK STRENGTH SAMPLE DATA (33 records with IDs 1150-1182)
-- ============================================

DO $$
DECLARE
  dept_mixing UUID;
  dept_blow_room UUID;
  dept_carding UUID;
  dept_breaker UUID;
  dept_simplex_sider UUID;
  dept_simplex_doffer UUID;
  dept_spg_sider UUID;
  dept_spg_doffer UUID;
  dept_maistry UUID;
  dept_cleaning UUID;
BEGIN
  -- Get department IDs
  SELECT id INTO dept_mixing FROM departments WHERE dept_name = 'MIXING';
  SELECT id INTO dept_blow_room FROM departments WHERE dept_name = 'BLOW ROOM';
  SELECT id INTO dept_carding FROM departments WHERE dept_name = 'CARDING';
  SELECT id INTO dept_breaker FROM departments WHERE dept_name = 'BREAKER DRAWING';
  SELECT id INTO dept_simplex_sider FROM departments WHERE dept_name = 'SIMPLEX SIDER';
  SELECT id INTO dept_simplex_doffer FROM departments WHERE dept_name = 'SIMPLEX DOFFER';
  SELECT id INTO dept_spg_sider FROM departments WHERE dept_name = 'SPG SIDER';
  SELECT id INTO dept_spg_doffer FROM departments WHERE dept_name = 'SPG DOFFER';
  SELECT id INTO dept_maistry FROM departments WHERE dept_name = 'MAISTRY';
  SELECT id INTO dept_cleaning FROM departments WHERE dept_name = 'CLEANING';

  -- Insert 33 HOK Strength Headers (matching plan.md sample data)
  INSERT INTO hok_strength_head (hok_id, date, total_shift1, total_shift2, total_shift3) VALUES
  (1150, '2020-01-21', 875.0, 868.0, 871.0),
  (1151, '2020-01-22', 876.0, 869.0, 872.0),
  (1152, '2020-01-23', 877.0, 870.0, 873.0),
  (1153, '2020-01-24', 878.0, 871.0, 874.0),
  (1154, '2020-01-25', 879.0, 872.0, 875.0),
  (1155, '2020-01-26', 880.0, 873.0, 876.0),
  (1156, '2020-01-27', 881.0, 874.0, 877.0),
  (1157, '2020-01-28', 882.0, 875.0, 878.0),
  (1158, '2020-01-29', 883.0, 876.0, 879.0),
  (1159, '2020-01-30', 884.0, 877.0, 880.0),
  (1160, '2020-01-31', 885.0, 878.0, 881.0),
  (1161, '2020-02-01', 886.0, 879.0, 882.0),
  (1162, '2020-02-02', 887.0, 880.0, 883.0),
  (1163, '2020-02-03', 888.0, 881.0, 884.0),
  (1164, '2020-02-04', 889.0, 882.0, 885.0),
  (1165, '2020-02-05', 890.0, 883.0, 886.0),
  (1166, '2020-02-06', 891.0, 884.0, 887.0),
  (1167, '2020-02-07', 892.0, 885.0, 888.0),
  (1168, '2020-02-08', 893.0, 886.0, 889.0),
  (1169, '2020-02-09', 894.0, 887.0, 890.0),
  (1170, '2020-02-14', 895.0, 888.0, 891.0),
  (1171, '2020-02-15', 896.0, 889.0, 892.0),
  (1172, '2020-02-16', 897.0, 890.0, 893.0),
  (1173, '2020-02-17', 898.0, 891.0, 894.0),
  (1174, '2021-01-21', 899.0, 892.0, 895.0),
  (1175, '2021-01-20', 900.0, 893.0, 896.0),
  (1176, '2022-09-22', 901.0, 894.0, 897.0),
  (1177, '2023-07-23', 902.0, 895.0, 898.0),
  (1178, '2024-07-18', 903.0, 896.0, 899.0),
  (1179, '2024-05-03', 904.0, 897.0, 900.0),
  (1180, '2024-08-03', 905.0, 898.0, 901.0),
  (1181, '2024-08-01', 906.0, 899.0, 902.0),
  (1182, '2024-08-05', 907.0, 900.0, 903.0);

  -- Insert Detail records for first 3 dates with specific values
  INSERT INTO hok_strength_detail (hok_id, department_id, shift1, shift2, shift3) VALUES
  (1150, dept_mixing, 87.5, 86.8, 87.1),
  (1150, dept_blow_room, 85.3, 84.9, 85.1),
  (1150, dept_carding, 90.2, 89.8, 90.0),
  (1150, dept_breaker, 92.1, 91.9, 92.0),
  (1150, dept_simplex_sider, 88.3, 87.9, 88.1),
  (1150, dept_simplex_doffer, 89.2, 88.8, 89.0),
  (1150, dept_spg_sider, 95.3, 94.9, 95.1),
  (1150, dept_spg_doffer, 90.4, 90.0, 90.2),
  (1150, dept_maistry, 91.3, 90.9, 91.1),
  (1150, dept_cleaning, 85.2, 84.8, 85.0);

  INSERT INTO hok_strength_detail (hok_id, department_id, shift1, shift2, shift3) VALUES
  (1151, dept_mixing, 87.6, 86.9, 87.2),
  (1151, dept_blow_room, 85.4, 85.0, 85.2),
  (1151, dept_carding, 90.3, 89.9, 90.1),
  (1151, dept_breaker, 92.2, 92.0, 92.1),
  (1151, dept_simplex_sider, 88.4, 88.0, 88.2),
  (1151, dept_simplex_doffer, 89.3, 88.9, 89.1),
  (1151, dept_spg_sider, 95.4, 95.0, 95.2),
  (1151, dept_spg_doffer, 90.5, 90.1, 90.3),
  (1151, dept_maistry, 91.4, 91.0, 91.2),
  (1151, dept_cleaning, 85.3, 84.9, 85.1);

  INSERT INTO hok_strength_detail (hok_id, department_id, shift1, shift2, shift3) VALUES
  (1152, dept_mixing, 87.7, 87.0, 87.3),
  (1152, dept_blow_room, 85.5, 85.1, 85.3),
  (1152, dept_carding, 90.4, 90.0, 90.2),
  (1152, dept_breaker, 92.3, 92.1, 92.2),
  (1152, dept_simplex_sider, 88.5, 88.1, 88.3),
  (1152, dept_simplex_doffer, 89.4, 89.0, 89.2),
  (1152, dept_spg_sider, 95.5, 95.1, 95.3),
  (1152, dept_spg_doffer, 90.6, 90.2, 90.4),
  (1152, dept_maistry, 91.5, 91.1, 91.3),
  (1152, dept_cleaning, 85.4, 85.0, 85.2);

  -- For remaining dates (1153-1182), insert with varying realistic data
  FOR i IN 1153..1182 LOOP
    INSERT INTO hok_strength_detail (hok_id, department_id, shift1, shift2, shift3) VALUES
    (i, dept_mixing, 87.0 + (RANDOM() * 2), 86.5 + (RANDOM() * 2), 87.0 + (RANDOM() * 2)),
    (i, dept_blow_room, 85.0 + (RANDOM() * 2), 84.5 + (RANDOM() * 2), 85.0 + (RANDOM() * 2)),
    (i, dept_carding, 90.0 + (RANDOM() * 2), 89.5 + (RANDOM() * 2), 90.0 + (RANDOM() * 2)),
    (i, dept_breaker, 92.0 + (RANDOM() * 2), 91.5 + (RANDOM() * 2), 92.0 + (RANDOM() * 2)),
    (i, dept_simplex_sider, 88.0 + (RANDOM() * 2), 87.5 + (RANDOM() * 2), 88.0 + (RANDOM() * 2)),
    (i, dept_simplex_doffer, 89.0 + (RANDOM() * 2), 88.5 + (RANDOM() * 2), 89.0 + (RANDOM() * 2)),
    (i, dept_spg_sider, 95.0 + (RANDOM() * 2), 94.5 + (RANDOM() * 2), 95.0 + (RANDOM() * 2)),
    (i, dept_spg_doffer, 90.0 + (RANDOM() * 2), 89.5 + (RANDOM() * 2), 90.0 + (RANDOM() * 2)),
    (i, dept_maistry, 91.0 + (RANDOM() * 2), 90.5 + (RANDOM() * 2), 91.0 + (RANDOM() * 2)),
    (i, dept_cleaning, 85.0 + (RANDOM() * 2), 84.5 + (RANDOM() * 2), 85.0 + (RANDOM() * 2));
  END LOOP;

  -- Update sequence to continue from 1183
  PERFORM setval('hok_strength_head_hok_id_seq', 1183, false);

END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify data insertion

-- Master Data Counts
-- SELECT COUNT(*) as total_departments FROM departments;
-- SELECT COUNT(*) as total_machines FROM spinning_machines;
-- SELECT COUNT(*) as total_stoppage_heads FROM stoppage_heads;
-- SELECT COUNT(*) as total_counts FROM spinning_counts;
-- SELECT COUNT(*) as total_supervisors FROM supervisors;
-- SELECT COUNT(*) as total_autoconer FROM autoconer_machines;

-- Transaction Data Counts
-- SELECT COUNT(*) as total_tpi_entries FROM tpi_entries;
-- SELECT COUNT(*) as total_twc_entries FROM twc_entries;
-- SELECT COUNT(*) as total_hok_headers FROM hok_strength_head;
-- SELECT COUNT(*) as total_hok_details FROM hok_strength_detail;

-- Sample Transaction Data
-- SELECT entry_date, sc.count_ne, tpi_value, shift FROM tpi_entries te 
-- JOIN spinning_counts sc ON te.spinning_count_id = sc.id 
-- ORDER BY entry_date DESC LIMIT 10;

-- SELECT entry_date, sc.count_ne, twc_value, shift FROM twc_entries te 
-- JOIN spinning_counts sc ON te.spinning_count_id = sc.id 
-- ORDER BY entry_date DESC LIMIT 10;

-- HOK Strength List (matching image format)
-- SELECT hok_id as id, TO_CHAR(date, 'DD-Mon-YY') as date 
-- FROM hok_strength_head 
-- ORDER BY date DESC;

-- HOK Strength Details for a specific date
-- SELECT 
--   h.hok_id,
--   TO_CHAR(h.date, 'DD-Mon-YY') as date,
--   d.dept_name,
--   hd.shift1,
--   hd.shift2,
--   hd.shift3
-- FROM hok_strength_head h
-- JOIN hok_strength_detail hd ON h.hok_id = hd.hok_id
-- JOIN departments d ON hd.department_id = d.id
-- WHERE h.hok_id = 1150
-- ORDER BY d.dept_name;

-- ============================================
-- CARDING-SPECIFIC STOPPAGE REASONS
-- ============================================
DO $$
DECLARE
  dept_carding UUID;
  head_others UUID;
BEGIN
  -- Get department and head IDs
  SELECT id INTO dept_carding FROM departments WHERE dept_name = 'CARDING' LIMIT 1;
  SELECT id INTO head_others FROM stoppage_heads WHERE stoppage_head_name = 'OTHERS' LIMIT 1;
  
  -- Insert carding-specific stoppages
  INSERT INTO stoppage_details (code, stoppage_name, stoppage_head_id, department_id, short_code, description, is_active) VALUES
  (1500, 'EXCESS STOCK', head_others, dept_carding, 'EXS', 'Excess stock stoppage', true),
  (1501, 'DAILY CLEANING', head_others, dept_carding, 'DC', 'Daily cleaning work', true),
  (1502, 'GEAR BOX WORK', head_others, dept_carding, 'GEW', 'Gear box maintenance', true),
  (1503, 'CARD CLOTHING CHANGE', head_others, dept_carding, 'CCC', 'Card clothing replacement', true),
  (1504, 'COILER PROBLEM', head_others, dept_carding, 'CLP', 'Coiler malfunction', true),
  (1505, 'DOFFER PROBLEM', head_others, dept_carding, 'DFP', 'Doffer issue', true),
  (1506, 'MATERIAL SHORTAGE', head_others, dept_carding, 'MS', 'Material unavailable', true)
  ON CONFLICT (stoppage_head_id, code) DO NOTHING;
END $$;

-- ============================================
-- CARDING MACHINE SETUP DATA (Default calculation constants from VB6 screenshot)
-- ============================================
INSERT INTO carding_machine_setup (machine_id, speed, hank_constant, std_efficiency_factor, default_waste, std_prodn, shift_time, default_stoppage, divisor_constant)
SELECT 
  id as machine_id,
  130 as speed,              -- From VB6 Machine Setup screenshot
  0.13 as hank_constant,     -- Sliver Hank
  0.98 as std_efficiency_factor, -- Std. Effi. = 98%
  0.34 as default_waste,
  295.22 as std_prodn,       -- Pre-calculated: (130/1693/0.13)×510×0.98
  510 as shift_time,
  135 as default_stoppage,
  1693 as divisor_constant
FROM carding_machines
ON CONFLICT (machine_id) DO NOTHING;

-- ============================================
-- CARDING PRODUCTION SAMPLE DATA (From VB6 Screenshot - 22-Apr-2025, Shift 1)
-- Based on carding-formula.md calculations
-- ============================================
DO $$
DECLARE
  v_header_id UUID;
  v_supervisor_id UUID;
  v_machine_ca1 UUID;
  v_machine_ca2 UUID;
  v_machine_ca3 UUID;
  v_machine_ca4 UUID;
  v_machine_ca5 UUID;
  v_machine_ca6 UUID;
  v_machine_ca7 UUID;
  v_machine_ca8 UUID;
  v_machine_ca9 UUID;
  v_machine_ca10 UUID;
  v_machine_ca11 UUID;
  v_machine_ca12 UUID;
  v_machine_ca13 UUID;
  v_machine_ca14 UUID;
  v_machine_ca15 UUID;
  v_machine_ca16 UUID;
  v_machine_ca17 UUID;
  v_stoppage_excess_stock UUID;
  v_stoppage_daily_cleaning UUID;
  v_stoppage_gear_box UUID;
BEGIN
  -- Get supervisor (use first available)
  SELECT id INTO v_supervisor_id FROM supervisors WHERE is_active = true LIMIT 1;
  
  -- Get stoppage reason IDs
  SELECT id INTO v_stoppage_excess_stock FROM stoppage_details WHERE stoppage_name = 'EXCESS STOCK' LIMIT 1;
  SELECT id INTO v_stoppage_daily_cleaning FROM stoppage_details WHERE stoppage_name = 'DAILY CLEANING' LIMIT 1;
  SELECT id INTO v_stoppage_gear_box FROM stoppage_details WHERE stoppage_name = 'GEAR BOX WORK' LIMIT 1;
  
  -- Get machine IDs
  SELECT id INTO v_machine_ca1 FROM carding_machines WHERE machine_no = 'CA1';
  SELECT id INTO v_machine_ca2 FROM carding_machines WHERE machine_no = 'CA2';
  SELECT id INTO v_machine_ca3 FROM carding_machines WHERE machine_no = 'CA3';
  SELECT id INTO v_machine_ca4 FROM carding_machines WHERE machine_no = 'CA4';
  SELECT id INTO v_machine_ca5 FROM carding_machines WHERE machine_no = 'CA5';
  SELECT id INTO v_machine_ca6 FROM carding_machines WHERE machine_no = 'CA6';
  SELECT id INTO v_machine_ca7 FROM carding_machines WHERE machine_no = 'CA7';
  SELECT id INTO v_machine_ca8 FROM carding_machines WHERE machine_no = 'CA8';
  SELECT id INTO v_machine_ca9 FROM carding_machines WHERE machine_no = 'CA9';
  SELECT id INTO v_machine_ca10 FROM carding_machines WHERE machine_no = 'CA10';
  SELECT id INTO v_machine_ca11 FROM carding_machines WHERE machine_no = 'CA11';
  SELECT id INTO v_machine_ca12 FROM carding_machines WHERE machine_no = 'CA12';
  SELECT id INTO v_machine_ca13 FROM carding_machines WHERE machine_no = 'CA13';
  SELECT id INTO v_machine_ca14 FROM carding_machines WHERE machine_no = 'CA14';
  SELECT id INTO v_machine_ca15 FROM carding_machines WHERE machine_no = 'CA15';
  SELECT id INTO v_machine_ca16 FROM carding_machines WHERE machine_no = 'CA16';
  SELECT id INTO v_machine_ca17 FROM carding_machines WHERE machine_no = 'CA17';
  
  -- Create header for 22-Apr-2025, Shift 1
  INSERT INTO carding_production_header (entry_date, shift, supervisor_id, maisitry_id, total_time, remarks)
  VALUES ('2025-04-22', 1, v_supervisor_id, NULL, 510, 'Sample data from VB6')
  ON CONFLICT (entry_date, shift) DO NOTHING
  RETURNING id INTO v_header_id;
  
  -- Only insert details if header was created
  IF v_header_id IS NOT NULL THEN
    -- Insert production details with corrected run_time values
    -- run_time = Total Time - Stoppage Time
    -- CA1-CA7, CA9, CA10: 510 - 135 = 375
    -- CA8: 510 - 435 = 75
    -- CA11-CA14: 510 - 150 = 360
    -- CA15-CA16: 510 - 200 = 310
    -- CA17: 510 - 220 = 290
    
    INSERT INTO carding_production_detail 
      (header_id, machine_id, employee_name, count_mixing, act_hank, act_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, run_time, work_time, session_no)
    VALUES
      -- CA1-CA7, CA9, CA10: Stoppage=135, RunTime=375, WorkTime=375
      (v_header_id, v_machine_ca1, 'SANKARESWARI G', '64COMBED GOLD', 64.72, 225.82, 217.07, 104.03, 73.53, 0.34, 0.15, 375, 375, 1),
      (v_header_id, v_machine_ca2, 'SANKARESWARI G', '64COMBED GOLD', 62.05, 216.49, 217.07, 99.73, 73.53, 0.34, 0.16, 375, 375, 1),
      (v_header_id, v_machine_ca3, 'SANKARESWARI G', '64COMBED GOLD', 63.64, 222.05, 217.07, 102.29, 73.53, 0.34, 0.15, 375, 375, 1),
      (v_header_id, v_machine_ca4, 'SANKARESWARI G', '64COMBED GOLD', 63.49, 221.52, 217.07, 102.05, 73.53, 0.34, 0.15, 375, 375, 1),
      (v_header_id, v_machine_ca5, 'SANKARESWARI G', '64COMBED GOLD', 60.93, 212.58, 217.07, 97.93, 73.53, 0.34, 0.16, 375, 375, 1),
      (v_header_id, v_machine_ca6, 'SANKARESWARI G', '64COMBED GOLD', 62.98, 219.75, 217.07, 101.23, 73.53, 0.34, 0.15, 375, 375, 1),
      (v_header_id, v_machine_ca7, 'SANKARESWARI G', '64COMBED GOLD', 62.31, 217.40, 217.07, 100.15, 73.53, 0.34, 0.16, 375, 375, 1),
      -- CA8: Stoppage=435 (135+300), RunTime=75, WorkTime=75
      (v_header_id, v_machine_ca8, 'SANKARESWARI G', '64COMBED GOLD', 10.37, 36.18, 43.41, 83.34, 14.71, 0.34, 0.94, 75, 75, 1),
      -- CA9, CA10: Stoppage=135, RunTime=375, WorkTime=375
      (v_header_id, v_machine_ca9, 'SANKARESWARI G', '64COMBED GOLD', 40.58, 141.60, 217.07, 65.23, 73.53, 0.34, 0.24, 375, 375, 1),
      (v_header_id, v_machine_ca10, 'SANKARESWARI G', '64COMBED GOLD', 42.02, 146.62, 217.07, 67.55, 73.53, 0.34, 0.23, 375, 375, 1),
      -- CA11-CA14: Stoppage=150, RunTime=360, WorkTime=360
      (v_header_id, v_machine_ca11, 'SANKARESWARI G', '64COMBED GOLD', 60.61, 196.37, 208.39, 94.23, 70.59, 0.34, 0.17, 360, 360, 1),
      (v_header_id, v_machine_ca12, 'SANKARESWARI G', '64COMBED GOLD', 52.90, 171.40, 208.39, 82.25, 70.59, 0.34, 0.20, 360, 360, 1),
      (v_header_id, v_machine_ca13, 'SANKARESWARI G', '64COMBED GOLD', 60.04, 209.48, 208.39, 100.52, 70.59, 0.34, 0.16, 360, 360, 1),
      (v_header_id, v_machine_ca14, 'SANKARESWARI G', '64COMBED GOLD', 58.48, 204.05, 208.39, 97.92, 70.59, 0.34, 0.17, 360, 360, 1),
      -- CA15-CA16: Stoppage=200, RunTime=310, WorkTime=310
      (v_header_id, v_machine_ca15, 'SANKARESWARI G', '64COMBED GOLD', 50.99, 177.89, 179.44, 99.14, 60.78, 0.34, 0.19, 310, 310, 1),
      (v_header_id, v_machine_ca16, 'SANKARESWARI G', '64COMBED GOLD', 50.30, 175.51, 179.44, 97.81, 60.78, 0.34, 0.19, 310, 310, 1),
      -- CA17: Stoppage=220, RunTime=290, WorkTime=290
      (v_header_id, v_machine_ca17, 'SANKARESWARI G', '64COMBED GOLD', 52.16, 169.01, 167.87, 100.68, 56.86, 0.34, 0.20, 290, 290, 1);

    -- Insert Stoppage Entries with stoppage reason IDs
    -- CA1-CA7, CA9, CA10: EXCESS STOCK (135 mins)
    INSERT INTO carding_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, total_stoppage_time)
    SELECT cpd.id, v_stoppage_excess_stock, 135, 135
    FROM carding_production_detail cpd
    WHERE cpd.header_id = v_header_id
    AND cpd.machine_id IN (v_machine_ca1, v_machine_ca2, v_machine_ca3, v_machine_ca4, v_machine_ca5, v_machine_ca6, v_machine_ca7, v_machine_ca9, v_machine_ca10);
    
    -- CA8: EXCESS STOCK (135) + GEAR BOX WORK (300) = 435 mins
    INSERT INTO carding_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, total_stoppage_time)
    SELECT cpd.id, v_stoppage_excess_stock, 135, v_stoppage_gear_box, 300, 435
    FROM carding_production_detail cpd
    WHERE cpd.header_id = v_header_id AND cpd.machine_id = v_machine_ca8;
    
    -- CA11-CA14: DAILY CLEANING (150 mins)
    INSERT INTO carding_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, total_stoppage_time)
    SELECT cpd.id, v_stoppage_daily_cleaning, 150, 150
    FROM carding_production_detail cpd
    WHERE cpd.header_id = v_header_id 
    AND cpd.machine_id IN (v_machine_ca11, v_machine_ca12, v_machine_ca13, v_machine_ca14);
    
    -- CA15-CA16: EXCESS STOCK (200 mins)
    INSERT INTO carding_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, total_stoppage_time)
    SELECT cpd.id, v_stoppage_excess_stock, 200, 200
    FROM carding_production_detail cpd
    WHERE cpd.header_id = v_header_id 
    AND cpd.machine_id IN (v_machine_ca15, v_machine_ca16);
    
    -- CA17: EXCESS STOCK (220 mins)
    INSERT INTO carding_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, total_stoppage_time)
    SELECT cpd.id, v_stoppage_excess_stock, 220, 220
    FROM carding_production_detail cpd
    WHERE cpd.header_id = v_header_id 
    AND cpd.machine_id = v_machine_ca17;
  END IF;
END $$;

-- ============================================
-- CREATE SAMPLE DATA FOR CURRENT DATE (Shift 1)
-- Creates production data for today with default values
-- ============================================
DO $$
DECLARE
  v_header_id UUID;
  v_supervisor_id UUID;
  v_excess_stock_id UUID;
  v_machine RECORD;
BEGIN
  -- Get supervisor
  SELECT id INTO v_supervisor_id FROM supervisors WHERE is_active = true LIMIT 1;
  
  -- Get stoppage reason
  SELECT id INTO v_excess_stock_id FROM stoppage_details WHERE stoppage_name = 'EXCESS STOCK' LIMIT 1;
  
  -- Check if entry already exists for today
  SELECT id INTO v_header_id FROM carding_production_header 
  WHERE entry_date = CURRENT_DATE AND shift = 1;
  
  IF v_header_id IS NULL THEN
    -- Create header for today
    INSERT INTO carding_production_header (entry_date, shift, supervisor_id, maisitry_id, total_time, remarks)
    VALUES (CURRENT_DATE, 1, v_supervisor_id, NULL, 510, 'Sample data for today')
    RETURNING id INTO v_header_id;
    
    -- Insert production details with sample data for each machine
    FOR v_machine IN 
      SELECT id, machine_no, prodn_mixing 
      FROM carding_machines 
      WHERE is_active = true 
      ORDER BY mc_id
    LOOP
      INSERT INTO carding_production_detail 
        (header_id, machine_id, employee_name, count_mixing, act_hank, act_prodn, 
         exp_prodn, effi_percent, uti_percent, waste, waste_percent, run_time, work_time, session_no)
      VALUES
        (v_header_id, v_machine.id, 'SANKARESWARI G', COALESCE(v_machine.prodn_mixing, '64COMBED GOLD'), 
         64.72, 225.82, 217.07, 104.03, 73.53, 0.34, 0.15, 375, 375, 1);
    END LOOP;
    
    -- Create stoppage entries for each production detail
    INSERT INTO carding_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, total_stoppage_time)
    SELECT cpd.id, v_excess_stock_id, 135, 135
    FROM carding_production_detail cpd
    WHERE cpd.header_id = v_header_id;
  END IF;
END $$;

-- ============================================
-- CARDING ENTRY VERIFICATION QUERIES
-- ============================================
-- Check carding production header
-- SELECT entry_id, TO_CHAR(entry_date, 'DD-Mon-YY') as date, shift, total_time 
-- FROM carding_production_header ORDER BY entry_date DESC;

-- Check carding production details with machine info (matches VB6 grid)
-- SELECT 
--   cm.machine_no as "Mc.No.",
--   cpd.employee_name as "Emp.Name",
--   cpd.count_mixing as "Count",
--   cpd.act_hank as "Act.Hank",
--   cpd.act_prodn as "Act.Prodn",
--   cpd.exp_prodn as "Exp.Prodn",
--   cpd.effi_percent as "Effi%",
--   cpd.uti_percent as "UTI",
--   cpd.waste as "Waste",
--   cpd.waste_percent as "Waste%",
--   cpd.run_time as "Run Time",
--   cpd.work_time as "WorkTime"
-- FROM carding_production_detail cpd
-- JOIN carding_machines cm ON cpd.machine_id = cm.id
-- JOIN carding_production_header cph ON cpd.header_id = cph.id
-- WHERE cph.entry_date = '2025-04-22' AND cph.shift = 1
-- ORDER BY cm.mc_id;

-- Check stoppage entries with reason names (matches VB6 Stoppage Entry tab)
-- SELECT 
--   cm.machine_no as "Mc.No.",
--   cpd.session_no as "Session",
--   cpd.effi_percent as "Effi",
--   cph.total_time as "Shift Time",
--   sd1.stoppage_name as "Stoppage 1",
--   cse.stoppage1_time as "S.Time 1",
--   sd2.stoppage_name as "Stoppage 2",
--   cse.stoppage2_time as "S.Time 2",
--   cse.total_stoppage_time as "Total"
-- FROM carding_stoppage_entry cse
-- JOIN carding_production_detail cpd ON cse.production_detail_id = cpd.id
-- JOIN carding_machines cm ON cpd.machine_id = cm.id
-- JOIN carding_production_header cph ON cpd.header_id = cph.id
-- LEFT JOIN stoppage_details sd1 ON cse.stoppage1_id = sd1.id
-- LEFT JOIN stoppage_details sd2 ON cse.stoppage2_id = sd2.id
-- ORDER BY cm.mc_id;

-- Expected Output for CA1 (22-Apr-2025):
-- Mc.No. | Act.Hank | Act.Prodn | Exp.Prodn | Effi% | UTI   | Stoppage | Run Time | Work Time
-- CA1    | 64.72    | 225.82    | 217.07    | 104.03| 73.53 | 135      | 375      | 375

-- ============================================
-- 21. BREAKER DRAWING PRODUCTION HEADER TABLE (Preparatory Entry)
-- One record per Date + Shift combination
-- ============================================
CREATE TABLE IF NOT EXISTS breaker_drawing_production_header (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id SERIAL,
  entry_date DATE NOT NULL,
  shift INTEGER NOT NULL CHECK (shift IN (1, 2, 3)),
  supervisor_id UUID REFERENCES supervisors(id) ON DELETE SET NULL,
  maisitry_id UUID REFERENCES supervisors(id) ON DELETE SET NULL,
  total_time INTEGER DEFAULT 510,
  remarks TEXT,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_date, shift)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bd_prod_header_date ON breaker_drawing_production_header(entry_date);
CREATE INDEX IF NOT EXISTS idx_bd_prod_header_shift ON breaker_drawing_production_header(shift);
CREATE INDEX IF NOT EXISTS idx_bd_prod_header_entry_id ON breaker_drawing_production_header(entry_id);

-- Enable RLS
ALTER TABLE breaker_drawing_production_header ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Enable read access for all users" 
ON breaker_drawing_production_header FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON breaker_drawing_production_header FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON breaker_drawing_production_header FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON breaker_drawing_production_header FOR DELETE USING (true);

-- ============================================
-- 22. BREAKER DRAWING PRODUCTION DETAIL TABLE (Preparatory Entry)
-- Grid: Mc.No., Emp.Name, Mixing, Act.Hank, Act.Prodn, Exp.Prodn, Waste, Waste%, Act.Effi, UTI, Run Time, WorkTime
-- ============================================
CREATE TABLE IF NOT EXISTS breaker_drawing_production_detail (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  header_id UUID NOT NULL REFERENCES breaker_drawing_production_header(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES drawing_breaker_machines(id) ON DELETE CASCADE,
  employee_name VARCHAR(100),
  prodn_mixing VARCHAR(100),
  act_hank DECIMAL(10,2) DEFAULT 0,
  act_prodn DECIMAL(10,2) DEFAULT 0,
  std_prodn DECIMAL(10,2) DEFAULT 0,
  exp_prodn DECIMAL(10,2) DEFAULT 0,
  effi_percent DECIMAL(10,2) DEFAULT 0,
  uti_percent DECIMAL(10,2) DEFAULT 0,
  waste DECIMAL(10,4) DEFAULT 0.85,
  waste_percent DECIMAL(10,4) DEFAULT 0,
  run_time INTEGER DEFAULT 510,
  work_time INTEGER DEFAULT 510,
  session_no INTEGER DEFAULT 1,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(header_id, machine_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bd_prod_detail_header ON breaker_drawing_production_detail(header_id);
CREATE INDEX IF NOT EXISTS idx_bd_prod_detail_machine ON breaker_drawing_production_detail(machine_id);

-- Enable RLS
ALTER TABLE breaker_drawing_production_detail ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Enable read access for all users" 
ON breaker_drawing_production_detail FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON breaker_drawing_production_detail FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON breaker_drawing_production_detail FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON breaker_drawing_production_detail FOR DELETE USING (true);

-- ============================================
-- 23. BREAKER DRAWING STOPPAGE ENTRY TABLE (Preparatory Entry)
-- Grid: Mcno, session, Effi, R.Time, Stoppage1, S.Time1, Stoppage2, S.Time2, Stoppage3, S.Time3
-- ============================================
CREATE TABLE IF NOT EXISTS breaker_drawing_stoppage_entry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  production_detail_id UUID NOT NULL REFERENCES breaker_drawing_production_detail(id) ON DELETE CASCADE,
  stoppage1_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage1_time INTEGER DEFAULT 0,
  stoppage2_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage2_time INTEGER DEFAULT 0,
  stoppage3_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage3_time INTEGER DEFAULT 0,
  stoppage4_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage4_time INTEGER DEFAULT 0,
  total_stoppage_time INTEGER DEFAULT 0,
  is_full_stoppage BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(production_detail_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_bd_stoppage_prod_detail ON breaker_drawing_stoppage_entry(production_detail_id);

-- Enable RLS
ALTER TABLE breaker_drawing_stoppage_entry ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Enable read access for all users" 
ON breaker_drawing_stoppage_entry FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON breaker_drawing_stoppage_entry FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON breaker_drawing_stoppage_entry FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON breaker_drawing_stoppage_entry FOR DELETE USING (true);

-- ============================================
-- 24. BREAKER DRAWING MACHINE SETUP TABLE (Preparatory Entry)
-- Grid: Mc.No., Make Name, Mixing, Session, Shift Time, Std.Prodn, Speed, Std.Effi, Sl.Hank, Delivery
-- KEY DIFFERENCE from Carding: Has "Delivery" field (1 or 2)
-- ============================================
CREATE TABLE IF NOT EXISTS breaker_drawing_machine_setup (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES drawing_breaker_machines(id) ON DELETE CASCADE UNIQUE,
  speed INTEGER DEFAULT 750,
  hank_constant DECIMAL(10,4) DEFAULT 0.14,
  std_efficiency_factor DECIMAL(5,4) DEFAULT 0.85,
  default_waste DECIMAL(10,4) DEFAULT 0.85,
  std_prodn DECIMAL(10,2) DEFAULT 1371.72,
  shift_time INTEGER DEFAULT 510,
  default_stoppage INTEGER DEFAULT 0,
  divisor_constant INTEGER DEFAULT 1693,
  delivery INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE breaker_drawing_machine_setup ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Enable read access for all users" 
ON breaker_drawing_machine_setup FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON breaker_drawing_machine_setup FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON breaker_drawing_machine_setup FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON breaker_drawing_machine_setup FOR DELETE USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_bd_prod_header_updated_at BEFORE UPDATE ON breaker_drawing_production_header FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bd_prod_detail_updated_at BEFORE UPDATE ON breaker_drawing_production_detail FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bd_stoppage_updated_at BEFORE UPDATE ON breaker_drawing_stoppage_entry FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bd_machine_setup_updated_at BEFORE UPDATE ON breaker_drawing_machine_setup FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- BREAKER DRAWING STOPPAGE REASONS
-- ============================================
DO $$
DECLARE
  dept_breaker_drawing UUID;
  head_others UUID;
BEGIN
  SELECT id INTO dept_breaker_drawing FROM departments WHERE dept_name = 'BREAKER DRAWING' LIMIT 1;
  SELECT id INTO head_others FROM stoppage_heads WHERE stoppage_head_name = 'OTHERS' LIMIT 1;
  
  INSERT INTO stoppage_details (code, stoppage_name, stoppage_head_id, department_id, short_code, description, is_active) VALUES
  (1510, 'EXCESS STOCK', head_others, dept_breaker_drawing, 'EWZ', 'Excess stock stoppage', true),
  (1511, 'BSS', head_others, dept_breaker_drawing, 'BN', 'BSS stoppage', true),
  (1512, 'AIR CLEANING', head_others, dept_breaker_drawing, 'AIL', 'Air cleaning work', true),
  (1513, 'COILER PROBLEM', head_others, dept_breaker_drawing, 'CLP', 'Coiler malfunction', true),
  (1514, 'SUCTION PROBLEM', head_others, dept_breaker_drawing, 'SP', 'Suction system failure', true),
  (1515, 'MATERIAL SHORTAGE', head_others, dept_breaker_drawing, 'MS', 'Material unavailable', true),
  (1516, 'DRAFTING ROLLER SERVICE', head_others, dept_breaker_drawing, 'DRS', 'Drafting roller maintenance', true)
  ON CONFLICT (stoppage_head_id, code) DO NOTHING;
END $$;

-- ============================================
-- BREAKER DRAWING MACHINE SETUP DATA
-- BD1: Speed=450, Delivery=2, Std.Prodn=1646.06
-- BD2-BD4: Speed=750, Delivery=1, Std.Prodn=1371.72
-- ============================================
INSERT INTO breaker_drawing_machine_setup (machine_id, speed, hank_constant, std_efficiency_factor, default_waste, std_prodn, shift_time, default_stoppage, divisor_constant, delivery)
SELECT 
  id as machine_id,
  CASE WHEN machine_no = 'BD1' THEN 450 ELSE 750 END as speed,
  0.14 as hank_constant,
  0.85 as std_efficiency_factor,
  0.85 as default_waste,
  CASE WHEN machine_no = 'BD1' THEN 1646.06 ELSE 1371.72 END as std_prodn,
  510 as shift_time,
  0 as default_stoppage,
  1693 as divisor_constant,
  CASE WHEN machine_no = 'BD1' THEN 2 ELSE 1 END as delivery
FROM drawing_breaker_machines
WHERE machine_no IN ('BD1', 'BD2', 'BD3', 'BD4')
ON CONFLICT (machine_id) DO NOTHING;

-- ============================================
-- BREAKER DRAWING SAMPLE DATA (22-Apr-2025, Shift 1)
-- ============================================
DO $$
DECLARE
  v_header_id UUID;
  v_supervisor_id UUID;
  v_machine_bd1 UUID;
  v_machine_bd2 UUID;
  v_machine_bd3 UUID;
  v_machine_bd4 UUID;
  v_stoppage_excess_stock UUID;
  v_stoppage_bss UUID;
  v_stoppage_air_cleaning UUID;
BEGIN
  SELECT id INTO v_supervisor_id FROM supervisors WHERE is_active = true LIMIT 1;
  
  SELECT id INTO v_stoppage_excess_stock FROM stoppage_details WHERE code = 1510 LIMIT 1;
  SELECT id INTO v_stoppage_bss FROM stoppage_details WHERE code = 1511 LIMIT 1;
  SELECT id INTO v_stoppage_air_cleaning FROM stoppage_details WHERE code = 1512 LIMIT 1;
  
  SELECT id INTO v_machine_bd1 FROM drawing_breaker_machines WHERE machine_no = 'BD1';
  SELECT id INTO v_machine_bd2 FROM drawing_breaker_machines WHERE machine_no = 'BD2';
  SELECT id INTO v_machine_bd3 FROM drawing_breaker_machines WHERE machine_no = 'BD3';
  SELECT id INTO v_machine_bd4 FROM drawing_breaker_machines WHERE machine_no = 'BD4';
  
  INSERT INTO breaker_drawing_production_header (entry_date, shift, supervisor_id, maisitry_id, total_time, remarks)
  VALUES ('2025-04-22', 1, v_supervisor_id, NULL, 510, 'Sample data from VB6')
  ON CONFLICT (entry_date, shift) DO NOTHING
  RETURNING id INTO v_header_id;
  
  IF v_header_id IS NOT NULL THEN
    -- Production details from VB6 screenshot
    INSERT INTO breaker_drawing_production_detail 
      (header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, run_time, work_time, session_no)
    VALUES
      (v_header_id, v_machine_bd1, 'MURUGESWARI. M', '64COMBED GOLD', 133.36, 864.20, 871.44, 99.17, 52.94, 0.85, 0.10, 510, 270, 1),
      (v_header_id, v_machine_bd2, 'MURUGESWARI. M', '64COMBED GOLD', 213.50, 691.77, 699.31, 98.92, 50.98, 0.85, 0.12, 510, 260, 1),
      (v_header_id, v_machine_bd3, 'MURUGESWARI. M', '64COMBED GOLD', 341.91, 1107.83, 1102.76, 100.46, 80.39, 0.85, 0.08, 510, 410, 1),
      (v_header_id, v_machine_bd4, 'GANDHIMATHI K', '64COMBED GOLD', 307.04, 994.85, 995.17, 99.97, 72.55, 0.85, 0.09, 510, 370, 1);

    -- Stoppage entries
    INSERT INTO breaker_drawing_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, total_stoppage_time)
    SELECT cpd.id, v_stoppage_excess_stock, 160, v_stoppage_bss, 60, v_stoppage_air_cleaning, 20, 240
    FROM breaker_drawing_production_detail cpd
    WHERE cpd.header_id = v_header_id AND cpd.machine_id = v_machine_bd1;
    
    INSERT INTO breaker_drawing_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, total_stoppage_time)
    SELECT cpd.id, v_stoppage_excess_stock, 170, v_stoppage_bss, 60, v_stoppage_air_cleaning, 20, 250
    FROM breaker_drawing_production_detail cpd
    WHERE cpd.header_id = v_header_id AND cpd.machine_id = v_machine_bd2;
    
    INSERT INTO breaker_drawing_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, total_stoppage_time)
    SELECT cpd.id, v_stoppage_excess_stock, 20, v_stoppage_bss, 60, v_stoppage_air_cleaning, 20, 100
    FROM breaker_drawing_production_detail cpd
    WHERE cpd.header_id = v_header_id AND cpd.machine_id = v_machine_bd3;
    
    INSERT INTO breaker_drawing_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, total_stoppage_time)
    SELECT cpd.id, v_stoppage_excess_stock, 60, v_stoppage_bss, 60, v_stoppage_air_cleaning, 20, 140
    FROM breaker_drawing_production_detail cpd
    WHERE cpd.header_id = v_header_id AND cpd.machine_id = v_machine_bd4;
  END IF;
END $$;

-- ============================================
-- BREAKER DRAWING VERIFICATION QUERIES
-- ============================================
-- Check production details (matches VB6 grid)
-- SELECT 
--   dbm.machine_no as "Mc.No.",
--   bdpd.employee_name as "Emp.Name",
--   bdpd.prodn_mixing as "Mixing",
--   bdpd.act_hank as "Act.Hank",
--   bdpd.act_prodn as "Act.Prodn",
--   bdpd.exp_prodn as "Exp.Prodn",
--   bdpd.waste as "Waste",
--   bdpd.waste_percent as "Waste%",
--   bdpd.effi_percent as "Act.Effi",
--   bdpd.uti_percent as "UTI",
--   bdpd.run_time as "Run Time",
--   bdpd.work_time as "WorkTime"
-- FROM breaker_drawing_production_detail bdpd
-- JOIN drawing_breaker_machines dbm ON bdpd.machine_id = dbm.id
-- JOIN breaker_drawing_production_header bdph ON bdpd.header_id = bdph.id
-- WHERE bdph.entry_date = '2025-04-22' AND bdph.shift = 1
-- ORDER BY dbm.mc_id;

-- Expected Output for BD1 (22-Apr-2025):
-- Mc.No. | Act.Hank | Act.Prodn | Exp.Prodn | Act.Effi | UTI   | WorkTime
-- BD1    | 133.36   | 864.20    | 871.44    | 99.17    | 52.94 | 270

-- ============================================
-- 25. LAP FORMER PRODUCTION HEADER TABLE (Preparatory Entry)
-- One record per Date + Shift combination
-- ============================================
CREATE TABLE IF NOT EXISTS lap_former_production_header (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id SERIAL,
  entry_date DATE NOT NULL,
  shift INTEGER NOT NULL CHECK (shift IN (1, 2, 3)),
  supervisor_id UUID REFERENCES supervisors(id) ON DELETE SET NULL,
  maisitry_id UUID REFERENCES supervisors(id) ON DELETE SET NULL,
  total_time INTEGER DEFAULT 510,
  remarks TEXT,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_date, shift)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lf_prod_header_date ON lap_former_production_header(entry_date);
CREATE INDEX IF NOT EXISTS idx_lf_prod_header_shift ON lap_former_production_header(shift);
CREATE INDEX IF NOT EXISTS idx_lf_prod_header_entry_id ON lap_former_production_header(entry_id);

-- Enable RLS
ALTER TABLE lap_former_production_header ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Enable read access for all users" 
ON lap_former_production_header FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON lap_former_production_header FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON lap_former_production_header FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON lap_former_production_header FOR DELETE USING (true);

-- ============================================
-- 26. LAP FORMER PRODUCTION DETAIL TABLE (Preparatory Entry)
-- Grid: Mc.No., Emp.Name, Mixing, Act.Hank, Act.Prodn, Exp.Prodn, Waste, Waste%, Act.Effi, UTI, Run Time, WorkTime
-- Key: Act.Hank & Act.Prodn come from EL Measure device, rest are calculated
-- ============================================
CREATE TABLE IF NOT EXISTS lap_former_production_detail (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  header_id UUID NOT NULL REFERENCES lap_former_production_header(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES lap_former_machines(id) ON DELETE CASCADE,
  employee_name VARCHAR(100),
  prodn_mixing VARCHAR(100),
  act_hank DECIMAL(10,2) DEFAULT 0,           -- From EL Measure device
  act_prodn DECIMAL(10,2) DEFAULT 0,          -- From EL Measure device  
  std_prodn DECIMAL(10,2) DEFAULT 0,          -- Calculated: Speed/1693/Hank × TotalTime × StdEffi × Delivery
  exp_prodn DECIMAL(10,2) DEFAULT 0,          -- Calculated: StdProdn × (RunTime/TotalTime)
  effi_percent DECIMAL(10,2) DEFAULT 0,       -- Calculated: ActProdn/ExpProdn × 100
  uti_percent DECIMAL(10,2) DEFAULT 0,        -- Calculated: RunTime/TotalTime × 100
  waste DECIMAL(10,4) DEFAULT 0.85,
  waste_percent DECIMAL(10,4) DEFAULT 0,      -- Calculated: Waste/ActProdn × 100
  run_time INTEGER DEFAULT 510,
  work_time INTEGER DEFAULT 510,              -- Calculated: TotalTime - TotalStoppage
  session_no INTEGER DEFAULT 1,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(header_id, machine_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lf_prod_detail_header ON lap_former_production_detail(header_id);
CREATE INDEX IF NOT EXISTS idx_lf_prod_detail_machine ON lap_former_production_detail(machine_id);

-- Enable RLS
ALTER TABLE lap_former_production_detail ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Enable read access for all users" 
ON lap_former_production_detail FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON lap_former_production_detail FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON lap_former_production_detail FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON lap_former_production_detail FOR DELETE USING (true);

-- ============================================
-- 27. LAP FORMER STOPPAGE ENTRY TABLE (Preparatory Entry)
-- Grid: Mcno, session, Effi, R.Time, Stoppage1, S.Time1, Stoppage2, S.Time2
-- ============================================
CREATE TABLE IF NOT EXISTS lap_former_stoppage_entry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  production_detail_id UUID NOT NULL REFERENCES lap_former_production_detail(id) ON DELETE CASCADE,
  stoppage1_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage1_time INTEGER DEFAULT 0,
  stoppage2_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage2_time INTEGER DEFAULT 0,
  stoppage3_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage3_time INTEGER DEFAULT 0,
  stoppage4_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage4_time INTEGER DEFAULT 0,
  total_stoppage_time INTEGER DEFAULT 0,
  is_full_stoppage BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(production_detail_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_lf_stoppage_prod_detail ON lap_former_stoppage_entry(production_detail_id);

-- Enable RLS
ALTER TABLE lap_former_stoppage_entry ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Enable read access for all users" 
ON lap_former_stoppage_entry FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON lap_former_stoppage_entry FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON lap_former_stoppage_entry FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON lap_former_stoppage_entry FOR DELETE USING (true);

-- ============================================
-- 28. LAP FORMER MACHINE SETUP TABLE (Preparatory Entry)
-- Grid: Mc.No., Make Name, Mixing, Session, Shift Time, Std.Prodn, Speed, Std.Effi, Sl.Hank
-- Key: Hank constant is 0.0082 (different from Breaker Drawing 0.14)
-- ============================================
CREATE TABLE IF NOT EXISTS lap_former_machine_setup (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES lap_former_machines(id) ON DELETE CASCADE UNIQUE,
  speed INTEGER DEFAULT 90,
  hank_constant DECIMAL(10,4) DEFAULT 0.0082,         -- Different from BD (0.14)
  std_efficiency_factor DECIMAL(5,4) DEFAULT 0.85,
  default_waste DECIMAL(10,4) DEFAULT 0.85,
  std_prodn DECIMAL(10,2) DEFAULT 2810.35,
  shift_time INTEGER DEFAULT 510,
  default_stoppage INTEGER DEFAULT 0,
  divisor_constant INTEGER DEFAULT 1693,
  delivery INTEGER DEFAULT 1,                          -- Always 1 for Lap Former
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE lap_former_machine_setup ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Enable read access for all users" 
ON lap_former_machine_setup FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON lap_former_machine_setup FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON lap_former_machine_setup FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON lap_former_machine_setup FOR DELETE USING (true);

-- ============================================
-- LAP FORMER TRIGGERS
-- ============================================
CREATE TRIGGER update_lf_prod_header_updated_at BEFORE UPDATE ON lap_former_production_header FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lf_prod_detail_updated_at BEFORE UPDATE ON lap_former_production_detail FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lf_stoppage_updated_at BEFORE UPDATE ON lap_former_stoppage_entry FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lf_machine_setup_updated_at BEFORE UPDATE ON lap_former_machine_setup FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- LAP FORMER SAMPLE DATA (22-Apr-2025, Shift 1)
-- Data source: VB6 screenshots
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
BEGIN
  -- Get machine IDs
  SELECT id INTO v_machine_lf1 FROM lap_former_machines WHERE machine_no = 'LF1';
  SELECT id INTO v_machine_lf2 FROM lap_former_machines WHERE machine_no = 'LF2';
  SELECT id INTO v_machine_lf3 FROM lap_former_machines WHERE machine_no = 'LF3';
  
  -- Get supervisor
  SELECT id INTO v_supervisor_id FROM supervisors WHERE supervisor_name ILIKE '%CHINNADURAI%' LIMIT 1;
  
  -- Get stoppage IDs (creating if they don't exist)
  SELECT id INTO v_stoppage_excess_stock FROM stoppage_details WHERE stoppage_name ILIKE '%EXCESS STOCK%' LIMIT 1;
  SELECT id INTO v_stoppage_spool_change FROM stoppage_details WHERE stoppage_name ILIKE '%SPOOL%' LIMIT 1;
  SELECT id INTO v_stoppage_erector_work FROM stoppage_details WHERE stoppage_name ILIKE '%ERECTOR%' LIMIT 1;
  
  -- Only proceed if machines exist
  IF v_machine_lf1 IS NOT NULL AND v_machine_lf2 IS NOT NULL AND v_machine_lf3 IS NOT NULL THEN
    -- Insert Machine Setup Data
    INSERT INTO lap_former_machine_setup (machine_id, speed, hank_constant, std_efficiency_factor, default_waste, std_prodn, shift_time, divisor_constant, delivery)
    VALUES 
      (v_machine_lf1, 120, 0.0082, 0.85, 0.85, 3747.14, 510, 1693, 1),
      (v_machine_lf2, 90, 0.0082, 0.85, 0.85, 2810.35, 510, 1693, 1),
      (v_machine_lf3, 90, 0.0082, 0.85, 0.85, 2810.35, 510, 1693, 1)
    ON CONFLICT (machine_id) DO UPDATE SET
      speed = EXCLUDED.speed,
      hank_constant = EXCLUDED.hank_constant,
      std_prodn = EXCLUDED.std_prodn;
    
    -- Create production header for 22-Apr-2025
    INSERT INTO lap_former_production_header (entry_date, shift, supervisor_id, total_time, remarks)
    VALUES ('2025-04-22', 1, v_supervisor_id, 510, 'VB6 Sample Data - Lap Former')
    ON CONFLICT (entry_date, shift) DO NOTHING
    RETURNING id INTO v_header_id;
    
    IF v_header_id IS NOT NULL THEN
      -- Insert Production Details (Act.Hank & Act.Prodn from EL Measure, rest calculated)
      -- LF1: Speed=120, StdProdn=3747.14, Stoppage=300, WorkTime=210
      INSERT INTO lap_former_production_detail (header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, run_time, work_time, session_no)
      VALUES (v_header_id, v_machine_lf1, 'MURUGESWARI. M', '64COMBED GOLD', 28.36, 1568.85, 3747.14, 1542.94, 101.68, 41.18, 0.85, 0.05, 510, 210, 1);
      
      -- LF2: Speed=90, StdProdn=2810.35, Stoppage=335, WorkTime=175
      INSERT INTO lap_former_production_detail (header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, run_time, work_time, session_no)
      VALUES (v_header_id, v_machine_lf2, 'MURUGESWARI. M', '64COMBED GOLD', 17.14, 948.17, 2810.35, 964.34, 98.32, 34.31, 0.85, 0.09, 510, 175, 1);
      
      -- LF3: Speed=90, StdProdn=2810.35, Stoppage=270, WorkTime=240
      INSERT INTO lap_former_production_detail (header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, run_time, work_time, session_no)
      VALUES (v_header_id, v_machine_lf3, 'GANDHIMATHI K', '64COMBED GOLD', 24.04, 1329.87, 2810.35, 1322.52, 100.56, 47.06, 0.85, 0.06, 510, 240, 1);
      
      -- Insert Stoppage Entries
      -- LF1: Excess Stock (180) + Spool Change (120) = 300
      INSERT INTO lap_former_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, total_stoppage_time)
      SELECT lfpd.id, v_stoppage_excess_stock, 180, v_stoppage_spool_change, 120, 300
      FROM lap_former_production_detail lfpd
      WHERE lfpd.header_id = v_header_id AND lfpd.machine_id = v_machine_lf1;
      
      -- LF2: Excess Stock (245) + Erector Work (90) = 335
      INSERT INTO lap_former_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, total_stoppage_time)
      SELECT lfpd.id, v_stoppage_excess_stock, 245, v_stoppage_erector_work, 90, 335
      FROM lap_former_production_detail lfpd
      WHERE lfpd.header_id = v_header_id AND lfpd.machine_id = v_machine_lf2;
      
      -- LF3: Excess Stock (270) only = 270
      INSERT INTO lap_former_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, total_stoppage_time)
      SELECT lfpd.id, v_stoppage_excess_stock, 270, 270
      FROM lap_former_production_detail lfpd
      WHERE lfpd.header_id = v_header_id AND lfpd.machine_id = v_machine_lf3;
    END IF;
  END IF;
END $$;

-- ============================================
-- LAP FORMER VERIFICATION QUERIES
-- ============================================
-- Check production details (matches VB6 grid)
-- SELECT 
--   lfm.machine_no as "Mc.No.",
--   lfpd.employee_name as "Emp.Name",
--   lfpd.prodn_mixing as "Mixing",
--   lfpd.act_hank as "Act.Hank",
--   lfpd.act_prodn as "Act.Prodn",
--   lfpd.exp_prodn as "Exp.Prodn",
--   lfpd.waste as "Waste",
--   lfpd.waste_percent as "Waste%",
--   lfpd.effi_percent as "Act.Effi",
--   lfpd.uti_percent as "UTI",
--   lfpd.run_time as "Run Time",
--   lfpd.work_time as "WorkTime"
-- FROM lap_former_production_detail lfpd
-- JOIN lap_former_machines lfm ON lfpd.machine_id = lfm.id
-- JOIN lap_former_production_header lfph ON lfpd.header_id = lfph.id
-- WHERE lfph.entry_date = '2025-04-22' AND lfph.shift = 1
-- ORDER BY lfm.mc_id;

-- Expected Output for LF1 (22-Apr-2025):
-- Mc.No. | Act.Hank | Act.Prodn | Exp.Prodn | Act.Effi | UTI   | WorkTime
-- LF1    | 28.36    | 1568.85   | 1542.94   | 101.68   | 41.18 | 210

SELECT 'Supabase Setup Complete - All Tables Created and Sample Data Inserted' as status;
