-- RESET SAMPLE PRODUCTION ENTRY HISTORY (MySQL 8 / MySQL Workbench)
--
-- Deletes only production-entry transactions and dated entry snapshots for the
-- eight KR modules. It does not write to payroll and does not delete masters.
--
-- Preserved:
--   machine/count/mixing/stoppage/department/shift masters
--   supervisors, users, activity logs, holidays and all payroll data
--   machine setup baseline rows dated 1970-01-01
--
-- Safety workflow:
--   1. Back up finalproduction.
--   2. Run this file unchanged. ROLLBACK makes it a preview only.
--   3. Check that PREDICTED AFTER RESET is correct.
--   4. Comment ROLLBACK and uncomment COMMIT, then run the full file again.

USE finalproduction;

SELECT DATABASE() AS selected_database, @@version AS mysql_version;

-- BEFORE RESET: exact totals across all eight modules.
SELECT
  (SELECT COUNT(*) FROM autoconer_production_header) +
  (SELECT COUNT(*) FROM breaker_drawing_production_header) +
  (SELECT COUNT(*) FROM carding_production_header) +
  (SELECT COUNT(*) FROM comber_production_header) +
  (SELECT COUNT(*) FROM finisher_drawing_production_header) +
  (SELECT COUNT(*) FROM lap_former_production_header) +
  (SELECT COUNT(*) FROM simplex_production_header) +
  (SELECT COUNT(*) FROM spinning_production_header) AS production_headers,

  (SELECT COUNT(*) FROM autoconer_production_detail) +
  (SELECT COUNT(*) FROM breaker_drawing_production_detail) +
  (SELECT COUNT(*) FROM carding_production_detail) +
  (SELECT COUNT(*) FROM comber_production_detail) +
  (SELECT COUNT(*) FROM finisher_drawing_production_detail) +
  (SELECT COUNT(*) FROM lap_former_production_detail) +
  (SELECT COUNT(*) FROM simplex_production_detail) +
  (SELECT COUNT(*) FROM spinning_production_detail) AS production_details,

  (SELECT COUNT(*) FROM autoconer_stoppage_entry) +
  (SELECT COUNT(*) FROM breaker_drawing_stoppage_entry) +
  (SELECT COUNT(*) FROM carding_stoppage_entry) +
  (SELECT COUNT(*) FROM comber_stoppage_entry) +
  (SELECT COUNT(*) FROM finisher_drawing_stoppage_entry) +
  (SELECT COUNT(*) FROM lap_former_stoppage_entry) +
  (SELECT COUNT(*) FROM simplex_stoppage_entry) +
  (SELECT COUNT(*) FROM spinning_stoppage_entry) AS stoppage_entries,

  (SELECT COUNT(*) FROM autoconer_machine_setup WHERE entry_date <> '1970-01-01') +
  (SELECT COUNT(*) FROM breaker_drawing_machine_setup WHERE entry_date <> '1970-01-01') +
  (SELECT COUNT(*) FROM carding_machine_setup WHERE entry_date <> '1970-01-01') +
  (SELECT COUNT(*) FROM comber_machine_setup WHERE entry_date <> '1970-01-01') +
  (SELECT COUNT(*) FROM finisher_drawing_machine_setup WHERE entry_date <> '1970-01-01') +
  (SELECT COUNT(*) FROM lap_former_machine_setup WHERE entry_date <> '1970-01-01') +
  (SELECT COUNT(*) FROM simplex_machine_setup WHERE entry_date <> '1970-01-01') +
  (SELECT COUNT(*) FROM spinning_machine_setup WHERE entry_date <> '1970-01-01') AS dated_setup_snapshots,

  (SELECT COUNT(*) FROM autoconer_machine_setup WHERE entry_date = '1970-01-01') +
  (SELECT COUNT(*) FROM breaker_drawing_machine_setup WHERE entry_date = '1970-01-01') +
  (SELECT COUNT(*) FROM carding_machine_setup WHERE entry_date = '1970-01-01') +
  (SELECT COUNT(*) FROM comber_machine_setup WHERE entry_date = '1970-01-01') +
  (SELECT COUNT(*) FROM finisher_drawing_machine_setup WHERE entry_date = '1970-01-01') +
  (SELECT COUNT(*) FROM lap_former_machine_setup WHERE entry_date = '1970-01-01') +
  (SELECT COUNT(*) FROM simplex_machine_setup WHERE entry_date = '1970-01-01') +
  (SELECT COUNT(*) FROM spinning_machine_setup WHERE entry_date = '1970-01-01') AS preserved_baseline_setups;

SET @previous_sql_safe_updates = @@SQL_SAFE_UPDATES;
SET SQL_SAFE_UPDATES = 0;

START TRANSACTION;

-- Child rows first. Foreign-key cascades also exist, but explicit deletion
-- makes the reset scope clear and independently auditable.
DELETE FROM autoconer_stoppage_entry;
DELETE FROM breaker_drawing_stoppage_entry;
DELETE FROM carding_stoppage_entry;
DELETE FROM comber_stoppage_entry;
DELETE FROM finisher_drawing_stoppage_entry;
DELETE FROM lap_former_stoppage_entry;
DELETE FROM simplex_stoppage_entry;
DELETE FROM spinning_stoppage_entry;

