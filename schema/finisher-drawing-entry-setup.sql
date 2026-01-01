-- ============================================
-- FINISHER DRAWING ENTRY MODULE - Complete Database Setup
-- Preparatory Entry > Finisher Drawing Entry
-- Created: 25-Dec-2025
-- ============================================
-- Tables:
-- 1. finisher_drawing_production_header - Main header (Date, Shift, Supervisor, Maisitry)
-- 2. finisher_drawing_production_detail - Per machine production data
-- 3. finisher_drawing_stoppage_entry - Machine stoppage tracking
-- 4. finisher_drawing_machine_setup - Machine configuration for calculations
-- ============================================

-- ============================================
-- CALCULATION FORMULAS (from finisher_drawing-formula.md)
-- ============================================
-- Constant = 1 / 2.20456 / 0.14 ≈ 3.240
-- Act Prodn = Prod Hank × Constant
-- Std Prodn = Speed / 1693 / Hank × Total Time × Std Effi
-- Run Time = Total Time − Total Stoppage
-- Exp Prodn = Std Prodn × (Run Time / Total Time)
-- Act Effi % = Actual Prodn / Exp Prodn × 100
-- UTI % = Run Time / Total Time × 100
-- Waste % = Waste / Actual Prodn × 100
-- ============================================

-- ============================================
-- KEY DIFFERENCES FROM BREAKER DRAWING:
-- Speed: 350 m/min (uniform for all FD machines)
-- Std Efficiency: 90% (vs 85% for Breaker)
-- Default Waste: 0.41 kg (vs 0.85 kg for Breaker)
-- Std Prodn: 677.79 kg (vs 1371.72-1646.06 for Breaker)
-- Machines: FD4-FD10 (7 machines)
-- Machine Makes: RIETER, LMW
-- ============================================

