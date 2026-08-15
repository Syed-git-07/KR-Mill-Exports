-- Preserve historical inactive revisions while allowing only one active row for
-- a normalized machine number. MySQL unique indexes allow multiple NULLs, so
-- inactive rows remain unrestricted.

ALTER TABLE `autoconer_machines`
  ADD COLUMN `active_machine_no` VARCHAR(255)
    GENERATED ALWAYS AS (CASE WHEN `is_active` = 1 THEN NULLIF(TRIM(`machine_no`), '') ELSE NULL END) STORED,
  ADD UNIQUE KEY `uq_autoconer_active_machine_no` (`active_machine_no`);

ALTER TABLE `carding_machines`
  ADD COLUMN `active_machine_no` VARCHAR(255)
    GENERATED ALWAYS AS (CASE WHEN `is_active` = 1 THEN NULLIF(TRIM(`machine_no`), '') ELSE NULL END) STORED,
  ADD UNIQUE KEY `uq_carding_active_machine_no` (`active_machine_no`);

ALTER TABLE `drawing_breaker_machines`
  ADD COLUMN `active_machine_no` VARCHAR(255)
    GENERATED ALWAYS AS (CASE WHEN `is_active` = 1 THEN NULLIF(TRIM(`machine_no`), '') ELSE NULL END) STORED,
  ADD UNIQUE KEY `uq_breaker_active_machine_no` (`active_machine_no`);

ALTER TABLE `comber_machines`
  ADD COLUMN `active_machine_no` VARCHAR(255)
    GENERATED ALWAYS AS (CASE WHEN `is_active` = 1 THEN NULLIF(TRIM(`machine_no`), '') ELSE NULL END) STORED,
  ADD UNIQUE KEY `uq_comber_active_machine_no` (`active_machine_no`);

ALTER TABLE `drawing_finisher_machines`
  ADD COLUMN `active_machine_no` VARCHAR(255)
    GENERATED ALWAYS AS (CASE WHEN `is_active` = 1 THEN NULLIF(TRIM(`machine_no`), '') ELSE NULL END) STORED,
  ADD UNIQUE KEY `uq_finisher_active_machine_no` (`active_machine_no`);

ALTER TABLE `lap_former_machines`
  ADD COLUMN `active_machine_no` VARCHAR(255)
    GENERATED ALWAYS AS (CASE WHEN `is_active` = 1 THEN NULLIF(TRIM(`machine_no`), '') ELSE NULL END) STORED,
  ADD UNIQUE KEY `uq_lap_former_active_machine_no` (`active_machine_no`);

ALTER TABLE `simplex_machines`
  ADD COLUMN `active_machine_no` VARCHAR(255)
    GENERATED ALWAYS AS (CASE WHEN `is_active` = 1 THEN NULLIF(TRIM(`machine_no`), '') ELSE NULL END) STORED,
  ADD UNIQUE KEY `uq_simplex_active_machine_no` (`active_machine_no`);

ALTER TABLE `spinning_machines`
  ADD COLUMN `active_machine_no` VARCHAR(255)
    GENERATED ALWAYS AS (CASE WHEN `is_active` = 1 THEN NULLIF(TRIM(`machine_no`), '') ELSE NULL END) STORED,
  ADD UNIQUE KEY `uq_spinning_active_machine_no` (`active_machine_no`);
