-- Department UUID remains the relational identity. Code and SL.NO are
-- system-owned display sequences and must never be supplied by an operator.

CREATE TEMPORARY TABLE `tmp_department_sequence` (
  `sequence_no` INTEGER NOT NULL AUTO_INCREMENT,
  `department_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`sequence_no`),
  UNIQUE KEY `uq_tmp_department_id` (`department_id`)
) ENGINE=InnoDB;

-- Preserve the existing display order while deterministically repairing null,
-- duplicate, or manually entered codes/serials before installing constraints.
INSERT INTO `tmp_department_sequence` (`department_id`)
SELECT `id`
FROM `departments`
ORDER BY `sl_no` ASC, `created_at` ASC, `id` ASC;

UPDATE `departments` AS `department`
INNER JOIN `tmp_department_sequence` AS `sequence`
  ON `sequence`.`department_id` = `department`.`id`
SET
  `department`.`sl_no` = `sequence`.`sequence_no`,
  `department`.`code` = `sequence`.`sequence_no`;

DROP TEMPORARY TABLE `tmp_department_sequence`;

ALTER TABLE `departments`
  MODIFY `code` INTEGER NOT NULL,
  ADD UNIQUE KEY `uq_departments_code` (`code`),
  ADD UNIQUE KEY `uq_departments_sl_no` (`sl_no`);
