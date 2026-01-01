-- ============================================
-- BREAKER DRAWING ENTRY MODULE - Complete Database Setup
-- Preparatory Entry > Breaker Drawing Entry
-- ============================================
-- Tables:
-- 1. breaker_drawing_production_header - Main header (Date, Shift, Supervisor, Maisitry)
-- 2. breaker_drawing_production_detail - Per machine production data
-- 3. breaker_drawing_stoppage_entry - Machine stoppage tracking
-- 4. breaker_drawing_machine_setup - Machine configuration for calculations
-- ============================================

-- ============================================
-- CALCULATION FORMULAS (from breaker-drawing-formula.md)
-- ============================================
-- Std Prodn = Speed / 1693 / Hank × Total Time × Std Effi × Delivery
-- Exp Prodn = Std Prodn × (Run Time / Total Time)
-- Act Effi % = Actual Prodn / Exp Prodn × 100
-- UTI % = Run Time / Total Time × 100
-- Waste % = Waste / Actual Prodn × 100
-- Run Time = Total Time − Total Stoppage
-- Work Time = Run Time
-- ============================================

-- ============================================
-- 1. BREAKER DRAWING PRODUCTION HEADER TABLE
-- One record per Date + Shift combination
-- ============================================
CREATE TABLE IF NOT EXISTS breaker_drawing_production_header (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id SERIAL,  -- Sequential ID for display
  entry_date DATE NOT NULL,
  shift INTEGER NOT NULL CHECK (shift IN (1, 2, 3)),
  supervisor_id UUID REFERENCES supervisors(id) ON DELETE SET NULL,
  maisitry_id UUID REFERENCES supervisors(id) ON DELETE SET NULL,
  total_time INTEGER DEFAULT 510,  -- Default shift time in minutes
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

-- ============================================
-- 2. BREAKER DRAWING PRODUCTION DETAIL TABLE
-- One record per machine per shift
-- Grid: Mc.No., Emp.Name, Mixing, Act.Hank, Act.Prodn, Exp.Prodn, Waste, Waste%, Act.Effi, UTI, Run Time, WorkTime
-- ============================================
CREATE TABLE IF NOT EXISTS breaker_drawing_production_detail (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  header_id UUID NOT NULL REFERENCES breaker_drawing_production_header(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES drawing_breaker_machines(id) ON DELETE CASCADE,
  
  -- Employee (from dropdown)
  employee_name VARCHAR(100),
  
  -- Mixing (from machine master)
  prodn_mixing VARCHAR(100),  -- e.g., '64COMBED GOLD'
  
  -- Machine Inputs (from EL Measure Device)
  act_hank DECIMAL(10,2) DEFAULT 0,      -- Actual Hank reading
  act_prodn DECIMAL(10,2) DEFAULT 0,     -- Actual Production (kg)
  
  -- Calculated Fields (based on formula)
  std_prodn DECIMAL(10,2) DEFAULT 0,     -- Standard Production
  exp_prodn DECIMAL(10,2) DEFAULT 0,     -- Expected Production
  effi_percent DECIMAL(10,2) DEFAULT 0,  -- Actual Efficiency %
  uti_percent DECIMAL(10,2) DEFAULT 0,   -- Utilization %
  waste DECIMAL(10,4) DEFAULT 0.85,      -- Waste (kg) - default 0.85
  waste_percent DECIMAL(10,4) DEFAULT 0, -- Waste %
  run_time INTEGER DEFAULT 510,          -- Run Time = Total Time (displayed)
  work_time INTEGER DEFAULT 510,         -- Work Time = Run Time (calculated)
  
  -- Session tracking
  session_no INTEGER DEFAULT 1,
  
  -- Status
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(header_id, machine_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bd_prod_detail_header ON breaker_drawing_production_detail(header_id);
CREATE INDEX IF NOT EXISTS idx_bd_prod_detail_machine ON breaker_drawing_production_detail(machine_id);

-- ============================================
-- 3. BREAKER DRAWING STOPPAGE ENTRY TABLE
-- Multiple stoppages per machine (up to 4, typically 3 used)
-- Grid: Mcno, session, Effi, R.Time, Stoppage1, S.Time1, Stoppage2, S.Time2, Stoppage3, S.Time3
-- ============================================
CREATE TABLE IF NOT EXISTS breaker_drawing_stoppage_entry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  production_detail_id UUID NOT NULL REFERENCES breaker_drawing_production_detail(id) ON DELETE CASCADE,
  
  -- Stoppage 1
  stoppage1_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage1_time INTEGER DEFAULT 0,
  
  -- Stoppage 2
  stoppage2_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage2_time INTEGER DEFAULT 0,
  
  -- Stoppage 3
  stoppage3_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage3_time INTEGER DEFAULT 0,
  
  -- Stoppage 4 (rarely used)
  stoppage4_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage4_time INTEGER DEFAULT 0,
  
  -- Total stoppage (auto-calculated)
  total_stoppage_time INTEGER DEFAULT 0,
  
  -- Full Stoppage (applies to all machines) vs Partial
  is_full_stoppage BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(production_detail_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_bd_stoppage_prod_detail ON breaker_drawing_stoppage_entry(production_detail_id);

-- ============================================
-- 4. BREAKER DRAWING MACHINE SETUP TABLE
-- Machine configuration used for calculations
-- Grid: Mc.No., Make Name, Mixing, Session, Shift Time, Std.Prodn, Speed, Std.Effi, Sl.Hank, Delivery
-- ============================================
CREATE TABLE IF NOT EXISTS breaker_drawing_machine_setup (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES drawing_breaker_machines(id) ON DELETE CASCADE UNIQUE,
  
  -- Calculation Constants (from VB6 Machine Setup screenshot)
  speed INTEGER DEFAULT 750,               -- Machine Speed (450 for BD1, 750 for others)
  hank_constant DECIMAL(10,4) DEFAULT 0.14, -- Sliver Hank (0.14)
  std_efficiency_factor DECIMAL(5,4) DEFAULT 0.85, -- Standard Efficiency Factor (85%)
  default_waste DECIMAL(10,4) DEFAULT 0.85, -- Default Waste (kg)
  
  -- Std Prodn = (Speed / 1693 / hank_constant) × Total Time × std_efficiency_factor × delivery
  std_prodn DECIMAL(10,2) DEFAULT 1371.72,  -- Standard Production (pre-calculated)
  
  -- Time defaults
  shift_time INTEGER DEFAULT 510,           -- Default shift time (minutes)
  default_stoppage INTEGER DEFAULT 0,       -- Default stoppage time
  
  -- Divisor constant (from formula: Speed/1693/0.14)
  divisor_constant INTEGER DEFAULT 1693,
  
  -- Delivery (unique to Breaker Drawing - 1 or 2)
  delivery INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE breaker_drawing_production_header ENABLE ROW LEVEL SECURITY;
ALTER TABLE breaker_drawing_production_detail ENABLE ROW LEVEL SECURITY;
ALTER TABLE breaker_drawing_stoppage_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE breaker_drawing_machine_setup ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-runnability)
DROP POLICY IF EXISTS "Enable read access for all users" ON breaker_drawing_production_header;
DROP POLICY IF EXISTS "Enable insert for all users" ON breaker_drawing_production_header;
DROP POLICY IF EXISTS "Enable update for all users" ON breaker_drawing_production_header;
DROP POLICY IF EXISTS "Enable delete for all users" ON breaker_drawing_production_header;

DROP POLICY IF EXISTS "Enable read access for all users" ON breaker_drawing_production_detail;
DROP POLICY IF EXISTS "Enable insert for all users" ON breaker_drawing_production_detail;
DROP POLICY IF EXISTS "Enable update for all users" ON breaker_drawing_production_detail;
DROP POLICY IF EXISTS "Enable delete for all users" ON breaker_drawing_production_detail;

DROP POLICY IF EXISTS "Enable read access for all users" ON breaker_drawing_stoppage_entry;
DROP POLICY IF EXISTS "Enable insert for all users" ON breaker_drawing_stoppage_entry;
DROP POLICY IF EXISTS "Enable update for all users" ON breaker_drawing_stoppage_entry;
DROP POLICY IF EXISTS "Enable delete for all users" ON breaker_drawing_stoppage_entry;

DROP POLICY IF EXISTS "Enable read access for all users" ON breaker_drawing_machine_setup;
DROP POLICY IF EXISTS "Enable insert for all users" ON breaker_drawing_machine_setup;
DROP POLICY IF EXISTS "Enable update for all users" ON breaker_drawing_machine_setup;
DROP POLICY IF EXISTS "Enable delete for all users" ON breaker_drawing_machine_setup;

-- RLS Policies for breaker_drawing_production_header
CREATE POLICY "Enable read access for all users" 
ON breaker_drawing_production_header FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON breaker_drawing_production_header FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON breaker_drawing_production_header FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON breaker_drawing_production_header FOR DELETE USING (true);

-- RLS Policies for breaker_drawing_production_detail
CREATE POLICY "Enable read access for all users" 
ON breaker_drawing_production_detail FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON breaker_drawing_production_detail FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON breaker_drawing_production_detail FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON breaker_drawing_production_detail FOR DELETE USING (true);

-- RLS Policies for breaker_drawing_stoppage_entry
CREATE POLICY "Enable read access for all users" 
ON breaker_drawing_stoppage_entry FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON breaker_drawing_stoppage_entry FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON breaker_drawing_stoppage_entry FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON breaker_drawing_stoppage_entry FOR DELETE USING (true);

-- RLS Policies for breaker_drawing_machine_setup
CREATE POLICY "Enable read access for all users" 
ON breaker_drawing_machine_setup FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON breaker_drawing_machine_setup FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON breaker_drawing_machine_setup FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON breaker_drawing_machine_setup FOR DELETE USING (true);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================
-- Drop existing triggers if they exist (for re-runnability)
DROP TRIGGER IF EXISTS update_bd_prod_header_updated_at ON breaker_drawing_production_header;
DROP TRIGGER IF EXISTS update_bd_prod_detail_updated_at ON breaker_drawing_production_detail;
DROP TRIGGER IF EXISTS update_bd_stoppage_updated_at ON breaker_drawing_stoppage_entry;
DROP TRIGGER IF EXISTS update_bd_machine_setup_updated_at ON breaker_drawing_machine_setup;

CREATE TRIGGER update_bd_prod_header_updated_at 
  BEFORE UPDATE ON breaker_drawing_production_header 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bd_prod_detail_updated_at 
  BEFORE UPDATE ON breaker_drawing_production_detail 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bd_stoppage_updated_at 
  BEFORE UPDATE ON breaker_drawing_stoppage_entry 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bd_machine_setup_updated_at 
  BEFORE UPDATE ON breaker_drawing_machine_setup 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ADD BREAKER DRAWING-SPECIFIC STOPPAGE REASONS
-- ============================================
DO $$
DECLARE
  dept_breaker_drawing UUID;
  head_others UUID;
BEGIN
  -- Get department and head IDs
  SELECT id INTO dept_breaker_drawing FROM departments WHERE dept_name = 'BREAKER DRAWING' LIMIT 1;
  SELECT id INTO head_others FROM stoppage_heads WHERE stoppage_head_name = 'OTHERS' LIMIT 1;
  
  -- Insert breaker drawing-specific stoppages
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
-- INSERT MACHINE SETUP DATA (From VB6 Screenshot)
-- Speed is REFERENCED from drawing_breaker_machines table (NOT hardcoded)
-- Std Prodn is CALCULATED: (Speed / 1693 / Hank) × Total Time × Std Effi × Delivery
-- ============================================
INSERT INTO breaker_drawing_machine_setup (machine_id, speed, hank_constant, std_efficiency_factor, default_waste, std_prodn, shift_time, default_stoppage, divisor_constant, delivery)
SELECT 
  dbm.id as machine_id,
  dbm.speed,  -- Speed from machine master table (NOT hardcoded)
  0.14 as hank_constant,
  0.85 as std_efficiency_factor,
  0.85 as default_waste,
  -- Calculate std_prodn dynamically from machine's speed
  ROUND(
    (dbm.speed::DECIMAL / 1693 / 0.14) * 510 * 0.85 * 
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
  delivery = EXCLUDED.delivery;

-- ============================================
-- INSERT SAMPLE PRODUCTION DATA (From Screenshot - 22-Apr-2025, Shift 1)
-- Calculations based on breaker-drawing-formula.md:
-- Std Prodn = (Speed / 1693 / Hank) × Total Time × Std Effi × Delivery
-- Exp Prodn = Std Prodn × (Work Time / Total Time)
-- Effi% = Act Prodn / Exp Prodn × 100
-- UTI% = Work Time / Total Time × 100
-- Waste% = Waste / Act Prodn × 100
-- Work Time is entered separately (NOT calculated from stoppages here)
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
  dept_breaker_drawing UUID;
  head_others UUID;
  -- Speed values from machine master table (NOT hardcoded)
  v_bd1_speed DECIMAL(10,2);
  v_bd2_speed DECIMAL(10,2);
  v_bd3_speed DECIMAL(10,2);
  v_bd4_speed DECIMAL(10,2);
  -- Machine setup values for calculations
  v_bd1_std_prodn DECIMAL(10,2);
  v_bd2_std_prodn DECIMAL(10,2);
  v_bd3_std_prodn DECIMAL(10,2);
  v_bd4_std_prodn DECIMAL(10,2);
  v_total_time INTEGER := 510;
BEGIN
  -- Get supervisor (use first available)
  SELECT id INTO v_supervisor_id FROM supervisors WHERE is_active = true LIMIT 1;
  
  -- Get department and head IDs for stoppage reasons
  SELECT id INTO dept_breaker_drawing FROM departments WHERE dept_name = 'BREAKER DRAWING' LIMIT 1;
  SELECT id INTO head_others FROM stoppage_heads WHERE stoppage_head_name = 'OTHERS' LIMIT 1;
  
  -- Get stoppage reason IDs
  SELECT id INTO v_stoppage_excess_stock FROM stoppage_details WHERE code = 1510 LIMIT 1;
  SELECT id INTO v_stoppage_bss FROM stoppage_details WHERE code = 1511 LIMIT 1;
  SELECT id INTO v_stoppage_air_cleaning FROM stoppage_details WHERE code = 1512 LIMIT 1;
  
  -- Get machine IDs and Speed from machine master table (NOT hardcoded)
  SELECT id, speed INTO v_machine_bd1, v_bd1_speed FROM drawing_breaker_machines WHERE machine_no = 'BD1';
  SELECT id, speed INTO v_machine_bd2, v_bd2_speed FROM drawing_breaker_machines WHERE machine_no = 'BD2';
  SELECT id, speed INTO v_machine_bd3, v_bd3_speed FROM drawing_breaker_machines WHERE machine_no = 'BD3';
  SELECT id, speed INTO v_machine_bd4, v_bd4_speed FROM drawing_breaker_machines WHERE machine_no = 'BD4';
  
  -- Calculate Std Prodn using formulas with speed from machine table
  -- Formula: Std Prodn = (Speed / 1693 / Hank) × Total Time × Std Effi × Delivery
  -- BD1: Delivery=2
  v_bd1_std_prodn := ROUND((v_bd1_speed / 1693.0 / 0.14) * v_total_time * 0.85 * 2, 2);
  
  -- BD2-BD4: Delivery=1
  v_bd2_std_prodn := ROUND((v_bd2_speed / 1693.0 / 0.14) * v_total_time * 0.85 * 1, 2);
  v_bd3_std_prodn := ROUND((v_bd3_speed / 1693.0 / 0.14) * v_total_time * 0.85 * 1, 2);
  v_bd4_std_prodn := ROUND((v_bd4_speed / 1693.0 / 0.14) * v_total_time * 0.85 * 1, 2);
  
  -- Create header for 22-Apr-2025, Shift 1
  INSERT INTO breaker_drawing_production_header (entry_date, shift, supervisor_id, maisitry_id, total_time, remarks)
  VALUES ('2025-04-22', 1, v_supervisor_id, NULL, v_total_time, 'Sample data from VB6')
  ON CONFLICT (entry_date, shift) DO NOTHING
  RETURNING id INTO v_header_id;
  
  -- Only insert details if header was created
  IF v_header_id IS NOT NULL THEN
    -- Insert production details with CALCULATED exp_prodn values
    -- Formula: Exp Prodn = Std Prodn × (Work Time / Total Time)
    -- Work Time is entered separately for each machine
    
    INSERT INTO breaker_drawing_production_detail 
      (header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, run_time, work_time, session_no)
    VALUES
      -- BD1: WorkTime=270, Exp Prodn = 1646.06 × (270/510) = 871.44
      (v_header_id, v_machine_bd1, 'MURUGESWARI. M', '64COMBED GOLD', 133.36, 864.20, 
       v_bd1_std_prodn,  -- Std Prodn = 1646.06
       ROUND(v_bd1_std_prodn * (270.0 / v_total_time), 2),  -- Exp Prodn = 871.44
       ROUND(864.20 / (v_bd1_std_prodn * (270.0 / v_total_time)) * 100, 2),  -- Effi%
       ROUND(270.0 / v_total_time * 100, 2),  -- UTI%
       0.85, 
       ROUND(0.85 / 864.20 * 100, 2),  -- Waste%
       v_total_time, 270, 1),
      
      -- BD2: WorkTime=260, Speed from machine table
      (v_header_id, v_machine_bd2, 'MURUGESWARI. M', '64COMBED GOLD', 213.50, 691.77,
       v_bd2_std_prodn,  -- Std Prodn calculated from machine speed
       ROUND(v_bd2_std_prodn * (260.0 / v_total_time), 2),  -- Exp Prodn
       ROUND(691.77 / (v_bd2_std_prodn * (260.0 / v_total_time)) * 100, 2),  -- Effi%
       ROUND(260.0 / v_total_time * 100, 2),  -- UTI%
       0.85,
       ROUND(0.85 / 691.77 * 100, 2),  -- Waste%
       v_total_time, 260, 1),
      
      -- BD3: WorkTime=410, Speed from machine table
      (v_header_id, v_machine_bd3, 'MURUGESWARI. M', '64COMBED GOLD', 341.91, 1107.83,
       v_bd3_std_prodn,  -- Std Prodn calculated from machine speed
       ROUND(v_bd3_std_prodn * (410.0 / v_total_time), 2),  -- Exp Prodn
       ROUND(1107.83 / (v_bd3_std_prodn * (410.0 / v_total_time)) * 100, 2),  -- Effi%
       ROUND(410.0 / v_total_time * 100, 2),  -- UTI%
       0.85,
       ROUND(0.85 / 1107.83 * 100, 2),  -- Waste%
       v_total_time, 410, 1),
      
      -- BD4: WorkTime=370, Speed from machine table
      (v_header_id, v_machine_bd4, 'GANDHIMATHI K', '64COMBED GOLD', 307.04, 994.85,
       v_bd4_std_prodn,  -- Std Prodn calculated from machine speed
       ROUND(v_bd4_std_prodn * (370.0 / v_total_time), 2),  -- Exp Prodn
       ROUND(994.85 / (v_bd4_std_prodn * (370.0 / v_total_time)) * 100, 2),  -- Effi%
       ROUND(370.0 / v_total_time * 100, 2),  -- UTI%
       0.85,
       ROUND(0.85 / 994.85 * 100, 2),  -- Waste%
       v_total_time, 370, 1);

    -- Insert Stoppage Entries with stoppage reason IDs
    -- BD1: EXCESS STOCK (160) + BSS (60) + AIR CLEANING (20) = 240 mins
    INSERT INTO breaker_drawing_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, total_stoppage_time)
    SELECT cpd.id, v_stoppage_excess_stock, 160, v_stoppage_bss, 60, v_stoppage_air_cleaning, 20, 240
    FROM breaker_drawing_production_detail cpd
    WHERE cpd.header_id = v_header_id AND cpd.machine_id = v_machine_bd1;
    
    -- BD2: EXCESS STOCK (170) + BSS (60) + AIR CLEANING (20) = 250 mins
    INSERT INTO breaker_drawing_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, total_stoppage_time)
    SELECT cpd.id, v_stoppage_excess_stock, 170, v_stoppage_bss, 60, v_stoppage_air_cleaning, 20, 250
    FROM breaker_drawing_production_detail cpd
    WHERE cpd.header_id = v_header_id AND cpd.machine_id = v_machine_bd2;
    
    -- BD3: EXCESS STOCK (20) + BSS (60) + AIR CLEANING (20) = 100 mins
    INSERT INTO breaker_drawing_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, total_stoppage_time)
    SELECT cpd.id, v_stoppage_excess_stock, 20, v_stoppage_bss, 60, v_stoppage_air_cleaning, 20, 100
    FROM breaker_drawing_production_detail cpd
    WHERE cpd.header_id = v_header_id AND cpd.machine_id = v_machine_bd3;
    
    -- BD4: EXCESS STOCK (60) + BSS (60) + AIR CLEANING (20) = 140 mins
    INSERT INTO breaker_drawing_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, total_stoppage_time)
    SELECT cpd.id, v_stoppage_excess_stock, 60, v_stoppage_bss, 60, v_stoppage_air_cleaning, 20, 140
    FROM breaker_drawing_production_detail cpd
    WHERE cpd.header_id = v_header_id AND cpd.machine_id = v_machine_bd4;
  END IF;
END $$;

-- ============================================
-- CREATE SAMPLE DATA FOR CURRENT DATE (Shift 1)
-- All calculations done dynamically using formulas
-- ============================================
DO $$
DECLARE
  v_header_id UUID;
  v_supervisor_id UUID;
  v_excess_stock_id UUID;
  v_bss_id UUID;
  v_air_cleaning_id UUID;
  v_machine RECORD;
  v_total_time INTEGER := 510;
  v_work_time INTEGER := 430;  -- Separate work time entry (510 - 80 stoppage)
  v_calculated_std_prodn DECIMAL(10,2);
  v_calculated_exp_prodn DECIMAL(10,2);
BEGIN
  -- Get supervisor
  SELECT id INTO v_supervisor_id FROM supervisors WHERE is_active = true LIMIT 1;
  
  -- Get stoppage reasons
  SELECT id INTO v_excess_stock_id FROM stoppage_details WHERE code = 1510 LIMIT 1;
  SELECT id INTO v_bss_id FROM stoppage_details WHERE code = 1511 LIMIT 1;
  SELECT id INTO v_air_cleaning_id FROM stoppage_details WHERE code = 1512 LIMIT 1;
  
  -- Check if entry already exists for today
  SELECT id INTO v_header_id FROM breaker_drawing_production_header 
  WHERE entry_date = CURRENT_DATE AND shift = 1;
  
  IF v_header_id IS NULL THEN
    -- Create header for today
    INSERT INTO breaker_drawing_production_header (entry_date, shift, supervisor_id, maisitry_id, total_time, remarks)
    VALUES (CURRENT_DATE, 1, v_supervisor_id, NULL, v_total_time, 'Sample data for today')
    RETURNING id INTO v_header_id;
    
    -- Insert production details with dynamically calculated values for each active machine
    FOR v_machine IN 
      SELECT dbm.id, dbm.machine_no, dbm.prodn_mixing,
             COALESCE(bdms.speed, 750) as speed,
             COALESCE(bdms.hank_constant, 0.14) as hank_constant,
             COALESCE(bdms.std_efficiency_factor, 0.85) as std_efficiency_factor,
             COALESCE(bdms.delivery, 1) as delivery,
             COALESCE(bdms.default_waste, 0.85) as default_waste
      FROM drawing_breaker_machines dbm
      LEFT JOIN breaker_drawing_machine_setup bdms ON dbm.id = bdms.machine_id
      WHERE dbm.is_active = true AND dbm.machine_no IN ('BD1', 'BD2', 'BD3', 'BD4')
      ORDER BY dbm.mc_id
    LOOP
      -- Calculate Std Prodn: (Speed / 1693 / Hank) × Total Time × Std Effi × Delivery
      v_calculated_std_prodn := ROUND(
        (v_machine.speed::DECIMAL / 1693 / v_machine.hank_constant) 
        * v_total_time 
        * v_machine.std_efficiency_factor 
        * v_machine.delivery, 2);
      
      -- Calculate Exp Prodn: Std Prodn × (Work Time / Total Time)
      v_calculated_exp_prodn := ROUND(v_calculated_std_prodn * (v_work_time::DECIMAL / v_total_time), 2);
      
      INSERT INTO breaker_drawing_production_detail 
        (header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, 
         std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, run_time, work_time, session_no)
      VALUES
        (v_header_id, v_machine.id, 'MURUGESWARI. M', COALESCE(v_machine.prodn_mixing, '64COMBED GOLD'), 
         200.00,  -- Sample act_hank
         1000.00, -- Sample act_prodn
         v_calculated_std_prodn,
         v_calculated_exp_prodn,
         ROUND(1000.00 / v_calculated_exp_prodn * 100, 2),  -- Effi% calculated
         ROUND(v_work_time::DECIMAL / v_total_time * 100, 2),  -- UTI% calculated
         v_machine.default_waste, 
         ROUND(v_machine.default_waste / 1000.00 * 100, 2),  -- Waste% calculated
         v_total_time, 
         v_work_time,  -- Work Time entered separately
         1);
    END LOOP;
    
    -- Create stoppage entries for each production detail (default 80 mins: 60+20)
    INSERT INTO breaker_drawing_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, total_stoppage_time)
    SELECT cpd.id, v_bss_id, 60, v_air_cleaning_id, 20, 80
    FROM breaker_drawing_production_detail cpd
    WHERE cpd.header_id = v_header_id;
    
    RAISE NOTICE 'Created sample data for today (%) with header_id: %', CURRENT_DATE, v_header_id;
  ELSE
    RAISE NOTICE 'Entry already exists for today (%) with header_id: %', CURRENT_DATE, v_header_id;
  END IF;
END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Check header data
-- SELECT entry_id, TO_CHAR(entry_date, 'DD-Mon-YY') as date, shift, total_time 
-- FROM breaker_drawing_production_header ORDER BY entry_date DESC;

-- Check production details with machine info
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

-- Check stoppage entries with reason names
-- SELECT 
--   dbm.machine_no as "Mcno",
--   bdpd.session_no as "session",
--   bdpd.effi_percent as "Effi",
--   bdph.total_time as "R.Time",
--   sd1.stoppage_name as "Stoppage 1",
--   bdse.stoppage1_time as "S.Time 1",
--   sd2.stoppage_name as "Stoppage 2",
--   bdse.stoppage2_time as "S.Time 2",
--   sd3.stoppage_name as "Stoppage 3",
--   bdse.stoppage3_time as "S.Time 3",
--   bdse.total_stoppage_time as "Total"
-- FROM breaker_drawing_stoppage_entry bdse
-- JOIN breaker_drawing_production_detail bdpd ON bdse.production_detail_id = bdpd.id
-- JOIN drawing_breaker_machines dbm ON bdpd.machine_id = dbm.id
-- JOIN breaker_drawing_production_header bdph ON bdpd.header_id = bdph.id
-- LEFT JOIN stoppage_details sd1 ON bdse.stoppage1_id = sd1.id
-- LEFT JOIN stoppage_details sd2 ON bdse.stoppage2_id = sd2.id
-- LEFT JOIN stoppage_details sd3 ON bdse.stoppage3_id = sd3.id
-- ORDER BY dbm.mc_id;

-- Check machine setup
-- SELECT 
--   dbm.machine_no as "Mc. No.",
--   dbm.make_name as "Make Name",
--   COALESCE(dbm.prodn_mixing, '64COMBED GOLD') as "Mixing",
--   1 as "Session",
--   bdms.shift_time as "Shift Time",
--   bdms.std_prodn as "Std. Prodn",
--   bdms.speed as "Speed",
--   bdms.std_efficiency_factor * 100 as "Std. Effi",
--   bdms.hank_constant as "Sl.Hank",
--   bdms.delivery as "Delivery"
-- FROM breaker_drawing_machine_setup bdms
-- JOIN drawing_breaker_machines dbm ON bdms.machine_id = dbm.id
-- ORDER BY dbm.mc_id;

SELECT 'Breaker Drawing Entry Setup Complete' as status;
