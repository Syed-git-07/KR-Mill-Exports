--
-- PostgreSQL database dump
--

\restrict bqHCrOIKoX6ZcNDk0t9ZgHB6VtgzitOceXNutw8XVDzKmbeXo87nZiJ9KM7joXu

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP POLICY IF EXISTS "Enable update for all users" ON public.twc_entries;
DROP POLICY IF EXISTS "Enable update for all users" ON public.tpi_entries;
DROP POLICY IF EXISTS "Enable update for all users" ON public.supervisors;
DROP POLICY IF EXISTS "Enable update for all users" ON public.stoppage_heads;
DROP POLICY IF EXISTS "Enable update for all users" ON public.stoppage_details;
DROP POLICY IF EXISTS "Enable update for all users" ON public.spinning_machines;
DROP POLICY IF EXISTS "Enable update for all users" ON public.spinning_counts;
DROP POLICY IF EXISTS "Enable update for all users" ON public.simplex_machines;
DROP POLICY IF EXISTS "Enable update for all users" ON public.lap_former_stoppage_entry;
DROP POLICY IF EXISTS "Enable update for all users" ON public.lap_former_production_header;
DROP POLICY IF EXISTS "Enable update for all users" ON public.lap_former_production_detail;
DROP POLICY IF EXISTS "Enable update for all users" ON public.lap_former_machines;
DROP POLICY IF EXISTS "Enable update for all users" ON public.lap_former_machine_setup;
DROP POLICY IF EXISTS "Enable update for all users" ON public.hok_strength_head;
DROP POLICY IF EXISTS "Enable update for all users" ON public.hok_strength_detail;
DROP POLICY IF EXISTS "Enable update for all users" ON public.drawing_finisher_machines;
DROP POLICY IF EXISTS "Enable update for all users" ON public.drawing_breaker_machines;
DROP POLICY IF EXISTS "Enable update for all users" ON public.comber_machines;
DROP POLICY IF EXISTS "Enable update for all users" ON public.carding_stoppage_entry;
DROP POLICY IF EXISTS "Enable update for all users" ON public.carding_production_header;
DROP POLICY IF EXISTS "Enable update for all users" ON public.carding_production_detail;
DROP POLICY IF EXISTS "Enable update for all users" ON public.carding_machines;
DROP POLICY IF EXISTS "Enable update for all users" ON public.carding_machine_setup;
DROP POLICY IF EXISTS "Enable update for all users" ON public.breaker_drawing_stoppage_entry;
DROP POLICY IF EXISTS "Enable update for all users" ON public.breaker_drawing_production_header;
DROP POLICY IF EXISTS "Enable update for all users" ON public.breaker_drawing_production_detail;
DROP POLICY IF EXISTS "Enable update for all users" ON public.breaker_drawing_machine_setup;
DROP POLICY IF EXISTS "Enable update for all users" ON public.autoconer_machines;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.twc_entries;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.tpi_entries;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.supervisors;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.stoppage_heads;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.stoppage_details;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.spinning_machines;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.spinning_counts;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.simplex_machines;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.lap_former_stoppage_entry;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.lap_former_production_header;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.lap_former_production_detail;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.lap_former_machines;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.lap_former_machine_setup;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.hok_strength_head;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.hok_strength_detail;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.drawing_finisher_machines;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.drawing_breaker_machines;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.departments;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.comber_machines;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.carding_stoppage_entry;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.carding_production_header;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.carding_production_detail;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.carding_machines;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.carding_machine_setup;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.breaker_drawing_stoppage_entry;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.breaker_drawing_production_header;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.breaker_drawing_production_detail;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.breaker_drawing_machine_setup;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.autoconer_machines;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.twc_entries;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.tpi_entries;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.supervisors;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.stoppage_heads;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.stoppage_details;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.spinning_machines;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.spinning_counts;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.simplex_machines;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.lap_former_stoppage_entry;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.lap_former_production_header;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.lap_former_production_detail;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.lap_former_machines;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.lap_former_machine_setup;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.hok_strength_head;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.hok_strength_detail;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.drawing_finisher_machines;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.drawing_breaker_machines;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.comber_machines;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.carding_stoppage_entry;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.carding_production_header;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.carding_production_detail;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.carding_machines;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.carding_machine_setup;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.breaker_drawing_stoppage_entry;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.breaker_drawing_production_header;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.breaker_drawing_production_detail;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.breaker_drawing_machine_setup;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.autoconer_machines;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.twc_entries;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.tpi_entries;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.supervisors;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.stoppage_heads;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.stoppage_details;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.spinning_machines;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.spinning_counts;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.simplex_machines;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.lap_former_stoppage_entry;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.lap_former_production_header;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.lap_former_production_detail;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.lap_former_machines;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.lap_former_machine_setup;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.hok_strength_head;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.hok_strength_detail;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.drawing_finisher_machines;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.drawing_breaker_machines;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.comber_machines;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.carding_stoppage_entry;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.carding_production_header;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.carding_production_detail;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.carding_machines;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.carding_machine_setup;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.breaker_drawing_stoppage_entry;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.breaker_drawing_production_header;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.breaker_drawing_production_detail;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.breaker_drawing_machine_setup;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.autoconer_machines;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.spinning_counts;
ALTER TABLE IF EXISTS ONLY public.twc_entries DROP CONSTRAINT IF EXISTS twc_entries_spinning_count_id_fkey;
ALTER TABLE IF EXISTS ONLY public.twc_entries DROP CONSTRAINT IF EXISTS twc_entries_machine_id_fkey;
ALTER TABLE IF EXISTS ONLY public.tpi_entries DROP CONSTRAINT IF EXISTS tpi_entries_spinning_count_id_fkey;
ALTER TABLE IF EXISTS ONLY public.tpi_entries DROP CONSTRAINT IF EXISTS tpi_entries_machine_id_fkey;
ALTER TABLE IF EXISTS ONLY public.supervisors DROP CONSTRAINT IF EXISTS supervisors_department_id_fkey;
ALTER TABLE IF EXISTS ONLY public.stoppage_details DROP CONSTRAINT IF EXISTS stoppage_details_stoppage_head_id_fkey;
ALTER TABLE IF EXISTS ONLY public.stoppage_details DROP CONSTRAINT IF EXISTS stoppage_details_department_id_fkey;
ALTER TABLE IF EXISTS ONLY public.lap_former_stoppage_entry DROP CONSTRAINT IF EXISTS lap_former_stoppage_entry_stoppage4_id_fkey;
ALTER TABLE IF EXISTS ONLY public.lap_former_stoppage_entry DROP CONSTRAINT IF EXISTS lap_former_stoppage_entry_stoppage3_id_fkey;
ALTER TABLE IF EXISTS ONLY public.lap_former_stoppage_entry DROP CONSTRAINT IF EXISTS lap_former_stoppage_entry_stoppage2_id_fkey;
ALTER TABLE IF EXISTS ONLY public.lap_former_stoppage_entry DROP CONSTRAINT IF EXISTS lap_former_stoppage_entry_stoppage1_id_fkey;
ALTER TABLE IF EXISTS ONLY public.lap_former_stoppage_entry DROP CONSTRAINT IF EXISTS lap_former_stoppage_entry_production_detail_id_fkey;
ALTER TABLE IF EXISTS ONLY public.lap_former_production_header DROP CONSTRAINT IF EXISTS lap_former_production_header_supervisor_id_fkey;
ALTER TABLE IF EXISTS ONLY public.lap_former_production_header DROP CONSTRAINT IF EXISTS lap_former_production_header_maisitry_id_fkey;
ALTER TABLE IF EXISTS ONLY public.lap_former_production_detail DROP CONSTRAINT IF EXISTS lap_former_production_detail_machine_id_fkey;
ALTER TABLE IF EXISTS ONLY public.lap_former_production_detail DROP CONSTRAINT IF EXISTS lap_former_production_detail_header_id_fkey;
ALTER TABLE IF EXISTS ONLY public.lap_former_machine_setup DROP CONSTRAINT IF EXISTS lap_former_machine_setup_machine_id_fkey;
ALTER TABLE IF EXISTS ONLY public.hok_strength_detail DROP CONSTRAINT IF EXISTS hok_strength_detail_hok_id_fkey;
ALTER TABLE IF EXISTS ONLY public.hok_strength_detail DROP CONSTRAINT IF EXISTS hok_strength_detail_department_id_fkey;
ALTER TABLE IF EXISTS ONLY public.carding_stoppage_entry DROP CONSTRAINT IF EXISTS carding_stoppage_entry_stoppage4_id_fkey;
ALTER TABLE IF EXISTS ONLY public.carding_stoppage_entry DROP CONSTRAINT IF EXISTS carding_stoppage_entry_stoppage3_id_fkey;
ALTER TABLE IF EXISTS ONLY public.carding_stoppage_entry DROP CONSTRAINT IF EXISTS carding_stoppage_entry_stoppage2_id_fkey;
ALTER TABLE IF EXISTS ONLY public.carding_stoppage_entry DROP CONSTRAINT IF EXISTS carding_stoppage_entry_stoppage1_id_fkey;
ALTER TABLE IF EXISTS ONLY public.carding_stoppage_entry DROP CONSTRAINT IF EXISTS carding_stoppage_entry_production_detail_id_fkey;
ALTER TABLE IF EXISTS ONLY public.carding_production_header DROP CONSTRAINT IF EXISTS carding_production_header_supervisor_id_fkey;
ALTER TABLE IF EXISTS ONLY public.carding_production_header DROP CONSTRAINT IF EXISTS carding_production_header_maisitry_id_fkey;
ALTER TABLE IF EXISTS ONLY public.carding_production_detail DROP CONSTRAINT IF EXISTS carding_production_detail_machine_id_fkey;
ALTER TABLE IF EXISTS ONLY public.carding_production_detail DROP CONSTRAINT IF EXISTS carding_production_detail_header_id_fkey;
ALTER TABLE IF EXISTS ONLY public.carding_machine_setup DROP CONSTRAINT IF EXISTS carding_machine_setup_machine_id_fkey;
ALTER TABLE IF EXISTS ONLY public.breaker_drawing_stoppage_entry DROP CONSTRAINT IF EXISTS breaker_drawing_stoppage_entry_stoppage4_id_fkey;
ALTER TABLE IF EXISTS ONLY public.breaker_drawing_stoppage_entry DROP CONSTRAINT IF EXISTS breaker_drawing_stoppage_entry_stoppage3_id_fkey;
ALTER TABLE IF EXISTS ONLY public.breaker_drawing_stoppage_entry DROP CONSTRAINT IF EXISTS breaker_drawing_stoppage_entry_stoppage2_id_fkey;
ALTER TABLE IF EXISTS ONLY public.breaker_drawing_stoppage_entry DROP CONSTRAINT IF EXISTS breaker_drawing_stoppage_entry_stoppage1_id_fkey;
ALTER TABLE IF EXISTS ONLY public.breaker_drawing_stoppage_entry DROP CONSTRAINT IF EXISTS breaker_drawing_stoppage_entry_production_detail_id_fkey;
ALTER TABLE IF EXISTS ONLY public.breaker_drawing_production_header DROP CONSTRAINT IF EXISTS breaker_drawing_production_header_supervisor_id_fkey;
ALTER TABLE IF EXISTS ONLY public.breaker_drawing_production_header DROP CONSTRAINT IF EXISTS breaker_drawing_production_header_maisitry_id_fkey;
ALTER TABLE IF EXISTS ONLY public.breaker_drawing_production_detail DROP CONSTRAINT IF EXISTS breaker_drawing_production_detail_machine_id_fkey;
ALTER TABLE IF EXISTS ONLY public.breaker_drawing_production_detail DROP CONSTRAINT IF EXISTS breaker_drawing_production_detail_header_id_fkey;
ALTER TABLE IF EXISTS ONLY public.breaker_drawing_machine_setup DROP CONSTRAINT IF EXISTS breaker_drawing_machine_setup_machine_id_fkey;
DROP TRIGGER IF EXISTS update_twc_entries_updated_at ON public.twc_entries;
DROP TRIGGER IF EXISTS update_tpi_entries_updated_at ON public.tpi_entries;
DROP TRIGGER IF EXISTS update_supervisors_updated_at ON public.supervisors;
DROP TRIGGER IF EXISTS update_stoppage_heads_updated_at ON public.stoppage_heads;
DROP TRIGGER IF EXISTS update_stoppage_details_updated_at ON public.stoppage_details;
DROP TRIGGER IF EXISTS update_spinning_machines_updated_at ON public.spinning_machines;
DROP TRIGGER IF EXISTS update_simplex_machines_updated_at ON public.simplex_machines;
DROP TRIGGER IF EXISTS update_lf_stoppage_updated_at ON public.lap_former_stoppage_entry;
DROP TRIGGER IF EXISTS update_lf_prod_header_updated_at ON public.lap_former_production_header;
DROP TRIGGER IF EXISTS update_lf_prod_detail_updated_at ON public.lap_former_production_detail;
DROP TRIGGER IF EXISTS update_lf_machine_setup_updated_at ON public.lap_former_machine_setup;
DROP TRIGGER IF EXISTS update_lap_former_machines_updated_at ON public.lap_former_machines;
DROP TRIGGER IF EXISTS update_hok_strength_head_updated_at ON public.hok_strength_head;
DROP TRIGGER IF EXISTS update_hok_strength_detail_updated_at ON public.hok_strength_detail;
DROP TRIGGER IF EXISTS update_drawing_finisher_machines_updated_at ON public.drawing_finisher_machines;
DROP TRIGGER IF EXISTS update_drawing_breaker_machines_updated_at ON public.drawing_breaker_machines;
DROP TRIGGER IF EXISTS update_departments_updated_at ON public.departments;
DROP TRIGGER IF EXISTS update_comber_machines_updated_at ON public.comber_machines;
DROP TRIGGER IF EXISTS update_carding_stoppage_updated_at ON public.carding_stoppage_entry;
DROP TRIGGER IF EXISTS update_carding_prod_header_updated_at ON public.carding_production_header;
DROP TRIGGER IF EXISTS update_carding_prod_detail_updated_at ON public.carding_production_detail;
DROP TRIGGER IF EXISTS update_carding_machines_updated_at ON public.carding_machines;
DROP TRIGGER IF EXISTS update_carding_machine_setup_updated_at ON public.carding_machine_setup;
DROP TRIGGER IF EXISTS update_bd_stoppage_updated_at ON public.breaker_drawing_stoppage_entry;
DROP TRIGGER IF EXISTS update_bd_prod_header_updated_at ON public.breaker_drawing_production_header;
DROP TRIGGER IF EXISTS update_bd_prod_detail_updated_at ON public.breaker_drawing_production_detail;
DROP TRIGGER IF EXISTS update_bd_machine_setup_updated_at ON public.breaker_drawing_machine_setup;
DROP TRIGGER IF EXISTS update_autoconer_machines_updated_at ON public.autoconer_machines;
DROP TRIGGER IF EXISTS sync_bd_speed_on_machine_update ON public.drawing_breaker_machines;
DROP INDEX IF EXISTS public.idx_twc_entries_spinning_count_id;
DROP INDEX IF EXISTS public.idx_twc_entries_entry_id;
DROP INDEX IF EXISTS public.idx_twc_entries_date;
DROP INDEX IF EXISTS public.idx_tpi_entries_spinning_count_id;
DROP INDEX IF EXISTS public.idx_tpi_entries_entry_id;
DROP INDEX IF EXISTS public.idx_tpi_entries_date;
DROP INDEX IF EXISTS public.idx_supervisors_name;
DROP INDEX IF EXISTS public.idx_supervisors_code;
DROP INDEX IF EXISTS public.idx_stoppage_heads_name;
DROP INDEX IF EXISTS public.idx_stoppage_heads_code;
DROP INDEX IF EXISTS public.idx_stoppage_details_stoppage_name;
DROP INDEX IF EXISTS public.idx_stoppage_details_stoppage_head_id;
DROP INDEX IF EXISTS public.idx_stoppage_details_department_id;
DROP INDEX IF EXISTS public.idx_stoppage_details_code;
DROP INDEX IF EXISTS public.idx_spinning_machines_mc_id;
DROP INDEX IF EXISTS public.idx_spinning_machines_machine_no;
DROP INDEX IF EXISTS public.idx_spinning_machines_group_no;
DROP INDEX IF EXISTS public.idx_spinning_machines_frame_no;
DROP INDEX IF EXISTS public.idx_spinning_counts_is_active;
DROP INDEX IF EXISTS public.idx_spinning_counts_count_name;
DROP INDEX IF EXISTS public.idx_simplex_machines_mc_id;
DROP INDEX IF EXISTS public.idx_simplex_machines_machine_no;
DROP INDEX IF EXISTS public.idx_simplex_machines_is_active;
DROP INDEX IF EXISTS public.idx_lf_stoppage_prod_detail;
DROP INDEX IF EXISTS public.idx_lf_prod_header_shift;
DROP INDEX IF EXISTS public.idx_lf_prod_header_entry_id;
DROP INDEX IF EXISTS public.idx_lf_prod_header_date_shift;
DROP INDEX IF EXISTS public.idx_lf_prod_header_date;
DROP INDEX IF EXISTS public.idx_lf_prod_detail_machine;
DROP INDEX IF EXISTS public.idx_lf_prod_detail_header;
DROP INDEX IF EXISTS public.idx_lap_former_machines_mc_id;
DROP INDEX IF EXISTS public.idx_lap_former_machines_machine_no;
DROP INDEX IF EXISTS public.idx_lap_former_machines_is_active;
DROP INDEX IF EXISTS public.idx_hok_strength_head_date;
DROP INDEX IF EXISTS public.idx_hok_strength_detail_hok_id;
DROP INDEX IF EXISTS public.idx_hok_strength_detail_dept_id;
DROP INDEX IF EXISTS public.idx_drawing_finisher_machines_mc_id;
DROP INDEX IF EXISTS public.idx_drawing_finisher_machines_machine_no;
DROP INDEX IF EXISTS public.idx_drawing_finisher_machines_is_active;
DROP INDEX IF EXISTS public.idx_drawing_breaker_machines_mc_id;
DROP INDEX IF EXISTS public.idx_drawing_breaker_machines_machine_no;
DROP INDEX IF EXISTS public.idx_drawing_breaker_machines_is_active;
DROP INDEX IF EXISTS public.idx_departments_sl_no;
DROP INDEX IF EXISTS public.idx_departments_is_active;
DROP INDEX IF EXISTS public.idx_departments_dept_name;
DROP INDEX IF EXISTS public.idx_departments_code;
DROP INDEX IF EXISTS public.idx_comber_machines_mc_id;
DROP INDEX IF EXISTS public.idx_comber_machines_machine_no;
DROP INDEX IF EXISTS public.idx_comber_machines_is_active;
DROP INDEX IF EXISTS public.idx_carding_stoppage_prod_detail;
DROP INDEX IF EXISTS public.idx_carding_prod_header_shift;
DROP INDEX IF EXISTS public.idx_carding_prod_header_entry_id;
DROP INDEX IF EXISTS public.idx_carding_prod_header_date;
DROP INDEX IF EXISTS public.idx_carding_prod_detail_machine;
DROP INDEX IF EXISTS public.idx_carding_prod_detail_header;
DROP INDEX IF EXISTS public.idx_carding_machines_model;
DROP INDEX IF EXISTS public.idx_carding_machines_mc_id;
DROP INDEX IF EXISTS public.idx_carding_machines_machine_no;
DROP INDEX IF EXISTS public.idx_carding_machines_is_active;
DROP INDEX IF EXISTS public.idx_bd_stoppage_prod_detail;
DROP INDEX IF EXISTS public.idx_bd_stoppage_detail_id;
DROP INDEX IF EXISTS public.idx_bd_prod_header_shift;
DROP INDEX IF EXISTS public.idx_bd_prod_header_entry_id;
DROP INDEX IF EXISTS public.idx_bd_prod_header_date;
DROP INDEX IF EXISTS public.idx_bd_prod_detail_machine;
DROP INDEX IF EXISTS public.idx_bd_prod_detail_header;
DROP INDEX IF EXISTS public.idx_bd_header_date_shift;
DROP INDEX IF EXISTS public.idx_bd_detail_header_id;
DROP INDEX IF EXISTS public.idx_autoconer_machines_mc_id;
DROP INDEX IF EXISTS public.idx_autoconer_machines_machine_no;
DROP INDEX IF EXISTS public.idx_autoconer_machines_is_active;
DROP INDEX IF EXISTS public.idx_autoconer_machines_group_id;
ALTER TABLE IF EXISTS ONLY public.twc_entries DROP CONSTRAINT IF EXISTS twc_entries_pkey;
ALTER TABLE IF EXISTS ONLY public.twc_entries DROP CONSTRAINT IF EXISTS twc_entries_entry_id_unique;
ALTER TABLE IF EXISTS ONLY public.tpi_entries DROP CONSTRAINT IF EXISTS tpi_entries_pkey;
ALTER TABLE IF EXISTS ONLY public.tpi_entries DROP CONSTRAINT IF EXISTS tpi_entries_entry_id_unique;
ALTER TABLE IF EXISTS ONLY public.supervisors DROP CONSTRAINT IF EXISTS supervisors_supervisor_name_key;
ALTER TABLE IF EXISTS ONLY public.supervisors DROP CONSTRAINT IF EXISTS supervisors_pkey;
ALTER TABLE IF EXISTS ONLY public.supervisors DROP CONSTRAINT IF EXISTS supervisors_code_unique;
ALTER TABLE IF EXISTS ONLY public.stoppage_heads DROP CONSTRAINT IF EXISTS stoppage_heads_stoppage_head_name_key;
ALTER TABLE IF EXISTS ONLY public.stoppage_heads DROP CONSTRAINT IF EXISTS stoppage_heads_pkey;
ALTER TABLE IF EXISTS ONLY public.stoppage_heads DROP CONSTRAINT IF EXISTS stoppage_heads_code_key;
ALTER TABLE IF EXISTS ONLY public.stoppage_details DROP CONSTRAINT IF EXISTS stoppage_details_stoppage_head_id_detail_code_key;
ALTER TABLE IF EXISTS ONLY public.stoppage_details DROP CONSTRAINT IF EXISTS stoppage_details_pkey;
ALTER TABLE IF EXISTS ONLY public.spinning_machines DROP CONSTRAINT IF EXISTS spinning_machines_pkey;
ALTER TABLE IF EXISTS ONLY public.spinning_machines DROP CONSTRAINT IF EXISTS spinning_machines_machine_no_key;
ALTER TABLE IF EXISTS ONLY public.spinning_counts DROP CONSTRAINT IF EXISTS spinning_counts_pkey;
ALTER TABLE IF EXISTS ONLY public.spinning_counts DROP CONSTRAINT IF EXISTS spinning_counts_count_name_key;
ALTER TABLE IF EXISTS ONLY public.simplex_machines DROP CONSTRAINT IF EXISTS simplex_machines_pkey;
ALTER TABLE IF EXISTS ONLY public.simplex_machines DROP CONSTRAINT IF EXISTS simplex_machines_machine_no_key;
ALTER TABLE IF EXISTS ONLY public.lap_former_stoppage_entry DROP CONSTRAINT IF EXISTS lap_former_stoppage_entry_production_detail_id_key;
ALTER TABLE IF EXISTS ONLY public.lap_former_stoppage_entry DROP CONSTRAINT IF EXISTS lap_former_stoppage_entry_pkey;
ALTER TABLE IF EXISTS ONLY public.lap_former_production_header DROP CONSTRAINT IF EXISTS lap_former_production_header_pkey;
ALTER TABLE IF EXISTS ONLY public.lap_former_production_header DROP CONSTRAINT IF EXISTS lap_former_production_header_entry_date_shift_key;
ALTER TABLE IF EXISTS ONLY public.lap_former_production_detail DROP CONSTRAINT IF EXISTS lap_former_production_detail_pkey;
ALTER TABLE IF EXISTS ONLY public.lap_former_production_detail DROP CONSTRAINT IF EXISTS lap_former_production_detail_header_id_machine_id_key;
ALTER TABLE IF EXISTS ONLY public.lap_former_machines DROP CONSTRAINT IF EXISTS lap_former_machines_pkey;
ALTER TABLE IF EXISTS ONLY public.lap_former_machines DROP CONSTRAINT IF EXISTS lap_former_machines_machine_no_key;
ALTER TABLE IF EXISTS ONLY public.lap_former_machine_setup DROP CONSTRAINT IF EXISTS lap_former_machine_setup_pkey;
ALTER TABLE IF EXISTS ONLY public.lap_former_machine_setup DROP CONSTRAINT IF EXISTS lap_former_machine_setup_machine_id_key;
ALTER TABLE IF EXISTS ONLY public.hok_strength_head DROP CONSTRAINT IF EXISTS hok_strength_head_pkey;
ALTER TABLE IF EXISTS ONLY public.hok_strength_head DROP CONSTRAINT IF EXISTS hok_strength_head_date_key;
ALTER TABLE IF EXISTS ONLY public.hok_strength_detail DROP CONSTRAINT IF EXISTS hok_strength_detail_pkey;
ALTER TABLE IF EXISTS ONLY public.hok_strength_detail DROP CONSTRAINT IF EXISTS hok_strength_detail_hok_id_department_id_key;
ALTER TABLE IF EXISTS ONLY public.drawing_finisher_machines DROP CONSTRAINT IF EXISTS drawing_finisher_machines_pkey;
ALTER TABLE IF EXISTS ONLY public.drawing_finisher_machines DROP CONSTRAINT IF EXISTS drawing_finisher_machines_machine_no_key;
ALTER TABLE IF EXISTS ONLY public.drawing_breaker_machines DROP CONSTRAINT IF EXISTS drawing_breaker_machines_pkey;
ALTER TABLE IF EXISTS ONLY public.drawing_breaker_machines DROP CONSTRAINT IF EXISTS drawing_breaker_machines_machine_no_key;
ALTER TABLE IF EXISTS ONLY public.departments DROP CONSTRAINT IF EXISTS departments_pkey;
ALTER TABLE IF EXISTS ONLY public.departments DROP CONSTRAINT IF EXISTS departments_dept_name_key;
ALTER TABLE IF EXISTS ONLY public.departments DROP CONSTRAINT IF EXISTS departments_code_unique;
ALTER TABLE IF EXISTS ONLY public.comber_machines DROP CONSTRAINT IF EXISTS comber_machines_pkey;
ALTER TABLE IF EXISTS ONLY public.comber_machines DROP CONSTRAINT IF EXISTS comber_machines_machine_no_key;
ALTER TABLE IF EXISTS ONLY public.carding_stoppage_entry DROP CONSTRAINT IF EXISTS carding_stoppage_entry_production_detail_id_key;
ALTER TABLE IF EXISTS ONLY public.carding_stoppage_entry DROP CONSTRAINT IF EXISTS carding_stoppage_entry_pkey;
ALTER TABLE IF EXISTS ONLY public.carding_production_header DROP CONSTRAINT IF EXISTS carding_production_header_pkey;
ALTER TABLE IF EXISTS ONLY public.carding_production_header DROP CONSTRAINT IF EXISTS carding_production_header_entry_date_shift_key;
ALTER TABLE IF EXISTS ONLY public.carding_production_detail DROP CONSTRAINT IF EXISTS carding_production_detail_pkey;
ALTER TABLE IF EXISTS ONLY public.carding_production_detail DROP CONSTRAINT IF EXISTS carding_production_detail_header_id_machine_id_key;
ALTER TABLE IF EXISTS ONLY public.carding_machines DROP CONSTRAINT IF EXISTS carding_machines_pkey;
ALTER TABLE IF EXISTS ONLY public.carding_machines DROP CONSTRAINT IF EXISTS carding_machines_machine_no_key;
ALTER TABLE IF EXISTS ONLY public.carding_machine_setup DROP CONSTRAINT IF EXISTS carding_machine_setup_pkey;
ALTER TABLE IF EXISTS ONLY public.carding_machine_setup DROP CONSTRAINT IF EXISTS carding_machine_setup_machine_id_key;
ALTER TABLE IF EXISTS ONLY public.breaker_drawing_stoppage_entry DROP CONSTRAINT IF EXISTS breaker_drawing_stoppage_entry_production_detail_id_key;
ALTER TABLE IF EXISTS ONLY public.breaker_drawing_stoppage_entry DROP CONSTRAINT IF EXISTS breaker_drawing_stoppage_entry_pkey;
ALTER TABLE IF EXISTS ONLY public.breaker_drawing_production_header DROP CONSTRAINT IF EXISTS breaker_drawing_production_header_pkey;
ALTER TABLE IF EXISTS ONLY public.breaker_drawing_production_header DROP CONSTRAINT IF EXISTS breaker_drawing_production_header_entry_date_shift_key;
ALTER TABLE IF EXISTS ONLY public.breaker_drawing_production_detail DROP CONSTRAINT IF EXISTS breaker_drawing_production_detail_pkey;
ALTER TABLE IF EXISTS ONLY public.breaker_drawing_production_detail DROP CONSTRAINT IF EXISTS breaker_drawing_production_detail_header_id_machine_id_key;
ALTER TABLE IF EXISTS ONLY public.breaker_drawing_machine_setup DROP CONSTRAINT IF EXISTS breaker_drawing_machine_setup_pkey;
ALTER TABLE IF EXISTS ONLY public.breaker_drawing_machine_setup DROP CONSTRAINT IF EXISTS breaker_drawing_machine_setup_machine_id_key;
ALTER TABLE IF EXISTS ONLY public.autoconer_machines DROP CONSTRAINT IF EXISTS autoconer_machines_pkey;
ALTER TABLE IF EXISTS ONLY public.autoconer_machines DROP CONSTRAINT IF EXISTS autoconer_machines_mc_id_unique;
ALTER TABLE IF EXISTS ONLY public.autoconer_machines DROP CONSTRAINT IF EXISTS autoconer_machines_machine_no_key;
ALTER TABLE IF EXISTS public.lap_former_production_header ALTER COLUMN entry_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.hok_strength_head ALTER COLUMN hok_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.hok_strength_detail ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.carding_production_header ALTER COLUMN entry_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.breaker_drawing_production_header ALTER COLUMN entry_id DROP DEFAULT;
DROP VIEW IF EXISTS public.twc_entries_view;
DROP TABLE IF EXISTS public.twc_entries;
DROP SEQUENCE IF EXISTS public.twc_entries_entry_id_seq;
DROP VIEW IF EXISTS public.tpi_entries_view;
DROP TABLE IF EXISTS public.tpi_entries;
DROP SEQUENCE IF EXISTS public.tpi_entries_entry_id_seq;
DROP TABLE IF EXISTS public.supervisors;
DROP SEQUENCE IF EXISTS public.supervisors_code_seq;
DROP SEQUENCE IF EXISTS public.stoppage_heads_code_seq;
DROP TABLE IF EXISTS public.stoppage_heads;
DROP SEQUENCE IF EXISTS public.stoppage_details_code_seq;
DROP TABLE IF EXISTS public.stoppage_details;
DROP TABLE IF EXISTS public.spinning_machines;
DROP TABLE IF EXISTS public.spinning_counts;
DROP TABLE IF EXISTS public.simplex_machines;
DROP TABLE IF EXISTS public.lap_former_stoppage_entry;
DROP SEQUENCE IF EXISTS public.lap_former_production_header_entry_id_seq;
DROP TABLE IF EXISTS public.lap_former_production_header;
DROP TABLE IF EXISTS public.lap_former_production_detail;
DROP TABLE IF EXISTS public.lap_former_machines;
DROP TABLE IF EXISTS public.lap_former_machine_setup;
DROP SEQUENCE IF EXISTS public.hok_strength_head_hok_id_seq;
DROP TABLE IF EXISTS public.hok_strength_head;
DROP SEQUENCE IF EXISTS public.hok_strength_detail_id_seq;
DROP TABLE IF EXISTS public.hok_strength_detail;
DROP VIEW IF EXISTS public.hok_departments;
DROP TABLE IF EXISTS public.drawing_finisher_machines;
DROP TABLE IF EXISTS public.drawing_breaker_machines;
DROP TABLE IF EXISTS public.departments;
DROP TABLE IF EXISTS public.comber_machines;
DROP TABLE IF EXISTS public.carding_stoppage_entry;
DROP SEQUENCE IF EXISTS public.carding_production_header_entry_id_seq;
DROP TABLE IF EXISTS public.carding_production_header;
DROP TABLE IF EXISTS public.carding_production_detail;
DROP TABLE IF EXISTS public.carding_machines;
DROP TABLE IF EXISTS public.carding_machine_setup;
DROP TABLE IF EXISTS public.breaker_drawing_stoppage_entry;
DROP SEQUENCE IF EXISTS public.breaker_drawing_production_header_entry_id_seq;
DROP TABLE IF EXISTS public.breaker_drawing_production_header;
DROP TABLE IF EXISTS public.breaker_drawing_production_detail;
DROP TABLE IF EXISTS public.breaker_drawing_machine_setup;
DROP TABLE IF EXISTS public.autoconer_machines;
DROP FUNCTION IF EXISTS public.update_updated_at_column();
DROP FUNCTION IF EXISTS public.sync_breaker_drawing_speed();
DROP FUNCTION IF EXISTS public.get_lap_former_available_dates(p_before_date date, p_shift integer, p_limit integer);
DROP FUNCTION IF EXISTS public.get_breaker_drawing_available_dates(p_before_date date, p_shift integer, p_limit integer);
DROP FUNCTION IF EXISTS public.calculate_breaker_drawing_std_prodn(p_speed numeric, p_hank_constant numeric, p_total_time integer, p_std_efficiency_factor numeric, p_delivery integer);
DROP FUNCTION IF EXISTS public.calculate_breaker_drawing_production(p_machine_id uuid, p_act_prodn numeric, p_work_time integer, p_waste numeric, p_total_time integer);
DROP FUNCTION IF EXISTS public.calculate_breaker_drawing_exp_prodn(p_std_prodn numeric, p_work_time integer, p_total_time integer);
DROP FUNCTION IF EXISTS public.calc_lap_former_waste_percent(p_waste numeric, p_act_prodn numeric);
DROP FUNCTION IF EXISTS public.calc_lap_former_uti(p_work_time integer, p_total_time integer);
DROP FUNCTION IF EXISTS public.calc_lap_former_std_prodn(p_speed integer, p_hank numeric, p_total_time integer, p_std_effi numeric, p_delivery integer);
DROP FUNCTION IF EXISTS public.calc_lap_former_exp_prodn(p_std_prodn numeric, p_work_time integer, p_total_time integer);
DROP FUNCTION IF EXISTS public.calc_lap_former_efficiency(p_act_prodn numeric, p_exp_prodn numeric);
DROP SCHEMA IF EXISTS public;
--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: calc_lap_former_efficiency(numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calc_lap_former_efficiency(p_act_prodn numeric, p_exp_prodn numeric) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF p_exp_prodn = 0 OR p_exp_prodn IS NULL THEN
    RETURN 0;
  END IF;
  RETURN ROUND((p_act_prodn / p_exp_prodn * 100)::DECIMAL, 2);
END;
$$;


--
-- Name: calc_lap_former_exp_prodn(numeric, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calc_lap_former_exp_prodn(p_std_prodn numeric, p_work_time integer, p_total_time integer DEFAULT 510) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN ROUND((p_std_prodn * (p_work_time::DECIMAL / p_total_time))::DECIMAL, 2);
END;
$$;


--
-- Name: calc_lap_former_std_prodn(integer, numeric, integer, numeric, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calc_lap_former_std_prodn(p_speed integer, p_hank numeric DEFAULT 0.0082, p_total_time integer DEFAULT 510, p_std_effi numeric DEFAULT 0.85, p_delivery integer DEFAULT 1) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN ROUND((p_speed::DECIMAL / 1693 / p_hank * p_total_time * p_std_effi * p_delivery)::DECIMAL, 2);
END;
$$;


--
-- Name: calc_lap_former_uti(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calc_lap_former_uti(p_work_time integer, p_total_time integer DEFAULT 510) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN ROUND((p_work_time::DECIMAL / p_total_time * 100)::DECIMAL, 2);
END;
$$;


--
-- Name: calc_lap_former_waste_percent(numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calc_lap_former_waste_percent(p_waste numeric, p_act_prodn numeric) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF p_act_prodn = 0 OR p_act_prodn IS NULL THEN
    RETURN 0;
  END IF;
  RETURN ROUND((p_waste / p_act_prodn * 100)::DECIMAL, 2);
END;
$$;


--
-- Name: calculate_breaker_drawing_exp_prodn(numeric, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_breaker_drawing_exp_prodn(p_std_prodn numeric, p_work_time integer, p_total_time integer DEFAULT 510) RETURNS numeric
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  -- Formula: Std Prodn × (Work Time / Total Time)
  IF p_total_time = 0 THEN RETURN 0; END IF;
  RETURN ROUND(p_std_prodn * (p_work_time::DECIMAL / p_total_time), 2);
END;
$$;


--
-- Name: calculate_breaker_drawing_production(uuid, numeric, integer, numeric, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_breaker_drawing_production(p_machine_id uuid, p_act_prodn numeric, p_work_time integer, p_waste numeric DEFAULT 0.85, p_total_time integer DEFAULT 510) RETURNS TABLE(speed numeric, std_prodn numeric, exp_prodn numeric, effi_percent numeric, uti_percent numeric, waste_percent numeric)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  v_speed DECIMAL;
  v_hank_constant DECIMAL;
  v_std_efficiency_factor DECIMAL;
  v_delivery INTEGER;
  v_std_prodn DECIMAL;
  v_exp_prodn DECIMAL;
BEGIN
  -- Get speed from machine table (source of truth) and other params from setup
  SELECT 
    dbm.speed,
    COALESCE(bdms.hank_constant, 0.14),
    COALESCE(bdms.std_efficiency_factor, 0.85),
    COALESCE(bdms.delivery, 1)
  INTO v_speed, v_hank_constant, v_std_efficiency_factor, v_delivery
  FROM drawing_breaker_machines dbm
  LEFT JOIN breaker_drawing_machine_setup bdms ON dbm.id = bdms.machine_id
  WHERE dbm.id = p_machine_id;
  
  -- Handle missing machine
  IF v_speed IS NULL THEN
    RAISE EXCEPTION 'Machine not found: %', p_machine_id;
  END IF;
  
  -- Calculate Std Prodn: (Speed / 1693 / Hank) × Total Time × Std Effi × Delivery
  v_std_prodn := ROUND(
    (v_speed / 1693.0 / v_hank_constant) 
    * p_total_time 
    * v_std_efficiency_factor 
    * v_delivery, 2
  );
  
  -- Calculate Exp Prodn: Std Prodn × (Work Time / Total Time)
  v_exp_prodn := ROUND(v_std_prodn * (p_work_time::DECIMAL / p_total_time), 2);
  
  -- Return all calculated values including speed for reference
  RETURN QUERY SELECT
    v_speed as speed,
    v_std_prodn as std_prodn,
    v_exp_prodn as exp_prodn,
    ROUND(p_act_prodn / NULLIF(v_exp_prodn, 0) * 100, 2) as effi_percent,
    ROUND(p_work_time::DECIMAL / p_total_time * 100, 2) as uti_percent,
    ROUND(p_waste / NULLIF(p_act_prodn, 0) * 100, 2) as waste_percent;
END;
$$;


--
-- Name: calculate_breaker_drawing_std_prodn(numeric, numeric, integer, numeric, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_breaker_drawing_std_prodn(p_speed numeric, p_hank_constant numeric DEFAULT 0.14, p_total_time integer DEFAULT 510, p_std_efficiency_factor numeric DEFAULT 0.85, p_delivery integer DEFAULT 1) RETURNS numeric
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  -- Formula: (Speed / 1693 / Hank) × Total Time × Std Effi × Delivery
  RETURN ROUND(
    (p_speed / 1693.0 / p_hank_constant) 
    * p_total_time 
    * p_std_efficiency_factor 
    * p_delivery, 2
  );
END;
$$;


--
-- Name: get_breaker_drawing_available_dates(date, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_breaker_drawing_available_dates(p_before_date date, p_shift integer, p_limit integer DEFAULT 30) RETURNS TABLE(entry_date date, shift integer, has_details boolean)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.entry_date,
    h.shift,
    EXISTS(
      SELECT 1 
      FROM breaker_drawing_production_detail d 
      WHERE d.header_id = h.id 
      AND (d.act_prodn > 0 OR d.employee_name IS NOT NULL)
    ) as has_details
  FROM breaker_drawing_production_header h
  WHERE h.entry_date < p_before_date
    AND h.shift = p_shift
  ORDER BY h.entry_date DESC
  LIMIT p_limit;
END;
$$;


--
-- Name: FUNCTION get_breaker_drawing_available_dates(p_before_date date, p_shift integer, p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_breaker_drawing_available_dates(p_before_date date, p_shift integer, p_limit integer) IS 'Returns list of previous dates that have production data for the specified shift. 
   Used by Copy Previous Data feature to show available dates to copy from.';


--
-- Name: get_lap_former_available_dates(date, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_lap_former_available_dates(p_before_date date, p_shift integer, p_limit integer DEFAULT 30) RETURNS TABLE(entry_date date, shift integer, has_details boolean)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.entry_date,
    h.shift,
    EXISTS(
      SELECT 1 
      FROM lap_former_production_detail d 
      WHERE d.header_id = h.id 
      AND (d.act_prodn > 0 OR d.employee_name IS NOT NULL)
    ) as has_details
  FROM lap_former_production_header h
  WHERE h.entry_date < p_before_date
    AND h.shift = p_shift
  ORDER BY h.entry_date DESC
  LIMIT p_limit;
END;
$$;


--
-- Name: sync_breaker_drawing_speed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_breaker_drawing_speed() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Only proceed if speed actually changed
  IF OLD.speed IS DISTINCT FROM NEW.speed THEN
    -- Update machine setup when machine speed changes
    UPDATE breaker_drawing_machine_setup 
    SET 
      speed = NEW.speed,
      std_prodn = ROUND(
        (NEW.speed::DECIMAL / 1693.0 / COALESCE(hank_constant, 0.14)) 
        * COALESCE(shift_time, 510) 
        * COALESCE(std_efficiency_factor, 0.85) 
        * COALESCE(delivery, 1), 2
      ),
      updated_at = NOW()
    WHERE machine_id = NEW.id;
    
    RAISE NOTICE 'Speed synced for machine %: % -> %', NEW.machine_no, OLD.speed, NEW.speed;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: autoconer_machines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.autoconer_machines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    machine_no text NOT NULL,
    description text NOT NULL,
    make_name text DEFAULT 'MURT'::text NOT NULL,
    act_effi integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    mc_id integer,
    group_id integer DEFAULT 1,
    model text,
    from_drum integer,
    to_drum integer,
    no_of_drums integer DEFAULT 0,
    speed integer,
    count text,
    installed_date date,
    direct_prod_entry boolean DEFAULT false
);


--
-- Name: breaker_drawing_machine_setup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.breaker_drawing_machine_setup (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    machine_id uuid NOT NULL,
    speed integer DEFAULT 750,
    hank_constant numeric(10,4) DEFAULT 0.14,
    std_efficiency_factor numeric(5,4) DEFAULT 0.85,
    default_waste numeric(10,4) DEFAULT 0.85,
    std_prodn numeric(10,2) DEFAULT 1371.72,
    shift_time integer DEFAULT 510,
    default_stoppage integer DEFAULT 0,
    divisor_constant integer DEFAULT 1693,
    delivery integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: breaker_drawing_production_detail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.breaker_drawing_production_detail (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    header_id uuid NOT NULL,
    machine_id uuid NOT NULL,
    employee_name character varying(100),
    prodn_mixing character varying(100),
    act_hank numeric(10,2) DEFAULT 0,
    act_prodn numeric(10,2) DEFAULT 0,
    std_prodn numeric(10,2) DEFAULT 0,
    exp_prodn numeric(10,2) DEFAULT 0,
    effi_percent numeric(10,2) DEFAULT 0,
    uti_percent numeric(10,2) DEFAULT 0,
    waste numeric(10,4) DEFAULT 0.85,
    waste_percent numeric(10,4) DEFAULT 0,
    run_time integer DEFAULT 510,
    work_time integer DEFAULT 510,
    session_no integer DEFAULT 1,
    is_verified boolean DEFAULT false,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: breaker_drawing_production_header; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.breaker_drawing_production_header (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_id integer NOT NULL,
    entry_date date NOT NULL,
    shift integer NOT NULL,
    supervisor_id uuid,
    maisitry_id uuid,
    total_time integer DEFAULT 510,
    remarks text,
    is_locked boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT breaker_drawing_production_header_shift_check CHECK ((shift = ANY (ARRAY[1, 2, 3])))
);


--
-- Name: breaker_drawing_production_header_entry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.breaker_drawing_production_header_entry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: breaker_drawing_production_header_entry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.breaker_drawing_production_header_entry_id_seq OWNED BY public.breaker_drawing_production_header.entry_id;


--
-- Name: breaker_drawing_stoppage_entry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.breaker_drawing_stoppage_entry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    production_detail_id uuid NOT NULL,
    stoppage1_id uuid,
    stoppage1_time integer DEFAULT 0,
    stoppage2_id uuid,
    stoppage2_time integer DEFAULT 0,
    stoppage3_id uuid,
    stoppage3_time integer DEFAULT 0,
    stoppage4_id uuid,
    stoppage4_time integer DEFAULT 0,
    total_stoppage_time integer DEFAULT 0,
    is_full_stoppage boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: carding_machine_setup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carding_machine_setup (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    machine_id uuid NOT NULL,
    speed numeric(10,2) DEFAULT 130,
    hank_constant numeric(10,4) DEFAULT 0.13,
    std_efficiency_factor numeric(5,4) DEFAULT 0.98,
    default_waste numeric(10,4) DEFAULT 0.34,
    std_prodn numeric(10,2) DEFAULT 295.22,
    shift_time integer DEFAULT 510,
    default_stoppage integer DEFAULT 135,
    divisor_constant integer DEFAULT 1693,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: carding_machines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carding_machines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    machine_no text NOT NULL,
    description text,
    make_name text,
    mc_id integer,
    model text,
    prodn_mixing text,
    speed integer,
    prodn_efficiency numeric(5,2) DEFAULT 0,
    installed_date date DEFAULT '2015-04-01'::date,
    is_active boolean DEFAULT true,
    direct_hank_entry boolean DEFAULT false,
    direct_kgs_entry boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: carding_production_detail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carding_production_detail (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    header_id uuid NOT NULL,
    machine_id uuid NOT NULL,
    employee_name character varying(100),
    count_mixing character varying(100),
    act_hank numeric(10,2) DEFAULT 0,
    act_prodn numeric(10,2) DEFAULT 0,
    std_prodn numeric(10,2) DEFAULT 0,
    exp_prodn numeric(10,2) DEFAULT 0,
    effi_percent numeric(10,2) DEFAULT 0,
    uti_percent numeric(10,2) DEFAULT 0,
    waste numeric(10,4) DEFAULT 0.34,
    waste_percent numeric(10,4) DEFAULT 0,
    run_time integer DEFAULT 375,
    work_time integer DEFAULT 375,
    session_no integer DEFAULT 1,
    is_verified boolean DEFAULT false,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: carding_production_header; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carding_production_header (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_id integer NOT NULL,
    entry_date date NOT NULL,
    shift integer NOT NULL,
    supervisor_id uuid,
    maisitry_id uuid,
    total_time integer DEFAULT 510,
    remarks text,
    is_locked boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT carding_production_header_shift_check CHECK ((shift = ANY (ARRAY[1, 2, 3])))
);


--
-- Name: carding_production_header_entry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.carding_production_header_entry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: carding_production_header_entry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.carding_production_header_entry_id_seq OWNED BY public.carding_production_header.entry_id;


--
-- Name: carding_stoppage_entry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carding_stoppage_entry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    production_detail_id uuid NOT NULL,
    stoppage1_id uuid,
    stoppage1_time integer DEFAULT 0,
    stoppage2_id uuid,
    stoppage2_time integer DEFAULT 0,
    stoppage3_id uuid,
    stoppage3_time integer DEFAULT 0,
    stoppage4_id uuid,
    stoppage4_time integer DEFAULT 0,
    total_stoppage_time integer DEFAULT 0,
    is_full_stoppage boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: comber_machines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comber_machines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    machine_no text NOT NULL,
    description text,
    make_name text,
    mc_id integer,
    model text,
    prodn_mixing text,
    speed integer,
    prodn_efficiency numeric(5,2) DEFAULT 0,
    mc_effi integer DEFAULT 0,
    installed_date date DEFAULT '2015-04-01'::date,
    is_active boolean DEFAULT true,
    direct_hank_entry boolean DEFAULT false,
    direct_kgs_entry boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dept_name text NOT NULL,
    sl_no integer NOT NULL,
    hok numeric(10,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    code integer
);


--
-- Name: drawing_breaker_machines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drawing_breaker_machines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    machine_no text NOT NULL,
    description text,
    make_name text,
    mc_id integer,
    model text,
    prodn_mixing text,
    speed integer,
    prodn_efficiency numeric(5,2) DEFAULT 0,
    installed_date date DEFAULT '2015-04-01'::date,
    is_active boolean DEFAULT true,
    direct_hank_entry boolean DEFAULT false,
    direct_kgs_entry boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: drawing_finisher_machines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drawing_finisher_machines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    machine_no text NOT NULL,
    description text,
    make_name text,
    mc_id integer,
    model text,
    prodn_mixing text,
    speed integer,
    prodn_efficiency numeric(5,2) DEFAULT 0,
    installed_date date DEFAULT '2015-04-01'::date,
    is_active boolean DEFAULT true,
    direct_hank_entry boolean DEFAULT false,
    direct_kgs_entry boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: hok_departments; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.hok_departments AS
 SELECT id,
    dept_name,
    code,
    sl_no
   FROM public.departments
  WHERE (dept_name = ANY (ARRAY['MIXING'::text, 'BLOW ROOM'::text, 'CARDING'::text, 'DRAWING'::text, 'SIMPLEX SIDER'::text, 'SIMPLEX'::text, 'SPG SIDER'::text, 'SPINNING DOFFER'::text, 'MAISTRY'::text, 'CLEANING'::text]))
  ORDER BY
        CASE dept_name
            WHEN 'MIXING'::text THEN 1
            WHEN 'BLOW ROOM'::text THEN 2
            WHEN 'CARDING'::text THEN 3
            WHEN 'DRAWING'::text THEN 4
            WHEN 'SIMPLEX SIDER'::text THEN 5
            WHEN 'SIMPLEX'::text THEN 6
            WHEN 'SPG SIDER'::text THEN 7
            WHEN 'SPINNING DOFFER'::text THEN 8
            WHEN 'MAISTRY'::text THEN 9
            WHEN 'CLEANING'::text THEN 10
            ELSE NULL::integer
        END;


--
-- Name: hok_strength_detail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hok_strength_detail (
    id integer NOT NULL,
    hok_id integer NOT NULL,
    department_id uuid NOT NULL,
    shift1 numeric(10,1) DEFAULT 0,
    shift2 numeric(10,1) DEFAULT 0,
    shift3 numeric(10,1) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: hok_strength_detail_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hok_strength_detail_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hok_strength_detail_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hok_strength_detail_id_seq OWNED BY public.hok_strength_detail.id;


--
-- Name: hok_strength_head; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hok_strength_head (
    hok_id integer NOT NULL,
    date date NOT NULL,
    total_shift1 numeric(10,2) DEFAULT 0,
    total_shift2 numeric(10,2) DEFAULT 0,
    total_shift3 numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: hok_strength_head_hok_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hok_strength_head_hok_id_seq
    START WITH 1150
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hok_strength_head_hok_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hok_strength_head_hok_id_seq OWNED BY public.hok_strength_head.hok_id;


--
-- Name: lap_former_machine_setup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lap_former_machine_setup (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    machine_id uuid NOT NULL,
    speed integer DEFAULT 90,
    hank_constant numeric(10,4) DEFAULT 0.0082,
    std_efficiency_factor numeric(5,4) DEFAULT 0.85,
    default_waste numeric(10,4) DEFAULT 0.85,
    std_prodn numeric(10,2) DEFAULT 2810.35,
    shift_time integer DEFAULT 510,
    default_stoppage integer DEFAULT 0,
    divisor_constant integer DEFAULT 1693,
    delivery integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: lap_former_machines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lap_former_machines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    machine_no text NOT NULL,
    description text,
    make_name text,
    mc_id integer,
    model text,
    prodn_mixing text,
    speed integer,
    prodn_efficiency numeric(5,2) DEFAULT 0,
    installed_date date DEFAULT '2015-04-01'::date,
    is_active boolean DEFAULT true,
    direct_hank_entry boolean DEFAULT false,
    direct_kgs_entry boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: lap_former_production_detail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lap_former_production_detail (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    header_id uuid NOT NULL,
    machine_id uuid NOT NULL,
    employee_name character varying(100),
    prodn_mixing character varying(100),
    act_hank numeric(10,2) DEFAULT 0,
    act_prodn numeric(10,2) DEFAULT 0,
    std_prodn numeric(10,2) DEFAULT 0,
    exp_prodn numeric(10,2) DEFAULT 0,
    effi_percent numeric(10,2) DEFAULT 0,
    uti_percent numeric(10,2) DEFAULT 0,
    waste numeric(10,4) DEFAULT 0.85,
    waste_percent numeric(10,4) DEFAULT 0,
    run_time integer DEFAULT 510,
    work_time integer DEFAULT 510,
    session_no integer DEFAULT 1,
    is_verified boolean DEFAULT false,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: lap_former_production_header; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lap_former_production_header (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_id integer NOT NULL,
    entry_date date NOT NULL,
    shift integer NOT NULL,
    supervisor_id uuid,
    maisitry_id uuid,
    total_time integer DEFAULT 510,
    remarks text,
    is_locked boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT lap_former_production_header_shift_check CHECK ((shift = ANY (ARRAY[1, 2, 3])))
);


--
-- Name: lap_former_production_header_entry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lap_former_production_header_entry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lap_former_production_header_entry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lap_former_production_header_entry_id_seq OWNED BY public.lap_former_production_header.entry_id;


--
-- Name: lap_former_stoppage_entry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lap_former_stoppage_entry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    production_detail_id uuid NOT NULL,
    stoppage1_id uuid,
    stoppage1_time integer DEFAULT 0,
    stoppage2_id uuid,
    stoppage2_time integer DEFAULT 0,
    stoppage3_id uuid,
    stoppage3_time integer DEFAULT 0,
    stoppage4_id uuid,
    stoppage4_time integer DEFAULT 0,
    total_stoppage_time integer DEFAULT 0,
    is_full_stoppage boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: simplex_machines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.simplex_machines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    machine_no text NOT NULL,
    description text,
    make_name text,
    mc_id integer,
    model text,
    prodn_mixing text,
    speed integer,
    prodn_efficiency numeric(5,2) DEFAULT 0,
    mc_effi integer DEFAULT 0,
    tpi numeric(5,2) DEFAULT 0,
    no_of_spindles integer DEFAULT 0,
    installed_date date DEFAULT '2015-04-01'::date,
    is_active boolean DEFAULT true,
    direct_hank_entry boolean DEFAULT false,
    direct_kgs_entry boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: spinning_counts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spinning_counts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    count_name character varying(100) NOT NULL,
    short_desc character varying(50),
    act_count numeric(6,2) NOT NULL,
    mixing_name character varying(100),
    fibre character varying(50),
    conv_40s_value numeric(10,2),
    ukg numeric(10,2),
    effi_exp_hank numeric(5,2),
    effi_exp_prodn numeric(5,2),
    is_running_now boolean DEFAULT false,
    autoconer_active boolean DEFAULT false,
    sitra_conv_value numeric(10,2),
    cone_weight numeric(10,3),
    effi_actual_prodn numeric(5,2),
    tpi character varying(50),
    speed character varying(50),
    speed_autoconer numeric(10,2),
    tw_con character varying(50),
    waste_percent numeric(5,2),
    doff_loss numeric(5,2),
    auto_effi numeric(5,2),
    hok_cons numeric(10,2),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true
);


--
-- Name: spinning_machines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spinning_machines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    machine_no text NOT NULL,
    description text NOT NULL,
    make_name text DEFAULT 'LMW'::text NOT NULL,
    spindles integer DEFAULT 1104 NOT NULL,
    is_active boolean DEFAULT true,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    frame_no integer,
    mc_id text DEFAULT '225'::text,
    model text,
    group_no integer DEFAULT 0,
    installed_date date DEFAULT '2015-04-01'::date,
    production_kgs_manual_entry boolean DEFAULT false,
    direct_hank_entry boolean DEFAULT true
);


--
-- Name: stoppage_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stoppage_details (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stoppage_head_id uuid,
    code integer NOT NULL,
    description text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    stoppage_name text DEFAULT ''::text NOT NULL,
    short_code character varying(10),
    full_stoppage_name text,
    department_id uuid
);


--
-- Name: stoppage_details_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stoppage_details_code_seq
    START WITH 1447
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stoppage_heads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stoppage_heads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stoppage_head_name text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    code integer,
    description text
);


--
-- Name: stoppage_heads_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stoppage_heads_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supervisors_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supervisors_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supervisors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supervisors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supervisor_name text NOT NULL,
    department_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    code integer DEFAULT nextval('public.supervisors_code_seq'::regclass) NOT NULL
);


--
-- Name: tpi_entries_entry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tpi_entries_entry_id_seq
    START WITH 66
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tpi_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tpi_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_date date NOT NULL,
    spinning_count_id uuid,
    tpi_value numeric(10,2) NOT NULL,
    machine_id uuid,
    shift text,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    entry_id integer DEFAULT nextval('public.tpi_entries_entry_id_seq'::regclass) NOT NULL,
    CONSTRAINT tpi_entries_shift_check CHECK ((shift = ANY (ARRAY['A'::text, 'B'::text, 'C'::text])))
);


--
-- Name: tpi_entries_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.tpi_entries_view AS
 SELECT t.id,
    t.entry_id,
    t.entry_date,
    to_char((t.entry_date)::timestamp with time zone, 'DD-Mon-YY'::text) AS sdate,
    sc.count_name AS countname,
    t.tpi_value AS tpi,
    t.spinning_count_id,
    t.machine_id,
    t.shift,
    t.remarks,
    t.created_at,
    t.updated_at
   FROM (public.tpi_entries t
     LEFT JOIN public.spinning_counts sc ON ((t.spinning_count_id = sc.id)))
  ORDER BY t.entry_id DESC;


--
-- Name: twc_entries_entry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.twc_entries_entry_id_seq
    START WITH 770
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: twc_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.twc_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_date date NOT NULL,
    spinning_count_id uuid,
    twc_value numeric(10,2) NOT NULL,
    machine_id uuid,
    shift text,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    entry_id integer DEFAULT nextval('public.twc_entries_entry_id_seq'::regclass) NOT NULL,
    CONSTRAINT twc_entries_shift_check CHECK ((shift = ANY (ARRAY['A'::text, 'B'::text, 'C'::text])))
);


--
-- Name: twc_entries_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.twc_entries_view AS
 SELECT t.id,
    t.entry_id,
    t.entry_date,
    to_char((t.entry_date)::timestamp with time zone, 'DD-Mon-YY'::text) AS sdate,
    sc.count_name AS countname,
    t.twc_value AS twc,
    t.spinning_count_id,
    t.machine_id,
    t.shift,
    t.remarks,
    t.created_at,
    t.updated_at
   FROM (public.twc_entries t
     LEFT JOIN public.spinning_counts sc ON ((t.spinning_count_id = sc.id)))
  ORDER BY t.entry_id DESC;


--
-- Name: breaker_drawing_production_header entry_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_production_header ALTER COLUMN entry_id SET DEFAULT nextval('public.breaker_drawing_production_header_entry_id_seq'::regclass);


--
-- Name: carding_production_header entry_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_production_header ALTER COLUMN entry_id SET DEFAULT nextval('public.carding_production_header_entry_id_seq'::regclass);


--
-- Name: hok_strength_detail id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hok_strength_detail ALTER COLUMN id SET DEFAULT nextval('public.hok_strength_detail_id_seq'::regclass);


--
-- Name: hok_strength_head hok_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hok_strength_head ALTER COLUMN hok_id SET DEFAULT nextval('public.hok_strength_head_hok_id_seq'::regclass);


--
-- Name: lap_former_production_header entry_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_production_header ALTER COLUMN entry_id SET DEFAULT nextval('public.lap_former_production_header_entry_id_seq'::regclass);


--
-- Name: autoconer_machines autoconer_machines_machine_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autoconer_machines
    ADD CONSTRAINT autoconer_machines_machine_no_key UNIQUE (machine_no);


--
-- Name: autoconer_machines autoconer_machines_mc_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autoconer_machines
    ADD CONSTRAINT autoconer_machines_mc_id_unique UNIQUE (mc_id);


--
-- Name: autoconer_machines autoconer_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autoconer_machines
    ADD CONSTRAINT autoconer_machines_pkey PRIMARY KEY (id);


--
-- Name: breaker_drawing_machine_setup breaker_drawing_machine_setup_machine_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_machine_setup
    ADD CONSTRAINT breaker_drawing_machine_setup_machine_id_key UNIQUE (machine_id);


--
-- Name: breaker_drawing_machine_setup breaker_drawing_machine_setup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_machine_setup
    ADD CONSTRAINT breaker_drawing_machine_setup_pkey PRIMARY KEY (id);


--
-- Name: breaker_drawing_production_detail breaker_drawing_production_detail_header_id_machine_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_production_detail
    ADD CONSTRAINT breaker_drawing_production_detail_header_id_machine_id_key UNIQUE (header_id, machine_id);


--
-- Name: breaker_drawing_production_detail breaker_drawing_production_detail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_production_detail
    ADD CONSTRAINT breaker_drawing_production_detail_pkey PRIMARY KEY (id);


--
-- Name: breaker_drawing_production_header breaker_drawing_production_header_entry_date_shift_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_production_header
    ADD CONSTRAINT breaker_drawing_production_header_entry_date_shift_key UNIQUE (entry_date, shift);


--
-- Name: breaker_drawing_production_header breaker_drawing_production_header_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_production_header
    ADD CONSTRAINT breaker_drawing_production_header_pkey PRIMARY KEY (id);


--
-- Name: breaker_drawing_stoppage_entry breaker_drawing_stoppage_entry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_stoppage_entry
    ADD CONSTRAINT breaker_drawing_stoppage_entry_pkey PRIMARY KEY (id);


--
-- Name: breaker_drawing_stoppage_entry breaker_drawing_stoppage_entry_production_detail_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_stoppage_entry
    ADD CONSTRAINT breaker_drawing_stoppage_entry_production_detail_id_key UNIQUE (production_detail_id);


--
-- Name: carding_machine_setup carding_machine_setup_machine_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_machine_setup
    ADD CONSTRAINT carding_machine_setup_machine_id_key UNIQUE (machine_id);


--
-- Name: carding_machine_setup carding_machine_setup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_machine_setup
    ADD CONSTRAINT carding_machine_setup_pkey PRIMARY KEY (id);


--
-- Name: carding_machines carding_machines_machine_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_machines
    ADD CONSTRAINT carding_machines_machine_no_key UNIQUE (machine_no);


--
-- Name: carding_machines carding_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_machines
    ADD CONSTRAINT carding_machines_pkey PRIMARY KEY (id);


--
-- Name: carding_production_detail carding_production_detail_header_id_machine_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_production_detail
    ADD CONSTRAINT carding_production_detail_header_id_machine_id_key UNIQUE (header_id, machine_id);


--
-- Name: carding_production_detail carding_production_detail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_production_detail
    ADD CONSTRAINT carding_production_detail_pkey PRIMARY KEY (id);


--
-- Name: carding_production_header carding_production_header_entry_date_shift_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_production_header
    ADD CONSTRAINT carding_production_header_entry_date_shift_key UNIQUE (entry_date, shift);


--
-- Name: carding_production_header carding_production_header_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_production_header
    ADD CONSTRAINT carding_production_header_pkey PRIMARY KEY (id);


--
-- Name: carding_stoppage_entry carding_stoppage_entry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_stoppage_entry
    ADD CONSTRAINT carding_stoppage_entry_pkey PRIMARY KEY (id);


--
-- Name: carding_stoppage_entry carding_stoppage_entry_production_detail_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_stoppage_entry
    ADD CONSTRAINT carding_stoppage_entry_production_detail_id_key UNIQUE (production_detail_id);


--
-- Name: comber_machines comber_machines_machine_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comber_machines
    ADD CONSTRAINT comber_machines_machine_no_key UNIQUE (machine_no);


--
-- Name: comber_machines comber_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comber_machines
    ADD CONSTRAINT comber_machines_pkey PRIMARY KEY (id);


--
-- Name: departments departments_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_code_unique UNIQUE (code);


--
-- Name: departments departments_dept_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_dept_name_key UNIQUE (dept_name);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: drawing_breaker_machines drawing_breaker_machines_machine_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drawing_breaker_machines
    ADD CONSTRAINT drawing_breaker_machines_machine_no_key UNIQUE (machine_no);


--
-- Name: drawing_breaker_machines drawing_breaker_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drawing_breaker_machines
    ADD CONSTRAINT drawing_breaker_machines_pkey PRIMARY KEY (id);


--
-- Name: drawing_finisher_machines drawing_finisher_machines_machine_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drawing_finisher_machines
    ADD CONSTRAINT drawing_finisher_machines_machine_no_key UNIQUE (machine_no);


--
-- Name: drawing_finisher_machines drawing_finisher_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drawing_finisher_machines
    ADD CONSTRAINT drawing_finisher_machines_pkey PRIMARY KEY (id);


--
-- Name: hok_strength_detail hok_strength_detail_hok_id_department_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hok_strength_detail
    ADD CONSTRAINT hok_strength_detail_hok_id_department_id_key UNIQUE (hok_id, department_id);


--
-- Name: hok_strength_detail hok_strength_detail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hok_strength_detail
    ADD CONSTRAINT hok_strength_detail_pkey PRIMARY KEY (id);


--
-- Name: hok_strength_head hok_strength_head_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hok_strength_head
    ADD CONSTRAINT hok_strength_head_date_key UNIQUE (date);


--
-- Name: hok_strength_head hok_strength_head_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hok_strength_head
    ADD CONSTRAINT hok_strength_head_pkey PRIMARY KEY (hok_id);


--
-- Name: lap_former_machine_setup lap_former_machine_setup_machine_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_machine_setup
    ADD CONSTRAINT lap_former_machine_setup_machine_id_key UNIQUE (machine_id);


--
-- Name: lap_former_machine_setup lap_former_machine_setup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_machine_setup
    ADD CONSTRAINT lap_former_machine_setup_pkey PRIMARY KEY (id);


--
-- Name: lap_former_machines lap_former_machines_machine_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_machines
    ADD CONSTRAINT lap_former_machines_machine_no_key UNIQUE (machine_no);


--
-- Name: lap_former_machines lap_former_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_machines
    ADD CONSTRAINT lap_former_machines_pkey PRIMARY KEY (id);


--
-- Name: lap_former_production_detail lap_former_production_detail_header_id_machine_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_production_detail
    ADD CONSTRAINT lap_former_production_detail_header_id_machine_id_key UNIQUE (header_id, machine_id);


--
-- Name: lap_former_production_detail lap_former_production_detail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_production_detail
    ADD CONSTRAINT lap_former_production_detail_pkey PRIMARY KEY (id);


--
-- Name: lap_former_production_header lap_former_production_header_entry_date_shift_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_production_header
    ADD CONSTRAINT lap_former_production_header_entry_date_shift_key UNIQUE (entry_date, shift);


--
-- Name: lap_former_production_header lap_former_production_header_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_production_header
    ADD CONSTRAINT lap_former_production_header_pkey PRIMARY KEY (id);


--
-- Name: lap_former_stoppage_entry lap_former_stoppage_entry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_stoppage_entry
    ADD CONSTRAINT lap_former_stoppage_entry_pkey PRIMARY KEY (id);


--
-- Name: lap_former_stoppage_entry lap_former_stoppage_entry_production_detail_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_stoppage_entry
    ADD CONSTRAINT lap_former_stoppage_entry_production_detail_id_key UNIQUE (production_detail_id);


--
-- Name: simplex_machines simplex_machines_machine_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simplex_machines
    ADD CONSTRAINT simplex_machines_machine_no_key UNIQUE (machine_no);


--
-- Name: simplex_machines simplex_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simplex_machines
    ADD CONSTRAINT simplex_machines_pkey PRIMARY KEY (id);


--
-- Name: spinning_counts spinning_counts_count_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spinning_counts
    ADD CONSTRAINT spinning_counts_count_name_key UNIQUE (count_name);


--
-- Name: spinning_counts spinning_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spinning_counts
    ADD CONSTRAINT spinning_counts_pkey PRIMARY KEY (id);


--
-- Name: spinning_machines spinning_machines_machine_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spinning_machines
    ADD CONSTRAINT spinning_machines_machine_no_key UNIQUE (machine_no);


--
-- Name: spinning_machines spinning_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spinning_machines
    ADD CONSTRAINT spinning_machines_pkey PRIMARY KEY (id);


--
-- Name: stoppage_details stoppage_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stoppage_details
    ADD CONSTRAINT stoppage_details_pkey PRIMARY KEY (id);


--
-- Name: stoppage_details stoppage_details_stoppage_head_id_detail_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stoppage_details
    ADD CONSTRAINT stoppage_details_stoppage_head_id_detail_code_key UNIQUE (stoppage_head_id, code);


--
-- Name: stoppage_heads stoppage_heads_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stoppage_heads
    ADD CONSTRAINT stoppage_heads_code_key UNIQUE (code);


--
-- Name: stoppage_heads stoppage_heads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stoppage_heads
    ADD CONSTRAINT stoppage_heads_pkey PRIMARY KEY (id);


--
-- Name: stoppage_heads stoppage_heads_stoppage_head_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stoppage_heads
    ADD CONSTRAINT stoppage_heads_stoppage_head_name_key UNIQUE (stoppage_head_name);


--
-- Name: supervisors supervisors_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervisors
    ADD CONSTRAINT supervisors_code_unique UNIQUE (code);


--
-- Name: supervisors supervisors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervisors
    ADD CONSTRAINT supervisors_pkey PRIMARY KEY (id);


--
-- Name: supervisors supervisors_supervisor_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervisors
    ADD CONSTRAINT supervisors_supervisor_name_key UNIQUE (supervisor_name);


--
-- Name: tpi_entries tpi_entries_entry_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tpi_entries
    ADD CONSTRAINT tpi_entries_entry_id_unique UNIQUE (entry_id);


--
-- Name: tpi_entries tpi_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tpi_entries
    ADD CONSTRAINT tpi_entries_pkey PRIMARY KEY (id);


--
-- Name: twc_entries twc_entries_entry_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twc_entries
    ADD CONSTRAINT twc_entries_entry_id_unique UNIQUE (entry_id);


--
-- Name: twc_entries twc_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twc_entries
    ADD CONSTRAINT twc_entries_pkey PRIMARY KEY (id);


--
-- Name: idx_autoconer_machines_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_autoconer_machines_group_id ON public.autoconer_machines USING btree (group_id);


--
-- Name: idx_autoconer_machines_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_autoconer_machines_is_active ON public.autoconer_machines USING btree (is_active);


--
-- Name: idx_autoconer_machines_machine_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_autoconer_machines_machine_no ON public.autoconer_machines USING btree (machine_no);


--
-- Name: idx_autoconer_machines_mc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_autoconer_machines_mc_id ON public.autoconer_machines USING btree (mc_id);


--
-- Name: idx_bd_detail_header_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bd_detail_header_id ON public.breaker_drawing_production_detail USING btree (header_id);


--
-- Name: idx_bd_header_date_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bd_header_date_shift ON public.breaker_drawing_production_header USING btree (entry_date DESC, shift);


--
-- Name: idx_bd_prod_detail_header; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bd_prod_detail_header ON public.breaker_drawing_production_detail USING btree (header_id);


--
-- Name: idx_bd_prod_detail_machine; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bd_prod_detail_machine ON public.breaker_drawing_production_detail USING btree (machine_id);


--
-- Name: idx_bd_prod_header_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bd_prod_header_date ON public.breaker_drawing_production_header USING btree (entry_date);


--
-- Name: idx_bd_prod_header_entry_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bd_prod_header_entry_id ON public.breaker_drawing_production_header USING btree (entry_id);


--
-- Name: idx_bd_prod_header_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bd_prod_header_shift ON public.breaker_drawing_production_header USING btree (shift);


--
-- Name: idx_bd_stoppage_detail_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bd_stoppage_detail_id ON public.breaker_drawing_stoppage_entry USING btree (production_detail_id);


--
-- Name: idx_bd_stoppage_prod_detail; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bd_stoppage_prod_detail ON public.breaker_drawing_stoppage_entry USING btree (production_detail_id);


--
-- Name: idx_carding_machines_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carding_machines_is_active ON public.carding_machines USING btree (is_active);


--
-- Name: idx_carding_machines_machine_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carding_machines_machine_no ON public.carding_machines USING btree (machine_no);


--
-- Name: idx_carding_machines_mc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carding_machines_mc_id ON public.carding_machines USING btree (mc_id);


--
-- Name: idx_carding_machines_model; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carding_machines_model ON public.carding_machines USING btree (model);


--
-- Name: idx_carding_prod_detail_header; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carding_prod_detail_header ON public.carding_production_detail USING btree (header_id);


--
-- Name: idx_carding_prod_detail_machine; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carding_prod_detail_machine ON public.carding_production_detail USING btree (machine_id);


--
-- Name: idx_carding_prod_header_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carding_prod_header_date ON public.carding_production_header USING btree (entry_date);


--
-- Name: idx_carding_prod_header_entry_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carding_prod_header_entry_id ON public.carding_production_header USING btree (entry_id);


--
-- Name: idx_carding_prod_header_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carding_prod_header_shift ON public.carding_production_header USING btree (shift);


--
-- Name: idx_carding_stoppage_prod_detail; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carding_stoppage_prod_detail ON public.carding_stoppage_entry USING btree (production_detail_id);


--
-- Name: idx_comber_machines_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comber_machines_is_active ON public.comber_machines USING btree (is_active);


--
-- Name: idx_comber_machines_machine_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comber_machines_machine_no ON public.comber_machines USING btree (machine_no);


--
-- Name: idx_comber_machines_mc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comber_machines_mc_id ON public.comber_machines USING btree (mc_id);


--
-- Name: idx_departments_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_code ON public.departments USING btree (code);


--
-- Name: idx_departments_dept_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_dept_name ON public.departments USING btree (dept_name);


--
-- Name: idx_departments_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_is_active ON public.departments USING btree (is_active);


--
-- Name: idx_departments_sl_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_sl_no ON public.departments USING btree (sl_no);


--
-- Name: idx_drawing_breaker_machines_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drawing_breaker_machines_is_active ON public.drawing_breaker_machines USING btree (is_active);


--
-- Name: idx_drawing_breaker_machines_machine_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drawing_breaker_machines_machine_no ON public.drawing_breaker_machines USING btree (machine_no);


--
-- Name: idx_drawing_breaker_machines_mc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drawing_breaker_machines_mc_id ON public.drawing_breaker_machines USING btree (mc_id);


--
-- Name: idx_drawing_finisher_machines_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drawing_finisher_machines_is_active ON public.drawing_finisher_machines USING btree (is_active);


--
-- Name: idx_drawing_finisher_machines_machine_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drawing_finisher_machines_machine_no ON public.drawing_finisher_machines USING btree (machine_no);


--
-- Name: idx_drawing_finisher_machines_mc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drawing_finisher_machines_mc_id ON public.drawing_finisher_machines USING btree (mc_id);


--
-- Name: idx_hok_strength_detail_dept_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hok_strength_detail_dept_id ON public.hok_strength_detail USING btree (department_id);


--
-- Name: idx_hok_strength_detail_hok_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hok_strength_detail_hok_id ON public.hok_strength_detail USING btree (hok_id);


--
-- Name: idx_hok_strength_head_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hok_strength_head_date ON public.hok_strength_head USING btree (date);


--
-- Name: idx_lap_former_machines_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lap_former_machines_is_active ON public.lap_former_machines USING btree (is_active);


--
-- Name: idx_lap_former_machines_machine_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lap_former_machines_machine_no ON public.lap_former_machines USING btree (machine_no);


--
-- Name: idx_lap_former_machines_mc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lap_former_machines_mc_id ON public.lap_former_machines USING btree (mc_id);


--
-- Name: idx_lf_prod_detail_header; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lf_prod_detail_header ON public.lap_former_production_detail USING btree (header_id);


--
-- Name: idx_lf_prod_detail_machine; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lf_prod_detail_machine ON public.lap_former_production_detail USING btree (machine_id);


--
-- Name: idx_lf_prod_header_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lf_prod_header_date ON public.lap_former_production_header USING btree (entry_date);


--
-- Name: idx_lf_prod_header_date_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lf_prod_header_date_shift ON public.lap_former_production_header USING btree (entry_date DESC, shift);


--
-- Name: idx_lf_prod_header_entry_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lf_prod_header_entry_id ON public.lap_former_production_header USING btree (entry_id);


--
-- Name: idx_lf_prod_header_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lf_prod_header_shift ON public.lap_former_production_header USING btree (shift);


--
-- Name: idx_lf_stoppage_prod_detail; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lf_stoppage_prod_detail ON public.lap_former_stoppage_entry USING btree (production_detail_id);


--
-- Name: idx_simplex_machines_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_simplex_machines_is_active ON public.simplex_machines USING btree (is_active);


--
-- Name: idx_simplex_machines_machine_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_simplex_machines_machine_no ON public.simplex_machines USING btree (machine_no);


--
-- Name: idx_simplex_machines_mc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_simplex_machines_mc_id ON public.simplex_machines USING btree (mc_id);


--
-- Name: idx_spinning_counts_count_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spinning_counts_count_name ON public.spinning_counts USING btree (count_name);


--
-- Name: idx_spinning_counts_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spinning_counts_is_active ON public.spinning_counts USING btree (is_active);


--
-- Name: idx_spinning_machines_frame_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spinning_machines_frame_no ON public.spinning_machines USING btree (frame_no);


--
-- Name: idx_spinning_machines_group_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spinning_machines_group_no ON public.spinning_machines USING btree (group_no);


--
-- Name: idx_spinning_machines_machine_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spinning_machines_machine_no ON public.spinning_machines USING btree (machine_no);


--
-- Name: idx_spinning_machines_mc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spinning_machines_mc_id ON public.spinning_machines USING btree (mc_id);


--
-- Name: idx_stoppage_details_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stoppage_details_code ON public.stoppage_details USING btree (code);


--
-- Name: idx_stoppage_details_department_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stoppage_details_department_id ON public.stoppage_details USING btree (department_id);


--
-- Name: idx_stoppage_details_stoppage_head_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stoppage_details_stoppage_head_id ON public.stoppage_details USING btree (stoppage_head_id);


--
-- Name: idx_stoppage_details_stoppage_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stoppage_details_stoppage_name ON public.stoppage_details USING btree (stoppage_name);


--
-- Name: idx_stoppage_heads_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stoppage_heads_code ON public.stoppage_heads USING btree (code);


--
-- Name: idx_stoppage_heads_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stoppage_heads_name ON public.stoppage_heads USING btree (stoppage_head_name);


--
-- Name: idx_supervisors_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supervisors_code ON public.supervisors USING btree (code);


--
-- Name: idx_supervisors_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supervisors_name ON public.supervisors USING btree (supervisor_name);


--
-- Name: idx_tpi_entries_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tpi_entries_date ON public.tpi_entries USING btree (entry_date);


--
-- Name: idx_tpi_entries_entry_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tpi_entries_entry_id ON public.tpi_entries USING btree (entry_id);


--
-- Name: idx_tpi_entries_spinning_count_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tpi_entries_spinning_count_id ON public.tpi_entries USING btree (spinning_count_id);


--
-- Name: idx_twc_entries_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_twc_entries_date ON public.twc_entries USING btree (entry_date);


--
-- Name: idx_twc_entries_entry_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_twc_entries_entry_id ON public.twc_entries USING btree (entry_id);


--
-- Name: idx_twc_entries_spinning_count_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_twc_entries_spinning_count_id ON public.twc_entries USING btree (spinning_count_id);


--
-- Name: drawing_breaker_machines sync_bd_speed_on_machine_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_bd_speed_on_machine_update AFTER UPDATE OF speed ON public.drawing_breaker_machines FOR EACH ROW EXECUTE FUNCTION public.sync_breaker_drawing_speed();


--
-- Name: autoconer_machines update_autoconer_machines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_autoconer_machines_updated_at BEFORE UPDATE ON public.autoconer_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: breaker_drawing_machine_setup update_bd_machine_setup_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bd_machine_setup_updated_at BEFORE UPDATE ON public.breaker_drawing_machine_setup FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: breaker_drawing_production_detail update_bd_prod_detail_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bd_prod_detail_updated_at BEFORE UPDATE ON public.breaker_drawing_production_detail FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: breaker_drawing_production_header update_bd_prod_header_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bd_prod_header_updated_at BEFORE UPDATE ON public.breaker_drawing_production_header FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: breaker_drawing_stoppage_entry update_bd_stoppage_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bd_stoppage_updated_at BEFORE UPDATE ON public.breaker_drawing_stoppage_entry FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: carding_machine_setup update_carding_machine_setup_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_carding_machine_setup_updated_at BEFORE UPDATE ON public.carding_machine_setup FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: carding_machines update_carding_machines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_carding_machines_updated_at BEFORE UPDATE ON public.carding_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: carding_production_detail update_carding_prod_detail_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_carding_prod_detail_updated_at BEFORE UPDATE ON public.carding_production_detail FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: carding_production_header update_carding_prod_header_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_carding_prod_header_updated_at BEFORE UPDATE ON public.carding_production_header FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: carding_stoppage_entry update_carding_stoppage_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_carding_stoppage_updated_at BEFORE UPDATE ON public.carding_stoppage_entry FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: comber_machines update_comber_machines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_comber_machines_updated_at BEFORE UPDATE ON public.comber_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: departments update_departments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: drawing_breaker_machines update_drawing_breaker_machines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_drawing_breaker_machines_updated_at BEFORE UPDATE ON public.drawing_breaker_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: drawing_finisher_machines update_drawing_finisher_machines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_drawing_finisher_machines_updated_at BEFORE UPDATE ON public.drawing_finisher_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: hok_strength_detail update_hok_strength_detail_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_hok_strength_detail_updated_at BEFORE UPDATE ON public.hok_strength_detail FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: hok_strength_head update_hok_strength_head_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_hok_strength_head_updated_at BEFORE UPDATE ON public.hok_strength_head FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lap_former_machines update_lap_former_machines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lap_former_machines_updated_at BEFORE UPDATE ON public.lap_former_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lap_former_machine_setup update_lf_machine_setup_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lf_machine_setup_updated_at BEFORE UPDATE ON public.lap_former_machine_setup FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lap_former_production_detail update_lf_prod_detail_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lf_prod_detail_updated_at BEFORE UPDATE ON public.lap_former_production_detail FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lap_former_production_header update_lf_prod_header_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lf_prod_header_updated_at BEFORE UPDATE ON public.lap_former_production_header FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lap_former_stoppage_entry update_lf_stoppage_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lf_stoppage_updated_at BEFORE UPDATE ON public.lap_former_stoppage_entry FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: simplex_machines update_simplex_machines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_simplex_machines_updated_at BEFORE UPDATE ON public.simplex_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: spinning_machines update_spinning_machines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_spinning_machines_updated_at BEFORE UPDATE ON public.spinning_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: stoppage_details update_stoppage_details_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_stoppage_details_updated_at BEFORE UPDATE ON public.stoppage_details FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: stoppage_heads update_stoppage_heads_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_stoppage_heads_updated_at BEFORE UPDATE ON public.stoppage_heads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: supervisors update_supervisors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_supervisors_updated_at BEFORE UPDATE ON public.supervisors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tpi_entries update_tpi_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tpi_entries_updated_at BEFORE UPDATE ON public.tpi_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: twc_entries update_twc_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_twc_entries_updated_at BEFORE UPDATE ON public.twc_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: breaker_drawing_machine_setup breaker_drawing_machine_setup_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_machine_setup
    ADD CONSTRAINT breaker_drawing_machine_setup_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.drawing_breaker_machines(id) ON DELETE CASCADE;


--
-- Name: breaker_drawing_production_detail breaker_drawing_production_detail_header_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_production_detail
    ADD CONSTRAINT breaker_drawing_production_detail_header_id_fkey FOREIGN KEY (header_id) REFERENCES public.breaker_drawing_production_header(id) ON DELETE CASCADE;


--
-- Name: breaker_drawing_production_detail breaker_drawing_production_detail_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_production_detail
    ADD CONSTRAINT breaker_drawing_production_detail_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.drawing_breaker_machines(id) ON DELETE CASCADE;


--
-- Name: breaker_drawing_production_header breaker_drawing_production_header_maisitry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_production_header
    ADD CONSTRAINT breaker_drawing_production_header_maisitry_id_fkey FOREIGN KEY (maisitry_id) REFERENCES public.supervisors(id) ON DELETE SET NULL;


--
-- Name: breaker_drawing_production_header breaker_drawing_production_header_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_production_header
    ADD CONSTRAINT breaker_drawing_production_header_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.supervisors(id) ON DELETE SET NULL;


--
-- Name: breaker_drawing_stoppage_entry breaker_drawing_stoppage_entry_production_detail_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_stoppage_entry
    ADD CONSTRAINT breaker_drawing_stoppage_entry_production_detail_id_fkey FOREIGN KEY (production_detail_id) REFERENCES public.breaker_drawing_production_detail(id) ON DELETE CASCADE;


--
-- Name: breaker_drawing_stoppage_entry breaker_drawing_stoppage_entry_stoppage1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_stoppage_entry
    ADD CONSTRAINT breaker_drawing_stoppage_entry_stoppage1_id_fkey FOREIGN KEY (stoppage1_id) REFERENCES public.stoppage_details(id) ON DELETE SET NULL;


--
-- Name: breaker_drawing_stoppage_entry breaker_drawing_stoppage_entry_stoppage2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_stoppage_entry
    ADD CONSTRAINT breaker_drawing_stoppage_entry_stoppage2_id_fkey FOREIGN KEY (stoppage2_id) REFERENCES public.stoppage_details(id) ON DELETE SET NULL;


--
-- Name: breaker_drawing_stoppage_entry breaker_drawing_stoppage_entry_stoppage3_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_stoppage_entry
    ADD CONSTRAINT breaker_drawing_stoppage_entry_stoppage3_id_fkey FOREIGN KEY (stoppage3_id) REFERENCES public.stoppage_details(id) ON DELETE SET NULL;


--
-- Name: breaker_drawing_stoppage_entry breaker_drawing_stoppage_entry_stoppage4_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_stoppage_entry
    ADD CONSTRAINT breaker_drawing_stoppage_entry_stoppage4_id_fkey FOREIGN KEY (stoppage4_id) REFERENCES public.stoppage_details(id) ON DELETE SET NULL;


--
-- Name: carding_machine_setup carding_machine_setup_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_machine_setup
    ADD CONSTRAINT carding_machine_setup_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.carding_machines(id) ON DELETE CASCADE;


--
-- Name: carding_production_detail carding_production_detail_header_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_production_detail
    ADD CONSTRAINT carding_production_detail_header_id_fkey FOREIGN KEY (header_id) REFERENCES public.carding_production_header(id) ON DELETE CASCADE;


--
-- Name: carding_production_detail carding_production_detail_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_production_detail
    ADD CONSTRAINT carding_production_detail_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.carding_machines(id) ON DELETE CASCADE;


--
-- Name: carding_production_header carding_production_header_maisitry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_production_header
    ADD CONSTRAINT carding_production_header_maisitry_id_fkey FOREIGN KEY (maisitry_id) REFERENCES public.supervisors(id) ON DELETE SET NULL;


--
-- Name: carding_production_header carding_production_header_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_production_header
    ADD CONSTRAINT carding_production_header_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.supervisors(id) ON DELETE SET NULL;


--
-- Name: carding_stoppage_entry carding_stoppage_entry_production_detail_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_stoppage_entry
    ADD CONSTRAINT carding_stoppage_entry_production_detail_id_fkey FOREIGN KEY (production_detail_id) REFERENCES public.carding_production_detail(id) ON DELETE CASCADE;


--
-- Name: carding_stoppage_entry carding_stoppage_entry_stoppage1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_stoppage_entry
    ADD CONSTRAINT carding_stoppage_entry_stoppage1_id_fkey FOREIGN KEY (stoppage1_id) REFERENCES public.stoppage_details(id) ON DELETE SET NULL;


--
-- Name: carding_stoppage_entry carding_stoppage_entry_stoppage2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_stoppage_entry
    ADD CONSTRAINT carding_stoppage_entry_stoppage2_id_fkey FOREIGN KEY (stoppage2_id) REFERENCES public.stoppage_details(id) ON DELETE SET NULL;


--
-- Name: carding_stoppage_entry carding_stoppage_entry_stoppage3_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_stoppage_entry
    ADD CONSTRAINT carding_stoppage_entry_stoppage3_id_fkey FOREIGN KEY (stoppage3_id) REFERENCES public.stoppage_details(id) ON DELETE SET NULL;


--
-- Name: carding_stoppage_entry carding_stoppage_entry_stoppage4_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_stoppage_entry
    ADD CONSTRAINT carding_stoppage_entry_stoppage4_id_fkey FOREIGN KEY (stoppage4_id) REFERENCES public.stoppage_details(id) ON DELETE SET NULL;


--
-- Name: hok_strength_detail hok_strength_detail_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hok_strength_detail
    ADD CONSTRAINT hok_strength_detail_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: hok_strength_detail hok_strength_detail_hok_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hok_strength_detail
    ADD CONSTRAINT hok_strength_detail_hok_id_fkey FOREIGN KEY (hok_id) REFERENCES public.hok_strength_head(hok_id) ON DELETE CASCADE;


--
-- Name: lap_former_machine_setup lap_former_machine_setup_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_machine_setup
    ADD CONSTRAINT lap_former_machine_setup_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.lap_former_machines(id) ON DELETE CASCADE;


--
-- Name: lap_former_production_detail lap_former_production_detail_header_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_production_detail
    ADD CONSTRAINT lap_former_production_detail_header_id_fkey FOREIGN KEY (header_id) REFERENCES public.lap_former_production_header(id) ON DELETE CASCADE;


--
-- Name: lap_former_production_detail lap_former_production_detail_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_production_detail
    ADD CONSTRAINT lap_former_production_detail_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.lap_former_machines(id) ON DELETE CASCADE;


--
-- Name: lap_former_production_header lap_former_production_header_maisitry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_production_header
    ADD CONSTRAINT lap_former_production_header_maisitry_id_fkey FOREIGN KEY (maisitry_id) REFERENCES public.supervisors(id) ON DELETE SET NULL;


--
-- Name: lap_former_production_header lap_former_production_header_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_production_header
    ADD CONSTRAINT lap_former_production_header_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.supervisors(id) ON DELETE SET NULL;


--
-- Name: lap_former_stoppage_entry lap_former_stoppage_entry_production_detail_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_stoppage_entry
    ADD CONSTRAINT lap_former_stoppage_entry_production_detail_id_fkey FOREIGN KEY (production_detail_id) REFERENCES public.lap_former_production_detail(id) ON DELETE CASCADE;


--
-- Name: lap_former_stoppage_entry lap_former_stoppage_entry_stoppage1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_stoppage_entry
    ADD CONSTRAINT lap_former_stoppage_entry_stoppage1_id_fkey FOREIGN KEY (stoppage1_id) REFERENCES public.stoppage_details(id) ON DELETE SET NULL;


--
-- Name: lap_former_stoppage_entry lap_former_stoppage_entry_stoppage2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_stoppage_entry
    ADD CONSTRAINT lap_former_stoppage_entry_stoppage2_id_fkey FOREIGN KEY (stoppage2_id) REFERENCES public.stoppage_details(id) ON DELETE SET NULL;


--
-- Name: lap_former_stoppage_entry lap_former_stoppage_entry_stoppage3_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_stoppage_entry
    ADD CONSTRAINT lap_former_stoppage_entry_stoppage3_id_fkey FOREIGN KEY (stoppage3_id) REFERENCES public.stoppage_details(id) ON DELETE SET NULL;


--
-- Name: lap_former_stoppage_entry lap_former_stoppage_entry_stoppage4_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_stoppage_entry
    ADD CONSTRAINT lap_former_stoppage_entry_stoppage4_id_fkey FOREIGN KEY (stoppage4_id) REFERENCES public.stoppage_details(id) ON DELETE SET NULL;


--
-- Name: stoppage_details stoppage_details_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stoppage_details
    ADD CONSTRAINT stoppage_details_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: stoppage_details stoppage_details_stoppage_head_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stoppage_details
    ADD CONSTRAINT stoppage_details_stoppage_head_id_fkey FOREIGN KEY (stoppage_head_id) REFERENCES public.stoppage_heads(id) ON DELETE CASCADE;


--
-- Name: supervisors supervisors_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervisors
    ADD CONSTRAINT supervisors_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: tpi_entries tpi_entries_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tpi_entries
    ADD CONSTRAINT tpi_entries_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.spinning_machines(id) ON DELETE SET NULL;


--
-- Name: tpi_entries tpi_entries_spinning_count_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tpi_entries
    ADD CONSTRAINT tpi_entries_spinning_count_id_fkey FOREIGN KEY (spinning_count_id) REFERENCES public.spinning_counts(id) ON DELETE SET NULL;


--
-- Name: twc_entries twc_entries_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twc_entries
    ADD CONSTRAINT twc_entries_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.spinning_machines(id) ON DELETE SET NULL;


--
-- Name: twc_entries twc_entries_spinning_count_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twc_entries
    ADD CONSTRAINT twc_entries_spinning_count_id_fkey FOREIGN KEY (spinning_count_id) REFERENCES public.spinning_counts(id) ON DELETE SET NULL;


--
-- Name: spinning_counts Enable all operations for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable all operations for authenticated users" ON public.spinning_counts USING ((auth.role() = 'authenticated'::text));


--
-- Name: autoconer_machines Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.autoconer_machines FOR DELETE USING (true);


--
-- Name: breaker_drawing_machine_setup Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.breaker_drawing_machine_setup FOR DELETE USING (true);


--
-- Name: breaker_drawing_production_detail Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.breaker_drawing_production_detail FOR DELETE USING (true);


--
-- Name: breaker_drawing_production_header Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.breaker_drawing_production_header FOR DELETE USING (true);


--
-- Name: breaker_drawing_stoppage_entry Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.breaker_drawing_stoppage_entry FOR DELETE USING (true);


--
-- Name: carding_machine_setup Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.carding_machine_setup FOR DELETE USING (true);


--
-- Name: carding_machines Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.carding_machines FOR DELETE USING (true);


--
-- Name: carding_production_detail Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.carding_production_detail FOR DELETE USING (true);


--
-- Name: carding_production_header Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.carding_production_header FOR DELETE USING (true);


--
-- Name: carding_stoppage_entry Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.carding_stoppage_entry FOR DELETE USING (true);


--
-- Name: comber_machines Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.comber_machines FOR DELETE USING (true);


--
-- Name: drawing_breaker_machines Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.drawing_breaker_machines FOR DELETE USING (true);


--
-- Name: drawing_finisher_machines Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.drawing_finisher_machines FOR DELETE USING (true);


--
-- Name: hok_strength_detail Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.hok_strength_detail FOR DELETE USING (true);


--
-- Name: hok_strength_head Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.hok_strength_head FOR DELETE USING (true);


--
-- Name: lap_former_machine_setup Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.lap_former_machine_setup FOR DELETE USING (true);


--
-- Name: lap_former_machines Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.lap_former_machines FOR DELETE USING (true);


--
-- Name: lap_former_production_detail Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.lap_former_production_detail FOR DELETE USING (true);


--
-- Name: lap_former_production_header Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.lap_former_production_header FOR DELETE USING (true);


--
-- Name: lap_former_stoppage_entry Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.lap_former_stoppage_entry FOR DELETE USING (true);


--
-- Name: simplex_machines Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.simplex_machines FOR DELETE USING (true);


--
-- Name: spinning_counts Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.spinning_counts FOR DELETE USING (true);


--
-- Name: spinning_machines Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.spinning_machines FOR DELETE USING (true);


--
-- Name: stoppage_details Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.stoppage_details FOR DELETE USING (true);


--
-- Name: stoppage_heads Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.stoppage_heads FOR DELETE USING (true);


--
-- Name: supervisors Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.supervisors FOR DELETE USING (true);


--
-- Name: tpi_entries Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.tpi_entries FOR DELETE USING (true);


--
-- Name: twc_entries Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.twc_entries FOR DELETE USING (true);


--
-- Name: autoconer_machines Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.autoconer_machines FOR INSERT WITH CHECK (true);


--
-- Name: breaker_drawing_machine_setup Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.breaker_drawing_machine_setup FOR INSERT WITH CHECK (true);


--
-- Name: breaker_drawing_production_detail Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.breaker_drawing_production_detail FOR INSERT WITH CHECK (true);


--
-- Name: breaker_drawing_production_header Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.breaker_drawing_production_header FOR INSERT WITH CHECK (true);


--
-- Name: breaker_drawing_stoppage_entry Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.breaker_drawing_stoppage_entry FOR INSERT WITH CHECK (true);


--
-- Name: carding_machine_setup Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.carding_machine_setup FOR INSERT WITH CHECK (true);


--
-- Name: carding_machines Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.carding_machines FOR INSERT WITH CHECK (true);


--
-- Name: carding_production_detail Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.carding_production_detail FOR INSERT WITH CHECK (true);


--
-- Name: carding_production_header Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.carding_production_header FOR INSERT WITH CHECK (true);


--
-- Name: carding_stoppage_entry Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.carding_stoppage_entry FOR INSERT WITH CHECK (true);


--
-- Name: comber_machines Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.comber_machines FOR INSERT WITH CHECK (true);


--
-- Name: drawing_breaker_machines Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.drawing_breaker_machines FOR INSERT WITH CHECK (true);


--
-- Name: drawing_finisher_machines Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.drawing_finisher_machines FOR INSERT WITH CHECK (true);


--
-- Name: hok_strength_detail Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.hok_strength_detail FOR INSERT WITH CHECK (true);


--
-- Name: hok_strength_head Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.hok_strength_head FOR INSERT WITH CHECK (true);


--
-- Name: lap_former_machine_setup Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.lap_former_machine_setup FOR INSERT WITH CHECK (true);


--
-- Name: lap_former_machines Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.lap_former_machines FOR INSERT WITH CHECK (true);


--
-- Name: lap_former_production_detail Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.lap_former_production_detail FOR INSERT WITH CHECK (true);


--
-- Name: lap_former_production_header Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.lap_former_production_header FOR INSERT WITH CHECK (true);


--
-- Name: lap_former_stoppage_entry Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.lap_former_stoppage_entry FOR INSERT WITH CHECK (true);


--
-- Name: simplex_machines Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.simplex_machines FOR INSERT WITH CHECK (true);


--
-- Name: spinning_counts Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.spinning_counts FOR INSERT WITH CHECK (true);


--
-- Name: spinning_machines Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.spinning_machines FOR INSERT WITH CHECK (true);


--
-- Name: stoppage_details Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.stoppage_details FOR INSERT WITH CHECK (true);


--
-- Name: stoppage_heads Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.stoppage_heads FOR INSERT WITH CHECK (true);


--
-- Name: supervisors Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.supervisors FOR INSERT WITH CHECK (true);


--
-- Name: tpi_entries Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.tpi_entries FOR INSERT WITH CHECK (true);


--
-- Name: twc_entries Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.twc_entries FOR INSERT WITH CHECK (true);


--
-- Name: autoconer_machines Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.autoconer_machines FOR SELECT USING (true);


--
-- Name: breaker_drawing_machine_setup Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.breaker_drawing_machine_setup FOR SELECT USING (true);


--
-- Name: breaker_drawing_production_detail Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.breaker_drawing_production_detail FOR SELECT USING (true);


--
-- Name: breaker_drawing_production_header Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.breaker_drawing_production_header FOR SELECT USING (true);


--
-- Name: breaker_drawing_stoppage_entry Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.breaker_drawing_stoppage_entry FOR SELECT USING (true);


--
-- Name: carding_machine_setup Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.carding_machine_setup FOR SELECT USING (true);


--
-- Name: carding_machines Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.carding_machines FOR SELECT USING (true);


--
-- Name: carding_production_detail Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.carding_production_detail FOR SELECT USING (true);


--
-- Name: carding_production_header Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.carding_production_header FOR SELECT USING (true);


--
-- Name: carding_stoppage_entry Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.carding_stoppage_entry FOR SELECT USING (true);


--
-- Name: comber_machines Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.comber_machines FOR SELECT USING (true);


--
-- Name: departments Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.departments FOR SELECT USING (true);


--
-- Name: drawing_breaker_machines Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.drawing_breaker_machines FOR SELECT USING (true);


--
-- Name: drawing_finisher_machines Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.drawing_finisher_machines FOR SELECT USING (true);


--
-- Name: hok_strength_detail Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.hok_strength_detail FOR SELECT USING (true);


--
-- Name: hok_strength_head Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.hok_strength_head FOR SELECT USING (true);


--
-- Name: lap_former_machine_setup Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.lap_former_machine_setup FOR SELECT USING (true);


--
-- Name: lap_former_machines Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.lap_former_machines FOR SELECT USING (true);


--
-- Name: lap_former_production_detail Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.lap_former_production_detail FOR SELECT USING (true);


--
-- Name: lap_former_production_header Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.lap_former_production_header FOR SELECT USING (true);


--
-- Name: lap_former_stoppage_entry Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.lap_former_stoppage_entry FOR SELECT USING (true);


--
-- Name: simplex_machines Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.simplex_machines FOR SELECT USING (true);


--
-- Name: spinning_counts Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.spinning_counts FOR SELECT USING (true);


--
-- Name: spinning_machines Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.spinning_machines FOR SELECT USING (true);


--
-- Name: stoppage_details Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.stoppage_details FOR SELECT USING (true);


--
-- Name: stoppage_heads Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.stoppage_heads FOR SELECT USING (true);


--
-- Name: supervisors Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.supervisors FOR SELECT USING (true);


--
-- Name: tpi_entries Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.tpi_entries FOR SELECT USING (true);


--
-- Name: twc_entries Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.twc_entries FOR SELECT USING (true);


--
-- Name: autoconer_machines Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.autoconer_machines FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: breaker_drawing_machine_setup Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.breaker_drawing_machine_setup FOR UPDATE USING (true);


--
-- Name: breaker_drawing_production_detail Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.breaker_drawing_production_detail FOR UPDATE USING (true);


--
-- Name: breaker_drawing_production_header Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.breaker_drawing_production_header FOR UPDATE USING (true);


--
-- Name: breaker_drawing_stoppage_entry Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.breaker_drawing_stoppage_entry FOR UPDATE USING (true);


--
-- Name: carding_machine_setup Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.carding_machine_setup FOR UPDATE USING (true);


--
-- Name: carding_machines Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.carding_machines FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: carding_production_detail Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.carding_production_detail FOR UPDATE USING (true);


--
-- Name: carding_production_header Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.carding_production_header FOR UPDATE USING (true);


--
-- Name: carding_stoppage_entry Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.carding_stoppage_entry FOR UPDATE USING (true);


--
-- Name: comber_machines Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.comber_machines FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: drawing_breaker_machines Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.drawing_breaker_machines FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: drawing_finisher_machines Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.drawing_finisher_machines FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: hok_strength_detail Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.hok_strength_detail FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: hok_strength_head Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.hok_strength_head FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: lap_former_machine_setup Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.lap_former_machine_setup FOR UPDATE USING (true);


--
-- Name: lap_former_machines Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.lap_former_machines FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: lap_former_production_detail Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.lap_former_production_detail FOR UPDATE USING (true);


--
-- Name: lap_former_production_header Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.lap_former_production_header FOR UPDATE USING (true);


--
-- Name: lap_former_stoppage_entry Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.lap_former_stoppage_entry FOR UPDATE USING (true);


--
-- Name: simplex_machines Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.simplex_machines FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: spinning_counts Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.spinning_counts FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: spinning_machines Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.spinning_machines FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: stoppage_details Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.stoppage_details FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: stoppage_heads Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.stoppage_heads FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: supervisors Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.supervisors FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: tpi_entries Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.tpi_entries FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: twc_entries Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.twc_entries FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: autoconer_machines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.autoconer_machines ENABLE ROW LEVEL SECURITY;

--
-- Name: breaker_drawing_machine_setup; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.breaker_drawing_machine_setup ENABLE ROW LEVEL SECURITY;

--
-- Name: breaker_drawing_production_detail; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.breaker_drawing_production_detail ENABLE ROW LEVEL SECURITY;

--
-- Name: breaker_drawing_production_header; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.breaker_drawing_production_header ENABLE ROW LEVEL SECURITY;

--
-- Name: breaker_drawing_stoppage_entry; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.breaker_drawing_stoppage_entry ENABLE ROW LEVEL SECURITY;

--
-- Name: carding_machine_setup; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.carding_machine_setup ENABLE ROW LEVEL SECURITY;

--
-- Name: carding_machines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.carding_machines ENABLE ROW LEVEL SECURITY;

--
-- Name: carding_production_detail; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.carding_production_detail ENABLE ROW LEVEL SECURITY;

--
-- Name: carding_production_header; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.carding_production_header ENABLE ROW LEVEL SECURITY;

--
-- Name: carding_stoppage_entry; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.carding_stoppage_entry ENABLE ROW LEVEL SECURITY;

--
-- Name: comber_machines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comber_machines ENABLE ROW LEVEL SECURITY;

--
-- Name: departments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

--
-- Name: drawing_breaker_machines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.drawing_breaker_machines ENABLE ROW LEVEL SECURITY;

--
-- Name: drawing_finisher_machines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.drawing_finisher_machines ENABLE ROW LEVEL SECURITY;

--
-- Name: hok_strength_detail; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hok_strength_detail ENABLE ROW LEVEL SECURITY;

--
-- Name: hok_strength_head; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hok_strength_head ENABLE ROW LEVEL SECURITY;

--
-- Name: lap_former_machine_setup; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lap_former_machine_setup ENABLE ROW LEVEL SECURITY;

--
-- Name: lap_former_machines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lap_former_machines ENABLE ROW LEVEL SECURITY;

--
-- Name: lap_former_production_detail; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lap_former_production_detail ENABLE ROW LEVEL SECURITY;

--
-- Name: lap_former_production_header; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lap_former_production_header ENABLE ROW LEVEL SECURITY;

--
-- Name: lap_former_stoppage_entry; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lap_former_stoppage_entry ENABLE ROW LEVEL SECURITY;

--
-- Name: simplex_machines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.simplex_machines ENABLE ROW LEVEL SECURITY;

--
-- Name: spinning_counts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.spinning_counts ENABLE ROW LEVEL SECURITY;

--
-- Name: spinning_machines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.spinning_machines ENABLE ROW LEVEL SECURITY;

--
-- Name: stoppage_details; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stoppage_details ENABLE ROW LEVEL SECURITY;

--
-- Name: stoppage_heads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stoppage_heads ENABLE ROW LEVEL SECURITY;

--
-- Name: supervisors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.supervisors ENABLE ROW LEVEL SECURITY;

--
-- Name: tpi_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tpi_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: twc_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.twc_entries ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict bqHCrOIKoX6ZcNDk0t9ZgHB6VtgzitOceXNutw8XVDzKmbeXo87nZiJ9KM7joXu

