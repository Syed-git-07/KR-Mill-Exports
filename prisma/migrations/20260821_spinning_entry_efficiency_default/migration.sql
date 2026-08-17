ALTER TABLE `spinning_machine_setup`
  MODIFY `efficiency` DECIMAL(5,3) NULL DEFAULT 0.950;

UPDATE `spinning_machine_setup`
SET `efficiency` = 0.950
WHERE `efficiency` IS NULL OR `efficiency` = 0.985;
