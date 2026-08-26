-- Payroll employee IDs are external identifiers owned by PAYROLL_DATABASE_URL.
-- No foreign keys are created because payroll can be on another MySQL server.
-- Columns and indexes are checked independently so this migration can safely
-- repair a partially applied deployment.

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'autoconer_production_detail' AND column_name = 'payroll_employee_id') = 0, 'ALTER TABLE autoconer_production_detail ADD COLUMN payroll_employee_id INT NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'autoconer_production_detail' AND index_name = 'idx_autoconer_detail_payroll_employee') = 0, 'ALTER TABLE autoconer_production_detail ADD INDEX idx_autoconer_detail_payroll_employee (payroll_employee_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'breaker_drawing_production_detail' AND column_name = 'payroll_employee_id') = 0, 'ALTER TABLE breaker_drawing_production_detail ADD COLUMN payroll_employee_id INT NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'breaker_drawing_production_detail' AND index_name = 'idx_breaker_detail_payroll_employee') = 0, 'ALTER TABLE breaker_drawing_production_detail ADD INDEX idx_breaker_detail_payroll_employee (payroll_employee_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'carding_production_detail' AND column_name = 'payroll_employee_id') = 0, 'ALTER TABLE carding_production_detail ADD COLUMN payroll_employee_id INT NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'carding_production_detail' AND index_name = 'idx_carding_detail_payroll_employee') = 0, 'ALTER TABLE carding_production_detail ADD INDEX idx_carding_detail_payroll_employee (payroll_employee_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'comber_production_detail' AND column_name = 'payroll_employee_id') = 0, 'ALTER TABLE comber_production_detail ADD COLUMN payroll_employee_id INT NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'comber_production_detail' AND index_name = 'idx_comber_detail_payroll_employee') = 0, 'ALTER TABLE comber_production_detail ADD INDEX idx_comber_detail_payroll_employee (payroll_employee_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'finisher_drawing_production_detail' AND column_name = 'payroll_employee_id') = 0, 'ALTER TABLE finisher_drawing_production_detail ADD COLUMN payroll_employee_id INT NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'finisher_drawing_production_detail' AND index_name = 'idx_finisher_detail_payroll_employee') = 0, 'ALTER TABLE finisher_drawing_production_detail ADD INDEX idx_finisher_detail_payroll_employee (payroll_employee_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'lap_former_production_detail' AND column_name = 'payroll_employee_id') = 0, 'ALTER TABLE lap_former_production_detail ADD COLUMN payroll_employee_id INT NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'lap_former_production_detail' AND index_name = 'idx_lap_detail_payroll_employee') = 0, 'ALTER TABLE lap_former_production_detail ADD INDEX idx_lap_detail_payroll_employee (payroll_employee_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'simplex_production_detail' AND column_name = 'payroll_employee_id') = 0, 'ALTER TABLE simplex_production_detail ADD COLUMN payroll_employee_id INT NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'simplex_production_detail' AND index_name = 'idx_simplex_detail_payroll_employee') = 0, 'ALTER TABLE simplex_production_detail ADD INDEX idx_simplex_detail_payroll_employee (payroll_employee_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'spinning_production_detail' AND column_name = 'sider1_payroll_employee_id') = 0, 'ALTER TABLE spinning_production_detail ADD COLUMN sider1_payroll_employee_id INT NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'spinning_production_detail' AND index_name = 'idx_spinning_detail_sider1_payroll_employee') = 0, 'ALTER TABLE spinning_production_detail ADD INDEX idx_spinning_detail_sider1_payroll_employee (sider1_payroll_employee_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'spinning_production_detail' AND column_name = 'sider2_payroll_employee_id') = 0, 'ALTER TABLE spinning_production_detail ADD COLUMN sider2_payroll_employee_id INT NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'spinning_production_detail' AND index_name = 'idx_spinning_detail_sider2_payroll_employee') = 0, 'ALTER TABLE spinning_production_detail ADD INDEX idx_spinning_detail_sider2_payroll_employee (sider2_payroll_employee_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Employee identity now comes only from payroll. This local table contained an
-- unsynchronized copy and is deliberately removed after all runtime references
-- have been eliminated.
DROP TABLE IF EXISTS employee_master;
