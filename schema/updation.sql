-- ============================================================
-- KR Production DB Update Script
-- Date       : 2026-03-02
-- Description: Remove default_stoppage concept from all modules.
--              Stoppages are now entered manually only — no
--              pre-filled default values on entry creation.
-- ============================================================

-- -------------------------------------------------------
-- STEP 1: Drop default_stoppage column from shift_config
--         (only if it still exists — safe for fresh runs)
-- -------------------------------------------------------
ALTER TABLE shift_config
  DROP COLUMN IF EXISTS default_stoppage;


-- -------------------------------------------------------
-- STEP 2: Reset carding_machine_setup.default_stoppage
--         All 26 machines had 135 as default — set to 0
-- -------------------------------------------------------
UPDATE carding_machine_setup
SET default_stoppage = 0;


-- -------------------------------------------------------
-- STEP 3: Clear pre-filled BSS / AIR CLEANING stoppages
--         in breaker_drawing_stoppage_entry.
--         Only clears entries where both slot 1 = BSS (1511)
--         and slot 2 = AIR CLEANING (1512) were pre-set,
--         AND the user has NOT yet entered actual production
--         (act_prodn = 0), to avoid wiping real data.
-- -------------------------------------------------------
UPDATE breaker_drawing_stoppage_entry se
  JOIN breaker_drawing_production_detail pd  ON se.production_detail_id = pd.id
  JOIN breaker_drawing_production_header h   ON pd.header_id = h.id
  JOIN stoppage_details sd1                  ON se.stoppage1_id = sd1.id
  JOIN stoppage_details sd2                  ON se.stoppage2_id = sd2.id
SET
  se.stoppage1_id        = NULL,
  se.stoppage1_time      = 0,
  se.stoppage2_id        = NULL,
  se.stoppage2_time      = 0,
  se.total_stoppage_time = 0
WHERE
  sd1.code = 1511   -- BSS
  AND sd2.code = 1512  -- AIR CLEANING
  AND pd.act_prodn = 0;  -- only unfilled entries

-- Also reset work_time on those production_detail rows
UPDATE breaker_drawing_production_detail pd
  JOIN breaker_drawing_production_header h ON pd.header_id = h.id
  JOIN breaker_drawing_stoppage_entry se   ON se.production_detail_id = pd.id
SET
  pd.total_stoppage_mins = 0,
  pd.work_time           = pd.run_time
WHERE
  se.total_stoppage_time = 0
  AND pd.total_stoppage_mins > 0
  AND pd.act_prodn = 0;


-- -------------------------------------------------------
-- STEP 4: Recreate v_shift_config view without
--         default_stoppage and default_work_time columns
--         (column was dropped from shift_config in STEP 1)
-- -------------------------------------------------------
DROP VIEW IF EXISTS v_shift_config;

CREATE ALGORITHM = UNDEFINED
  DEFINER = `root`@`localhost`
  SQL SECURITY DEFINER
  VIEW `v_shift_config` AS
SELECT
  `shift_config`.`id`              AS `id`,
  `shift_config`.`department_code` AS `department_code`,
  `shift_config`.`shift`           AS `shift`,
  `shift_config`.`shift_name`      AS `shift_name`,
  `shift_config`.`shift_time`      AS `shift_time`,
  `shift_config`.`start_time`      AS `start_time`,
  `shift_config`.`end_time`        AS `end_time`,
  `shift_config`.`is_active`       AS `is_active`
FROM `shift_config`
WHERE `shift_config`.`is_active` = 1
ORDER BY `shift_config`.`department_code`, `shift_config`.`shift`;


-- -------------------------------------------------------
-- Verification queries (run manually to confirm)
-- -------------------------------------------------------
-- SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
--   WHERE TABLE_SCHEMA = 'kr_production'
--   AND TABLE_NAME = 'shift_config';
--   → should NOT contain default_stoppage

-- SELECT default_stoppage, COUNT(*) FROM carding_machine_setup GROUP BY 1;
--   → should show only 0

-- SELECT stoppage1_time, stoppage2_time FROM breaker_drawing_stoppage_entry
--   ORDER BY production_detail_id LIMIT 10;
--   → all pre-filled rows should show 0


-- ============================================================
-- KR Production DB Update Script
-- Date       : 2026-03-10
-- Description: Date-based machine visibility for carding_machines.
--              Adds activated_at / deactivated_at columns to replace
--              the boolean is_active filter on entry/report screens.
-- ============================================================

