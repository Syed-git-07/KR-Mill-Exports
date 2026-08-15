-- Remove legacy uniqueness rules that predate run_sequence.
-- Index names may have been generated differently by Prisma/db push, so each
-- obsolete index is located by its exact ordered column list.
-- The newer run_sequence-aware unique indexes are intentionally preserved.

-- Legacy setup uniqueness: autoconer_machine_setup
SET @legacy_index = (
  SELECT grouped_indexes.index_name
  FROM (
    SELECT index_name,
           GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS indexed_columns
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'autoconer_machine_setup'
      AND non_unique = 0
      AND index_name <> 'PRIMARY'
    GROUP BY index_name
  ) AS grouped_indexes
  WHERE grouped_indexes.indexed_columns = 'machine_id,entry_date,shift'
  LIMIT 1
);
SET @ddl = IF(
  @legacy_index IS NULL,
  'SELECT 1',
  CONCAT('DROP INDEX \`', REPLACE(@legacy_index, '\`', '\`\`'), '\` ON \`autoconer_machine_setup\`')
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Legacy production-detail uniqueness: autoconer_production_detail
SET @legacy_index = (
  SELECT grouped_indexes.index_name
  FROM (
    SELECT index_name,
           GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS indexed_columns
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'autoconer_production_detail'
      AND non_unique = 0
      AND index_name <> 'PRIMARY'
    GROUP BY index_name
  ) AS grouped_indexes
  WHERE grouped_indexes.indexed_columns = 'header_id,machine_id'
  LIMIT 1
);
SET @ddl = IF(
  @legacy_index IS NULL,
  'SELECT 1',
  CONCAT('DROP INDEX \`', REPLACE(@legacy_index, '\`', '\`\`'), '\` ON \`autoconer_production_detail\`')
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Legacy setup uniqueness: breaker_drawing_machine_setup
SET @legacy_index = (
  SELECT grouped_indexes.index_name
  FROM (
    SELECT index_name,
           GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS indexed_columns
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'breaker_drawing_machine_setup'
      AND non_unique = 0
      AND index_name <> 'PRIMARY'
    GROUP BY index_name
  ) AS grouped_indexes
  WHERE grouped_indexes.indexed_columns = 'machine_id,entry_date,shift'
  LIMIT 1
);
SET @ddl = IF(
  @legacy_index IS NULL,
  'SELECT 1',
  CONCAT('DROP INDEX \`', REPLACE(@legacy_index, '\`', '\`\`'), '\` ON \`breaker_drawing_machine_setup\`')
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Legacy production-detail uniqueness: breaker_drawing_production_detail
SET @legacy_index = (
  SELECT grouped_indexes.index_name
  FROM (
    SELECT index_name,
           GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS indexed_columns
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'breaker_drawing_production_detail'
      AND non_unique = 0
      AND index_name <> 'PRIMARY'
    GROUP BY index_name
  ) AS grouped_indexes
  WHERE grouped_indexes.indexed_columns = 'header_id,machine_id'
  LIMIT 1
);
SET @ddl = IF(
  @legacy_index IS NULL,
  'SELECT 1',
  CONCAT('DROP INDEX \`', REPLACE(@legacy_index, '\`', '\`\`'), '\` ON \`breaker_drawing_production_detail\`')
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Legacy setup uniqueness: carding_machine_setup
SET @legacy_index = (
  SELECT grouped_indexes.index_name
  FROM (
    SELECT index_name,
           GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS indexed_columns
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'carding_machine_setup'
      AND non_unique = 0
      AND index_name <> 'PRIMARY'
    GROUP BY index_name
  ) AS grouped_indexes
  WHERE grouped_indexes.indexed_columns = 'machine_id,entry_date,shift'
  LIMIT 1
);
SET @ddl = IF(
  @legacy_index IS NULL,
  'SELECT 1',
  CONCAT('DROP INDEX \`', REPLACE(@legacy_index, '\`', '\`\`'), '\` ON \`carding_machine_setup\`')
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Legacy production-detail uniqueness: carding_production_detail
SET @legacy_index = (
  SELECT grouped_indexes.index_name
  FROM (
    SELECT index_name,
           GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS indexed_columns
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'carding_production_detail'
      AND non_unique = 0
      AND index_name <> 'PRIMARY'
    GROUP BY index_name
  ) AS grouped_indexes
  WHERE grouped_indexes.indexed_columns = 'header_id,machine_id'
  LIMIT 1
);
SET @ddl = IF(
  @legacy_index IS NULL,
  'SELECT 1',
  CONCAT('DROP INDEX \`', REPLACE(@legacy_index, '\`', '\`\`'), '\` ON \`carding_production_detail\`')
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Legacy setup uniqueness: comber_machine_setup
SET @legacy_index = (
  SELECT grouped_indexes.index_name
  FROM (
    SELECT index_name,
           GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS indexed_columns
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'comber_machine_setup'
      AND non_unique = 0
      AND index_name <> 'PRIMARY'
    GROUP BY index_name
  ) AS grouped_indexes
  WHERE grouped_indexes.indexed_columns = 'machine_id,entry_date,shift'
  LIMIT 1
);
SET @ddl = IF(
  @legacy_index IS NULL,
  'SELECT 1',
  CONCAT('DROP INDEX \`', REPLACE(@legacy_index, '\`', '\`\`'), '\` ON \`comber_machine_setup\`')
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Legacy production-detail uniqueness: comber_production_detail
SET @legacy_index = (
  SELECT grouped_indexes.index_name
  FROM (
    SELECT index_name,
           GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS indexed_columns
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'comber_production_detail'
      AND non_unique = 0
      AND index_name <> 'PRIMARY'
    GROUP BY index_name
  ) AS grouped_indexes
  WHERE grouped_indexes.indexed_columns = 'header_id,machine_id'
  LIMIT 1
);
SET @ddl = IF(
  @legacy_index IS NULL,
  'SELECT 1',
  CONCAT('DROP INDEX \`', REPLACE(@legacy_index, '\`', '\`\`'), '\` ON \`comber_production_detail\`')
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Legacy setup uniqueness: finisher_drawing_machine_setup
SET @legacy_index = (
  SELECT grouped_indexes.index_name
  FROM (
    SELECT index_name,
           GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS indexed_columns
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'finisher_drawing_machine_setup'
      AND non_unique = 0
      AND index_name <> 'PRIMARY'
    GROUP BY index_name
  ) AS grouped_indexes
  WHERE grouped_indexes.indexed_columns = 'machine_id,entry_date,shift'
  LIMIT 1
);
SET @ddl = IF(
  @legacy_index IS NULL,
  'SELECT 1',
  CONCAT('DROP INDEX \`', REPLACE(@legacy_index, '\`', '\`\`'), '\` ON \`finisher_drawing_machine_setup\`')
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Legacy production-detail uniqueness: finisher_drawing_production_detail
SET @legacy_index = (
  SELECT grouped_indexes.index_name
  FROM (
    SELECT index_name,
           GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS indexed_columns
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'finisher_drawing_production_detail'
      AND non_unique = 0
      AND index_name <> 'PRIMARY'
    GROUP BY index_name
  ) AS grouped_indexes
  WHERE grouped_indexes.indexed_columns = 'header_id,machine_id'
  LIMIT 1
);
SET @ddl = IF(
  @legacy_index IS NULL,
  'SELECT 1',
  CONCAT('DROP INDEX \`', REPLACE(@legacy_index, '\`', '\`\`'), '\` ON \`finisher_drawing_production_detail\`')
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Legacy setup uniqueness: lap_former_machine_setup
SET @legacy_index = (
  SELECT grouped_indexes.index_name
  FROM (
    SELECT index_name,
           GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS indexed_columns
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'lap_former_machine_setup'
      AND non_unique = 0
      AND index_name <> 'PRIMARY'
    GROUP BY index_name
  ) AS grouped_indexes
  WHERE grouped_indexes.indexed_columns = 'machine_id,entry_date,shift'
  LIMIT 1
);
SET @ddl = IF(
  @legacy_index IS NULL,
  'SELECT 1',
  CONCAT('DROP INDEX \`', REPLACE(@legacy_index, '\`', '\`\`'), '\` ON \`lap_former_machine_setup\`')
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Legacy production-detail uniqueness: lap_former_production_detail
SET @legacy_index = (
  SELECT grouped_indexes.index_name
  FROM (
    SELECT index_name,
           GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS indexed_columns
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'lap_former_production_detail'
      AND non_unique = 0
      AND index_name <> 'PRIMARY'
    GROUP BY index_name
  ) AS grouped_indexes
  WHERE grouped_indexes.indexed_columns = 'header_id,machine_id'
  LIMIT 1
);
SET @ddl = IF(
  @legacy_index IS NULL,
  'SELECT 1',
  CONCAT('DROP INDEX \`', REPLACE(@legacy_index, '\`', '\`\`'), '\` ON \`lap_former_production_detail\`')
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Legacy setup uniqueness: simplex_machine_setup
SET @legacy_index = (
  SELECT grouped_indexes.index_name
  FROM (
    SELECT index_name,
           GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS indexed_columns
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'simplex_machine_setup'
      AND non_unique = 0
      AND index_name <> 'PRIMARY'
    GROUP BY index_name
  ) AS grouped_indexes
  WHERE grouped_indexes.indexed_columns = 'machine_id,entry_date,shift'
  LIMIT 1
);
SET @ddl = IF(
  @legacy_index IS NULL,
  'SELECT 1',
  CONCAT('DROP INDEX \`', REPLACE(@legacy_index, '\`', '\`\`'), '\` ON \`simplex_machine_setup\`')
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Legacy production-detail uniqueness: simplex_production_detail
SET @legacy_index = (
  SELECT grouped_indexes.index_name
  FROM (
    SELECT index_name,
           GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS indexed_columns
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'simplex_production_detail'
      AND non_unique = 0
      AND index_name <> 'PRIMARY'
    GROUP BY index_name
  ) AS grouped_indexes
  WHERE grouped_indexes.indexed_columns = 'header_id,machine_id'
  LIMIT 1
);
SET @ddl = IF(
  @legacy_index IS NULL,
  'SELECT 1',
  CONCAT('DROP INDEX \`', REPLACE(@legacy_index, '\`', '\`\`'), '\` ON \`simplex_production_detail\`')
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Legacy setup uniqueness: spinning_machine_setup
SET @legacy_index = (
  SELECT grouped_indexes.index_name
  FROM (
    SELECT index_name,
           GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS indexed_columns
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'spinning_machine_setup'
      AND non_unique = 0
      AND index_name <> 'PRIMARY'
    GROUP BY index_name
  ) AS grouped_indexes
  WHERE grouped_indexes.indexed_columns = 'machine_id,entry_date,shift'
  LIMIT 1
);
SET @ddl = IF(
  @legacy_index IS NULL,
  'SELECT 1',
  CONCAT('DROP INDEX \`', REPLACE(@legacy_index, '\`', '\`\`'), '\` ON \`spinning_machine_setup\`')
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Legacy production-detail uniqueness: spinning_production_detail
SET @legacy_index = (
  SELECT grouped_indexes.index_name
  FROM (
    SELECT index_name,
           GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS indexed_columns
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'spinning_production_detail'
      AND non_unique = 0
      AND index_name <> 'PRIMARY'
    GROUP BY index_name
  ) AS grouped_indexes
  WHERE grouped_indexes.indexed_columns = 'header_id,machine_id'
  LIMIT 1
);
SET @ddl = IF(
  @legacy_index IS NULL,
  'SELECT 1',
  CONCAT('DROP INDEX \`', REPLACE(@legacy_index, '\`', '\`\`'), '\` ON \`spinning_production_detail\`')
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


