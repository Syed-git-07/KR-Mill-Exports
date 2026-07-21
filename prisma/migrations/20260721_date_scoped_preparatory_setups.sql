-- Make machine setup edits immutable per production date and shift.
-- Existing rows become the legacy baseline inherited by the first dated entry.

ALTER TABLE breaker_drawing_machine_setup
  ADD COLUMN entry_date DATE NOT NULL DEFAULT '1970-01-01' AFTER machine_id,
  ADD COLUMN shift INT NOT NULL DEFAULT 1 AFTER entry_date,
  ADD UNIQUE KEY idx_breaker_setup_date (machine_id, entry_date, shift);

ALTER TABLE comber_machine_setup
  ADD COLUMN entry_date DATE NOT NULL DEFAULT '1970-01-01' AFTER machine_id,
  ADD COLUMN shift INT NOT NULL DEFAULT 1 AFTER entry_date,
  ADD UNIQUE KEY idx_comber_setup_date (machine_id, entry_date, shift);

ALTER TABLE finisher_drawing_machine_setup
  ADD COLUMN entry_date DATE NOT NULL DEFAULT '1970-01-01' AFTER machine_id,
  ADD COLUMN shift INT NOT NULL DEFAULT 1 AFTER entry_date,
  ADD UNIQUE KEY idx_finisher_setup_date (machine_id, entry_date, shift);

ALTER TABLE lap_former_machine_setup
  ADD COLUMN entry_date DATE NOT NULL DEFAULT '1970-01-01' AFTER machine_id,
  ADD COLUMN shift INT NOT NULL DEFAULT 1 AFTER entry_date,
  ADD UNIQUE KEY idx_lap_former_setup_date (machine_id, entry_date, shift);

ALTER TABLE simplex_machine_setup
  ADD COLUMN entry_date DATE NOT NULL DEFAULT '1970-01-01' AFTER machine_id,
  ADD COLUMN shift INT NOT NULL DEFAULT 1 AFTER entry_date,
  ADD UNIQUE KEY idx_simplex_setup_date (machine_id, entry_date, shift);
