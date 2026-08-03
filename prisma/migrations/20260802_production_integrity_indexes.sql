-- Production integrity constraints
--
-- Run `npm run db:audit` before applying this script. The migration will stop if
-- duplicate date/shift, header/machine, or stoppage/detail rows already exist.
-- Take a database backup before applying this file to a customer installation.

ALTER TABLE `autoconer_production_header`
  ADD CONSTRAINT `uk_autoconer_header_date_shift` UNIQUE (`entry_date`, `shift`);
ALTER TABLE `autoconer_production_detail`
  ADD CONSTRAINT `uk_autoconer_detail_header_machine` UNIQUE (`header_id`, `machine_id`),
  ADD INDEX `idx_autoconer_detail_machine` (`machine_id`);
ALTER TABLE `autoconer_stoppage_entry`
  ADD CONSTRAINT `uk_autoconer_stoppage_detail` UNIQUE (`production_detail_id`);

ALTER TABLE `breaker_drawing_production_header`
  ADD CONSTRAINT `uk_breaker_header_date_shift` UNIQUE (`entry_date`, `shift`);
ALTER TABLE `breaker_drawing_production_detail`
  ADD CONSTRAINT `uk_breaker_detail_header_machine` UNIQUE (`header_id`, `machine_id`),
  ADD INDEX `idx_breaker_detail_machine` (`machine_id`);
ALTER TABLE `breaker_drawing_stoppage_entry`
  ADD CONSTRAINT `uk_breaker_stoppage_detail` UNIQUE (`production_detail_id`);

ALTER TABLE `carding_production_header`
  ADD CONSTRAINT `uk_carding_header_date_shift` UNIQUE (`entry_date`, `shift`);
ALTER TABLE `carding_production_detail`
  ADD CONSTRAINT `uk_carding_detail_header_machine` UNIQUE (`header_id`, `machine_id`),
  ADD INDEX `idx_carding_detail_machine` (`machine_id`);
ALTER TABLE `carding_stoppage_entry`
  ADD CONSTRAINT `uk_carding_stoppage_detail` UNIQUE (`production_detail_id`);

ALTER TABLE `comber_production_header`
  ADD CONSTRAINT `uk_comber_header_date_shift` UNIQUE (`entry_date`, `shift`);
ALTER TABLE `comber_production_detail`
  ADD CONSTRAINT `uk_comber_detail_header_machine` UNIQUE (`header_id`, `machine_id`),
  ADD INDEX `idx_comber_detail_machine` (`machine_id`);
ALTER TABLE `comber_stoppage_entry`
  ADD CONSTRAINT `uk_comber_stoppage_detail` UNIQUE (`production_detail_id`);

ALTER TABLE `finisher_drawing_production_header`
  ADD CONSTRAINT `uk_finisher_header_date_shift` UNIQUE (`entry_date`, `shift`);
ALTER TABLE `finisher_drawing_production_detail`
  ADD CONSTRAINT `uk_finisher_detail_header_machine` UNIQUE (`header_id`, `machine_id`),
  ADD INDEX `idx_finisher_detail_machine` (`machine_id`);
ALTER TABLE `finisher_drawing_stoppage_entry`
  ADD CONSTRAINT `uk_finisher_stoppage_detail` UNIQUE (`production_detail_id`);

ALTER TABLE `lap_former_production_header`
  ADD CONSTRAINT `uk_lap_header_date_shift` UNIQUE (`entry_date`, `shift`);
ALTER TABLE `lap_former_production_detail`
  ADD CONSTRAINT `uk_lap_detail_header_machine` UNIQUE (`header_id`, `machine_id`),
  ADD INDEX `idx_lap_detail_machine` (`machine_id`);
ALTER TABLE `lap_former_stoppage_entry`
  ADD CONSTRAINT `uk_lap_stoppage_detail` UNIQUE (`production_detail_id`);

ALTER TABLE `simplex_production_header`
  ADD CONSTRAINT `uk_simplex_header_date_shift` UNIQUE (`entry_date`, `shift`);
ALTER TABLE `simplex_production_detail`
  ADD CONSTRAINT `uk_simplex_detail_header_machine` UNIQUE (`header_id`, `machine_id`),
  ADD INDEX `idx_simplex_detail_machine` (`machine_id`);
ALTER TABLE `simplex_stoppage_entry`
  ADD CONSTRAINT `uk_simplex_stoppage_detail` UNIQUE (`production_detail_id`);

ALTER TABLE `spinning_production_header`
  ADD CONSTRAINT `uk_spinning_header_date_shift` UNIQUE (`entry_date`, `shift`);
ALTER TABLE `spinning_production_detail`
  ADD CONSTRAINT `uk_spinning_detail_header_machine` UNIQUE (`header_id`, `machine_id`),
  ADD INDEX `idx_spinning_detail_machine` (`machine_id`);
ALTER TABLE `spinning_stoppage_entry`
  ADD CONSTRAINT `uk_spinning_stoppage_detail` UNIQUE (`production_detail_id`);
