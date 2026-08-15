-- TW.Con is a measured setup value and must retain fractional precision.
ALTER TABLE `spinning_machine_setup`
  MODIFY COLUMN `tw_con` DECIMAL(10, 3) NULL DEFAULT 4.000;
