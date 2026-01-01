-- =====================================================
-- Comber - Copy Previous Data Enhancement
-- Created: 30-Dec-2025
-- =====================================================
-- This script adds optimizations for the "Copy Previous Data" functionality
-- which allows copying production data from any past date instead of just yesterday
-- =====================================================

-- Create index for faster date-based queries on production headers
CREATE INDEX IF NOT EXISTS idx_comber_header_date_shift 
ON comber_production_header(entry_date DESC, shift);

-- Create index on production_detail for faster header lookups
CREATE INDEX IF NOT EXISTS idx_comber_detail_header_id 
ON comber_production_detail(header_id);

-- Create index on stoppage_entry for faster detail lookups
CREATE INDEX IF NOT EXISTS idx_comber_stoppage_detail_id 
ON comber_stoppage_entry(production_detail_id);

-- =====================================================
-- Function to get available previous dates with data
-- =====================================================
CREATE OR REPLACE FUNCTION get_comber_available_dates(
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
      FROM comber_production_detail d 
      WHERE d.header_id = h.id 
      AND (d.act_prodn > 0 OR d.employee_name IS NOT NULL)
    ) as has_details
  FROM comber_production_header h
  WHERE h.entry_date < p_before_date
    AND h.shift = p_shift
  ORDER BY h.entry_date DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_comber_available_dates TO authenticated;

COMMENT ON FUNCTION get_comber_available_dates IS 
  'Returns list of previous dates that have production data for the specified shift. 
   Used by Copy Previous Data feature to show available dates to copy from.';

-- =====================================================
-- Function to copy production data from source date to target
-- =====================================================
CREATE OR REPLACE FUNCTION copy_comber_production_data(
  p_source_date DATE,
  p_source_shift INTEGER,
  p_target_date DATE,
  p_target_shift INTEGER
)
RETURNS JSON AS $$
DECLARE
  v_source_header_id UUID;
  v_target_header_id UUID;
  v_source_detail RECORD;
  v_target_detail_id UUID;
  v_source_stoppage RECORD;
  v_copied_count INTEGER := 0;
  v_result JSON;
