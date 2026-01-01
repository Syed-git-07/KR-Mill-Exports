-- =====================================================
-- SIMPLEX ENTRY MODULE - Database Schema
-- Module 21: Simplex Production Entry (Preparatory Entry)
-- Created: December 31, 2025
-- =====================================================
-- This module manages production data entry for Simplex/Speed Frame machines (1-10)
-- Unique features: Idle Spindles input, TPI, Spindles count in calculations
-- Formula: Act.Prodn = (Speed / TPI / 39.3 / 1693 / Hank) × RunMin × Active Spindles
-- =====================================================

-- =====================================================
-- TABLE 1: simplex_production_header
-- Stores header information for each shift entry
-- =====================================================
CREATE TABLE IF NOT EXISTS simplex_production_header (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id SERIAL,
  entry_date DATE NOT NULL,
  shift INTEGER NOT NULL CHECK (shift IN (1, 2, 3)),
  supervisor_id UUID REFERENCES supervisors(id),
  maisitry_id UUID REFERENCES supervisors(id),
  total_time INTEGER DEFAULT 510,
  remarks TEXT,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_date, shift)
);

-- Enable RLS
ALTER TABLE simplex_production_header ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Enable all operations for authenticated users" ON simplex_production_header
    FOR ALL USING (auth.role() = 'authenticated');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_simplex_production_header_date ON simplex_production_header(entry_date);
CREATE INDEX IF NOT EXISTS idx_simplex_production_header_shift ON simplex_production_header(shift);
CREATE INDEX IF NOT EXISTS idx_simplex_production_header_date_shift ON simplex_production_header(entry_date, shift);

-- =====================================================
-- TABLE 2: simplex_production_detail
-- Stores production data for each machine per shift
-- =====================================================
CREATE TABLE IF NOT EXISTS simplex_production_detail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  header_id UUID NOT NULL REFERENCES simplex_production_header(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES simplex_machines(id),
  employee_name VARCHAR(100),
  prodn_mixing VARCHAR(50),
  run_hrs DECIMAL(5,2),                -- HH.MM format input (e.g., 7.12 = 7hr 12min)
  run_min INTEGER,                      -- Calculated: Hours×60 + Minutes
  idle_spindles INTEGER DEFAULT 0,      -- Idle spindles count (UNIQUE to Simplex)
  waste DECIMAL(10,4) DEFAULT 0.9,
  act_prodn DECIMAL(10,2),              -- Calculated: Simplex formula with active spindles
  waste_percent DECIMAL(5,2),           -- Calculated: (Waste/Act.Prodn)*100
  act_effi_percent DECIMAL(5,2),        -- Calculated: (RunMin/Std.hrs)*100
  uti_percent DECIMAL(5,2),             -- Calculated: (WorkTime/TotalTime)*100
  std_hrs DECIMAL(10,2),                -- Calculated: WorkTime × MCEffi/100
  work_time INTEGER DEFAULT 510,        -- Calculated: TotalTime - TotalStoppage
  session_no INTEGER DEFAULT 1,
  is_locked BOOLEAN DEFAULT false,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE simplex_production_detail ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Enable all operations for authenticated users" ON simplex_production_detail
    FOR ALL USING (auth.role() = 'authenticated');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_simplex_production_detail_header ON simplex_production_detail(header_id);
CREATE INDEX IF NOT EXISTS idx_simplex_production_detail_machine ON simplex_production_detail(machine_id);

-- =====================================================
-- TABLE 3: simplex_stoppage_entry
-- Stores stoppage data for each machine (up to 4 stoppages)
-- =====================================================
CREATE TABLE IF NOT EXISTS simplex_stoppage_entry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_detail_id UUID NOT NULL REFERENCES simplex_production_detail(id) ON DELETE CASCADE,
  stoppage1_id UUID REFERENCES stoppage_details(id),
  stoppage1_time INTEGER DEFAULT 0,
  stoppage2_id UUID REFERENCES stoppage_details(id),
  stoppage2_time INTEGER DEFAULT 0,
  stoppage3_id UUID REFERENCES stoppage_details(id),
  stoppage3_time INTEGER DEFAULT 0,
  stoppage4_id UUID REFERENCES stoppage_details(id),
  stoppage4_time INTEGER DEFAULT 0,
  total_stoppage_time INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE simplex_stoppage_entry ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Enable all operations for authenticated users" ON simplex_stoppage_entry
    FOR ALL USING (auth.role() = 'authenticated');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_simplex_stoppage_entry_detail ON simplex_stoppage_entry(production_detail_id);

-- =====================================================
-- TABLE 4: simplex_machine_setup
-- Stores machine configuration for calculations
-- =====================================================
CREATE TABLE IF NOT EXISTS simplex_machine_setup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES simplex_machines(id),
  prodn_mixing VARCHAR(50),             -- Count/Mixing selection
  session_no INTEGER DEFAULT 1,
  cc_time INTEGER DEFAULT 0,            -- Can Change Time
  sl_hank DECIMAL(10,4) DEFAULT 1.4,    -- Sliver Hank (1.4, not 0.14!)
  mc_effi INTEGER DEFAULT 92,           -- Machine Efficiency % (92%)
  tpi DECIMAL(5,2) DEFAULT 1.73,        -- TPI value (unique to Simplex)
  spindles INTEGER DEFAULT 140,          -- Number of spindles (unique to Simplex)
  shift_time INTEGER DEFAULT 510,
  default_waste DECIMAL(10,4) DEFAULT 0.9,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(machine_id)
);

