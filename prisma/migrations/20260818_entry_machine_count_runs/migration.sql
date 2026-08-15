-- A physical machine may run more than one count during one date/shift.
-- Existing rows remain run 1; no production or stoppage history is rewritten.

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'autoconer_machine_setup' AND column_name = 'run_sequence') = 0, 'ALTER TABLE `autoconer_machine_setup` ADD COLUMN `run_sequence` INTEGER NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'autoconer_production_detail' AND column_name = 'run_sequence') = 0, 'ALTER TABLE `autoconer_production_detail` ADD COLUMN `run_sequence` INTEGER NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
CREATE UNIQUE INDEX `idx_autoconer_machine_setup_date` ON `autoconer_machine_setup`(`machine_id`, `entry_date`, `shift`, `run_sequence`);
DROP INDEX `uq_autoconer_detail_header_machine` ON `autoconer_production_detail`;
CREATE UNIQUE INDEX `uq_autoconer_detail_header_machine` ON `autoconer_production_detail`(`header_id`, `machine_id`, `run_sequence`);

ALTER TABLE `breaker_drawing_machine_setup` ADD COLUMN `run_sequence` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `breaker_drawing_production_detail` ADD COLUMN `run_sequence` INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX `idx_breaker_setup_date` ON `breaker_drawing_machine_setup`(`machine_id`, `entry_date`, `shift`, `run_sequence`);
DROP INDEX `uq_breaker_detail_header_machine` ON `breaker_drawing_production_detail`;
CREATE UNIQUE INDEX `uq_breaker_detail_header_machine` ON `breaker_drawing_production_detail`(`header_id`, `machine_id`, `run_sequence`);

ALTER TABLE `carding_machine_setup` ADD COLUMN `run_sequence` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `carding_production_detail` ADD COLUMN `run_sequence` INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX `idx_carding_machine_setup_date` ON `carding_machine_setup`(`machine_id`, `entry_date`, `shift`, `run_sequence`);
DROP INDEX `uq_carding_detail_header_machine` ON `carding_production_detail`;
CREATE UNIQUE INDEX `uq_carding_detail_header_machine` ON `carding_production_detail`(`header_id`, `machine_id`, `run_sequence`);

ALTER TABLE `comber_machine_setup` ADD COLUMN `run_sequence` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `comber_production_detail` ADD COLUMN `run_sequence` INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX `idx_comber_setup_date` ON `comber_machine_setup`(`machine_id`, `entry_date`, `shift`, `run_sequence`);
DROP INDEX `uq_comber_detail_header_machine` ON `comber_production_detail`;
CREATE UNIQUE INDEX `uq_comber_detail_header_machine` ON `comber_production_detail`(`header_id`, `machine_id`, `run_sequence`);

ALTER TABLE `finisher_drawing_machine_setup` ADD COLUMN `run_sequence` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `finisher_drawing_production_detail` ADD COLUMN `run_sequence` INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX `idx_finisher_setup_date` ON `finisher_drawing_machine_setup`(`machine_id`, `entry_date`, `shift`, `run_sequence`);
DROP INDEX `uq_finisher_detail_header_machine` ON `finisher_drawing_production_detail`;
CREATE UNIQUE INDEX `uq_finisher_detail_header_machine` ON `finisher_drawing_production_detail`(`header_id`, `machine_id`, `run_sequence`);

ALTER TABLE `lap_former_machine_setup` ADD COLUMN `run_sequence` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `lap_former_production_detail` ADD COLUMN `run_sequence` INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX `idx_lap_former_setup_date` ON `lap_former_machine_setup`(`machine_id`, `entry_date`, `shift`, `run_sequence`);
DROP INDEX `uq_lap_detail_header_machine` ON `lap_former_production_detail`;
CREATE UNIQUE INDEX `uq_lap_detail_header_machine` ON `lap_former_production_detail`(`header_id`, `machine_id`, `run_sequence`);

ALTER TABLE `simplex_machine_setup` ADD COLUMN `run_sequence` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `simplex_production_detail` ADD COLUMN `run_sequence` INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX `idx_simplex_setup_date` ON `simplex_machine_setup`(`machine_id`, `entry_date`, `shift`, `run_sequence`);
DROP INDEX `uq_simplex_detail_header_machine` ON `simplex_production_detail`;
CREATE UNIQUE INDEX `uq_simplex_detail_header_machine` ON `simplex_production_detail`(`header_id`, `machine_id`, `run_sequence`);

ALTER TABLE `spinning_machine_setup` ADD COLUMN `run_sequence` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `spinning_production_detail` ADD COLUMN `run_sequence` INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX `idx_spinning_machine_setup_date` ON `spinning_machine_setup`(`machine_id`, `entry_date`, `shift`, `run_sequence`);
DROP INDEX `uq_spinning_detail_header_machine` ON `spinning_production_detail`;
CREATE UNIQUE INDEX `uq_spinning_detail_header_machine` ON `spinning_production_detail`(`header_id`, `machine_id`, `run_sequence`);
