-- =====================================================
-- LAP FORMER ENTRY MODULE - Database Setup
-- =====================================================
-- This script creates the complete Lap Former Entry module tables
-- Run this in Supabase SQL Editor
-- 
-- Tables Created:
--   1. lap_former_production_header (Table 25)
--   2. lap_former_production_detail (Table 26)
--   3. lap_former_stoppage_entry (Table 27)
--   4. lap_former_machine_setup (Table 28)
--
-- Prerequisites:
--   - lap_former_machines table must exist (with LF1, LF2, LF3)
--   - supervisors table must exist
--   - stoppage_details table must exist
-- =====================================================

-- ============================================
-- 1. LAP FORMER PRODUCTION HEADER TABLE
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

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_lf_prod_header_date ON lap_former_production_header(entry_date);
CREATE INDEX IF NOT EXISTS idx_lf_prod_header_shift ON lap_former_production_header(shift);
CREATE INDEX IF NOT EXISTS idx_lf_prod_header_entry_id ON lap_former_production_header(entry_id);
CREATE INDEX IF NOT EXISTS idx_lf_prod_header_date_shift ON lap_former_production_header(entry_date DESC, shift);

-- Enable RLS
ALTER TABLE lap_former_production_header ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Enable read access for all users" ON lap_former_production_header;
DROP POLICY IF EXISTS "Enable insert for all users" ON lap_former_production_header;
DROP POLICY IF EXISTS "Enable update for all users" ON lap_former_production_header;
DROP POLICY IF EXISTS "Enable delete for all users" ON lap_former_production_header;

CREATE POLICY "Enable read access for all users" 
ON lap_former_production_header FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON lap_former_production_header FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON lap_former_production_header FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON lap_former_production_header FOR DELETE USING (true);

-- ============================================
-- 2. LAP FORMER PRODUCTION DETAIL TABLE
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
DROP POLICY IF EXISTS "Enable read access for all users" ON lap_former_production_detail;
DROP POLICY IF EXISTS "Enable insert for all users" ON lap_former_production_detail;
DROP POLICY IF EXISTS "Enable update for all users" ON lap_former_production_detail;
DROP POLICY IF EXISTS "Enable delete for all users" ON lap_former_production_detail;

CREATE POLICY "Enable read access for all users" 
ON lap_former_production_detail FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON lap_former_production_detail FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON lap_former_production_detail FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON lap_former_production_detail FOR DELETE USING (true);

-- ============================================
-- 3. LAP FORMER STOPPAGE ENTRY TABLE
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
DROP POLICY IF EXISTS "Enable read access for all users" ON lap_former_stoppage_entry;
DROP POLICY IF EXISTS "Enable insert for all users" ON lap_former_stoppage_entry;
DROP POLICY IF EXISTS "Enable update for all users" ON lap_former_stoppage_entry;
DROP POLICY IF EXISTS "Enable delete for all users" ON lap_former_stoppage_entry;

CREATE POLICY "Enable read access for all users" 
ON lap_former_stoppage_entry FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON lap_former_stoppage_entry FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON lap_former_stoppage_entry FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON lap_former_stoppage_entry FOR DELETE USING (true);

-- ============================================
-- 4. LAP FORMER MACHINE SETUP TABLE
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
DROP POLICY IF EXISTS "Enable read access for all users" ON lap_former_machine_setup;
DROP POLICY IF EXISTS "Enable insert for all users" ON lap_former_machine_setup;
DROP POLICY IF EXISTS "Enable update for all users" ON lap_former_machine_setup;
DROP POLICY IF EXISTS "Enable delete for all users" ON lap_former_machine_setup;

CREATE POLICY "Enable read access for all users" 
ON lap_former_machine_setup FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON lap_former_machine_setup FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON lap_former_machine_setup FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" 
ON lap_former_machine_setup FOR DELETE USING (true);

-- ============================================
-- TRIGGERS FOR updated_at
-- ============================================
-- Create update function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
DROP TRIGGER IF EXISTS update_lf_prod_header_updated_at ON lap_former_production_header;
DROP TRIGGER IF EXISTS update_lf_prod_detail_updated_at ON lap_former_production_detail;
DROP TRIGGER IF EXISTS update_lf_stoppage_updated_at ON lap_former_stoppage_entry;
DROP TRIGGER IF EXISTS update_lf_machine_setup_updated_at ON lap_former_machine_setup;

