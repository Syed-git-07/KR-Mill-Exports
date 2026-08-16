-- Entry snapshots must be isolated by date and shift.  This migration:
--   1. records whether a dated setup is included in that one entry,
--   2. repairs legacy details that have no stoppage row, and
--   3. makes entry/detail/stoppage initialization idempotent at the database level.

-- Some existing installations received these columns through an earlier schema
-- synchronization. Add each one only when it is genuinely missing so a failed
-- migration can be safely replayed without discarding data.
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'autoconer_machine_setup' AND column_name = 'is_included') = 0, 'ALTER TABLE autoconer_machine_setup ADD COLUMN is_included BOOLEAN NOT NULL DEFAULT TRUE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'breaker_drawing_machine_setup' AND column_name = 'is_included') = 0, 'ALTER TABLE breaker_drawing_machine_setup ADD COLUMN is_included BOOLEAN NOT NULL DEFAULT TRUE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'carding_machine_setup' AND column_name = 'is_included') = 0, 'ALTER TABLE carding_machine_setup ADD COLUMN is_included BOOLEAN NOT NULL DEFAULT TRUE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'comber_machine_setup' AND column_name = 'is_included') = 0, 'ALTER TABLE comber_machine_setup ADD COLUMN is_included BOOLEAN NOT NULL DEFAULT TRUE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'finisher_drawing_machine_setup' AND column_name = 'is_included') = 0, 'ALTER TABLE finisher_drawing_machine_setup ADD COLUMN is_included BOOLEAN NOT NULL DEFAULT TRUE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'lap_former_machine_setup' AND column_name = 'is_included') = 0, 'ALTER TABLE lap_former_machine_setup ADD COLUMN is_included BOOLEAN NOT NULL DEFAULT TRUE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'simplex_machine_setup' AND column_name = 'is_included') = 0, 'ALTER TABLE simplex_machine_setup ADD COLUMN is_included BOOLEAN NOT NULL DEFAULT TRUE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'spinning_machine_setup' AND column_name = 'is_included') = 0, 'ALTER TABLE spinning_machine_setup ADD COLUMN is_included BOOLEAN NOT NULL DEFAULT TRUE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT INTO autoconer_stoppage_entry (id, production_detail_id)
SELECT UUID(), detail.id
FROM autoconer_production_detail detail
LEFT JOIN autoconer_stoppage_entry stop ON stop.production_detail_id = detail.id
WHERE stop.id IS NULL;

INSERT INTO breaker_drawing_stoppage_entry (id, production_detail_id)
SELECT UUID(), detail.id
FROM breaker_drawing_production_detail detail
LEFT JOIN breaker_drawing_stoppage_entry stop ON stop.production_detail_id = detail.id
WHERE stop.id IS NULL;

INSERT INTO carding_stoppage_entry (id, production_detail_id)
SELECT UUID(), detail.id
FROM carding_production_detail detail
LEFT JOIN carding_stoppage_entry stop ON stop.production_detail_id = detail.id
WHERE stop.id IS NULL;

INSERT INTO comber_stoppage_entry (id, production_detail_id)
SELECT UUID(), detail.id
FROM comber_production_detail detail
LEFT JOIN comber_stoppage_entry stop ON stop.production_detail_id = detail.id
WHERE stop.id IS NULL;

INSERT INTO finisher_drawing_stoppage_entry (id, production_detail_id)
SELECT UUID(), detail.id
FROM finisher_drawing_production_detail detail
LEFT JOIN finisher_drawing_stoppage_entry stop ON stop.production_detail_id = detail.id
WHERE stop.id IS NULL;

INSERT INTO lap_former_stoppage_entry (id, production_detail_id)
SELECT UUID(), detail.id
FROM lap_former_production_detail detail
LEFT JOIN lap_former_stoppage_entry stop ON stop.production_detail_id = detail.id
WHERE stop.id IS NULL;

INSERT INTO simplex_stoppage_entry (id, production_detail_id)
SELECT UUID(), detail.id
FROM simplex_production_detail detail
LEFT JOIN simplex_stoppage_entry stop ON stop.production_detail_id = detail.id
WHERE stop.id IS NULL;

INSERT INTO spinning_stoppage_entry (id, production_detail_id, run_time)
SELECT UUID(), detail.id, COALESCE(detail.run_time, header.total_time, 510)
FROM spinning_production_detail detail
JOIN spinning_production_header header ON header.id = detail.header_id
LEFT JOIN spinning_stoppage_entry stop ON stop.production_detail_id = detail.id
WHERE stop.id IS NULL;

ALTER TABLE autoconer_production_header ADD UNIQUE KEY uq_autoconer_header_date_shift (entry_date, shift);
ALTER TABLE breaker_drawing_production_header ADD UNIQUE KEY uq_breaker_header_date_shift (entry_date, shift);
ALTER TABLE carding_production_header ADD UNIQUE KEY uq_carding_header_date_shift (entry_date, shift);
ALTER TABLE comber_production_header ADD UNIQUE KEY uq_comber_header_date_shift (entry_date, shift);
ALTER TABLE finisher_drawing_production_header ADD UNIQUE KEY uq_finisher_header_date_shift (entry_date, shift);
ALTER TABLE lap_former_production_header ADD UNIQUE KEY uq_lap_header_date_shift (entry_date, shift);
ALTER TABLE simplex_production_header ADD UNIQUE KEY uq_simplex_header_date_shift (entry_date, shift);
ALTER TABLE spinning_production_header ADD UNIQUE KEY uq_spinning_header_date_shift (entry_date, shift);

ALTER TABLE autoconer_production_detail ADD UNIQUE KEY uq_autoconer_detail_header_machine (header_id, machine_id);
ALTER TABLE breaker_drawing_production_detail ADD UNIQUE KEY uq_breaker_detail_header_machine (header_id, machine_id);
ALTER TABLE carding_production_detail ADD UNIQUE KEY uq_carding_detail_header_machine (header_id, machine_id);
ALTER TABLE comber_production_detail ADD UNIQUE KEY uq_comber_detail_header_machine (header_id, machine_id);
ALTER TABLE finisher_drawing_production_detail ADD UNIQUE KEY uq_finisher_detail_header_machine (header_id, machine_id);
ALTER TABLE lap_former_production_detail ADD UNIQUE KEY uq_lap_detail_header_machine (header_id, machine_id);
ALTER TABLE simplex_production_detail ADD UNIQUE KEY uq_simplex_detail_header_machine (header_id, machine_id);
ALTER TABLE spinning_production_detail ADD UNIQUE KEY uq_spinning_detail_header_machine (header_id, machine_id);

ALTER TABLE autoconer_stoppage_entry ADD UNIQUE KEY uq_autoconer_stop_detail (production_detail_id);
ALTER TABLE breaker_drawing_stoppage_entry ADD UNIQUE KEY uq_breaker_stop_detail (production_detail_id);
ALTER TABLE carding_stoppage_entry ADD UNIQUE KEY uq_carding_stop_detail (production_detail_id);
ALTER TABLE comber_stoppage_entry ADD UNIQUE KEY uq_comber_stop_detail (production_detail_id);
ALTER TABLE finisher_drawing_stoppage_entry ADD UNIQUE KEY uq_finisher_stop_detail (production_detail_id);
ALTER TABLE lap_former_stoppage_entry ADD UNIQUE KEY uq_lap_stop_detail (production_detail_id);
ALTER TABLE simplex_stoppage_entry ADD UNIQUE KEY uq_simplex_stop_detail (production_detail_id);
ALTER TABLE spinning_stoppage_entry ADD UNIQUE KEY uq_spinning_stop_detail (production_detail_id);
