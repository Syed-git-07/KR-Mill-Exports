-- =====================================================
-- Carding - Copy Previous Data Enhancement
-- =====================================================
-- This script adds optimizations for the "Copy Previous Data" functionality
-- which allows copying production data from any past date instead of just yesterday
-- =====================================================

-- Create index for faster date-based queries on production headers
CREATE INDEX IF NOT EXISTS idx_carding_header_date_shift 
ON carding_production_header(entry_date DESC, shift);

-- Create index on production_detail for faster header lookups
CREATE INDEX IF NOT EXISTS idx_carding_detail_header_id 
ON carding_production_detail(header_id);

-- Create index on stoppage_entry for faster detail lookups
CREATE INDEX IF NOT EXISTS idx_carding_stoppage_detail_id 
ON carding_stoppage_entry(production_detail_id);

-- =====================================================
-- Function to get available previous dates with data
-- =====================================================
CREATE OR REPLACE FUNCTION get_carding_available_dates(
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
      FROM carding_production_detail d 
      WHERE d.header_id = h.id 
      AND (d.act_prodn > 0 OR d.employee_name IS NOT NULL)
    ) as has_details
  FROM carding_production_header h
  WHERE h.entry_date < p_before_date
    AND h.shift = p_shift
  ORDER BY h.entry_date DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_carding_available_dates TO authenticated;

COMMENT ON FUNCTION get_carding_available_dates IS 
  'Returns list of previous dates that have production data for the specified shift. 
   Used by Copy Previous Data feature to show available dates to copy from.';
