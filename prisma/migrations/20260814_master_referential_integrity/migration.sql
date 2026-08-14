-- Enforce the parent/child relationships used by the Master and production
-- modules. The guarded cleanup script must report zero orphans before this
-- migration is deployed.

-- This legacy column used a different collation from departments.id. Foreign
-- key character columns must have matching character set and collation.
ALTER TABLE `hok_strength_detail`
  MODIFY `department_id` CHAR(36)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;

ALTER TABLE `autoconer_machine_setup`
  ADD CONSTRAINT `fk_ac_setup_machine`
    FOREIGN KEY (`machine_id`) REFERENCES `autoconer_machines` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ac_setup_count`
    FOREIGN KEY (`count_id`) REFERENCES `spinning_counts` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `autoconer_production_detail`
  ADD CONSTRAINT `fk_ac_detail_header`
    FOREIGN KEY (`header_id`) REFERENCES `autoconer_production_header` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ac_detail_machine`
    FOREIGN KEY (`machine_id`) REFERENCES `autoconer_machines` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ac_detail_count`
    FOREIGN KEY (`count_id`) REFERENCES `spinning_counts` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `autoconer_production_header`
  ADD CONSTRAINT `fk_ac_header_supervisor`
    FOREIGN KEY (`supervisor_id`) REFERENCES `supervisors` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `autoconer_stoppage_entry`
  ADD CONSTRAINT `fk_ac_stop_detail`
    FOREIGN KEY (`production_detail_id`) REFERENCES `autoconer_production_detail` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ac_stop_code1`
    FOREIGN KEY (`stoppage1_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ac_stop_code2`
    FOREIGN KEY (`stoppage2_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ac_stop_code3`
    FOREIGN KEY (`stoppage3_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ac_stop_code4`
    FOREIGN KEY (`stoppage4_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `carding_machine_setup`
  ADD CONSTRAINT `fk_card_setup_machine`
    FOREIGN KEY (`machine_id`) REFERENCES `carding_machines` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `carding_production_detail`
  ADD CONSTRAINT `fk_card_detail_header`
    FOREIGN KEY (`header_id`) REFERENCES `carding_production_header` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_card_detail_machine`
    FOREIGN KEY (`machine_id`) REFERENCES `carding_machines` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `carding_production_header`
  ADD CONSTRAINT `fk_card_header_supervisor`
    FOREIGN KEY (`supervisor_id`) REFERENCES `supervisors` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_card_header_maisitry`
    FOREIGN KEY (`maisitry_id`) REFERENCES `supervisors` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `carding_stoppage_entry`
  ADD CONSTRAINT `fk_card_stop_detail`
    FOREIGN KEY (`production_detail_id`) REFERENCES `carding_production_detail` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_card_stop_code1`
    FOREIGN KEY (`stoppage1_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_card_stop_code2`
    FOREIGN KEY (`stoppage2_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_card_stop_code3`
    FOREIGN KEY (`stoppage3_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_card_stop_code4`
    FOREIGN KEY (`stoppage4_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `breaker_drawing_machine_setup`
  ADD CONSTRAINT `fk_breaker_setup_machine`
    FOREIGN KEY (`machine_id`) REFERENCES `drawing_breaker_machines` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `breaker_drawing_production_detail`
  ADD CONSTRAINT `fk_breaker_detail_header`
    FOREIGN KEY (`header_id`) REFERENCES `breaker_drawing_production_header` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_breaker_detail_machine`
    FOREIGN KEY (`machine_id`) REFERENCES `drawing_breaker_machines` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `breaker_drawing_production_header`
  ADD CONSTRAINT `fk_breaker_header_supervisor`
    FOREIGN KEY (`supervisor_id`) REFERENCES `supervisors` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_breaker_header_maisitry`
    FOREIGN KEY (`maisitry_id`) REFERENCES `supervisors` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `breaker_drawing_stoppage_entry`
  ADD CONSTRAINT `fk_breaker_stop_detail`
    FOREIGN KEY (`production_detail_id`) REFERENCES `breaker_drawing_production_detail` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_breaker_stop_code1`
    FOREIGN KEY (`stoppage1_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_breaker_stop_code2`
    FOREIGN KEY (`stoppage2_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_breaker_stop_code3`
    FOREIGN KEY (`stoppage3_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_breaker_stop_code4`
    FOREIGN KEY (`stoppage4_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `comber_machine_setup`
  ADD CONSTRAINT `fk_comber_setup_machine`
    FOREIGN KEY (`machine_id`) REFERENCES `comber_machines` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `comber_production_detail`
  ADD CONSTRAINT `fk_comber_detail_header`
    FOREIGN KEY (`header_id`) REFERENCES `comber_production_header` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_comber_detail_machine`
    FOREIGN KEY (`machine_id`) REFERENCES `comber_machines` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `comber_production_header`
  ADD CONSTRAINT `fk_comber_header_supervisor`
    FOREIGN KEY (`supervisor_id`) REFERENCES `supervisors` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_comber_header_maisitry`
    FOREIGN KEY (`maisitry_id`) REFERENCES `supervisors` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `comber_stoppage_entry`
  ADD CONSTRAINT `fk_comber_stop_detail`
    FOREIGN KEY (`production_detail_id`) REFERENCES `comber_production_detail` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_comber_stop_code1`
    FOREIGN KEY (`stoppage1_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_comber_stop_code2`
    FOREIGN KEY (`stoppage2_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_comber_stop_code3`
    FOREIGN KEY (`stoppage3_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_comber_stop_code4`
    FOREIGN KEY (`stoppage4_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `finisher_drawing_machine_setup`
  ADD CONSTRAINT `fk_finisher_setup_machine`
    FOREIGN KEY (`machine_id`) REFERENCES `drawing_finisher_machines` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `finisher_drawing_production_detail`
  ADD CONSTRAINT `fk_finisher_detail_header`
    FOREIGN KEY (`header_id`) REFERENCES `finisher_drawing_production_header` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_finisher_detail_machine`
    FOREIGN KEY (`machine_id`) REFERENCES `drawing_finisher_machines` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `finisher_drawing_production_header`
  ADD CONSTRAINT `fk_finisher_header_supervisor`
    FOREIGN KEY (`supervisor_id`) REFERENCES `supervisors` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_finisher_header_maisitry`
    FOREIGN KEY (`maisitry_id`) REFERENCES `supervisors` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `finisher_drawing_stoppage_entry`
  ADD CONSTRAINT `fk_finisher_stop_detail`
    FOREIGN KEY (`production_detail_id`) REFERENCES `finisher_drawing_production_detail` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_finisher_stop_code1`
    FOREIGN KEY (`stoppage1_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_finisher_stop_code2`
    FOREIGN KEY (`stoppage2_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_finisher_stop_code3`
    FOREIGN KEY (`stoppage3_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_finisher_stop_code4`
    FOREIGN KEY (`stoppage4_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `lap_former_machine_setup`
  ADD CONSTRAINT `fk_lap_setup_machine`
    FOREIGN KEY (`machine_id`) REFERENCES `lap_former_machines` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `lap_former_production_detail`
  ADD CONSTRAINT `fk_lap_detail_header`
    FOREIGN KEY (`header_id`) REFERENCES `lap_former_production_header` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_lap_detail_machine`
    FOREIGN KEY (`machine_id`) REFERENCES `lap_former_machines` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `lap_former_production_header`
  ADD CONSTRAINT `fk_lap_header_supervisor`
    FOREIGN KEY (`supervisor_id`) REFERENCES `supervisors` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_lap_header_maisitry`
    FOREIGN KEY (`maisitry_id`) REFERENCES `supervisors` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `lap_former_stoppage_entry`
  ADD CONSTRAINT `fk_lap_stop_detail`
    FOREIGN KEY (`production_detail_id`) REFERENCES `lap_former_production_detail` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_lap_stop_code1`
    FOREIGN KEY (`stoppage1_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_lap_stop_code2`
    FOREIGN KEY (`stoppage2_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_lap_stop_code3`
    FOREIGN KEY (`stoppage3_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_lap_stop_code4`
    FOREIGN KEY (`stoppage4_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `simplex_machine_setup`
  ADD CONSTRAINT `fk_simplex_setup_machine`
    FOREIGN KEY (`machine_id`) REFERENCES `simplex_machines` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `simplex_production_detail`
  ADD CONSTRAINT `fk_simplex_detail_header`
    FOREIGN KEY (`header_id`) REFERENCES `simplex_production_header` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_simplex_detail_machine`
    FOREIGN KEY (`machine_id`) REFERENCES `simplex_machines` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `simplex_production_header`
  ADD CONSTRAINT `fk_simplex_header_supervisor`
    FOREIGN KEY (`supervisor_id`) REFERENCES `supervisors` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_simplex_header_maisitry`
    FOREIGN KEY (`maisitry_id`) REFERENCES `supervisors` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `simplex_stoppage_entry`
  ADD CONSTRAINT `fk_simplex_stop_detail`
    FOREIGN KEY (`production_detail_id`) REFERENCES `simplex_production_detail` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_simplex_stop_code1`
    FOREIGN KEY (`stoppage1_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_simplex_stop_code2`
    FOREIGN KEY (`stoppage2_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_simplex_stop_code3`
    FOREIGN KEY (`stoppage3_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_simplex_stop_code4`
    FOREIGN KEY (`stoppage4_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `spinning_machine_setup`
  ADD CONSTRAINT `fk_spinning_setup_machine`
    FOREIGN KEY (`machine_id`) REFERENCES `spinning_machines` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `spinning_production_detail`
  ADD CONSTRAINT `fk_spinning_detail_header`
    FOREIGN KEY (`header_id`) REFERENCES `spinning_production_header` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_spinning_detail_machine`
    FOREIGN KEY (`machine_id`) REFERENCES `spinning_machines` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `spinning_production_header`
  ADD CONSTRAINT `fk_spinning_header_supervisor`
    FOREIGN KEY (`supervisor_id`) REFERENCES `supervisors` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_spinning_header_maisitry`
    FOREIGN KEY (`maisitry_id`) REFERENCES `supervisors` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `spinning_stoppage_entry`
  ADD CONSTRAINT `fk_spinning_stop_detail`
    FOREIGN KEY (`production_detail_id`) REFERENCES `spinning_production_detail` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_spinning_stop_code1`
    FOREIGN KEY (`stoppage1_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_spinning_stop_code2`
    FOREIGN KEY (`stoppage2_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_spinning_stop_code3`
    FOREIGN KEY (`stoppage3_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_spinning_stop_code4`
    FOREIGN KEY (`stoppage4_id`) REFERENCES `stoppage_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `supervisors`
  ADD CONSTRAINT `fk_supervisor_department`
    FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `stoppage_details`
  ADD CONSTRAINT `fk_stoppage_detail_head`
    FOREIGN KEY (`stoppage_head_id`) REFERENCES `stoppage_heads` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_stoppage_detail_department`
    FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `hok_strength_detail`
  ADD CONSTRAINT `fk_hok_detail_head`
    FOREIGN KEY (`hok_id`) REFERENCES `hok_strength_head` (`hok_id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_hok_detail_department`
    FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `tpi_entries`
  ADD CONSTRAINT `fk_tpi_count`
    FOREIGN KEY (`spinning_count_id`) REFERENCES `spinning_counts` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `twc_entries`
  ADD CONSTRAINT `fk_twc_count`
    FOREIGN KEY (`spinning_count_id`) REFERENCES `spinning_counts` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
