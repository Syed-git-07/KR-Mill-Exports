-- Convert Simplex mc_effi columns to decimal so setup can store fractional values.
-- Supports both percent-style values (92.50) and factor-style values (0.92).

ALTER TABLE simplex_machine_setup
  MODIFY COLUMN mc_effi DECIMAL(5,2) NULL DEFAULT 92.00;

ALTER TABLE simplex_machines
  MODIFY COLUMN mc_effi DECIMAL(5,2) NULL DEFAULT 0.00;
