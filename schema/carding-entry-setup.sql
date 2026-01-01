-- ============================================
-- CARDING ENTRY MODULE - Complete Database Setup
-- Preparatory Entry > Carding Entry
-- ============================================
-- Tables:
-- 1. carding_production_header - Main header (Date, Shift, Supervisor, Maisitry)
-- 2. carding_production_detail - Per machine production data
-- 3. carding_stoppage_entry - Machine stoppage tracking
-- 4. carding_machine_setup - Machine configuration for calculations
-- ============================================

-- ============================================
-- 1. CARDING PRODUCTION HEADER TABLE
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

-- ============================================
-- 2. CARDING PRODUCTION DETAIL TABLE
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

-- ============================================
-- 3. CARDING STOPPAGE ENTRY TABLE
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

-- ============================================
-- 4. CARDING MACHINE SETUP TABLE
-- Machine configuration used for calculations
-- Links to carding_machines with additional calculation parameters
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

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE carding_production_header ENABLE ROW LEVEL SECURITY;
ALTER TABLE carding_production_detail ENABLE ROW LEVEL SECURITY;
ALTER TABLE carding_stoppage_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE carding_machine_setup ENABLE ROW LEVEL SECURITY;

-- RLS Policies for carding_production_header
CREATE POLICY "Enable read access for all users" 
ON carding_production_header FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON carding_production_header FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON carding_production_header FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON carding_production_header FOR DELETE USING (true);

-- RLS Policies for carding_production_detail
CREATE POLICY "Enable read access for all users" 
ON carding_production_detail FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON carding_production_detail FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON carding_production_detail FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON carding_production_detail FOR DELETE USING (true);

-- RLS Policies for carding_stoppage_entry
CREATE POLICY "Enable read access for all users" 
ON carding_stoppage_entry FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON carding_stoppage_entry FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON carding_stoppage_entry FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON carding_stoppage_entry FOR DELETE USING (true);

-- RLS Policies for carding_machine_setup
CREATE POLICY "Enable read access for all users" 
ON carding_machine_setup FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON carding_machine_setup FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON carding_machine_setup FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON carding_machine_setup FOR DELETE USING (true);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================
CREATE TRIGGER update_carding_prod_header_updated_at 
  BEFORE UPDATE ON carding_production_header 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_carding_prod_detail_updated_at 
  BEFORE UPDATE ON carding_production_detail 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_carding_stoppage_updated_at 
  BEFORE UPDATE ON carding_stoppage_entry 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_carding_machine_setup_updated_at 
  BEFORE UPDATE ON carding_machine_setup 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INSERT MACHINE SETUP DATA (Default calculation constants)
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
-- INSERT SAMPLE PRODUCTION DATA (From Screenshot - 22-Apr-2025, Shift 1)
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
  dept_carding UUID;
  head_others UUID;