-- -------------------------------------------------------
-- Add date-range columns to carding_machines
-- -------------------------------------------------------
ALTER TABLE carding_machines
  ADD COLUMN activated_at  DATE NULL,
  ADD COLUMN deactivated_at DATE NULL;

-- Backfill active machines
UPDATE carding_machines
SET activated_at = COALESCE(installed_date, DATE(created_at))
WHERE is_active = 1 OR is_active IS NULL;

-- Backfill inactive (removed) machines
UPDATE carding_machines
SET activated_at   = COALESCE(installed_date, DATE(created_at)),
    deactivated_at = '2026-03-10'
WHERE is_active = 0;

-- NOTE: If the actual removal date differs from 2026-03-10 for any
-- machine, correct it manually, e.g.:
--   UPDATE carding_machines
--   SET deactivated_at = '<actual-removal-date>'
--   WHERE machine_no = 'CA22' AND is_active = 0;

-- -------------------------------------------------------
-- Verification
-- -------------------------------------------------------
-- SELECT machine_no, is_active, activated_at, deactivated_at
-- FROM carding_machines ORDER BY mc_id;
-- → CA1-CA21: activated_at = 2015-04-01, deactivated_at = NULL
-- → CA22-CA25: activated_at = 2015-04-01, deactivated_at = 2026-03-10

-- DESCRIBE v_shift_config;
--   → should NOT contain default_stoppage, default_work_time


-- ============================================================
-- KR Production DB Update — 2026-03-06
-- Description: Add date-based machine visibility to
--              spinning_machines (activated_at / deactivated_at).
--              Replaces boolean is_active with date-range logic:
--              machine is visible for entry_date if:
--                activated_at <= entry_date
--                AND (deactivated_at IS NULL OR deactivated_at > entry_date)
-- ============================================================

-- -------------------------------------------------------
-- STEP 1: Add activated_at and deactivated_at columns
-- -------------------------------------------------------
ALTER TABLE spinning_machines
  ADD COLUMN activated_at  DATE NULL,
  ADD COLUMN deactivated_at DATE NULL;

-- -------------------------------------------------------
-- STEP 2: Backfill active machines
--         activated_at = installed_date (or created_at fallback)
-- -------------------------------------------------------
UPDATE spinning_machines
SET activated_at = COALESCE(installed_date, DATE(created_at))
WHERE is_active = 1 OR is_active IS NULL;

-- -------------------------------------------------------
-- STEP 3: Backfill inactive (removed) machines
--         activated_at = installed_date, deactivated_at = today
--         (exact deactivation date unknown — use migration date)
-- -------------------------------------------------------
UPDATE spinning_machines
SET activated_at   = COALESCE(installed_date, DATE(created_at)),
    deactivated_at = '2026-03-06'
WHERE is_active = 0;

-- -------------------------------------------------------
-- STEP 4: Correct deactivation dates for RF46, RF47, RF48, RF49
--         All were physically removed but migration set deactivated_at = 2026-03-06
--         RF47/RF48/RF49 removed on 2026-03-03
--         RF46 removed on 2026-03-04
-- -------------------------------------------------------
UPDATE spinning_machines
SET deactivated_at = '2026-03-03'
WHERE machine_no IN ('47', '48', '49') AND is_active = 0;

UPDATE spinning_machines
SET deactivated_at = '2026-03-04'
WHERE machine_no = '46' AND is_active = 0;

-- Clean stale blank detail rows for RF46/RF48/RF49 created before date-visibility fix
DELETE se FROM spinning_stoppage_entry se
  JOIN spinning_production_detail pd ON se.production_detail_id = pd.id
  JOIN spinning_production_header h  ON pd.header_id = h.id
  JOIN spinning_machines sm          ON pd.machine_id = sm.id
  WHERE sm.machine_no IN ('46', '48', '49')
    AND h.entry_date >= sm.deactivated_at
    AND pd.act_prodn IS NULL;

DELETE pd FROM spinning_production_detail pd
  JOIN spinning_production_header h ON pd.header_id = h.id
  JOIN spinning_machines sm         ON pd.machine_id = sm.id
  WHERE sm.machine_no IN ('46', '48', '49')
    AND h.entry_date >= sm.deactivated_at
    AND pd.act_prodn IS NULL;

-- -------------------------------------------------------
-- STEP 5: Hard-delete duplicate RF48 + accidental test machines
--         (RF1A/50, RF2A/51, RF2A/52, RF3A/53 — sort_order=0,
--          added/removed during testing on 2026-03-05/06)
-- -------------------------------------------------------
SET @dup_id = '39916e64-8780-4e33-8688-d38779ac97e4';

