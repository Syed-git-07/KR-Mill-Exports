-- Make the selected spinning count a stable machine-master relationship while
-- retaining dated setup rows as immutable production-entry snapshots.

ALTER TABLE `spinning_machines`
  ADD COLUMN `speed` INT NULL,
  ADD COLUMN `count_id` CHAR(36) NULL,
  ADD INDEX `fk_spinning_machine_count` (`count_id`);

ALTER TABLE `spinning_machine_setup`
  ADD COLUMN `count_id` CHAR(36) NULL,
  ADD INDEX `fk_spinning_setup_count` (`count_id`);

ALTER TABLE `autoconer_machines`
  ADD COLUMN `count_id` CHAR(36) NULL,
  ADD INDEX `fk_autoconer_machine_count` (`count_id`);

ALTER TABLE `autoconer_machine_setup`
  ADD COLUMN `target_effi` DECIMAL(5, 2) NULL;

-- The former 2026-04-01 baseline is the existing source for each spinning
-- machine's selected count and rated speed. Copy it once into the master.
UPDATE `spinning_machines` AS m
JOIN `spinning_machine_setup` AS s
  ON s.`machine_id` = m.`id`
 AND s.`entry_date` = '2026-04-01'
 AND s.`shift` = 1
LEFT JOIN `spinning_counts` AS c
  ON c.`count_name` = s.`count_name`
SET m.`speed` = s.`speed`,
    m.`count_id` = c.`id`;

-- Give every existing spinning snapshot a stable count reference without
-- changing its snapshotted name or numeric values.
UPDATE `spinning_machine_setup` AS s
LEFT JOIN `spinning_counts` AS c
  ON c.`count_name` = s.`count_name`
SET s.`count_id` = c.`id`
WHERE s.`count_id` IS NULL;

-- Preserve the legacy Autoconer count selection and historical target
-- efficiency while moving future reads to count_id and dated setup snapshots.
UPDATE `autoconer_machines` AS m
LEFT JOIN `spinning_counts` AS c
  ON c.`count_name` = m.`count`
SET m.`count_id` = c.`id`
WHERE m.`count_id` IS NULL;

UPDATE `autoconer_machine_setup` AS s
JOIN `autoconer_machines` AS m ON m.`id` = s.`machine_id`
SET s.`target_effi` = m.`act_effi`
WHERE s.`target_effi` IS NULL;

ALTER TABLE `spinning_machines`
  ADD CONSTRAINT `fk_spinning_machine_count`
    FOREIGN KEY (`count_id`) REFERENCES `spinning_counts` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `spinning_machine_setup`
  ADD CONSTRAINT `fk_spinning_setup_count`
    FOREIGN KEY (`count_id`) REFERENCES `spinning_counts` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `autoconer_machines`
  ADD CONSTRAINT `fk_autoconer_machine_count`
    FOREIGN KEY (`count_id`) REFERENCES `spinning_counts` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