-- Enable RLS
ALTER TABLE simplex_machine_setup ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Enable all operations for authenticated users" ON simplex_machine_setup
    FOR ALL USING (auth.role() = 'authenticated');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_simplex_machine_setup_machine ON simplex_machine_setup(machine_id);

-- =====================================================
-- FUNCTION: Copy Previous Data for Simplex Entry
-- Copies production, stoppage, and machine setup data from a previous date
-- =====================================================
CREATE OR REPLACE FUNCTION copy_simplex_previous_data(
  p_source_date DATE,
  p_source_shift INTEGER,
  p_target_date DATE,
  p_target_shift INTEGER,
  p_supervisor_id UUID DEFAULT NULL,
  p_maisitry_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_source_header_id UUID;
  v_target_header_id UUID;
  v_detail_record RECORD;
  v_new_detail_id UUID;
BEGIN
  -- Get source header
  SELECT id INTO v_source_header_id
  FROM simplex_production_header
  WHERE entry_date = p_source_date AND shift = p_source_shift;
  
  IF v_source_header_id IS NULL THEN
    RAISE EXCEPTION 'Source data not found for date % shift %', p_source_date, p_source_shift;
  END IF;
  
  -- Check if target already exists
  SELECT id INTO v_target_header_id
  FROM simplex_production_header
  WHERE entry_date = p_target_date AND shift = p_target_shift;
  
  IF v_target_header_id IS NOT NULL THEN
    RAISE EXCEPTION 'Target data already exists for date % shift %', p_target_date, p_target_shift;
  END IF;
  
  -- Create new header
  INSERT INTO simplex_production_header (
    entry_date, shift, supervisor_id, maisitry_id, total_time, remarks
  )
  SELECT 
    p_target_date, 
    p_target_shift, 
    COALESCE(p_supervisor_id, supervisor_id),
    COALESCE(p_maisitry_id, maisitry_id),
    total_time,
    'Copied from ' || p_source_date || ' Shift ' || p_source_shift
  FROM simplex_production_header
  WHERE id = v_source_header_id
  RETURNING id INTO v_target_header_id;
  
  -- Copy production details and stoppage entries
  FOR v_detail_record IN 
    SELECT * FROM simplex_production_detail WHERE header_id = v_source_header_id
  LOOP
    -- Insert production detail
    INSERT INTO simplex_production_detail (
      header_id, machine_id, employee_name, prodn_mixing,
      run_hrs, run_min, idle_spindles, waste, act_prodn,
      waste_percent, act_effi_percent, uti_percent, std_hrs,
      work_time, session_no
    )
    VALUES (
      v_target_header_id, v_detail_record.machine_id, v_detail_record.employee_name,
      v_detail_record.prodn_mixing, v_detail_record.run_hrs, v_detail_record.run_min,
      v_detail_record.idle_spindles, v_detail_record.waste, v_detail_record.act_prodn,
      v_detail_record.waste_percent, v_detail_record.act_effi_percent, v_detail_record.uti_percent,
      v_detail_record.std_hrs, v_detail_record.work_time, v_detail_record.session_no
    )
    RETURNING id INTO v_new_detail_id;
    
    -- Copy stoppage entry
    INSERT INTO simplex_stoppage_entry (
      production_detail_id, stoppage1_id, stoppage1_time,
      stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time,
      stoppage4_id, stoppage4_time, total_stoppage_time
    )
    SELECT 
      v_new_detail_id, stoppage1_id, stoppage1_time,
      stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time,
      stoppage4_id, stoppage4_time, total_stoppage_time
    FROM simplex_stoppage_entry
    WHERE production_detail_id = v_detail_record.id;
  END LOOP;
  
  RETURN v_target_header_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Get available dates for Copy Previous Data
-- Returns list of dates that have simplex entry data
-- =====================================================
CREATE OR REPLACE FUNCTION get_simplex_available_dates(p_exclude_date DATE DEFAULT NULL)
RETURNS TABLE (
  entry_date DATE,
  shift INTEGER,
  supervisor_name TEXT,
  machine_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.entry_date,
    h.shift,
    COALESCE(s.supervisor_name, 'N/A') as supervisor_name,
    COUNT(d.id) as machine_count
  FROM simplex_production_header h
  LEFT JOIN supervisors s ON h.supervisor_id = s.id
  LEFT JOIN simplex_production_detail d ON h.id = d.header_id
  WHERE (p_exclude_date IS NULL OR h.entry_date != p_exclude_date)
  GROUP BY h.entry_date, h.shift, s.supervisor_name
  ORDER BY h.entry_date DESC, h.shift DESC
  LIMIT 30;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Calculate Simplex Production
-- Calculates Act.Prodn using the Simplex formula
-- Act.Prodn = (Speed / TPI / 39.3 / 1693 / Hank) × RunMin × Active Spindles
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_simplex_production(
  p_speed INTEGER,
  p_tpi DECIMAL,
  p_hank DECIMAL,
  p_run_min INTEGER,
  p_total_spindles INTEGER,
  p_idle_spindles INTEGER DEFAULT 0
)
RETURNS DECIMAL AS $$
DECLARE
  v_active_spindles INTEGER;
  v_production DECIMAL;
BEGIN
  -- Calculate active spindles
  v_active_spindles := p_total_spindles - COALESCE(p_idle_spindles, 0);
  
  -- Simplex production formula
  -- Act.Prodn = (Speed / TPI / 39.3 / 1693 / Hank) × RunMin × Active Spindles
  v_production := (p_speed::DECIMAL / p_tpi / 39.3 / 1693 / p_hank) * p_run_min * v_active_spindles;
  
  RETURN ROUND(v_production, 2);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Parse Run Hours (HH.MM format)
-- Converts HH.MM format to minutes
-- Example: 7.12 = 7 hours 12 minutes = 432 minutes
-- =====================================================
CREATE OR REPLACE FUNCTION parse_run_hours_to_minutes(p_run_hrs DECIMAL)
RETURNS INTEGER AS $$
DECLARE
  v_hours INTEGER;
  v_minutes INTEGER;
BEGIN
  -- Extract hours (integer part)
  v_hours := FLOOR(p_run_hrs);
  
  -- Extract minutes (decimal part × 100)
  v_minutes := ROUND((p_run_hrs - v_hours) * 100);
  
  -- Return total minutes
  RETURN (v_hours * 60) + v_minutes;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SAMPLE DATA INSERTION
-- Date: 31-Dec-2025, Shift: 1
-- =====================================================
DO $$
DECLARE
  v_header_id UUID;
  v_machine_id UUID;
  v_detail_id UUID;
  v_supervisor_id UUID;
  v_stoppage_excess_stock UUID;
  v_stoppage_qad_work UUID;
  v_stoppage_flyer_greasing UUID;
  v_stoppage_idle_checking UUID;
BEGIN
  -- Get supervisor ID (LOGAMMAL G or first available)
  SELECT id INTO v_supervisor_id FROM supervisors WHERE supervisor_name ILIKE '%LOGAMMAL%' LIMIT 1;
  IF v_supervisor_id IS NULL THEN
    SELECT id INTO v_supervisor_id FROM supervisors WHERE is_active = true LIMIT 1;
  END IF;

  -- Get or create stoppage reasons for Simplex
  -- Note: These should already exist in stoppage_details table
  SELECT id INTO v_stoppage_excess_stock FROM stoppage_details WHERE short_code = 'EIU' OR stoppage_name ILIKE '%EXCESS STOCK%' LIMIT 1;
  SELECT id INTO v_stoppage_qad_work FROM stoppage_details WHERE short_code = 'QW' OR stoppage_name ILIKE '%QAD WORK%' LIMIT 1;
  SELECT id INTO v_stoppage_flyer_greasing FROM stoppage_details WHERE short_code = 'fg' OR stoppage_name ILIKE '%FLYER GREASING%' LIMIT 1;
  SELECT id INTO v_stoppage_idle_checking FROM stoppage_details WHERE short_code = 'IDE' OR stoppage_name ILIKE '%IDLE CHECKING%' LIMIT 1;

  -- Insert header for 31-Dec-2025, Shift 1
  INSERT INTO simplex_production_header (entry_date, shift, supervisor_id, total_time, remarks)
  VALUES ('2025-12-31', 1, v_supervisor_id, 510, 'Sample data for Simplex Entry')
  ON CONFLICT (entry_date, shift) DO UPDATE SET remarks = 'Sample data for Simplex Entry'
  RETURNING id INTO v_header_id;

  -- Insert machine setup data for all 10 machines
  -- Machine 1: TPI=1.73, Spindles=140
  SELECT id INTO v_machine_id FROM simplex_machines WHERE machine_no = '1' LIMIT 1;
  IF v_machine_id IS NOT NULL THEN
    INSERT INTO simplex_machine_setup (machine_id, prodn_mixing, session_no, cc_time, sl_hank, mc_effi, tpi, spindles)
    VALUES (v_machine_id, '64COMBED GOLD', 1, 0, 1.4, 92, 1.73, 140)
    ON CONFLICT (machine_id) DO UPDATE SET prodn_mixing = '64COMBED GOLD', tpi = 1.73, spindles = 140;
    
    -- Production detail for Machine 1
    INSERT INTO simplex_production_detail (header_id, machine_id, employee_name, prodn_mixing, run_hrs, run_min, idle_spindles, waste, act_prodn, waste_percent, act_effi_percent, uti_percent, std_hrs, work_time, session_no)
    VALUES (v_header_id, v_machine_id, 'KARPAGAVALLI K', '64COMBED GOLD', 7.12, 432, 0, 0.9, 389.55, 0.23, 97.83, 94.12, 441.6, 480, 1)
    RETURNING id INTO v_detail_id;
    
    -- Stoppage for Machine 1
    INSERT INTO simplex_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, stoppage4_id, stoppage4_time, total_stoppage_time)
    VALUES (v_detail_id, v_stoppage_excess_stock, 30, NULL, 0, NULL, 0, NULL, 0, 30);
  END IF;

  -- Machine 2: TPI=1.73, Spindles=140
  SELECT id INTO v_machine_id FROM simplex_machines WHERE machine_no = '2' LIMIT 1;
  IF v_machine_id IS NOT NULL THEN
    INSERT INTO simplex_machine_setup (machine_id, prodn_mixing, session_no, cc_time, sl_hank, mc_effi, tpi, spindles)
    VALUES (v_machine_id, '64COMBED GOLD', 1, 0, 1.4, 92, 1.73, 140)
    ON CONFLICT (machine_id) DO UPDATE SET prodn_mixing = '64COMBED GOLD', tpi = 1.73, spindles = 140;
    
    INSERT INTO simplex_production_detail (header_id, machine_id, employee_name, prodn_mixing, run_hrs, run_min, idle_spindles, waste, act_prodn, waste_percent, act_effi_percent, uti_percent, std_hrs, work_time, session_no)
    VALUES (v_header_id, v_machine_id, 'KARPAGAVALLI K', '64COMBED GOLD', 7.02, 422, 0, 0.9, 380.53, 0.24, 95.56, 94.12, 441.6, 480, 1)
    RETURNING id INTO v_detail_id;
    
    INSERT INTO simplex_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, stoppage4_id, stoppage4_time, total_stoppage_time)
    VALUES (v_detail_id, v_stoppage_excess_stock, 30, NULL, 0, NULL, 0, NULL, 0, 30);
  END IF;

  -- Machine 3: TPI=1.73, Spindles=140
  SELECT id INTO v_machine_id FROM simplex_machines WHERE machine_no = '3' LIMIT 1;
  IF v_machine_id IS NOT NULL THEN
    INSERT INTO simplex_machine_setup (machine_id, prodn_mixing, session_no, cc_time, sl_hank, mc_effi, tpi, spindles)
    VALUES (v_machine_id, '64COMBED GOLD', 1, 0, 1.4, 92, 1.73, 140)
    ON CONFLICT (machine_id) DO UPDATE SET prodn_mixing = '64COMBED GOLD', tpi = 1.73, spindles = 140;
    
    INSERT INTO simplex_production_detail (header_id, machine_id, employee_name, prodn_mixing, run_hrs, run_min, idle_spindles, waste, act_prodn, waste_percent, act_effi_percent, uti_percent, std_hrs, work_time, session_no)
    VALUES (v_header_id, v_machine_id, 'MAHESHWARI T', '64COMBED GOLD', 7.05, 425, 0, 0.87, 383.23, 0.23, 96.24, 94.12, 441.6, 480, 1)
    RETURNING id INTO v_detail_id;
    
    INSERT INTO simplex_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, stoppage4_id, stoppage4_time, total_stoppage_time)
    VALUES (v_detail_id, v_stoppage_excess_stock, 30, NULL, 0, NULL, 0, NULL, 0, 30);
  END IF;

  -- Machine 4: TPI=1.73, Spindles=120
  SELECT id INTO v_machine_id FROM simplex_machines WHERE machine_no = '4' LIMIT 1;
  IF v_machine_id IS NOT NULL THEN
    INSERT INTO simplex_machine_setup (machine_id, prodn_mixing, session_no, cc_time, sl_hank, mc_effi, tpi, spindles)
    VALUES (v_machine_id, '64COMBED GOLD', 1, 0, 1.4, 92, 1.73, 120)
    ON CONFLICT (machine_id) DO UPDATE SET prodn_mixing = '64COMBED GOLD', tpi = 1.73, spindles = 120;
    
    INSERT INTO simplex_production_detail (header_id, machine_id, employee_name, prodn_mixing, run_hrs, run_min, idle_spindles, waste, act_prodn, waste_percent, act_effi_percent, uti_percent, std_hrs, work_time, session_no)
    VALUES (v_header_id, v_machine_id, 'AMUDHA V', '64COMBED GOLD', 6.26, 386, 0, 0.8, 293.22, 0.27, 97.98, 94.12, 370.8, 403, 1)
    RETURNING id INTO v_detail_id;
    
    INSERT INTO simplex_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, stoppage4_id, stoppage4_time, total_stoppage_time)
    VALUES (v_detail_id, v_stoppage_qad_work, 107, NULL, 0, NULL, 0, NULL, 0, 107);
  END IF;

  -- Machine 5: TPI=1.73, Spindles=140
  SELECT id INTO v_machine_id FROM simplex_machines WHERE machine_no = '5' LIMIT 1;
  IF v_machine_id IS NOT NULL THEN
    INSERT INTO simplex_machine_setup (machine_id, prodn_mixing, session_no, cc_time, sl_hank, mc_effi, tpi, spindles)
    VALUES (v_machine_id, '64COMBED GOLD', 1, 0, 1.4, 92, 1.73, 140)
    ON CONFLICT (machine_id) DO UPDATE SET prodn_mixing = '64COMBED GOLD', tpi = 1.73, spindles = 140;
    
    INSERT INTO simplex_production_detail (header_id, machine_id, employee_name, prodn_mixing, run_hrs, run_min, idle_spindles, waste, act_prodn, waste_percent, act_effi_percent, uti_percent, std_hrs, work_time, session_no)
    VALUES (v_header_id, v_machine_id, 'AMUDHA V', '64COMBED GOLD', 6.26, 386, 0, 0.8, 329.3, 0.24, 85.45, 94.12, 438.8, 477, 1)
    RETURNING id INTO v_detail_id;
    
    INSERT INTO simplex_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, stoppage4_id, stoppage4_time, total_stoppage_time)
    VALUES (v_detail_id, v_stoppage_excess_stock, 33, NULL, 0, NULL, 0, NULL, 0, 33);
  END IF;

  -- Machine 6: TPI=1.73, Spindles=120
  SELECT id INTO v_machine_id FROM simplex_machines WHERE machine_no = '6' LIMIT 1;
  IF v_machine_id IS NOT NULL THEN
    INSERT INTO simplex_machine_setup (machine_id, prodn_mixing, session_no, cc_time, sl_hank, mc_effi, tpi, spindles)
    VALUES (v_machine_id, '64COMBED GOLD', 1, 0, 1.4, 92, 1.73, 120)
    ON CONFLICT (machine_id) DO UPDATE SET prodn_mixing = '64COMBED GOLD', tpi = 1.73, spindles = 120;
    
    INSERT INTO simplex_production_detail (header_id, machine_id, employee_name, prodn_mixing, run_hrs, run_min, idle_spindles, waste, act_prodn, waste_percent, act_effi_percent, uti_percent, std_hrs, work_time, session_no)
    VALUES (v_header_id, v_machine_id, 'DHANALAKSHMI R', '64COMBED GOLD', 6.48, 408, 0, 0.85, 340.97, 0.25, 103.47, 94.12, 370.8, 403, 1)
    RETURNING id INTO v_detail_id;
    
    INSERT INTO simplex_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, stoppage4_id, stoppage4_time, total_stoppage_time)
    VALUES (v_detail_id, v_stoppage_flyer_greasing, 77, v_stoppage_excess_stock, 30, NULL, 0, NULL, 0, 107);
  END IF;

  -- Machine 7: TPI=1.69, Spindles=120
  SELECT id INTO v_machine_id FROM simplex_machines WHERE machine_no = '7' LIMIT 1;
  IF v_machine_id IS NOT NULL THEN
    INSERT INTO simplex_machine_setup (machine_id, prodn_mixing, session_no, cc_time, sl_hank, mc_effi, tpi, spindles)
    VALUES (v_machine_id, '64COMBED GOLD', 1, 0, 1.4, 92, 1.69, 120)
    ON CONFLICT (machine_id) DO UPDATE SET prodn_mixing = '64COMBED GOLD', tpi = 1.69, spindles = 120;
    
    INSERT INTO simplex_production_detail (header_id, machine_id, employee_name, prodn_mixing, run_hrs, run_min, idle_spindles, waste, act_prodn, waste_percent, act_effi_percent, uti_percent, std_hrs, work_time, session_no)
    VALUES (v_header_id, v_machine_id, 'ESAKKISELVI S', '64COMBED GOLD', 6.41, 401, 0, 0.9, 305.89, 0.29, 93.79, 95.1, 426.6, 464, 1)
    RETURNING id INTO v_detail_id;
    
    INSERT INTO simplex_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, stoppage4_id, stoppage4_time, total_stoppage_time)
    VALUES (v_detail_id, v_stoppage_flyer_greasing, 21, v_stoppage_idle_checking, 25, NULL, 0, NULL, 0, 46);
  END IF;

  -- Machine 8: TPI=1.69, Spindles=120
  SELECT id INTO v_machine_id FROM simplex_machines WHERE machine_no = '8' LIMIT 1;
  IF v_machine_id IS NOT NULL THEN
    INSERT INTO simplex_machine_setup (machine_id, prodn_mixing, session_no, cc_time, sl_hank, mc_effi, tpi, spindles)
    VALUES (v_machine_id, '64COMBED GOLD', 1, 0, 1.4, 92, 1.69, 120)
    ON CONFLICT (machine_id) DO UPDATE SET prodn_mixing = '64COMBED GOLD', tpi = 1.69, spindles = 120;
    
    INSERT INTO simplex_production_detail (header_id, machine_id, employee_name, prodn_mixing, run_hrs, run_min, idle_spindles, waste, act_prodn, waste_percent, act_effi_percent, uti_percent, std_hrs, work_time, session_no)
    VALUES (v_header_id, v_machine_id, 'ESAKKISELVI S', '64COMBED GOLD', 6.07, 367, 0, 0.85, 280.0, 0.30, 85.96, 95.1, 426.6, 464, 1)
    RETURNING id INTO v_detail_id;
    
    INSERT INTO simplex_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, stoppage4_id, stoppage4_time, total_stoppage_time)
    VALUES (v_detail_id, v_stoppage_flyer_greasing, 21, v_stoppage_idle_checking, 25, NULL, 0, NULL, 0, 46);
  END IF;

  -- Machine 9: TPI=1.73, Spindles=140, Idle Spindles=1 (IMPORTANT!)
  SELECT id INTO v_machine_id FROM simplex_machines WHERE machine_no = '9' LIMIT 1;
  IF v_machine_id IS NOT NULL THEN
    INSERT INTO simplex_machine_setup (machine_id, prodn_mixing, session_no, cc_time, sl_hank, mc_effi, tpi, spindles)
    VALUES (v_machine_id, '64COMBED GOLD', 1, 0, 1.4, 92, 1.73, 140)
    ON CONFLICT (machine_id) DO UPDATE SET prodn_mixing = '64COMBED GOLD', tpi = 1.73, spindles = 140;
    
    -- Note: idle_spindles = 1 for this machine
    INSERT INTO simplex_production_detail (header_id, machine_id, employee_name, prodn_mixing, run_hrs, run_min, idle_spindles, waste, act_prodn, waste_percent, act_effi_percent, uti_percent, std_hrs, work_time, session_no)
    VALUES (v_header_id, v_machine_id, 'ESAKKISELVI S', '64COMBED GOLD', 6.29, 389, 1, 0.95, 298.16, 0.32, 87.18, 95.1, 446.2, 485, 1)
    RETURNING id INTO v_detail_id;
    
    INSERT INTO simplex_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, stoppage4_id, stoppage4_time, total_stoppage_time)
    VALUES (v_detail_id, v_stoppage_idle_checking, 25, NULL, 0, NULL, 0, NULL, 0, 25);
  END IF;

  -- Machine 10: TPI=1.69, Spindles=120, Idle Spindles=2 (IMPORTANT!)
  SELECT id INTO v_machine_id FROM simplex_machines WHERE machine_no = '10' LIMIT 1;
  IF v_machine_id IS NOT NULL THEN
    INSERT INTO simplex_machine_setup (machine_id, prodn_mixing, session_no, cc_time, sl_hank, mc_effi, tpi, spindles)
    VALUES (v_machine_id, '64COMBED GOLD', 1, 0, 1.44, 92, 1.69, 120)
    ON CONFLICT (machine_id) DO UPDATE SET prodn_mixing = '64COMBED GOLD', sl_hank = 1.44, tpi = 1.69, spindles = 120;
    
    -- Note: idle_spindles = 2 for this machine
    INSERT INTO simplex_production_detail (header_id, machine_id, employee_name, prodn_mixing, run_hrs, run_min, idle_spindles, waste, act_prodn, waste_percent, act_effi_percent, uti_percent, std_hrs, work_time, session_no)
    VALUES (v_header_id, v_machine_id, 'SAGUNTHALA V', '64COMBED GOLD', 7.2, 440, 2, 0.8, 332.82, 0.24, 93.78, 100, 469.2, 510, 1)
    RETURNING id INTO v_detail_id;
    
    -- No stoppage for Machine 10
    INSERT INTO simplex_stoppage_entry (production_detail_id, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, stoppage4_id, stoppage4_time, total_stoppage_time)
    VALUES (v_detail_id, NULL, 0, NULL, 0, NULL, 0, NULL, 0, 0);
  END IF;

  RAISE NOTICE 'Sample data inserted successfully for Simplex Entry (31-Dec-2025, Shift 1)';