BEGIN
  -- Get source header
  SELECT id INTO v_source_header_id 
  FROM comber_production_header 
  WHERE entry_date = p_source_date AND shift = p_source_shift;
  
  IF v_source_header_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Source date has no production data');
  END IF;
  
  -- Get or create target header
  SELECT id INTO v_target_header_id 
  FROM comber_production_header 
  WHERE entry_date = p_target_date AND shift = p_target_shift;
  
  IF v_target_header_id IS NULL THEN
    -- Create new header by copying from source
    INSERT INTO comber_production_header (entry_date, shift, supervisor_id, maisitry_id, total_time, remarks)
    SELECT p_target_date, p_target_shift, supervisor_id, maisitry_id, total_time, 
           'Copied from ' || TO_CHAR(p_source_date, 'DD-Mon-YYYY') || ' Shift ' || p_source_shift
    FROM comber_production_header
    WHERE id = v_source_header_id
    RETURNING id INTO v_target_header_id;
  END IF;
  
  -- Copy production details
  FOR v_source_detail IN 
    SELECT * FROM comber_production_detail WHERE header_id = v_source_header_id
  LOOP
    -- Check if target already has entry for this machine
    SELECT id INTO v_target_detail_id 
    FROM comber_production_detail 
    WHERE header_id = v_target_header_id AND machine_id = v_source_detail.machine_id;
    
    IF v_target_detail_id IS NULL THEN
      -- Insert new detail
      INSERT INTO comber_production_detail (
        header_id, machine_id, employee_name, prodn_mixing, 
        act_hank, run_hrs, run_min, waste, act_prodn, 
        waste_percent, act_effi_percent, uti_percent, std_hrs, work_time, session_no
      )
      VALUES (
        v_target_header_id, v_source_detail.machine_id, v_source_detail.employee_name, 
        v_source_detail.prodn_mixing, v_source_detail.act_hank, v_source_detail.run_hrs,
        v_source_detail.run_min, v_source_detail.waste, v_source_detail.act_prodn,
        v_source_detail.waste_percent, v_source_detail.act_effi_percent, v_source_detail.uti_percent,
        v_source_detail.std_hrs, v_source_detail.work_time, v_source_detail.session_no
      )
      RETURNING id INTO v_target_detail_id;
      
      -- Copy stoppage entry for this detail
      SELECT * INTO v_source_stoppage 
      FROM comber_stoppage_entry 
      WHERE production_detail_id = v_source_detail.id;
      
      IF v_source_stoppage.id IS NOT NULL THEN
        INSERT INTO comber_stoppage_entry (
          production_detail_id, 
          stoppage1_id, stoppage1_time,
          stoppage2_id, stoppage2_time,
          stoppage3_id, stoppage3_time,
          stoppage4_id, stoppage4_time,
          total_stoppage_time
        )
        VALUES (
          v_target_detail_id,
          v_source_stoppage.stoppage1_id, v_source_stoppage.stoppage1_time,
          v_source_stoppage.stoppage2_id, v_source_stoppage.stoppage2_time,
          v_source_stoppage.stoppage3_id, v_source_stoppage.stoppage3_time,
          v_source_stoppage.stoppage4_id, v_source_stoppage.stoppage4_time,
          v_source_stoppage.total_stoppage_time
        );
      END IF;
      
      v_copied_count := v_copied_count + 1;
    ELSE
      -- Update existing detail
      UPDATE comber_production_detail SET
        employee_name = v_source_detail.employee_name,
        prodn_mixing = v_source_detail.prodn_mixing,
        act_hank = v_source_detail.act_hank,
        run_hrs = v_source_detail.run_hrs,
        run_min = v_source_detail.run_min,
        waste = v_source_detail.waste,
        act_prodn = v_source_detail.act_prodn,
        waste_percent = v_source_detail.waste_percent,
        act_effi_percent = v_source_detail.act_effi_percent,
        uti_percent = v_source_detail.uti_percent,
        std_hrs = v_source_detail.std_hrs,
        work_time = v_source_detail.work_time,
        session_no = v_source_detail.session_no,
        updated_at = NOW()
      WHERE id = v_target_detail_id;
      
      -- Update stoppage entry
      SELECT * INTO v_source_stoppage 
      FROM comber_stoppage_entry 
      WHERE production_detail_id = v_source_detail.id;
      
      IF v_source_stoppage.id IS NOT NULL THEN
        INSERT INTO comber_stoppage_entry (
          production_detail_id, 
          stoppage1_id, stoppage1_time,
          stoppage2_id, stoppage2_time,
          stoppage3_id, stoppage3_time,
          stoppage4_id, stoppage4_time,
          total_stoppage_time
        )
        VALUES (
          v_target_detail_id,
          v_source_stoppage.stoppage1_id, v_source_stoppage.stoppage1_time,
          v_source_stoppage.stoppage2_id, v_source_stoppage.stoppage2_time,
          v_source_stoppage.stoppage3_id, v_source_stoppage.stoppage3_time,
          v_source_stoppage.stoppage4_id, v_source_stoppage.stoppage4_time,
          v_source_stoppage.total_stoppage_time
        )
        ON CONFLICT (production_detail_id) 
        DO UPDATE SET
          stoppage1_id = EXCLUDED.stoppage1_id,
          stoppage1_time = EXCLUDED.stoppage1_time,
          stoppage2_id = EXCLUDED.stoppage2_id,
          stoppage2_time = EXCLUDED.stoppage2_time,
          stoppage3_id = EXCLUDED.stoppage3_id,
          stoppage3_time = EXCLUDED.stoppage3_time,
          stoppage4_id = EXCLUDED.stoppage4_id,
          stoppage4_time = EXCLUDED.stoppage4_time,
          total_stoppage_time = EXCLUDED.total_stoppage_time,
          updated_at = NOW();
      END IF;
      
      v_copied_count := v_copied_count + 1;
    END IF;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'copied_count', v_copied_count,
    'source_date', p_source_date,
    'target_date', p_target_date,
    'target_header_id', v_target_header_id
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION copy_comber_production_data TO authenticated;

COMMENT ON FUNCTION copy_comber_production_data IS 
  'Copies all production data (details + stoppages) from a source date to target date.
   Used by Copy Previous Data feature. Updates existing records if they exist.
   Created: 30-Dec-2025';

