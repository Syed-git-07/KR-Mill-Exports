-- Comber mc_effi decimal migration
-- Purpose: allow decimal machine efficiency values (e.g. 93.50)

ALTER TABLE comber_machine_setup
  MODIFY COLUMN mc_effi DECIMAL(5,2) NULL DEFAULT 93.00;

ALTER TABLE comber_machines
  MODIFY COLUMN mc_effi DECIMAL(5,2) NULL DEFAULT 0.00;
