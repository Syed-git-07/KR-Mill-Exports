-- Actual waste is operator-entered production data. It must start at zero and
-- must not inherit a setup/reference value when a new entry is initialized.
ALTER TABLE `autoconer_production_detail`
  MODIFY COLUMN `waste_kg` DECIMAL(10, 4) NULL DEFAULT 0.0000;

ALTER TABLE `breaker_drawing_production_detail`
  MODIFY COLUMN `waste` DECIMAL(10, 4) NULL DEFAULT 0.0000;

ALTER TABLE `carding_production_detail`
  MODIFY COLUMN `waste` DECIMAL(10, 4) NULL DEFAULT 0.0000;

ALTER TABLE `comber_production_detail`
  MODIFY COLUMN `waste` DECIMAL(10, 4) NULL DEFAULT 0.0000;

ALTER TABLE `finisher_drawing_production_detail`
  MODIFY COLUMN `waste` DECIMAL(10, 4) NULL DEFAULT 0.0000;

ALTER TABLE `lap_former_production_detail`
  MODIFY COLUMN `waste` DECIMAL(10, 4) NULL DEFAULT 0.0000;

ALTER TABLE `simplex_production_detail`
  MODIFY COLUMN `waste` DECIMAL(10, 4) NULL DEFAULT 0.0000;

ALTER TABLE `spinning_production_detail`
  MODIFY COLUMN `waste` DECIMAL(10, 4) NULL DEFAULT 0.0000;

-- Keep the legacy setup columns nullable for compatibility, but stop MySQL
-- from inventing non-zero values when no explicit setup value was supplied.
ALTER TABLE `breaker_drawing_machine_setup`
  MODIFY COLUMN `default_waste` DECIMAL(10, 4) NULL DEFAULT NULL;

ALTER TABLE `carding_machine_setup`
  MODIFY COLUMN `default_waste` DECIMAL(10, 4) NULL DEFAULT NULL;

ALTER TABLE `comber_machine_setup`
  MODIFY COLUMN `default_waste` DECIMAL(10, 4) NULL DEFAULT NULL;

ALTER TABLE `finisher_drawing_machine_setup`
  MODIFY COLUMN `default_waste` DECIMAL(10, 4) NULL DEFAULT NULL;

ALTER TABLE `lap_former_machine_setup`
  MODIFY COLUMN `default_waste` DECIMAL(10, 4) NULL DEFAULT NULL;

ALTER TABLE `simplex_machine_setup`
  MODIFY COLUMN `default_waste` DECIMAL(10, 4) NULL DEFAULT NULL;