CREATE TRIGGER update_lf_prod_header_updated_at 
  BEFORE UPDATE ON lap_former_production_header 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lf_prod_detail_updated_at 
  BEFORE UPDATE ON lap_former_production_detail 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lf_stoppage_updated_at 
  BEFORE UPDATE ON lap_former_stoppage_entry 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lf_machine_setup_updated_at 
  BEFORE UPDATE ON lap_former_machine_setup 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- UPDATE LAP FORMER MACHINES SPEED
-- The backup has wrong speeds (130, 94, 94)
-- Correct speeds from VB6: LF1=120, LF2=90, LF3=90
-- ============================================
UPDATE lap_former_machines SET speed = 120 WHERE machine_no = 'LF1';
UPDATE lap_former_machines SET speed = 90 WHERE machine_no = 'LF2';
UPDATE lap_former_machines SET speed = 90 WHERE machine_no = 'LF3';

-- Also update prodn_mixing to match VB6 screenshot
UPDATE lap_former_machines SET prodn_mixing = '64COMBED GOLD' WHERE machine_no IN ('LF1', 'LF2', 'LF3');

-- ============================================
-- INSERT MACHINE SETUP DATA
-- Formula Constants from VB6:
--   Hank = 0.0082
--   Std Effi = 0.85 (85%)
--   Divisor = 1693
--   Delivery = 1
--   Std Prodn = Speed / 1693 / 0.0082 × 510 × 0.85 × 1
--
-- LF1: 120 / 1693 / 0.0082 × 510 × 0.85 × 1 = 3747.14 kg
-- LF2: 90 / 1693 / 0.0082 × 510 × 0.85 × 1 = 2810.35 kg
-- LF3: 90 / 1693 / 0.0082 × 510 × 0.85 × 1 = 2810.35 kg
-- ============================================
INSERT INTO lap_former_machine_setup (machine_id, speed, hank_constant, std_efficiency_factor, default_waste, std_prodn, shift_time, divisor_constant, delivery)
SELECT 
  id,
  CASE machine_no WHEN 'LF1' THEN 120 ELSE 90 END as speed,
  0.0082 as hank_constant,
  0.85 as std_efficiency_factor,
  0.85 as default_waste,
  CASE machine_no WHEN 'LF1' THEN 3747.14 ELSE 2810.35 END as std_prodn,
  510 as shift_time,
  1693 as divisor_constant,
  1 as delivery
FROM lap_former_machines
WHERE machine_no IN ('LF1', 'LF2', 'LF3')
ON CONFLICT (machine_id) DO UPDATE SET
  speed = EXCLUDED.speed,
  hank_constant = EXCLUDED.hank_constant,
  std_efficiency_factor = EXCLUDED.std_efficiency_factor,
  std_prodn = EXCLUDED.std_prodn;

-- ============================================
-- LAP FORMER SPECIFIC STOPPAGE REASONS
-- Add if they don't exist
-- ============================================
DO $$
DECLARE
  v_stoppage_head_others UUID;
  v_dept_lap_former UUID;
BEGIN
  -- Get stoppage head for "OTHERS"
  SELECT id INTO v_stoppage_head_others FROM stoppage_heads WHERE stoppage_head_name ILIKE '%OTHER%' LIMIT 1;
  
  -- Get department for LAP FORMER (column is dept_name, not department)
  SELECT id INTO v_dept_lap_former FROM departments WHERE dept_name ILIKE '%LAP FORMER%' LIMIT 1;
  
  -- Insert Lap Former specific stoppages if they don't exist
  IF v_stoppage_head_others IS NOT NULL THEN
    INSERT INTO stoppage_details (stoppage_head_id, code, stoppage_name, short_code, description, department_id, is_active)
    VALUES 
      (v_stoppage_head_others, 1520, 'EXCESS STOCK', 'EIO', 'Excess stock stoppage - Lap Former', v_dept_lap_former, true),
      (v_stoppage_head_others, 1521, 'SPOOL CHANGE PROBLEM', 'SCP', 'Spool change problem', v_dept_lap_former, true),
      (v_stoppage_head_others, 1522, 'ERECTOR WORK', 'EW', 'Erector work stoppage', v_dept_lap_former, true)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================
-- SAMPLE DATA - 22-Apr-2025, Shift 1
-- Data extracted from VB6 screenshots
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
  v_detail_lf1 UUID;
  v_detail_lf2 UUID;
  v_detail_lf3 UUID;
