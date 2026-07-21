-- Simplex speed must be part of each date/shift setup snapshot, rather than
-- being read from or written to the global simplex machine master.
ALTER TABLE simplex_machine_setup
  ADD COLUMN speed INT NULL DEFAULT 960 AFTER shift;

-- Preserve the speed users saw before this migration as the initial baseline.
UPDATE simplex_machine_setup setup_row
INNER JOIN simplex_machines machine ON machine.id = setup_row.machine_id
SET setup_row.speed = COALESCE(machine.speed, 960);