-- ============================================
-- 1. FINISHER DRAWING PRODUCTION HEADER TABLE
-- One record per Date + Shift combination
-- ============================================
CREATE TABLE IF NOT EXISTS finisher_drawing_production_header (
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
CREATE INDEX IF NOT EXISTS idx_fd_prod_header_date ON finisher_drawing_production_header(entry_date);
CREATE INDEX IF NOT EXISTS idx_fd_prod_header_shift ON finisher_drawing_production_header(shift);
CREATE INDEX IF NOT EXISTS idx_fd_prod_header_entry_id ON finisher_drawing_production_header(entry_id);

-- Index for Copy Previous Data feature (faster date-based queries)
CREATE INDEX IF NOT EXISTS idx_fd_header_date_shift ON finisher_drawing_production_header(entry_date DESC, shift);

-- ============================================
-- 2. FINISHER DRAWING PRODUCTION DETAIL TABLE
-- One record per machine per shift
-- Grid: Mc.No., Emp.Name, Mixing, Act.Hank, Act.Prodn, Exp.Prodn, Waste, Waste%, Act.Effi, UTI, Run Time, WorkTime
-- ============================================
CREATE TABLE IF NOT EXISTS finisher_drawing_production_detail (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  header_id UUID NOT NULL REFERENCES finisher_drawing_production_header(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES drawing_finisher_machines(id) ON DELETE CASCADE,
  
  -- Employee (from dropdown)
  employee_name VARCHAR(100),
  
  -- Mixing (from machine master)
  prodn_mixing VARCHAR(100),  -- e.g., '64COMBED GOLD'
  
  -- Machine Inputs (from EL Measure Device)
  act_hank DECIMAL(10,2) DEFAULT 0,      -- Actual Hank reading
  act_prodn DECIMAL(10,2) DEFAULT 0,     -- Actual Production (kg)
  
  -- Calculated Fields (based on formula)
  std_prodn DECIMAL(10,2) DEFAULT 677.79,  -- Standard Production (677.79 for FD)
  exp_prodn DECIMAL(10,2) DEFAULT 0,       -- Expected Production
  effi_percent DECIMAL(10,2) DEFAULT 0,    -- Actual Efficiency %
  uti_percent DECIMAL(10,2) DEFAULT 0,     -- Utilization %
  waste DECIMAL(10,4) DEFAULT 0.41,        -- Waste (kg) - default 0.41 for FD
  waste_percent DECIMAL(10,4) DEFAULT 0,   -- Waste %
  run_time INTEGER DEFAULT 510,            -- Run Time = Total Time - Stoppage
  work_time INTEGER DEFAULT 510,           -- Work Time = Total Time (displayed)
  
  -- Session tracking
  session_no INTEGER DEFAULT 1,
  
  -- Status
  is_locked BOOLEAN DEFAULT false,
  remarks TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(header_id, machine_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fd_prod_detail_header ON finisher_drawing_production_detail(header_id);
CREATE INDEX IF NOT EXISTS idx_fd_prod_detail_machine ON finisher_drawing_production_detail(machine_id);

-- ============================================
-- 3. FINISHER DRAWING STOPPAGE ENTRY TABLE
-- Multiple stoppages per machine (up to 4, typically 3 used)
-- Grid: Mcno, session, Effi, R.Time, Stoppage1, S.Time1, Stoppage2, S.Time2, Stoppage3, S.Time3
-- ============================================
CREATE TABLE IF NOT EXISTS finisher_drawing_stoppage_entry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  production_detail_id UUID NOT NULL REFERENCES finisher_drawing_production_detail(id) ON DELETE CASCADE,
  
  -- Stoppage 1 (typically EXCESS STOCK)
  stoppage1_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage1_time INTEGER DEFAULT 0,
  
  -- Stoppage 2 (typically AIR CLEANING)
  stoppage2_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage2_time INTEGER DEFAULT 0,
  
  -- Stoppage 3 (typically COTS BUFFING)
  stoppage3_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage3_time INTEGER DEFAULT 0,
  
  -- Stoppage 4 (rarely used)
  stoppage4_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage4_time INTEGER DEFAULT 0,
  
  -- Total stoppage (auto-calculated)
  total_stoppage_time INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(production_detail_id)
);

-- Index for Copy Previous Data feature
CREATE INDEX IF NOT EXISTS idx_fd_stoppage_prod_detail ON finisher_drawing_stoppage_entry(production_detail_id);

-- ============================================
-- 4. FINISHER DRAWING MACHINE SETUP TABLE
-- Machine configuration used for calculations
-- Grid: Mc.No., Make Name, Mixing, Session, Shift Time, Std.Prodn, Speed, Std.Effi, Sl.Hank, Delivery, TYPE
-- ============================================
CREATE TABLE IF NOT EXISTS finisher_drawing_machine_setup (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES drawing_finisher_machines(id) ON DELETE CASCADE UNIQUE,
  
  -- Calculation Constants (from VB6 Machine Setup screenshot)
  speed INTEGER DEFAULT 350,                 -- Machine Speed (350 for all FD machines)
  hank_constant DECIMAL(10,4) DEFAULT 0.14,  -- Sliver Hank (0.14)
  std_efficiency_factor DECIMAL(5,4) DEFAULT 0.90, -- Standard Efficiency Factor (90% for FD)
  default_waste DECIMAL(10,4) DEFAULT 0.41,  -- Default Waste (kg) - 0.41 for FD
  
  -- Std Prodn = (Speed / 1693 / hank_constant) × Total Time × std_efficiency_factor
  -- = 350 / 1693 / 0.14 × 510 × 0.90 = 677.79
  std_prodn DECIMAL(10,2) DEFAULT 677.79,    -- Standard Production (pre-calculated)
  
  shift_time INTEGER DEFAULT 510,            -- Total Shift Time in minutes
  default_stoppage INTEGER DEFAULT 0,        -- Default stoppage time
  divisor_constant INTEGER DEFAULT 1693,     -- Divisor constant for formula
  delivery INTEGER DEFAULT 1,                -- Delivery count (always 1 for FD)
  
  -- Machine specific info
  make_name VARCHAR(50),                     -- RIETER or LMW
  machine_type VARCHAR(20) DEFAULT 'FINISHER', -- Machine type
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_fd_machine_setup_machine ON finisher_drawing_machine_setup(machine_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE finisher_drawing_production_header ENABLE ROW LEVEL SECURITY;
ALTER TABLE finisher_drawing_production_detail ENABLE ROW LEVEL SECURITY;
ALTER TABLE finisher_drawing_stoppage_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE finisher_drawing_machine_setup ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for all users" ON finisher_drawing_production_header;
DROP POLICY IF EXISTS "Enable insert for all users" ON finisher_drawing_production_header;
DROP POLICY IF EXISTS "Enable update for all users" ON finisher_drawing_production_header;
DROP POLICY IF EXISTS "Enable delete for all users" ON finisher_drawing_production_header;

DROP POLICY IF EXISTS "Enable read access for all users" ON finisher_drawing_production_detail;
DROP POLICY IF EXISTS "Enable insert for all users" ON finisher_drawing_production_detail;
DROP POLICY IF EXISTS "Enable update for all users" ON finisher_drawing_production_detail;
DROP POLICY IF EXISTS "Enable delete for all users" ON finisher_drawing_production_detail;

DROP POLICY IF EXISTS "Enable read access for all users" ON finisher_drawing_stoppage_entry;
DROP POLICY IF EXISTS "Enable insert for all users" ON finisher_drawing_stoppage_entry;
DROP POLICY IF EXISTS "Enable update for all users" ON finisher_drawing_stoppage_entry;
DROP POLICY IF EXISTS "Enable delete for all users" ON finisher_drawing_stoppage_entry;

DROP POLICY IF EXISTS "Enable read access for all users" ON finisher_drawing_machine_setup;
DROP POLICY IF EXISTS "Enable insert for all users" ON finisher_drawing_machine_setup;
DROP POLICY IF EXISTS "Enable update for all users" ON finisher_drawing_machine_setup;
DROP POLICY IF EXISTS "Enable delete for all users" ON finisher_drawing_machine_setup;

-- Create RLS policies (anonymous access for development)
-- Header
CREATE POLICY "Enable read access for all users" ON finisher_drawing_production_header FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON finisher_drawing_production_header FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON finisher_drawing_production_header FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON finisher_drawing_production_header FOR DELETE USING (true);

-- Detail
CREATE POLICY "Enable read access for all users" ON finisher_drawing_production_detail FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON finisher_drawing_production_detail FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON finisher_drawing_production_detail FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON finisher_drawing_production_detail FOR DELETE USING (true);

-- Stoppage
CREATE POLICY "Enable read access for all users" ON finisher_drawing_stoppage_entry FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON finisher_drawing_stoppage_entry FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON finisher_drawing_stoppage_entry FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON finisher_drawing_stoppage_entry FOR DELETE USING (true);

-- Machine Setup
CREATE POLICY "Enable read access for all users" ON finisher_drawing_machine_setup FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON finisher_drawing_machine_setup FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON finisher_drawing_machine_setup FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON finisher_drawing_machine_setup FOR DELETE USING (true);

-- ============================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATE
-- ============================================
CREATE OR REPLACE FUNCTION update_fd_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_fd_prod_header_updated_at ON finisher_drawing_production_header;
CREATE TRIGGER update_fd_prod_header_updated_at 
  BEFORE UPDATE ON finisher_drawing_production_header 
  FOR EACH ROW EXECUTE FUNCTION update_fd_updated_at();

DROP TRIGGER IF EXISTS update_fd_prod_detail_updated_at ON finisher_drawing_production_detail;
CREATE TRIGGER update_fd_prod_detail_updated_at 
  BEFORE UPDATE ON finisher_drawing_production_detail 
  FOR EACH ROW EXECUTE FUNCTION update_fd_updated_at();

DROP TRIGGER IF EXISTS update_fd_stoppage_updated_at ON finisher_drawing_stoppage_entry;
CREATE TRIGGER update_fd_stoppage_updated_at 
  BEFORE UPDATE ON finisher_drawing_stoppage_entry 
  FOR EACH ROW EXECUTE FUNCTION update_fd_updated_at();

DROP TRIGGER IF EXISTS update_fd_machine_setup_updated_at ON finisher_drawing_machine_setup;
CREATE TRIGGER update_fd_machine_setup_updated_at 
  BEFORE UPDATE ON finisher_drawing_machine_setup 
  FOR EACH ROW EXECUTE FUNCTION update_fd_updated_at();

-- ============================================
-- COPY PREVIOUS DATA FEATURE - Function
-- Get available previous dates with production data
-- ============================================
CREATE OR REPLACE FUNCTION get_finisher_drawing_available_dates(
  p_before_date DATE,
  p_shift INTEGER,
  p_limit INTEGER DEFAULT 30
)
RETURNS TABLE (
  entry_date DATE,
  shift INTEGER,
  has_details BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.entry_date,
    h.shift,
    EXISTS(
      SELECT 1 
      FROM finisher_drawing_production_detail d 
      WHERE d.header_id = h.id 
      AND (d.act_prodn > 0 OR d.employee_name IS NOT NULL)
    ) as has_details
  FROM finisher_drawing_production_header h
  WHERE h.entry_date < p_before_date
    AND h.shift = p_shift
  ORDER BY h.entry_date DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_finisher_drawing_available_dates TO authenticated;
GRANT EXECUTE ON FUNCTION get_finisher_drawing_available_dates TO anon;

COMMENT ON FUNCTION get_finisher_drawing_available_dates IS 
  'Returns list of previous dates that have production data for the specified shift. 
   Used by Copy Previous Data feature to show available dates to copy from.';

-- ============================================
-- UPDATE DRAWING_FINISHER_MACHINES WITH CORRECT DATA
-- Update existing machines to match VB6 screenshot (FD4-FD10)
-- ============================================

-- First, update the existing machines with correct data from VB6 screenshots
UPDATE drawing_finisher_machines SET
  make_name = 'RIETER',
  prodn_mixing = '64COMBED GOLD',
  speed = 350,
  is_active = true
WHERE machine_no = 'FD4';

UPDATE drawing_finisher_machines SET
  make_name = 'RIETER',
  prodn_mixing = '64COMBED GOLD',
  speed = 350,
  is_active = true
WHERE machine_no = 'FD5';

-- Insert missing machines (FD6-FD10) if they don't exist
INSERT INTO drawing_finisher_machines (machine_no, description, make_name, mc_id, prodn_mixing, speed, is_active)
VALUES 
  ('FD6', 'FD6', 'LMW', 6, '64COMBED GOLD', 350, true),
  ('FD7', 'FD7', 'LMW', 7, '64COMBED GOLD', 350, true),
  ('FD8', 'FD8', 'LMW', 8, '64COMBED GOLD', 350, true),
  ('FD9', 'FD9', 'LMW', 9, '64COMBED GOLD', 350, true),
  ('FD10', 'FD10', 'LMW', 10, '64COMBED GOLD', 350, true)
ON CONFLICT (machine_no) DO UPDATE SET
  make_name = EXCLUDED.make_name,
  prodn_mixing = EXCLUDED.prodn_mixing,
  speed = EXCLUDED.speed,
  is_active = EXCLUDED.is_active;

-- ============================================
-- SAMPLE DATA - 25-Dec-2025, Shift 1
-- From VB6 Screenshot Analysis
-- ============================================

-- Insert Machine Setup Data (based on VB6 Machine Setup screenshot)
INSERT INTO finisher_drawing_machine_setup (machine_id, speed, hank_constant, std_efficiency_factor, default_waste, std_prodn, shift_time, divisor_constant, delivery, make_name, machine_type)
SELECT 
  m.id,
  350,       -- Speed (uniform for all FD machines)
  0.14,      -- Hank constant
  0.90,      -- Std Efficiency (90% for FD)
  0.41,      -- Default waste
  677.79,    -- Std Prodn = 350/1693/0.14 × 510 × 0.90
  510,       -- Shift time
  1693,      -- Divisor constant
  1,         -- Delivery
  m.make_name,
  'FINISHER'
FROM drawing_finisher_machines m
WHERE m.machine_no IN ('FD4', 'FD5', 'FD6', 'FD7', 'FD8', 'FD9', 'FD10')
  AND m.is_active = true
ON CONFLICT (machine_id) DO UPDATE SET
  speed = EXCLUDED.speed,
  hank_constant = EXCLUDED.hank_constant,
  std_efficiency_factor = EXCLUDED.std_efficiency_factor,
  default_waste = EXCLUDED.default_waste,
  std_prodn = EXCLUDED.std_prodn,
  make_name = EXCLUDED.make_name;

-- Insert Production Header for 25-Dec-2025, Shift 1
INSERT INTO finisher_drawing_production_header (entry_date, shift, total_time, remarks)
VALUES ('2025-12-25', 1, 510, 'Sample data from VB6 - 25-Dec-2025')
ON CONFLICT (entry_date, shift) DO NOTHING;

-- Get header ID for inserting details
DO $$
DECLARE
  v_header_id UUID;
  v_fd4_id UUID;
  v_fd5_id UUID;
  v_fd6_id UUID;
  v_fd7_id UUID;
  v_fd8_id UUID;
  v_fd9_id UUID;
  v_fd10_id UUID;
  v_detail_id UUID;
  v_excess_stock_id UUID;
  v_air_cleaning_id UUID;
  v_cots_buffing_id UUID;
BEGIN
  -- Get header ID
  SELECT id INTO v_header_id FROM finisher_drawing_production_header 
  WHERE entry_date = '2025-12-25' AND shift = 1;
  
  -- Get machine IDs
  SELECT id INTO v_fd4_id FROM drawing_finisher_machines WHERE machine_no = 'FD4';
  SELECT id INTO v_fd5_id FROM drawing_finisher_machines WHERE machine_no = 'FD5';
  SELECT id INTO v_fd6_id FROM drawing_finisher_machines WHERE machine_no = 'FD6';
  SELECT id INTO v_fd7_id FROM drawing_finisher_machines WHERE machine_no = 'FD7';
  SELECT id INTO v_fd8_id FROM drawing_finisher_machines WHERE machine_no = 'FD8';
  SELECT id INTO v_fd9_id FROM drawing_finisher_machines WHERE machine_no = 'FD9';
  SELECT id INTO v_fd10_id FROM drawing_finisher_machines WHERE machine_no = 'FD10';
  
  -- Try to get stoppage IDs (these may exist from previous setup)
  SELECT id INTO v_excess_stock_id FROM stoppage_details WHERE stoppage_name ILIKE '%EXCESS STOCK%' LIMIT 1;
  SELECT id INTO v_air_cleaning_id FROM stoppage_details WHERE stoppage_name ILIKE '%AIR CLEANING%' LIMIT 1;
  SELECT id INTO v_cots_buffing_id FROM stoppage_details WHERE stoppage_name ILIKE '%COTS BUFF%' LIMIT 1;
  
  -- Insert Production Details for each machine (25-Dec-2025 data)
  -- FD4: Run Time=340, Stoppage=170 (150+20)
  INSERT INTO finisher_drawing_production_detail (header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, work_time, run_time, session_no)
  VALUES (v_header_id, v_fd4_id, 'JAYACHITRA. E', '64COMBED GOLD', 138.63, 449.19, 677.79, 451.86, 99.41, 66.67, 0.41, 0.09, 510, 340, 1)
  ON CONFLICT (header_id, machine_id) DO UPDATE SET
    employee_name = EXCLUDED.employee_name, prodn_mixing = EXCLUDED.prodn_mixing, act_hank = EXCLUDED.act_hank,
    act_prodn = EXCLUDED.act_prodn, exp_prodn = EXCLUDED.exp_prodn, effi_percent = EXCLUDED.effi_percent,
    uti_percent = EXCLUDED.uti_percent, waste = EXCLUDED.waste, waste_percent = EXCLUDED.waste_percent, run_time = EXCLUDED.run_time
  RETURNING id INTO v_detail_id;
  
  INSERT INTO finisher_drawing_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, total_stoppage_time)
  VALUES (v_detail_id, v_excess_stock_id, 150, v_air_cleaning_id, 20, 170)
  ON CONFLICT (production_detail_id) DO UPDATE SET
    stoppage1_id = EXCLUDED.stoppage1_id, stoppage1_time = EXCLUDED.stoppage1_time,
    stoppage2_id = EXCLUDED.stoppage2_id, stoppage2_time = EXCLUDED.stoppage2_time,
    total_stoppage_time = EXCLUDED.total_stoppage_time;

  -- FD5: Run Time=360, Stoppage=150 (130+20)
  INSERT INTO finisher_drawing_production_detail (header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, work_time, run_time, session_no)
  VALUES (v_header_id, v_fd5_id, 'JAYACHITRA. E', '64COMBED GOLD', 149.46, 484.27, 677.79, 478.44, 101.22, 70.59, 0.41, 0.08, 510, 360, 1)
  ON CONFLICT (header_id, machine_id) DO UPDATE SET
    employee_name = EXCLUDED.employee_name, prodn_mixing = EXCLUDED.prodn_mixing, act_hank = EXCLUDED.act_hank,
    act_prodn = EXCLUDED.act_prodn, exp_prodn = EXCLUDED.exp_prodn, effi_percent = EXCLUDED.effi_percent,
    uti_percent = EXCLUDED.uti_percent, waste = EXCLUDED.waste, waste_percent = EXCLUDED.waste_percent, run_time = EXCLUDED.run_time
  RETURNING id INTO v_detail_id;
  
  INSERT INTO finisher_drawing_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, total_stoppage_time)
  VALUES (v_detail_id, v_excess_stock_id, 130, v_air_cleaning_id, 20, 150)
  ON CONFLICT (production_detail_id) DO UPDATE SET
    stoppage1_id = EXCLUDED.stoppage1_id, stoppage1_time = EXCLUDED.stoppage1_time,
    stoppage2_id = EXCLUDED.stoppage2_id, stoppage2_time = EXCLUDED.stoppage2_time,
    total_stoppage_time = EXCLUDED.total_stoppage_time;

  -- FD6: Run Time=240, Stoppage=270 (230+20+20)
  INSERT INTO finisher_drawing_production_detail (header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, work_time, run_time, session_no)
  VALUES (v_header_id, v_fd6_id, 'KANAGAVALLI R', '64COMBED GOLD', 99.76, 323.23, 677.79, 318.96, 101.34, 47.06, 0.41, 0.13, 510, 240, 1)
  ON CONFLICT (header_id, machine_id) DO UPDATE SET
    employee_name = EXCLUDED.employee_name, prodn_mixing = EXCLUDED.prodn_mixing, act_hank = EXCLUDED.act_hank,
    act_prodn = EXCLUDED.act_prodn, exp_prodn = EXCLUDED.exp_prodn, effi_percent = EXCLUDED.effi_percent,
    uti_percent = EXCLUDED.uti_percent, waste = EXCLUDED.waste, waste_percent = EXCLUDED.waste_percent, run_time = EXCLUDED.run_time
  RETURNING id INTO v_detail_id;
  
  INSERT INTO finisher_drawing_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, total_stoppage_time)
  VALUES (v_detail_id, v_excess_stock_id, 230, v_air_cleaning_id, 20, v_cots_buffing_id, 20, 270)
  ON CONFLICT (production_detail_id) DO UPDATE SET
    stoppage1_id = EXCLUDED.stoppage1_id, stoppage1_time = EXCLUDED.stoppage1_time,
    stoppage2_id = EXCLUDED.stoppage2_id, stoppage2_time = EXCLUDED.stoppage2_time,
    stoppage3_id = EXCLUDED.stoppage3_id, stoppage3_time = EXCLUDED.stoppage3_time,
    total_stoppage_time = EXCLUDED.total_stoppage_time;

  -- FD7: Run Time=260, Stoppage=250 (210+20+20)
  INSERT INTO finisher_drawing_production_detail (header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, work_time, run_time, session_no)
  VALUES (v_header_id, v_fd7_id, 'KANAGAVALLI R', '64COMBED GOLD', 104.54, 338.72, 677.79, 345.54, 98.03, 50.98, 0.41, 0.12, 510, 260, 1)
  ON CONFLICT (header_id, machine_id) DO UPDATE SET
    employee_name = EXCLUDED.employee_name, prodn_mixing = EXCLUDED.prodn_mixing, act_hank = EXCLUDED.act_hank,
    act_prodn = EXCLUDED.act_prodn, exp_prodn = EXCLUDED.exp_prodn, effi_percent = EXCLUDED.effi_percent,
    uti_percent = EXCLUDED.uti_percent, waste = EXCLUDED.waste, waste_percent = EXCLUDED.waste_percent, run_time = EXCLUDED.run_time
  RETURNING id INTO v_detail_id;
  
  INSERT INTO finisher_drawing_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, total_stoppage_time)
  VALUES (v_detail_id, v_excess_stock_id, 210, v_air_cleaning_id, 20, v_cots_buffing_id, 20, 250)
  ON CONFLICT (production_detail_id) DO UPDATE SET
    stoppage1_id = EXCLUDED.stoppage1_id, stoppage1_time = EXCLUDED.stoppage1_time,
    stoppage2_id = EXCLUDED.stoppage2_id, stoppage2_time = EXCLUDED.stoppage2_time,
    stoppage3_id = EXCLUDED.stoppage3_id, stoppage3_time = EXCLUDED.stoppage3_time,
    total_stoppage_time = EXCLUDED.total_stoppage_time;

  -- FD8: Run Time=260, Stoppage=250 (210+20+20)
  INSERT INTO finisher_drawing_production_detail (header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, work_time, run_time, session_no)
  VALUES (v_header_id, v_fd8_id, 'KANAGAVALLI R', '64COMBED GOLD', 106.68, 345.66, 677.79, 345.54, 100.03, 50.98, 0.41, 0.12, 510, 260, 1)
  ON CONFLICT (header_id, machine_id) DO UPDATE SET
    employee_name = EXCLUDED.employee_name, prodn_mixing = EXCLUDED.prodn_mixing, act_hank = EXCLUDED.act_hank,
    act_prodn = EXCLUDED.act_prodn, exp_prodn = EXCLUDED.exp_prodn, effi_percent = EXCLUDED.effi_percent,
    uti_percent = EXCLUDED.uti_percent, waste = EXCLUDED.waste, waste_percent = EXCLUDED.waste_percent, run_time = EXCLUDED.run_time
  RETURNING id INTO v_detail_id;
  
  INSERT INTO finisher_drawing_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, total_stoppage_time)
  VALUES (v_detail_id, v_excess_stock_id, 210, v_air_cleaning_id, 20, v_cots_buffing_id, 20, 250)
  ON CONFLICT (production_detail_id) DO UPDATE SET
    stoppage1_id = EXCLUDED.stoppage1_id, stoppage1_time = EXCLUDED.stoppage1_time,
    stoppage2_id = EXCLUDED.stoppage2_id, stoppage2_time = EXCLUDED.stoppage2_time,
    stoppage3_id = EXCLUDED.stoppage3_id, stoppage3_time = EXCLUDED.stoppage3_time,
    total_stoppage_time = EXCLUDED.total_stoppage_time;

  -- FD9: Run Time=240, Stoppage=270 (230+20+20)
  INSERT INTO finisher_drawing_production_detail (header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, work_time, run_time, session_no)
  VALUES (v_header_id, v_fd9_id, 'JAYACHITRA. E', '64COMBED GOLD', 99.48, 322.33, 677.79, 318.96, 101.06, 47.06, 0.41, 0.13, 510, 240, 1)
  ON CONFLICT (header_id, machine_id) DO UPDATE SET
    employee_name = EXCLUDED.employee_name, prodn_mixing = EXCLUDED.prodn_mixing, act_hank = EXCLUDED.act_hank,
    act_prodn = EXCLUDED.act_prodn, exp_prodn = EXCLUDED.exp_prodn, effi_percent = EXCLUDED.effi_percent,
    uti_percent = EXCLUDED.uti_percent, waste = EXCLUDED.waste, waste_percent = EXCLUDED.waste_percent, run_time = EXCLUDED.run_time
  RETURNING id INTO v_detail_id;
  
  INSERT INTO finisher_drawing_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, total_stoppage_time)
  VALUES (v_detail_id, v_excess_stock_id, 230, v_air_cleaning_id, 20, v_cots_buffing_id, 20, 270)
  ON CONFLICT (production_detail_id) DO UPDATE SET
    stoppage1_id = EXCLUDED.stoppage1_id, stoppage1_time = EXCLUDED.stoppage1_time,
    stoppage2_id = EXCLUDED.stoppage2_id, stoppage2_time = EXCLUDED.stoppage2_time,
    stoppage3_id = EXCLUDED.stoppage3_id, stoppage3_time = EXCLUDED.stoppage3_time,
    total_stoppage_time = EXCLUDED.total_stoppage_time;

  -- FD10: Run Time=290, Stoppage=220 (160+20+40), Waste=0.82
  INSERT INTO finisher_drawing_production_detail (header_id, machine_id, employee_name, prodn_mixing, act_hank, act_prodn, std_prodn, exp_prodn, effi_percent, uti_percent, waste, waste_percent, work_time, run_time, session_no)
  VALUES (v_header_id, v_fd10_id, 'GANDHIMATHI K', '64COMBED GOLD', 115.24, 373.39, 677.79, 385.41, 96.88, 56.86, 0.82, 0.22, 510, 290, 1)
  ON CONFLICT (header_id, machine_id) DO UPDATE SET
    employee_name = EXCLUDED.employee_name, prodn_mixing = EXCLUDED.prodn_mixing, act_hank = EXCLUDED.act_hank,
    act_prodn = EXCLUDED.act_prodn, exp_prodn = EXCLUDED.exp_prodn, effi_percent = EXCLUDED.effi_percent,
    uti_percent = EXCLUDED.uti_percent, waste = EXCLUDED.waste, waste_percent = EXCLUDED.waste_percent, run_time = EXCLUDED.run_time
  RETURNING id INTO v_detail_id;
  
  INSERT INTO finisher_drawing_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, total_stoppage_time)
  VALUES (v_detail_id, v_excess_stock_id, 160, v_air_cleaning_id, 20, v_cots_buffing_id, 40, 220)
  ON CONFLICT (production_detail_id) DO UPDATE SET
    stoppage1_id = EXCLUDED.stoppage1_id, stoppage1_time = EXCLUDED.stoppage1_time,
    stoppage2_id = EXCLUDED.stoppage2_id, stoppage2_time = EXCLUDED.stoppage2_time,
    stoppage3_id = EXCLUDED.stoppage3_id, stoppage3_time = EXCLUDED.stoppage3_time,
    total_stoppage_time = EXCLUDED.total_stoppage_time;