BEGIN
  -- Get machine IDs (using actual UUIDs from backup)
  SELECT id INTO v_machine_lf1 FROM lap_former_machines WHERE machine_no = 'LF1';
  SELECT id INTO v_machine_lf2 FROM lap_former_machines WHERE machine_no = 'LF2';
  SELECT id INTO v_machine_lf3 FROM lap_former_machines WHERE machine_no = 'LF3';
  
  -- Get supervisor (CHINNADURA.R)
  SELECT id INTO v_supervisor_id FROM supervisors WHERE supervisor_name ILIKE '%CHINNADURA%' LIMIT 1;
  
  -- Get stoppage IDs
  SELECT id INTO v_stoppage_excess_stock FROM stoppage_details WHERE stoppage_name ILIKE '%EXCESS STOCK%' AND code >= 1500 LIMIT 1;
  SELECT id INTO v_stoppage_spool_change FROM stoppage_details WHERE stoppage_name ILIKE '%SPOOL%' LIMIT 1;
  SELECT id INTO v_stoppage_erector_work FROM stoppage_details WHERE stoppage_name ILIKE '%ERECTOR%' LIMIT 1;
  
  -- Only proceed if machines exist
  IF v_machine_lf1 IS NOT NULL AND v_machine_lf2 IS NOT NULL AND v_machine_lf3 IS NOT NULL THEN
    -- Create production header for 22-Apr-2025 Shift 1
    INSERT INTO lap_former_production_header (entry_date, shift, supervisor_id, total_time, remarks)
    VALUES ('2025-04-22', 1, v_supervisor_id, 510, 'VB6 Sample Data - Lap Former Entry')
    ON CONFLICT (entry_date, shift) DO UPDATE SET remarks = 'VB6 Sample Data - Lap Former Entry'
    RETURNING id INTO v_header_id;
    
    -- Delete existing details for this header (to avoid duplicates on re-run)
    DELETE FROM lap_former_production_detail WHERE header_id = v_header_id;
    
    -- Insert Production Details
    -- ============================================
    -- LF1: Act.Hank=28.36, Act.Prodn=1568.85 (from EL Measure)
    -- Stoppage: 180 + 120 = 300, WorkTime = 510-300 = 210
    -- StdProdn = 3747.14
    -- ExpProdn = 3747.14 × (210/510) = 1542.94
    -- ActEffi = 1568.85 / 1542.94 × 100 = 101.68%
    -- UTI = 210 / 510 × 100 = 41.18%
    -- Waste% = 0.85 / 1568.85 × 100 = 0.05%
    -- ============================================
    INSERT INTO lap_former_production_detail (
      header_id, machine_id, employee_name, prodn_mixing, 
      act_hank, act_prodn, std_prodn, exp_prodn, 
      effi_percent, uti_percent, waste, waste_percent, 
      run_time, work_time, session_no
    )
    VALUES (
      v_header_id, v_machine_lf1, 'MURUGESWARI. M', '64COMBED GOLD',
      28.36, 1568.85, 3747.14, 1542.94,
      101.68, 41.18, 0.85, 0.05,
      510, 210, 1
    )
    RETURNING id INTO v_detail_lf1;
    
    -- ============================================
    -- LF2: Act.Hank=17.14, Act.Prodn=948.17 (from EL Measure)
    -- Stoppage: 245 + 90 = 335, WorkTime = 510-335 = 175
    -- StdProdn = 2810.35
    -- ExpProdn = 2810.35 × (175/510) = 964.34
    -- ActEffi = 948.17 / 964.34 × 100 = 98.32%
    -- UTI = 175 / 510 × 100 = 34.31%
    -- Waste% = 0.85 / 948.17 × 100 = 0.09%
    -- ============================================
    INSERT INTO lap_former_production_detail (
      header_id, machine_id, employee_name, prodn_mixing, 
      act_hank, act_prodn, std_prodn, exp_prodn, 
      effi_percent, uti_percent, waste, waste_percent, 
      run_time, work_time, session_no
    )
    VALUES (
      v_header_id, v_machine_lf2, 'MURUGESWARI. M', '64COMBED GOLD',
      17.14, 948.17, 2810.35, 964.34,
      98.32, 34.31, 0.85, 0.09,
      510, 175, 1
    )
    RETURNING id INTO v_detail_lf2;
    
    -- ============================================
    -- LF3: Act.Hank=24.04, Act.Prodn=1329.87 (from EL Measure)
    -- Stoppage: 270 + 0 = 270, WorkTime = 510-270 = 240
    -- StdProdn = 2810.35
    -- ExpProdn = 2810.35 × (240/510) = 1322.52
    -- ActEffi = 1329.87 / 1322.52 × 100 = 100.56%
    -- UTI = 240 / 510 × 100 = 47.06%
    -- Waste% = 0.85 / 1329.87 × 100 = 0.06%
    -- ============================================
    INSERT INTO lap_former_production_detail (
      header_id, machine_id, employee_name, prodn_mixing, 
      act_hank, act_prodn, std_prodn, exp_prodn, 
      effi_percent, uti_percent, waste, waste_percent, 
      run_time, work_time, session_no
    )
    VALUES (
      v_header_id, v_machine_lf3, 'GANDHIMATHI K', '64COMBED GOLD',
      24.04, 1329.87, 2810.35, 1322.52,
      100.56, 47.06, 0.85, 0.06,
      510, 240, 1
    )
    RETURNING id INTO v_detail_lf3;
    
    -- Insert Stoppage Entries
    -- LF1: Excess Stock (180) + Spool Change (120) = 300
    IF v_detail_lf1 IS NOT NULL THEN
      INSERT INTO lap_former_stoppage_entry (
        production_detail_id, 
        stoppage1_id, stoppage1_time, 
        stoppage2_id, stoppage2_time, 
        total_stoppage_time
      )
      VALUES (
        v_detail_lf1, 
        v_stoppage_excess_stock, 180, 
        v_stoppage_spool_change, 120, 
        300
      )
      ON CONFLICT (production_detail_id) DO UPDATE SET
        stoppage1_id = EXCLUDED.stoppage1_id,
        stoppage1_time = EXCLUDED.stoppage1_time,
        stoppage2_id = EXCLUDED.stoppage2_id,
        stoppage2_time = EXCLUDED.stoppage2_time,
        total_stoppage_time = EXCLUDED.total_stoppage_time;
    END IF;
    
    -- LF2: Excess Stock (245) + Erector Work (90) = 335
    IF v_detail_lf2 IS NOT NULL THEN
      INSERT INTO lap_former_stoppage_entry (
        production_detail_id, 
        stoppage1_id, stoppage1_time, 
        stoppage2_id, stoppage2_time, 
        total_stoppage_time
      )
      VALUES (
        v_detail_lf2, 
        v_stoppage_excess_stock, 245, 
        v_stoppage_erector_work, 90, 
        335
      )
      ON CONFLICT (production_detail_id) DO UPDATE SET
        stoppage1_id = EXCLUDED.stoppage1_id,
        stoppage1_time = EXCLUDED.stoppage1_time,
        stoppage2_id = EXCLUDED.stoppage2_id,
        stoppage2_time = EXCLUDED.stoppage2_time,
        total_stoppage_time = EXCLUDED.total_stoppage_time;
    END IF;
    
    -- LF3: Excess Stock (270) only = 270
    IF v_detail_lf3 IS NOT NULL THEN
      INSERT INTO lap_former_stoppage_entry (
        production_detail_id, 
        stoppage1_id, stoppage1_time, 
        total_stoppage_time
      )
      VALUES (
        v_detail_lf3, 
        v_stoppage_excess_stock, 270, 
        270
      )
      ON CONFLICT (production_detail_id) DO UPDATE SET
        stoppage1_id = EXCLUDED.stoppage1_id,
        stoppage1_time = EXCLUDED.stoppage1_time,
        total_stoppage_time = EXCLUDED.total_stoppage_time;
    END IF;
    
    RAISE NOTICE 'Lap Former sample data inserted successfully!';
  ELSE
    RAISE NOTICE 'Lap Former machines not found. Please ensure lap_former_machines table has LF1, LF2, LF3.';
  END IF;
