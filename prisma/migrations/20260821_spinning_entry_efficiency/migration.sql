-- Spinning Exp. GPS efficiency is an entry-scoped setup snapshot.
-- Normalize only the legacy generated 98.5% value; preserve any explicit custom value.
UPDATE `spinning_machine_setup`
SET `efficiency` = 0.950
WHERE `efficiency` IS NULL OR `efficiency` = 0.985;

ALTER TABLE `spinning_machine_setup`
  MODIFY COLUMN `efficiency` DECIMAL(5, 3) NULL DEFAULT 0.950;
