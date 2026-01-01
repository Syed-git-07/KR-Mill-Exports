-- ============================================
-- COMBER ENTRY MODULE - Complete Database Setup
-- Preparatory Entry > Comber Entry
-- Created: 30-Dec-2025
-- ============================================
-- Tables:
-- 1. comber_production_header - Main header (Date, Shift, Supervisor, Maisitry)
-- 2. comber_production_detail - Per machine production data (with RunHrs HH.MM input)
-- 3. comber_stoppage_entry - Machine stoppage tracking (4 slots)
-- 4. comber_machine_setup - Machine configuration for calculations
-- ============================================
-- Note: Comber machines table (comber_machines) already exists from Module 12
-- ============================================

-- ============================================
-- 1. COMBER PRODUCTION HEADER TABLE
-- One record per Date + Shift combination
-- VB6 Fields: Date, Shift, Supervisor, Maisitry
-- ============================================
CREATE TABLE IF NOT EXISTS comber_production_header (
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
CREATE INDEX IF NOT EXISTS idx_comber_prod_header_date ON comber_production_header(entry_date);
CREATE INDEX IF NOT EXISTS idx_comber_prod_header_shift ON comber_production_header(shift);
CREATE INDEX IF NOT EXISTS idx_comber_prod_header_entry_id ON comber_production_header(entry_id);
CREATE INDEX IF NOT EXISTS idx_comber_header_date_shift ON comber_production_header(entry_date DESC, shift);

-- ============================================
-- 2. COMBER PRODUCTION DETAIL TABLE
-- One record per machine per shift
-- VB6 Grid: Mc.No., EmpName, Count, Act.Hank, RunHrs, RunMin, Waste, Act.Prodn, Waste%, Act.Effi, Uti, Std.hrs, WorkTime
-- UNIQUE: RunHrs is manual input in HH.MM format (e.g., 5.58 = 5hr 58min)
-- ============================================
CREATE TABLE IF NOT EXISTS comber_production_detail (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  header_id UUID NOT NULL REFERENCES comber_production_header(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES comber_machines(id) ON DELETE CASCADE,
  
  -- Employee (from VB6 dropdown)
  employee_name VARCHAR(100),
  
  -- Count/Mixing (from machine setup)
  prodn_mixing VARCHAR(100),  -- e.g., '64COMBED GOLD'
  
  -- Machine Inputs
  act_hank DECIMAL(10,2) DEFAULT 0,       -- Actual Hank reading (manual input)
  run_hrs DECIMAL(5,2) DEFAULT 0,         -- Run Hours in HH.MM format (e.g., 5.58)
  run_min INTEGER DEFAULT 0,              -- Calculated: Hours×60 + (Decimal×100)
  waste DECIMAL(10,4) DEFAULT 0.96,       -- Waste (kg) - default 0.96
  
  -- Calculated Fields
  act_prodn DECIMAL(10,2) DEFAULT 0,      -- Actual Production = Act.Hank × Constant (3.240)
  waste_percent DECIMAL(10,4) DEFAULT 0,  -- Waste % = (Waste / Act.Prodn) × 100
  act_effi_percent DECIMAL(10,2) DEFAULT 0, -- Act Efficiency % = (RunMin / Std.hrs) × 100
  uti_percent DECIMAL(10,2) DEFAULT 0,    -- Utilization % = (WorkTime / TotalTime) × 100
  std_hrs DECIMAL(10,2) DEFAULT 0,        -- Standard Hours = WorkTime × (MCEffi/100)
  work_time INTEGER DEFAULT 510,          -- Work Time = Total Time - Total Stoppage
  
  -- Session tracking
  session_no INTEGER DEFAULT 1,
  
  -- Status
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  is_locked BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(header_id, machine_id)  -- One entry per machine per header
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comber_prod_detail_header ON comber_production_detail(header_id);
CREATE INDEX IF NOT EXISTS idx_comber_prod_detail_machine ON comber_production_detail(machine_id);

-- ============================================
-- 3. COMBER STOPPAGE ENTRY TABLE
-- Multiple stoppages per machine (up to 4 in VB6)
-- VB6 Grid: Mcno, session, ActEffi, R.Time, Stoppage1, S.Time1, Stoppage2, S.Time2...
-- ============================================
CREATE TABLE IF NOT EXISTS comber_stoppage_entry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  production_detail_id UUID NOT NULL REFERENCES comber_production_detail(id) ON DELETE CASCADE,
  
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
CREATE INDEX IF NOT EXISTS idx_comber_stoppage_prod_detail ON comber_stoppage_entry(production_detail_id);

-- ============================================
-- 4. COMBER MACHINE SETUP TABLE
-- Machine configuration used for calculations
-- Links to comber_machines with additional calculation parameters
-- VB6 Grid: Mc. No., Count, Session, C.C. Time, Sl.Hank, MCEffi
-- ============================================
CREATE TABLE IF NOT EXISTS comber_machine_setup (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES comber_machines(id) ON DELETE CASCADE UNIQUE,
  
  -- Calculation Constants (from VB6 Machine Setup screenshot)
  prodn_mixing VARCHAR(100),              -- Count/Mixing selection (e.g., '64COMBED GOLD')
  session_no INTEGER DEFAULT 1,           -- Session number
  cc_time INTEGER DEFAULT 0,              -- Can Change Time (C.C. Time)
  sl_hank DECIMAL(10,4) DEFAULT 0.14,     -- Sliver Hank
  mc_effi INTEGER DEFAULT 93,             -- Machine Efficiency % (93%)
  
  -- Additional calculation constants
  shift_time INTEGER DEFAULT 510,         -- Default shift time (minutes)
  default_waste DECIMAL(10,4) DEFAULT 0.96, -- Default Waste (kg)
  constant DECIMAL(10,4) DEFAULT 3.240,   -- Constant = 1 / 2.20456 / Hank
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE comber_production_header ENABLE ROW LEVEL SECURITY;
ALTER TABLE comber_production_detail ENABLE ROW LEVEL SECURITY;
ALTER TABLE comber_stoppage_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE comber_machine_setup ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comber_production_header
CREATE POLICY "Enable read access for all users" 
ON comber_production_header FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON comber_production_header FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON comber_production_header FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON comber_production_header FOR DELETE USING (true);

-- RLS Policies for comber_production_detail
CREATE POLICY "Enable read access for all users" 
ON comber_production_detail FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON comber_production_detail FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON comber_production_detail FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON comber_production_detail FOR DELETE USING (true);

-- RLS Policies for comber_stoppage_entry
CREATE POLICY "Enable read access for all users" 
ON comber_stoppage_entry FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON comber_stoppage_entry FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON comber_stoppage_entry FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON comber_stoppage_entry FOR DELETE USING (true);

-- RLS Policies for comber_machine_setup
CREATE POLICY "Enable read access for all users" 
ON comber_machine_setup FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON comber_machine_setup FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON comber_machine_setup FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON comber_machine_setup FOR DELETE USING (true);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================
CREATE TRIGGER update_comber_prod_header_updated_at 
  BEFORE UPDATE ON comber_production_header 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comber_prod_detail_updated_at 
  BEFORE UPDATE ON comber_production_detail 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comber_stoppage_updated_at 
  BEFORE UPDATE ON comber_stoppage_entry 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comber_machine_setup_updated_at 
  BEFORE UPDATE ON comber_machine_setup 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INSERT COMBER-SPECIFIC STOPPAGE REASONS
-- ============================================
DO $$
DECLARE
  dept_comber UUID;
  head_others UUID;
BEGIN
  -- Get department ID (or create if not exists)
  SELECT id INTO dept_comber FROM departments WHERE dept_name = 'COMBER' LIMIT 1;
  IF dept_comber IS NULL THEN
    SELECT id INTO dept_comber FROM departments WHERE dept_name = 'PREPARATORY' LIMIT 1;
  END IF;
  
  -- Get stoppage head
  SELECT id INTO head_others FROM stoppage_heads WHERE stoppage_head_name = 'OTHERS' LIMIT 1;
  
  -- Insert comber-specific stoppages
  INSERT INTO stoppage_details (code, stoppage_name, stoppage_head_id, department_id, short_code, description, is_active) VALUES
  (1201, 'NIPPER CLEANING', head_others, dept_comber, 'NI', 'Nipper cleaning stoppage', true),
  (1202, 'COTS CLEANING', head_others, dept_comber, 'COT', 'Cots cleaning stoppage', true),
  (1203, 'VXL CLEANING', head_others, dept_comber, 'VXL', 'VXL cleaning stoppage', true),
  (1204, 'TOP COMB CLEANING', head_others, dept_comber, 'TCC', 'Top comb cleaning', true),
  (1205, 'NOIL DRUM CLEANING', head_others, dept_comber, 'NDC', 'Noil drum cleaning', true),
  (1206, 'LAP BREAKAGE', head_others, dept_comber, 'LB', 'Lap breakage stoppage', true),
  (1207, 'SLIVER BREAKAGE', head_others, dept_comber, 'SB', 'Sliver breakage', true),
  (1208, 'MECHANICAL FAULT', head_others, dept_comber, 'MF', 'Mechanical fault', true),
  (1209, 'ELECTRICAL FAULT', head_others, dept_comber, 'EF', 'Electrical fault', true),
  (1210, 'NO LAP', head_others, dept_comber, 'NL', 'No lap available', true)
  ON CONFLICT (stoppage_head_id, code) DO NOTHING;
END $$;

-- ============================================
-- INSERT MACHINE SETUP DATA (Default calculation constants)
-- For machines CO1-CO12
-- ============================================
INSERT INTO comber_machine_setup (machine_id, prodn_mixing, session_no, cc_time, sl_hank, mc_effi, shift_time, default_waste, constant)
SELECT 
  id as machine_id,
  '64COMBED GOLD' as prodn_mixing,
  1 as session_no,
  0 as cc_time,
  0.14 as sl_hank,
  93 as mc_effi,
  510 as shift_time,
  0.96 as default_waste,
  3.240 as constant  -- 1 / 2.20456 / 0.14 ≈ 3.240
FROM comber_machines
ON CONFLICT (machine_id) DO NOTHING;

-- ============================================
-- INSERT SAMPLE PRODUCTION DATA (30-Dec-2025, Shift 1)
-- Based on VB6 screenshot and formula analysis
-- ============================================
-- Formula Reference:
-- RunMin = Hours×60 + (Decimal×100)  e.g., 5.58 → (5×60) + 58 = 358
-- WorkTime = TotalTime - TotalStoppage  e.g., 510 - 90 = 420
-- Uti% = (WorkTime / TotalTime) × 100  e.g., (420/510)×100 = 82.35%
-- Std.hrs = WorkTime × (MCEffi/100)  e.g., 420 × 0.93 = 390.6
-- Act.Prodn = Act.Hank × Constant  e.g., 71.56 × 3.24 = 231.86
-- Waste% = (Waste / Act.Prodn) × 100
-- Act.Effi% = (RunMin / Std.hrs) × 100  e.g., (358/390.6)×100 = 91.65%
-- ============================================
DO $$
DECLARE
  v_header_id UUID;
  v_supervisor_id UUID;
  v_machine_co1 UUID;
  v_machine_co2 UUID;
  v_machine_co3 UUID;
  v_machine_co4 UUID;
  v_machine_co5 UUID;
  v_machine_co6 UUID;
  v_machine_co7 UUID;
  v_machine_co8 UUID;
  v_machine_co9 UUID;
  v_machine_co10 UUID;
  v_machine_co11 UUID;
  v_machine_co12 UUID;
  v_stoppage_nipper UUID;
  v_stoppage_cots UUID;
  v_stoppage_vxl UUID;
BEGIN
  -- Get supervisor (HARIHARAN AGT or first available)
  SELECT id INTO v_supervisor_id FROM supervisors WHERE is_active = true LIMIT 1;
  
  -- Get stoppage reason IDs
  SELECT id INTO v_stoppage_nipper FROM stoppage_details WHERE stoppage_name = 'NIPPER CLEANING' LIMIT 1;
  SELECT id INTO v_stoppage_cots FROM stoppage_details WHERE stoppage_name = 'COTS CLEANING' LIMIT 1;
  SELECT id INTO v_stoppage_vxl FROM stoppage_details WHERE stoppage_name = 'VXL CLEANING' LIMIT 1;
  
  -- Get machine IDs
  SELECT id INTO v_machine_co1 FROM comber_machines WHERE machine_no = 'CO1';
  SELECT id INTO v_machine_co2 FROM comber_machines WHERE machine_no = 'CO2';
  SELECT id INTO v_machine_co3 FROM comber_machines WHERE machine_no = 'CO3';
  SELECT id INTO v_machine_co4 FROM comber_machines WHERE machine_no = 'CO4';
  SELECT id INTO v_machine_co5 FROM comber_machines WHERE machine_no = 'CO5';
  SELECT id INTO v_machine_co6 FROM comber_machines WHERE machine_no = 'CO6';
  SELECT id INTO v_machine_co7 FROM comber_machines WHERE machine_no = 'CO7';
  SELECT id INTO v_machine_co8 FROM comber_machines WHERE machine_no = 'CO8';
  SELECT id INTO v_machine_co9 FROM comber_machines WHERE machine_no = 'CO9';
  SELECT id INTO v_machine_co10 FROM comber_machines WHERE machine_no = 'CO10';
  SELECT id INTO v_machine_co11 FROM comber_machines WHERE machine_no = 'CO11';
  SELECT id INTO v_machine_co12 FROM comber_machines WHERE machine_no = 'CO12';
  
  -- Create header for 30-Dec-2025, Shift 1
  INSERT INTO comber_production_header (entry_date, shift, supervisor_id, maisitry_id, total_time, remarks)
  VALUES ('2025-12-30', 1, v_supervisor_id, NULL, 510, 'Sample data from VB6 screenshot - 30-Dec-25')
  RETURNING id INTO v_header_id;
  
  -- Insert production details from screenshot
  -- CO1: RunHrs=1.56 → RunMin=116, Stoppage=360, WorkTime=150, Std.hrs=139.5
  INSERT INTO comber_production_detail 
    (header_id, machine_id, employee_name, prodn_mixing, act_hank, run_hrs, run_min, waste, act_prodn, waste_percent, act_effi_percent, uti_percent, std_hrs, work_time, session_no)
  VALUES
    (v_header_id, v_machine_co1, 'PAVITHRA P', '64COMBED GOLD', 21.61, 1.56, 116, 0.96, 70.02, 1.37, 83.15, 29.41, 139.5, 150, 1),
    -- CO2: RunHrs=5.58 → RunMin=358, Stoppage=90, WorkTime=420, Std.hrs=390.6
    (v_header_id, v_machine_co2, 'PAVITHRA P', '64COMBED GOLD', 71.56, 5.58, 358, 0.41, 231.86, 0.18, 91.65, 82.35, 390.6, 420, 1),
    -- CO3: RunHrs=5.24 → RunMin=324, Stoppage=120, WorkTime=390, Std.hrs=362.7
    (v_header_id, v_machine_co3, 'PAVITHRA P', '64COMBED GOLD', 59.45, 5.24, 324, 0.96, 192.63, 0.50, 89.33, 76.47, 362.7, 390, 1),
    -- CO4: RunHrs=4.41 → RunMin=281, Stoppage=180, WorkTime=330, Std.hrs=306.9
    (v_header_id, v_machine_co4, 'MUTHULAKSHMI K', '64COMBED GOLD', 51.14, 4.41, 281, 0.97, 165.70, 0.59, 91.56, 64.71, 306.9, 330, 1),
    -- CO5: RunHrs=6.01 → RunMin=361, Stoppage=90, WorkTime=420, Std.hrs=390.6
    (v_header_id, v_machine_co5, 'MUTHULAKSHMI K', '64COMBED GOLD', 61.26, 6.01, 361, 0.97, 198.49, 0.49, 92.42, 82.35, 390.6, 420, 1),
    -- CO6: RunHrs=6.07 → RunMin=367, Stoppage=100, WorkTime=410, Std.hrs=381.3
    (v_header_id, v_machine_co6, 'MUTHULAKSHMI K', '64COMBED GOLD', 87.34, 6.07, 367, 0.97, 282.99, 0.34, 96.25, 80.39, 381.3, 410, 1),
    -- CO7: RunHrs=5.46 → RunMin=346, Stoppage=90, WorkTime=420, Std.hrs=390.6
    (v_header_id, v_machine_co7, 'MUTHULAKSHMI K', '64COMBED GOLD', 70.10, 5.46, 346, 0.97, 227.13, 0.43, 88.58, 82.35, 390.6, 420, 1),
    -- CO8: RunHrs=6.31 → RunMin=391, Stoppage=90, WorkTime=420, Std.hrs=390.6
    (v_header_id, v_machine_co8, 'MUTHULAKSHMI K', '64COMBED GOLD', 83.62, 6.31, 391, 0.97, 270.94, 0.36, 100.10, 82.35, 390.6, 420, 1),
    -- CO9: RunHrs=5.54 → RunMin=354, Stoppage=90, WorkTime=420, Std.hrs=390.6
    (v_header_id, v_machine_co9, 'MUTHULAKSHMI K', '64COMBED GOLD', 61.35, 5.54, 354, 0.97, 198.78, 0.49, 90.63, 82.35, 390.6, 420, 1),
    -- CO10: RunHrs=5.55 → RunMin=355, Stoppage=130, WorkTime=380, Std.hrs=353.4
    (v_header_id, v_machine_co10, 'PAVITHRA P', '64COMBED GOLD', 59.92, 5.55, 355, 0.96, 194.15, 0.49, 100.45, 74.51, 353.4, 380, 1),
    -- CO11: RunHrs=6.45 → RunMin=405, Stoppage=90, WorkTime=420, Std.hrs=390.6
    (v_header_id, v_machine_co11, 'PAVITHRA P', '64COMBED GOLD', 88.67, 6.45, 405, 0.96, 287.30, 0.33, 103.69, 82.35, 390.6, 420, 1),
    -- CO12: RunHrs=6.48 → RunMin=408, Stoppage=90, WorkTime=420, Std.hrs=390.6
    (v_header_id, v_machine_co12, 'PAVITHRA P', '64COMBED GOLD', 90.03, 6.48, 408, 0.96, 291.71, 0.33, 104.45, 82.35, 390.6, 420, 1);

  -- Insert Stoppage Entries
  -- CO1: NIPPER(15) + COTS(15) + VXL(330) = 360 mins
  INSERT INTO comber_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, total_stoppage_time)
  SELECT cpd.id, v_stoppage_nipper, 15, v_stoppage_cots, 15, v_stoppage_vxl, 330, 360
  FROM comber_production_detail cpd
  WHERE cpd.header_id = v_header_id AND cpd.machine_id = v_machine_co1;
  
  -- CO2: NIPPER(15) + COTS(15) + VXL(60) = 90 mins
  INSERT INTO comber_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, total_stoppage_time)
  SELECT cpd.id, v_stoppage_nipper, 15, v_stoppage_cots, 15, v_stoppage_vxl, 60, 90
  FROM comber_production_detail cpd
  WHERE cpd.header_id = v_header_id AND cpd.machine_id = v_machine_co2;
  
  -- CO3: NIPPER(15) + COTS(15) + VXL(90) = 120 mins
  INSERT INTO comber_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, total_stoppage_time)
  SELECT cpd.id, v_stoppage_nipper, 15, v_stoppage_cots, 15, v_stoppage_vxl, 90, 120
  FROM comber_production_detail cpd
  WHERE cpd.header_id = v_header_id AND cpd.machine_id = v_machine_co3;
  
  -- CO4: NIPPER(15) + COTS(15) + VXL(150) = 180 mins
  INSERT INTO comber_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, total_stoppage_time)
  SELECT cpd.id, v_stoppage_nipper, 15, v_stoppage_cots, 15, v_stoppage_vxl, 150, 180
  FROM comber_production_detail cpd
  WHERE cpd.header_id = v_header_id AND cpd.machine_id = v_machine_co4;
  
  -- CO5, CO7, CO8, CO9, CO11, CO12: NIPPER(15) + COTS(15) + VXL(60) = 90 mins
  INSERT INTO comber_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, total_stoppage_time)
  SELECT cpd.id, v_stoppage_nipper, 15, v_stoppage_cots, 15, v_stoppage_vxl, 60, 90
  FROM comber_production_detail cpd
  WHERE cpd.header_id = v_header_id 
  AND cpd.machine_id IN (v_machine_co5, v_machine_co7, v_machine_co8, v_machine_co9, v_machine_co11, v_machine_co12);
  
  -- CO6: NIPPER(15) + COTS(15) + VXL(70) = 100 mins
  INSERT INTO comber_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, total_stoppage_time)
  SELECT cpd.id, v_stoppage_nipper, 15, v_stoppage_cots, 15, v_stoppage_vxl, 70, 100
  FROM comber_production_detail cpd
  WHERE cpd.header_id = v_header_id AND cpd.machine_id = v_machine_co6;
  
  -- CO10: NIPPER(15) + COTS(15) + VXL(100) = 130 mins
  INSERT INTO comber_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, total_stoppage_time)
  SELECT cpd.id, v_stoppage_nipper, 15, v_stoppage_cots, 15, v_stoppage_vxl, 100, 130
  FROM comber_production_detail cpd
  WHERE cpd.header_id = v_header_id AND cpd.machine_id = v_machine_co10;

  RAISE NOTICE 'Created sample data for 30-Dec-2025, Shift 1 with header_id: %', v_header_id;
