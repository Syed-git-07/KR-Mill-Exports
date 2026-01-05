-- ============================================
-- BREAKER DRAWING ENTRY FIXES
-- Applied: 2026-01-02
-- ============================================

-- 1. Add total_stoppage_mins column to breaker_drawing_production_detail
ALTER TABLE breaker_drawing_production_detail 
ADD COLUMN IF NOT EXISTS total_stoppage_mins INTEGER DEFAULT 0;

-- 2. Create trigger function to sync stoppage data to production detail
CREATE OR REPLACE FUNCTION sync_breaker_drawing_stoppage_to_production()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the production detail with total stoppage time
  UPDATE breaker_drawing_production_detail
  SET total_stoppage_mins = NEW.total_stoppage_time,
      work_time = 510 - NEW.total_stoppage_time,
      updated_at = NOW()
  WHERE id = NEW.production_detail_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger on breaker_drawing_stoppage_entry
DROP TRIGGER IF EXISTS trg_sync_breaker_drawing_stoppage ON breaker_drawing_stoppage_entry;

CREATE TRIGGER trg_sync_breaker_drawing_stoppage
AFTER INSERT OR UPDATE OF total_stoppage_time ON breaker_drawing_stoppage_entry
FOR EACH ROW
EXECUTE FUNCTION sync_breaker_drawing_stoppage_to_production();

-- 4. Sync existing data
UPDATE breaker_drawing_production_detail pd
SET total_stoppage_mins = COALESCE(se.total_stoppage_time, 0)
FROM breaker_drawing_stoppage_entry se
WHERE se.production_detail_id = pd.id;

-- ============================================
-- QUERIES UPDATED:
-- ============================================
-- 1. getBreakerDrawingProductionWithSetup() - Added !inner join with is_active=true filter
-- 2. getBreakerDrawingStoppageEntries() - Added is_active filter for machines
-- 3. getBreakerDrawingMachineSetups() - Added !inner join with is_active=true filter
-- 4. addBreakerDrawingMachine() - Added reactivation support for inactive machines

-- ============================================
-- UI CHANGES:
-- ============================================
-- 1. BreakerDrawingProductionTab.jsx:
--    - Added "Total Stopp" column header
--    - Added Total Stopp data cell showing total_stoppage_mins
--    - Made RunTime and WorkTime readonly (display only)
--
-- 2. BreakerDrawingMachineSetupTab.jsx:
--    - Added "Description" field to Add Machine dialog
--    - Added description to new machine state
--    - Improved error handling for add machine
--    - Added support for reactivating inactive machines
