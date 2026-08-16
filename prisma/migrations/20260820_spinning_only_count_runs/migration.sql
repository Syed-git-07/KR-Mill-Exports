-- Count Change is restricted in application code to Spinning.
-- Preserve already-deployed run_sequence storage in other modules so existing
-- rows are not destructively collapsed. Repair the first attempt's partial DDL.

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'autoconer_machine_setup' AND column_name = 'run_sequence') = 0, 'ALTER TABLE `autoconer_machine_setup` ADD COLUMN `run_sequence` INTEGER NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'autoconer_production_detail' AND column_name = 'run_sequence') = 0, 'ALTER TABLE `autoconer_production_detail` ADD COLUMN `run_sequence` INTEGER NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'breaker_drawing_machine_setup' AND column_name = 'run_sequence') = 0, 'ALTER TABLE `breaker_drawing_machine_setup` ADD COLUMN `run_sequence` INTEGER NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'breaker_drawing_production_detail' AND column_name = 'run_sequence') = 0, 'ALTER TABLE `breaker_drawing_production_detail` ADD COLUMN `run_sequence` INTEGER NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Create each replacement before removing the old index so foreign keys remain
-- backed by a suitable leading-column index throughout the swap.
CREATE UNIQUE INDEX `tmp_autoconer_setup_run_unique` ON `autoconer_machine_setup`(`machine_id`, `entry_date`, `shift`, `run_sequence`);
DROP INDEX `idx_autoconer_machine_setup_date` ON `autoconer_machine_setup`;
ALTER TABLE `autoconer_machine_setup` RENAME INDEX `tmp_autoconer_setup_run_unique` TO `idx_autoconer_machine_setup_date`;

CREATE UNIQUE INDEX `tmp_autoconer_detail_run_unique` ON `autoconer_production_detail`(`header_id`, `machine_id`, `run_sequence`);
DROP INDEX `uq_autoconer_detail_header_machine` ON `autoconer_production_detail`;
ALTER TABLE `autoconer_production_detail` RENAME INDEX `tmp_autoconer_detail_run_unique` TO `uq_autoconer_detail_header_machine`;

CREATE UNIQUE INDEX `tmp_breaker_setup_run_unique` ON `breaker_drawing_machine_setup`(`machine_id`, `entry_date`, `shift`, `run_sequence`);
DROP INDEX `idx_breaker_setup_date` ON `breaker_drawing_machine_setup`;
ALTER TABLE `breaker_drawing_machine_setup` RENAME INDEX `tmp_breaker_setup_run_unique` TO `idx_breaker_setup_date`;

CREATE UNIQUE INDEX `tmp_breaker_detail_run_unique` ON `breaker_drawing_production_detail`(`header_id`, `machine_id`, `run_sequence`);
DROP INDEX `uq_breaker_detail_header_machine` ON `breaker_drawing_production_detail`;
ALTER TABLE `breaker_drawing_production_detail` RENAME INDEX `tmp_breaker_detail_run_unique` TO `uq_breaker_detail_header_machine`;

-- The failed attempt stopped before Carding changed. The remaining modules,
-- including Spinning, intentionally remain untouched.