END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Check header data
-- SELECT entry_id, TO_CHAR(entry_date, 'DD-Mon-YY') as date, shift, total_time 
-- FROM comber_production_header ORDER BY entry_date DESC;

-- Check production details with machine info
-- SELECT 
--   cm.machine_no,
--   cpd.employee_name,
--   cpd.prodn_mixing,
--   cpd.act_hank,
--   cpd.run_hrs,
--   cpd.run_min,
--   cpd.waste,
--   cpd.act_prodn,
--   cpd.waste_percent,
--   cpd.act_effi_percent,
--   cpd.uti_percent,
--   cpd.std_hrs,
--   cpd.work_time
-- FROM comber_production_detail cpd
-- JOIN comber_machines cm ON cpd.machine_id = cm.id
-- JOIN comber_production_header cph ON cpd.header_id = cph.id
-- WHERE cph.entry_date = '2025-12-30' AND cph.shift = 1
-- ORDER BY cm.machine_no;

-- Check stoppage entries
-- SELECT 
--   cm.machine_no,
--   cse.stoppage1_time,
--   cse.stoppage2_time,
--   cse.stoppage3_time,
--   cse.stoppage4_time,
--   cse.total_stoppage_time
-- FROM comber_stoppage_entry cse
-- JOIN comber_production_detail cpd ON cse.production_detail_id = cpd.id
-- JOIN comber_machines cm ON cpd.machine_id = cm.id
-- ORDER BY cm.machine_no;

SELECT 'Comber Entry Setup Complete - 30-Dec-2025' as status;
