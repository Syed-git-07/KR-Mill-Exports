-- Read-path indexes only. These do not add uniqueness constraints or alter
-- application data; they support the filters already used by entry screens.

CREATE INDEX `idx_autoconer_setup_date_shift` ON `autoconer_machine_setup` (`entry_date`, `shift`);
CREATE INDEX `idx_autoconer_detail_header_machine` ON `autoconer_production_detail` (`header_id`, `machine_id`);
CREATE INDEX `idx_autoconer_header_date_shift` ON `autoconer_production_header` (`entry_date`, `shift`);
CREATE INDEX `idx_autoconer_stoppage_detail` ON `autoconer_stoppage_entry` (`production_detail_id`);

CREATE INDEX `idx_breaker_setup_date_shift` ON `breaker_drawing_machine_setup` (`entry_date`, `shift`);
CREATE INDEX `idx_breaker_detail_header_machine` ON `breaker_drawing_production_detail` (`header_id`, `machine_id`);
CREATE INDEX `idx_breaker_header_date_shift` ON `breaker_drawing_production_header` (`entry_date`, `shift`);
CREATE INDEX `idx_breaker_stoppage_detail` ON `breaker_drawing_stoppage_entry` (`production_detail_id`);

CREATE INDEX `idx_carding_setup_date_shift` ON `carding_machine_setup` (`entry_date`, `shift`);
CREATE INDEX `idx_carding_detail_header_machine` ON `carding_production_detail` (`header_id`, `machine_id`);
CREATE INDEX `idx_carding_header_date_shift` ON `carding_production_header` (`entry_date`, `shift`);
CREATE INDEX `idx_carding_stoppage_detail` ON `carding_stoppage_entry` (`production_detail_id`);

CREATE INDEX `idx_comber_setup_date_shift` ON `comber_machine_setup` (`entry_date`, `shift`);
CREATE INDEX `idx_comber_detail_header_machine` ON `comber_production_detail` (`header_id`, `machine_id`);
CREATE INDEX `idx_comber_header_date_shift` ON `comber_production_header` (`entry_date`, `shift`);
CREATE INDEX `idx_comber_stoppage_detail` ON `comber_stoppage_entry` (`production_detail_id`);

CREATE INDEX `idx_finisher_setup_date_shift` ON `finisher_drawing_machine_setup` (`entry_date`, `shift`);
CREATE INDEX `idx_finisher_detail_header_machine` ON `finisher_drawing_production_detail` (`header_id`, `machine_id`);
CREATE INDEX `idx_finisher_header_date_shift` ON `finisher_drawing_production_header` (`entry_date`, `shift`);
CREATE INDEX `idx_finisher_stoppage_detail` ON `finisher_drawing_stoppage_entry` (`production_detail_id`);

CREATE INDEX `idx_lap_former_setup_date_shift` ON `lap_former_machine_setup` (`entry_date`, `shift`);
CREATE INDEX `idx_lap_former_detail_header_machine` ON `lap_former_production_detail` (`header_id`, `machine_id`);
CREATE INDEX `idx_lap_former_header_date_shift` ON `lap_former_production_header` (`entry_date`, `shift`);
CREATE INDEX `idx_lap_former_stoppage_detail` ON `lap_former_stoppage_entry` (`production_detail_id`);

CREATE INDEX `idx_simplex_setup_date_shift` ON `simplex_machine_setup` (`entry_date`, `shift`);
CREATE INDEX `idx_simplex_detail_header_machine` ON `simplex_production_detail` (`header_id`, `machine_id`);
CREATE INDEX `idx_simplex_header_date_shift` ON `simplex_production_header` (`entry_date`, `shift`);
CREATE INDEX `idx_simplex_stoppage_detail` ON `simplex_stoppage_entry` (`production_detail_id`);

CREATE INDEX `idx_spinning_setup_date_shift` ON `spinning_machine_setup` (`entry_date`, `shift`);
CREATE INDEX `idx_spinning_detail_header_machine` ON `spinning_production_detail` (`header_id`, `machine_id`);
CREATE INDEX `idx_spinning_header_date_shift` ON `spinning_production_header` (`entry_date`, `shift`);
CREATE INDEX `idx_spinning_stoppage_detail` ON `spinning_stoppage_entry` (`production_detail_id`);