END $$;

-- ============================================
-- HELPER FUNCTIONS FOR CALCULATIONS
-- ============================================

-- Function to calculate Lap Former Std Prodn
CREATE OR REPLACE FUNCTION calc_lap_former_std_prodn(
  p_speed INTEGER,
  p_hank DECIMAL DEFAULT 0.0082,
  p_total_time INTEGER DEFAULT 510,
  p_std_effi DECIMAL DEFAULT 0.85,
  p_delivery INTEGER DEFAULT 1
)
RETURNS DECIMAL AS $$
BEGIN
  RETURN ROUND((p_speed::DECIMAL / 1693 / p_hank * p_total_time * p_std_effi * p_delivery)::DECIMAL, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate Lap Former Exp Prodn
CREATE OR REPLACE FUNCTION calc_lap_former_exp_prodn(
  p_std_prodn DECIMAL,
  p_work_time INTEGER,
  p_total_time INTEGER DEFAULT 510
)
RETURNS DECIMAL AS $$
BEGIN
  RETURN ROUND((p_std_prodn * (p_work_time::DECIMAL / p_total_time))::DECIMAL, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate Efficiency %
CREATE OR REPLACE FUNCTION calc_lap_former_efficiency(
  p_act_prodn DECIMAL,
  p_exp_prodn DECIMAL
)
RETURNS DECIMAL AS $$
BEGIN
  IF p_exp_prodn = 0 OR p_exp_prodn IS NULL THEN
    RETURN 0;
  END IF;
  RETURN ROUND((p_act_prodn / p_exp_prodn * 100)::DECIMAL, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate UTI %
CREATE OR REPLACE FUNCTION calc_lap_former_uti(
  p_work_time INTEGER,
  p_total_time INTEGER DEFAULT 510
)
RETURNS DECIMAL AS $$
BEGIN
  RETURN ROUND((p_work_time::DECIMAL / p_total_time * 100)::DECIMAL, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate Waste %
CREATE OR REPLACE FUNCTION calc_lap_former_waste_percent(
  p_waste DECIMAL,
  p_act_prodn DECIMAL
)
RETURNS DECIMAL AS $$
BEGIN
  IF p_act_prodn = 0 OR p_act_prodn IS NULL THEN
    RETURN 0;
  END IF;
  RETURN ROUND((p_waste / p_act_prodn * 100)::DECIMAL, 2);
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calc_lap_former_std_prodn TO authenticated;
GRANT EXECUTE ON FUNCTION calc_lap_former_exp_prodn TO authenticated;
GRANT EXECUTE ON FUNCTION calc_lap_former_efficiency TO authenticated;
GRANT EXECUTE ON FUNCTION calc_lap_former_uti TO authenticated;
GRANT EXECUTE ON FUNCTION calc_lap_former_waste_percent TO authenticated;

-- ============================================
-- FUNCTION TO GET AVAILABLE PREVIOUS DATES
-- For "Copy Previous Data" feature
-- ============================================
CREATE OR REPLACE FUNCTION get_lap_former_available_dates(
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
      FROM lap_former_production_detail d 
      WHERE d.header_id = h.id 
      AND (d.act_prodn > 0 OR d.employee_name IS NOT NULL)
    ) as has_details
  FROM lap_former_production_header h
  WHERE h.entry_date < p_before_date
    AND h.shift = p_shift
  ORDER BY h.entry_date DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_lap_former_available_dates TO authenticated;

-- ============================================
-- VERIFICATION QUERIES
-- Uncomment to test after running
-- ============================================

-- Check machine setup
-- SELECT 
--   lfm.machine_no, 
--   lfs.speed, 
--   lfs.hank_constant, 
--   lfs.std_efficiency_factor,
--   lfs.std_prodn,
--   lfs.delivery
-- FROM lap_former_machine_setup lfs
-- JOIN lap_former_machines lfm ON lfs.machine_id = lfm.id
-- ORDER BY lfm.mc_id;

-- Check production details (should match VB6 grid)
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

-- Check stoppage entries
-- SELECT 
--   lfm.machine_no,
--   lfs.stoppage1_time,
--   lfs.stoppage2_time,
--   lfs.total_stoppage_time
-- FROM lap_former_stoppage_entry lfs
-- JOIN lap_former_production_detail lfpd ON lfs.production_detail_id = lfpd.id
-- JOIN lap_former_machines lfm ON lfpd.machine_id = lfm.id
-- JOIN lap_former_production_header lfph ON lfpd.header_id = lfph.id
-- WHERE lfph.entry_date = '2025-04-22' AND lfph.shift = 1
-- ORDER BY lfm.mc_id;

-- Test calculation functions
-- SELECT 
--   calc_lap_former_std_prodn(120) as "LF1 Std Prodn (should be 3747.14)",
--   calc_lap_former_std_prodn(90) as "LF2/LF3 Std Prodn (should be 2810.35)";

SELECT 'Lap Former Entry Module - Setup Complete!' as status;
