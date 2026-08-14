-- Preserve the 40s conversion factor used by an entry so later Count Master
-- edits do not change historical production summaries.
ALTER TABLE `spinning_machine_setup`
  ADD COLUMN `conv_40s_value` DECIMAL(10, 2) NULL;

UPDATE `spinning_machine_setup` AS setup_row
JOIN `spinning_counts` AS count_row ON count_row.`id` = setup_row.`count_id`
SET setup_row.`conv_40s_value` = count_row.`conv_40s_value`;
