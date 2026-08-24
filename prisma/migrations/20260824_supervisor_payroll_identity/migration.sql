-- A supervisor/maisitry remains a local production role assignment, while the
-- person occupying that role is identified by the central payroll employee ID.
-- No cross-database foreign key is possible or desired.

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'supervisors' AND column_name = 'payroll_employee_id') = 0, 'ALTER TABLE supervisors ADD COLUMN payroll_employee_id INT NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'supervisors' AND index_name = 'idx_supervisors_payroll_employee') = 0, 'ALTER TABLE supervisors ADD INDEX idx_supervisors_payroll_employee (payroll_employee_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