BEGIN
  -- Get supervisor (HARIHARAN AGT doesn't exist, use first available)
  SELECT id INTO v_supervisor_id FROM supervisors WHERE is_active = true LIMIT 1;
  
  -- Get department and head IDs for stoppage reasons
  SELECT id INTO dept_carding FROM departments WHERE dept_name = 'CARDING' LIMIT 1;
  SELECT id INTO head_others FROM stoppage_heads WHERE stoppage_head_name = 'OTHERS' LIMIT 1;
  
  -- Insert carding-specific stoppages FIRST (before inserting sample data)
  INSERT INTO stoppage_details (code, stoppage_name, stoppage_head_id, department_id, short_code, description, is_active) VALUES
  (1500, 'EXCESS STOCK', head_others, dept_carding, 'EXS', 'Excess stock stoppage', true),
  (1501, 'DAILY CLEANING', head_others, dept_carding, 'DC', 'Daily cleaning work', true),
  (1502, 'GEAR BOX WORK', head_others, dept_carding, 'GEW', 'Gear box maintenance', true),
  (1503, 'CARD CLOTHING CHANGE', head_others, dept_carding, 'CCC', 'Card clothing replacement', true),
  (1504, 'COILER PROBLEM', head_others, dept_carding, 'CLP', 'Coiler malfunction', true),
  (1505, 'DOFFER PROBLEM', head_others, dept_carding, 'DFP', 'Doffer issue', true),
  (1506, 'MATERIAL SHORTAGE', head_others, dept_carding, 'MS', 'Material unavailable', true)
  ON CONFLICT (stoppage_head_id, code) DO NOTHING;
  
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
  RETURNING id INTO v_header_id;
  
  -- Insert production details from screenshot
  -- Formula Reference:
  -- Run Time = Total Time − Stoppage Time (510 - 135 = 375)
  -- Std Prodn = (Speed / 1693 / 0.13) × Run Time × 0.98
  -- Exp Prodn = Std Prodn / Total Time × Run Time
  -- Effi% = Act Prodn / Exp Prodn × 100
  -- UTI = Run Time / Total Time × 100
  -- Waste% = Waste / Act Prodn × 100
  
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
  INSERT INTO carding_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_time, stoppage3_time, stoppage4_time, total_stoppage_time)
  SELECT 
    cpd.id,
    v_stoppage_excess_stock,
    135 as stoppage1_time,
    0 as stoppage2_time,
    0 as stoppage3_time,
    0 as stoppage4_time,
    135 as total_stoppage_time
  FROM carding_production_detail cpd
  WHERE cpd.header_id = v_header_id
  AND cpd.machine_id IN (v_machine_ca1, v_machine_ca2, v_machine_ca3, v_machine_ca4, v_machine_ca5, v_machine_ca6, v_machine_ca7, v_machine_ca9, v_machine_ca10);
  
  -- CA8: EXCESS STOCK (135) + GEAR BOX WORK (300) = 435 mins
  INSERT INTO carding_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, total_stoppage_time)
  SELECT 
    cpd.id,
    v_stoppage_excess_stock,
    135 as stoppage1_time,
    v_stoppage_gear_box,
    300 as stoppage2_time,
    435 as total_stoppage_time
  FROM carding_production_detail cpd
  WHERE cpd.header_id = v_header_id AND cpd.machine_id = v_machine_ca8;
  
  -- CA11-CA14: DAILY CLEANING (150 mins)
  INSERT INTO carding_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, total_stoppage_time)
  SELECT 
    cpd.id,
    v_stoppage_daily_cleaning,
    150 as stoppage1_time,
    150 as total_stoppage_time
  FROM carding_production_detail cpd
  WHERE cpd.header_id = v_header_id 
  AND cpd.machine_id IN (v_machine_ca11, v_machine_ca12, v_machine_ca13, v_machine_ca14);
  
  -- CA15-CA16: EXCESS STOCK (200 mins)
  INSERT INTO carding_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, total_stoppage_time)
  SELECT 
    cpd.id,
    v_stoppage_excess_stock,
    200 as stoppage1_time,
    200 as total_stoppage_time
  FROM carding_production_detail cpd
  WHERE cpd.header_id = v_header_id 
  AND cpd.machine_id IN (v_machine_ca15, v_machine_ca16);
  
  -- CA17: EXCESS STOCK (220 mins)
  INSERT INTO carding_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, total_stoppage_time)
  SELECT 
    cpd.id,
    v_stoppage_excess_stock,
    220 as stoppage1_time,
    220 as total_stoppage_time
  FROM carding_production_detail cpd
  WHERE cpd.header_id = v_header_id 
  AND cpd.machine_id = v_machine_ca17;

END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Check header data
-- SELECT entry_id, TO_CHAR(entry_date, 'DD-Mon-YY') as date, shift, total_time 
-- FROM carding_production_header ORDER BY entry_date DESC;

-- Check production details with machine info
-- SELECT 
--   cm.machine_no,
--   cpd.employee_name,
--   cpd.count_mixing,
--   cpd.act_hank,
--   cpd.act_prodn,
--   cpd.exp_prodn,
--   cpd.effi_percent,
--   cpd.uti_percent,
--   cpd.waste,
--   cpd.waste_percent,
--   cpd.run_time,
--   cpd.work_time
-- FROM carding_production_detail cpd
-- JOIN carding_machines cm ON cpd.machine_id = cm.id
-- JOIN carding_production_header cph ON cpd.header_id = cph.id
-- WHERE cph.entry_date = '2025-04-22' AND cph.shift = 1
-- ORDER BY cm.machine_no;

-- Check stoppage entries
-- SELECT 
--   cm.machine_no,
--   cse.stoppage1_time,
--   cse.stoppage2_time,
--   cse.total_stoppage_time
-- FROM carding_stoppage_entry cse
-- JOIN carding_production_detail cpd ON cse.production_detail_id = cpd.id
-- JOIN carding_machines cm ON cpd.machine_id = cm.id
-- ORDER BY cm.machine_no;

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
    
    RAISE NOTICE 'Created sample data for today (%) with header_id: %', CURRENT_DATE, v_header_id;
  ELSE
    RAISE NOTICE 'Entry already exists for today (%) with header_id: %', CURRENT_DATE, v_header_id;
  END IF;
END $$;

SELECT 'Carding Entry Setup Complete' as status;