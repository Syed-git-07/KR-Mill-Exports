-- Count/mixing selected inside an entry belongs to that date/shift snapshot.
-- Backfill from the production detail where possible; only baseline rows without
-- an entry detail fall back to the machine master value.

ALTER TABLE `carding_machine_setup`
  ADD COLUMN `prodn_mixing` VARCHAR(100) NULL;

UPDATE `carding_machine_setup` setup_row
JOIN `carding_production_header` header_row
  ON header_row.`entry_date` = setup_row.`entry_date`
 AND header_row.`shift` = setup_row.`shift`
JOIN `carding_production_detail` detail_row
  ON detail_row.`header_id` = header_row.`id`
 AND detail_row.`machine_id` = setup_row.`machine_id`
SET setup_row.`prodn_mixing` = detail_row.`count_mixing`;

UPDATE `carding_machine_setup` setup_row
JOIN `carding_machines` machine_row ON machine_row.`id` = setup_row.`machine_id`
SET setup_row.`prodn_mixing` = machine_row.`prodn_mixing`
WHERE setup_row.`prodn_mixing` IS NULL;

ALTER TABLE `breaker_drawing_machine_setup`
  ADD COLUMN `prodn_mixing` VARCHAR(100) NULL;

UPDATE `breaker_drawing_machine_setup` setup_row
JOIN `breaker_drawing_production_header` header_row
  ON header_row.`entry_date` = setup_row.`entry_date`
 AND header_row.`shift` = setup_row.`shift`
JOIN `breaker_drawing_production_detail` detail_row
  ON detail_row.`header_id` = header_row.`id`
 AND detail_row.`machine_id` = setup_row.`machine_id`
SET setup_row.`prodn_mixing` = detail_row.`prodn_mixing`;

UPDATE `breaker_drawing_machine_setup` setup_row
JOIN `drawing_breaker_machines` machine_row ON machine_row.`id` = setup_row.`machine_id`
SET setup_row.`prodn_mixing` = machine_row.`prodn_mixing`
WHERE setup_row.`prodn_mixing` IS NULL;

ALTER TABLE `lap_former_machine_setup`
  ADD COLUMN `prodn_mixing` VARCHAR(100) NULL;

UPDATE `lap_former_machine_setup` setup_row
JOIN `lap_former_production_header` header_row
  ON header_row.`entry_date` = setup_row.`entry_date`
 AND header_row.`shift` = setup_row.`shift`
JOIN `lap_former_production_detail` detail_row
  ON detail_row.`header_id` = header_row.`id`
 AND detail_row.`machine_id` = setup_row.`machine_id`
SET setup_row.`prodn_mixing` = detail_row.`prodn_mixing`;

UPDATE `lap_former_machine_setup` setup_row
JOIN `lap_former_machines` machine_row ON machine_row.`id` = setup_row.`machine_id`
SET setup_row.`prodn_mixing` = machine_row.`prodn_mixing`
WHERE setup_row.`prodn_mixing` IS NULL;