DELETE se FROM spinning_stoppage_entry se
  JOIN spinning_production_detail pd ON se.production_detail_id = pd.id
  WHERE pd.machine_id = @dup_id;

DELETE FROM spinning_production_detail WHERE machine_id = @dup_id;
DELETE FROM spinning_machine_setup     WHERE machine_id = @dup_id;
DELETE FROM spinning_machines          WHERE id = @dup_id;

-- -------------------------------------------------------
-- Verification
-- -------------------------------------------------------
-- SELECT machine_no, is_active, installed_date, activated_at, deactivated_at
--   FROM spinning_machines ORDER BY sort_order;
--   → active machines: deactivated_at = NULL
--   → RF47: deactivated_at = '2026-03-03'
--   → no row with machine_no = 'RF48' (sort_order 9999)


-- ============================================================
-- KR Production DB Update — 2026-03-06
-- Description: Add date-based machine visibility to
--              autoconer_machines (activated_at / deactivated_at).
-- ============================================================

ALTER TABLE autoconer_machines
  ADD COLUMN activated_at   DATE NULL,
  ADD COLUMN deactivated_at DATE NULL;

-- Backfill active machines
UPDATE autoconer_machines
SET activated_at = COALESCE(installed_date, DATE(created_at))
WHERE is_active = 1 OR is_active IS NULL;

-- Backfill inactive machines (AC14-1, AC15-1) – migration date used as deactivation fallback
UPDATE autoconer_machines
SET activated_at   = COALESCE(installed_date, DATE(created_at)),
    deactivated_at = '2026-03-06'
WHERE is_active = 0;

-- -------------------------------------------------------
-- Verification
-- -------------------------------------------------------
-- SELECT machine_no, is_active, installed_date, activated_at, deactivated_at
--   FROM autoconer_machines ORDER BY group_id, machine_no;
--   → 44 active machines: deactivated_at = NULL
--   → AC14-1, AC15-1: deactivated_at = '2026-03-06'


-- ============================================================
-- KR Production DB Update — 2026-03-11
-- Description: Add new fields to drawing_breaker_machines:
--   • delivery       INT  — number of deliveries per machine
--   • sliver_hank    DECIMAL(10,4) — sliver hank constant for production formula
--   • activated_at   DATE — date-based visibility start (replaces is_active filter)
--   • deactivated_at DATE — date-based visibility end
-- ============================================================

ALTER TABLE drawing_breaker_machines
  ADD COLUMN delivery       INT           NULL AFTER speed,
  ADD COLUMN sliver_hank    DECIMAL(10,4) NULL AFTER delivery,
  ADD COLUMN activated_at   DATE          NULL AFTER updated_at,
  ADD COLUMN deactivated_at DATE          NULL AFTER activated_at;

-- Backfill activated_at for active machines
UPDATE drawing_breaker_machines
SET activated_at = COALESCE(installed_date, DATE(created_at))
WHERE is_active = 1 OR is_active IS NULL;

-- Backfill inactive machines — migration date used as deactivation fallback
UPDATE drawing_breaker_machines
SET activated_at   = COALESCE(installed_date, DATE(created_at)),
    deactivated_at = '2026-03-11'
WHERE is_active = 0;

-- If the actual removal date differs for any machine, correct it manually, e.g.:
--   UPDATE drawing_breaker_machines
--   SET deactivated_at = '<actual-removal-date>'
--   WHERE machine_no = '<no>' AND is_active = 0;

-- Backfill delivery / sliver_hank from machine setup (uses data already entered there):
UPDATE drawing_breaker_machines dm
  JOIN breaker_drawing_machine_setup s ON s.machine_id = dm.id
SET dm.delivery    = s.delivery,
    dm.sliver_hank = s.hank_constant;

-- -------------------------------------------------------
-- Verification
-- -------------------------------------------------------
-- SELECT machine_no, is_active, delivery, sliver_hank, installed_date, activated_at, deactivated_at
--   FROM drawing_breaker_machines ORDER BY mc_id;
--   → BD1-BD3: activated_at = 2015-04-01, deactivated_at = NULL  (active)
--   → BD4:     activated_at = 2026-01-30, deactivated_at = 2026-03-03 (last entry 2026-03-02)
--   → BD5:     activated_at = 2015-04-01, deactivated_at = 2026-02-03 (last entry 2026-02-02)