DELETE FROM autoconer_production_detail;
DELETE FROM breaker_drawing_production_detail;
DELETE FROM carding_production_detail;
DELETE FROM comber_production_detail;
DELETE FROM finisher_drawing_production_detail;
DELETE FROM lap_former_production_detail;
DELETE FROM simplex_production_detail;
DELETE FROM spinning_production_detail;

DELETE FROM autoconer_production_header;
DELETE FROM breaker_drawing_production_header;
DELETE FROM carding_production_header;
DELETE FROM comber_production_header;
DELETE FROM finisher_drawing_production_header;
DELETE FROM lap_former_production_header;
DELETE FROM simplex_production_header;
DELETE FROM spinning_production_header;

-- Remove entry-specific setup history and exclusion markers. The 1970 rows
-- remain as reusable baseline configuration for the first clean entry.
DELETE FROM autoconer_machine_setup WHERE entry_date <> '1970-01-01';
DELETE FROM breaker_drawing_machine_setup WHERE entry_date <> '1970-01-01';
DELETE FROM carding_machine_setup WHERE entry_date <> '1970-01-01';
DELETE FROM comber_machine_setup WHERE entry_date <> '1970-01-01';
DELETE FROM finisher_drawing_machine_setup WHERE entry_date <> '1970-01-01';
DELETE FROM lap_former_machine_setup WHERE entry_date <> '1970-01-01';
DELETE FROM simplex_machine_setup WHERE entry_date <> '1970-01-01';
DELETE FROM spinning_machine_setup WHERE entry_date <> '1970-01-01';

-- PREDICTED AFTER RESET: all four values must be zero inside the transaction.
SELECT
  (SELECT COUNT(*) FROM autoconer_production_header) +
  (SELECT COUNT(*) FROM breaker_drawing_production_header) +
  (SELECT COUNT(*) FROM carding_production_header) +
  (SELECT COUNT(*) FROM comber_production_header) +
  (SELECT COUNT(*) FROM finisher_drawing_production_header) +
  (SELECT COUNT(*) FROM lap_former_production_header) +
  (SELECT COUNT(*) FROM simplex_production_header) +
  (SELECT COUNT(*) FROM spinning_production_header) AS remaining_headers,

  (SELECT COUNT(*) FROM autoconer_production_detail) +
  (SELECT COUNT(*) FROM breaker_drawing_production_detail) +
  (SELECT COUNT(*) FROM carding_production_detail) +
  (SELECT COUNT(*) FROM comber_production_detail) +
  (SELECT COUNT(*) FROM finisher_drawing_production_detail) +
  (SELECT COUNT(*) FROM lap_former_production_detail) +
  (SELECT COUNT(*) FROM simplex_production_detail) +
  (SELECT COUNT(*) FROM spinning_production_detail) AS remaining_details,

  (SELECT COUNT(*) FROM autoconer_stoppage_entry) +
  (SELECT COUNT(*) FROM breaker_drawing_stoppage_entry) +
  (SELECT COUNT(*) FROM carding_stoppage_entry) +
  (SELECT COUNT(*) FROM comber_stoppage_entry) +
  (SELECT COUNT(*) FROM finisher_drawing_stoppage_entry) +
  (SELECT COUNT(*) FROM lap_former_stoppage_entry) +
  (SELECT COUNT(*) FROM simplex_stoppage_entry) +
  (SELECT COUNT(*) FROM spinning_stoppage_entry) AS remaining_stoppages,

  (SELECT COUNT(*) FROM autoconer_machine_setup WHERE entry_date <> '1970-01-01') +
  (SELECT COUNT(*) FROM breaker_drawing_machine_setup WHERE entry_date <> '1970-01-01') +
  (SELECT COUNT(*) FROM carding_machine_setup WHERE entry_date <> '1970-01-01') +
  (SELECT COUNT(*) FROM comber_machine_setup WHERE entry_date <> '1970-01-01') +
  (SELECT COUNT(*) FROM finisher_drawing_machine_setup WHERE entry_date <> '1970-01-01') +
  (SELECT COUNT(*) FROM lap_former_machine_setup WHERE entry_date <> '1970-01-01') +
  (SELECT COUNT(*) FROM simplex_machine_setup WHERE entry_date <> '1970-01-01') +
  (SELECT COUNT(*) FROM spinning_machine_setup WHERE entry_date <> '1970-01-01') AS remaining_dated_setups;

-- SAFE DEFAULT: preview only. No deletion survives this execution.
ROLLBACK;

-- ACTUAL RESET: after reviewing the preview, comment ROLLBACK above and
-- uncomment COMMIT below, then execute the complete file again.
-- COMMIT;

SET SQL_SAFE_UPDATES = @previous_sql_safe_updates;

-- After the committed run, execute this file once more in preview mode or run
-- the BEFORE RESET query above. Headers/details/stoppages/dated snapshots must
-- all be zero; preserved_baseline_setups may remain nonzero.

-- Optional only after checking the external backup:
-- DROP TABLE IF EXISTS finalproduction.legacy_employee_identity_backup;

-- Optional only if sample Supervisor Master rows must also be discarded and
-- recreated through Supervisor Master using verified payroll employees:
-- DELETE FROM finalproduction.supervisors WHERE payroll_employee_id IS NULL;
