-- FINALPRODUCTION / PAYROLL EMPLOYEE-IDENTITY CLEANUP (MySQL 8+)
--
-- Scope:
--   * Writes only to finalproduction.
--   * Reads payroll.employees; it never inserts, updates, or deletes payroll data.
--   * Keeps production quantities and historical name snapshots unchanged.
--   * Backfills an ID only when one normalized name identifies exactly one
--     employee in PAYROLL_COMPANY_ID.
--   * Leaves duplicate-name and unknown-name history unresolved for manual
--     mapping by payroll employee ID.
--
-- This Workbench script is for the sample deployment where finalproduction and
-- payroll are schemas on the same MySQL server. Application runtime schema names
-- remain configured by DATABASE_URL and PAYROLL_DATABASE_URL.

SET @payroll_company_id = 1;

SELECT DATABASE() AS initially_selected_schema,
       @@version AS mysql_version,
       @payroll_company_id AS payroll_company_id;

SELECT schema_name
FROM information_schema.schemata
WHERE schema_name IN ('finalproduction', 'payroll')
ORDER BY schema_name;

-- This backup contains identity fields only. It is deliberately persistent and
-- idempotent so a row's pre-backfill identity can be inspected later.
CREATE TABLE IF NOT EXISTS finalproduction.legacy_employee_identity_backup (
  source_key VARCHAR(64) NOT NULL,
  detail_id VARCHAR(191) NOT NULL,
  snapshot_name VARCHAR(512) NOT NULL,
  previous_payroll_employee_id INT NULL,
  backed_up_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (source_key, detail_id)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT IGNORE INTO finalproduction.legacy_employee_identity_backup
  (source_key, detail_id, snapshot_name, previous_payroll_employee_id)
SELECT 'autoconer', CAST(id AS CHAR), TRIM(emp_name), payroll_employee_id
FROM finalproduction.autoconer_production_detail
WHERE payroll_employee_id IS NULL AND emp_name IS NOT NULL AND TRIM(emp_name) <> ''
UNION ALL
SELECT 'breaker', CAST(id AS CHAR), TRIM(employee_name), payroll_employee_id
FROM finalproduction.breaker_drawing_production_detail
WHERE payroll_employee_id IS NULL AND employee_name IS NOT NULL AND TRIM(employee_name) <> ''
UNION ALL
SELECT 'carding', CAST(id AS CHAR), TRIM(employee_name), payroll_employee_id
FROM finalproduction.carding_production_detail
WHERE payroll_employee_id IS NULL AND employee_name IS NOT NULL AND TRIM(employee_name) <> ''
UNION ALL
SELECT 'comber', CAST(id AS CHAR), TRIM(employee_name), payroll_employee_id
FROM finalproduction.comber_production_detail
WHERE payroll_employee_id IS NULL AND employee_name IS NOT NULL AND TRIM(employee_name) <> ''
UNION ALL
SELECT 'finisher', CAST(id AS CHAR), TRIM(employee_name), payroll_employee_id
FROM finalproduction.finisher_drawing_production_detail
WHERE payroll_employee_id IS NULL AND employee_name IS NOT NULL AND TRIM(employee_name) <> ''
UNION ALL
SELECT 'lap_former', CAST(id AS CHAR), TRIM(employee_name), payroll_employee_id
FROM finalproduction.lap_former_production_detail
WHERE payroll_employee_id IS NULL AND employee_name IS NOT NULL AND TRIM(employee_name) <> ''
UNION ALL
SELECT 'simplex', CAST(id AS CHAR), TRIM(employee_name), payroll_employee_id
FROM finalproduction.simplex_production_detail
WHERE payroll_employee_id IS NULL AND employee_name IS NOT NULL AND TRIM(employee_name) <> ''
UNION ALL
SELECT 'spinning_sider1', CAST(id AS CHAR), TRIM(sider1_name), sider1_payroll_employee_id
FROM finalproduction.spinning_production_detail
WHERE sider1_payroll_employee_id IS NULL AND sider1_name IS NOT NULL AND TRIM(sider1_name) <> ''
UNION ALL
SELECT 'spinning_sider2', CAST(id AS CHAR), TRIM(sider2_name), sider2_payroll_employee_id
FROM finalproduction.spinning_production_detail
WHERE sider2_payroll_employee_id IS NULL AND sider2_name IS NOT NULL AND TRIM(sider2_name) <> ''
UNION ALL
SELECT 'supervisor', CAST(id AS CHAR), TRIM(supervisor_name), payroll_employee_id
FROM finalproduction.supervisors
WHERE payroll_employee_id IS NULL AND supervisor_name IS NOT NULL AND TRIM(supervisor_name) <> '';

DROP TEMPORARY TABLE IF EXISTS tmp_payroll_name_variants;
CREATE TEMPORARY TABLE tmp_payroll_name_variants (
  employee_id INT NOT NULL,
  normalized_name VARCHAR(512) NOT NULL,
  employee_status VARCHAR(64) NULL,
  PRIMARY KEY (employee_id, normalized_name),
  INDEX idx_tmp_normalized_name (normalized_name)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Payroll names are represented by the same four variants used by the app:
-- first; first+middle; first+last; first+middle+last. Punctuation and repeated
-- whitespace are normalized for legacy comparison only.
INSERT IGNORE INTO tmp_payroll_name_variants
  (employee_id, normalized_name, employee_status)
SELECT variants.employee_id,
       TRIM(REGEXP_REPLACE(REGEXP_REPLACE(UPPER(variants.name_variant), '[^A-Z0-9]+', ' '), '[[:space:]]+', ' ')),
       variants.employee_status
FROM (
  SELECT id AS employee_id, status AS employee_status,
         CONCAT_WS(' ', NULLIF(NULLIF(TRIM(firstName), ''), '-')) AS name_variant
  FROM payroll.employees WHERE companyId = @payroll_company_id
  UNION ALL
  SELECT id, status,
         CONCAT_WS(' ', NULLIF(NULLIF(TRIM(firstName), ''), '-'), NULLIF(NULLIF(TRIM(middleName), ''), '-'))
  FROM payroll.employees WHERE companyId = @payroll_company_id
  UNION ALL
  SELECT id, status,
         CONCAT_WS(' ', NULLIF(NULLIF(TRIM(firstName), ''), '-'), NULLIF(NULLIF(TRIM(lastName), ''), '-'))
  FROM payroll.employees WHERE companyId = @payroll_company_id
  UNION ALL
  SELECT id, status,
         CONCAT_WS(' ', NULLIF(NULLIF(TRIM(firstName), ''), '-'), NULLIF(NULLIF(TRIM(middleName), ''), '-'), NULLIF(NULLIF(TRIM(lastName), ''), '-'))
  FROM payroll.employees WHERE companyId = @payroll_company_id
) AS variants
WHERE TRIM(variants.name_variant) <> '';

DROP TEMPORARY TABLE IF EXISTS tmp_unique_payroll_names;
CREATE TEMPORARY TABLE tmp_unique_payroll_names (
  normalized_name VARCHAR(512) NOT NULL,
  employee_id INT NOT NULL,
  PRIMARY KEY (normalized_name),
  INDEX idx_tmp_unique_employee (employee_id)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
INSERT INTO tmp_unique_payroll_names (normalized_name, employee_id)
SELECT normalized_name, MIN(employee_id) AS employee_id
FROM tmp_payroll_name_variants
GROUP BY normalized_name
HAVING COUNT(DISTINCT employee_id) = 1;

DROP TEMPORARY TABLE IF EXISTS tmp_unique_active_payroll_names;
CREATE TEMPORARY TABLE tmp_unique_active_payroll_names (
  normalized_name VARCHAR(512) NOT NULL,
  employee_id INT NOT NULL,
  PRIMARY KEY (normalized_name),
  INDEX idx_tmp_unique_active_employee (employee_id)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
INSERT INTO tmp_unique_active_payroll_names (normalized_name, employee_id)
SELECT normalized_name, MIN(employee_id) AS employee_id
FROM tmp_payroll_name_variants
WHERE employee_status = 'Active'
GROUP BY normalized_name
HAVING COUNT(DISTINCT employee_id) = 1;

START TRANSACTION;

UPDATE finalproduction.autoconer_production_detail AS d
JOIN tmp_unique_payroll_names AS u
  ON u.normalized_name = TRIM(REGEXP_REPLACE(REGEXP_REPLACE(UPPER(d.emp_name), '[^A-Z0-9]+', ' '), '[[:space:]]+', ' '))
SET d.payroll_employee_id = u.employee_id
WHERE d.payroll_employee_id IS NULL AND d.emp_name IS NOT NULL AND TRIM(d.emp_name) <> '';
SELECT 'autoconer' AS source_key, ROW_COUNT() AS rows_linked;

UPDATE finalproduction.breaker_drawing_production_detail AS d
JOIN tmp_unique_payroll_names AS u
  ON u.normalized_name = TRIM(REGEXP_REPLACE(REGEXP_REPLACE(UPPER(d.employee_name), '[^A-Z0-9]+', ' '), '[[:space:]]+', ' '))
SET d.payroll_employee_id = u.employee_id
WHERE d.payroll_employee_id IS NULL AND d.employee_name IS NOT NULL AND TRIM(d.employee_name) <> '';
SELECT 'breaker' AS source_key, ROW_COUNT() AS rows_linked;

UPDATE finalproduction.carding_production_detail AS d
JOIN tmp_unique_payroll_names AS u
  ON u.normalized_name = TRIM(REGEXP_REPLACE(REGEXP_REPLACE(UPPER(d.employee_name), '[^A-Z0-9]+', ' '), '[[:space:]]+', ' '))
SET d.payroll_employee_id = u.employee_id
WHERE d.payroll_employee_id IS NULL AND d.employee_name IS NOT NULL AND TRIM(d.employee_name) <> '';
SELECT 'carding' AS source_key, ROW_COUNT() AS rows_linked;

UPDATE finalproduction.comber_production_detail AS d
JOIN tmp_unique_payroll_names AS u
  ON u.normalized_name = TRIM(REGEXP_REPLACE(REGEXP_REPLACE(UPPER(d.employee_name), '[^A-Z0-9]+', ' '), '[[:space:]]+', ' '))
SET d.payroll_employee_id = u.employee_id
WHERE d.payroll_employee_id IS NULL AND d.employee_name IS NOT NULL AND TRIM(d.employee_name) <> '';
SELECT 'comber' AS source_key, ROW_COUNT() AS rows_linked;

UPDATE finalproduction.finisher_drawing_production_detail AS d
JOIN tmp_unique_payroll_names AS u
  ON u.normalized_name = TRIM(REGEXP_REPLACE(REGEXP_REPLACE(UPPER(d.employee_name), '[^A-Z0-9]+', ' '), '[[:space:]]+', ' '))
SET d.payroll_employee_id = u.employee_id
WHERE d.payroll_employee_id IS NULL AND d.employee_name IS NOT NULL AND TRIM(d.employee_name) <> '';
SELECT 'finisher' AS source_key, ROW_COUNT() AS rows_linked;

UPDATE finalproduction.lap_former_production_detail AS d
JOIN tmp_unique_payroll_names AS u
  ON u.normalized_name = TRIM(REGEXP_REPLACE(REGEXP_REPLACE(UPPER(d.employee_name), '[^A-Z0-9]+', ' '), '[[:space:]]+', ' '))
SET d.payroll_employee_id = u.employee_id
WHERE d.payroll_employee_id IS NULL AND d.employee_name IS NOT NULL AND TRIM(d.employee_name) <> '';
SELECT 'lap_former' AS source_key, ROW_COUNT() AS rows_linked;

UPDATE finalproduction.simplex_production_detail AS d
JOIN tmp_unique_payroll_names AS u
  ON u.normalized_name = TRIM(REGEXP_REPLACE(REGEXP_REPLACE(UPPER(d.employee_name), '[^A-Z0-9]+', ' '), '[[:space:]]+', ' '))
SET d.payroll_employee_id = u.employee_id
WHERE d.payroll_employee_id IS NULL AND d.employee_name IS NOT NULL AND TRIM(d.employee_name) <> '';
SELECT 'simplex' AS source_key, ROW_COUNT() AS rows_linked;

UPDATE finalproduction.spinning_production_detail AS d
JOIN tmp_unique_payroll_names AS u
  ON u.normalized_name = TRIM(REGEXP_REPLACE(REGEXP_REPLACE(UPPER(d.sider1_name), '[^A-Z0-9]+', ' '), '[[:space:]]+', ' '))
SET d.sider1_payroll_employee_id = u.employee_id
WHERE d.sider1_payroll_employee_id IS NULL AND d.sider1_name IS NOT NULL AND TRIM(d.sider1_name) <> '';
SELECT 'spinning_sider1' AS source_key, ROW_COUNT() AS rows_linked;

UPDATE finalproduction.spinning_production_detail AS d
JOIN tmp_unique_payroll_names AS u
  ON u.normalized_name = TRIM(REGEXP_REPLACE(REGEXP_REPLACE(UPPER(d.sider2_name), '[^A-Z0-9]+', ' '), '[[:space:]]+', ' '))
SET d.sider2_payroll_employee_id = u.employee_id
WHERE d.sider2_payroll_employee_id IS NULL AND d.sider2_name IS NOT NULL AND TRIM(d.sider2_name) <> '';
SELECT 'spinning_sider2' AS source_key, ROW_COUNT() AS rows_linked;

-- Supervisor/maisitry is a live local role assignment, so an automatic match
-- is allowed only when exactly one ACTIVE payroll employee has the name.
UPDATE finalproduction.supervisors AS d
JOIN tmp_unique_active_payroll_names AS u
  ON u.normalized_name = TRIM(REGEXP_REPLACE(REGEXP_REPLACE(UPPER(d.supervisor_name), '[^A-Z0-9]+', ' '), '[[:space:]]+', ' '))
SET d.payroll_employee_id = u.employee_id
WHERE d.payroll_employee_id IS NULL AND d.supervisor_name IS NOT NULL AND TRIM(d.supervisor_name) <> '';
SELECT 'supervisor' AS source_key, ROW_COUNT() AS rows_linked;

COMMIT;

-- Runtime no longer has any employee_master caller. Removing this unsynchronised
-- local copy cannot alter production-detail history.
DROP TABLE IF EXISTS finalproduction.employee_master;

-- POST-RUN VERIFICATION -----------------------------------------------------

SELECT source_key, unresolved_named_rows
FROM (
  SELECT 'autoconer' source_key, COUNT(*) unresolved_named_rows FROM finalproduction.autoconer_production_detail WHERE payroll_employee_id IS NULL AND emp_name IS NOT NULL AND TRIM(emp_name) <> ''
  UNION ALL SELECT 'breaker', COUNT(*) FROM finalproduction.breaker_drawing_production_detail WHERE payroll_employee_id IS NULL AND employee_name IS NOT NULL AND TRIM(employee_name) <> ''
  UNION ALL SELECT 'carding', COUNT(*) FROM finalproduction.carding_production_detail WHERE payroll_employee_id IS NULL AND employee_name IS NOT NULL AND TRIM(employee_name) <> ''
  UNION ALL SELECT 'comber', COUNT(*) FROM finalproduction.comber_production_detail WHERE payroll_employee_id IS NULL AND employee_name IS NOT NULL AND TRIM(employee_name) <> ''
  UNION ALL SELECT 'finisher', COUNT(*) FROM finalproduction.finisher_drawing_production_detail WHERE payroll_employee_id IS NULL AND employee_name IS NOT NULL AND TRIM(employee_name) <> ''
  UNION ALL SELECT 'lap_former', COUNT(*) FROM finalproduction.lap_former_production_detail WHERE payroll_employee_id IS NULL AND employee_name IS NOT NULL AND TRIM(employee_name) <> ''
  UNION ALL SELECT 'simplex', COUNT(*) FROM finalproduction.simplex_production_detail WHERE payroll_employee_id IS NULL AND employee_name IS NOT NULL AND TRIM(employee_name) <> ''
  UNION ALL SELECT 'spinning_sider1', COUNT(*) FROM finalproduction.spinning_production_detail WHERE sider1_payroll_employee_id IS NULL AND sider1_name IS NOT NULL AND TRIM(sider1_name) <> ''
  UNION ALL SELECT 'spinning_sider2', COUNT(*) FROM finalproduction.spinning_production_detail WHERE sider2_payroll_employee_id IS NULL AND sider2_name IS NOT NULL AND TRIM(sider2_name) <> ''
  UNION ALL SELECT 'supervisor', COUNT(*) FROM finalproduction.supervisors WHERE payroll_employee_id IS NULL AND supervisor_name IS NOT NULL AND TRIM(supervisor_name) <> ''
) AS unresolved
ORDER BY source_key;

-- Every value in this result must be 0. Historical unresolved snapshots may
-- remain above, but no module's newest initialized entry may contain one.
SELECT source_key, unresolved_latest_entry_rows
FROM (
  SELECT 'autoconer' source_key, COUNT(*) unresolved_latest_entry_rows
  FROM finalproduction.autoconer_production_detail d
  JOIN finalproduction.autoconer_production_header h ON h.id = d.header_id
  WHERE h.id = (SELECT h2.id FROM finalproduction.autoconer_production_header h2
                WHERE EXISTS (SELECT 1 FROM finalproduction.autoconer_production_detail d2 WHERE d2.header_id = h2.id)
                ORDER BY h2.entry_date DESC, h2.shift DESC LIMIT 1)
    AND d.payroll_employee_id IS NULL AND d.emp_name IS NOT NULL AND TRIM(d.emp_name) <> ''
  UNION ALL
  SELECT 'breaker', COUNT(*)
  FROM finalproduction.breaker_drawing_production_detail d
  JOIN finalproduction.breaker_drawing_production_header h ON h.id = d.header_id
  WHERE h.id = (SELECT h2.id FROM finalproduction.breaker_drawing_production_header h2
                WHERE EXISTS (SELECT 1 FROM finalproduction.breaker_drawing_production_detail d2 WHERE d2.header_id = h2.id)
                ORDER BY h2.entry_date DESC, h2.shift DESC LIMIT 1)
    AND d.payroll_employee_id IS NULL AND d.employee_name IS NOT NULL AND TRIM(d.employee_name) <> ''
  UNION ALL
  SELECT 'carding', COUNT(*)
  FROM finalproduction.carding_production_detail d
  JOIN finalproduction.carding_production_header h ON h.id = d.header_id
  WHERE h.id = (SELECT h2.id FROM finalproduction.carding_production_header h2
                WHERE EXISTS (SELECT 1 FROM finalproduction.carding_production_detail d2 WHERE d2.header_id = h2.id)
                ORDER BY h2.entry_date DESC, h2.shift DESC LIMIT 1)
    AND d.payroll_employee_id IS NULL AND d.employee_name IS NOT NULL AND TRIM(d.employee_name) <> ''
  UNION ALL
  SELECT 'comber', COUNT(*)
  FROM finalproduction.comber_production_detail d
  JOIN finalproduction.comber_production_header h ON h.id = d.header_id
  WHERE h.id = (SELECT h2.id FROM finalproduction.comber_production_header h2
                WHERE EXISTS (SELECT 1 FROM finalproduction.comber_production_detail d2 WHERE d2.header_id = h2.id)
                ORDER BY h2.entry_date DESC, h2.shift DESC LIMIT 1)
    AND d.payroll_employee_id IS NULL AND d.employee_name IS NOT NULL AND TRIM(d.employee_name) <> ''
  UNION ALL
  SELECT 'finisher', COUNT(*)
  FROM finalproduction.finisher_drawing_production_detail d
  JOIN finalproduction.finisher_drawing_production_header h ON h.id = d.header_id
  WHERE h.id = (SELECT h2.id FROM finalproduction.finisher_drawing_production_header h2
                WHERE EXISTS (SELECT 1 FROM finalproduction.finisher_drawing_production_detail d2 WHERE d2.header_id = h2.id)
                ORDER BY h2.entry_date DESC, h2.shift DESC LIMIT 1)
    AND d.payroll_employee_id IS NULL AND d.employee_name IS NOT NULL AND TRIM(d.employee_name) <> ''
  UNION ALL
  SELECT 'lap_former', COUNT(*)
  FROM finalproduction.lap_former_production_detail d
  JOIN finalproduction.lap_former_production_header h ON h.id = d.header_id
  WHERE h.id = (SELECT h2.id FROM finalproduction.lap_former_production_header h2
                WHERE EXISTS (SELECT 1 FROM finalproduction.lap_former_production_detail d2 WHERE d2.header_id = h2.id)
                ORDER BY h2.entry_date DESC, h2.shift DESC LIMIT 1)
    AND d.payroll_employee_id IS NULL AND d.employee_name IS NOT NULL AND TRIM(d.employee_name) <> ''
  UNION ALL
  SELECT 'simplex', COUNT(*)
  FROM finalproduction.simplex_production_detail d
  JOIN finalproduction.simplex_production_header h ON h.id = d.header_id
  WHERE h.id = (SELECT h2.id FROM finalproduction.simplex_production_header h2
                WHERE EXISTS (SELECT 1 FROM finalproduction.simplex_production_detail d2 WHERE d2.header_id = h2.id)
                ORDER BY h2.entry_date DESC, h2.shift DESC LIMIT 1)
    AND d.payroll_employee_id IS NULL AND d.employee_name IS NOT NULL AND TRIM(d.employee_name) <> ''
  UNION ALL
  SELECT 'spinning_sider1', COUNT(*)
  FROM finalproduction.spinning_production_detail d
  JOIN finalproduction.spinning_production_header h ON h.id = d.header_id
  WHERE h.id = (SELECT h2.id FROM finalproduction.spinning_production_header h2
                WHERE EXISTS (SELECT 1 FROM finalproduction.spinning_production_detail d2 WHERE d2.header_id = h2.id)
                ORDER BY h2.entry_date DESC, h2.shift DESC LIMIT 1)
    AND d.sider1_payroll_employee_id IS NULL AND d.sider1_name IS NOT NULL AND TRIM(d.sider1_name) <> ''
  UNION ALL
  SELECT 'spinning_sider2', COUNT(*)
  FROM finalproduction.spinning_production_detail d
  JOIN finalproduction.spinning_production_header h ON h.id = d.header_id
  WHERE h.id = (SELECT h2.id FROM finalproduction.spinning_production_header h2
                WHERE EXISTS (SELECT 1 FROM finalproduction.spinning_production_detail d2 WHERE d2.header_id = h2.id)
                ORDER BY h2.entry_date DESC, h2.shift DESC LIMIT 1)
    AND d.sider2_payroll_employee_id IS NULL AND d.sider2_name IS NOT NULL AND TRIM(d.sider2_name) <> ''
) AS latest_entry_audit
ORDER BY source_key;

-- Must return 0: every stored ID belongs to the configured payroll company.
SELECT COUNT(*) AS stored_ids_outside_configured_company
FROM (
  SELECT payroll_employee_id employee_id FROM finalproduction.autoconer_production_detail WHERE payroll_employee_id IS NOT NULL
  UNION SELECT payroll_employee_id FROM finalproduction.breaker_drawing_production_detail WHERE payroll_employee_id IS NOT NULL
  UNION SELECT payroll_employee_id FROM finalproduction.carding_production_detail WHERE payroll_employee_id IS NOT NULL
  UNION SELECT payroll_employee_id FROM finalproduction.comber_production_detail WHERE payroll_employee_id IS NOT NULL
  UNION SELECT payroll_employee_id FROM finalproduction.finisher_drawing_production_detail WHERE payroll_employee_id IS NOT NULL
  UNION SELECT payroll_employee_id FROM finalproduction.lap_former_production_detail WHERE payroll_employee_id IS NOT NULL
  UNION SELECT payroll_employee_id FROM finalproduction.simplex_production_detail WHERE payroll_employee_id IS NOT NULL
  UNION SELECT sider1_payroll_employee_id FROM finalproduction.spinning_production_detail WHERE sider1_payroll_employee_id IS NOT NULL
  UNION SELECT sider2_payroll_employee_id FROM finalproduction.spinning_production_detail WHERE sider2_payroll_employee_id IS NOT NULL
  UNION SELECT payroll_employee_id FROM finalproduction.supervisors WHERE payroll_employee_id IS NOT NULL
) AS stored_ids
LEFT JOIN payroll.employees AS employee
  ON employee.id = stored_ids.employee_id AND employee.companyId = @payroll_company_id
WHERE employee.id IS NULL;

-- Must return 0: a live supervisor role cannot point to an inactive employee.
SELECT COUNT(*) AS inactive_supervisor_assignments
FROM finalproduction.supervisors AS supervisor
LEFT JOIN payroll.employees AS employee
  ON employee.id = supervisor.payroll_employee_id
 AND employee.companyId = @payroll_company_id
 AND employee.status = 'Active'
WHERE supervisor.payroll_employee_id IS NOT NULL AND employee.id IS NULL;

-- Must return 0: the obsolete local employee table is gone.
SELECT COUNT(*) AS employee_master_table_count
FROM information_schema.tables
WHERE table_schema = 'finalproduction' AND table_name = 'employee_master';

SELECT COUNT(*) AS backed_up_legacy_identity_slots
FROM finalproduction.legacy_employee_identity_backup;

DROP TEMPORARY TABLE IF EXISTS tmp_unique_active_payroll_names;
DROP TEMPORARY TABLE IF EXISTS tmp_unique_payroll_names;
DROP TEMPORARY TABLE IF EXISTS tmp_payroll_name_variants;