-- Correct actual removal dates (derived from last production entry date + 1 day):
UPDATE drawing_breaker_machines SET deactivated_at = '2026-03-03' WHERE machine_no = 'BD4' AND is_active = 0;
UPDATE drawing_breaker_machines SET deactivated_at = '2026-02-03' WHERE machine_no = 'BD5' AND is_active = 0;


-- ============================================================
-- KR Production DB Update — 2026-03-12
-- Description: Add date-based machine visibility to
--              comber_machines (activated_at / deactivated_at / sort_order).
--              Replaces boolean is_active with date-range logic:
--              machine is visible for entry_date if:
--                activated_at <= entry_date
--                AND (deactivated_at IS NULL OR deactivated_at > entry_date)
-- ============================================================

ALTER TABLE comber_machines
  ADD COLUMN activated_at   DATE NULL,
  ADD COLUMN deactivated_at DATE NULL,
  ADD COLUMN sort_order     INT  NOT NULL DEFAULT 0;

-- Backfill active machines
UPDATE comber_machines
SET activated_at = COALESCE(installed_date, DATE(created_at))
WHERE is_active = 1 OR is_active IS NULL;

-- Backfill inactive machines — migration date used as deactivation fallback
UPDATE comber_machines
SET activated_at   = COALESCE(installed_date, DATE(created_at)),
    deactivated_at = '2026-03-12'
WHERE is_active = 0;

-- Backfill sort_order from mc_id
UPDATE comber_machines SET sort_order = mc_id WHERE mc_id IS NOT NULL;

-- -------------------------------------------------------
-- Verification
-- -------------------------------------------------------
-- SELECT machine_no, is_active, activated_at, deactivated_at, sort_order
--   FROM comber_machines ORDER BY sort_order;
--   → CO1-CO12: activated_at = 2015-04-01, deactivated_at = NULL
--   → CO13: activated_at = 2026-01-30, deactivated_at = 2026-03-12
--   → CO14: activated_at = 2015-04-01, deactivated_at = 2026-03-12

-- -------------------------------------------------------
-- 2026-03-12  comber_machines — sliver_hank column
-- -------------------------------------------------------
-- Add sliver_hank to comber_machines for master-level default
ALTER TABLE comber_machines
  ADD COLUMN sliver_hank DECIMAL(10,4) NULL;


-- -------------------------------------------------------
-- 2026-03-12: drawing_finisher_machines � date-based
--             visibility (activated_at / deactivated_at /
--             sort_order).
-- -------------------------------------------------------
ALTER TABLE drawing_finisher_machines
  ADD COLUMN activated_at  DATE NULL,
  ADD COLUMN deactivated_at DATE NULL,
  ADD COLUMN sort_order    INT  NOT NULL DEFAULT 0;

-- Backfill activated_at for active machines
UPDATE drawing_finisher_machines
SET activated_at = COALESCE(installed_date, DATE(created_at))
WHERE is_active = 1 OR is_active IS NULL;

-- Backfill activated_at + deactivated_at for inactive machines
UPDATE drawing_finisher_machines
SET activated_at   = COALESCE(installed_date, DATE(created_at)),
    deactivated_at = '2026-03-12'
WHERE is_active = 0;

-- Backfill sort_order from mc_id order
SET @so := 0;
UPDATE drawing_finisher_machines SET sort_order = (@so := @so + 1) ORDER BY mc_id ASC;

-- Verify:
-- SELECT machine_no, is_active, activated_at, deactivated_at, sort_order
--   FROM drawing_finisher_machines ORDER BY sort_order;


-- ============================================================
-- KR Production DB Update -- 2026-03-16
-- Description: Add date-based machine visibility to
--              simplex_machines (activated_at / deactivated_at / sort_order).
--              Replaces boolean is_active with date-range logic:
--              machine is visible for entry_date if:
--                activated_at <= entry_date
--                AND (deactivated_at IS NULL OR deactivated_at > entry_date)
-- ============================================================

ALTER TABLE simplex_machines
  ADD COLUMN activated_at   DATE NULL,
  ADD COLUMN deactivated_at DATE NULL,
  ADD COLUMN sort_order     INT  NULL DEFAULT 0;

-- Backfill active machines
UPDATE simplex_machines
SET activated_at = COALESCE(installed_date, DATE(created_at))
WHERE is_active = 1 OR is_active IS NULL;

-- Backfill inactive machines -- migration date used as deactivation fallback
UPDATE simplex_machines
SET activated_at   = COALESCE(installed_date, DATE(created_at)),
    deactivated_at = '2026-03-16'
WHERE is_active = 0;

-- Backfill sort_order from mc_id where available
UPDATE simplex_machines
SET sort_order = mc_id
WHERE mc_id IS NOT NULL;