END $$;

-- =====================================================
-- INSERT SIMPLEX-SPECIFIC STOPPAGE REASONS
-- If they don't already exist in stoppage_details
-- =====================================================
DO $$
DECLARE
  v_head_id UUID;
BEGIN
  -- Get or create a stoppage head for Simplex
  SELECT id INTO v_head_id FROM stoppage_heads WHERE stoppage_head_name ILIKE '%SIMPLEX%' LIMIT 1;
  
  IF v_head_id IS NULL THEN
    SELECT id INTO v_head_id FROM stoppage_heads WHERE stoppage_head_name ILIKE '%PREPARATORY%' LIMIT 1;
  END IF;
  
  IF v_head_id IS NULL THEN
    SELECT id INTO v_head_id FROM stoppage_heads LIMIT 1;
  END IF;
  
  IF v_head_id IS NOT NULL THEN
    -- Insert Simplex-specific stoppage reasons if not exist
    INSERT INTO stoppage_details (stoppage_head_id, code, stoppage_name, description, short_code, is_active)
    VALUES 
      (v_head_id, 1301, 'EXCESS STOCK', 'Excess stock in machine', 'EIU', true),
      (v_head_id, 1302, 'QAD WORK', 'Quality assurance department work', 'QW', true),
      (v_head_id, 1303, 'FLYER GREASING', 'Flyer greasing maintenance', 'fg', true),
      (v_head_id, 1304, 'IDLE CHECKING', 'Idle spindle checking', 'IDE', true),
      (v_head_id, 1305, 'BOBBIN DOFF', 'Bobbin doffing operation', 'BD', true),
      (v_head_id, 1306, 'CREEL CHANGE', 'Creel change operation', 'CC', true),
      (v_head_id, 1307, 'SLIVER BREAKAGE', 'Sliver breakage repair', 'SB', true),
      (v_head_id, 1308, 'MECHANICAL FAULT', 'Mechanical fault repair', 'MF', true),
      (v_head_id, 1309, 'ELECTRICAL FAULT', 'Electrical fault repair', 'EF', true),
      (v_head_id, 1310, 'NO MATERIAL', 'No material available', 'NM', true)
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Simplex stoppage reasons inserted/verified';
  END IF;