-- =====================================================
-- Function to copy machine setup data
-- =====================================================
CREATE OR REPLACE FUNCTION copy_comber_machine_setup(
  p_source_machine_id UUID,
  p_target_machine_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_source_setup RECORD;
  v_result JSON;
BEGIN
  -- Get source setup
  SELECT * INTO v_source_setup 
  FROM comber_machine_setup 
  WHERE machine_id = p_source_machine_id;
  
  IF v_source_setup.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Source machine has no setup data');
  END IF;
  
  -- Insert or update target setup
  INSERT INTO comber_machine_setup (
    machine_id, prodn_mixing, session_no, cc_time, sl_hank, mc_effi, 
    shift_time, default_waste, constant
  )
  VALUES (
    p_target_machine_id, v_source_setup.prodn_mixing, v_source_setup.session_no,
    v_source_setup.cc_time, v_source_setup.sl_hank, v_source_setup.mc_effi,
    v_source_setup.shift_time, v_source_setup.default_waste, v_source_setup.constant
  )
  ON CONFLICT (machine_id) 
  DO UPDATE SET
    prodn_mixing = EXCLUDED.prodn_mixing,
    session_no = EXCLUDED.session_no,
    cc_time = EXCLUDED.cc_time,
    sl_hank = EXCLUDED.sl_hank,
    mc_effi = EXCLUDED.mc_effi,
    shift_time = EXCLUDED.shift_time,
    default_waste = EXCLUDED.default_waste,
    constant = EXCLUDED.constant,
    updated_at = NOW();
  
  RETURN json_build_object('success', true, 'message', 'Setup copied successfully');
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION copy_comber_machine_setup TO authenticated;

COMMENT ON FUNCTION copy_comber_machine_setup IS 
  'Copies machine setup configuration from one machine to another.
   Created: 30-Dec-2025';

-- =====================================================
-- Function to get complete production data for a date
-- Used for displaying data before copying
-- =====================================================
CREATE OR REPLACE FUNCTION get_comber_production_summary(
  p_date DATE,
  p_shift INTEGER
)
RETURNS TABLE (
  machine_no VARCHAR,
  employee_name VARCHAR,
  prodn_mixing VARCHAR,
  act_hank DECIMAL,
  run_hrs DECIMAL,
  run_min INTEGER,
  act_prodn DECIMAL,
  act_effi_percent DECIMAL,
  uti_percent DECIMAL,
  work_time INTEGER,
  total_stoppage INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.machine_no,
    cpd.employee_name,
    cpd.prodn_mixing,
    cpd.act_hank,
    cpd.run_hrs,
    cpd.run_min,
    cpd.act_prodn,
    cpd.act_effi_percent,
    cpd.uti_percent,
    cpd.work_time,
    COALESCE(cse.total_stoppage_time, 0) as total_stoppage
  FROM comber_production_header cph
  JOIN comber_production_detail cpd ON cpd.header_id = cph.id
  JOIN comber_machines cm ON cpd.machine_id = cm.id
  LEFT JOIN comber_stoppage_entry cse ON cse.production_detail_id = cpd.id
  WHERE cph.entry_date = p_date AND cph.shift = p_shift
  ORDER BY cm.mc_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_comber_production_summary TO authenticated;

COMMENT ON FUNCTION get_comber_production_summary IS 
  'Returns summary of production data for a specific date and shift.
   Used by Copy Previous Data dialog to preview data before copying.
   Created: 30-Dec-2025';

-- =====================================================
-- Function to calculate RunMin from RunHrs (HH.MM format)
-- UNIQUE to Comber module
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_comber_run_min(
  p_run_hrs DECIMAL
)
RETURNS INTEGER AS $$
DECLARE
  v_hours INTEGER;
  v_minutes INTEGER;
BEGIN
  -- Extract hours (integer part)
  v_hours := FLOOR(p_run_hrs);
  
  -- Extract minutes (decimal part × 100)
  -- e.g., 5.58 → 0.58 × 100 = 58 minutes
  v_minutes := ROUND((p_run_hrs - v_hours) * 100);
  
  -- Calculate total minutes
  RETURN (v_hours * 60) + v_minutes;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION calculate_comber_run_min TO authenticated;

COMMENT ON FUNCTION calculate_comber_run_min IS 
  'Converts RunHrs (HH.MM format) to RunMin (minutes).
   Example: 5.58 → (5×60) + 58 = 358 minutes
   UNIQUE to Comber module - other modules calculate run time from stoppages.
   Created: 30-Dec-2025';

-- =====================================================
-- Function to recalculate all production values for a machine
-- Called after stoppage changes
-- =====================================================
CREATE OR REPLACE FUNCTION recalculate_comber_production(
  p_detail_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_detail RECORD;
  v_setup RECORD;
  v_header RECORD;
  v_stoppage RECORD;
  v_total_time INTEGER;
  v_work_time INTEGER;
  v_run_min INTEGER;
  v_std_hrs DECIMAL;
  v_act_prodn DECIMAL;
  v_waste_percent DECIMAL;
  v_act_effi_percent DECIMAL;
  v_uti_percent DECIMAL;
  v_constant DECIMAL := 3.240;  -- 1 / 2.20456 / 0.14
BEGIN
  -- Get production detail
  SELECT * INTO v_detail FROM comber_production_detail WHERE id = p_detail_id;
  IF v_detail IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Production detail not found');
  END IF;
  
  -- Get header for total time
  SELECT * INTO v_header FROM comber_production_header WHERE id = v_detail.header_id;
  v_total_time := COALESCE(v_header.total_time, 510);
  
  -- Get machine setup
  SELECT * INTO v_setup FROM comber_machine_setup WHERE machine_id = v_detail.machine_id;
  IF v_setup IS NOT NULL THEN
    v_constant := COALESCE(v_setup.constant, 3.240);
  END IF;
  
  -- Get stoppage
  SELECT * INTO v_stoppage FROM comber_stoppage_entry WHERE production_detail_id = p_detail_id;
  
  -- Calculate WorkTime = TotalTime - TotalStoppage
  v_work_time := v_total_time - COALESCE(v_stoppage.total_stoppage_time, 0);
  
  -- Calculate RunMin from RunHrs (HH.MM format)
  v_run_min := calculate_comber_run_min(v_detail.run_hrs);
  
  -- Calculate Std.hrs = WorkTime × (MCEffi/100)
  v_std_hrs := v_work_time * (COALESCE(v_setup.mc_effi, 93)::DECIMAL / 100);
  
  -- Calculate Act.Prodn = Act.Hank × Constant
  v_act_prodn := COALESCE(v_detail.act_hank, 0) * v_constant;
  
  -- Calculate Waste% = (Waste / Act.Prodn) × 100
  IF v_act_prodn > 0 THEN
    v_waste_percent := (COALESCE(v_detail.waste, 0) / v_act_prodn) * 100;
  ELSE
    v_waste_percent := 0;
  END IF;
  
  -- Calculate Act.Effi% = (RunMin / Std.hrs) × 100
  IF v_std_hrs > 0 THEN
    v_act_effi_percent := (v_run_min / v_std_hrs) * 100;
  ELSE
    v_act_effi_percent := 0;
  END IF;
  
  -- Calculate Uti% = (WorkTime / TotalTime) × 100
  IF v_total_time > 0 THEN
    v_uti_percent := (v_work_time::DECIMAL / v_total_time) * 100;
  ELSE
    v_uti_percent := 0;
  END IF;
  
  -- Update production detail
  UPDATE comber_production_detail SET
    run_min = v_run_min,
    work_time = v_work_time,
    std_hrs = ROUND(v_std_hrs::DECIMAL, 1),
    act_prodn = ROUND(v_act_prodn, 2),
    waste_percent = ROUND(v_waste_percent, 2),
    act_effi_percent = ROUND(v_act_effi_percent, 2),
    uti_percent = ROUND(v_uti_percent, 2),
    updated_at = NOW()
  WHERE id = p_detail_id;
  
  RETURN json_build_object(
    'success', true,
    'run_min', v_run_min,
    'work_time', v_work_time,
    'std_hrs', ROUND(v_std_hrs::DECIMAL, 1),
    'act_prodn', ROUND(v_act_prodn, 2),
    'waste_percent', ROUND(v_waste_percent, 2),
    'act_effi_percent', ROUND(v_act_effi_percent, 2),
    'uti_percent', ROUND(v_uti_percent, 2)
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION recalculate_comber_production TO authenticated;

COMMENT ON FUNCTION recalculate_comber_production IS 
  'Recalculates all production values for a machine based on current inputs.
   Called after stoppage changes or RunHrs updates.
   Formulas:
     RunMin = Hours×60 + (Decimal×100)
     WorkTime = TotalTime - TotalStoppage
     Std.hrs = WorkTime × (MCEffi/100)
     Act.Prodn = Act.Hank × Constant
     Waste% = (Waste / Act.Prodn) × 100
     Act.Effi% = (RunMin / Std.hrs) × 100
     Uti% = (WorkTime / TotalTime) × 100
   Created: 30-Dec-2025';

-- =====================================================
-- Trigger to auto-recalculate on stoppage update
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_comber_stoppage_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate total stoppage time
  NEW.total_stoppage_time := COALESCE(NEW.stoppage1_time, 0) + 
                              COALESCE(NEW.stoppage2_time, 0) + 
                              COALESCE(NEW.stoppage3_time, 0) + 
                              COALESCE(NEW.stoppage4_time, 0);
  
  -- Trigger recalculation of production values
  PERFORM recalculate_comber_production(NEW.production_detail_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_comber_stoppage_recalc ON comber_stoppage_entry;
CREATE TRIGGER trigger_comber_stoppage_recalc
  AFTER INSERT OR UPDATE ON comber_stoppage_entry
  FOR EACH ROW
  EXECUTE FUNCTION trigger_comber_stoppage_update();

COMMENT ON TRIGGER trigger_comber_stoppage_recalc ON comber_stoppage_entry IS 
  'Automatically recalculates production values when stoppage entry is updated.
   Created: 30-Dec-2025';

-- =====================================================
-- Update stoppage entry function (for frontend)
-- =====================================================
CREATE OR REPLACE FUNCTION update_comber_stoppage_entry(
  p_production_detail_id UUID,
  p_updates JSONB
)
RETURNS JSON AS $$
DECLARE
  v_existing RECORD;
  v_total_stoppage INTEGER;
BEGIN
  -- Get existing record
  SELECT * INTO v_existing 
  FROM comber_stoppage_entry 
  WHERE production_detail_id = p_production_detail_id;
  
  -- Calculate new total using existing values where not provided
  v_total_stoppage := 
    COALESCE((p_updates->>'stoppage1_time')::INTEGER, COALESCE(v_existing.stoppage1_time, 0)) +
    COALESCE((p_updates->>'stoppage2_time')::INTEGER, COALESCE(v_existing.stoppage2_time, 0)) +
    COALESCE((p_updates->>'stoppage3_time')::INTEGER, COALESCE(v_existing.stoppage3_time, 0)) +
    COALESCE((p_updates->>'stoppage4_time')::INTEGER, COALESCE(v_existing.stoppage4_time, 0));
  
  -- Insert or update
  INSERT INTO comber_stoppage_entry (
    production_detail_id,
    stoppage1_id, stoppage1_time,
    stoppage2_id, stoppage2_time,
    stoppage3_id, stoppage3_time,
    stoppage4_id, stoppage4_time,
    total_stoppage_time
  )
  VALUES (
    p_production_detail_id,
    COALESCE((p_updates->>'stoppage1_id')::UUID, v_existing.stoppage1_id),
    COALESCE((p_updates->>'stoppage1_time')::INTEGER, COALESCE(v_existing.stoppage1_time, 0)),
    COALESCE((p_updates->>'stoppage2_id')::UUID, v_existing.stoppage2_id),
    COALESCE((p_updates->>'stoppage2_time')::INTEGER, COALESCE(v_existing.stoppage2_time, 0)),
    COALESCE((p_updates->>'stoppage3_id')::UUID, v_existing.stoppage3_id),
    COALESCE((p_updates->>'stoppage3_time')::INTEGER, COALESCE(v_existing.stoppage3_time, 0)),
    COALESCE((p_updates->>'stoppage4_id')::UUID, v_existing.stoppage4_id),
    COALESCE((p_updates->>'stoppage4_time')::INTEGER, COALESCE(v_existing.stoppage4_time, 0)),
    v_total_stoppage
  )
  ON CONFLICT (production_detail_id) 
  DO UPDATE SET
    stoppage1_id = COALESCE((p_updates->>'stoppage1_id')::UUID, comber_stoppage_entry.stoppage1_id),
    stoppage1_time = COALESCE((p_updates->>'stoppage1_time')::INTEGER, comber_stoppage_entry.stoppage1_time),
    stoppage2_id = COALESCE((p_updates->>'stoppage2_id')::UUID, comber_stoppage_entry.stoppage2_id),
    stoppage2_time = COALESCE((p_updates->>'stoppage2_time')::INTEGER, comber_stoppage_entry.stoppage2_time),
    stoppage3_id = COALESCE((p_updates->>'stoppage3_id')::UUID, comber_stoppage_entry.stoppage3_id),
    stoppage3_time = COALESCE((p_updates->>'stoppage3_time')::INTEGER, comber_stoppage_entry.stoppage3_time),
    stoppage4_id = COALESCE((p_updates->>'stoppage4_id')::UUID, comber_stoppage_entry.stoppage4_id),
    stoppage4_time = COALESCE((p_updates->>'stoppage4_time')::INTEGER, comber_stoppage_entry.stoppage4_time),
    total_stoppage_time = v_total_stoppage,
    updated_at = NOW();
  
  RETURN json_build_object(
    'success', true,
    'total_stoppage_time', v_total_stoppage
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION update_comber_stoppage_entry TO authenticated;

COMMENT ON FUNCTION update_comber_stoppage_entry IS 
  'Updates stoppage entry with partial updates support.
   Merges provided values with existing values before calculating total.
   Created: 30-Dec-2025';

SELECT 'Comber Copy Previous Data Setup Complete - 30-Dec-2025' as status;