-- If actual removal date differs, correct manually, e.g.:
-- UPDATE simplex_machines
-- SET deactivated_at = '<actual-removal-date>'
-- WHERE machine_no = '<no>' AND is_active = 0;

-- -------------------------------------------------------
-- Verification
-- -------------------------------------------------------
-- SELECT machine_no, is_active, activated_at, deactivated_at, sort_order
--   FROM simplex_machines ORDER BY sort_order, machine_no;


-- ============================================================
-- KR Production DB Update -- 2026-03-17
-- Description: Remove Finisher Drawing default waste/default stoppage
--              defaults from DB and clear legacy auto-filled values.
-- ============================================================

-- Remove DB-level defaults
ALTER TABLE finisher_drawing_machine_setup
  ALTER COLUMN default_waste DROP DEFAULT,
  ALTER COLUMN default_stoppage DROP DEFAULT;

ALTER TABLE finisher_drawing_production_detail
  ALTER COLUMN waste DROP DEFAULT;

-- Clear setup defaults previously stored as auto-default values
UPDATE finisher_drawing_machine_setup
SET default_waste = NULL
WHERE default_waste = 0.4100;

UPDATE finisher_drawing_machine_setup
SET default_stoppage = NULL
WHERE default_stoppage = 0;

-- Clear production waste only for likely untouched rows
UPDATE finisher_drawing_production_detail
SET waste = NULL
WHERE waste = 0.4100
  AND (act_prodn = 0 OR act_prodn IS NULL);

-- Verification
-- SELECT TABLE_NAME, COLUMN_NAME, COLUMN_DEFAULT, IS_NULLABLE
-- FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_SCHEMA='kr_production'
--   AND TABLE_NAME IN ('finisher_drawing_machine_setup','finisher_drawing_production_detail')
--   AND COLUMN_NAME IN ('default_waste','default_stoppage','waste')
-- ORDER BY TABLE_NAME, COLUMN_NAME;


-- ============================================================
-- KR Production DB Update -- 2026-03-17
-- Description: Remove Lap Former default waste/default stoppage
--              defaults from DB and clear legacy auto-filled values.
-- ============================================================

-- Remove DB-level defaults
ALTER TABLE lap_former_machine_setup
  ALTER COLUMN default_waste DROP DEFAULT,
  ALTER COLUMN default_stoppage DROP DEFAULT;

ALTER TABLE lap_former_production_detail
  ALTER COLUMN waste DROP DEFAULT;

-- Clear setup defaults previously stored as auto-default values
UPDATE lap_former_machine_setup
SET default_waste = NULL
WHERE default_waste = 0.8500;

UPDATE lap_former_machine_setup
SET default_stoppage = NULL
WHERE default_stoppage = 0;

-- Clear production waste only for likely untouched rows
UPDATE lap_former_production_detail
SET waste = NULL
WHERE waste = 0.8500
  AND (act_prodn = 0 OR act_prodn IS NULL);

-- Verification
-- SELECT TABLE_NAME, COLUMN_NAME, COLUMN_DEFAULT, IS_NULLABLE
-- FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_SCHEMA='kr_production'
--   AND TABLE_NAME IN ('lap_former_machine_setup','lap_former_production_detail')
--   AND COLUMN_NAME IN ('default_waste','default_stoppage','waste')
-- ORDER BY TABLE_NAME, COLUMN_NAME;


-- ============================================================
-- Simplex default cleanup (remove auto default waste)
-- ============================================================

-- Remove DB-level defaults
ALTER TABLE simplex_machine_setup
  ALTER COLUMN default_waste DROP DEFAULT;

ALTER TABLE simplex_production_detail
  ALTER COLUMN waste DROP DEFAULT;

-- Clear setup defaults previously stored as auto-default values
UPDATE simplex_machine_setup
SET default_waste = NULL
WHERE default_waste = 0.9000;

-- Clear production waste only for likely untouched rows
UPDATE simplex_production_detail
SET waste = NULL
WHERE waste = 0.9000
  AND (act_prodn = 0 OR act_prodn IS NULL);

-- Verification
-- SELECT TABLE_NAME, COLUMN_NAME, COLUMN_DEFAULT, IS_NULLABLE
-- FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_SCHEMA='kr_production'
--   AND TABLE_NAME IN ('simplex_machine_setup','simplex_production_detail')
--   AND COLUMN_NAME IN ('default_waste','waste')
-- ORDER BY TABLE_NAME, COLUMN_NAME;