END $$;

-- ============================================
-- INSERT STOPPAGE CODES FOR FINISHER DRAWING
-- (if they don't already exist)
-- ============================================
DO $$
DECLARE
  v_dept_id UUID;
  v_head_id UUID;
BEGIN
  -- Get Finisher Drawing department ID
  SELECT id INTO v_dept_id FROM departments WHERE dept_name = 'Finisher Drawing' LIMIT 1;
  
  -- Get maintenance routine head ID (or use any appropriate head)
  SELECT id INTO v_head_id FROM stoppage_heads WHERE description ILIKE '%PROCESS%' OR description ILIKE '%routine%' LIMIT 1;
  
  IF v_dept_id IS NOT NULL AND v_head_id IS NOT NULL THEN
    -- Insert stoppage codes if not exist
    INSERT INTO stoppage_details (code, stoppage_name, stoppage_head_id, department_id, short_code, description, is_active)
    VALUES 
      (1530, 'EXCESS STOCK', v_head_id, v_dept_id, 'ECI', 'Excess stock waiting', true),
      (1531, 'AIR CLEANING', v_head_id, v_dept_id, 'AIC', 'Air cleaning maintenance', true),
      (1532, 'COTS BUFFING', v_head_id, v_dept_id, 'CBG', 'Cots buffing maintenance', true),
      (1533, 'COILER PROBLEM', v_head_id, v_dept_id, 'CLP', 'Coiler malfunction', true),
      (1534, 'SUCTION PROBLEM', v_head_id, v_dept_id, 'SP', 'Suction system issue', true),
      (1535, 'MATERIAL SHORTAGE', v_head_id, v_dept_id, 'MS', 'Material not available', true)
    ON CONFLICT (code) DO NOTHING;
  END IF;
END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Uncomment to verify data after running

-- Check Production Header
-- SELECT * FROM finisher_drawing_production_header WHERE entry_date = '2025-12-25';

-- Check Production Details with machine info
-- SELECT 
--   m.machine_no,
--   d.employee_name,
--   d.prodn_mixing,
--   d.act_hank,
--   d.act_prodn,
--   d.exp_prodn,
--   d.effi_percent,
--   d.uti_percent,
--   d.waste,
--   d.waste_percent,
--   d.run_time,
--   d.work_time
-- FROM finisher_drawing_production_detail d
-- JOIN drawing_finisher_machines m ON d.machine_id = m.id
-- JOIN finisher_drawing_production_header h ON d.header_id = h.id
-- WHERE h.entry_date = '2025-12-25'
-- ORDER BY m.mc_id;

-- Check Stoppage Entries
-- SELECT 
--   m.machine_no,
--   s1.stoppage_name as stoppage1,
--   se.stoppage1_time,
--   s2.stoppage_name as stoppage2,
--   se.stoppage2_time,
--   s3.stoppage_name as stoppage3,
--   se.stoppage3_time,
--   se.total_stoppage_time
-- FROM finisher_drawing_stoppage_entry se
-- JOIN finisher_drawing_production_detail d ON se.production_detail_id = d.id
-- JOIN drawing_finisher_machines m ON d.machine_id = m.id
-- LEFT JOIN stoppage_details s1 ON se.stoppage1_id = s1.id
-- LEFT JOIN stoppage_details s2 ON se.stoppage2_id = s2.id
-- LEFT JOIN stoppage_details s3 ON se.stoppage3_id = s3.id
-- JOIN finisher_drawing_production_header h ON d.header_id = h.id
-- WHERE h.entry_date = '2025-12-25'
-- ORDER BY m.mc_id;

-- Check Machine Setup
-- SELECT 
--   m.machine_no,
--   ms.make_name,
--   ms.speed,
--   ms.hank_constant,
--   ms.std_efficiency_factor,
--   ms.std_prodn,
--   ms.default_waste,
--   ms.machine_type
-- FROM finisher_drawing_machine_setup ms
-- JOIN drawing_finisher_machines m ON ms.machine_id = m.id
-- ORDER BY m.mc_id;

-- Test Copy Previous Data function
-- SELECT * FROM get_finisher_drawing_available_dates('2025-12-26', 1, 10);

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Finisher Drawing Entry Setup Complete!';
  RAISE NOTICE '📅 Sample data inserted for: 25-Dec-2025, Shift 1';
  RAISE NOTICE '🔧 Tables created: finisher_drawing_production_header, finisher_drawing_production_detail, finisher_drawing_stoppage_entry, finisher_drawing_machine_setup';
  RAISE NOTICE '📋 Machines: FD4-FD10 (7 machines)';
  RAISE NOTICE '🔄 Copy Previous Data function: get_finisher_drawing_available_dates()';
END $$;