END $$;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Verify tables created
SELECT 'simplex_production_header' as table_name, COUNT(*) as row_count FROM simplex_production_header
UNION ALL
SELECT 'simplex_production_detail', COUNT(*) FROM simplex_production_detail
UNION ALL
SELECT 'simplex_stoppage_entry', COUNT(*) FROM simplex_stoppage_entry
UNION ALL
SELECT 'simplex_machine_setup', COUNT(*) FROM simplex_machine_setup;

-- View sample production data
SELECT 
  m.machine_no,
  d.employee_name,
  d.prodn_mixing,
  d.run_hrs,
  d.run_min,
  d.idle_spindles,
  d.waste,
  d.act_prodn,
  d.waste_percent,
  d.act_effi_percent,
  d.uti_percent,
  d.std_hrs,
  d.work_time
FROM simplex_production_detail d
JOIN simplex_machines m ON d.machine_id = m.id
JOIN simplex_production_header h ON d.header_id = h.id
WHERE h.entry_date = '2025-12-31' AND h.shift = 1
ORDER BY m.machine_no::INTEGER;

-- View machine setup
SELECT 
  m.machine_no,
  s.prodn_mixing,
  s.session_no,
  s.cc_time,
  s.sl_hank,
  s.mc_effi,
  s.tpi,
  s.spindles
FROM simplex_machine_setup s
JOIN simplex_machines m ON s.machine_id = m.id
ORDER BY m.machine_no::INTEGER;
