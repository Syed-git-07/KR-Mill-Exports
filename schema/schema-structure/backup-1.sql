--
-- PostgreSQL database dump
--

\restrict YdHV1XhSYp5Cb0Ii5z0u4OJeQKeRYQTRWc492S4yOTeF2FEnbtcnJA1SzteXlgj

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

-- Started on 2025-12-25 23:08:19

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

--
-- TOC entry 85 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- TOC entry 4583 (class 0 OID 0)
-- Dependencies: 85
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- TOC entry 518 (class 1255 OID 45423)
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
-- TOC entry 517 (class 1255 OID 45422)
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
-- TOC entry 516 (class 1255 OID 45421)
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
-- TOC entry 519 (class 1255 OID 45424)
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
-- TOC entry 520 (class 1255 OID 45425)
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
-- TOC entry 512 (class 1255 OID 41800)
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
-- TOC entry 513 (class 1255 OID 41801)
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
-- TOC entry 511 (class 1255 OID 41799)
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
-- TOC entry 515 (class 1255 OID 42910)
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
-- TOC entry 4584 (class 0 OID 0)
-- Dependencies: 515
-- Name: FUNCTION get_breaker_drawing_available_dates(p_before_date date, p_shift integer, p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_breaker_drawing_available_dates(p_before_date date, p_shift integer, p_limit integer) IS 'Returns list of previous dates that have production data for the specified shift. 
   Used by Copy Previous Data feature to show available dates to copy from.';


--
-- TOC entry 521 (class 1255 OID 45426)
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
-- TOC entry 514 (class 1255 OID 41802)
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
-- TOC entry 510 (class 1255 OID 17921)
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
-- TOC entry 345 (class 1259 OID 17854)
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
-- TOC entry 379 (class 1259 OID 40615)
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
-- TOC entry 377 (class 1259 OID 40539)
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
-- TOC entry 376 (class 1259 OID 40510)
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
-- TOC entry 375 (class 1259 OID 40509)
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
-- TOC entry 4585 (class 0 OID 0)
-- Dependencies: 375
-- Name: breaker_drawing_production_header_entry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.breaker_drawing_production_header_entry_id_seq OWNED BY public.breaker_drawing_production_header.entry_id;


--
-- TOC entry 378 (class 1259 OID 40573)
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
-- TOC entry 374 (class 1259 OID 40466)
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
-- TOC entry 363 (class 1259 OID 29023)
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
-- TOC entry 372 (class 1259 OID 40390)
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
-- TOC entry 371 (class 1259 OID 40361)
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
-- TOC entry 370 (class 1259 OID 40360)
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
-- TOC entry 4586 (class 0 OID 0)
-- Dependencies: 370
-- Name: carding_production_header_entry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.carding_production_header_entry_id_seq OWNED BY public.carding_production_header.entry_id;


--
-- TOC entry 373 (class 1259 OID 40424)
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
-- TOC entry 365 (class 1259 OID 29119)
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
-- TOC entry 340 (class 1259 OID 17744)
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
-- TOC entry 364 (class 1259 OID 29070)
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
-- TOC entry 366 (class 1259 OID 29168)
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
-- TOC entry 355 (class 1259 OID 20674)
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
-- TOC entry 351 (class 1259 OID 17991)
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
-- TOC entry 350 (class 1259 OID 17990)
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
-- TOC entry 4587 (class 0 OID 0)
-- Dependencies: 350
-- Name: hok_strength_detail_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hok_strength_detail_id_seq OWNED BY public.hok_strength_detail.id;


--
-- TOC entry 348 (class 1259 OID 17976)
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
-- TOC entry 349 (class 1259 OID 17988)
-- Name: hok_strength_head_hok_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hok_strength_head_hok_id_seq
    START WITH 1150
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4588 (class 0 OID 0)
-- Dependencies: 349
-- Name: hok_strength_head_hok_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hok_strength_head_hok_id_seq OWNED BY public.hok_strength_head.hok_id;


--
-- TOC entry 384 (class 1259 OID 45389)
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
-- TOC entry 368 (class 1259 OID 29264)
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
-- TOC entry 382 (class 1259 OID 45305)
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
-- TOC entry 381 (class 1259 OID 45271)
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
-- TOC entry 380 (class 1259 OID 45270)
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
-- TOC entry 4589 (class 0 OID 0)
-- Dependencies: 380
-- Name: lap_former_production_header_entry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lap_former_production_header_entry_id_seq OWNED BY public.lap_former_production_header.entry_id;


--
-- TOC entry 383 (class 1259 OID 45343)
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
-- TOC entry 367 (class 1259 OID 29214)
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
-- TOC entry 354 (class 1259 OID 18320)
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
-- TOC entry 341 (class 1259 OID 17758)
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
-- TOC entry 343 (class 1259 OID 17786)
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
-- TOC entry 353 (class 1259 OID 18148)
-- Name: stoppage_details_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stoppage_details_code_seq
    START WITH 1447
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 342 (class 1259 OID 17773)
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
-- TOC entry 352 (class 1259 OID 18118)
-- Name: stoppage_heads_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stoppage_heads_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 356 (class 1259 OID 20756)
-- Name: supervisors_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supervisors_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 344 (class 1259 OID 17836)
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
-- TOC entry 359 (class 1259 OID 27651)
-- Name: tpi_entries_entry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tpi_entries_entry_id_seq
    START WITH 66
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 346 (class 1259 OID 17869)
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
-- TOC entry 361 (class 1259 OID 27680)
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
-- TOC entry 360 (class 1259 OID 27662)
-- Name: twc_entries_entry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.twc_entries_entry_id_seq
    START WITH 770
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 347 (class 1259 OID 17890)
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
-- TOC entry 362 (class 1259 OID 27685)
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
-- TOC entry 3892 (class 2604 OID 40514)
-- Name: breaker_drawing_production_header entry_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_production_header ALTER COLUMN entry_id SET DEFAULT nextval('public.breaker_drawing_production_header_entry_id_seq'::regclass);


--
-- TOC entry 3851 (class 2604 OID 40365)
-- Name: carding_production_header entry_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_production_header ALTER COLUMN entry_id SET DEFAULT nextval('public.carding_production_header_entry_id_seq'::regclass);


--
-- TOC entry 3786 (class 2604 OID 17994)
-- Name: hok_strength_detail id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hok_strength_detail ALTER COLUMN id SET DEFAULT nextval('public.hok_strength_detail_id_seq'::regclass);


--
-- TOC entry 3780 (class 2604 OID 17989)
-- Name: hok_strength_head hok_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hok_strength_head ALTER COLUMN hok_id SET DEFAULT nextval('public.hok_strength_head_hok_id_seq'::regclass);


--
-- TOC entry 3934 (class 2604 OID 45275)
-- Name: lap_former_production_header entry_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_production_header ALTER COLUMN entry_id SET DEFAULT nextval('public.lap_former_production_header_entry_id_seq'::regclass);


--
-- TOC entry 4544 (class 0 OID 17854)
-- Dependencies: 345
-- Data for Name: autoconer_machines; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.autoconer_machines VALUES ('f4f997c7-84ad-4663-bad8-8abe52ee84b1', 'AC5-1', 'AC5-1', 'MURT', 80, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 2, 5, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('92811cb2-c787-48d5-b8c8-f054e28f8da1', 'AC5-2', 'AC5-2', 'MURT', 80, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 3, 5, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('cc34e0e3-e063-4686-8ce9-167f3a2603f4', 'AC5-3', 'AC5-3', 'MURT', 80, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 4, 5, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('4054071d-5164-42e9-99f1-53ce36338793', 'AC5-4', 'AC5-4', 'MURT', 80, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 5, 5, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('2f7855ce-5613-41be-9590-22decb7b86c4', 'AC5-5', 'AC5-5', 'MURT', 80, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 6, 5, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('e67ed36e-d5f5-4ee3-8609-2b25dcfbf5d4', 'AC6-1', 'AC6-1', 'MURT', 82, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 7, 6, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('9c4039b9-0ea4-41ed-8571-02022b1b097e', 'AC6-2', 'AC6-2', 'MURT', 0, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 8, 6, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('597eab2a-cd85-4a6c-87ca-df4fc88050ad', 'AC6-3', 'AC6-3', 'MURT', 0, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 9, 6, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('1e055561-0579-4731-b920-2e6f067f43f5', 'AC6-4', 'AC6-4', 'MURT', 0, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 10, 6, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('4efb4a17-e557-4c2c-bf08-174aef27c1ef', 'AC6-5', 'AC6-5', 'MURT', 0, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 11, 6, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('2361c36c-70c1-4bbc-9485-a7a1bf9fab3f', 'AC7-1', 'AC7-1', 'MURT', 0, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 12, 7, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('99f94f5d-42b5-468a-a9f3-c7dc6c43b213', 'AC7-2', 'AC7-2', 'MURT', 0, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 13, 7, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('ac8d02c9-b3af-4398-8445-bb654fc711c7', 'AC7-3', 'AC7-3', 'MURT', 0, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 14, 7, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('8426f290-c9f9-402a-9c18-32067c780e63', 'AC7-4', 'AC7-4', 'MURT', 0, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 15, 7, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('55e0bc1d-a689-4fd3-a9e6-dde1632572ab', 'AC7-5', 'AC7-5', 'MURT', 0, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 16, 7, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('e9d34967-e9df-4ea8-8867-4920c89ccba7', 'AC8-1', 'AC8-1', 'MURT', 0, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 17, 8, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('cf6ffebf-0207-4714-8fd7-23f8d631af04', 'AC8-2', 'AC8-2', 'MURT', 0, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 18, 8, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('6a585a45-458b-4bbd-9f63-9cf8f9ba2326', 'AC8-3', 'AC8-3', 'MURT', 0, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 19, 8, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('15830416-1ac9-4c33-8d58-35ab6dd78af3', 'AC8-4', 'AC8-4', 'MURT', 0, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 20, 8, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('3d269db2-c95d-40b2-b3d0-79e459567c66', 'AC8-5', 'AC8-5', 'MURT', 0, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 21, 8, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('453f14b7-aa19-4e58-baf9-4058de34a084', 'AC9-1', 'AC9-1', 'MURT', 0, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 22, 9, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('e9a3b7b4-6032-4b25-91fe-585c82296c9f', 'AC9-2', 'AC9-2', 'MURT', 0, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 23, 9, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('e61ec588-75d7-438e-b8d3-8128708d3dbe', 'AC10-1', 'AC10-1', 'MURT', 0, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 24, 10, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('3297a034-6361-42f8-b039-ab26765af19a', 'AC10-2', 'AC10-2', 'MURT', 0, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 25, 10, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('21540f73-3f47-4b7c-9fe6-dd309a788d22', 'AC11-1', 'AC11-1', 'MURT', 0, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 26, 11, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('d0881cc5-704d-411e-b89a-0581714f310d', 'AC11-2', 'AC11-2', 'MURT', 0, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 27, 11, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('998f1d5c-2fe0-42c5-a56e-939360d3afd4', 'AC12-1', 'AC12-1', 'MURT', 82, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 28, 12, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('edbe528d-0996-4acc-b35a-6a6c380223be', 'AC12-2', 'AC12-2', 'MURT', 0, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 29, 12, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('5148dbfd-08d5-40da-b59f-42c0c0261f6f', 'AC13-1', 'AC13-1', 'MURT', 82, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 30, 13, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('c0940fd9-8a71-4656-b7ca-3f06956d2d83', 'AC13-2', 'AC13-2', 'MURT', 82, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 31, 13, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('5672257a-9c1c-4e89-a5c1-5e14f274ba65', 'AC14-1', 'AC14-1', 'MURT', 0, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 32, 14, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('7d8da535-87e8-44c9-829e-fd01a0be5ad3', 'AC2A-1', 'AC2A-1', 'MURT', 0, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 33, 2, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('b1ccdd97-6c13-4011-b4b7-02aa6c429e66', 'AC2A-2', 'AC2A-2', 'MURT', 0, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:27:38.543777+00', 34, 2, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);
INSERT INTO public.autoconer_machines VALUES ('923bc705-8cef-4e5a-8a2d-bd2a03a68274', 'AC4-5', 'AC4-5', 'MURT', 0, true, '2025-12-01 07:27:38.543777+00', '2025-12-01 07:31:14.305495+00', 1, 4, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);


--
-- TOC entry 4572 (class 0 OID 40615)
-- Dependencies: 379
-- Data for Name: breaker_drawing_machine_setup; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.breaker_drawing_machine_setup VALUES ('9b41737f-cacf-4313-bc62-3011a9029eba', '04175809-14ff-4561-af30-0f64d99e96d2', 450, 0.1400, 0.8500, 0.8500, 1646.06, 510, 0, 1693, 2, '2025-12-21 17:22:40.699282+00', '2025-12-22 19:16:11.796091+00');
INSERT INTO public.breaker_drawing_machine_setup VALUES ('67ff7de7-0bc1-41a3-a06e-ad6249f94814', 'd8a3d833-5c1f-4f79-9af9-1137ed6e5e3f', 750, 0.1400, 0.8500, 0.8500, 1371.72, 510, 0, 1693, 1, '2025-12-21 17:22:40.699282+00', '2025-12-22 19:16:11.796091+00');
INSERT INTO public.breaker_drawing_machine_setup VALUES ('7039ba4a-4ad0-41a1-9bd7-36c21a620ab5', '2a41a68b-aee8-4e72-ac3d-7c6e7b10cf93', 750, 0.1400, 0.8500, 0.8500, 1371.72, 510, 0, 1693, 1, '2025-12-21 17:22:40.699282+00', '2025-12-22 19:16:11.796091+00');
INSERT INTO public.breaker_drawing_machine_setup VALUES ('de7552cc-2bc8-459b-bfc1-302939d2ab2c', '50e18753-c89e-49a4-9822-19f04f1dda56', 750, 0.1400, 0.8500, 0.8500, 1371.72, 510, 0, 1693, 1, '2025-12-21 17:22:40.699282+00', '2025-12-22 19:16:11.796091+00');


--
-- TOC entry 4570 (class 0 OID 40539)
-- Dependencies: 377
-- Data for Name: breaker_drawing_production_detail; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.breaker_drawing_production_detail VALUES ('01ad9989-8f22-4df4-a8b6-234add2a1b65', 'f6bedc54-48fc-42bb-9535-306cdd76c4ac', '04175809-14ff-4561-af30-0f64d99e96d2', 'MURUGESWARI. M', '64COMBED GOLD', 133.36, 864.20, 1646.06, 871.44, 99.17, 52.94, 0.8500, 0.1000, 510, 270, 1, false, NULL, '2025-12-22 18:56:14.847938+00', '2025-12-22 18:56:14.847938+00');
INSERT INTO public.breaker_drawing_production_detail VALUES ('f52dbf00-bf7d-43dc-9774-183cd7d471b5', 'f6bedc54-48fc-42bb-9535-306cdd76c4ac', 'd8a3d833-5c1f-4f79-9af9-1137ed6e5e3f', 'MURUGESWARI. M', '64COMBED GOLD', 213.50, 691.77, 1371.72, 699.11, 98.95, 50.98, 0.8500, 0.1200, 510, 260, 1, false, NULL, '2025-12-22 18:56:14.847938+00', '2025-12-22 18:56:14.847938+00');
INSERT INTO public.breaker_drawing_production_detail VALUES ('7b218549-7d9a-4865-a9a1-232150e3bf6b', 'f6bedc54-48fc-42bb-9535-306cdd76c4ac', '2a41a68b-aee8-4e72-ac3d-7c6e7b10cf93', 'MURUGESWARI. M', '64COMBED GOLD', 341.91, 1107.83, 1371.72, 1102.51, 100.48, 80.39, 0.8500, 0.0800, 510, 410, 1, false, NULL, '2025-12-22 18:56:14.847938+00', '2025-12-22 18:56:14.847938+00');
INSERT INTO public.breaker_drawing_production_detail VALUES ('4912068c-7eae-4c68-9b59-99d8a2943224', 'f6bedc54-48fc-42bb-9535-306cdd76c4ac', '50e18753-c89e-49a4-9822-19f04f1dda56', 'GANDHIMATHI K', '64COMBED GOLD', 307.04, 994.85, 1371.72, 995.22, 99.96, 72.55, 0.8500, 0.0900, 510, 370, 1, false, NULL, '2025-12-22 18:56:14.847938+00', '2025-12-22 18:56:14.847938+00');
INSERT INTO public.breaker_drawing_production_detail VALUES ('056f224c-b13c-404d-a989-9e72023b078a', 'c8c8cbc1-60eb-48f8-aaf5-2b7395de9dec', 'd8a3d833-5c1f-4f79-9af9-1137ed6e5e3f', 'MURUGESWARI. M', '64COMBED GOLD', 213.50, 691.77, 1371.72, 699.31, 98.92, 50.98, 0.8500, 0.1200, 510, 260, 1, false, NULL, '2025-12-22 19:16:11.796091+00', '2025-12-25 07:16:47.026258+00');
INSERT INTO public.breaker_drawing_production_detail VALUES ('6d6b2135-7ac4-4ac3-bcaf-3ed9d555da43', '33a28209-5f5c-4ceb-bd6a-70131e2f059e', '04175809-14ff-4561-af30-0f64d99e96d2', 'MURUGESWARI. M', '64', 133.36, 864.20, 1646.06, 871.44, 99.17, 52.94, 0.8500, 0.1000, 510, 270, 1, false, NULL, '2025-12-22 17:54:33.460719+00', '2025-12-22 17:54:33.460719+00');
INSERT INTO public.breaker_drawing_production_detail VALUES ('84182350-c06a-48c7-9619-bbb19a37e0e4', '33a28209-5f5c-4ceb-bd6a-70131e2f059e', 'd8a3d833-5c1f-4f79-9af9-1137ed6e5e3f', 'MURUGESWARI. M', '64', 213.50, 691.77, 1371.72, 699.31, 98.92, 50.98, 0.8500, 0.1200, 510, 260, 1, false, NULL, '2025-12-22 17:54:33.460719+00', '2025-12-22 17:54:33.460719+00');
INSERT INTO public.breaker_drawing_production_detail VALUES ('64a7cdf0-a5c3-479a-b7c3-772bea465b6c', '33a28209-5f5c-4ceb-bd6a-70131e2f059e', '2a41a68b-aee8-4e72-ac3d-7c6e7b10cf93', 'MURUGESWARI. M', '64', 341.91, 1107.83, 1371.72, 1102.76, 100.46, 80.39, 0.8500, 0.0800, 510, 410, 1, false, NULL, '2025-12-22 17:54:33.460719+00', '2025-12-22 17:54:33.460719+00');
INSERT INTO public.breaker_drawing_production_detail VALUES ('9adf657d-e98a-49ce-9715-8b2310054c06', '33a28209-5f5c-4ceb-bd6a-70131e2f059e', '50e18753-c89e-49a4-9822-19f04f1dda56', 'GANDHIMATHI K', '64', 307.04, 994.85, 1371.72, 995.17, 99.97, 72.55, 0.8500, 0.0900, 510, 370, 1, false, NULL, '2025-12-22 17:54:33.460719+00', '2025-12-22 17:54:33.460719+00');
INSERT INTO public.breaker_drawing_production_detail VALUES ('2c87d9b9-39e9-49d5-83b1-b1880bd7a7b7', 'c8c8cbc1-60eb-48f8-aaf5-2b7395de9dec', '04175809-14ff-4561-af30-0f64d99e96d2', 'MURUGESWARI. M', '64COMBED GOLD', 133.36, 864.20, 1646.06, 871.45, 99.17, 52.94, 0.8500, 0.1000, 510, 270, 1, false, NULL, '2025-12-22 19:16:11.796091+00', '2025-12-25 07:16:47.026387+00');
INSERT INTO public.breaker_drawing_production_detail VALUES ('5c4c6b0f-7a2d-45de-b162-a125ed27ada3', 'c8c8cbc1-60eb-48f8-aaf5-2b7395de9dec', '2a41a68b-aee8-4e72-ac3d-7c6e7b10cf93', 'MURUGESWARI. M', '64COMBED GOLD', 341.91, 1107.83, 1371.72, 1102.76, 100.46, 80.39, 0.8500, 0.0800, 510, 410, 1, false, NULL, '2025-12-22 19:16:11.796091+00', '2025-12-25 07:16:47.032973+00');
INSERT INTO public.breaker_drawing_production_detail VALUES ('406cd014-c3ff-4e37-83f6-12be7bf370da', 'c8c8cbc1-60eb-48f8-aaf5-2b7395de9dec', '50e18753-c89e-49a4-9822-19f04f1dda56', 'GANDHIMATHI K', '64COMBED GOLD', 307.04, 994.85, 1371.72, 995.17, 99.97, 72.55, 0.8500, 0.0900, 510, 370, 1, false, NULL, '2025-12-22 19:16:11.796091+00', '2025-12-25 07:16:47.062415+00');
INSERT INTO public.breaker_drawing_production_detail VALUES ('309e6421-7209-446f-9cf9-8046e0939883', '3c706814-2f44-4c33-a966-7072deef418c', 'd8a3d833-5c1f-4f79-9af9-1137ed6e5e3f', 'MURUGESWARI. M', '64COMBED GOLD', 213.50, 691.77, 1371.72, 699.31, 98.92, 50.98, 0.8500, 0.1200, 510, 260, 1, false, NULL, '2025-12-25 07:15:40.233336+00', '2025-12-25 07:17:08.714457+00');
INSERT INTO public.breaker_drawing_production_detail VALUES ('37bd2efc-97d8-412f-9de5-e2f63b9ed87b', '3c706814-2f44-4c33-a966-7072deef418c', '04175809-14ff-4561-af30-0f64d99e96d2', 'MURUGESWARI. M', '64COMBED GOLD', 133.36, 864.20, 1646.06, 871.45, 99.17, 52.94, 0.8500, 0.1000, 510, 270, 1, false, NULL, '2025-12-25 07:15:40.233336+00', '2025-12-25 07:17:08.716071+00');
INSERT INTO public.breaker_drawing_production_detail VALUES ('2dc15133-326a-4a4b-865e-e1007f868711', '3c706814-2f44-4c33-a966-7072deef418c', '2a41a68b-aee8-4e72-ac3d-7c6e7b10cf93', 'MURUGESWARI. M', '64COMBED GOLD', 341.91, 1107.83, 1371.72, 1102.76, 100.46, 80.39, 0.8500, 0.0800, 510, 410, 1, false, NULL, '2025-12-25 07:15:40.233336+00', '2025-12-25 07:17:08.714769+00');
INSERT INTO public.breaker_drawing_production_detail VALUES ('23805205-bce3-4bd1-9997-038b321d86ac', '80ca3135-bc4b-46ba-8c0a-18ad3e86d89b', '04175809-14ff-4561-af30-0f64d99e96d2', 'MURUGESWARI. M', '64COMBED GOLD', 133.36, 864.20, 1646.06, 871.45, 99.17, 52.94, 0.8500, 0.1000, 510, 270, 1, false, NULL, '2025-12-22 19:16:11.796091+00', '2025-12-22 19:40:31.526011+00');
INSERT INTO public.breaker_drawing_production_detail VALUES ('71f6f4d9-ca86-420e-9bed-5a2b0841b474', '3c706814-2f44-4c33-a966-7072deef418c', '50e18753-c89e-49a4-9822-19f04f1dda56', 'GANDHIMATHI K', '64COMBED GOLD', 307.04, 994.85, 1371.72, 995.17, 99.97, 72.55, 0.8500, 0.0900, 510, 370, 1, false, NULL, '2025-12-25 07:15:40.233336+00', '2025-12-25 07:17:08.71816+00');
INSERT INTO public.breaker_drawing_production_detail VALUES ('2bb8c886-d5ef-4f98-9d32-79242c4b0e9b', '80ca3135-bc4b-46ba-8c0a-18ad3e86d89b', '50e18753-c89e-49a4-9822-19f04f1dda56', 'GANDHIMATHI K', '64COMBED GOLD', 307.04, 994.85, 1371.72, 995.17, 99.97, 72.55, 0.8500, 0.0900, 510, 370, 1, false, NULL, '2025-12-22 19:16:11.796091+00', '2025-12-22 19:40:51.333327+00');
INSERT INTO public.breaker_drawing_production_detail VALUES ('32683e0b-6530-422c-9772-571cb1a9ce2d', '80ca3135-bc4b-46ba-8c0a-18ad3e86d89b', 'd8a3d833-5c1f-4f79-9af9-1137ed6e5e3f', 'MURUGESWARI. M', '64COMBED GOLD', 213.50, 691.77, 1371.72, 699.31, 98.92, 50.98, 0.8500, 0.1200, 510, 260, 1, false, NULL, '2025-12-22 19:16:11.796091+00', '2025-12-22 19:40:51.336033+00');
INSERT INTO public.breaker_drawing_production_detail VALUES ('d919f839-adc6-454a-89ed-e1af609b245b', '80ca3135-bc4b-46ba-8c0a-18ad3e86d89b', '2a41a68b-aee8-4e72-ac3d-7c6e7b10cf93', 'MURUGESWARI. M', '64COMBED GOLD', 341.91, 1107.83, 1371.72, 1102.76, 100.46, 80.39, 0.8500, 0.0800, 510, 410, 1, false, NULL, '2025-12-22 19:16:11.796091+00', '2025-12-22 19:40:51.337478+00');
INSERT INTO public.breaker_drawing_production_detail VALUES ('7e58535c-12a1-4b85-9203-f1d9364e044a', '2936c7eb-5f6e-426a-a442-54818eba1524', '04175809-14ff-4561-af30-0f64d99e96d2', NULL, '64COMBED GOLD', 0.00, 0.00, 1646.06, 1387.86, 0.00, 84.31, 0.8500, 0.0000, 510, 430, 1, false, NULL, '2025-12-25 07:15:32.526043+00', '2025-12-25 07:15:32.526043+00');
INSERT INTO public.breaker_drawing_production_detail VALUES ('2914d2b4-a5d3-4764-a6b5-656f6c5b7654', '2936c7eb-5f6e-426a-a442-54818eba1524', 'd8a3d833-5c1f-4f79-9af9-1137ed6e5e3f', NULL, '64COMBED GOLD', 0.00, 0.00, 1371.72, 1156.55, 0.00, 84.31, 0.8500, 0.0000, 510, 430, 1, false, NULL, '2025-12-25 07:15:32.526043+00', '2025-12-25 07:15:32.526043+00');
INSERT INTO public.breaker_drawing_production_detail VALUES ('85a8a676-4dff-4e87-9128-e2384ee454bb', '2936c7eb-5f6e-426a-a442-54818eba1524', '2a41a68b-aee8-4e72-ac3d-7c6e7b10cf93', NULL, '64COMBED GOLD', 0.00, 0.00, 1371.72, 1156.55, 0.00, 84.31, 0.8500, 0.0000, 510, 430, 1, false, NULL, '2025-12-25 07:15:32.526043+00', '2025-12-25 07:15:32.526043+00');
INSERT INTO public.breaker_drawing_production_detail VALUES ('06bf2b8f-ebc2-44e8-a54c-b4741d965b17', '2936c7eb-5f6e-426a-a442-54818eba1524', '50e18753-c89e-49a4-9822-19f04f1dda56', NULL, '64COMBED GOLD', 0.00, 0.00, 1371.72, 1156.55, 0.00, 84.31, 0.8500, 0.0000, 510, 430, 1, false, NULL, '2025-12-25 07:15:32.526043+00', '2025-12-25 07:15:32.526043+00');


--
-- TOC entry 4569 (class 0 OID 40510)
-- Dependencies: 376
-- Data for Name: breaker_drawing_production_header; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.breaker_drawing_production_header VALUES ('33a28209-5f5c-4ceb-bd6a-70131e2f059e', 4, '2025-04-22', 1, '087b99d0-7531-40c3-b301-ba5afe9047c4', NULL, 510, 'Sample data with dynamic calculations from machine speed', false, '2025-12-22 17:54:33.460719+00', '2025-12-22 17:54:33.460719+00');
INSERT INTO public.breaker_drawing_production_header VALUES ('f6bedc54-48fc-42bb-9535-306cdd76c4ac', 8, '2025-12-21', 1, NULL, NULL, 510, 'VB6 Sample Data', false, '2025-12-22 18:56:14.847938+00', '2025-12-22 18:56:14.847938+00');
INSERT INTO public.breaker_drawing_production_header VALUES ('c8c8cbc1-60eb-48f8-aaf5-2b7395de9dec', 9, '2025-12-22', 1, NULL, NULL, 510, 'VB6 Reference Data', false, '2025-12-22 19:16:11.796091+00', '2025-12-22 19:16:11.796091+00');
INSERT INTO public.breaker_drawing_production_header VALUES ('80ca3135-bc4b-46ba-8c0a-18ad3e86d89b', 10, '2025-12-23', 1, '5495cef5-e47d-42b3-88bc-cbba412fbbe4', NULL, 510, 'VB6 Reference Data - Today', false, '2025-12-22 19:16:11.796091+00', '2025-12-22 19:40:14.139231+00');
INSERT INTO public.breaker_drawing_production_header VALUES ('2936c7eb-5f6e-426a-a442-54818eba1524', 11, '2025-12-24', 1, NULL, NULL, 510, NULL, false, '2025-12-25 07:15:32.055013+00', '2025-12-25 07:15:32.055013+00');
INSERT INTO public.breaker_drawing_production_header VALUES ('3c706814-2f44-4c33-a966-7072deef418c', 12, '2025-12-25', 1, '5495cef5-e47d-42b3-88bc-cbba412fbbe4', NULL, 510, NULL, false, '2025-12-25 07:15:39.963918+00', '2025-12-25 07:17:31.894106+00');


--
-- TOC entry 4571 (class 0 OID 40573)
-- Dependencies: 378
-- Data for Name: breaker_drawing_stoppage_entry; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.breaker_drawing_stoppage_entry VALUES ('32764ac7-ec0e-49ec-93b5-23aea5f56fd9', '6d6b2135-7ac4-4ac3-bcaf-3ed9d555da43', '9be428ba-5d34-436c-9865-b7a86ec4f3ad', 160, 'a9d151ca-4604-4444-93ee-becc9e682a2e', 60, '87adb281-c290-4a01-af48-43aeb6b94360', 20, NULL, 0, 240, false, '2025-12-22 17:54:33.460719+00', '2025-12-22 17:54:33.460719+00');
INSERT INTO public.breaker_drawing_stoppage_entry VALUES ('b6b8c2ef-e707-435e-a2c9-82c39176478a', '84182350-c06a-48c7-9619-bbb19a37e0e4', '9be428ba-5d34-436c-9865-b7a86ec4f3ad', 170, 'a9d151ca-4604-4444-93ee-becc9e682a2e', 60, '87adb281-c290-4a01-af48-43aeb6b94360', 20, NULL, 0, 250, false, '2025-12-22 17:54:33.460719+00', '2025-12-22 17:54:33.460719+00');
INSERT INTO public.breaker_drawing_stoppage_entry VALUES ('f463896c-65d7-456b-951a-6e575271bb1f', '64a7cdf0-a5c3-479a-b7c3-772bea465b6c', '9be428ba-5d34-436c-9865-b7a86ec4f3ad', 20, 'a9d151ca-4604-4444-93ee-becc9e682a2e', 60, '87adb281-c290-4a01-af48-43aeb6b94360', 20, NULL, 0, 100, false, '2025-12-22 17:54:33.460719+00', '2025-12-22 17:54:33.460719+00');
INSERT INTO public.breaker_drawing_stoppage_entry VALUES ('48e65249-11fc-4d13-a738-c1991977d3d7', '9adf657d-e98a-49ce-9715-8b2310054c06', '9be428ba-5d34-436c-9865-b7a86ec4f3ad', 60, 'a9d151ca-4604-4444-93ee-becc9e682a2e', 60, '87adb281-c290-4a01-af48-43aeb6b94360', 20, NULL, 0, 140, false, '2025-12-22 17:54:33.460719+00', '2025-12-22 17:54:33.460719+00');
INSERT INTO public.breaker_drawing_stoppage_entry VALUES ('39e76fcc-7589-4324-96ba-31ee9e1c5b3c', '01ad9989-8f22-4df4-a8b6-234add2a1b65', NULL, 160, NULL, 60, NULL, 20, NULL, 0, 240, false, '2025-12-22 18:56:14.847938+00', '2025-12-22 18:56:14.847938+00');
INSERT INTO public.breaker_drawing_stoppage_entry VALUES ('b30c5d80-63ea-4ff3-991a-783e31d89c54', 'f52dbf00-bf7d-43dc-9774-183cd7d471b5', NULL, 170, NULL, 60, NULL, 20, NULL, 0, 250, false, '2025-12-22 18:56:14.847938+00', '2025-12-22 18:56:14.847938+00');
INSERT INTO public.breaker_drawing_stoppage_entry VALUES ('d5b7f68f-4d0f-4ebc-9b29-d16eac7268b6', '7b218549-7d9a-4865-a9a1-232150e3bf6b', NULL, 20, NULL, 60, NULL, 20, NULL, 0, 100, false, '2025-12-22 18:56:14.847938+00', '2025-12-22 18:56:14.847938+00');
INSERT INTO public.breaker_drawing_stoppage_entry VALUES ('b6c51f94-e86d-45da-9aa9-0fa44dbc5c83', '4912068c-7eae-4c68-9b59-99d8a2943224', NULL, 60, NULL, 60, NULL, 20, NULL, 0, 140, false, '2025-12-22 18:56:14.847938+00', '2025-12-22 18:56:14.847938+00');
INSERT INTO public.breaker_drawing_stoppage_entry VALUES ('433190de-46f2-4c1e-a96a-54e2b215fd79', '23805205-bce3-4bd1-9997-038b321d86ac', '4fd9331d-fc4c-40d3-ad72-d210750a687b', 160, '4fd9331d-fc4c-40d3-ad72-d210750a687b', 60, 'bbc061d2-87d8-4d45-b222-a20855d3ef3f', 20, NULL, 0, 20, false, '2025-12-22 19:16:11.796091+00', '2025-12-22 19:40:31.377667+00');
INSERT INTO public.breaker_drawing_stoppage_entry VALUES ('381595a7-3a2e-4343-b1f7-9547df091d00', '2bb8c886-d5ef-4f98-9d32-79242c4b0e9b', '4fd9331d-fc4c-40d3-ad72-d210750a687b', 60, '4fd9331d-fc4c-40d3-ad72-d210750a687b', 60, 'bbc061d2-87d8-4d45-b222-a20855d3ef3f', 20, NULL, 0, 20, false, '2025-12-22 19:16:11.796091+00', '2025-12-22 19:40:50.938674+00');
INSERT INTO public.breaker_drawing_stoppage_entry VALUES ('e76f9c03-ad93-4a9f-9fa2-5e98fa72b125', '32683e0b-6530-422c-9772-571cb1a9ce2d', '4fd9331d-fc4c-40d3-ad72-d210750a687b', 170, '4fd9331d-fc4c-40d3-ad72-d210750a687b', 60, 'bbc061d2-87d8-4d45-b222-a20855d3ef3f', 20, NULL, 0, 20, false, '2025-12-22 19:16:11.796091+00', '2025-12-22 19:40:50.939478+00');
INSERT INTO public.breaker_drawing_stoppage_entry VALUES ('be8bd31a-af0e-4b79-9c32-deb93ce2636b', 'd919f839-adc6-454a-89ed-e1af609b245b', '4fd9331d-fc4c-40d3-ad72-d210750a687b', 20, '4fd9331d-fc4c-40d3-ad72-d210750a687b', 60, 'bbc061d2-87d8-4d45-b222-a20855d3ef3f', 20, NULL, 0, 20, false, '2025-12-22 19:16:11.796091+00', '2025-12-22 19:40:50.9524+00');
INSERT INTO public.breaker_drawing_stoppage_entry VALUES ('ee581ca6-77d3-4bda-a52b-95fbe835555b', '7e58535c-12a1-4b85-9203-f1d9364e044a', 'a9d151ca-4604-4444-93ee-becc9e682a2e', 60, '87adb281-c290-4a01-af48-43aeb6b94360', 20, NULL, 0, NULL, 0, 80, false, '2025-12-25 07:15:32.807957+00', '2025-12-25 07:15:32.807957+00');
INSERT INTO public.breaker_drawing_stoppage_entry VALUES ('f1489fdb-04f3-4334-b822-c5d28d7a60d6', '2914d2b4-a5d3-4764-a6b5-656f6c5b7654', 'a9d151ca-4604-4444-93ee-becc9e682a2e', 60, '87adb281-c290-4a01-af48-43aeb6b94360', 20, NULL, 0, NULL, 0, 80, false, '2025-12-25 07:15:32.807957+00', '2025-12-25 07:15:32.807957+00');
INSERT INTO public.breaker_drawing_stoppage_entry VALUES ('64274044-e45d-45d3-b728-bf82f72400f5', '85a8a676-4dff-4e87-9128-e2384ee454bb', 'a9d151ca-4604-4444-93ee-becc9e682a2e', 60, '87adb281-c290-4a01-af48-43aeb6b94360', 20, NULL, 0, NULL, 0, 80, false, '2025-12-25 07:15:32.807957+00', '2025-12-25 07:15:32.807957+00');
INSERT INTO public.breaker_drawing_stoppage_entry VALUES ('1c33d7c7-5f93-4e28-b643-fc76769cc623', '06bf2b8f-ebc2-44e8-a54c-b4741d965b17', 'a9d151ca-4604-4444-93ee-becc9e682a2e', 60, '87adb281-c290-4a01-af48-43aeb6b94360', 20, NULL, 0, NULL, 0, 80, false, '2025-12-25 07:15:32.807957+00', '2025-12-25 07:15:32.807957+00');
INSERT INTO public.breaker_drawing_stoppage_entry VALUES ('4503d237-231e-422e-8179-e0573da11e14', '5c4c6b0f-7a2d-45de-b162-a125ed27ada3', '4fd9331d-fc4c-40d3-ad72-d210750a687b', 20, '4fd9331d-fc4c-40d3-ad72-d210750a687b', 60, 'a9d151ca-4604-4444-93ee-becc9e682a2e', 20, NULL, 0, 0, false, '2025-12-22 19:16:11.796091+00', '2025-12-25 07:16:46.886799+00');
INSERT INTO public.breaker_drawing_stoppage_entry VALUES ('5e75de69-1b3a-4d4c-bcfe-09c0ef534a50', '056f224c-b13c-404d-a989-9e72023b078a', '4fd9331d-fc4c-40d3-ad72-d210750a687b', 170, '4fd9331d-fc4c-40d3-ad72-d210750a687b', 60, 'a9d151ca-4604-4444-93ee-becc9e682a2e', 20, NULL, 0, 0, false, '2025-12-22 19:16:11.796091+00', '2025-12-25 07:16:46.883587+00');
INSERT INTO public.breaker_drawing_stoppage_entry VALUES ('c0d09442-8a74-4510-bc3a-f47baacf5f03', '2c87d9b9-39e9-49d5-83b1-b1880bd7a7b7', 'c8d3cd98-726c-467d-a4e1-6ce883a5e190', 160, '4fd9331d-fc4c-40d3-ad72-d210750a687b', 60, 'a9d151ca-4604-4444-93ee-becc9e682a2e', 20, NULL, 0, 0, false, '2025-12-22 19:16:11.796091+00', '2025-12-25 07:16:46.896195+00');
INSERT INTO public.breaker_drawing_stoppage_entry VALUES ('a2d03d7a-b6cf-41a1-8108-8827c5deee80', '406cd014-c3ff-4e37-83f6-12be7bf370da', '4fd9331d-fc4c-40d3-ad72-d210750a687b', 60, '4fd9331d-fc4c-40d3-ad72-d210750a687b', 60, 'a9d151ca-4604-4444-93ee-becc9e682a2e', 20, NULL, 0, 0, false, '2025-12-22 19:16:11.796091+00', '2025-12-25 07:16:46.896709+00');
INSERT INTO public.breaker_drawing_stoppage_entry VALUES ('cbe96e07-66aa-4245-ba7d-29032b79f5f3', '71f6f4d9-ca86-420e-9bed-5a2b0841b474', '4fd9331d-fc4c-40d3-ad72-d210750a687b', 60, '4fd9331d-fc4c-40d3-ad72-d210750a687b', 60, 'a9d151ca-4604-4444-93ee-becc9e682a2e', 20, NULL, 0, 0, false, '2025-12-25 07:15:40.407231+00', '2025-12-25 07:17:08.923428+00');
INSERT INTO public.breaker_drawing_stoppage_entry VALUES ('98170a6a-fcfc-482a-bece-d1aa5ca61306', '309e6421-7209-446f-9cf9-8046e0939883', '4fd9331d-fc4c-40d3-ad72-d210750a687b', 170, '4fd9331d-fc4c-40d3-ad72-d210750a687b', 60, 'a9d151ca-4604-4444-93ee-becc9e682a2e', 20, NULL, 0, 0, false, '2025-12-25 07:15:40.407231+00', '2025-12-25 07:17:08.924994+00');
INSERT INTO public.breaker_drawing_stoppage_entry VALUES ('b026d5c8-2d84-42d6-a46c-8cbf7bd71c5d', '37bd2efc-97d8-412f-9de5-e2f63b9ed87b', 'c8d3cd98-726c-467d-a4e1-6ce883a5e190', 160, '4fd9331d-fc4c-40d3-ad72-d210750a687b', 60, 'a9d151ca-4604-4444-93ee-becc9e682a2e', 20, NULL, 0, 0, false, '2025-12-25 07:15:40.407231+00', '2025-12-25 07:17:08.924688+00');
INSERT INTO public.breaker_drawing_stoppage_entry VALUES ('255bf9fd-1544-46ba-bc04-47aea21b2610', '2dc15133-326a-4a4b-865e-e1007f868711', '4fd9331d-fc4c-40d3-ad72-d210750a687b', 20, '4fd9331d-fc4c-40d3-ad72-d210750a687b', 60, 'a9d151ca-4604-4444-93ee-becc9e682a2e', 20, NULL, 0, 0, false, '2025-12-25 07:15:40.407231+00', '2025-12-25 07:17:08.927385+00');


--
-- TOC entry 4567 (class 0 OID 40466)
-- Dependencies: 374
-- Data for Name: carding_machine_setup; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.carding_machine_setup VALUES ('02ae185c-cde5-4780-91ec-ed6140d5920c', '8e921d7a-bfa6-41e4-b80c-4bd1bef57a3f', 130.00, 0.1300, 0.9800, 0.3400, 295.22, 510, 135, 1693, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00');
INSERT INTO public.carding_machine_setup VALUES ('1b211352-c55e-4b0a-a6c1-89242852b78f', '9e3990a1-a1b7-45af-8689-52b72ab17251', 130.00, 0.1300, 0.9800, 0.3400, 295.22, 510, 135, 1693, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00');
INSERT INTO public.carding_machine_setup VALUES ('d2fd05c6-1ffe-4255-b89d-1cb17a05b223', 'befa01c3-504c-4979-9fc8-ac78217bfc63', 130.00, 0.1300, 0.9800, 0.3400, 295.22, 510, 135, 1693, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00');
INSERT INTO public.carding_machine_setup VALUES ('27f4163e-6f13-468b-9559-ece5c3e9ba38', '18bd492e-189c-42a9-a456-093164fd0d56', 130.00, 0.1300, 0.9800, 0.3400, 295.22, 510, 135, 1693, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00');
INSERT INTO public.carding_machine_setup VALUES ('1c4944a4-adbe-4609-834e-70fb0029c93e', '4c7b3ff2-50ae-4ba4-8ad7-b647cff6f64f', 130.00, 0.1300, 0.9800, 0.3400, 295.22, 510, 135, 1693, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00');
INSERT INTO public.carding_machine_setup VALUES ('04368c28-b2dd-4d9f-addd-6d4dd46f390a', 'bfd513ca-7dd6-48d1-8803-99f4e91b7426', 130.00, 0.1300, 0.9800, 0.3400, 295.22, 510, 135, 1693, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00');
INSERT INTO public.carding_machine_setup VALUES ('b11ca53c-8320-4e81-ad60-fc0a69adf338', '809d0a5d-c906-4d4d-852a-a06df97a5634', 130.00, 0.1300, 0.9800, 0.3400, 295.22, 510, 135, 1693, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00');
INSERT INTO public.carding_machine_setup VALUES ('1158b0f8-0043-4a5f-91da-83d557f2aa56', 'b906b0c9-c939-4aec-8610-c29781600abb', 130.00, 0.1300, 0.9800, 0.3400, 295.22, 510, 135, 1693, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00');
INSERT INTO public.carding_machine_setup VALUES ('1855eda6-4791-41e0-8ace-255cbc8d1f49', '42b3a66c-3dbd-4112-94ce-52029f610ae9', 130.00, 0.1300, 0.9800, 0.3400, 295.22, 510, 135, 1693, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00');
INSERT INTO public.carding_machine_setup VALUES ('a544efec-4d1e-46c1-9539-56539a2d9ede', '34ba610d-c324-450f-8644-72c624341f87', 130.00, 0.1300, 0.9800, 0.3400, 295.22, 510, 135, 1693, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00');
INSERT INTO public.carding_machine_setup VALUES ('351ff32d-e18d-4158-896f-03b30487e31a', '9c6c98e3-8493-45c5-963a-7976895de8c2', 130.00, 0.1300, 0.9800, 0.3400, 295.22, 510, 135, 1693, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00');
INSERT INTO public.carding_machine_setup VALUES ('8b115234-6010-42d1-9dd5-fc3e5cf40750', '9005c5ac-7aba-47cc-a55f-9aa0a9b20e22', 130.00, 0.1300, 0.9800, 0.3400, 295.22, 510, 135, 1693, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00');
INSERT INTO public.carding_machine_setup VALUES ('57fd3c5f-0b05-40f1-aa52-6c6f59c91588', 'bb596c3f-dfcf-4612-a07e-128ef80eccbc', 130.00, 0.1300, 0.9800, 0.3400, 295.22, 510, 135, 1693, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00');
INSERT INTO public.carding_machine_setup VALUES ('647c6f6b-495c-43ef-98e5-168be74488cd', '5dc7db19-f9e8-4a48-9f6f-3f9485a3cc4b', 130.00, 0.1300, 0.9800, 0.3400, 295.22, 510, 135, 1693, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00');
INSERT INTO public.carding_machine_setup VALUES ('322c7af0-cabd-468a-a17f-d95fe94cc07f', 'd04278a8-d1b6-42a5-9fbf-08ea44f9c61e', 130.00, 0.1300, 0.9800, 0.3400, 295.22, 510, 135, 1693, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00');
INSERT INTO public.carding_machine_setup VALUES ('d17c0d41-3d8e-4c9d-ada6-b84ec92407aa', '7cd1f492-fc9e-4f95-acde-6f8d2c24626e', 130.00, 0.1300, 0.9800, 0.3400, 295.22, 510, 135, 1693, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00');
INSERT INTO public.carding_machine_setup VALUES ('0261359a-368c-4989-85e7-d5d1872c18ce', '667c4d31-7922-4f4f-aac1-28bf06bfba0c', 130.00, 0.1300, 0.9800, 0.3400, 295.22, 510, 135, 1693, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00');
INSERT INTO public.carding_machine_setup VALUES ('ddbff5c7-69d6-4a76-baaa-6a8957591539', '4b22c0d5-e8f9-4091-9cc4-06db30b5255f', 130.00, 0.1300, 0.9800, 0.3400, 295.22, 510, 135, 1693, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00');
INSERT INTO public.carding_machine_setup VALUES ('9447e2fe-a161-44e9-9c8c-ffc3c2567a76', '1d422dc3-69ee-4ff5-ae78-240d1f5fa597', 130.00, 0.1300, 0.9800, 0.3400, 295.22, 510, 135, 1693, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00');
INSERT INTO public.carding_machine_setup VALUES ('f6227c75-a0fd-471f-bb12-c94f96e31da2', 'bbc60c94-192e-4f7e-84d6-61a41b4e84ef', 130.00, 0.1300, 0.9800, 0.3400, 295.22, 510, 135, 1693, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00');
INSERT INTO public.carding_machine_setup VALUES ('29e817f2-3ff5-4074-a1fc-2683490213bc', '12739da8-5065-44d9-9fac-5b3f5400509d', 130.00, 0.1300, 0.9800, 0.3400, 295.22, 510, 135, 1693, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00');
INSERT INTO public.carding_machine_setup VALUES ('5d63ca8b-3451-4b3c-9b14-5a0909656e8c', '5747fc0e-ec51-4b90-82f5-bd20938df3a5', 130.00, 0.1300, 0.9800, 0.3400, 295.22, 510, 135, 1693, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00');


--
-- TOC entry 4557 (class 0 OID 29023)
-- Dependencies: 363
-- Data for Name: carding_machines; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.carding_machines VALUES ('8e921d7a-bfa6-41e4-b80c-4bd1bef57a3f', 'CA2', 'CA2', NULL, 2, 'LC300A', NULL, NULL, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:15:46.205097+00', '2025-12-02 16:15:46.205097+00');
INSERT INTO public.carding_machines VALUES ('9e3990a1-a1b7-45af-8689-52b72ab17251', 'CA3', 'CA3', NULL, 3, 'LC300A', NULL, NULL, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:15:46.205097+00', '2025-12-02 16:15:46.205097+00');
INSERT INTO public.carding_machines VALUES ('befa01c3-504c-4979-9fc8-ac78217bfc63', 'CA4', 'CA4', NULL, 4, 'LC300A', NULL, NULL, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:15:46.205097+00', '2025-12-02 16:15:46.205097+00');
INSERT INTO public.carding_machines VALUES ('18bd492e-189c-42a9-a456-093164fd0d56', 'CA5', 'CA5', NULL, 5, 'LC300A', NULL, NULL, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:15:46.205097+00', '2025-12-02 16:15:46.205097+00');
INSERT INTO public.carding_machines VALUES ('4c7b3ff2-50ae-4ba4-8ad7-b647cff6f64f', 'CA6', 'CA6', NULL, 6, 'LC300A', NULL, NULL, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:15:46.205097+00', '2025-12-02 16:15:46.205097+00');
INSERT INTO public.carding_machines VALUES ('bfd513ca-7dd6-48d1-8803-99f4e91b7426', 'CA7', 'CA7', NULL, 7, 'LC300A', NULL, NULL, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:15:46.205097+00', '2025-12-02 16:15:46.205097+00');
INSERT INTO public.carding_machines VALUES ('809d0a5d-c906-4d4d-852a-a06df97a5634', 'CA8', 'CA8', NULL, 8, 'LC300A V3', NULL, NULL, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:15:46.205097+00', '2025-12-02 16:15:46.205097+00');
INSERT INTO public.carding_machines VALUES ('b906b0c9-c939-4aec-8610-c29781600abb', 'CA9', 'CA9', NULL, 9, 'LC300A V3', NULL, NULL, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:15:46.205097+00', '2025-12-02 16:15:46.205097+00');
INSERT INTO public.carding_machines VALUES ('42b3a66c-3dbd-4112-94ce-52029f610ae9', 'CA10', 'CA10', NULL, 10, 'LC300A V3', NULL, NULL, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:15:46.205097+00', '2025-12-02 16:15:46.205097+00');
INSERT INTO public.carding_machines VALUES ('34ba610d-c324-450f-8644-72c624341f87', 'CA11', 'CA11', NULL, 11, 'LC300A', NULL, NULL, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:15:46.205097+00', '2025-12-02 16:15:46.205097+00');
INSERT INTO public.carding_machines VALUES ('9c6c98e3-8493-45c5-963a-7976895de8c2', 'CA12', 'CA12', NULL, 12, 'LC300A', NULL, NULL, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:15:46.205097+00', '2025-12-02 16:15:46.205097+00');
INSERT INTO public.carding_machines VALUES ('9005c5ac-7aba-47cc-a55f-9aa0a9b20e22', 'CA13', 'CA13', NULL, 13, 'LC300A', NULL, NULL, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:15:46.205097+00', '2025-12-02 16:15:46.205097+00');
INSERT INTO public.carding_machines VALUES ('bb596c3f-dfcf-4612-a07e-128ef80eccbc', 'CA14', 'CA14', NULL, 14, 'LC300A V3', NULL, NULL, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:15:46.205097+00', '2025-12-02 16:15:46.205097+00');
INSERT INTO public.carding_machines VALUES ('5dc7db19-f9e8-4a48-9f6f-3f9485a3cc4b', 'CA15', 'CA15', NULL, 15, 'LC300A V3', NULL, NULL, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:15:46.205097+00', '2025-12-02 16:15:46.205097+00');
INSERT INTO public.carding_machines VALUES ('d04278a8-d1b6-42a5-9fbf-08ea44f9c61e', 'CA16', 'CA16', NULL, 16, 'LC300A V3', NULL, NULL, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:15:46.205097+00', '2025-12-02 16:15:46.205097+00');
INSERT INTO public.carding_machines VALUES ('7cd1f492-fc9e-4f95-acde-6f8d2c24626e', 'CA17', 'CA17', NULL, 17, 'LC300A V3', NULL, NULL, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:15:46.205097+00', '2025-12-02 16:15:46.205097+00');
INSERT INTO public.carding_machines VALUES ('667c4d31-7922-4f4f-aac1-28bf06bfba0c', 'CA18', 'CA18', NULL, 18, 'LC300A V3', NULL, NULL, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:15:46.205097+00', '2025-12-02 16:15:46.205097+00');
INSERT INTO public.carding_machines VALUES ('4b22c0d5-e8f9-4091-9cc4-06db30b5255f', 'CA19', 'CA19', NULL, 19, 'LC300A V3', NULL, NULL, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:15:46.205097+00', '2025-12-02 16:15:46.205097+00');
INSERT INTO public.carding_machines VALUES ('1d422dc3-69ee-4ff5-ae78-240d1f5fa597', 'CA20', 'CA20', NULL, 20, 'LC300A V3', NULL, NULL, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:15:46.205097+00', '2025-12-02 16:15:46.205097+00');
INSERT INTO public.carding_machines VALUES ('bbc60c94-192e-4f7e-84d6-61a41b4e84ef', 'CA21', 'CA21', NULL, 21, 'LC300AV3', NULL, NULL, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:15:46.205097+00', '2025-12-02 16:15:46.205097+00');
INSERT INTO public.carding_machines VALUES ('12739da8-5065-44d9-9fac-5b3f5400509d', 'CA22', 'CA22', NULL, 22, 'LC300AV3', NULL, NULL, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:15:46.205097+00', '2025-12-02 16:15:46.205097+00');
INSERT INTO public.carding_machines VALUES ('5747fc0e-ec51-4b90-82f5-bd20938df3a5', 'CA1', 'CA1', NULL, 1, 'LC300A', NULL, 0, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:15:46.205097+00', '2025-12-02 16:49:11.599699+00');


--
-- TOC entry 4565 (class 0 OID 40390)
-- Dependencies: 372
-- Data for Name: carding_production_detail; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.carding_production_detail VALUES ('8da680ca-589d-4770-9e7d-adffbc8e7f9d', 'c02c0da4-f960-4d29-b3f3-184e6151dec0', '5747fc0e-ec51-4b90-82f5-bd20938df3a5', 'SANKARESWARI G', '64COMBED GOLD', 64.72, 225.82, 0.00, 217.07, 104.03, 73.53, 0.3400, 0.1506, 375, 375, 1, false, NULL, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:29:25.993203+00');
INSERT INTO public.carding_production_detail VALUES ('2dd9cab4-a26f-4e30-8201-79db28c8cd4d', 'c02c0da4-f960-4d29-b3f3-184e6151dec0', '8e921d7a-bfa6-41e4-b80c-4bd1bef57a3f', 'SANKARESWARI G', '64COMBED GOLD', 62.05, 216.49, 0.00, 217.07, 99.73, 73.53, 0.3400, 0.1571, 375, 375, 1, false, NULL, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:29:25.993203+00');
INSERT INTO public.carding_production_detail VALUES ('13532517-82e4-454d-b93c-a1fd7f36ee92', 'c02c0da4-f960-4d29-b3f3-184e6151dec0', '9e3990a1-a1b7-45af-8689-52b72ab17251', 'SANKARESWARI G', '64COMBED GOLD', 63.64, 222.05, 0.00, 217.07, 102.29, 73.53, 0.3400, 0.1531, 375, 375, 1, false, NULL, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:29:25.993203+00');
INSERT INTO public.carding_production_detail VALUES ('94dd7f8e-19f0-4b69-9a42-ebeadc945bfe', 'c02c0da4-f960-4d29-b3f3-184e6151dec0', 'befa01c3-504c-4979-9fc8-ac78217bfc63', 'SANKARESWARI G', '64COMBED GOLD', 63.49, 221.52, 0.00, 217.07, 102.05, 73.53, 0.3400, 0.1535, 375, 375, 1, false, NULL, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:29:25.993203+00');
INSERT INTO public.carding_production_detail VALUES ('c620d617-3fb0-4297-b173-45dfd4a09fb7', 'c02c0da4-f960-4d29-b3f3-184e6151dec0', '18bd492e-189c-42a9-a456-093164fd0d56', 'SANKARESWARI G', '64COMBED GOLD', 60.93, 212.58, 0.00, 217.07, 97.93, 73.53, 0.3400, 0.1599, 375, 375, 1, false, NULL, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:29:25.993203+00');
INSERT INTO public.carding_production_detail VALUES ('bf86ea38-db96-45b4-9ea0-82a0f0e0dbf3', 'c02c0da4-f960-4d29-b3f3-184e6151dec0', '4c7b3ff2-50ae-4ba4-8ad7-b647cff6f64f', 'SANKARESWARI G', '64COMBED GOLD', 62.98, 219.75, 0.00, 217.07, 101.23, 73.53, 0.3400, 0.1547, 375, 375, 1, false, NULL, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:29:25.993203+00');
INSERT INTO public.carding_production_detail VALUES ('45e79007-76b2-48dd-aed7-185e0aa2759e', 'c02c0da4-f960-4d29-b3f3-184e6151dec0', 'bfd513ca-7dd6-48d1-8803-99f4e91b7426', 'SANKARESWARI G', '64COMBED GOLD', 62.31, 217.40, 0.00, 217.07, 100.15, 73.53, 0.3400, 0.1564, 375, 375, 1, false, NULL, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:29:25.993203+00');
INSERT INTO public.carding_production_detail VALUES ('19d57dd0-0823-4d1e-a33d-39a6386a5683', 'c02c0da4-f960-4d29-b3f3-184e6151dec0', '809d0a5d-c906-4d4d-852a-a06df97a5634', 'SANKARESWARI G', '64COMBED GOLD', 10.37, 36.18, 0.00, 43.41, 83.34, 14.71, 0.3400, 0.9397, 75, 75, 1, false, NULL, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:29:25.993203+00');
INSERT INTO public.carding_production_detail VALUES ('af50b0c0-0053-440a-91f8-f15cdd8d62e6', 'c02c0da4-f960-4d29-b3f3-184e6151dec0', 'b906b0c9-c939-4aec-8610-c29781600abb', 'SANKARESWARI G', '64COMBED GOLD', 40.58, 141.60, 0.00, 217.07, 65.23, 73.53, 0.3400, 0.2401, 375, 375, 1, false, NULL, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:29:25.993203+00');
INSERT INTO public.carding_production_detail VALUES ('b0039709-6e2a-4e1d-a10c-f46f1c29c443', 'c02c0da4-f960-4d29-b3f3-184e6151dec0', '42b3a66c-3dbd-4112-94ce-52029f610ae9', 'SANKARESWARI G', '64COMBED GOLD', 42.02, 146.62, 0.00, 217.07, 67.55, 73.53, 0.3400, 0.2319, 375, 375, 1, false, NULL, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:29:25.993203+00');
INSERT INTO public.carding_production_detail VALUES ('c74acef4-2006-4091-83e6-6fbff01c054e', 'c02c0da4-f960-4d29-b3f3-184e6151dec0', '34ba610d-c324-450f-8644-72c624341f87', 'SANKARESWARI G', '64COMBED GOLD', 60.61, 196.37, 0.00, 208.39, 94.23, 70.59, 0.3400, 0.1731, 360, 360, 1, false, NULL, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:29:25.993203+00');
INSERT INTO public.carding_production_detail VALUES ('738fb9e4-45d1-4311-ae0c-25332f0ad069', 'c02c0da4-f960-4d29-b3f3-184e6151dec0', '9c6c98e3-8493-45c5-963a-7976895de8c2', 'SANKARESWARI G', '64COMBED GOLD', 52.90, 171.40, 0.00, 208.39, 82.25, 70.59, 0.3400, 0.1984, 360, 360, 1, false, NULL, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:29:25.993203+00');
INSERT INTO public.carding_production_detail VALUES ('76452ab8-b525-42d6-9a8b-e9bfadaa3d24', 'c02c0da4-f960-4d29-b3f3-184e6151dec0', '9005c5ac-7aba-47cc-a55f-9aa0a9b20e22', 'SANKARESWARI G', '64COMBED GOLD', 60.04, 209.48, 0.00, 208.39, 100.52, 70.59, 0.3400, 0.1623, 360, 360, 1, false, NULL, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:29:25.993203+00');
INSERT INTO public.carding_production_detail VALUES ('8ce89c21-16c5-4a03-971e-9b4801384dc4', 'c02c0da4-f960-4d29-b3f3-184e6151dec0', 'bb596c3f-dfcf-4612-a07e-128ef80eccbc', 'SANKARESWARI G', '64COMBED GOLD', 58.48, 204.05, 0.00, 208.39, 97.92, 70.59, 0.3400, 0.1666, 360, 360, 1, false, NULL, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:29:25.993203+00');
INSERT INTO public.carding_production_detail VALUES ('652719c0-87e4-400a-afaa-f78cb655a559', 'c02c0da4-f960-4d29-b3f3-184e6151dec0', '5dc7db19-f9e8-4a48-9f6f-3f9485a3cc4b', 'SANKARESWARI G', '64COMBED GOLD', 50.99, 177.89, 0.00, 179.44, 99.14, 60.78, 0.3400, 0.1911, 310, 310, 1, false, NULL, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:29:25.993203+00');
INSERT INTO public.carding_production_detail VALUES ('cfd3f61e-1252-43b5-b29d-2789020d9198', 'c02c0da4-f960-4d29-b3f3-184e6151dec0', 'd04278a8-d1b6-42a5-9fbf-08ea44f9c61e', 'SANKARESWARI G', '64COMBED GOLD', 50.30, 175.51, 0.00, 179.44, 97.81, 60.78, 0.3400, 0.1937, 310, 310, 1, false, NULL, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:29:25.993203+00');
INSERT INTO public.carding_production_detail VALUES ('9222d85f-b8f4-4f8b-ba01-6595a47e1d6e', 'c02c0da4-f960-4d29-b3f3-184e6151dec0', '7cd1f492-fc9e-4f95-acde-6f8d2c24626e', 'SANKARESWARI G', '64COMBED GOLD', 52.16, 169.01, 0.00, 167.87, 100.68, 56.86, 0.3400, 0.2012, 290, 290, 1, false, NULL, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:29:25.993203+00');
INSERT INTO public.carding_production_detail VALUES ('d6e4743b-f2ef-4911-bc13-3626592748c2', 'c02c0da4-f960-4d29-b3f3-184e6151dec0', '667c4d31-7922-4f4f-aac1-28bf06bfba0c', 'SANKARESWARI G', '64COMBED GOLD', 61.48, 216.49, 0.00, 217.07, 99.73, 73.53, 0.3400, 0.1571, 375, 375, 1, false, NULL, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:29:25.993203+00');
INSERT INTO public.carding_production_detail VALUES ('20f8845b-beee-40c7-868b-059cf04b3611', 'c02c0da4-f960-4d29-b3f3-184e6151dec0', '4b22c0d5-e8f9-4091-9cc4-06db30b5255f', 'SANKARESWARI G', '64COMBED GOLD', 62.59, 228.56, 0.00, 217.07, 105.29, 73.53, 0.3400, 0.1488, 375, 375, 1, false, NULL, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:29:25.993203+00');
INSERT INTO public.carding_production_detail VALUES ('caad3820-e2ce-40b8-b9d7-fdde2ce84a97', 'c02c0da4-f960-4d29-b3f3-184e6151dec0', '1d422dc3-69ee-4ff5-ae78-240d1f5fa597', 'SANKARESWARI G', '64COMBED GOLD', 63.24, 227.81, 0.00, 217.07, 104.95, 73.53, 0.3400, 0.1492, 375, 375, 1, false, NULL, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:29:25.993203+00');
INSERT INTO public.carding_production_detail VALUES ('b4c52c3c-e2c4-452f-ab09-db75575b7d1c', 'c02c0da4-f960-4d29-b3f3-184e6151dec0', 'bbc60c94-192e-4f7e-84d6-61a41b4e84ef', 'SANKARESWARI G', '64COMBED GOLD', 60.86, 214.06, 0.00, 217.07, 98.61, 73.53, 0.3400, 0.1588, 375, 375, 1, false, NULL, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:29:25.993203+00');
INSERT INTO public.carding_production_detail VALUES ('e23a091c-d2fe-429b-b4f7-75db55984246', 'c02c0da4-f960-4d29-b3f3-184e6151dec0', '12739da8-5065-44d9-9fac-5b3f5400509d', 'SANKARESWARI G', '64COMBED GOLD', 61.40, 225.84, 0.00, 217.07, 104.04, 73.53, 0.3400, 0.1505, 375, 375, 1, false, NULL, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:29:25.993203+00');
INSERT INTO public.carding_production_detail VALUES ('9ed9db27-1331-4249-b323-ccdcf5a346e6', '0e0bc967-8013-4ce4-ad98-86c969d77ea9', '5747fc0e-ec51-4b90-82f5-bd20938df3a5', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-22 20:00:10.336842+00', '2025-12-22 20:00:10.336842+00');
INSERT INTO public.carding_production_detail VALUES ('29a76898-f3b5-436f-9363-05291a76dd89', '0e0bc967-8013-4ce4-ad98-86c969d77ea9', '8e921d7a-bfa6-41e4-b80c-4bd1bef57a3f', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-22 20:00:10.336842+00', '2025-12-22 20:00:10.336842+00');
INSERT INTO public.carding_production_detail VALUES ('10bf25aa-b359-4b0e-ae63-c6f8a3d3af05', '0e0bc967-8013-4ce4-ad98-86c969d77ea9', '9e3990a1-a1b7-45af-8689-52b72ab17251', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-22 20:00:10.336842+00', '2025-12-22 20:00:10.336842+00');
INSERT INTO public.carding_production_detail VALUES ('9b6bd49d-53aa-4c77-a571-432447fed9e9', '0e0bc967-8013-4ce4-ad98-86c969d77ea9', 'befa01c3-504c-4979-9fc8-ac78217bfc63', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-22 20:00:10.336842+00', '2025-12-22 20:00:10.336842+00');
INSERT INTO public.carding_production_detail VALUES ('288fb73f-0676-42e7-9408-dcef2e1dc31b', '0e0bc967-8013-4ce4-ad98-86c969d77ea9', '18bd492e-189c-42a9-a456-093164fd0d56', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-22 20:00:10.336842+00', '2025-12-22 20:00:10.336842+00');
INSERT INTO public.carding_production_detail VALUES ('66967bf7-d6d4-4f06-9901-67053e999b8d', '0e0bc967-8013-4ce4-ad98-86c969d77ea9', '4c7b3ff2-50ae-4ba4-8ad7-b647cff6f64f', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-22 20:00:10.336842+00', '2025-12-22 20:00:10.336842+00');
INSERT INTO public.carding_production_detail VALUES ('d9e591b9-f4db-4599-a891-eae8b96982b5', '0e0bc967-8013-4ce4-ad98-86c969d77ea9', 'bfd513ca-7dd6-48d1-8803-99f4e91b7426', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-22 20:00:10.336842+00', '2025-12-22 20:00:10.336842+00');
INSERT INTO public.carding_production_detail VALUES ('c2215459-4da6-482c-a766-cb985c993498', '0e0bc967-8013-4ce4-ad98-86c969d77ea9', '809d0a5d-c906-4d4d-852a-a06df97a5634', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-22 20:00:10.336842+00', '2025-12-22 20:00:10.336842+00');
INSERT INTO public.carding_production_detail VALUES ('c137651f-c09a-4b9f-af61-59f210dc7082', '0e0bc967-8013-4ce4-ad98-86c969d77ea9', 'b906b0c9-c939-4aec-8610-c29781600abb', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-22 20:00:10.336842+00', '2025-12-22 20:00:10.336842+00');
INSERT INTO public.carding_production_detail VALUES ('68272cb1-00b3-4ac0-a392-5b4c304a3dd7', '0e0bc967-8013-4ce4-ad98-86c969d77ea9', '42b3a66c-3dbd-4112-94ce-52029f610ae9', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-22 20:00:10.336842+00', '2025-12-22 20:00:10.336842+00');
INSERT INTO public.carding_production_detail VALUES ('c82a7a51-00c9-41df-8124-57cd103e871a', '0e0bc967-8013-4ce4-ad98-86c969d77ea9', '34ba610d-c324-450f-8644-72c624341f87', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-22 20:00:10.336842+00', '2025-12-22 20:00:10.336842+00');
INSERT INTO public.carding_production_detail VALUES ('80e8fef0-af38-4f6b-9a81-1863c9740eae', '0e0bc967-8013-4ce4-ad98-86c969d77ea9', '9c6c98e3-8493-45c5-963a-7976895de8c2', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-22 20:00:10.336842+00', '2025-12-22 20:00:10.336842+00');
INSERT INTO public.carding_production_detail VALUES ('b68676c9-7519-42e8-84f5-9b769a38ef3f', '0e0bc967-8013-4ce4-ad98-86c969d77ea9', '9005c5ac-7aba-47cc-a55f-9aa0a9b20e22', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-22 20:00:10.336842+00', '2025-12-22 20:00:10.336842+00');
INSERT INTO public.carding_production_detail VALUES ('12ae551a-b12a-4869-93e4-bf6ec4bec6c8', '0e0bc967-8013-4ce4-ad98-86c969d77ea9', 'bb596c3f-dfcf-4612-a07e-128ef80eccbc', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-22 20:00:10.336842+00', '2025-12-22 20:00:10.336842+00');
INSERT INTO public.carding_production_detail VALUES ('9bdf2c6e-e248-4423-9626-a0187ff0d209', '0e0bc967-8013-4ce4-ad98-86c969d77ea9', '5dc7db19-f9e8-4a48-9f6f-3f9485a3cc4b', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-22 20:00:10.336842+00', '2025-12-22 20:00:10.336842+00');
INSERT INTO public.carding_production_detail VALUES ('ad125f47-3054-4b57-8bd7-02bc17cdbdea', '0e0bc967-8013-4ce4-ad98-86c969d77ea9', 'd04278a8-d1b6-42a5-9fbf-08ea44f9c61e', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-22 20:00:10.336842+00', '2025-12-22 20:00:10.336842+00');
INSERT INTO public.carding_production_detail VALUES ('88bffa29-3e16-4e1e-aa1f-52434049ca35', '0e0bc967-8013-4ce4-ad98-86c969d77ea9', '7cd1f492-fc9e-4f95-acde-6f8d2c24626e', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-22 20:00:10.336842+00', '2025-12-22 20:00:10.336842+00');
INSERT INTO public.carding_production_detail VALUES ('9882a19b-90ce-47d2-8bdf-54cd12d23946', '0e0bc967-8013-4ce4-ad98-86c969d77ea9', '667c4d31-7922-4f4f-aac1-28bf06bfba0c', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-22 20:00:10.336842+00', '2025-12-22 20:00:10.336842+00');
INSERT INTO public.carding_production_detail VALUES ('0a67e88a-afa5-4272-b927-c05e695ace5b', '0e0bc967-8013-4ce4-ad98-86c969d77ea9', '4b22c0d5-e8f9-4091-9cc4-06db30b5255f', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-22 20:00:10.336842+00', '2025-12-22 20:00:10.336842+00');
INSERT INTO public.carding_production_detail VALUES ('ad3ef7ee-6af3-4fa5-b327-fc85e7bd023f', '0e0bc967-8013-4ce4-ad98-86c969d77ea9', '1d422dc3-69ee-4ff5-ae78-240d1f5fa597', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-22 20:00:10.336842+00', '2025-12-22 20:00:10.336842+00');
INSERT INTO public.carding_production_detail VALUES ('558bf76a-8eb5-4d18-8821-099c4652fffe', '0e0bc967-8013-4ce4-ad98-86c969d77ea9', 'bbc60c94-192e-4f7e-84d6-61a41b4e84ef', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-22 20:00:10.336842+00', '2025-12-22 20:00:10.336842+00');
INSERT INTO public.carding_production_detail VALUES ('53d1d37c-1a20-4152-a284-5ef336bfa5a1', '0e0bc967-8013-4ce4-ad98-86c969d77ea9', '12739da8-5065-44d9-9fac-5b3f5400509d', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-22 20:00:10.336842+00', '2025-12-22 20:00:10.336842+00');
INSERT INTO public.carding_production_detail VALUES ('3b2495e0-8912-4247-b70b-047ba749622a', 'd3b68ea7-4c56-46c9-9a05-2deeadff7cc5', '5747fc0e-ec51-4b90-82f5-bd20938df3a5', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:13.433592+00', '2025-12-21 14:39:13.433592+00');
INSERT INTO public.carding_production_detail VALUES ('74ca267f-d922-47e4-8faa-c8dcdffca6f8', 'd3b68ea7-4c56-46c9-9a05-2deeadff7cc5', '8e921d7a-bfa6-41e4-b80c-4bd1bef57a3f', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:13.433592+00', '2025-12-21 14:39:13.433592+00');
INSERT INTO public.carding_production_detail VALUES ('3766f63e-9d9e-4a9e-b4be-80318a662b9c', 'd3b68ea7-4c56-46c9-9a05-2deeadff7cc5', '9e3990a1-a1b7-45af-8689-52b72ab17251', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:13.433592+00', '2025-12-21 14:39:13.433592+00');
INSERT INTO public.carding_production_detail VALUES ('6b05c763-da80-4314-9bdd-08d7bfaf9df7', 'd3b68ea7-4c56-46c9-9a05-2deeadff7cc5', 'befa01c3-504c-4979-9fc8-ac78217bfc63', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:13.433592+00', '2025-12-21 14:39:13.433592+00');
INSERT INTO public.carding_production_detail VALUES ('7e63c413-1c8a-410c-98b6-184a4a32204e', 'd3b68ea7-4c56-46c9-9a05-2deeadff7cc5', '18bd492e-189c-42a9-a456-093164fd0d56', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:13.433592+00', '2025-12-21 14:39:13.433592+00');
INSERT INTO public.carding_production_detail VALUES ('b69efc8b-f439-4b41-a0e2-506eec45c9e8', 'd3b68ea7-4c56-46c9-9a05-2deeadff7cc5', '4c7b3ff2-50ae-4ba4-8ad7-b647cff6f64f', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:13.433592+00', '2025-12-21 14:39:13.433592+00');
INSERT INTO public.carding_production_detail VALUES ('25d14074-ccd2-4f76-9527-8eb0c0a339c0', 'd3b68ea7-4c56-46c9-9a05-2deeadff7cc5', 'bfd513ca-7dd6-48d1-8803-99f4e91b7426', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:13.433592+00', '2025-12-21 14:39:13.433592+00');
INSERT INTO public.carding_production_detail VALUES ('9d86aaf1-6973-4754-bcc1-21f3b23f9e52', 'd3b68ea7-4c56-46c9-9a05-2deeadff7cc5', '809d0a5d-c906-4d4d-852a-a06df97a5634', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:13.433592+00', '2025-12-21 14:39:13.433592+00');
INSERT INTO public.carding_production_detail VALUES ('8a8f3a07-090c-4d3a-913d-c8ad5b94c954', 'd3b68ea7-4c56-46c9-9a05-2deeadff7cc5', 'b906b0c9-c939-4aec-8610-c29781600abb', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:13.433592+00', '2025-12-21 14:39:13.433592+00');
INSERT INTO public.carding_production_detail VALUES ('808c16a5-3ae7-4f00-b31a-9279e050ced2', 'd3b68ea7-4c56-46c9-9a05-2deeadff7cc5', '42b3a66c-3dbd-4112-94ce-52029f610ae9', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:13.433592+00', '2025-12-21 14:39:13.433592+00');
INSERT INTO public.carding_production_detail VALUES ('6ebd8df7-c976-4b2f-9694-9ed70f4d170b', 'd3b68ea7-4c56-46c9-9a05-2deeadff7cc5', '34ba610d-c324-450f-8644-72c624341f87', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:13.433592+00', '2025-12-21 14:39:13.433592+00');
INSERT INTO public.carding_production_detail VALUES ('1d2cb4a9-dcbd-447a-8a4e-e1f1d3ea06a5', 'd3b68ea7-4c56-46c9-9a05-2deeadff7cc5', '9c6c98e3-8493-45c5-963a-7976895de8c2', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:13.433592+00', '2025-12-21 14:39:13.433592+00');
INSERT INTO public.carding_production_detail VALUES ('00cf27de-6ce7-41fd-90ca-05db28402249', 'd3b68ea7-4c56-46c9-9a05-2deeadff7cc5', '9005c5ac-7aba-47cc-a55f-9aa0a9b20e22', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:13.433592+00', '2025-12-21 14:39:13.433592+00');
INSERT INTO public.carding_production_detail VALUES ('97a0d71d-8be9-4232-b139-6f7c101163ac', 'd3b68ea7-4c56-46c9-9a05-2deeadff7cc5', 'bb596c3f-dfcf-4612-a07e-128ef80eccbc', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:13.433592+00', '2025-12-21 14:39:13.433592+00');
INSERT INTO public.carding_production_detail VALUES ('a6342596-a1d3-43b8-8512-9bcf26024240', 'd3b68ea7-4c56-46c9-9a05-2deeadff7cc5', '5dc7db19-f9e8-4a48-9f6f-3f9485a3cc4b', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:13.433592+00', '2025-12-21 14:39:13.433592+00');
INSERT INTO public.carding_production_detail VALUES ('1ec9833c-409a-4515-994a-c0c9dbe2d691', 'd3b68ea7-4c56-46c9-9a05-2deeadff7cc5', 'd04278a8-d1b6-42a5-9fbf-08ea44f9c61e', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:13.433592+00', '2025-12-21 14:39:13.433592+00');
INSERT INTO public.carding_production_detail VALUES ('547a52ab-515b-4870-a5d9-c60169085942', 'd3b68ea7-4c56-46c9-9a05-2deeadff7cc5', '7cd1f492-fc9e-4f95-acde-6f8d2c24626e', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:13.433592+00', '2025-12-21 14:39:13.433592+00');
INSERT INTO public.carding_production_detail VALUES ('887bfb6a-cf15-4efd-8a3c-497d0085b1b5', 'd7c0d96b-8ba3-47b7-977a-65cea790196c', '5747fc0e-ec51-4b90-82f5-bd20938df3a5', 'SANKARESWARI G', '64COMBED GOLD', 64.72, 225.82, 0.00, 217.07, 104.03, 73.53, 0.3400, 0.1500, 375, 375, 1, false, NULL, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_production_detail VALUES ('470dd55c-c299-4e46-af89-dd4c9ddd1dc3', 'd7c0d96b-8ba3-47b7-977a-65cea790196c', '8e921d7a-bfa6-41e4-b80c-4bd1bef57a3f', 'SANKARESWARI G', '64COMBED GOLD', 62.05, 216.49, 0.00, 217.07, 99.73, 73.53, 0.3400, 0.1600, 375, 375, 1, false, NULL, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_production_detail VALUES ('e0bac83b-486c-4ea1-9225-e9afaf07334e', 'd7c0d96b-8ba3-47b7-977a-65cea790196c', '9e3990a1-a1b7-45af-8689-52b72ab17251', 'SANKARESWARI G', '64COMBED GOLD', 63.64, 222.05, 0.00, 217.07, 102.29, 73.53, 0.3400, 0.1500, 375, 375, 1, false, NULL, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_production_detail VALUES ('021431ba-067e-43ea-aedd-b740500c2206', 'd7c0d96b-8ba3-47b7-977a-65cea790196c', 'befa01c3-504c-4979-9fc8-ac78217bfc63', 'SANKARESWARI G', '64COMBED GOLD', 63.49, 221.52, 0.00, 217.07, 102.05, 73.53, 0.3400, 0.1500, 375, 375, 1, false, NULL, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_production_detail VALUES ('b0ac9832-6e02-4d78-8053-7d0cad66eb1f', 'd7c0d96b-8ba3-47b7-977a-65cea790196c', '18bd492e-189c-42a9-a456-093164fd0d56', 'SANKARESWARI G', '64COMBED GOLD', 60.93, 212.58, 0.00, 217.07, 97.93, 73.53, 0.3400, 0.1600, 375, 375, 1, false, NULL, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_production_detail VALUES ('b7ffe61c-7ff4-4168-9bee-75522f2a088b', 'd7c0d96b-8ba3-47b7-977a-65cea790196c', '4c7b3ff2-50ae-4ba4-8ad7-b647cff6f64f', 'SANKARESWARI G', '64COMBED GOLD', 62.98, 219.75, 0.00, 217.07, 101.23, 73.53, 0.3400, 0.1500, 375, 375, 1, false, NULL, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_production_detail VALUES ('36caa3dd-b372-4d8c-ae5d-27ce0bba5ae0', 'd7c0d96b-8ba3-47b7-977a-65cea790196c', 'bfd513ca-7dd6-48d1-8803-99f4e91b7426', 'SANKARESWARI G', '64COMBED GOLD', 62.31, 217.40, 0.00, 217.07, 100.15, 73.53, 0.3400, 0.1600, 375, 375, 1, false, NULL, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_production_detail VALUES ('9375b78e-2fbd-4ef7-af00-68cbb68ff9e1', 'd7c0d96b-8ba3-47b7-977a-65cea790196c', 'b906b0c9-c939-4aec-8610-c29781600abb', 'SANKARESWARI G', '64COMBED GOLD', 40.58, 141.60, 0.00, 217.07, 65.23, 73.53, 0.3400, 0.2400, 375, 375, 1, false, NULL, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_production_detail VALUES ('9c0c720a-6b17-4a46-88d9-34417c1556c0', 'd7c0d96b-8ba3-47b7-977a-65cea790196c', '42b3a66c-3dbd-4112-94ce-52029f610ae9', 'SANKARESWARI G', '64COMBED GOLD', 42.02, 146.62, 0.00, 217.07, 67.55, 73.53, 0.3400, 0.2300, 375, 375, 1, false, NULL, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_production_detail VALUES ('e13eddcd-abe4-4a3c-ab37-b107325bcd93', 'd7c0d96b-8ba3-47b7-977a-65cea790196c', '809d0a5d-c906-4d4d-852a-a06df97a5634', 'SANKARESWARI G', '64COMBED GOLD', 10.37, 36.18, 0.00, 43.41, 83.34, 14.71, 0.3400, 0.9400, 75, 75, 1, false, NULL, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_production_detail VALUES ('3a02bfc6-cbb4-40cb-858f-3b19386bb8f2', 'd7c0d96b-8ba3-47b7-977a-65cea790196c', '34ba610d-c324-450f-8644-72c624341f87', 'SANKARESWARI G', '64COMBED GOLD', 60.61, 196.37, 0.00, 208.39, 94.23, 70.59, 0.3400, 0.1700, 360, 360, 1, false, NULL, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_production_detail VALUES ('050ff1e3-2171-423e-9c4d-436e7c15952b', 'd3b68ea7-4c56-46c9-9a05-2deeadff7cc5', '667c4d31-7922-4f4f-aac1-28bf06bfba0c', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:13.433592+00', '2025-12-21 14:39:13.433592+00');
INSERT INTO public.carding_production_detail VALUES ('cdaae9cb-dca8-4ed2-a1ff-b42e32b32ef0', 'd3b68ea7-4c56-46c9-9a05-2deeadff7cc5', '4b22c0d5-e8f9-4091-9cc4-06db30b5255f', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:13.433592+00', '2025-12-21 14:39:13.433592+00');
INSERT INTO public.carding_production_detail VALUES ('96781360-4cfc-47fd-856e-17d556ab9e58', 'd3b68ea7-4c56-46c9-9a05-2deeadff7cc5', '1d422dc3-69ee-4ff5-ae78-240d1f5fa597', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:13.433592+00', '2025-12-21 14:39:13.433592+00');
INSERT INTO public.carding_production_detail VALUES ('b72b643b-f742-4ec9-85f5-655d967ee84a', 'd3b68ea7-4c56-46c9-9a05-2deeadff7cc5', 'bbc60c94-192e-4f7e-84d6-61a41b4e84ef', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:13.433592+00', '2025-12-21 14:39:13.433592+00');
INSERT INTO public.carding_production_detail VALUES ('0e292f64-420f-4bd2-aead-f70496484902', 'd3b68ea7-4c56-46c9-9a05-2deeadff7cc5', '12739da8-5065-44d9-9fac-5b3f5400509d', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:13.433592+00', '2025-12-21 14:39:13.433592+00');
INSERT INTO public.carding_production_detail VALUES ('fec287ff-8854-4dce-86e0-73bc4e76eb94', 'c3bf639a-aacf-45bd-9fdf-09e8c64b36d3', '5747fc0e-ec51-4b90-82f5-bd20938df3a5', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:20.631515+00', '2025-12-21 14:39:20.631515+00');
INSERT INTO public.carding_production_detail VALUES ('1f06e386-bd11-4386-9c79-8e499f9e274a', 'c3bf639a-aacf-45bd-9fdf-09e8c64b36d3', '8e921d7a-bfa6-41e4-b80c-4bd1bef57a3f', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:20.631515+00', '2025-12-21 14:39:20.631515+00');
INSERT INTO public.carding_production_detail VALUES ('c0f9482f-ae9f-4717-aa5c-5900d2bdcdf6', 'c3bf639a-aacf-45bd-9fdf-09e8c64b36d3', '9e3990a1-a1b7-45af-8689-52b72ab17251', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:20.631515+00', '2025-12-21 14:39:20.631515+00');
INSERT INTO public.carding_production_detail VALUES ('73d5df6b-26c5-4470-881a-78dd3563925f', 'c3bf639a-aacf-45bd-9fdf-09e8c64b36d3', 'befa01c3-504c-4979-9fc8-ac78217bfc63', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:20.631515+00', '2025-12-21 14:39:20.631515+00');
INSERT INTO public.carding_production_detail VALUES ('795cc33d-e453-4c54-86ea-a746a153cd7b', 'c3bf639a-aacf-45bd-9fdf-09e8c64b36d3', '18bd492e-189c-42a9-a456-093164fd0d56', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:20.631515+00', '2025-12-21 14:39:20.631515+00');
INSERT INTO public.carding_production_detail VALUES ('8b5efed7-1d32-442e-afbc-44205a099947', 'c3bf639a-aacf-45bd-9fdf-09e8c64b36d3', '4c7b3ff2-50ae-4ba4-8ad7-b647cff6f64f', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:20.631515+00', '2025-12-21 14:39:20.631515+00');
INSERT INTO public.carding_production_detail VALUES ('1ac31408-03a4-4926-a763-d95784195571', 'c3bf639a-aacf-45bd-9fdf-09e8c64b36d3', 'bfd513ca-7dd6-48d1-8803-99f4e91b7426', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:20.631515+00', '2025-12-21 14:39:20.631515+00');
INSERT INTO public.carding_production_detail VALUES ('47bf2fcf-64d2-4c8d-8319-ef1a7a42b1db', 'c3bf639a-aacf-45bd-9fdf-09e8c64b36d3', '809d0a5d-c906-4d4d-852a-a06df97a5634', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:20.631515+00', '2025-12-21 14:39:20.631515+00');
INSERT INTO public.carding_production_detail VALUES ('cc8c3a71-d5a9-4f3b-96ab-5413eec19a6c', 'c3bf639a-aacf-45bd-9fdf-09e8c64b36d3', 'b906b0c9-c939-4aec-8610-c29781600abb', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:20.631515+00', '2025-12-21 14:39:20.631515+00');
INSERT INTO public.carding_production_detail VALUES ('454d28fc-851f-4bb9-8e41-91b26518c52c', 'c3bf639a-aacf-45bd-9fdf-09e8c64b36d3', '42b3a66c-3dbd-4112-94ce-52029f610ae9', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:20.631515+00', '2025-12-21 14:39:20.631515+00');
INSERT INTO public.carding_production_detail VALUES ('22f51f75-fcde-4d0e-bd51-2553e9cf4688', 'c3bf639a-aacf-45bd-9fdf-09e8c64b36d3', '34ba610d-c324-450f-8644-72c624341f87', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:20.631515+00', '2025-12-21 14:39:20.631515+00');
INSERT INTO public.carding_production_detail VALUES ('36ec78ad-b55b-4449-bdbc-30ae489ab298', 'c3bf639a-aacf-45bd-9fdf-09e8c64b36d3', '9c6c98e3-8493-45c5-963a-7976895de8c2', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:20.631515+00', '2025-12-21 14:39:20.631515+00');
INSERT INTO public.carding_production_detail VALUES ('0bc2993e-abd7-474b-8ec7-6ccc0c11a94a', 'c3bf639a-aacf-45bd-9fdf-09e8c64b36d3', '9005c5ac-7aba-47cc-a55f-9aa0a9b20e22', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:20.631515+00', '2025-12-21 14:39:20.631515+00');
INSERT INTO public.carding_production_detail VALUES ('939e5884-b986-4bc5-aa73-7f6ea4840cdc', 'c3bf639a-aacf-45bd-9fdf-09e8c64b36d3', 'bb596c3f-dfcf-4612-a07e-128ef80eccbc', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:20.631515+00', '2025-12-21 14:39:20.631515+00');
INSERT INTO public.carding_production_detail VALUES ('025154e4-ff1f-4da9-b9c4-6bd7808e3ac4', 'c3bf639a-aacf-45bd-9fdf-09e8c64b36d3', '5dc7db19-f9e8-4a48-9f6f-3f9485a3cc4b', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:20.631515+00', '2025-12-21 14:39:20.631515+00');
INSERT INTO public.carding_production_detail VALUES ('eecd50e2-47f8-4310-b550-ec2eed8fd754', 'c3bf639a-aacf-45bd-9fdf-09e8c64b36d3', 'd04278a8-d1b6-42a5-9fbf-08ea44f9c61e', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:20.631515+00', '2025-12-21 14:39:20.631515+00');
INSERT INTO public.carding_production_detail VALUES ('1d487884-4b72-4cf8-b891-cf18805e1ca1', 'c3bf639a-aacf-45bd-9fdf-09e8c64b36d3', '7cd1f492-fc9e-4f95-acde-6f8d2c24626e', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:20.631515+00', '2025-12-21 14:39:20.631515+00');
INSERT INTO public.carding_production_detail VALUES ('154fdab1-b116-4f8a-aa54-c0f2f5c1ea62', 'c3bf639a-aacf-45bd-9fdf-09e8c64b36d3', '667c4d31-7922-4f4f-aac1-28bf06bfba0c', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:20.631515+00', '2025-12-21 14:39:20.631515+00');
INSERT INTO public.carding_production_detail VALUES ('2512e346-52d3-41b2-8f65-9b82c3cc5be1', 'c3bf639a-aacf-45bd-9fdf-09e8c64b36d3', '4b22c0d5-e8f9-4091-9cc4-06db30b5255f', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:20.631515+00', '2025-12-21 14:39:20.631515+00');
INSERT INTO public.carding_production_detail VALUES ('026b643b-8e96-4fed-ae7a-3c7c95a60008', 'c3bf639a-aacf-45bd-9fdf-09e8c64b36d3', '1d422dc3-69ee-4ff5-ae78-240d1f5fa597', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:20.631515+00', '2025-12-21 14:39:20.631515+00');
INSERT INTO public.carding_production_detail VALUES ('4ce64799-406d-4c74-850d-fd250d778dec', 'c3bf639a-aacf-45bd-9fdf-09e8c64b36d3', 'bbc60c94-192e-4f7e-84d6-61a41b4e84ef', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:20.631515+00', '2025-12-21 14:39:20.631515+00');
INSERT INTO public.carding_production_detail VALUES ('1124e48c-000b-420a-8058-1b0a0f216740', 'c3bf639a-aacf-45bd-9fdf-09e8c64b36d3', '12739da8-5065-44d9-9fac-5b3f5400509d', NULL, '64COMBED GOLD', 0.00, 0.00, 295.22, 0.00, 0.00, 0.00, 0.3400, 0.0000, 510, 375, 1, false, NULL, '2025-12-21 14:39:20.631515+00', '2025-12-21 14:39:20.631515+00');
INSERT INTO public.carding_production_detail VALUES ('aa87e04b-b4b3-4d4b-86c1-de194ffcb779', 'd7c0d96b-8ba3-47b7-977a-65cea790196c', '9c6c98e3-8493-45c5-963a-7976895de8c2', 'SANKARESWARI G', '64COMBED GOLD', 52.90, 171.40, 0.00, 208.39, 82.25, 70.59, 0.3400, 0.2000, 360, 360, 1, false, NULL, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_production_detail VALUES ('56d4c2bd-9444-4074-8b26-a1b000103400', 'd7c0d96b-8ba3-47b7-977a-65cea790196c', '9005c5ac-7aba-47cc-a55f-9aa0a9b20e22', 'SANKARESWARI G', '64COMBED GOLD', 60.04, 209.48, 0.00, 208.39, 100.52, 70.59, 0.3400, 0.1600, 360, 360, 1, false, NULL, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_production_detail VALUES ('e3a07d08-a3b9-4d72-a146-9f9028fd6476', 'd7c0d96b-8ba3-47b7-977a-65cea790196c', 'bb596c3f-dfcf-4612-a07e-128ef80eccbc', 'SANKARESWARI G', '64COMBED GOLD', 58.48, 204.05, 0.00, 208.39, 97.92, 70.59, 0.3400, 0.1700, 360, 360, 1, false, NULL, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_production_detail VALUES ('e0189470-8678-41c6-8137-e977d8caa1d4', 'd7c0d96b-8ba3-47b7-977a-65cea790196c', '5dc7db19-f9e8-4a48-9f6f-3f9485a3cc4b', 'SANKARESWARI G', '64COMBED GOLD', 50.99, 177.89, 0.00, 179.44, 99.14, 60.78, 0.3400, 0.1900, 310, 310, 1, false, NULL, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_production_detail VALUES ('e8e49043-4d7b-4d47-aaf5-dd35863c30cf', 'd7c0d96b-8ba3-47b7-977a-65cea790196c', 'd04278a8-d1b6-42a5-9fbf-08ea44f9c61e', 'SANKARESWARI G', '64COMBED GOLD', 50.30, 175.51, 0.00, 179.44, 97.81, 60.78, 0.3400, 0.1900, 310, 310, 1, false, NULL, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_production_detail VALUES ('aea49512-bd81-48c9-8c43-2a16529ebe65', 'd7c0d96b-8ba3-47b7-977a-65cea790196c', '7cd1f492-fc9e-4f95-acde-6f8d2c24626e', 'SANKARESWARI G', '64COMBED GOLD', 52.16, 169.01, 0.00, 167.87, 100.68, 56.86, 0.3400, 0.2000, 290, 290, 1, false, NULL, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');


--
-- TOC entry 4564 (class 0 OID 40361)
-- Dependencies: 371
-- Data for Name: carding_production_header; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.carding_production_header VALUES ('d7c0d96b-8ba3-47b7-977a-65cea790196c', 1, '2025-04-22', 1, '087b99d0-7531-40c3-b301-ba5afe9047c4', NULL, 510, 'Sample data from VB6', false, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00');
INSERT INTO public.carding_production_header VALUES ('c02c0da4-f960-4d29-b3f3-184e6151dec0', 3, '2025-12-21', 1, 'b99ebd36-b7c4-46b0-a53b-c763f3a5ae7d', NULL, 510, 'Sample data with VB6 values', false, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:32:59.498324+00');
INSERT INTO public.carding_production_header VALUES ('d3b68ea7-4c56-46c9-9a05-2deeadff7cc5', 4, '2025-12-21', 2, NULL, NULL, 510, NULL, false, '2025-12-21 14:39:12.483771+00', '2025-12-21 14:39:12.483771+00');
INSERT INTO public.carding_production_header VALUES ('c3bf639a-aacf-45bd-9fdf-09e8c64b36d3', 5, '2025-12-21', 3, NULL, NULL, 510, NULL, false, '2025-12-21 14:39:20.224001+00', '2025-12-21 14:39:20.224001+00');
INSERT INTO public.carding_production_header VALUES ('0e0bc967-8013-4ce4-ad98-86c969d77ea9', 6, '2025-12-23', 1, NULL, NULL, 510, NULL, false, '2025-12-22 20:00:09.243349+00', '2025-12-22 20:00:09.243349+00');


--
-- TOC entry 4566 (class 0 OID 40424)
-- Dependencies: 373
-- Data for Name: carding_stoppage_entry; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.carding_stoppage_entry VALUES ('9c23775e-374b-4d45-8f8e-787080daa38e', 'af50b0c0-0053-440a-91f8-f15cdd8d62e6', '82cce5a5-73b3-4d8c-aa56-7c3e827a357f', 100, NULL, 0, NULL, 0, NULL, 0, 100, true, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:39:02.623271+00');
INSERT INTO public.carding_stoppage_entry VALUES ('69075021-6745-4086-a428-81db0a49d584', 'b0039709-6e2a-4e1d-a10c-f46f1c29c443', '82cce5a5-73b3-4d8c-aa56-7c3e827a357f', 100, NULL, 0, NULL, 0, NULL, 0, 100, true, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:39:02.625419+00');
INSERT INTO public.carding_stoppage_entry VALUES ('9df76ecf-8d88-42da-bb7c-099a4351a567', '8da680ca-589d-4770-9e7d-adffbc8e7f9d', '82cce5a5-73b3-4d8c-aa56-7c3e827a357f', 100, NULL, 0, NULL, 0, NULL, 0, 100, true, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:39:02.637856+00');
INSERT INTO public.carding_stoppage_entry VALUES ('3f1a834c-4dc6-4312-90b3-9a25727cd305', '13532517-82e4-454d-b93c-a1fd7f36ee92', '82cce5a5-73b3-4d8c-aa56-7c3e827a357f', 100, NULL, 0, NULL, 0, NULL, 0, 100, true, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:39:02.63861+00');
INSERT INTO public.carding_stoppage_entry VALUES ('11fdb153-6fde-43ea-922b-899e79bb34c5', 'bf86ea38-db96-45b4-9ea0-82a0f0e0dbf3', '82cce5a5-73b3-4d8c-aa56-7c3e827a357f', 100, NULL, 0, NULL, 0, NULL, 0, 100, true, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:39:02.644975+00');
INSERT INTO public.carding_stoppage_entry VALUES ('d9d3d629-9dc7-473e-adca-77a22dff180c', '887bfb6a-cf15-4efd-8a3c-497d0085b1b5', '9e2cddae-dca8-420c-93ab-a21d3c04f7b8', 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_stoppage_entry VALUES ('a6f0e3e6-7af5-4715-98ca-437c155355bd', '470dd55c-c299-4e46-af89-dd4c9ddd1dc3', '9e2cddae-dca8-420c-93ab-a21d3c04f7b8', 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_stoppage_entry VALUES ('991d3310-7be5-457c-b977-51f01f0552fb', 'e0bac83b-486c-4ea1-9225-e9afaf07334e', '9e2cddae-dca8-420c-93ab-a21d3c04f7b8', 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_stoppage_entry VALUES ('2743b7bf-2430-4e92-8e8c-5ffe166ec230', '021431ba-067e-43ea-aedd-b740500c2206', '9e2cddae-dca8-420c-93ab-a21d3c04f7b8', 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_stoppage_entry VALUES ('4a02acbb-2755-42d5-a457-4347ec395f74', 'b0ac9832-6e02-4d78-8053-7d0cad66eb1f', '9e2cddae-dca8-420c-93ab-a21d3c04f7b8', 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_stoppage_entry VALUES ('585934bd-ba5e-433b-98d7-72e2ecb3e363', 'b7ffe61c-7ff4-4168-9bee-75522f2a088b', '9e2cddae-dca8-420c-93ab-a21d3c04f7b8', 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_stoppage_entry VALUES ('fdf12d9f-1a36-49cb-be57-4428466fdc07', '36caa3dd-b372-4d8c-ae5d-27ce0bba5ae0', '9e2cddae-dca8-420c-93ab-a21d3c04f7b8', 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_stoppage_entry VALUES ('90620a78-2dbf-4835-9a21-d247efae1b47', '9375b78e-2fbd-4ef7-af00-68cbb68ff9e1', '9e2cddae-dca8-420c-93ab-a21d3c04f7b8', 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_stoppage_entry VALUES ('ad6058f8-6059-4f32-8541-3828f8970e06', '9c0c720a-6b17-4a46-88d9-34417c1556c0', '9e2cddae-dca8-420c-93ab-a21d3c04f7b8', 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_stoppage_entry VALUES ('0169a709-822f-47e6-9df6-9935cb72f96e', 'e13eddcd-abe4-4a3c-ab37-b107325bcd93', '9e2cddae-dca8-420c-93ab-a21d3c04f7b8', 135, '297e18be-e452-4a28-96a0-a9b8fb7de573', 300, NULL, 0, NULL, 0, 435, false, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_stoppage_entry VALUES ('d142540d-d7d3-4a2e-b183-82b4a6f7cc3a', '3a02bfc6-cbb4-40cb-858f-3b19386bb8f2', 'b5a6a520-2e01-4f05-9367-cfb94340cc05', 150, NULL, 0, NULL, 0, NULL, 0, 150, false, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_stoppage_entry VALUES ('0a279b87-4c2a-48ea-998f-f0b9865fa808', 'aa87e04b-b4b3-4d4b-86c1-de194ffcb779', 'b5a6a520-2e01-4f05-9367-cfb94340cc05', 150, NULL, 0, NULL, 0, NULL, 0, 150, false, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_stoppage_entry VALUES ('f16d5f75-9a1b-4532-840c-afaa353330c5', '56d4c2bd-9444-4074-8b26-a1b000103400', 'b5a6a520-2e01-4f05-9367-cfb94340cc05', 150, NULL, 0, NULL, 0, NULL, 0, 150, false, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_stoppage_entry VALUES ('248db214-e1dd-4c0c-8526-9bbf53ce4b0b', 'e3a07d08-a3b9-4d72-a146-9f9028fd6476', 'b5a6a520-2e01-4f05-9367-cfb94340cc05', 150, NULL, 0, NULL, 0, NULL, 0, 150, false, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_stoppage_entry VALUES ('8ca833b5-9355-4606-9345-fb82df798b92', 'e0189470-8678-41c6-8137-e977d8caa1d4', '9e2cddae-dca8-420c-93ab-a21d3c04f7b8', 200, NULL, 0, NULL, 0, NULL, 0, 200, false, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_stoppage_entry VALUES ('81fc4e9d-4bac-4505-9226-599b09b33ac8', 'e8e49043-4d7b-4d47-aaf5-dd35863c30cf', '9e2cddae-dca8-420c-93ab-a21d3c04f7b8', 200, NULL, 0, NULL, 0, NULL, 0, 200, false, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_stoppage_entry VALUES ('735eeba7-b392-4057-8cb4-dcd9838b6704', 'aea49512-bd81-48c9-8c43-2a16529ebe65', '9e2cddae-dca8-420c-93ab-a21d3c04f7b8', 220, NULL, 0, NULL, 0, NULL, 0, 220, false, '2025-12-21 12:43:51.458899+00', '2025-12-21 13:16:48.783271+00');
INSERT INTO public.carding_stoppage_entry VALUES ('c3f50a9e-4e7a-41b6-8785-5db6b85e6b21', '19d57dd0-0823-4d1e-a33d-39a6386a5683', '82cce5a5-73b3-4d8c-aa56-7c3e827a357f', 100, NULL, 0, NULL, 0, NULL, 0, 100, true, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:39:02.631854+00');
INSERT INTO public.carding_stoppage_entry VALUES ('9de6fa0e-fe3d-4821-bf81-451b06b35550', '45e79007-76b2-48dd-aed7-185e0aa2759e', '82cce5a5-73b3-4d8c-aa56-7c3e827a357f', 100, NULL, 0, NULL, 0, NULL, 0, 100, true, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:39:02.653853+00');
INSERT INTO public.carding_stoppage_entry VALUES ('d1ac53f1-1794-4bc1-9a55-0ec9fda5ba10', '94dd7f8e-19f0-4b69-9a42-ebeadc945bfe', '82cce5a5-73b3-4d8c-aa56-7c3e827a357f', 100, NULL, 0, NULL, 0, NULL, 0, 100, true, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:39:02.659575+00');
INSERT INTO public.carding_stoppage_entry VALUES ('874103a9-a1c7-41b8-a22e-e3ab18e837dc', 'c620d617-3fb0-4297-b173-45dfd4a09fb7', '82cce5a5-73b3-4d8c-aa56-7c3e827a357f', 100, NULL, 0, NULL, 0, NULL, 0, 100, true, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:39:02.696839+00');
INSERT INTO public.carding_stoppage_entry VALUES ('2c7d342b-7eef-446a-976e-aa1de4941ea7', 'c74acef4-2006-4091-83e6-6fbff01c054e', '82cce5a5-73b3-4d8c-aa56-7c3e827a357f', 100, NULL, 0, NULL, 0, NULL, 0, 100, true, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:39:02.727407+00');
INSERT INTO public.carding_stoppage_entry VALUES ('6c0df075-5213-4798-ac27-ae6a07fbdab9', '2dd9cab4-a26f-4e30-8201-79db28c8cd4d', '82cce5a5-73b3-4d8c-aa56-7c3e827a357f', 100, NULL, 0, 'b5a6a520-2e01-4f05-9367-cfb94340cc05', 120, NULL, 0, 120, true, '2025-12-21 13:29:25.993203+00', '2025-12-21 15:56:00.042324+00');
INSERT INTO public.carding_stoppage_entry VALUES ('077f08bf-9745-44ed-828a-0a8c05be5956', '8ce89c21-16c5-4a03-971e-9b4801384dc4', '82cce5a5-73b3-4d8c-aa56-7c3e827a357f', 100, NULL, 0, NULL, 0, NULL, 0, 100, true, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:39:02.607586+00');
INSERT INTO public.carding_stoppage_entry VALUES ('2e9c903c-2422-4b59-b305-8e280e09518f', 'b4c52c3c-e2c4-452f-ab09-db75575b7d1c', '82cce5a5-73b3-4d8c-aa56-7c3e827a357f', 100, NULL, 0, NULL, 0, NULL, 0, 100, true, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:39:02.610284+00');
INSERT INTO public.carding_stoppage_entry VALUES ('c9d1c97d-b630-47b6-a24a-0ea47f2766a0', '9222d85f-b8f4-4f8b-ba01-6595a47e1d6e', '82cce5a5-73b3-4d8c-aa56-7c3e827a357f', 100, NULL, 0, NULL, 0, NULL, 0, 100, true, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:39:02.634852+00');
INSERT INTO public.carding_stoppage_entry VALUES ('2907e178-99de-4947-830c-a849abee1518', '738fb9e4-45d1-4311-ae0c-25332f0ad069', '82cce5a5-73b3-4d8c-aa56-7c3e827a357f', 100, NULL, 0, NULL, 0, NULL, 0, 100, true, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:39:02.623144+00');
INSERT INTO public.carding_stoppage_entry VALUES ('a232ca6f-8cbc-4527-9f81-22abd559971e', '20f8845b-beee-40c7-868b-059cf04b3611', '82cce5a5-73b3-4d8c-aa56-7c3e827a357f', 100, NULL, 0, NULL, 0, NULL, 0, 100, true, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:39:02.612307+00');
INSERT INTO public.carding_stoppage_entry VALUES ('3d4a8498-5b0a-452a-8ae5-9a8e2a7a9039', 'e23a091c-d2fe-429b-b4f7-75db55984246', '82cce5a5-73b3-4d8c-aa56-7c3e827a357f', 100, NULL, 0, NULL, 0, NULL, 0, 100, true, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:39:02.649865+00');
INSERT INTO public.carding_stoppage_entry VALUES ('6d082315-1a5d-4831-a742-3b873277f8dd', '652719c0-87e4-400a-afaa-f78cb655a559', '82cce5a5-73b3-4d8c-aa56-7c3e827a357f', 100, '8f7e3c0e-c29c-4758-acb6-a2cb0a7f6a0f', 200, NULL, 0, NULL, 0, 100, true, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:39:02.646243+00');
INSERT INTO public.carding_stoppage_entry VALUES ('03e44e26-69e2-4724-a18b-1e84c8f3fa26', '76452ab8-b525-42d6-9a8b-e9bfadaa3d24', '82cce5a5-73b3-4d8c-aa56-7c3e827a357f', 100, NULL, 0, NULL, 0, NULL, 0, 100, true, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:39:02.665379+00');
INSERT INTO public.carding_stoppage_entry VALUES ('74531274-84ad-4a91-b702-5575b18f812f', 'd6e4743b-f2ef-4911-bc13-3626592748c2', '82cce5a5-73b3-4d8c-aa56-7c3e827a357f', 100, NULL, 0, NULL, 0, NULL, 0, 100, true, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:39:02.665165+00');
INSERT INTO public.carding_stoppage_entry VALUES ('52e52223-8008-4cbc-b978-7e2dfa59caa3', 'cfd3f61e-1252-43b5-b29d-2789020d9198', '82cce5a5-73b3-4d8c-aa56-7c3e827a357f', 100, NULL, 0, NULL, 0, NULL, 0, 100, true, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:39:02.739231+00');
INSERT INTO public.carding_stoppage_entry VALUES ('52735ba8-8d1a-48ec-9a78-b72e16ad56b8', 'caad3820-e2ce-40b8-b9d7-fdde2ce84a97', '82cce5a5-73b3-4d8c-aa56-7c3e827a357f', 100, NULL, 0, NULL, 0, NULL, 0, 100, true, '2025-12-21 13:29:25.993203+00', '2025-12-21 13:39:02.750593+00');
INSERT INTO public.carding_stoppage_entry VALUES ('584c4fe7-9620-4f00-b049-1524c96a9175', '3b2495e0-8912-4247-b70b-047ba749622a', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:13.650663+00', '2025-12-21 14:39:13.650663+00');
INSERT INTO public.carding_stoppage_entry VALUES ('cbea7c84-679f-4932-9271-4f150c552dc0', '74ca267f-d922-47e4-8faa-c8dcdffca6f8', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:13.650663+00', '2025-12-21 14:39:13.650663+00');
INSERT INTO public.carding_stoppage_entry VALUES ('172158c8-2423-4f48-805f-d030845c9df0', '3766f63e-9d9e-4a9e-b4be-80318a662b9c', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:13.650663+00', '2025-12-21 14:39:13.650663+00');
INSERT INTO public.carding_stoppage_entry VALUES ('950c7d9f-38dd-49cd-8eb1-c44568979f58', '6b05c763-da80-4314-9bdd-08d7bfaf9df7', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:13.650663+00', '2025-12-21 14:39:13.650663+00');
INSERT INTO public.carding_stoppage_entry VALUES ('7824ba7d-8aaf-4704-8ddc-e187445441b1', '7e63c413-1c8a-410c-98b6-184a4a32204e', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:13.650663+00', '2025-12-21 14:39:13.650663+00');
INSERT INTO public.carding_stoppage_entry VALUES ('d0eb2747-7fb0-4e85-b159-89cd495f81b7', 'b69efc8b-f439-4b41-a0e2-506eec45c9e8', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:13.650663+00', '2025-12-21 14:39:13.650663+00');
INSERT INTO public.carding_stoppage_entry VALUES ('474ec9b5-589b-4c62-a1a6-8db3e169f9c2', '25d14074-ccd2-4f76-9527-8eb0c0a339c0', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:13.650663+00', '2025-12-21 14:39:13.650663+00');
INSERT INTO public.carding_stoppage_entry VALUES ('b412c358-5738-4aa2-82ea-f9d88a69c421', '9d86aaf1-6973-4754-bcc1-21f3b23f9e52', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:13.650663+00', '2025-12-21 14:39:13.650663+00');
INSERT INTO public.carding_stoppage_entry VALUES ('1adf8039-9264-4391-ae45-a2b5a26b1c94', '8a8f3a07-090c-4d3a-913d-c8ad5b94c954', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:13.650663+00', '2025-12-21 14:39:13.650663+00');
INSERT INTO public.carding_stoppage_entry VALUES ('2523bdeb-0ad2-4156-9f6a-75fec94577a8', '808c16a5-3ae7-4f00-b31a-9279e050ced2', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:13.650663+00', '2025-12-21 14:39:13.650663+00');
INSERT INTO public.carding_stoppage_entry VALUES ('eca931d6-0350-4958-8ae3-9719e877ae62', '6ebd8df7-c976-4b2f-9694-9ed70f4d170b', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:13.650663+00', '2025-12-21 14:39:13.650663+00');
INSERT INTO public.carding_stoppage_entry VALUES ('df99ebd1-d45a-4025-bbfd-e538eb1b9c26', '1d2cb4a9-dcbd-447a-8a4e-e1f1d3ea06a5', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:13.650663+00', '2025-12-21 14:39:13.650663+00');
INSERT INTO public.carding_stoppage_entry VALUES ('e9a9afeb-febf-4c1d-bc93-28e0e3bb167b', '00cf27de-6ce7-41fd-90ca-05db28402249', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:13.650663+00', '2025-12-21 14:39:13.650663+00');
INSERT INTO public.carding_stoppage_entry VALUES ('23934f97-935e-44cb-8d7c-c0d590866485', '97a0d71d-8be9-4232-b139-6f7c101163ac', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:13.650663+00', '2025-12-21 14:39:13.650663+00');
INSERT INTO public.carding_stoppage_entry VALUES ('e2ea6d14-b17e-45f9-9b38-100a7ad28e95', 'a6342596-a1d3-43b8-8512-9bcf26024240', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:13.650663+00', '2025-12-21 14:39:13.650663+00');
INSERT INTO public.carding_stoppage_entry VALUES ('f77fe05a-a840-4b14-b765-98299aaf9628', '1ec9833c-409a-4515-994a-c0c9dbe2d691', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:13.650663+00', '2025-12-21 14:39:13.650663+00');
INSERT INTO public.carding_stoppage_entry VALUES ('7f7fadf4-b64d-4fe8-94a2-b4adb2c8ad55', '547a52ab-515b-4870-a5d9-c60169085942', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:13.650663+00', '2025-12-21 14:39:13.650663+00');
INSERT INTO public.carding_stoppage_entry VALUES ('f86fa2c6-25ac-478b-9b31-dd7ff1c3e739', '050ff1e3-2171-423e-9c4d-436e7c15952b', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:13.650663+00', '2025-12-21 14:39:13.650663+00');
INSERT INTO public.carding_stoppage_entry VALUES ('d9c4ba90-281c-4028-969d-3a5b8fdffc0d', 'cdaae9cb-dca8-4ed2-a1ff-b42e32b32ef0', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:13.650663+00', '2025-12-21 14:39:13.650663+00');
INSERT INTO public.carding_stoppage_entry VALUES ('3b431649-f6c5-4b68-8253-fe2ef882536a', '96781360-4cfc-47fd-856e-17d556ab9e58', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:13.650663+00', '2025-12-21 14:39:13.650663+00');
INSERT INTO public.carding_stoppage_entry VALUES ('bb7cb5a2-b0c1-4823-973d-49155d8552e6', 'b72b643b-f742-4ec9-85f5-655d967ee84a', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:13.650663+00', '2025-12-21 14:39:13.650663+00');
INSERT INTO public.carding_stoppage_entry VALUES ('672dcd09-688a-4681-be59-4cdb87317207', '0e292f64-420f-4bd2-aead-f70496484902', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:13.650663+00', '2025-12-21 14:39:13.650663+00');
INSERT INTO public.carding_stoppage_entry VALUES ('732b6ac9-b200-44ce-aa29-352dd91920da', 'fec287ff-8854-4dce-86e0-73bc4e76eb94', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:20.763259+00', '2025-12-21 14:39:20.763259+00');
INSERT INTO public.carding_stoppage_entry VALUES ('1b3bedfc-b6d1-4415-8d6d-0082fd46abfa', '1f06e386-bd11-4386-9c79-8e499f9e274a', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:20.763259+00', '2025-12-21 14:39:20.763259+00');
INSERT INTO public.carding_stoppage_entry VALUES ('0e44610d-7975-4ec5-9a7c-bda1b344af21', 'c0f9482f-ae9f-4717-aa5c-5900d2bdcdf6', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:20.763259+00', '2025-12-21 14:39:20.763259+00');
INSERT INTO public.carding_stoppage_entry VALUES ('d4852947-a166-427b-94a4-dedd477ef173', '73d5df6b-26c5-4470-881a-78dd3563925f', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:20.763259+00', '2025-12-21 14:39:20.763259+00');
INSERT INTO public.carding_stoppage_entry VALUES ('c4939e3d-5a72-4c04-bca7-03e61ebe4b97', '795cc33d-e453-4c54-86ea-a746a153cd7b', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:20.763259+00', '2025-12-21 14:39:20.763259+00');
INSERT INTO public.carding_stoppage_entry VALUES ('7c097926-3980-456f-b3c3-531d2d5da535', '8b5efed7-1d32-442e-afbc-44205a099947', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:20.763259+00', '2025-12-21 14:39:20.763259+00');
INSERT INTO public.carding_stoppage_entry VALUES ('19bfd62d-42fa-483e-8817-3df2b5456344', '1ac31408-03a4-4926-a763-d95784195571', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:20.763259+00', '2025-12-21 14:39:20.763259+00');
INSERT INTO public.carding_stoppage_entry VALUES ('1f39dbad-9c03-4d72-9387-b6a4c337963e', '47bf2fcf-64d2-4c8d-8319-ef1a7a42b1db', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:20.763259+00', '2025-12-21 14:39:20.763259+00');
INSERT INTO public.carding_stoppage_entry VALUES ('6e70e879-9513-4b2d-ab2e-9d9a6619d0ef', 'cc8c3a71-d5a9-4f3b-96ab-5413eec19a6c', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:20.763259+00', '2025-12-21 14:39:20.763259+00');
INSERT INTO public.carding_stoppage_entry VALUES ('d27b9d56-defa-40a2-93cd-00b6877be982', '454d28fc-851f-4bb9-8e41-91b26518c52c', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:20.763259+00', '2025-12-21 14:39:20.763259+00');
INSERT INTO public.carding_stoppage_entry VALUES ('9d06c3b0-fdb3-48d1-8050-64fc0e948751', '22f51f75-fcde-4d0e-bd51-2553e9cf4688', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:20.763259+00', '2025-12-21 14:39:20.763259+00');
INSERT INTO public.carding_stoppage_entry VALUES ('7b16d3d3-c9cb-46e4-9184-5677fd86013a', '36ec78ad-b55b-4449-bdbc-30ae489ab298', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:20.763259+00', '2025-12-21 14:39:20.763259+00');
INSERT INTO public.carding_stoppage_entry VALUES ('46d46866-5707-4af9-a986-ba6a1f484bc0', '0bc2993e-abd7-474b-8ec7-6ccc0c11a94a', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:20.763259+00', '2025-12-21 14:39:20.763259+00');
INSERT INTO public.carding_stoppage_entry VALUES ('6af72043-7f42-4a76-b521-d84dc4297e84', '939e5884-b986-4bc5-aa73-7f6ea4840cdc', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:20.763259+00', '2025-12-21 14:39:20.763259+00');
INSERT INTO public.carding_stoppage_entry VALUES ('bd32d80b-6c53-4a57-95af-f22355174d93', '025154e4-ff1f-4da9-b9c4-6bd7808e3ac4', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:20.763259+00', '2025-12-21 14:39:20.763259+00');
INSERT INTO public.carding_stoppage_entry VALUES ('1a77d660-71a1-4a03-976f-692d20b3eaac', 'eecd50e2-47f8-4310-b550-ec2eed8fd754', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:20.763259+00', '2025-12-21 14:39:20.763259+00');
INSERT INTO public.carding_stoppage_entry VALUES ('36b1dacc-7474-4f11-9ac7-b1f728a9ebf7', '1d487884-4b72-4cf8-b891-cf18805e1ca1', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:20.763259+00', '2025-12-21 14:39:20.763259+00');
INSERT INTO public.carding_stoppage_entry VALUES ('c5a9a53d-b174-4663-8690-f8925cb8e7b3', '154fdab1-b116-4f8a-aa54-c0f2f5c1ea62', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:20.763259+00', '2025-12-21 14:39:20.763259+00');
INSERT INTO public.carding_stoppage_entry VALUES ('2b92d33a-86ba-4357-b916-c274b3474c88', '2512e346-52d3-41b2-8f65-9b82c3cc5be1', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:20.763259+00', '2025-12-21 14:39:20.763259+00');
INSERT INTO public.carding_stoppage_entry VALUES ('f30ed1da-8378-4a3a-8d5d-697780f0e6fa', '026b643b-8e96-4fed-ae7a-3c7c95a60008', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:20.763259+00', '2025-12-21 14:39:20.763259+00');
INSERT INTO public.carding_stoppage_entry VALUES ('9a862c24-558c-44cf-958f-8b95ca7260f8', '4ce64799-406d-4c74-850d-fd250d778dec', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:20.763259+00', '2025-12-21 14:39:20.763259+00');
INSERT INTO public.carding_stoppage_entry VALUES ('ea274874-0dcc-4277-b04b-6d8492911596', '1124e48c-000b-420a-8058-1b0a0f216740', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-21 14:39:20.763259+00', '2025-12-21 14:39:20.763259+00');
INSERT INTO public.carding_stoppage_entry VALUES ('5a374245-240b-4271-a203-46b54dd7c9d1', '9ed9db27-1331-4249-b323-ccdcf5a346e6', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-22 20:00:10.709487+00', '2025-12-22 20:00:10.709487+00');
INSERT INTO public.carding_stoppage_entry VALUES ('a6ecd943-810f-4a5c-9fd2-6be2e0af0aa8', '29a76898-f3b5-436f-9363-05291a76dd89', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-22 20:00:10.709487+00', '2025-12-22 20:00:10.709487+00');
INSERT INTO public.carding_stoppage_entry VALUES ('5d3e51d2-9c44-4201-ac6e-ec96760016ef', '10bf25aa-b359-4b0e-ae63-c6f8a3d3af05', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-22 20:00:10.709487+00', '2025-12-22 20:00:10.709487+00');
INSERT INTO public.carding_stoppage_entry VALUES ('1883e7ca-379f-4e80-be96-8b777c3f3a1c', '9b6bd49d-53aa-4c77-a571-432447fed9e9', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-22 20:00:10.709487+00', '2025-12-22 20:00:10.709487+00');
INSERT INTO public.carding_stoppage_entry VALUES ('627d1e08-f366-4958-9769-222503daa43f', '288fb73f-0676-42e7-9408-dcef2e1dc31b', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-22 20:00:10.709487+00', '2025-12-22 20:00:10.709487+00');
INSERT INTO public.carding_stoppage_entry VALUES ('3eab3267-e893-4056-9320-483d23f14bd9', '66967bf7-d6d4-4f06-9901-67053e999b8d', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-22 20:00:10.709487+00', '2025-12-22 20:00:10.709487+00');
INSERT INTO public.carding_stoppage_entry VALUES ('2873d492-0b8f-499c-8941-04cfbac255b7', 'd9e591b9-f4db-4599-a891-eae8b96982b5', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-22 20:00:10.709487+00', '2025-12-22 20:00:10.709487+00');
INSERT INTO public.carding_stoppage_entry VALUES ('31c1f83f-e7cb-4fc5-9bd0-59d3e0a20599', 'c2215459-4da6-482c-a766-cb985c993498', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-22 20:00:10.709487+00', '2025-12-22 20:00:10.709487+00');
INSERT INTO public.carding_stoppage_entry VALUES ('d8da4303-00de-4fd4-9018-26a5e0531f82', 'c137651f-c09a-4b9f-af61-59f210dc7082', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-22 20:00:10.709487+00', '2025-12-22 20:00:10.709487+00');
INSERT INTO public.carding_stoppage_entry VALUES ('c2564326-699c-4c71-b77b-d9bc93e79fd9', '68272cb1-00b3-4ac0-a392-5b4c304a3dd7', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-22 20:00:10.709487+00', '2025-12-22 20:00:10.709487+00');
INSERT INTO public.carding_stoppage_entry VALUES ('b7c85cf8-e73a-4de6-8aba-607204dc7e34', 'c82a7a51-00c9-41df-8124-57cd103e871a', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-22 20:00:10.709487+00', '2025-12-22 20:00:10.709487+00');
INSERT INTO public.carding_stoppage_entry VALUES ('8f39ad45-528c-4fde-9346-60dd7eb4e5d2', '80e8fef0-af38-4f6b-9a81-1863c9740eae', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-22 20:00:10.709487+00', '2025-12-22 20:00:10.709487+00');
INSERT INTO public.carding_stoppage_entry VALUES ('4674588e-1d9b-4b06-9e6b-c200b83e74a9', 'b68676c9-7519-42e8-84f5-9b769a38ef3f', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-22 20:00:10.709487+00', '2025-12-22 20:00:10.709487+00');
INSERT INTO public.carding_stoppage_entry VALUES ('88cf3028-9ddd-4da4-a126-cf4f0d20b0b2', '12ae551a-b12a-4869-93e4-bf6ec4bec6c8', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-22 20:00:10.709487+00', '2025-12-22 20:00:10.709487+00');
INSERT INTO public.carding_stoppage_entry VALUES ('d73e4c6a-8f21-4591-81f4-3a7abbdc53ce', '9bdf2c6e-e248-4423-9626-a0187ff0d209', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-22 20:00:10.709487+00', '2025-12-22 20:00:10.709487+00');
INSERT INTO public.carding_stoppage_entry VALUES ('47756e8d-7ac6-4fb5-9417-2fa5c942dd8f', 'ad125f47-3054-4b57-8bd7-02bc17cdbdea', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-22 20:00:10.709487+00', '2025-12-22 20:00:10.709487+00');
INSERT INTO public.carding_stoppage_entry VALUES ('a96f29ae-cc5a-42a7-8e65-f85bba0fd419', '88bffa29-3e16-4e1e-aa1f-52434049ca35', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-22 20:00:10.709487+00', '2025-12-22 20:00:10.709487+00');
INSERT INTO public.carding_stoppage_entry VALUES ('0740def0-930b-4d23-a328-410300824abd', '9882a19b-90ce-47d2-8bdf-54cd12d23946', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-22 20:00:10.709487+00', '2025-12-22 20:00:10.709487+00');
INSERT INTO public.carding_stoppage_entry VALUES ('249a2f38-9445-40c7-ae83-c002954c6615', '0a67e88a-afa5-4272-b927-c05e695ace5b', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-22 20:00:10.709487+00', '2025-12-22 20:00:10.709487+00');
INSERT INTO public.carding_stoppage_entry VALUES ('459dc144-8947-4e6e-899d-8c5f59d023ec', 'ad3ef7ee-6af3-4fa5-b327-fc85e7bd023f', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-22 20:00:10.709487+00', '2025-12-22 20:00:10.709487+00');
INSERT INTO public.carding_stoppage_entry VALUES ('9a13c2dc-f131-4742-b424-5c50ea6570c5', '558bf76a-8eb5-4d18-8821-099c4652fffe', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-22 20:00:10.709487+00', '2025-12-22 20:00:10.709487+00');
INSERT INTO public.carding_stoppage_entry VALUES ('d03594d1-0b9b-4daa-a98f-b0c551a94d8c', '53d1d37c-1a20-4152-a284-5ef336bfa5a1', NULL, 135, NULL, 0, NULL, 0, NULL, 0, 135, false, '2025-12-22 20:00:10.709487+00', '2025-12-22 20:00:10.709487+00');


--
-- TOC entry 4559 (class 0 OID 29119)
-- Dependencies: 365
-- Data for Name: comber_machines; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.comber_machines VALUES ('74c69b74-9941-40e6-8e0a-1c53f1ff39ea', 'CO2', 'COMBER 2', 'LMW', 2, NULL, '64COMBED GOLD', 350, 0.00, 93, '2015-04-01', true, false, false, '2025-12-02 17:25:32.526345+00', '2025-12-02 17:25:32.526345+00');
INSERT INTO public.comber_machines VALUES ('f66d59f9-4d4a-4902-981f-6dac1df8e4cc', 'CO3', 'COMBER 3', 'LMW', 3, NULL, '64COMBED GOLD', 350, 0.00, 93, '2015-04-01', true, false, false, '2025-12-02 17:25:32.526345+00', '2025-12-02 17:25:32.526345+00');
INSERT INTO public.comber_machines VALUES ('d4bece01-4f24-4cd2-8d1b-cd880b941aa8', 'CO4', 'COMBER 4', 'LMW', 4, NULL, '64COMBED GOLD', 350, 0.00, 93, '2015-04-01', true, false, false, '2025-12-02 17:25:32.526345+00', '2025-12-02 17:25:32.526345+00');
INSERT INTO public.comber_machines VALUES ('f12ada5f-76e1-4166-a92f-f605c14ba47b', 'CO5', 'COMBER 5', 'LMW', 5, NULL, '64COMBED GOLD', 350, 0.00, 93, '2015-04-01', true, false, false, '2025-12-02 17:25:32.526345+00', '2025-12-02 17:25:32.526345+00');
INSERT INTO public.comber_machines VALUES ('b67d4b4d-7ff2-4584-9749-8a7b4dc00d4a', 'CO6', 'COMBER 6', 'LMW', 6, NULL, '64COMBED GOLD', 450, 0.00, 93, '2015-04-01', true, false, false, '2025-12-02 17:25:32.526345+00', '2025-12-02 17:25:32.526345+00');
INSERT INTO public.comber_machines VALUES ('ba973f60-4813-4a23-ba49-e3cf44093106', 'CO7', 'COMBER 7', 'LMW', 7, NULL, '64COMBED GOLD', 400, 0.00, 93, '2015-04-01', true, false, false, '2025-12-02 17:25:32.526345+00', '2025-12-02 17:25:32.526345+00');
INSERT INTO public.comber_machines VALUES ('b4fc108b-3741-4252-b2fc-e6858d77d945', 'CO8', 'COMBER 8', 'LMW', 8, NULL, '64COMBED GOLD', 400, 0.00, 93, '2015-04-01', true, false, false, '2025-12-02 17:25:32.526345+00', '2025-12-02 17:25:32.526345+00');
INSERT INTO public.comber_machines VALUES ('6d9a24ce-0d0f-48e2-8f49-e609c1f69356', 'CO9', 'COMBER 9', 'LMW', 9, NULL, '64COMBED GOLD', 350, 0.00, 93, '2015-04-01', true, false, false, '2025-12-02 17:25:32.526345+00', '2025-12-02 17:25:32.526345+00');
INSERT INTO public.comber_machines VALUES ('05ba7113-a5c2-4f12-aa19-4582ccb3c543', 'CO10', 'COMBER 10', 'LMW', 10, NULL, '64COMBED GOLD', 350, 0.00, 93, '2015-04-01', true, false, false, '2025-12-02 17:25:32.526345+00', '2025-12-02 17:25:32.526345+00');
INSERT INTO public.comber_machines VALUES ('9df45db2-3f71-45fc-b74a-e26f854bd1a7', 'CO11', 'COMBER 11', 'LMW', 11, NULL, '64COMBED GOLD', 400, 0.00, 93, '2015-04-01', true, false, false, '2025-12-02 17:25:32.526345+00', '2025-12-02 17:25:32.526345+00');
INSERT INTO public.comber_machines VALUES ('cdbf6528-1e1a-4848-b07a-20236369738d', 'CO12', 'COMBER 12', 'LMW', 12, NULL, '64COMBED GOLD', 400, 0.00, 93, '2015-04-01', true, false, false, '2025-12-02 17:25:32.526345+00', '2025-12-02 17:25:32.526345+00');
INSERT INTO public.comber_machines VALUES ('6fc13efd-eb92-4fb1-a67f-80dcc00d89bf', 'CO13', 'COMBER 13', 'LMW', 13, NULL, '64COMBED GOLD', 400, 0.00, 93, '2015-04-01', true, false, false, '2025-12-02 17:25:32.526345+00', '2025-12-02 17:25:32.526345+00');
INSERT INTO public.comber_machines VALUES ('1df57605-3305-4cc0-a7aa-05c646ef307f', 'CO1', 'COMBER 1', 'LMW', 1, NULL, '64COMBED GOLD', 350, 0.00, 93, '2015-04-01', true, false, false, '2025-12-02 17:25:32.526345+00', '2025-12-02 17:46:48.064705+00');


--
-- TOC entry 4539 (class 0 OID 17744)
-- Dependencies: 340
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.departments VALUES ('a9b06d7a-bbce-46c0-b6fd-4b2f0c3ca8d7', 'none', 0, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 0);
INSERT INTO public.departments VALUES ('b87d05e8-0985-4d25-bcaa-eaa8a88fee0c', 'BLOW ROOM', 1, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 1);
INSERT INTO public.departments VALUES ('1b06751e-182c-4a49-9676-f8962fb2cf8b', 'CARDING', 2, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 2);
INSERT INTO public.departments VALUES ('b1c5df2c-eeb2-4453-9f98-29f19b8c8664', 'BREAKER DRAWING', 3, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 3);
INSERT INTO public.departments VALUES ('a9e182d3-4cf5-4c58-b42c-0efc04f3e3b5', 'LAP FORMER', 4, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 4);
INSERT INTO public.departments VALUES ('17936d00-5703-4f31-bfe8-37dbcf7a08ec', 'COMBER', 5, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 5);
INSERT INTO public.departments VALUES ('acf83311-0ec5-45a1-b61b-e8ea14f88362', 'Finisher Drawing', 6, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 6);
INSERT INTO public.departments VALUES ('f33d2269-9ff9-4711-a1eb-5b50bca1b914', 'SIMPLEX', 7, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 7);
INSERT INTO public.departments VALUES ('da627794-4405-45c9-a3cf-4801f5dd1b5b', 'SPINNING', 8, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 8);
INSERT INTO public.departments VALUES ('682c3b38-c0e3-4bfd-881e-bbc9ac38627a', 'SPINNING DOFFER', 9, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 9);
INSERT INTO public.departments VALUES ('bc389afa-1d74-4b7c-9e22-cee123c49988', 'REELIVER', 10, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 10);
INSERT INTO public.departments VALUES ('4a9ecf36-a3cc-4ebb-bba6-96740ace9bd2', 'AUTOCONER', 11, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 11);
INSERT INTO public.departments VALUES ('06bab5a4-ec09-4532-b8ab-a945b836944e', 'PACKING', 12, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 12);
INSERT INTO public.departments VALUES ('3adc4d3e-f2c6-4ab1-8581-85e68ba46553', 'ELECTRICIAN', 13, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 13);
INSERT INTO public.departments VALUES ('d8c331e4-c16d-43b0-b703-a041650a1b59', 'FITTER', 14, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 14);
INSERT INTO public.departments VALUES ('f8726490-75ab-497b-8f0f-1c4f7e239945', 'FITTER HELPER', 15, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 15);
INSERT INTO public.departments VALUES ('d431d3c4-527b-41d4-863b-28c5965b3b6d', 'CLEANING', 16, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 16);
INSERT INTO public.departments VALUES ('659d71c4-9333-45f8-99ac-06e153c6a11e', 'SEMI CLEANING', 17, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 17);
INSERT INTO public.departments VALUES ('a0e40f6a-5b05-4926-85b5-140b4b4b8daf', 'MIXING', 18, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 18);
INSERT INTO public.departments VALUES ('7be59c0f-74d0-452f-9653-32863c218df7', 'OHTC', 19, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 19);
INSERT INTO public.departments VALUES ('fb14025b-3763-4e48-a1a5-6922b3af300b', 'COMPRESSOR', 20, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 20);
INSERT INTO public.departments VALUES ('8dc50850-2fc1-4a01-8e42-2f8903a7b28a', 'WCS', 21, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 21);
INSERT INTO public.departments VALUES ('2254a821-e17b-4960-aabc-a5b9be3d1ea2', 'HF PLANTS', 22, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 22);
INSERT INTO public.departments VALUES ('724e80ab-a367-4d9a-a971-a872cbf94eff', 'ULTIMO', 24, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 24);
INSERT INTO public.departments VALUES ('e75946cf-3e3f-4655-8aae-b042a8f004d2', 'POWER DISTRIBUTION', 25, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 25);
INSERT INTO public.departments VALUES ('d4da5311-f186-4510-8808-ffed0a71f272', 'SPARE', 26, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 26);
INSERT INTO public.departments VALUES ('60390bb1-c512-44cb-82d5-48216a430e61', 'SUESSEN EXHAUST', 27, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 27);
INSERT INTO public.departments VALUES ('510d18dc-7533-43f0-b233-06e0f4e5c98a', 'R.O PLANT (FOG)', 28, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 28);
INSERT INTO public.departments VALUES ('be5734a3-482d-463b-8166-ef2e64c0b1a3', 'R.O PLANT (HOSTEL)', 29, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 29);
INSERT INTO public.departments VALUES ('b4cd47c4-7e40-40b5-bd6b-3f23adf03fe1', 'STP PLANT', 30, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 30);
INSERT INTO public.departments VALUES ('89ac6849-27d9-42e1-8c19-198d8a742bfe', 'STP RO (PLANT)', 31, 0.20, true, '2025-11-20 06:38:58.178157+00', '2025-11-20 06:38:58.178157+00', 31);
INSERT INTO public.departments VALUES ('b2c5fc4e-975b-4960-9432-755c21aaf640', 'ROTATORY', 32, 0.20, true, '2025-11-20 06:56:38.587689+00', '2025-11-20 06:56:38.587689+00', 32);
INSERT INTO public.departments VALUES ('455407db-ee14-472a-8ec7-1ab7b99eaeac', 'SIMPLEX SIDER', 33, 0.20, true, '2025-11-23 11:30:27.589761+00', '2025-11-23 11:30:27.589761+00', 33);
INSERT INTO public.departments VALUES ('164e3c95-7a42-4e51-a9b2-c8bb401284fd', 'MAISTRY', 34, 0.20, true, '2025-11-23 11:30:27.589761+00', '2025-11-23 11:30:27.589761+00', 34);
INSERT INTO public.departments VALUES ('f87a9643-e85e-448d-bff2-266d6249a5ae', 'SPG SIDER', 35, 0.20, true, '2025-11-23 11:30:27.589761+00', '2025-11-23 11:30:27.589761+00', 35);
INSERT INTO public.departments VALUES ('a3d5ab86-8f65-404d-96dc-0fd53ec384d6', 'DRAWING', 36, 0.20, true, '2025-11-23 11:30:27.589761+00', '2025-11-23 11:30:27.589761+00', 36);


--
-- TOC entry 4558 (class 0 OID 29070)
-- Dependencies: 364
-- Data for Name: drawing_breaker_machines; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.drawing_breaker_machines VALUES ('c3798c01-54b5-4011-af76-a5395b9e9912', 'BD11', 'BD11', 'LMW', 11, NULL, '64', 0, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:55:35.853517+00', '2025-12-02 16:55:35.853517+00');
INSERT INTO public.drawing_breaker_machines VALUES ('04175809-14ff-4561-af30-0f64d99e96d2', 'BD1', 'BD1', 'LMW', 1, NULL, '64COMBED GOLD', 450, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:55:35.853517+00', '2025-12-22 19:16:11.796091+00');
INSERT INTO public.drawing_breaker_machines VALUES ('d8a3d833-5c1f-4f79-9af9-1137ed6e5e3f', 'BD2', 'BD2', 'LMW', 2, NULL, '64COMBED GOLD', 750, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:55:35.853517+00', '2025-12-22 19:16:11.796091+00');
INSERT INTO public.drawing_breaker_machines VALUES ('2a41a68b-aee8-4e72-ac3d-7c6e7b10cf93', 'BD3', 'BD3', 'LMW', 3, NULL, '64COMBED GOLD', 750, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:55:35.853517+00', '2025-12-22 19:16:11.796091+00');
INSERT INTO public.drawing_breaker_machines VALUES ('50e18753-c89e-49a4-9822-19f04f1dda56', 'BD4', 'BD4', 'LMW', 4, NULL, '64COMBED GOLD', 750, 0.00, '2015-04-01', true, false, false, '2025-12-02 16:55:35.853517+00', '2025-12-22 19:16:11.796091+00');


--
-- TOC entry 4560 (class 0 OID 29168)
-- Dependencies: 366
-- Data for Name: drawing_finisher_machines; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.drawing_finisher_machines VALUES ('221b1bd3-14b5-4ee2-9349-6e2194ac2764', 'FD1', 'FD1', 'LMW', 1, NULL, '64', 550, 0.00, '2015-04-01', true, false, false, '2025-12-02 17:58:44.034765+00', '2025-12-02 17:58:44.034765+00');
INSERT INTO public.drawing_finisher_machines VALUES ('b30054f5-5c94-4484-8ae9-3fa136ab6190', 'FD2', 'FD2', 'LMW', 2, NULL, '64', 500, 0.00, '2015-04-01', true, false, false, '2025-12-02 17:58:44.034765+00', '2025-12-02 17:58:44.034765+00');
INSERT INTO public.drawing_finisher_machines VALUES ('9e045b2b-34d4-4f8e-87d4-aa7fbd5b0462', 'FD3', 'FD3', 'LMW', 3, NULL, '64', 600, 0.00, '2015-04-01', true, false, false, '2025-12-02 17:58:44.034765+00', '2025-12-02 17:58:44.034765+00');
INSERT INTO public.drawing_finisher_machines VALUES ('4ac2190a-e93d-46d0-a28e-be9d0e17e66c', 'FD4', 'FD4', 'LMW', 4, NULL, '64', 600, 0.00, '2015-04-01', true, false, false, '2025-12-02 17:58:44.034765+00', '2025-12-02 17:58:44.034765+00');
INSERT INTO public.drawing_finisher_machines VALUES ('94734208-3601-44d7-bdf0-384069981297', 'FD5', 'FD5', 'LMW', 5, NULL, '64', 550, 0.00, '2015-04-01', true, false, false, '2025-12-02 17:58:44.034765+00', '2025-12-02 17:58:44.034765+00');


--
-- TOC entry 4550 (class 0 OID 17991)
-- Dependencies: 351
-- Data for Name: hok_strength_detail; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.hok_strength_detail VALUES (377, 1182, 'a9b06d7a-bbce-46c0-b6fd-4b2f0c3ca8d7', 1.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (378, 1182, 'b87d05e8-0985-4d25-bcaa-eaa8a88fee0c', 2.0, 3.0, 41.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (379, 1182, '1b06751e-182c-4a49-9676-f8962fb2cf8b', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (380, 1182, 'b1c5df2c-eeb2-4453-9f98-29f19b8c8664', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (381, 1182, 'a9e182d3-4cf5-4c58-b42c-0efc04f3e3b5', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (382, 1182, '17936d00-5703-4f31-bfe8-37dbcf7a08ec', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (383, 1182, 'acf83311-0ec5-45a1-b61b-e8ea14f88362', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (384, 1182, 'f33d2269-9ff9-4711-a1eb-5b50bca1b914', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (385, 1182, 'da627794-4405-45c9-a3cf-4801f5dd1b5b', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (386, 1182, '682c3b38-c0e3-4bfd-881e-bbc9ac38627a', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (387, 1182, 'bc389afa-1d74-4b7c-9e22-cee123c49988', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (388, 1182, '4a9ecf36-a3cc-4ebb-bba6-96740ace9bd2', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (389, 1182, '06bab5a4-ec09-4532-b8ab-a945b836944e', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (390, 1182, '3adc4d3e-f2c6-4ab1-8581-85e68ba46553', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (391, 1182, 'd8c331e4-c16d-43b0-b703-a041650a1b59', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (392, 1182, 'f8726490-75ab-497b-8f0f-1c4f7e239945', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (393, 1182, 'd431d3c4-527b-41d4-863b-28c5965b3b6d', 1.0, 1.0, 2.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (394, 1182, '659d71c4-9333-45f8-99ac-06e153c6a11e', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (395, 1182, 'a0e40f6a-5b05-4926-85b5-140b4b4b8daf', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (396, 1182, '7be59c0f-74d0-452f-9653-32863c218df7', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (397, 1182, 'fb14025b-3763-4e48-a1a5-6922b3af300b', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (398, 1182, '8dc50850-2fc1-4a01-8e42-2f8903a7b28a', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (399, 1182, '2254a821-e17b-4960-aabc-a5b9be3d1ea2', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (400, 1182, '724e80ab-a367-4d9a-a971-a872cbf94eff', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (401, 1182, 'e75946cf-3e3f-4655-8aae-b042a8f004d2', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (402, 1182, 'd4da5311-f186-4510-8808-ffed0a71f272', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (403, 1182, '60390bb1-c512-44cb-82d5-48216a430e61', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (404, 1182, '510d18dc-7533-43f0-b233-06e0f4e5c98a', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (405, 1182, 'be5734a3-482d-463b-8166-ef2e64c0b1a3', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (406, 1182, 'b4cd47c4-7e40-40b5-bd6b-3f23adf03fe1', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (407, 1182, '89ac6849-27d9-42e1-8c19-198d8a742bfe', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (408, 1182, 'b2c5fc4e-975b-4960-9432-755c21aaf640', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (409, 1182, '455407db-ee14-472a-8ec7-1ab7b99eaeac', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (410, 1182, '164e3c95-7a42-4e51-a9b2-c8bb401284fd', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (411, 1182, 'f87a9643-e85e-448d-bff2-266d6249a5ae', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');
INSERT INTO public.hok_strength_detail VALUES (412, 1182, 'a3d5ab86-8f65-404d-96dc-0fd53ec384d6', 0.0, 0.0, 0.0, '2025-11-23 12:22:56.031729+00', '2025-11-23 12:22:56.031729+00');


--
-- TOC entry 4547 (class 0 OID 17976)
-- Dependencies: 348
-- Data for Name: hok_strength_head; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.hok_strength_head VALUES (1150, '2020-01-21', 875.00, 868.00, 871.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1151, '2020-01-22', 876.00, 869.00, 872.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1152, '2020-01-23', 877.00, 870.00, 873.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1153, '2020-01-24', 878.00, 871.00, 874.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1154, '2020-01-25', 879.00, 872.00, 875.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1155, '2020-01-26', 880.00, 873.00, 876.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1156, '2020-01-27', 881.00, 874.00, 877.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1157, '2020-01-28', 882.00, 875.00, 878.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1158, '2020-01-29', 883.00, 876.00, 879.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1159, '2020-01-30', 884.00, 877.00, 880.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1160, '2020-01-31', 885.00, 878.00, 881.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1161, '2020-02-01', 886.00, 879.00, 882.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1162, '2020-02-02', 887.00, 880.00, 883.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1163, '2020-02-03', 888.00, 881.00, 884.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1164, '2020-02-04', 889.00, 882.00, 885.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1165, '2020-02-05', 890.00, 883.00, 886.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1166, '2020-02-06', 891.00, 884.00, 887.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1167, '2020-02-07', 892.00, 885.00, 888.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1168, '2020-02-08', 893.00, 886.00, 889.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1169, '2020-02-09', 894.00, 887.00, 890.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1170, '2020-02-14', 895.00, 888.00, 891.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1171, '2020-02-15', 896.00, 889.00, 892.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1172, '2020-02-16', 897.00, 890.00, 893.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1173, '2020-02-17', 898.00, 891.00, 894.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1174, '2021-01-21', 899.00, 892.00, 895.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1175, '2021-01-20', 900.00, 893.00, 896.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1176, '2022-09-22', 901.00, 894.00, 897.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1177, '2023-07-23', 902.00, 895.00, 898.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1178, '2024-07-18', 903.00, 896.00, 899.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1179, '2024-05-03', 904.00, 897.00, 900.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1180, '2024-08-03', 905.00, 898.00, 901.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1181, '2024-08-01', 906.00, 899.00, 902.00, '2025-11-20 04:57:30.32501+00', '2025-11-20 04:57:30.32501+00');
INSERT INTO public.hok_strength_head VALUES (1182, '2024-08-06', 4.00, 4.00, 43.00, '2025-11-20 04:57:30.32501+00', '2025-11-23 12:22:55.788657+00');


--
-- TOC entry 4577 (class 0 OID 45389)
-- Dependencies: 384
-- Data for Name: lap_former_machine_setup; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.lap_former_machine_setup VALUES ('2786b64b-ee24-4b78-87f3-fc38a0dbddeb', 'e78f9dac-5df8-4d38-bb6a-44d111b33bf1', 120, 0.0082, 0.8500, 0.8500, 3747.14, 510, 0, 1693, 1, '2025-12-25 07:58:15.700425+00', '2025-12-25 08:40:31.401488+00');
INSERT INTO public.lap_former_machine_setup VALUES ('c86eba2d-b849-4216-bedb-6ce39a10051b', 'ed90943f-6812-4dbb-afa0-1ca1619d4fca', 90, 0.0082, 0.8500, 0.8500, 2810.35, 510, 0, 1693, 1, '2025-12-25 07:58:15.700425+00', '2025-12-25 08:40:31.401488+00');
INSERT INTO public.lap_former_machine_setup VALUES ('8a16e60b-d3e4-4b79-ad6f-fe292e49b357', '475ba064-4b53-4e99-9c19-9b36665891e9', 90, 0.0082, 0.8500, 0.8500, 2810.35, 510, 0, 1693, 1, '2025-12-25 07:58:15.700425+00', '2025-12-25 08:40:31.401488+00');


--
-- TOC entry 4562 (class 0 OID 29264)
-- Dependencies: 368
-- Data for Name: lap_former_machines; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.lap_former_machines VALUES ('e78f9dac-5df8-4d38-bb6a-44d111b33bf1', 'LF1', 'LABFORMER 1', 'LMW', 1, NULL, '64COMBED GOLD', 120, 0.00, '2015-04-01', true, false, false, '2025-12-02 18:41:09.997287+00', '2025-12-25 08:40:31.401488+00');
INSERT INTO public.lap_former_machines VALUES ('ed90943f-6812-4dbb-afa0-1ca1619d4fca', 'LF2', 'LABFORMER 2', 'LMW', 2, NULL, '64COMBED GOLD', 90, 0.00, '2015-04-01', true, false, false, '2025-12-02 18:41:09.997287+00', '2025-12-25 08:40:31.401488+00');
INSERT INTO public.lap_former_machines VALUES ('475ba064-4b53-4e99-9c19-9b36665891e9', 'LF3', 'LABFORMER 3', 'LMW', 3, NULL, '64COMBED GOLD', 90, 0.00, '2015-04-01', true, false, false, '2025-12-02 18:41:09.997287+00', '2025-12-25 08:40:31.401488+00');


--
-- TOC entry 4575 (class 0 OID 45305)
-- Dependencies: 382
-- Data for Name: lap_former_production_detail; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.lap_former_production_detail VALUES ('6a44d0c9-f0aa-4974-833b-c67e1a84d77d', '0b559401-7226-45fd-8d54-8639193cb25c', 'e78f9dac-5df8-4d38-bb6a-44d111b33bf1', NULL, '64COMBED GOLD', 0.00, 0.00, 3747.14, 3747.14, 0.00, 100.00, 0.8500, 0.0000, 510, 510, 1, false, NULL, '2025-12-25 08:20:58.817961+00', '2025-12-25 08:20:58.817961+00');
INSERT INTO public.lap_former_production_detail VALUES ('0e2be083-15cc-489f-8b4d-b90be5bc93ad', '0b559401-7226-45fd-8d54-8639193cb25c', 'ed90943f-6812-4dbb-afa0-1ca1619d4fca', NULL, '64COMBED GOLD', 0.00, 0.00, 2810.35, 2810.35, 0.00, 100.00, 0.8500, 0.0000, 510, 510, 1, false, NULL, '2025-12-25 08:20:58.817961+00', '2025-12-25 08:20:58.817961+00');
INSERT INTO public.lap_former_production_detail VALUES ('bdabd8d3-e2ba-4cdb-a2c2-7525b3d87e7f', '0b559401-7226-45fd-8d54-8639193cb25c', '475ba064-4b53-4e99-9c19-9b36665891e9', NULL, '64COMBED GOLD', 0.00, 0.00, 2810.35, 2810.35, 0.00, 100.00, 0.8500, 0.0000, 510, 510, 1, false, NULL, '2025-12-25 08:20:58.817961+00', '2025-12-25 08:20:58.817961+00');
INSERT INTO public.lap_former_production_detail VALUES ('588a6755-75a1-49cc-9757-f3781386b871', '9ab196a7-db18-4eba-9a18-110dcc21f969', 'e78f9dac-5df8-4d38-bb6a-44d111b33bf1', 'MURUGESWARI. M', '64COMBED GOLD', 28.36, 1568.85, 3747.14, 1542.94, 101.68, 41.18, 0.8500, 0.0500, 510, 210, 1, false, NULL, '2025-12-25 08:40:31.401488+00', '2025-12-25 08:40:31.401488+00');
INSERT INTO public.lap_former_production_detail VALUES ('7095aa03-2d6b-4da2-a51e-8fdf53398dfb', '9ab196a7-db18-4eba-9a18-110dcc21f969', 'ed90943f-6812-4dbb-afa0-1ca1619d4fca', 'MURUGESWARI. M', '64COMBED GOLD', 17.14, 948.17, 2810.35, 964.34, 98.32, 34.31, 0.8500, 0.0900, 510, 175, 1, false, NULL, '2025-12-25 08:40:31.401488+00', '2025-12-25 08:40:31.401488+00');
INSERT INTO public.lap_former_production_detail VALUES ('cb97521c-0fd2-4cb7-b453-fb6bc154b657', '9ab196a7-db18-4eba-9a18-110dcc21f969', '475ba064-4b53-4e99-9c19-9b36665891e9', 'GANDHIMATHI K', '64COMBED GOLD', 24.04, 1329.87, 2810.35, 1322.52, 100.56, 47.06, 0.8500, 0.0600, 510, 240, 1, false, NULL, '2025-12-25 08:40:31.401488+00', '2025-12-25 08:40:31.401488+00');
INSERT INTO public.lap_former_production_detail VALUES ('6fb86ed9-2592-4540-95e3-284e27acc4c8', '7e16c09d-6314-477b-940c-da11f1a2cae2', 'e78f9dac-5df8-4d38-bb6a-44d111b33bf1', NULL, '64COMBED GOLD', 0.00, 0.00, 3747.14, 3747.14, 0.00, 100.00, 0.8500, 0.0000, 510, 510, 1, false, NULL, '2025-12-25 08:46:31.392204+00', '2025-12-25 08:46:31.392204+00');
INSERT INTO public.lap_former_production_detail VALUES ('491b46f7-36af-446f-8018-279eddd6d37a', '7e16c09d-6314-477b-940c-da11f1a2cae2', 'ed90943f-6812-4dbb-afa0-1ca1619d4fca', NULL, '64COMBED GOLD', 0.00, 0.00, 2810.35, 2810.35, 0.00, 100.00, 0.8500, 0.0000, 510, 510, 1, false, NULL, '2025-12-25 08:46:31.392204+00', '2025-12-25 08:46:31.392204+00');
INSERT INTO public.lap_former_production_detail VALUES ('609f12a0-783b-4ef1-a6c8-a5804536f41d', '7e16c09d-6314-477b-940c-da11f1a2cae2', '475ba064-4b53-4e99-9c19-9b36665891e9', NULL, '64COMBED GOLD', 0.00, 0.00, 2810.35, 2810.35, 0.00, 100.00, 0.8500, 0.0000, 510, 510, 1, false, NULL, '2025-12-25 08:46:31.392204+00', '2025-12-25 08:46:31.392204+00');
INSERT INTO public.lap_former_production_detail VALUES ('763a09cb-9775-4c5b-a6d9-58e53be5ba2b', '4fdc8e80-8482-42a1-b1f5-ed2515631522', 'e78f9dac-5df8-4d38-bb6a-44d111b33bf1', NULL, '64COMBED GOLD', 0.00, 0.00, 3747.14, 3747.14, 0.00, 100.00, 0.8500, 0.0000, 510, 510, 1, false, NULL, '2025-12-25 08:46:36.783722+00', '2025-12-25 08:46:36.783722+00');
INSERT INTO public.lap_former_production_detail VALUES ('8d66d945-ca75-4dc8-b2a7-d3c434b5de06', '4fdc8e80-8482-42a1-b1f5-ed2515631522', 'ed90943f-6812-4dbb-afa0-1ca1619d4fca', NULL, '64COMBED GOLD', 0.00, 0.00, 2810.35, 2810.35, 0.00, 100.00, 0.8500, 0.0000, 510, 510, 1, false, NULL, '2025-12-25 08:46:36.783722+00', '2025-12-25 08:46:36.783722+00');
INSERT INTO public.lap_former_production_detail VALUES ('334810db-cc07-47d7-afd5-1422813c22be', '4fdc8e80-8482-42a1-b1f5-ed2515631522', '475ba064-4b53-4e99-9c19-9b36665891e9', NULL, '64COMBED GOLD', 0.00, 0.00, 2810.35, 2810.35, 0.00, 100.00, 0.8500, 0.0000, 510, 510, 1, false, NULL, '2025-12-25 08:46:36.783722+00', '2025-12-25 08:46:36.783722+00');
INSERT INTO public.lap_former_production_detail VALUES ('001e182b-f509-4295-8e38-d940ce889c9e', 'b1332b10-c243-4061-ba93-869392eedd45', 'e78f9dac-5df8-4d38-bb6a-44d111b33bf1', NULL, '64COMBED GOLD', 0.00, 0.00, 3747.14, 3747.14, 0.00, 100.00, 0.8500, 0.0000, 510, 510, 1, false, NULL, '2025-12-25 08:46:42.809608+00', '2025-12-25 08:46:42.809608+00');
INSERT INTO public.lap_former_production_detail VALUES ('9622f002-be21-44af-9458-dd740be39ab9', 'b1332b10-c243-4061-ba93-869392eedd45', 'ed90943f-6812-4dbb-afa0-1ca1619d4fca', NULL, '64COMBED GOLD', 0.00, 0.00, 2810.35, 2810.35, 0.00, 100.00, 0.8500, 0.0000, 510, 510, 1, false, NULL, '2025-12-25 08:46:42.809608+00', '2025-12-25 08:46:42.809608+00');
INSERT INTO public.lap_former_production_detail VALUES ('a798f8a2-7a8b-405d-af47-e7d1de4ef237', 'b1332b10-c243-4061-ba93-869392eedd45', '475ba064-4b53-4e99-9c19-9b36665891e9', NULL, '64COMBED GOLD', 0.00, 0.00, 2810.35, 2810.35, 0.00, 100.00, 0.8500, 0.0000, 510, 510, 1, false, NULL, '2025-12-25 08:46:42.809608+00', '2025-12-25 08:46:42.809608+00');
INSERT INTO public.lap_former_production_detail VALUES ('f7e7002e-4e31-4320-99d6-677a9be1c734', '0f6acf36-d8a4-4dd9-b9bc-14cdfeba39ba', 'ed90943f-6812-4dbb-afa0-1ca1619d4fca', 'MURUGESWARI. M', '64COMBED GOLD', 17.14, 948.17, 2810.35, 964.34, 98.32, 34.31, 0.8500, 0.0900, 510, 175, 1, false, NULL, '2025-12-25 08:17:42.650473+00', '2025-12-25 08:47:31.789581+00');
INSERT INTO public.lap_former_production_detail VALUES ('476a2838-54e5-459e-b077-f8ca6584259d', '0f6acf36-d8a4-4dd9-b9bc-14cdfeba39ba', '475ba064-4b53-4e99-9c19-9b36665891e9', 'GANDHIMATHI K', '64COMBED GOLD', 24.04, 1329.87, 2810.35, 1322.52, 100.56, 47.06, 0.8500, 0.0600, 510, 240, 1, false, NULL, '2025-12-25 08:17:42.650473+00', '2025-12-25 08:47:31.789758+00');
INSERT INTO public.lap_former_production_detail VALUES ('ce67ad79-7645-43fc-a272-0fb165fc7c13', '0f6acf36-d8a4-4dd9-b9bc-14cdfeba39ba', 'e78f9dac-5df8-4d38-bb6a-44d111b33bf1', 'MURUGESWARI. M', '64COMBED GOLD', 28.36, 1568.85, 3747.14, 1542.94, 101.68, 41.18, 0.8500, 0.0500, 510, 210, 1, false, NULL, '2025-12-25 08:17:42.650473+00', '2025-12-25 08:47:31.879286+00');


--
-- TOC entry 4574 (class 0 OID 45271)
-- Dependencies: 381
-- Data for Name: lap_former_production_header; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.lap_former_production_header VALUES ('0b559401-7226-45fd-8d54-8639193cb25c', 3, '2025-12-22', 1, NULL, NULL, 510, NULL, false, '2025-12-25 08:20:58.525444+00', '2025-12-25 08:20:58.525444+00');
INSERT INTO public.lap_former_production_header VALUES ('0f6acf36-d8a4-4dd9-b9bc-14cdfeba39ba', 2, '2025-12-25', 1, '5495cef5-e47d-42b3-88bc-cbba412fbbe4', NULL, 510, NULL, false, '2025-12-25 08:17:42.217688+00', '2025-12-25 08:21:19.043237+00');
INSERT INTO public.lap_former_production_header VALUES ('7e16c09d-6314-477b-940c-da11f1a2cae2', 5, '2025-12-23', 1, NULL, NULL, 510, NULL, false, '2025-12-25 08:46:31.114926+00', '2025-12-25 08:46:31.114926+00');
INSERT INTO public.lap_former_production_header VALUES ('4fdc8e80-8482-42a1-b1f5-ed2515631522', 6, '2025-12-24', 1, NULL, NULL, 510, NULL, false, '2025-12-25 08:46:36.527292+00', '2025-12-25 08:46:36.527292+00');
INSERT INTO public.lap_former_production_header VALUES ('b1332b10-c243-4061-ba93-869392eedd45', 7, '2025-12-21', 1, NULL, NULL, 510, NULL, false, '2025-12-25 08:46:42.548697+00', '2025-12-25 08:46:42.548697+00');
INSERT INTO public.lap_former_production_header VALUES ('9ab196a7-db18-4eba-9a18-110dcc21f969', 1, '2025-04-22', 1, '81a86e7e-8558-403b-86c6-b8327206d7fb', 'b99ebd36-b7c4-46b0-a53b-c763f3a5ae7d', 510, 'Sample Data from VB6', false, '2025-12-25 07:58:15.700425+00', '2025-12-25 08:47:20.911932+00');


--
-- TOC entry 4576 (class 0 OID 45343)
-- Dependencies: 383
-- Data for Name: lap_former_stoppage_entry; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.lap_former_stoppage_entry VALUES ('b484c138-326b-442e-9d1c-ca162f2f59b4', '6a44d0c9-f0aa-4974-833b-c67e1a84d77d', NULL, 0, NULL, 0, NULL, 0, NULL, 0, 0, false, '2025-12-25 08:20:58.913315+00', '2025-12-25 08:20:58.913315+00');
INSERT INTO public.lap_former_stoppage_entry VALUES ('6941f354-04bb-478b-8c3d-fb058cf954ea', '0e2be083-15cc-489f-8b4d-b90be5bc93ad', NULL, 0, NULL, 0, NULL, 0, NULL, 0, 0, false, '2025-12-25 08:20:58.913315+00', '2025-12-25 08:20:58.913315+00');
INSERT INTO public.lap_former_stoppage_entry VALUES ('07721f32-0652-4cdd-b341-a206825fe874', 'bdabd8d3-e2ba-4cdb-a2c2-7525b3d87e7f', NULL, 0, NULL, 0, NULL, 0, NULL, 0, 0, false, '2025-12-25 08:20:58.913315+00', '2025-12-25 08:20:58.913315+00');
INSERT INTO public.lap_former_stoppage_entry VALUES ('e942d52e-52a2-4cd4-8b93-f10aadbbb37d', '588a6755-75a1-49cc-9757-f3781386b871', '5ac34047-6276-475e-8d4f-95badb91afd8', 180, '3ab27a94-da2a-4300-9060-0aefb8d98157', 120, NULL, 0, NULL, 0, 300, false, '2025-12-25 08:40:31.401488+00', '2025-12-25 08:40:31.401488+00');
INSERT INTO public.lap_former_stoppage_entry VALUES ('e62894ca-5d13-4208-9205-b47ddd781a1e', '7095aa03-2d6b-4da2-a51e-8fdf53398dfb', '5ac34047-6276-475e-8d4f-95badb91afd8', 245, '902bfdc8-3e11-41f3-9040-05f7d2a787a7', 90, NULL, 0, NULL, 0, 335, false, '2025-12-25 08:40:31.401488+00', '2025-12-25 08:40:31.401488+00');
INSERT INTO public.lap_former_stoppage_entry VALUES ('91d70a41-d062-4e62-906c-8e60b0cfd9da', 'cb97521c-0fd2-4cb7-b453-fb6bc154b657', '5ac34047-6276-475e-8d4f-95badb91afd8', 270, NULL, 0, NULL, 0, NULL, 0, 270, false, '2025-12-25 08:40:31.401488+00', '2025-12-25 08:40:31.401488+00');
INSERT INTO public.lap_former_stoppage_entry VALUES ('314dea7e-992d-4916-8ee7-80f136475f28', '6fb86ed9-2592-4540-95e3-284e27acc4c8', NULL, 0, NULL, 0, NULL, 0, NULL, 0, 0, false, '2025-12-25 08:46:31.48039+00', '2025-12-25 08:46:31.48039+00');
INSERT INTO public.lap_former_stoppage_entry VALUES ('10adb1cc-e571-40e1-94c7-455aa50028e6', '491b46f7-36af-446f-8018-279eddd6d37a', NULL, 0, NULL, 0, NULL, 0, NULL, 0, 0, false, '2025-12-25 08:46:31.48039+00', '2025-12-25 08:46:31.48039+00');
INSERT INTO public.lap_former_stoppage_entry VALUES ('d6b87021-5045-411d-b88f-2470a5731e62', '609f12a0-783b-4ef1-a6c8-a5804536f41d', NULL, 0, NULL, 0, NULL, 0, NULL, 0, 0, false, '2025-12-25 08:46:31.48039+00', '2025-12-25 08:46:31.48039+00');
INSERT INTO public.lap_former_stoppage_entry VALUES ('3e32fac9-8c0c-48e9-bc06-146ddea568ef', '763a09cb-9775-4c5b-a6d9-58e53be5ba2b', NULL, 0, NULL, 0, NULL, 0, NULL, 0, 0, false, '2025-12-25 08:46:36.872809+00', '2025-12-25 08:46:36.872809+00');
INSERT INTO public.lap_former_stoppage_entry VALUES ('1028a508-6220-45ec-bad8-269d940eac6c', '8d66d945-ca75-4dc8-b2a7-d3c434b5de06', NULL, 0, NULL, 0, NULL, 0, NULL, 0, 0, false, '2025-12-25 08:46:36.872809+00', '2025-12-25 08:46:36.872809+00');
INSERT INTO public.lap_former_stoppage_entry VALUES ('aedba90d-d0fd-46c2-925f-b0f02fbf6e8e', '334810db-cc07-47d7-afd5-1422813c22be', NULL, 0, NULL, 0, NULL, 0, NULL, 0, 0, false, '2025-12-25 08:46:36.872809+00', '2025-12-25 08:46:36.872809+00');
INSERT INTO public.lap_former_stoppage_entry VALUES ('877ee542-2294-47b4-810c-6b159db7e702', '001e182b-f509-4295-8e38-d940ce889c9e', NULL, 0, NULL, 0, NULL, 0, NULL, 0, 0, false, '2025-12-25 08:46:42.907099+00', '2025-12-25 08:46:42.907099+00');
INSERT INTO public.lap_former_stoppage_entry VALUES ('131fd2b8-59cf-4c1c-afc2-a24c968e52ef', '9622f002-be21-44af-9458-dd740be39ab9', NULL, 0, NULL, 0, NULL, 0, NULL, 0, 0, false, '2025-12-25 08:46:42.907099+00', '2025-12-25 08:46:42.907099+00');
INSERT INTO public.lap_former_stoppage_entry VALUES ('fdab455f-7c55-4b6f-b0bd-28a50989537a', 'a798f8a2-7a8b-405d-af47-e7d1de4ef237', NULL, 0, NULL, 0, NULL, 0, NULL, 0, 0, false, '2025-12-25 08:46:42.907099+00', '2025-12-25 08:46:42.907099+00');
INSERT INTO public.lap_former_stoppage_entry VALUES ('02546101-0083-4129-81b4-4e573b7ca556', 'ce67ad79-7645-43fc-a272-0fb165fc7c13', '5ac34047-6276-475e-8d4f-95badb91afd8', 180, '3ab27a94-da2a-4300-9060-0aefb8d98157', 120, NULL, 0, NULL, 0, 300, true, '2025-12-25 08:17:42.812392+00', '2025-12-25 08:48:56.271833+00');
INSERT INTO public.lap_former_stoppage_entry VALUES ('d3577f5b-9d6b-4615-8288-7cd1f1ccd8b0', 'f7e7002e-4e31-4320-99d6-677a9be1c734', '5ac34047-6276-475e-8d4f-95badb91afd8', 245, '902bfdc8-3e11-41f3-9040-05f7d2a787a7', 90, NULL, 0, NULL, 0, 335, true, '2025-12-25 08:17:42.812392+00', '2025-12-25 08:48:56.271808+00');
INSERT INTO public.lap_former_stoppage_entry VALUES ('13150fee-145a-43e2-a856-16141836b2af', '476a2838-54e5-459e-b077-f8ca6584259d', '5ac34047-6276-475e-8d4f-95badb91afd8', 270, NULL, 0, NULL, 0, NULL, 0, 270, true, '2025-12-25 08:17:42.812392+00', '2025-12-25 08:48:56.286855+00');


--
-- TOC entry 4561 (class 0 OID 29214)
-- Dependencies: 367
-- Data for Name: simplex_machines; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.simplex_machines VALUES ('0080350e-0a60-40bb-87b5-040ee72cfb6e', '2', 'SIMPLEX2', 'LMW', 2, NULL, '64COMBED GOLD', 1040, 0.00, 92, 1.73, 140, '2015-04-01', true, false, false, '2025-12-02 18:31:19.091532+00', '2025-12-02 18:31:19.091532+00');
INSERT INTO public.simplex_machines VALUES ('882ae4b3-6640-45f8-8b15-6b7c558ffbdb', '3', 'SIMPLEX3', 'LMW', 3, NULL, '60CCT', 1050, 0.00, 92, 1.69, 140, '2015-04-01', true, false, false, '2025-12-02 18:31:19.091532+00', '2025-12-02 18:31:19.091532+00');
INSERT INTO public.simplex_machines VALUES ('4b0ebd26-d263-4957-ad26-cfff7e5e987b', '4', 'SIMPLEX4', 'LMW', 4, NULL, '60CC', 980, 0.00, 92, 1.73, 120, '2015-04-01', true, false, false, '2025-12-02 18:31:19.091532+00', '2025-12-02 18:31:19.091532+00');
INSERT INTO public.simplex_machines VALUES ('7f72578b-f0f3-4d10-93ae-4920416a98bb', '5', 'SIMPLEX5', 'LMW', 5, NULL, '60CC', 1050, 0.00, 92, 1.66, 140, '2015-04-01', true, false, false, '2025-12-02 18:31:19.091532+00', '2025-12-02 18:31:19.091532+00');
INSERT INTO public.simplex_machines VALUES ('345699f1-56ea-4f97-9cdb-146fd8d3479d', '6', 'SIMPLEX6', 'LMW', 6, NULL, '60CC', 980, 0.00, 92, 1.73, 120, '2015-04-01', true, false, false, '2025-12-02 18:31:19.091532+00', '2025-12-02 18:31:19.091532+00');
INSERT INTO public.simplex_machines VALUES ('b9b52000-f440-4b39-9ba5-03484d693fa3', '7', 'SIMPLEX7', 'LMW', 7, NULL, '64COMBED GOLD', 1050, 0.00, 92, 1.69, 120, '2015-04-01', true, false, false, '2025-12-02 18:31:19.091532+00', '2025-12-02 18:31:19.091532+00');
INSERT INTO public.simplex_machines VALUES ('319da3c4-93a5-4027-8f4b-c42e84979008', '8', 'SIMPLEX8', 'LMW', 8, NULL, '64COMBED GOLD', 1050, 0.00, 92, 1.69, 120, '2015-04-01', true, false, false, '2025-12-02 18:31:19.091532+00', '2025-12-02 18:31:19.091532+00');
INSERT INTO public.simplex_machines VALUES ('486aa484-c08e-42b1-9bdb-180e325b3e9f', '9', 'SIMPLEX9', 'LMW', 9, NULL, '60CC', 1040, 0.00, 92, 1.73, 120, '2015-04-01', true, false, false, '2025-12-02 18:31:19.091532+00', '2025-12-02 18:31:19.091532+00');
INSERT INTO public.simplex_machines VALUES ('ea7d270c-d8e7-4459-bee1-7360bea78484', '10', 'SIMPLEX10', 'LMW', 10, NULL, '64COMBED GOLD', 960, 0.00, 92, 1.69, 120, '2015-04-01', true, false, false, '2025-12-02 18:31:19.091532+00', '2025-12-02 18:31:19.091532+00');
INSERT INTO public.simplex_machines VALUES ('733a984d-003b-4a47-a264-f85392d1f396', '1', 'SIMPLEX1', 'LMW', 1, NULL, '64COMBED GOLD', 1040, 0.00, 92, 1.73, 140, '2015-04-01', true, false, false, '2025-12-02 18:31:19.091532+00', '2025-12-02 18:31:46.10411+00');


--
-- TOC entry 4553 (class 0 OID 18320)
-- Dependencies: 354
-- Data for Name: spinning_counts; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.spinning_counts VALUES ('7af227ed-0076-4831-a15c-ef9b07ae509a', '60 COMBED GOLD', NULL, 60.50, NULL, NULL, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-20 11:33:40.004752+00', '2025-11-20 11:33:40.004752+00', true);
INSERT INTO public.spinning_counts VALUES ('189038bf-a485-4cb2-b800-09304c0b20ef', '61 COMBED SPECIAL', NULL, 66.00, NULL, NULL, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-20 11:33:40.004752+00', '2025-11-20 11:33:40.004752+00', true);
INSERT INTO public.spinning_counts VALUES ('94a0d67c-f3bc-4320-b205-46bc1f3a3647', '62 COMBED COMPACT', NULL, 62.00, NULL, NULL, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-20 11:33:40.004752+00', '2025-11-20 11:33:40.004752+00', true);
INSERT INTO public.spinning_counts VALUES ('537e93b8-b6af-4893-b805-0cbf408e22d3', '63 COM GOLD', NULL, 64.50, NULL, NULL, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-20 11:33:40.004752+00', '2025-11-20 11:33:40.004752+00', true);
INSERT INTO public.spinning_counts VALUES ('760ceee3-f549-4ac9-92d9-9cfc185c23aa', '66 COMBED GOLD', NULL, 68.50, NULL, NULL, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-20 11:33:40.004752+00', '2025-11-20 11:33:40.004752+00', true);
INSERT INTO public.spinning_counts VALUES ('66fb2106-9aa5-46df-81bb-9ab842f33668', '66 COMBED STAR', NULL, 68.50, NULL, NULL, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-20 11:33:40.004752+00', '2025-11-20 11:33:40.004752+00', true);
INSERT INTO public.spinning_counts VALUES ('250369f8-98ed-4723-8670-9e7095349d0f', '64 COMBED', NULL, 66.00, NULL, NULL, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-20 11:33:40.004752+00', '2025-11-20 11:33:40.004752+00', true);
INSERT INTO public.spinning_counts VALUES ('b620a082-fdc4-47a4-978c-20d806a019c9', '60COME STAR', NULL, 60.50, NULL, NULL, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-20 11:33:40.004752+00', '2025-11-20 11:33:40.004752+00', true);
INSERT INTO public.spinning_counts VALUES ('b1817fe3-3721-4fdd-8f7c-78dc47d338ee', '65 COMBED STAR', NULL, 68.50, NULL, NULL, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-20 11:33:40.004752+00', '2025-11-20 11:33:40.004752+00', true);
INSERT INTO public.spinning_counts VALUES ('b856911c-ad44-4834-a177-29f1a92c6623', '60CCT', NULL, 60.50, NULL, NULL, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-20 11:33:40.004752+00', '2025-11-20 11:33:40.004752+00', true);
INSERT INTO public.spinning_counts VALUES ('78fcb201-0be9-46cf-99be-d2714379bad0', '65COMBED GOLD', NULL, 68.50, NULL, NULL, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-20 11:33:40.004752+00', '2025-11-20 11:33:40.004752+00', true);
INSERT INTO public.spinning_counts VALUES ('50bfc2cc-a4ec-4739-a238-4809c40d7b64', '60cs STAR', NULL, 60.50, NULL, NULL, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-20 11:33:40.004752+00', '2025-11-20 11:33:40.004752+00', true);
INSERT INTO public.spinning_counts VALUES ('c9882c52-ad63-44f8-a259-17af93aaf089', '6 COMPACT STAR', NULL, 66.00, NULL, NULL, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-20 11:33:40.004752+00', '2025-11-20 11:33:40.004752+00', true);
INSERT INTO public.spinning_counts VALUES ('3c05cb01-46bf-49ba-a7b1-c4a8e943f6d8', '6 COMBED COMPACT', NULL, 61.80, NULL, NULL, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-20 11:33:40.004752+00', '2025-11-20 11:33:40.004752+00', true);
INSERT INTO public.spinning_counts VALUES ('79852752-f6b6-4f48-900a-c61e628ba195', '68 COMBED STAR', NULL, 69.50, NULL, NULL, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-20 11:33:40.004752+00', '2025-11-20 11:33:40.004752+00', true);
INSERT INTO public.spinning_counts VALUES ('890c5ae8-0a0b-480b-8bc0-f80f7ca4245a', '6 COMBED DIAMOND', NULL, 61.80, NULL, NULL, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-20 11:33:40.004752+00', '2025-11-20 11:33:40.004752+00', true);
INSERT INTO public.spinning_counts VALUES ('8f1030fc-a8d8-41e7-b0de-41a50570f81f', '92 COMBED WARP', NULL, 93.00, NULL, NULL, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-20 11:33:40.004752+00', '2025-11-20 11:33:40.004752+00', true);
INSERT INTO public.spinning_counts VALUES ('2d9128f7-3c31-40c3-9f78-852c290faf80', '80 COMBED COMPACT WARP', NULL, 80.50, NULL, NULL, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-20 11:33:40.004752+00', '2025-11-20 11:33:40.004752+00', true);
INSERT INTO public.spinning_counts VALUES ('ddfdbf45-9e16-4e8c-aaf8-ba7bd5e831f0', '91 COMBED WARP', NULL, 91.00, NULL, NULL, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-20 11:33:40.004752+00', '2025-11-20 11:33:40.004752+00', true);
INSERT INTO public.spinning_counts VALUES ('d0e3fdf7-bb5d-46cb-9aec-21ad02fa8844', '80 COMBED WARP', NULL, 80.50, NULL, NULL, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-20 11:33:40.004752+00', '2025-11-20 11:33:40.004752+00', true);
INSERT INTO public.spinning_counts VALUES ('215b21eb-7a56-429a-bb7b-f9a9e9d2e285', '60COM COMPACT', NULL, 60.50, NULL, NULL, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, '10', NULL, NULL, NULL, 20.00, NULL, NULL, NULL, '2025-11-20 11:33:40.004752+00', '2025-11-20 11:33:40.004752+00', true);


--
-- TOC entry 4540 (class 0 OID 17758)
-- Dependencies: 341
-- Data for Name: spinning_machines; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.spinning_machines VALUES ('a6247722-606d-4c91-bff3-5fa4fe3ed87e', '17', 'RF17', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('eee21509-cca1-4d8a-9a27-14a2f8563ede', '18', 'RF18', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('abf19c79-1c1f-44df-8baa-3f59deb710c2', '19', 'RF19', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('a69b8e15-2b30-4c4a-8eb2-1c95e634ecaa', '20', 'RF20', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('8388bd45-b7a5-4e90-b57f-16257da4fe81', '21', 'RF21', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('22d1a96e-2c1d-41b6-9e66-b630f92b947d', '22', 'RF22', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('5e9b44d7-e805-4d26-bc22-49041c621fd1', '23', 'RF23', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('127dc4c3-1f56-4c0b-9afa-9619b3a032fd', '24', 'RF24', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('5d48086c-a5d5-402c-87b8-7669a86ead8b', '25', 'RF25', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('d37796b8-f087-4b74-89da-39fd621e5f4d', '26', 'RF26', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('c463a9d6-6426-40a6-9742-f2c3acd0b743', '27', 'RF27', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('5f7c5333-b7dc-4031-91b9-ab3fb965628b', '28', 'RF28', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('a4093925-5d82-471a-b5d6-5148c3efe5d6', '29', 'RF29', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('372c4df6-1e6c-48f7-a937-73c0f780eace', '30', 'RF30', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('ce214858-5aca-4023-8a8d-7f2effab83bd', '31', 'RF31', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('fb0feb16-bd0b-4d08-b213-8e1989a8fd84', '32', 'RF32', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('3d738c60-028f-4e97-a22a-23b6ade6851a', '33', 'RF33', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('b1235dd8-2b76-4a11-91ca-64cd76270e8e', '34', 'RF34', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('fcb0dd0b-5e5d-4952-ad98-34abf44e47ec', '35', 'RF35', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('f55146ac-5b60-433b-a57c-380c7f6a176c', '36', 'RF36', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('5513e9fc-c47a-49a7-a240-4367e7b5de76', '37', 'RF37', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('4ea7b035-29be-44bc-8a2c-cbf7886aba1c', '38', 'RF38', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('aec3138b-4884-4ad9-b9b2-aedc9f6d21ec', '39', 'RF39', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('c9d865a3-661c-4ae0-bb3b-ff617d2772b5', '40', 'RF40', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('f3097249-7167-4494-8123-f5abd955c69a', '41', 'RF41', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('31059541-7c9f-40aa-8c63-1c259fcb7ef6', '42', 'RF42', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('c0627a7c-7a42-4d65-b7c9-188e41c4e7e3', '43', 'RF43', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('a9988d69-a7c5-4423-8233-ae71c401da8e', '44', 'RF44', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('6a79048a-71c9-46ed-8c9c-2196d1ee40f9', '45', 'RF45', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('8616bead-9af6-4f09-a7b4-12578b118e14', '46', 'RF46', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('3c44178b-c355-40ed-a334-da5ea6c3692d', '47', 'RF47', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('15945d42-8cd7-4a83-badf-cdebb008b92a', '1A', 'RF1A', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);
INSERT INTO public.spinning_machines VALUES ('33d57714-a572-4d2b-ab2f-15f91bd6caf5', '2A', 'RF2A', 'LMW', 1104, true, NULL, '2025-11-19 18:55:36.736357+00', '2025-11-19 18:55:36.736357+00', NULL, '225', NULL, 0, '2015-04-01', false, true);


--
-- TOC entry 4542 (class 0 OID 17786)
-- Dependencies: 343
-- Data for Name: stoppage_details; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.stoppage_details VALUES ('169813cb-866d-492e-aade-f5903979c3b0', '7bc7306a-6430-40e6-b3ac-c238491a95e8', 1447, 'Employee lazy work', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'LAZY WORK', 'LW', NULL, '1b06751e-182c-4a49-9676-f8962fb2cf8b');
INSERT INTO public.stoppage_details VALUES ('297e18be-e452-4a28-96a0-a9b8fb7de573', '7bf54e5d-c5ba-41fc-afda-1feec4a6e462', 1448, 'Susson gear box malfunction', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'SUSSON GEAR BOX PROBLEM', 'SGP', NULL, 'da627794-4405-45c9-a3cf-4801f5dd1b5b');
INSERT INTO public.stoppage_details VALUES ('5f201b9f-dd1c-4588-bd3c-8a27ec20f50a', '91020da1-c429-4263-b9d8-947cff16b801', 1449, 'Ring replacement', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'ABC RING CHANGE', 'ARC', NULL, 'da627794-4405-45c9-a3cf-4801f5dd1b5b');
INSERT INTO public.stoppage_details VALUES ('96219843-35aa-4521-a173-d590556129ea', '7bf54e5d-c5ba-41fc-afda-1feec4a6e462', 1450, 'Front roll issue', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'FRONT ROLL PROBLEM', 'FRP', NULL, 'da627794-4405-45c9-a3cf-4801f5dd1b5b');
INSERT INTO public.stoppage_details VALUES ('335aa8c4-3b81-47b7-8a12-ac8930cf3d90', '7bf54e5d-c5ba-41fc-afda-1feec4a6e462', 1451, 'Doffing limit sensor issue', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'DOFFING LIMIT PROBLEM', 'DLP', NULL, 'da627794-4405-45c9-a3cf-4801f5dd1b5b');
INSERT INTO public.stoppage_details VALUES ('7f07a376-e196-481b-b6ba-f7fe73cf295e', '7bf54e5d-c5ba-41fc-afda-1feec4a6e462', 1452, 'Bottom roll malfunction', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'BOTTOM ROLL PROBLEM', 'BRP', NULL, 'da627794-4405-45c9-a3cf-4801f5dd1b5b');
INSERT INTO public.stoppage_details VALUES ('7d4b687c-8c26-4516-ab3d-48a7d7a47bd8', '7bc7306a-6430-40e6-b3ac-c238491a95e8', 1453, 'TPU tripped', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'TPU TRIP', 'TT', NULL, 'da627794-4405-45c9-a3cf-4801f5dd1b5b');
INSERT INTO public.stoppage_details VALUES ('c7337005-1b15-4e74-ba53-7cc9db4e0eb8', '7bc7306a-6430-40e6-b3ac-c238491a95e8', 1454, 'ACB circuit breaker trip', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'ACB TRIP', 'AT', NULL, '4a9ecf36-a3cc-4ebb-bba6-96740ace9bd2');
INSERT INTO public.stoppage_details VALUES ('26511e65-b7a0-464f-899d-158968ae2686', '7bf54e5d-c5ba-41fc-afda-1feec4a6e462', 1455, 'Roll stand issue', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'ROLL STAND PROBLEM', 'RSP', NULL, 'da627794-4405-45c9-a3cf-4801f5dd1b5b');
INSERT INTO public.stoppage_details VALUES ('115ca2dd-764f-4e44-a0b6-82299659c174', '91020da1-c429-4263-b9d8-947cff16b801', 1456, 'Drafting roller maintenance', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'DRAFTING ROLLER SERVICE', 'DRS', NULL, 'acf83311-0ec5-45a1-b61b-e8ea14f88362');
INSERT INTO public.stoppage_details VALUES ('86fc4a60-c857-44ea-894f-af66451bb9ed', '7bc7306a-6430-40e6-b3ac-c238491a95e8', 1457, 'Convertor failure', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'CONVERTOR PROBLEM', 'CP', NULL, '4a9ecf36-a3cc-4ebb-bba6-96740ace9bd2');
INSERT INTO public.stoppage_details VALUES ('8c176612-bb1e-4c1f-86e6-13290ed5ac85', '7bf54e5d-c5ba-41fc-afda-1feec4a6e462', 1458, 'Flyer maintenance', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'FLYER SERVICE', 'FS', NULL, 'f33d2269-9ff9-4711-a1eb-5b50bca1b914');
INSERT INTO public.stoppage_details VALUES ('7989f226-8699-484c-b67c-c679acaf95a8', '7bf54e5d-c5ba-41fc-afda-1feec4a6e462', 1459, 'Ring rail handle issue', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'RING RAIL HANDLE PROBLEM', 'RHP', NULL, 'da627794-4405-45c9-a3cf-4801f5dd1b5b');
INSERT INTO public.stoppage_details VALUES ('1a9f7daf-78b9-4600-8a0a-c57c50a5dd27', '7bf54e5d-c5ba-41fc-afda-1feec4a6e462', 1460, 'Top arm pressure lock', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'TOP ARM PRESSURE LOCK PROBLEM', 'TAP', NULL, 'acf83311-0ec5-45a1-b61b-e8ea14f88362');
INSERT INTO public.stoppage_details VALUES ('e414abf7-9f8b-401a-a845-f80f4855272c', '7bf54e5d-c5ba-41fc-afda-1feec4a6e462', 1461, 'Drafting arm nose issue', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'DRAFTING ARM NOSE PROBLEM', 'DNP', NULL, 'da627794-4405-45c9-a3cf-4801f5dd1b5b');
INSERT INTO public.stoppage_details VALUES ('91036ef8-acf8-4795-961b-a6d0cad2cddf', '7bc7306a-6430-40e6-b3ac-c238491a95e8', 1462, 'SSB cable fault', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'SSB CABLE PROBLEM', 'SCP', NULL, 'da627794-4405-45c9-a3cf-4801f5dd1b5b');
INSERT INTO public.stoppage_details VALUES ('ccb4e5e7-ec8c-4d7a-b3b8-3441e2439708', '7bc7306a-6430-40e6-b3ac-c238491a95e8', 1463, 'Suction system failure', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'SUCTION PROBLEM', 'SP', NULL, 'b1c5df2c-eeb2-4453-9f98-29f19b8c8664');
INSERT INTO public.stoppage_details VALUES ('f67aa62d-9584-4098-9b93-855d24cf999e', '7bc7306a-6430-40e6-b3ac-c238491a95e8', 1464, 'Invertor programming', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'INVERTOR PROGRAME WORK', 'IPW', NULL, 'da627794-4405-45c9-a3cf-4801f5dd1b5b');
INSERT INTO public.stoppage_details VALUES ('1e6bd7db-fac6-4631-b846-6c08f19fdd0e', '7bf54e5d-c5ba-41fc-afda-1feec4a6e462', 1465, 'Five level adjustment', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'FIVE LEVEL SETTING', 'FLS', NULL, '1b06751e-182c-4a49-9676-f8962fb2cf8b');
INSERT INTO public.stoppage_details VALUES ('418e35d6-f340-441c-a329-140357151202', '91020da1-c429-4263-b9d8-947cff16b801', 1466, 'Individual spindle issue', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'INDY PROBLEM', 'IP', NULL, 'f33d2269-9ff9-4711-a1eb-5b50bca1b914');
INSERT INTO public.stoppage_details VALUES ('2880a579-5b20-40a6-bf06-2cb29d933ea7', '7bf54e5d-c5ba-41fc-afda-1feec4a6e462', 1467, 'Bearing replacement', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'BEARING CHANGE', 'BC', NULL, '17936d00-5703-4f31-bfe8-37dbcf7a08ec');
INSERT INTO public.stoppage_details VALUES ('3f6cea65-7ed6-4bed-affe-16eee0917577', 'c3311c7c-8339-43a2-a08e-e0eaffa90ed6', 1468, 'Machine dismantling', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'DISMANDLING', 'DM', NULL, 'da627794-4405-45c9-a3cf-4801f5dd1b5b');
INSERT INTO public.stoppage_details VALUES ('5eaa6749-b7d3-45b1-a142-bd4ea3fda2a9', '7bf54e5d-c5ba-41fc-afda-1feec4a6e462', 1469, 'Piston soft work', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'PISTON SOFT WORK', 'PSW', NULL, 'a9e182d3-4cf5-4c58-b42c-0efc04f3e3b5');
INSERT INTO public.stoppage_details VALUES ('4a1a1ddd-c2d2-4943-a012-bb5229820306', '91020da1-c429-4263-b9d8-947cff16b801', 1470, 'Drafting service', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'DRAFTING SERVICES', 'DS', NULL, 'f33d2269-9ff9-4711-a1eb-5b50bca1b914');
INSERT INTO public.stoppage_details VALUES ('075f5699-180b-4058-a45b-ea23b7ff3b21', '7bf54e5d-c5ba-41fc-afda-1feec4a6e462', 1471, 'Gear box malfunction', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'GEAR BOX PROBLEM', 'GBP', NULL, 'da627794-4405-45c9-a3cf-4801f5dd1b5b');
INSERT INTO public.stoppage_details VALUES ('87c1f8ec-7ff8-489e-b669-8397eded8d38', '7bf54e5d-c5ba-41fc-afda-1feec4a6e462', 1472, 'Suction pressure issue', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'SUCTION PRESSURE PROBLEM', 'SPP', NULL, '1b06751e-182c-4a49-9676-f8962fb2cf8b');
INSERT INTO public.stoppage_details VALUES ('d4ced0fb-95e9-4282-895f-6ae6632253bf', 'c3311c7c-8339-43a2-a08e-e0eaffa90ed6', 1473, 'Civil construction work', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'CIVIL WORK', 'CW', NULL, 'da627794-4405-45c9-a3cf-4801f5dd1b5b');
INSERT INTO public.stoppage_details VALUES ('777b0671-1235-455e-9aa9-c289cca7f638', '7bf54e5d-c5ba-41fc-afda-1feec4a6e462', 1474, 'Drafting setting', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'DRAFTING SETTING WORK', 'DSW', NULL, 'a9e182d3-4cf5-4c58-b42c-0efc04f3e3b5');
INSERT INTO public.stoppage_details VALUES ('62838e42-8524-4b77-8713-ba6242eafcd9', '91020da1-c429-4263-b9d8-947cff16b801', 1475, 'Cradle cleaning', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'CRADLE CLEANING WORK', 'CCW', NULL, 'da627794-4405-45c9-a3cf-4801f5dd1b5b');
INSERT INTO public.stoppage_details VALUES ('978b2523-f7e2-41ef-a7da-8fd0a8c58ce8', '7bf54e5d-c5ba-41fc-afda-1feec4a6e462', 1476, 'Dead box maintenance', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'DEAD BOX WORK', 'DBW', NULL, '1b06751e-182c-4a49-9676-f8962fb2cf8b');
INSERT INTO public.stoppage_details VALUES ('78688a49-b772-4a2b-97bb-a3b86179017b', '7bc7306a-6430-40e6-b3ac-c238491a95e8', 1477, 'Empty movement sensor', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'EMPTIES MOVEMENT/CYLINDERS SENSOR PROBLEM', 'EMP', NULL, 'da627794-4405-45c9-a3cf-4801f5dd1b5b');
INSERT INTO public.stoppage_details VALUES ('16878807-212f-4534-9850-7aa626ceaee9', '7bf54e5d-c5ba-41fc-afda-1feec4a6e462', 1478, 'Empties movement issue', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'EMPTIES MOVEMENT PROBLEM', 'EMP2', NULL, '4a9ecf36-a3cc-4ebb-bba6-96740ace9bd2');
INSERT INTO public.stoppage_details VALUES ('f5b955d9-7324-47d1-ab6d-e760105a4ca1', '7bf54e5d-c5ba-41fc-afda-1feec4a6e462', 1479, 'Line locking problem', true, '2025-11-20 09:52:32.78902+00', '2025-11-20 09:52:32.78902+00', 'LINE LOOKING PROBLEM', 'LLP', NULL, 'da627794-4405-45c9-a3cf-4801f5dd1b5b');
INSERT INTO public.stoppage_details VALUES ('9e2cddae-dca8-420c-93ab-a21d3c04f7b8', 'c3311c7c-8339-43a2-a08e-e0eaffa90ed6', 1500, 'Excess stock stoppage', true, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00', 'EXCESS STOCK', 'EXS', NULL, '1b06751e-182c-4a49-9676-f8962fb2cf8b');
INSERT INTO public.stoppage_details VALUES ('b5a6a520-2e01-4f05-9367-cfb94340cc05', 'c3311c7c-8339-43a2-a08e-e0eaffa90ed6', 1501, 'Daily cleaning work', true, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00', 'DAILY CLEANING', 'DC', NULL, '1b06751e-182c-4a49-9676-f8962fb2cf8b');
INSERT INTO public.stoppage_details VALUES ('f94d5ad6-0d83-4b00-8b1c-0fe20386cb23', 'c3311c7c-8339-43a2-a08e-e0eaffa90ed6', 1502, 'Gear box maintenance', true, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00', 'GEAR BOX WORK', 'GEW', NULL, '1b06751e-182c-4a49-9676-f8962fb2cf8b');
INSERT INTO public.stoppage_details VALUES ('8f7e3c0e-c29c-4758-acb6-a2cb0a7f6a0f', 'c3311c7c-8339-43a2-a08e-e0eaffa90ed6', 1503, 'Card clothing replacement', true, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00', 'CARD CLOTHING CHANGE', 'CCC', NULL, '1b06751e-182c-4a49-9676-f8962fb2cf8b');
INSERT INTO public.stoppage_details VALUES ('82996434-73aa-41c7-bdea-d93c9fe3df10', 'c3311c7c-8339-43a2-a08e-e0eaffa90ed6', 1504, 'Coiler malfunction', true, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00', 'COILER PROBLEM', 'CLP', NULL, '1b06751e-182c-4a49-9676-f8962fb2cf8b');
INSERT INTO public.stoppage_details VALUES ('82cce5a5-73b3-4d8c-aa56-7c3e827a357f', 'c3311c7c-8339-43a2-a08e-e0eaffa90ed6', 1505, 'Doffer issue', true, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00', 'DOFFER PROBLEM', 'DFP', NULL, '1b06751e-182c-4a49-9676-f8962fb2cf8b');
INSERT INTO public.stoppage_details VALUES ('a24a9353-0b7b-4c01-b007-176f5625b811', 'c3311c7c-8339-43a2-a08e-e0eaffa90ed6', 1506, 'Material unavailable', true, '2025-12-21 12:43:51.458899+00', '2025-12-21 12:43:51.458899+00', 'MATERIAL SHORTAGE', 'MS', NULL, '1b06751e-182c-4a49-9676-f8962fb2cf8b');
INSERT INTO public.stoppage_details VALUES ('9be428ba-5d34-436c-9865-b7a86ec4f3ad', 'c3311c7c-8339-43a2-a08e-e0eaffa90ed6', 1510, 'Excess stock stoppage', true, '2025-12-21 17:22:40.699282+00', '2025-12-21 17:22:40.699282+00', 'EXCESS STOCK', 'EWZ', NULL, 'b1c5df2c-eeb2-4453-9f98-29f19b8c8664');
INSERT INTO public.stoppage_details VALUES ('a9d151ca-4604-4444-93ee-becc9e682a2e', 'c3311c7c-8339-43a2-a08e-e0eaffa90ed6', 1511, 'BSS stoppage', true, '2025-12-21 17:22:40.699282+00', '2025-12-21 17:22:40.699282+00', 'BSS', 'BN', NULL, 'b1c5df2c-eeb2-4453-9f98-29f19b8c8664');
INSERT INTO public.stoppage_details VALUES ('87adb281-c290-4a01-af48-43aeb6b94360', 'c3311c7c-8339-43a2-a08e-e0eaffa90ed6', 1512, 'Air cleaning work', true, '2025-12-21 17:22:40.699282+00', '2025-12-21 17:22:40.699282+00', 'AIR CLEANING', 'AIL', NULL, 'b1c5df2c-eeb2-4453-9f98-29f19b8c8664');
INSERT INTO public.stoppage_details VALUES ('c8d3cd98-726c-467d-a4e1-6ce883a5e190', 'c3311c7c-8339-43a2-a08e-e0eaffa90ed6', 1513, 'Coiler malfunction', true, '2025-12-21 17:22:40.699282+00', '2025-12-21 17:22:40.699282+00', 'COILER PROBLEM', 'CLP', NULL, 'b1c5df2c-eeb2-4453-9f98-29f19b8c8664');
INSERT INTO public.stoppage_details VALUES ('0cce93f9-99c3-4a70-a010-c50fda57c184', 'c3311c7c-8339-43a2-a08e-e0eaffa90ed6', 1514, 'Suction system failure', true, '2025-12-21 17:22:40.699282+00', '2025-12-21 17:22:40.699282+00', 'SUCTION PROBLEM', 'SP', NULL, 'b1c5df2c-eeb2-4453-9f98-29f19b8c8664');
INSERT INTO public.stoppage_details VALUES ('bbc061d2-87d8-4d45-b222-a20855d3ef3f', 'c3311c7c-8339-43a2-a08e-e0eaffa90ed6', 1515, 'Material unavailable', true, '2025-12-21 17:22:40.699282+00', '2025-12-21 17:22:40.699282+00', 'MATERIAL SHORTAGE', 'MS', NULL, 'b1c5df2c-eeb2-4453-9f98-29f19b8c8664');
INSERT INTO public.stoppage_details VALUES ('4fd9331d-fc4c-40d3-ad72-d210750a687b', 'c3311c7c-8339-43a2-a08e-e0eaffa90ed6', 1516, 'Drafting roller maintenance', true, '2025-12-21 17:22:40.699282+00', '2025-12-21 17:22:40.699282+00', 'DRAFTING ROLLER SERVICE', 'DRS', NULL, 'b1c5df2c-eeb2-4453-9f98-29f19b8c8664');
INSERT INTO public.stoppage_details VALUES ('5ac34047-6276-475e-8d4f-95badb91afd8', 'c3311c7c-8339-43a2-a08e-e0eaffa90ed6', 1520, 'Excess stock stoppage - Lap Former', true, '2025-12-25 07:58:15.700425+00', '2025-12-25 07:58:15.700425+00', 'EXCESS STOCK', 'EIO', NULL, 'a9e182d3-4cf5-4c58-b42c-0efc04f3e3b5');
INSERT INTO public.stoppage_details VALUES ('3ab27a94-da2a-4300-9060-0aefb8d98157', 'c3311c7c-8339-43a2-a08e-e0eaffa90ed6', 1521, 'Spool change problem', true, '2025-12-25 07:58:15.700425+00', '2025-12-25 07:58:15.700425+00', 'SPOOL CHANGE PROBLEM', 'SCP', NULL, 'a9e182d3-4cf5-4c58-b42c-0efc04f3e3b5');
INSERT INTO public.stoppage_details VALUES ('902bfdc8-3e11-41f3-9040-05f7d2a787a7', 'c3311c7c-8339-43a2-a08e-e0eaffa90ed6', 1522, 'Erector work stoppage', true, '2025-12-25 07:58:15.700425+00', '2025-12-25 07:58:15.700425+00', 'ERECTOR WORK', 'EW', NULL, 'a9e182d3-4cf5-4c58-b42c-0efc04f3e3b5');


--
-- TOC entry 4541 (class 0 OID 17773)
-- Dependencies: 342
-- Data for Name: stoppage_heads; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.stoppage_heads VALUES ('7bc7306a-6430-40e6-b3ac-c238491a95e8', 'ELECT. BREAKDOWN', true, '2025-11-19 18:55:36.736357+00', '2025-11-20 09:01:34.743205+00', 2, NULL);
INSERT INTO public.stoppage_heads VALUES ('7019ee45-c528-4d18-a4d2-84fd9e41a8d0', 'ELECT. ROUTINE', true, '2025-11-19 18:55:36.736357+00', '2025-11-20 09:01:34.743205+00', 3, NULL);
INSERT INTO public.stoppage_heads VALUES ('7bf54e5d-c5ba-41fc-afda-1feec4a6e462', 'MAINTEN. BREAKDOWN', true, '2025-11-19 18:55:36.736357+00', '2025-11-20 09:01:34.743205+00', 4, NULL);
INSERT INTO public.stoppage_heads VALUES ('91020da1-c429-4263-b9d8-947cff16b801', 'MAINTEN. ROUTINE', true, '2025-11-19 18:55:36.736357+00', '2025-11-20 09:01:34.743205+00', 5, NULL);
INSERT INTO public.stoppage_heads VALUES ('b9571589-a8ab-473e-b09a-f70eb666a570', 'POWER. SHOUTDOWN', true, '2025-11-19 18:55:36.736357+00', '2025-11-20 09:01:34.743205+00', 6, NULL);
INSERT INTO public.stoppage_heads VALUES ('95b7aa76-20d8-4fa8-b720-7d9d6e9e04f6', 'POWER FAILURE', true, '2025-11-19 18:55:36.736357+00', '2025-11-20 09:01:34.743205+00', 7, NULL);
INSERT INTO public.stoppage_heads VALUES ('c3311c7c-8339-43a2-a08e-e0eaffa90ed6', 'OTHERS', true, '2025-11-19 18:55:36.736357+00', '2025-11-20 09:01:34.743205+00', 8, NULL);
INSERT INTO public.stoppage_heads VALUES ('79740698-7791-404b-b738-e51d65ae001c', 'ERECTION WORK', true, '2025-11-19 18:55:36.736357+00', '2025-11-20 09:01:34.743205+00', 9, NULL);
INSERT INTO public.stoppage_heads VALUES ('45346171-4565-492d-8a71-0d7612525a4c', 'QAO', true, '2025-11-19 18:55:36.736357+00', '2025-11-20 09:01:34.743205+00', 10, NULL);
INSERT INTO public.stoppage_heads VALUES ('0b1bd4d3-0724-4216-aab2-63bc592445e2', 'CLEANING WORK', true, '2025-11-19 18:55:36.736357+00', '2025-11-20 09:17:44.42562+00', 1, NULL);


--
-- TOC entry 4543 (class 0 OID 17836)
-- Dependencies: 344
-- Data for Name: supervisors; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.supervisors VALUES ('087b99d0-7531-40c3-b301-ba5afe9047c4', 'nil', 'da627794-4405-45c9-a3cf-4801f5dd1b5b', true, '2025-11-24 07:17:31.745767+00', '2025-11-24 07:18:28.993602+00', 1);
INSERT INTO public.supervisors VALUES ('81a86e7e-8558-403b-86c6-b8327206d7fb', 'CHINNADURA.R', 'da627794-4405-45c9-a3cf-4801f5dd1b5b', true, '2025-11-24 07:17:31.745767+00', '2025-11-24 07:18:38.371453+00', 2);
INSERT INTO public.supervisors VALUES ('12ba5e3c-d41b-4e85-a6d6-aaf2cfe2983c', 'SUBRAMANIAN.A', 'da627794-4405-45c9-a3cf-4801f5dd1b5b', true, '2025-11-24 07:17:31.745767+00', '2025-11-24 07:18:48.234558+00', 3);
INSERT INTO public.supervisors VALUES ('b99ebd36-b7c4-46b0-a53b-c763f3a5ae7d', 'A.NAMBRI RAJ', 'da627794-4405-45c9-a3cf-4801f5dd1b5b', true, '2025-11-24 07:17:31.745767+00', '2025-11-24 07:18:59.351769+00', 4);
INSERT INTO public.supervisors VALUES ('df30474a-4963-492a-a437-1e6105a74f3c', 'SAKARA.RAM.G', 'da627794-4405-45c9-a3cf-4801f5dd1b5b', true, '2025-11-24 07:17:31.745767+00', '2025-11-24 07:19:08.969069+00', 5);
INSERT INTO public.supervisors VALUES ('5495cef5-e47d-42b3-88bc-cbba412fbbe4', 'BALASUBRAMANIAN', 'da627794-4405-45c9-a3cf-4801f5dd1b5b', true, '2025-11-24 07:17:31.745767+00', '2025-11-24 07:19:19.256737+00', 6);
INSERT INTO public.supervisors VALUES ('65230e5c-c7e5-4186-8860-c78b846e9a32', 'SASIKUMAR', 'da627794-4405-45c9-a3cf-4801f5dd1b5b', true, '2025-11-24 07:17:31.745767+00', '2025-11-24 07:19:30.912149+00', 7);
INSERT INTO public.supervisors VALUES ('6d801d82-b16f-41ac-94ee-043c98f9a6d9', 'THANGARA.J.P', 'da627794-4405-45c9-a3cf-4801f5dd1b5b', true, '2025-11-24 07:17:31.745767+00', '2025-11-24 07:19:38.224685+00', 8);
INSERT INTO public.supervisors VALUES ('01bb052c-23d7-4f2c-ad11-6826bd6ae3dd', 'KALINITH.M.K', 'da627794-4405-45c9-a3cf-4801f5dd1b5b', true, '2025-11-24 07:17:31.745767+00', '2025-11-24 07:19:45.248812+00', 9);
INSERT INTO public.supervisors VALUES ('24fedaba-bc65-40d1-8794-b902ec75b6d6', 'PRAKASH Y', 'da627794-4405-45c9-a3cf-4801f5dd1b5b', true, '2025-11-24 07:17:31.745767+00', '2025-11-24 07:19:52.30994+00', 10);
INSERT INTO public.supervisors VALUES ('b32fb2b5-4a7f-4aae-9af8-f80037ddc215', 'N ESTHIAPPAN', 'da627794-4405-45c9-a3cf-4801f5dd1b5b', true, '2025-11-24 07:17:31.745767+00', '2025-11-24 07:19:58.920258+00', 11);


--
-- TOC entry 4545 (class 0 OID 17869)
-- Dependencies: 346
-- Data for Name: tpi_entries; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.tpi_entries VALUES ('787d477c-5502-4519-b5d0-2696ef341dda', '2018-02-04', '66fb2106-9aa5-46df-81bb-9ab842f33668', 30.81, NULL, 'B', 'Regular monitoring', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 34);
INSERT INTO public.tpi_entries VALUES ('27367a56-cb33-47ed-9fab-f7f8b5547631', '2018-02-08', '215b21eb-7a56-429a-bb7b-f9a9e9d2e285', 33.95, NULL, 'A', 'Quality check', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 35);
INSERT INTO public.tpi_entries VALUES ('748929eb-309d-4189-871b-96da178c9f03', '2018-02-23', '215b21eb-7a56-429a-bb7b-f9a9e9d2e285', 33.13, NULL, 'C', 'Shift test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 36);
INSERT INTO public.tpi_entries VALUES ('bb888b6d-2130-4378-844b-65a920f56f0a', '2018-06-18', '66fb2106-9aa5-46df-81bb-9ab842f33668', 31.56, NULL, 'A', 'Quality test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 37);
INSERT INTO public.tpi_entries VALUES ('bdaa1e15-dda1-4738-b761-abb6f5128302', '2018-06-18', 'b620a082-fdc4-47a4-978c-20d806a019c9', 27.96, NULL, 'B', 'Parallel test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 38);
INSERT INTO public.tpi_entries VALUES ('b5eea7ff-5ca9-4f75-8504-989b086c4d1c', '2018-07-10', 'b620a082-fdc4-47a4-978c-20d806a019c9', 27.29, NULL, 'A', 'Morning shift', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 39);
INSERT INTO public.tpi_entries VALUES ('26b72f83-0c28-488b-b79d-067da087d181', '2018-07-10', '66fb2106-9aa5-46df-81bb-9ab842f33668', 30.81, NULL, 'B', 'Evening shift', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 40);
INSERT INTO public.tpi_entries VALUES ('21846239-10b4-44ae-a60f-914247dfba7f', '2018-08-28', 'c9882c52-ad63-44f8-a259-17af93aaf089', 28.60, NULL, 'A', 'Quality monitoring', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 41);
INSERT INTO public.tpi_entries VALUES ('865e9255-cd7e-4daf-99af-bf71315538af', '2018-09-02', 'c9882c52-ad63-44f8-a259-17af93aaf089', 29.35, NULL, 'B', 'Regular test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 42);
INSERT INTO public.tpi_entries VALUES ('9aa2a967-0c85-4a8d-b6f7-efded16790d6', '2019-03-17', '79852752-f6b6-4f48-900a-c61e628ba195', 31.56, NULL, 'A', 'Quality check', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 43);
INSERT INTO public.tpi_entries VALUES ('f895e062-7efe-48cb-8318-45c360309f0d', '2019-04-05', '66fb2106-9aa5-46df-81bb-9ab842f33668', 31.56, NULL, 'B', 'Shift monitoring', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 44);
INSERT INTO public.tpi_entries VALUES ('68d344ca-1d24-44e7-af16-b8c80a1f6733', '2019-04-16', '3c05cb01-46bf-49ba-a7b1-c4a8e943f6d8', 33.95, NULL, 'A', 'Production test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 45);
INSERT INTO public.tpi_entries VALUES ('b83820ff-53d1-41ec-a087-9dd74d8832c0', '2019-06-12', 'b620a082-fdc4-47a4-978c-20d806a019c9', 27.96, NULL, 'C', 'Quality test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 46);
INSERT INTO public.tpi_entries VALUES ('592efa20-ec78-4667-9f60-2adbde8c5eca', '2019-06-29', 'c9882c52-ad63-44f8-a259-17af93aaf089', 30.07, NULL, 'A', 'Regular monitoring', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 47);
INSERT INTO public.tpi_entries VALUES ('c389b35c-7883-4f4d-b622-95b228e2dbbc', '2019-10-25', 'b620a082-fdc4-47a4-978c-20d806a019c9', 27.29, NULL, 'B', 'Quality check', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 48);
INSERT INTO public.tpi_entries VALUES ('bd08b2fd-6a74-4a9b-a028-abc5ed363b8b', '2019-11-14', '3c05cb01-46bf-49ba-a7b1-c4a8e943f6d8', 33.13, NULL, 'A', 'Production test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 49);
INSERT INTO public.tpi_entries VALUES ('def619a3-ef56-4196-b680-56d59cf816f4', '2019-12-05', '66fb2106-9aa5-46df-81bb-9ab842f33668', 30.81, NULL, 'B', 'Quality monitoring', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 50);
INSERT INTO public.tpi_entries VALUES ('1fcab206-37a6-4181-af30-97e805ae8285', '2019-12-06', 'b620a082-fdc4-47a4-978c-20d806a019c9', 27.96, NULL, 'A', 'Regular test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 51);
INSERT INTO public.tpi_entries VALUES ('bc54e09b-1963-4208-ac55-2514ff6590f9', '2020-01-13', 'c9882c52-ad63-44f8-a259-17af93aaf089', 29.35, NULL, 'C', 'Shift test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 52);
INSERT INTO public.tpi_entries VALUES ('2d9837f6-86c9-44b8-a84d-4fc7d7dea027', '2021-08-27', '3c05cb01-46bf-49ba-a7b1-c4a8e943f6d8', 33.95, NULL, 'A', 'Quality check', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 53);
INSERT INTO public.tpi_entries VALUES ('493bc66e-5fab-4aea-97bd-911f260e8401', '2021-09-21', '79852752-f6b6-4f48-900a-c61e628ba195', 4.00, NULL, 'B', 'Test sample', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 54);
INSERT INTO public.tpi_entries VALUES ('2e935201-df06-41e5-99aa-34de6490e9cb', '2021-09-20', '79852752-f6b6-4f48-900a-c61e628ba195', 31.56, NULL, 'A', 'Quality test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 55);
INSERT INTO public.tpi_entries VALUES ('4dcc59a4-ef79-4a0f-9d75-a92d134ac3ef', '2022-02-18', '79852752-f6b6-4f48-900a-c61e628ba195', 32.34, NULL, 'B', 'Production monitoring', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 56);
INSERT INTO public.tpi_entries VALUES ('47142747-70be-4f2a-a792-efd77b804083', '2022-07-30', 'ddfdbf45-9e16-4e8c-aaf8-ba7bd5e831f0', 39.35, NULL, 'A', 'Warp yarn test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 57);
INSERT INTO public.tpi_entries VALUES ('9a85a399-fc59-4486-88fa-c2894208bb89', '2022-11-24', '79852752-f6b6-4f48-900a-c61e628ba195', 33.13, NULL, 'C', 'Quality check', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 58);
INSERT INTO public.tpi_entries VALUES ('c1d9154d-bd2c-4484-ae21-2c511c7cbe62', '2022-12-30', '3c05cb01-46bf-49ba-a7b1-c4a8e943f6d8', 33.13, NULL, 'A', 'Regular test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 59);
INSERT INTO public.tpi_entries VALUES ('8bdfe8bd-1ca8-4f8e-a04d-700acee55b74', '2023-01-06', '79852752-f6b6-4f48-900a-c61e628ba195', 31.57, NULL, 'B', 'Quality monitoring', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 60);
INSERT INTO public.tpi_entries VALUES ('bb180563-9693-44a7-85d6-e7697c88f0e0', '2024-01-29', '79852752-f6b6-4f48-900a-c61e628ba195', 32.34, NULL, 'A', 'Production test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 61);
INSERT INTO public.tpi_entries VALUES ('e62ea9cf-db2f-48f4-927b-a6121a796603', '2024-02-23', '890c5ae8-0a0b-480b-8bc0-f80f7ca4245a', 32.34, NULL, 'B', 'Quality check', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 62);
INSERT INTO public.tpi_entries VALUES ('8f041192-4188-428b-b17b-5e4724721516', '2024-12-13', '79852752-f6b6-4f48-900a-c61e628ba195', 33.13, NULL, 'A', 'Regular monitoring', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 63);
INSERT INTO public.tpi_entries VALUES ('4409dd9d-4d71-4055-aa34-88ebbaa23c96', '2024-12-04', '79852752-f6b6-4f48-900a-c61e628ba195', 3.00, NULL, 'B', 'Test sample', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 64);
INSERT INTO public.tpi_entries VALUES ('764178c6-c50e-457e-b031-16f4ba1ab1b5', '2024-12-14', '79852752-f6b6-4f48-900a-c61e628ba195', 33.13, NULL, 'C', 'Quality test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 65);
INSERT INTO public.tpi_entries VALUES ('6adc3e42-81cb-4602-aa60-13821f60ebd9', '2018-01-02', 'c9882c52-ad63-44f8-a259-17af93aaf089', 29.35, NULL, 'A', 'Quality test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:45:52.849767+00', 33);


--
-- TOC entry 4546 (class 0 OID 17890)
-- Dependencies: 347
-- Data for Name: twc_entries; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.twc_entries VALUES ('30018c4d-d5e5-4a71-813b-bd21ba3a3aec', '2024-05-20', '79852752-f6b6-4f48-900a-c61e628ba195', 2.50, NULL, 'A', 'Quality test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 737);
INSERT INTO public.twc_entries VALUES ('90e367ba-1429-4769-847a-4a4e71a7d8ff', '2024-05-24', '79852752-f6b6-4f48-900a-c61e628ba195', 2.00, NULL, 'B', 'Regular monitoring', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 738);
INSERT INTO public.twc_entries VALUES ('6fdd29fe-9f56-4b3f-8db3-801a09f0fab9', '2024-05-27', '890c5ae8-0a0b-480b-8bc0-f80f7ca4245a', 2.00, NULL, 'A', 'Diamond test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 739);
INSERT INTO public.twc_entries VALUES ('41bc140b-9636-4ebb-bd14-435481c6c544', '2024-06-02', '79852752-f6b6-4f48-900a-c61e628ba195', 3.00, NULL, 'C', 'Shift test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 740);
INSERT INTO public.twc_entries VALUES ('fa600abe-52d9-4c85-aa04-8e7ddc1b5f09', '2024-06-02', '890c5ae8-0a0b-480b-8bc0-f80f7ca4245a', 3.00, NULL, 'A', 'Quality check', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 741);
INSERT INTO public.twc_entries VALUES ('ad9aa60a-c219-469e-9b1c-8ae58a9220c8', '2024-06-16', '79852752-f6b6-4f48-900a-c61e628ba195', 3.50, NULL, 'B', 'Production', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 742);
INSERT INTO public.twc_entries VALUES ('4a188950-39b9-431a-ac30-a886fcafabbe', '2024-06-29', '79852752-f6b6-4f48-900a-c61e628ba195', 2.00, NULL, 'A', 'Quality test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 743);
INSERT INTO public.twc_entries VALUES ('e6e7c78d-42e9-4c7c-811a-39ed5337cd14', '2024-07-04', '79852752-f6b6-4f48-900a-c61e628ba195', 3.00, NULL, 'B', 'Regular test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 744);
INSERT INTO public.twc_entries VALUES ('a0ca29c2-c20f-4d75-9100-da67bab204f6', '2024-07-14', '79852752-f6b6-4f48-900a-c61e628ba195', 3.50, NULL, 'C', 'Shift monitoring', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 745);
INSERT INTO public.twc_entries VALUES ('2c4ab46d-947d-44f7-945b-3f27d98f4a12', '2024-07-25', '79852752-f6b6-4f48-900a-c61e628ba195', 3.00, NULL, 'A', 'Quality check', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 746);
INSERT INTO public.twc_entries VALUES ('2ad176c0-1a44-41bf-b0dd-17b627c53725', '2024-07-28', '79852752-f6b6-4f48-900a-c61e628ba195', 2.50, NULL, 'B', 'Production test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 747);
INSERT INTO public.twc_entries VALUES ('8ddd0afd-f92a-4d10-9866-2feea2cdd5d4', '2024-08-04', '79852752-f6b6-4f48-900a-c61e628ba195', 3.50, NULL, 'A', 'Quality monitoring', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 748);
INSERT INTO public.twc_entries VALUES ('3d24260b-6003-4380-9e6b-e57263261c9a', '2024-08-23', '79852752-f6b6-4f48-900a-c61e628ba195', 2.00, NULL, 'B', 'Regular test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 749);
INSERT INTO public.twc_entries VALUES ('80508156-0042-4c70-a3e9-f7a026c3bb2c', '2024-08-29', '79852752-f6b6-4f48-900a-c61e628ba195', 3.50, NULL, 'C', 'Shift test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 750);
INSERT INTO public.twc_entries VALUES ('4ce5f3ef-ea26-4b39-afd5-0fca45ebf078', '2024-09-15', '79852752-f6b6-4f48-900a-c61e628ba195', 3.00, NULL, 'A', 'Quality check', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 751);
INSERT INTO public.twc_entries VALUES ('d6cbcb25-8ff6-40ec-8f10-799ef620edd7', '2024-10-05', '79852752-f6b6-4f48-900a-c61e628ba195', 2.50, NULL, 'B', 'Production', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 752);
INSERT INTO public.twc_entries VALUES ('8b30c59c-43c6-4dd3-b9cc-900fad49de3a', '2024-10-13', '79852752-f6b6-4f48-900a-c61e628ba195', 2.00, NULL, 'A', 'Quality test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 753);
INSERT INTO public.twc_entries VALUES ('7f14e1d3-3dd7-4b67-89dc-8bccf7842a43', '2024-10-17', '79852752-f6b6-4f48-900a-c61e628ba195', 2.50, NULL, 'B', 'Regular monitoring', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 754);
INSERT INTO public.twc_entries VALUES ('ee3eda13-022c-49e3-aeca-b0e7e4b51f9d', '2024-10-20', '79852752-f6b6-4f48-900a-c61e628ba195', 3.00, NULL, 'C', 'Shift test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 755);
INSERT INTO public.twc_entries VALUES ('25102387-49ef-4678-972e-e87caad46e7b', '2024-11-20', '79852752-f6b6-4f48-900a-c61e628ba195', 3.50, NULL, 'A', 'Quality check', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 756);
INSERT INTO public.twc_entries VALUES ('325a0a94-e986-47d4-8dcf-e2df7f9340b5', '2024-11-26', '79852752-f6b6-4f48-900a-c61e628ba195', 3.00, NULL, 'B', 'Production test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 757);
INSERT INTO public.twc_entries VALUES ('78bb6749-c7c3-454c-9bf8-bc3fbf958706', '2024-11-29', '79852752-f6b6-4f48-900a-c61e628ba195', 2.50, NULL, 'A', 'Quality monitoring', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 758);
INSERT INTO public.twc_entries VALUES ('1972b429-4560-4956-8b39-f43e5c3525a9', '2024-12-06', '79852752-f6b6-4f48-900a-c61e628ba195', 3.50, NULL, 'B', 'Regular test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 759);
INSERT INTO public.twc_entries VALUES ('1ce7ea2e-cb55-4a51-ae77-42177477c198', '2024-12-14', '79852752-f6b6-4f48-900a-c61e628ba195', 3.00, NULL, 'C', 'Shift monitoring', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 760);
INSERT INTO public.twc_entries VALUES ('b649c087-4803-4270-8d61-1c3967afa971', '2024-12-22', '79852752-f6b6-4f48-900a-c61e628ba195', 2.50, NULL, 'A', 'Quality check', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 761);
INSERT INTO public.twc_entries VALUES ('e2dd1932-6ff6-4689-b551-7669e370be47', '2025-01-10', '79852752-f6b6-4f48-900a-c61e628ba195', 3.50, NULL, 'B', 'Production', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 762);
INSERT INTO public.twc_entries VALUES ('02d3471c-3067-4f91-a091-11c9289e3288', '2025-03-05', '79852752-f6b6-4f48-900a-c61e628ba195', 3.00, NULL, 'A', 'Quality test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 763);
INSERT INTO public.twc_entries VALUES ('5944cf0e-8fe5-47e8-8324-7c1fa9c11d2d', '2025-03-09', '79852752-f6b6-4f48-900a-c61e628ba195', 2.50, NULL, 'B', 'Regular test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 764);
INSERT INTO public.twc_entries VALUES ('dd60a62e-a34b-41ef-ba70-0368540cf8e7', '2025-03-29', '79852752-f6b6-4f48-900a-c61e628ba195', 3.00, NULL, 'C', 'Shift test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 765);
INSERT INTO public.twc_entries VALUES ('0c9bca50-5e8c-4866-a4e3-eba0059383ec', '2025-03-31', '79852752-f6b6-4f48-900a-c61e628ba195', 3.50, NULL, 'A', 'Quality check', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 766);
INSERT INTO public.twc_entries VALUES ('9ecdf7d5-5d40-4a07-b0f3-f2c25ab73635', '2025-04-07', '79852752-f6b6-4f48-900a-c61e628ba195', 3.00, NULL, 'B', 'Production test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 767);
INSERT INTO public.twc_entries VALUES ('bad9979f-33af-43a4-8641-a3048cbea3b0', '2025-04-18', '79852752-f6b6-4f48-900a-c61e628ba195', 3.50, NULL, 'A', 'Quality monitoring', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 768);
INSERT INTO public.twc_entries VALUES ('33c16d3c-de2d-41ad-a9bf-9e22e2b53f99', '2025-04-20', '79852752-f6b6-4f48-900a-c61e628ba195', 4.00, NULL, 'B', 'Final test', '2025-12-01 08:38:21.012038+00', '2025-12-01 08:38:21.012038+00', 769);


--
-- TOC entry 4590 (class 0 OID 0)
-- Dependencies: 375
-- Name: breaker_drawing_production_header_entry_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.breaker_drawing_production_header_entry_id_seq', 12, true);


--
-- TOC entry 4591 (class 0 OID 0)
-- Dependencies: 370
-- Name: carding_production_header_entry_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.carding_production_header_entry_id_seq', 6, true);


--
-- TOC entry 4592 (class 0 OID 0)
-- Dependencies: 350
-- Name: hok_strength_detail_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hok_strength_detail_id_seq', 412, true);


--
-- TOC entry 4593 (class 0 OID 0)
-- Dependencies: 349
-- Name: hok_strength_head_hok_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hok_strength_head_hok_id_seq', 1183, false);


--
-- TOC entry 4594 (class 0 OID 0)
-- Dependencies: 380
-- Name: lap_former_production_header_entry_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.lap_former_production_header_entry_id_seq', 7, true);


--
-- TOC entry 4595 (class 0 OID 0)
-- Dependencies: 353
-- Name: stoppage_details_code_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.stoppage_details_code_seq', 1480, false);


--
-- TOC entry 4596 (class 0 OID 0)
-- Dependencies: 352
-- Name: stoppage_heads_code_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.stoppage_heads_code_seq', 11, false);


--
-- TOC entry 4597 (class 0 OID 0)
-- Dependencies: 356
-- Name: supervisors_code_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.supervisors_code_seq', 11, true);


--
-- TOC entry 4598 (class 0 OID 0)
-- Dependencies: 359
-- Name: tpi_entries_entry_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tpi_entries_entry_id_seq', 65, true);


--
-- TOC entry 4599 (class 0 OID 0)
-- Dependencies: 360
-- Name: twc_entries_entry_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.twc_entries_entry_id_seq', 769, true);


--
-- TOC entry 4023 (class 2606 OID 17868)
-- Name: autoconer_machines autoconer_machines_machine_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autoconer_machines
    ADD CONSTRAINT autoconer_machines_machine_no_key UNIQUE (machine_no);


--
-- TOC entry 4025 (class 2606 OID 27618)
-- Name: autoconer_machines autoconer_machines_mc_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autoconer_machines
    ADD CONSTRAINT autoconer_machines_mc_id_unique UNIQUE (mc_id);


--
-- TOC entry 4027 (class 2606 OID 17866)
-- Name: autoconer_machines autoconer_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autoconer_machines
    ADD CONSTRAINT autoconer_machines_pkey PRIMARY KEY (id);


--
-- TOC entry 4150 (class 2606 OID 40633)
-- Name: breaker_drawing_machine_setup breaker_drawing_machine_setup_machine_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_machine_setup
    ADD CONSTRAINT breaker_drawing_machine_setup_machine_id_key UNIQUE (machine_id);


--
-- TOC entry 4152 (class 2606 OID 40631)
-- Name: breaker_drawing_machine_setup breaker_drawing_machine_setup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_machine_setup
    ADD CONSTRAINT breaker_drawing_machine_setup_pkey PRIMARY KEY (id);


--
-- TOC entry 4137 (class 2606 OID 40560)
-- Name: breaker_drawing_production_detail breaker_drawing_production_detail_header_id_machine_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_production_detail
    ADD CONSTRAINT breaker_drawing_production_detail_header_id_machine_id_key UNIQUE (header_id, machine_id);


--
-- TOC entry 4139 (class 2606 OID 40558)
-- Name: breaker_drawing_production_detail breaker_drawing_production_detail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_production_detail
    ADD CONSTRAINT breaker_drawing_production_detail_pkey PRIMARY KEY (id);


--
-- TOC entry 4129 (class 2606 OID 40525)
-- Name: breaker_drawing_production_header breaker_drawing_production_header_entry_date_shift_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_production_header
    ADD CONSTRAINT breaker_drawing_production_header_entry_date_shift_key UNIQUE (entry_date, shift);


--
-- TOC entry 4131 (class 2606 OID 40523)
-- Name: breaker_drawing_production_header breaker_drawing_production_header_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_production_header
    ADD CONSTRAINT breaker_drawing_production_header_pkey PRIMARY KEY (id);


--
-- TOC entry 4144 (class 2606 OID 40586)
-- Name: breaker_drawing_stoppage_entry breaker_drawing_stoppage_entry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_stoppage_entry
    ADD CONSTRAINT breaker_drawing_stoppage_entry_pkey PRIMARY KEY (id);


--
-- TOC entry 4146 (class 2606 OID 40588)
-- Name: breaker_drawing_stoppage_entry breaker_drawing_stoppage_entry_production_detail_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_stoppage_entry
    ADD CONSTRAINT breaker_drawing_stoppage_entry_production_detail_id_key UNIQUE (production_detail_id);


--
-- TOC entry 4125 (class 2606 OID 40483)
-- Name: carding_machine_setup carding_machine_setup_machine_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_machine_setup
    ADD CONSTRAINT carding_machine_setup_machine_id_key UNIQUE (machine_id);


--
-- TOC entry 4127 (class 2606 OID 40481)
-- Name: carding_machine_setup carding_machine_setup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_machine_setup
    ADD CONSTRAINT carding_machine_setup_pkey PRIMARY KEY (id);


--
-- TOC entry 4064 (class 2606 OID 29039)
-- Name: carding_machines carding_machines_machine_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_machines
    ADD CONSTRAINT carding_machines_machine_no_key UNIQUE (machine_no);


--
-- TOC entry 4066 (class 2606 OID 29037)
-- Name: carding_machines carding_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_machines
    ADD CONSTRAINT carding_machines_pkey PRIMARY KEY (id);


--
-- TOC entry 4114 (class 2606 OID 40411)
-- Name: carding_production_detail carding_production_detail_header_id_machine_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_production_detail
    ADD CONSTRAINT carding_production_detail_header_id_machine_id_key UNIQUE (header_id, machine_id);


--
-- TOC entry 4116 (class 2606 OID 40409)
-- Name: carding_production_detail carding_production_detail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_production_detail
    ADD CONSTRAINT carding_production_detail_pkey PRIMARY KEY (id);


--
-- TOC entry 4107 (class 2606 OID 40376)
-- Name: carding_production_header carding_production_header_entry_date_shift_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_production_header
    ADD CONSTRAINT carding_production_header_entry_date_shift_key UNIQUE (entry_date, shift);


--
-- TOC entry 4109 (class 2606 OID 40374)
-- Name: carding_production_header carding_production_header_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_production_header
    ADD CONSTRAINT carding_production_header_pkey PRIMARY KEY (id);


--
-- TOC entry 4120 (class 2606 OID 40437)
-- Name: carding_stoppage_entry carding_stoppage_entry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_stoppage_entry
    ADD CONSTRAINT carding_stoppage_entry_pkey PRIMARY KEY (id);


--
-- TOC entry 4122 (class 2606 OID 40439)
-- Name: carding_stoppage_entry carding_stoppage_entry_production_detail_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_stoppage_entry
    ADD CONSTRAINT carding_stoppage_entry_production_detail_id_key UNIQUE (production_detail_id);


--
-- TOC entry 4079 (class 2606 OID 29136)
-- Name: comber_machines comber_machines_machine_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comber_machines
    ADD CONSTRAINT comber_machines_machine_no_key UNIQUE (machine_no);


--
-- TOC entry 4081 (class 2606 OID 29134)
-- Name: comber_machines comber_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comber_machines
    ADD CONSTRAINT comber_machines_pkey PRIMARY KEY (id);


--
-- TOC entry 3981 (class 2606 OID 18061)
-- Name: departments departments_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_code_unique UNIQUE (code);


--
-- TOC entry 3983 (class 2606 OID 17757)
-- Name: departments departments_dept_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_dept_name_key UNIQUE (dept_name);


--
-- TOC entry 3985 (class 2606 OID 17755)
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- TOC entry 4072 (class 2606 OID 29086)
-- Name: drawing_breaker_machines drawing_breaker_machines_machine_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drawing_breaker_machines
    ADD CONSTRAINT drawing_breaker_machines_machine_no_key UNIQUE (machine_no);


--
-- TOC entry 4074 (class 2606 OID 29084)
-- Name: drawing_breaker_machines drawing_breaker_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drawing_breaker_machines
    ADD CONSTRAINT drawing_breaker_machines_pkey PRIMARY KEY (id);


--
-- TOC entry 4086 (class 2606 OID 29184)
-- Name: drawing_finisher_machines drawing_finisher_machines_machine_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drawing_finisher_machines
    ADD CONSTRAINT drawing_finisher_machines_machine_no_key UNIQUE (machine_no);


--
-- TOC entry 4088 (class 2606 OID 29182)
-- Name: drawing_finisher_machines drawing_finisher_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drawing_finisher_machines
    ADD CONSTRAINT drawing_finisher_machines_pkey PRIMARY KEY (id);


--
-- TOC entry 4052 (class 2606 OID 18003)
-- Name: hok_strength_detail hok_strength_detail_hok_id_department_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hok_strength_detail
    ADD CONSTRAINT hok_strength_detail_hok_id_department_id_key UNIQUE (hok_id, department_id);


--
-- TOC entry 4054 (class 2606 OID 18001)
-- Name: hok_strength_detail hok_strength_detail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hok_strength_detail
    ADD CONSTRAINT hok_strength_detail_pkey PRIMARY KEY (id);


--
-- TOC entry 4047 (class 2606 OID 17987)
-- Name: hok_strength_head hok_strength_head_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hok_strength_head
    ADD CONSTRAINT hok_strength_head_date_key UNIQUE (date);


--
-- TOC entry 4049 (class 2606 OID 17985)
-- Name: hok_strength_head hok_strength_head_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hok_strength_head
    ADD CONSTRAINT hok_strength_head_pkey PRIMARY KEY (hok_id);


--
-- TOC entry 4173 (class 2606 OID 45407)
-- Name: lap_former_machine_setup lap_former_machine_setup_machine_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_machine_setup
    ADD CONSTRAINT lap_former_machine_setup_machine_id_key UNIQUE (machine_id);


--
-- TOC entry 4175 (class 2606 OID 45405)
-- Name: lap_former_machine_setup lap_former_machine_setup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_machine_setup
    ADD CONSTRAINT lap_former_machine_setup_pkey PRIMARY KEY (id);


--
-- TOC entry 4103 (class 2606 OID 29280)
-- Name: lap_former_machines lap_former_machines_machine_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_machines
    ADD CONSTRAINT lap_former_machines_machine_no_key UNIQUE (machine_no);


--
-- TOC entry 4105 (class 2606 OID 29278)
-- Name: lap_former_machines lap_former_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_machines
    ADD CONSTRAINT lap_former_machines_pkey PRIMARY KEY (id);


--
-- TOC entry 4164 (class 2606 OID 45326)
-- Name: lap_former_production_detail lap_former_production_detail_header_id_machine_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_production_detail
    ADD CONSTRAINT lap_former_production_detail_header_id_machine_id_key UNIQUE (header_id, machine_id);


--
-- TOC entry 4166 (class 2606 OID 45324)
-- Name: lap_former_production_detail lap_former_production_detail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_production_detail
    ADD CONSTRAINT lap_former_production_detail_pkey PRIMARY KEY (id);


--
-- TOC entry 4158 (class 2606 OID 45286)
-- Name: lap_former_production_header lap_former_production_header_entry_date_shift_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_production_header
    ADD CONSTRAINT lap_former_production_header_entry_date_shift_key UNIQUE (entry_date, shift);


--
-- TOC entry 4160 (class 2606 OID 45284)
-- Name: lap_former_production_header lap_former_production_header_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_production_header
    ADD CONSTRAINT lap_former_production_header_pkey PRIMARY KEY (id);


--
-- TOC entry 4169 (class 2606 OID 45356)
-- Name: lap_former_stoppage_entry lap_former_stoppage_entry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_stoppage_entry
    ADD CONSTRAINT lap_former_stoppage_entry_pkey PRIMARY KEY (id);


--
-- TOC entry 4171 (class 2606 OID 45358)
-- Name: lap_former_stoppage_entry lap_former_stoppage_entry_production_detail_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_stoppage_entry
    ADD CONSTRAINT lap_former_stoppage_entry_production_detail_id_key UNIQUE (production_detail_id);


--
-- TOC entry 4096 (class 2606 OID 29233)
-- Name: simplex_machines simplex_machines_machine_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simplex_machines
    ADD CONSTRAINT simplex_machines_machine_no_key UNIQUE (machine_no);


--
-- TOC entry 4098 (class 2606 OID 29231)
-- Name: simplex_machines simplex_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simplex_machines
    ADD CONSTRAINT simplex_machines_pkey PRIMARY KEY (id);


--
-- TOC entry 4060 (class 2606 OID 18334)
-- Name: spinning_counts spinning_counts_count_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spinning_counts
    ADD CONSTRAINT spinning_counts_count_name_key UNIQUE (count_name);


--
-- TOC entry 4062 (class 2606 OID 18332)
-- Name: spinning_counts spinning_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spinning_counts
    ADD CONSTRAINT spinning_counts_pkey PRIMARY KEY (id);


--
-- TOC entry 3995 (class 2606 OID 17772)
-- Name: spinning_machines spinning_machines_machine_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spinning_machines
    ADD CONSTRAINT spinning_machines_machine_no_key UNIQUE (machine_no);


--
-- TOC entry 3997 (class 2606 OID 17770)
-- Name: spinning_machines spinning_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spinning_machines
    ADD CONSTRAINT spinning_machines_pkey PRIMARY KEY (id);


--
-- TOC entry 4011 (class 2606 OID 17796)
-- Name: stoppage_details stoppage_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stoppage_details
    ADD CONSTRAINT stoppage_details_pkey PRIMARY KEY (id);


--
-- TOC entry 4013 (class 2606 OID 17798)
-- Name: stoppage_details stoppage_details_stoppage_head_id_detail_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stoppage_details
    ADD CONSTRAINT stoppage_details_stoppage_head_id_detail_code_key UNIQUE (stoppage_head_id, code);


--
-- TOC entry 4001 (class 2606 OID 18117)
-- Name: stoppage_heads stoppage_heads_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stoppage_heads
    ADD CONSTRAINT stoppage_heads_code_key UNIQUE (code);


--
-- TOC entry 4003 (class 2606 OID 17783)
-- Name: stoppage_heads stoppage_heads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stoppage_heads
    ADD CONSTRAINT stoppage_heads_pkey PRIMARY KEY (id);


--
-- TOC entry 4005 (class 2606 OID 17785)
-- Name: stoppage_heads stoppage_heads_stoppage_head_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stoppage_heads
    ADD CONSTRAINT stoppage_heads_stoppage_head_name_key UNIQUE (stoppage_head_name);


--
-- TOC entry 4017 (class 2606 OID 20758)
-- Name: supervisors supervisors_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervisors
    ADD CONSTRAINT supervisors_code_unique UNIQUE (code);


--
-- TOC entry 4019 (class 2606 OID 17846)
-- Name: supervisors supervisors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervisors
    ADD CONSTRAINT supervisors_pkey PRIMARY KEY (id);


--
-- TOC entry 4021 (class 2606 OID 17848)
-- Name: supervisors supervisors_supervisor_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervisors
    ADD CONSTRAINT supervisors_supervisor_name_key UNIQUE (supervisor_name);


--
-- TOC entry 4036 (class 2606 OID 27677)
-- Name: tpi_entries tpi_entries_entry_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tpi_entries
    ADD CONSTRAINT tpi_entries_entry_id_unique UNIQUE (entry_id);


--
-- TOC entry 4038 (class 2606 OID 17879)
-- Name: tpi_entries tpi_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tpi_entries
    ADD CONSTRAINT tpi_entries_pkey PRIMARY KEY (id);


--
-- TOC entry 4043 (class 2606 OID 27679)
-- Name: twc_entries twc_entries_entry_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twc_entries
    ADD CONSTRAINT twc_entries_entry_id_unique UNIQUE (entry_id);


--
-- TOC entry 4045 (class 2606 OID 17900)
-- Name: twc_entries twc_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twc_entries
    ADD CONSTRAINT twc_entries_pkey PRIMARY KEY (id);


--
-- TOC entry 4028 (class 1259 OID 27566)
-- Name: idx_autoconer_machines_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_autoconer_machines_group_id ON public.autoconer_machines USING btree (group_id);


--
-- TOC entry 4029 (class 1259 OID 27567)
-- Name: idx_autoconer_machines_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_autoconer_machines_is_active ON public.autoconer_machines USING btree (is_active);


--
-- TOC entry 4030 (class 1259 OID 17918)
-- Name: idx_autoconer_machines_machine_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_autoconer_machines_machine_no ON public.autoconer_machines USING btree (machine_no);


--
-- TOC entry 4031 (class 1259 OID 27565)
-- Name: idx_autoconer_machines_mc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_autoconer_machines_mc_id ON public.autoconer_machines USING btree (mc_id);


--
-- TOC entry 4140 (class 1259 OID 42908)
-- Name: idx_bd_detail_header_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bd_detail_header_id ON public.breaker_drawing_production_detail USING btree (header_id);


--
-- TOC entry 4132 (class 1259 OID 42907)
-- Name: idx_bd_header_date_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bd_header_date_shift ON public.breaker_drawing_production_header USING btree (entry_date DESC, shift);


--
-- TOC entry 4141 (class 1259 OID 40571)
-- Name: idx_bd_prod_detail_header; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bd_prod_detail_header ON public.breaker_drawing_production_detail USING btree (header_id);


--
-- TOC entry 4142 (class 1259 OID 40572)
-- Name: idx_bd_prod_detail_machine; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bd_prod_detail_machine ON public.breaker_drawing_production_detail USING btree (machine_id);


--
-- TOC entry 4133 (class 1259 OID 40536)
-- Name: idx_bd_prod_header_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bd_prod_header_date ON public.breaker_drawing_production_header USING btree (entry_date);


--
-- TOC entry 4134 (class 1259 OID 40538)
-- Name: idx_bd_prod_header_entry_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bd_prod_header_entry_id ON public.breaker_drawing_production_header USING btree (entry_id);


--
-- TOC entry 4135 (class 1259 OID 40537)
-- Name: idx_bd_prod_header_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bd_prod_header_shift ON public.breaker_drawing_production_header USING btree (shift);


--
-- TOC entry 4147 (class 1259 OID 42909)
-- Name: idx_bd_stoppage_detail_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bd_stoppage_detail_id ON public.breaker_drawing_stoppage_entry USING btree (production_detail_id);


--
-- TOC entry 4148 (class 1259 OID 40614)
-- Name: idx_bd_stoppage_prod_detail; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bd_stoppage_prod_detail ON public.breaker_drawing_stoppage_entry USING btree (production_detail_id);


--
-- TOC entry 4067 (class 1259 OID 29043)
-- Name: idx_carding_machines_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carding_machines_is_active ON public.carding_machines USING btree (is_active);


--
-- TOC entry 4068 (class 1259 OID 29040)
-- Name: idx_carding_machines_machine_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carding_machines_machine_no ON public.carding_machines USING btree (machine_no);


--
-- TOC entry 4069 (class 1259 OID 29041)
-- Name: idx_carding_machines_mc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carding_machines_mc_id ON public.carding_machines USING btree (mc_id);


--
-- TOC entry 4070 (class 1259 OID 29042)
-- Name: idx_carding_machines_model; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carding_machines_model ON public.carding_machines USING btree (model);


--
-- TOC entry 4117 (class 1259 OID 40422)
-- Name: idx_carding_prod_detail_header; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carding_prod_detail_header ON public.carding_production_detail USING btree (header_id);


--
-- TOC entry 4118 (class 1259 OID 40423)
-- Name: idx_carding_prod_detail_machine; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carding_prod_detail_machine ON public.carding_production_detail USING btree (machine_id);


--
-- TOC entry 4110 (class 1259 OID 40387)
-- Name: idx_carding_prod_header_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carding_prod_header_date ON public.carding_production_header USING btree (entry_date);


--
-- TOC entry 4111 (class 1259 OID 40389)
-- Name: idx_carding_prod_header_entry_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carding_prod_header_entry_id ON public.carding_production_header USING btree (entry_id);


--
-- TOC entry 4112 (class 1259 OID 40388)
-- Name: idx_carding_prod_header_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carding_prod_header_shift ON public.carding_production_header USING btree (shift);


--
-- TOC entry 4123 (class 1259 OID 40465)
-- Name: idx_carding_stoppage_prod_detail; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carding_stoppage_prod_detail ON public.carding_stoppage_entry USING btree (production_detail_id);


--
-- TOC entry 4082 (class 1259 OID 29139)
-- Name: idx_comber_machines_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comber_machines_is_active ON public.comber_machines USING btree (is_active);


--
-- TOC entry 4083 (class 1259 OID 29137)
-- Name: idx_comber_machines_machine_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comber_machines_machine_no ON public.comber_machines USING btree (machine_no);


--
-- TOC entry 4084 (class 1259 OID 29138)
-- Name: idx_comber_machines_mc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comber_machines_mc_id ON public.comber_machines USING btree (mc_id);


--
-- TOC entry 3986 (class 1259 OID 18062)
-- Name: idx_departments_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_code ON public.departments USING btree (code);


--
-- TOC entry 3987 (class 1259 OID 17911)
-- Name: idx_departments_dept_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_dept_name ON public.departments USING btree (dept_name);


--
-- TOC entry 3988 (class 1259 OID 20735)
-- Name: idx_departments_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_is_active ON public.departments USING btree (is_active);


--
-- TOC entry 3989 (class 1259 OID 18063)
-- Name: idx_departments_sl_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_sl_no ON public.departments USING btree (sl_no);


--
-- TOC entry 4075 (class 1259 OID 29089)
-- Name: idx_drawing_breaker_machines_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drawing_breaker_machines_is_active ON public.drawing_breaker_machines USING btree (is_active);


--
-- TOC entry 4076 (class 1259 OID 29087)
-- Name: idx_drawing_breaker_machines_machine_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drawing_breaker_machines_machine_no ON public.drawing_breaker_machines USING btree (machine_no);


--
-- TOC entry 4077 (class 1259 OID 29088)
-- Name: idx_drawing_breaker_machines_mc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drawing_breaker_machines_mc_id ON public.drawing_breaker_machines USING btree (mc_id);


--
-- TOC entry 4089 (class 1259 OID 29187)
-- Name: idx_drawing_finisher_machines_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drawing_finisher_machines_is_active ON public.drawing_finisher_machines USING btree (is_active);


--
-- TOC entry 4090 (class 1259 OID 29185)
-- Name: idx_drawing_finisher_machines_machine_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drawing_finisher_machines_machine_no ON public.drawing_finisher_machines USING btree (machine_no);


--
-- TOC entry 4091 (class 1259 OID 29186)
-- Name: idx_drawing_finisher_machines_mc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drawing_finisher_machines_mc_id ON public.drawing_finisher_machines USING btree (mc_id);


--
-- TOC entry 4055 (class 1259 OID 18016)
-- Name: idx_hok_strength_detail_dept_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hok_strength_detail_dept_id ON public.hok_strength_detail USING btree (department_id);


--
-- TOC entry 4056 (class 1259 OID 18015)
-- Name: idx_hok_strength_detail_hok_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hok_strength_detail_hok_id ON public.hok_strength_detail USING btree (hok_id);


--
-- TOC entry 4050 (class 1259 OID 18014)
-- Name: idx_hok_strength_head_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hok_strength_head_date ON public.hok_strength_head USING btree (date);


--
-- TOC entry 4099 (class 1259 OID 29283)
-- Name: idx_lap_former_machines_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lap_former_machines_is_active ON public.lap_former_machines USING btree (is_active);


--
-- TOC entry 4100 (class 1259 OID 29281)
-- Name: idx_lap_former_machines_machine_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lap_former_machines_machine_no ON public.lap_former_machines USING btree (machine_no);


--
-- TOC entry 4101 (class 1259 OID 29282)
-- Name: idx_lap_former_machines_mc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lap_former_machines_mc_id ON public.lap_former_machines USING btree (mc_id);


--
-- TOC entry 4161 (class 1259 OID 45337)
-- Name: idx_lf_prod_detail_header; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lf_prod_detail_header ON public.lap_former_production_detail USING btree (header_id);


--
-- TOC entry 4162 (class 1259 OID 45338)
-- Name: idx_lf_prod_detail_machine; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lf_prod_detail_machine ON public.lap_former_production_detail USING btree (machine_id);


--
-- TOC entry 4153 (class 1259 OID 45297)
-- Name: idx_lf_prod_header_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lf_prod_header_date ON public.lap_former_production_header USING btree (entry_date);


--
-- TOC entry 4154 (class 1259 OID 45300)
-- Name: idx_lf_prod_header_date_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lf_prod_header_date_shift ON public.lap_former_production_header USING btree (entry_date DESC, shift);


--
-- TOC entry 4155 (class 1259 OID 45299)
-- Name: idx_lf_prod_header_entry_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lf_prod_header_entry_id ON public.lap_former_production_header USING btree (entry_id);


--
-- TOC entry 4156 (class 1259 OID 45298)
-- Name: idx_lf_prod_header_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lf_prod_header_shift ON public.lap_former_production_header USING btree (shift);


--
-- TOC entry 4167 (class 1259 OID 45384)
-- Name: idx_lf_stoppage_prod_detail; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lf_stoppage_prod_detail ON public.lap_former_stoppage_entry USING btree (production_detail_id);


--
-- TOC entry 4092 (class 1259 OID 29236)
-- Name: idx_simplex_machines_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_simplex_machines_is_active ON public.simplex_machines USING btree (is_active);


--
-- TOC entry 4093 (class 1259 OID 29234)
-- Name: idx_simplex_machines_machine_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_simplex_machines_machine_no ON public.simplex_machines USING btree (machine_no);


--
-- TOC entry 4094 (class 1259 OID 29235)
-- Name: idx_simplex_machines_mc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_simplex_machines_mc_id ON public.simplex_machines USING btree (mc_id);


--
-- TOC entry 4057 (class 1259 OID 18335)
-- Name: idx_spinning_counts_count_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spinning_counts_count_name ON public.spinning_counts USING btree (count_name);


--
-- TOC entry 4058 (class 1259 OID 18336)
-- Name: idx_spinning_counts_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spinning_counts_is_active ON public.spinning_counts USING btree (is_active);


--
-- TOC entry 3990 (class 1259 OID 18091)
-- Name: idx_spinning_machines_frame_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spinning_machines_frame_no ON public.spinning_machines USING btree (frame_no);


--
-- TOC entry 3991 (class 1259 OID 18093)
-- Name: idx_spinning_machines_group_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spinning_machines_group_no ON public.spinning_machines USING btree (group_no);


--
-- TOC entry 3992 (class 1259 OID 17912)
-- Name: idx_spinning_machines_machine_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spinning_machines_machine_no ON public.spinning_machines USING btree (machine_no);


--
-- TOC entry 3993 (class 1259 OID 18092)
-- Name: idx_spinning_machines_mc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spinning_machines_mc_id ON public.spinning_machines USING btree (mc_id);


--
-- TOC entry 4006 (class 1259 OID 18149)
-- Name: idx_stoppage_details_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stoppage_details_code ON public.stoppage_details USING btree (code);


--
-- TOC entry 4007 (class 1259 OID 18151)
-- Name: idx_stoppage_details_department_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stoppage_details_department_id ON public.stoppage_details USING btree (department_id);


--
-- TOC entry 4008 (class 1259 OID 18150)
-- Name: idx_stoppage_details_stoppage_head_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stoppage_details_stoppage_head_id ON public.stoppage_details USING btree (stoppage_head_id);


--
-- TOC entry 4009 (class 1259 OID 18152)
-- Name: idx_stoppage_details_stoppage_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stoppage_details_stoppage_name ON public.stoppage_details USING btree (stoppage_name);


--
-- TOC entry 3998 (class 1259 OID 18119)
-- Name: idx_stoppage_heads_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stoppage_heads_code ON public.stoppage_heads USING btree (code);


--
-- TOC entry 3999 (class 1259 OID 17913)
-- Name: idx_stoppage_heads_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stoppage_heads_name ON public.stoppage_heads USING btree (stoppage_head_name);


--
-- TOC entry 4014 (class 1259 OID 20760)
-- Name: idx_supervisors_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supervisors_code ON public.supervisors USING btree (code);


--
-- TOC entry 4015 (class 1259 OID 17917)
-- Name: idx_supervisors_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supervisors_name ON public.supervisors USING btree (supervisor_name);


--
-- TOC entry 4032 (class 1259 OID 17919)
-- Name: idx_tpi_entries_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tpi_entries_date ON public.tpi_entries USING btree (entry_date);


--
-- TOC entry 4033 (class 1259 OID 27664)
-- Name: idx_tpi_entries_entry_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tpi_entries_entry_id ON public.tpi_entries USING btree (entry_id);


--
-- TOC entry 4034 (class 1259 OID 27665)
-- Name: idx_tpi_entries_spinning_count_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tpi_entries_spinning_count_id ON public.tpi_entries USING btree (spinning_count_id);


--
-- TOC entry 4039 (class 1259 OID 17920)
-- Name: idx_twc_entries_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_twc_entries_date ON public.twc_entries USING btree (entry_date);


--
-- TOC entry 4040 (class 1259 OID 27666)
-- Name: idx_twc_entries_entry_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_twc_entries_entry_id ON public.twc_entries USING btree (entry_id);


--
-- TOC entry 4041 (class 1259 OID 27667)
-- Name: idx_twc_entries_spinning_count_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_twc_entries_spinning_count_id ON public.twc_entries USING btree (spinning_count_id);


--
-- TOC entry 4226 (class 2620 OID 41803)
-- Name: drawing_breaker_machines sync_bd_speed_on_machine_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_bd_speed_on_machine_update AFTER UPDATE OF speed ON public.drawing_breaker_machines FOR EACH ROW EXECUTE FUNCTION public.sync_breaker_drawing_speed();


--
-- TOC entry 4220 (class 2620 OID 17929)
-- Name: autoconer_machines update_autoconer_machines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_autoconer_machines_updated_at BEFORE UPDATE ON public.autoconer_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4239 (class 2620 OID 40695)
-- Name: breaker_drawing_machine_setup update_bd_machine_setup_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bd_machine_setup_updated_at BEFORE UPDATE ON public.breaker_drawing_machine_setup FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4237 (class 2620 OID 40693)
-- Name: breaker_drawing_production_detail update_bd_prod_detail_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bd_prod_detail_updated_at BEFORE UPDATE ON public.breaker_drawing_production_detail FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4236 (class 2620 OID 40692)
-- Name: breaker_drawing_production_header update_bd_prod_header_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bd_prod_header_updated_at BEFORE UPDATE ON public.breaker_drawing_production_header FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4238 (class 2620 OID 40694)
-- Name: breaker_drawing_stoppage_entry update_bd_stoppage_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bd_stoppage_updated_at BEFORE UPDATE ON public.breaker_drawing_stoppage_entry FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4235 (class 2620 OID 40508)
-- Name: carding_machine_setup update_carding_machine_setup_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_carding_machine_setup_updated_at BEFORE UPDATE ON public.carding_machine_setup FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4225 (class 2620 OID 29048)
-- Name: carding_machines update_carding_machines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_carding_machines_updated_at BEFORE UPDATE ON public.carding_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4233 (class 2620 OID 40506)
-- Name: carding_production_detail update_carding_prod_detail_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_carding_prod_detail_updated_at BEFORE UPDATE ON public.carding_production_detail FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4232 (class 2620 OID 40505)
-- Name: carding_production_header update_carding_prod_header_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_carding_prod_header_updated_at BEFORE UPDATE ON public.carding_production_header FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4234 (class 2620 OID 40507)
-- Name: carding_stoppage_entry update_carding_stoppage_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_carding_stoppage_updated_at BEFORE UPDATE ON public.carding_stoppage_entry FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4228 (class 2620 OID 29144)
-- Name: comber_machines update_comber_machines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_comber_machines_updated_at BEFORE UPDATE ON public.comber_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4215 (class 2620 OID 17922)
-- Name: departments update_departments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4227 (class 2620 OID 29094)
-- Name: drawing_breaker_machines update_drawing_breaker_machines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_drawing_breaker_machines_updated_at BEFORE UPDATE ON public.drawing_breaker_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4229 (class 2620 OID 29192)
-- Name: drawing_finisher_machines update_drawing_finisher_machines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_drawing_finisher_machines_updated_at BEFORE UPDATE ON public.drawing_finisher_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4224 (class 2620 OID 18018)
-- Name: hok_strength_detail update_hok_strength_detail_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_hok_strength_detail_updated_at BEFORE UPDATE ON public.hok_strength_detail FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4223 (class 2620 OID 18017)
-- Name: hok_strength_head update_hok_strength_head_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_hok_strength_head_updated_at BEFORE UPDATE ON public.hok_strength_head FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4231 (class 2620 OID 29288)
-- Name: lap_former_machines update_lap_former_machines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lap_former_machines_updated_at BEFORE UPDATE ON public.lap_former_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4243 (class 2620 OID 45420)
-- Name: lap_former_machine_setup update_lf_machine_setup_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lf_machine_setup_updated_at BEFORE UPDATE ON public.lap_former_machine_setup FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4241 (class 2620 OID 45418)
-- Name: lap_former_production_detail update_lf_prod_detail_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lf_prod_detail_updated_at BEFORE UPDATE ON public.lap_former_production_detail FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4240 (class 2620 OID 45417)
-- Name: lap_former_production_header update_lf_prod_header_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lf_prod_header_updated_at BEFORE UPDATE ON public.lap_former_production_header FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4242 (class 2620 OID 45419)
-- Name: lap_former_stoppage_entry update_lf_stoppage_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lf_stoppage_updated_at BEFORE UPDATE ON public.lap_former_stoppage_entry FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4230 (class 2620 OID 29241)
-- Name: simplex_machines update_simplex_machines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_simplex_machines_updated_at BEFORE UPDATE ON public.simplex_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4216 (class 2620 OID 17923)
-- Name: spinning_machines update_spinning_machines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_spinning_machines_updated_at BEFORE UPDATE ON public.spinning_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4218 (class 2620 OID 17925)
-- Name: stoppage_details update_stoppage_details_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_stoppage_details_updated_at BEFORE UPDATE ON public.stoppage_details FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4217 (class 2620 OID 17924)
-- Name: stoppage_heads update_stoppage_heads_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_stoppage_heads_updated_at BEFORE UPDATE ON public.stoppage_heads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4219 (class 2620 OID 17928)
-- Name: supervisors update_supervisors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_supervisors_updated_at BEFORE UPDATE ON public.supervisors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4221 (class 2620 OID 17930)
-- Name: tpi_entries update_tpi_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tpi_entries_updated_at BEFORE UPDATE ON public.tpi_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4222 (class 2620 OID 17931)
-- Name: twc_entries update_twc_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_twc_entries_updated_at BEFORE UPDATE ON public.twc_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4204 (class 2606 OID 40634)
-- Name: breaker_drawing_machine_setup breaker_drawing_machine_setup_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_machine_setup
    ADD CONSTRAINT breaker_drawing_machine_setup_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.drawing_breaker_machines(id) ON DELETE CASCADE;


--
-- TOC entry 4197 (class 2606 OID 40561)
-- Name: breaker_drawing_production_detail breaker_drawing_production_detail_header_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_production_detail
    ADD CONSTRAINT breaker_drawing_production_detail_header_id_fkey FOREIGN KEY (header_id) REFERENCES public.breaker_drawing_production_header(id) ON DELETE CASCADE;


--
-- TOC entry 4198 (class 2606 OID 40566)
-- Name: breaker_drawing_production_detail breaker_drawing_production_detail_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_production_detail
    ADD CONSTRAINT breaker_drawing_production_detail_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.drawing_breaker_machines(id) ON DELETE CASCADE;


--
-- TOC entry 4195 (class 2606 OID 40531)
-- Name: breaker_drawing_production_header breaker_drawing_production_header_maisitry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_production_header
    ADD CONSTRAINT breaker_drawing_production_header_maisitry_id_fkey FOREIGN KEY (maisitry_id) REFERENCES public.supervisors(id) ON DELETE SET NULL;


--
-- TOC entry 4196 (class 2606 OID 40526)
-- Name: breaker_drawing_production_header breaker_drawing_production_header_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_production_header
    ADD CONSTRAINT breaker_drawing_production_header_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.supervisors(id) ON DELETE SET NULL;


--
-- TOC entry 4199 (class 2606 OID 40589)
-- Name: breaker_drawing_stoppage_entry breaker_drawing_stoppage_entry_production_detail_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_stoppage_entry
    ADD CONSTRAINT breaker_drawing_stoppage_entry_production_detail_id_fkey FOREIGN KEY (production_detail_id) REFERENCES public.breaker_drawing_production_detail(id) ON DELETE CASCADE;


--
-- TOC entry 4200 (class 2606 OID 40594)
-- Name: breaker_drawing_stoppage_entry breaker_drawing_stoppage_entry_stoppage1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_stoppage_entry
    ADD CONSTRAINT breaker_drawing_stoppage_entry_stoppage1_id_fkey FOREIGN KEY (stoppage1_id) REFERENCES public.stoppage_details(id) ON DELETE SET NULL;


--
-- TOC entry 4201 (class 2606 OID 40599)
-- Name: breaker_drawing_stoppage_entry breaker_drawing_stoppage_entry_stoppage2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_stoppage_entry
    ADD CONSTRAINT breaker_drawing_stoppage_entry_stoppage2_id_fkey FOREIGN KEY (stoppage2_id) REFERENCES public.stoppage_details(id) ON DELETE SET NULL;


--
-- TOC entry 4202 (class 2606 OID 40604)
-- Name: breaker_drawing_stoppage_entry breaker_drawing_stoppage_entry_stoppage3_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_stoppage_entry
    ADD CONSTRAINT breaker_drawing_stoppage_entry_stoppage3_id_fkey FOREIGN KEY (stoppage3_id) REFERENCES public.stoppage_details(id) ON DELETE SET NULL;


--
-- TOC entry 4203 (class 2606 OID 40609)
-- Name: breaker_drawing_stoppage_entry breaker_drawing_stoppage_entry_stoppage4_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaker_drawing_stoppage_entry
    ADD CONSTRAINT breaker_drawing_stoppage_entry_stoppage4_id_fkey FOREIGN KEY (stoppage4_id) REFERENCES public.stoppage_details(id) ON DELETE SET NULL;


--
-- TOC entry 4194 (class 2606 OID 40484)
-- Name: carding_machine_setup carding_machine_setup_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_machine_setup
    ADD CONSTRAINT carding_machine_setup_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.carding_machines(id) ON DELETE CASCADE;


--
-- TOC entry 4187 (class 2606 OID 40412)
-- Name: carding_production_detail carding_production_detail_header_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_production_detail
    ADD CONSTRAINT carding_production_detail_header_id_fkey FOREIGN KEY (header_id) REFERENCES public.carding_production_header(id) ON DELETE CASCADE;


--
-- TOC entry 4188 (class 2606 OID 40417)
-- Name: carding_production_detail carding_production_detail_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_production_detail
    ADD CONSTRAINT carding_production_detail_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.carding_machines(id) ON DELETE CASCADE;


--
-- TOC entry 4185 (class 2606 OID 40382)
-- Name: carding_production_header carding_production_header_maisitry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_production_header
    ADD CONSTRAINT carding_production_header_maisitry_id_fkey FOREIGN KEY (maisitry_id) REFERENCES public.supervisors(id) ON DELETE SET NULL;


--
-- TOC entry 4186 (class 2606 OID 40377)
-- Name: carding_production_header carding_production_header_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_production_header
    ADD CONSTRAINT carding_production_header_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.supervisors(id) ON DELETE SET NULL;


--
-- TOC entry 4189 (class 2606 OID 40440)
-- Name: carding_stoppage_entry carding_stoppage_entry_production_detail_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_stoppage_entry
    ADD CONSTRAINT carding_stoppage_entry_production_detail_id_fkey FOREIGN KEY (production_detail_id) REFERENCES public.carding_production_detail(id) ON DELETE CASCADE;


--
-- TOC entry 4190 (class 2606 OID 40445)
-- Name: carding_stoppage_entry carding_stoppage_entry_stoppage1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_stoppage_entry
    ADD CONSTRAINT carding_stoppage_entry_stoppage1_id_fkey FOREIGN KEY (stoppage1_id) REFERENCES public.stoppage_details(id) ON DELETE SET NULL;


--
-- TOC entry 4191 (class 2606 OID 40450)
-- Name: carding_stoppage_entry carding_stoppage_entry_stoppage2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_stoppage_entry
    ADD CONSTRAINT carding_stoppage_entry_stoppage2_id_fkey FOREIGN KEY (stoppage2_id) REFERENCES public.stoppage_details(id) ON DELETE SET NULL;


--
-- TOC entry 4192 (class 2606 OID 40455)
-- Name: carding_stoppage_entry carding_stoppage_entry_stoppage3_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_stoppage_entry
    ADD CONSTRAINT carding_stoppage_entry_stoppage3_id_fkey FOREIGN KEY (stoppage3_id) REFERENCES public.stoppage_details(id) ON DELETE SET NULL;


--
-- TOC entry 4193 (class 2606 OID 40460)
-- Name: carding_stoppage_entry carding_stoppage_entry_stoppage4_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carding_stoppage_entry
    ADD CONSTRAINT carding_stoppage_entry_stoppage4_id_fkey FOREIGN KEY (stoppage4_id) REFERENCES public.stoppage_details(id) ON DELETE SET NULL;


--
-- TOC entry 4183 (class 2606 OID 18009)
-- Name: hok_strength_detail hok_strength_detail_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hok_strength_detail
    ADD CONSTRAINT hok_strength_detail_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- TOC entry 4184 (class 2606 OID 18004)
-- Name: hok_strength_detail hok_strength_detail_hok_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hok_strength_detail
    ADD CONSTRAINT hok_strength_detail_hok_id_fkey FOREIGN KEY (hok_id) REFERENCES public.hok_strength_head(hok_id) ON DELETE CASCADE;


--
-- TOC entry 4214 (class 2606 OID 45408)
-- Name: lap_former_machine_setup lap_former_machine_setup_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_machine_setup
    ADD CONSTRAINT lap_former_machine_setup_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.lap_former_machines(id) ON DELETE CASCADE;


--
-- TOC entry 4207 (class 2606 OID 45327)
-- Name: lap_former_production_detail lap_former_production_detail_header_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_production_detail
    ADD CONSTRAINT lap_former_production_detail_header_id_fkey FOREIGN KEY (header_id) REFERENCES public.lap_former_production_header(id) ON DELETE CASCADE;


--
-- TOC entry 4208 (class 2606 OID 45332)
-- Name: lap_former_production_detail lap_former_production_detail_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_production_detail
    ADD CONSTRAINT lap_former_production_detail_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.lap_former_machines(id) ON DELETE CASCADE;


--
-- TOC entry 4205 (class 2606 OID 45292)
-- Name: lap_former_production_header lap_former_production_header_maisitry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_production_header
    ADD CONSTRAINT lap_former_production_header_maisitry_id_fkey FOREIGN KEY (maisitry_id) REFERENCES public.supervisors(id) ON DELETE SET NULL;


--
-- TOC entry 4206 (class 2606 OID 45287)
-- Name: lap_former_production_header lap_former_production_header_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_production_header
    ADD CONSTRAINT lap_former_production_header_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.supervisors(id) ON DELETE SET NULL;


--
-- TOC entry 4209 (class 2606 OID 45359)
-- Name: lap_former_stoppage_entry lap_former_stoppage_entry_production_detail_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_stoppage_entry
    ADD CONSTRAINT lap_former_stoppage_entry_production_detail_id_fkey FOREIGN KEY (production_detail_id) REFERENCES public.lap_former_production_detail(id) ON DELETE CASCADE;


--
-- TOC entry 4210 (class 2606 OID 45364)
-- Name: lap_former_stoppage_entry lap_former_stoppage_entry_stoppage1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_stoppage_entry
    ADD CONSTRAINT lap_former_stoppage_entry_stoppage1_id_fkey FOREIGN KEY (stoppage1_id) REFERENCES public.stoppage_details(id) ON DELETE SET NULL;


--
-- TOC entry 4211 (class 2606 OID 45369)
-- Name: lap_former_stoppage_entry lap_former_stoppage_entry_stoppage2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_stoppage_entry
    ADD CONSTRAINT lap_former_stoppage_entry_stoppage2_id_fkey FOREIGN KEY (stoppage2_id) REFERENCES public.stoppage_details(id) ON DELETE SET NULL;


--
-- TOC entry 4212 (class 2606 OID 45374)
-- Name: lap_former_stoppage_entry lap_former_stoppage_entry_stoppage3_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_stoppage_entry
    ADD CONSTRAINT lap_former_stoppage_entry_stoppage3_id_fkey FOREIGN KEY (stoppage3_id) REFERENCES public.stoppage_details(id) ON DELETE SET NULL;


--
-- TOC entry 4213 (class 2606 OID 45379)
-- Name: lap_former_stoppage_entry lap_former_stoppage_entry_stoppage4_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lap_former_stoppage_entry
    ADD CONSTRAINT lap_former_stoppage_entry_stoppage4_id_fkey FOREIGN KEY (stoppage4_id) REFERENCES public.stoppage_details(id) ON DELETE SET NULL;


--
-- TOC entry 4176 (class 2606 OID 18143)
-- Name: stoppage_details stoppage_details_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stoppage_details
    ADD CONSTRAINT stoppage_details_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- TOC entry 4177 (class 2606 OID 17799)
-- Name: stoppage_details stoppage_details_stoppage_head_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stoppage_details
    ADD CONSTRAINT stoppage_details_stoppage_head_id_fkey FOREIGN KEY (stoppage_head_id) REFERENCES public.stoppage_heads(id) ON DELETE CASCADE;


--
-- TOC entry 4178 (class 2606 OID 17849)
-- Name: supervisors supervisors_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervisors
    ADD CONSTRAINT supervisors_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- TOC entry 4179 (class 2606 OID 17885)
-- Name: tpi_entries tpi_entries_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tpi_entries
    ADD CONSTRAINT tpi_entries_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.spinning_machines(id) ON DELETE SET NULL;


--
-- TOC entry 4180 (class 2606 OID 27760)
-- Name: tpi_entries tpi_entries_spinning_count_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tpi_entries
    ADD CONSTRAINT tpi_entries_spinning_count_id_fkey FOREIGN KEY (spinning_count_id) REFERENCES public.spinning_counts(id) ON DELETE SET NULL;


--
-- TOC entry 4181 (class 2606 OID 17906)
-- Name: twc_entries twc_entries_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twc_entries
    ADD CONSTRAINT twc_entries_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.spinning_machines(id) ON DELETE SET NULL;


--
-- TOC entry 4182 (class 2606 OID 27788)
-- Name: twc_entries twc_entries_spinning_count_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twc_entries
    ADD CONSTRAINT twc_entries_spinning_count_id_fkey FOREIGN KEY (spinning_count_id) REFERENCES public.spinning_counts(id) ON DELETE SET NULL;


--
-- TOC entry 4426 (class 3256 OID 18361)
-- Name: spinning_counts Enable all operations for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable all operations for authenticated users" ON public.spinning_counts USING ((auth.role() = 'authenticated'::text));


--
-- TOC entry 4451 (class 3256 OID 27607)
-- Name: autoconer_machines Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.autoconer_machines FOR DELETE USING (true);


--
-- TOC entry 4521 (class 3256 OID 40691)
-- Name: breaker_drawing_machine_setup Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.breaker_drawing_machine_setup FOR DELETE USING (true);


--
-- TOC entry 4513 (class 3256 OID 40683)
-- Name: breaker_drawing_production_detail Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.breaker_drawing_production_detail FOR DELETE USING (true);


--
-- TOC entry 4509 (class 3256 OID 40679)
-- Name: breaker_drawing_production_header Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.breaker_drawing_production_header FOR DELETE USING (true);


--
-- TOC entry 4517 (class 3256 OID 40687)
-- Name: breaker_drawing_stoppage_entry Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.breaker_drawing_stoppage_entry FOR DELETE USING (true);


--
-- TOC entry 4505 (class 3256 OID 40504)
-- Name: carding_machine_setup Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.carding_machine_setup FOR DELETE USING (true);


--
-- TOC entry 4455 (class 3256 OID 29047)
-- Name: carding_machines Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.carding_machines FOR DELETE USING (true);


--
-- TOC entry 4497 (class 3256 OID 40496)
-- Name: carding_production_detail Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.carding_production_detail FOR DELETE USING (true);


--
-- TOC entry 4493 (class 3256 OID 40492)
-- Name: carding_production_header Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.carding_production_header FOR DELETE USING (true);


--
-- TOC entry 4501 (class 3256 OID 40500)
-- Name: carding_stoppage_entry Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.carding_stoppage_entry FOR DELETE USING (true);


--
-- TOC entry 4459 (class 3256 OID 29143)
-- Name: comber_machines Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.comber_machines FOR DELETE USING (true);


--
-- TOC entry 4435 (class 3256 OID 29093)
-- Name: drawing_breaker_machines Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.drawing_breaker_machines FOR DELETE USING (true);


--
-- TOC entry 4460 (class 3256 OID 29191)
-- Name: drawing_finisher_machines Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.drawing_finisher_machines FOR DELETE USING (true);


--
-- TOC entry 4446 (class 3256 OID 20709)
-- Name: hok_strength_detail Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.hok_strength_detail FOR DELETE USING (true);


--
-- TOC entry 4442 (class 3256 OID 20705)
-- Name: hok_strength_head Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.hok_strength_head FOR DELETE USING (true);


--
-- TOC entry 4537 (class 3256 OID 45416)
-- Name: lap_former_machine_setup Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.lap_former_machine_setup FOR DELETE USING (true);


--
-- TOC entry 4472 (class 3256 OID 29287)
-- Name: lap_former_machines Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.lap_former_machines FOR DELETE USING (true);


--
-- TOC entry 4529 (class 3256 OID 45342)
-- Name: lap_former_production_detail Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.lap_former_production_detail FOR DELETE USING (true);


--
-- TOC entry 4525 (class 3256 OID 45304)
-- Name: lap_former_production_header Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.lap_former_production_header FOR DELETE USING (true);


--
-- TOC entry 4533 (class 3256 OID 45388)
-- Name: lap_former_stoppage_entry Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.lap_former_stoppage_entry FOR DELETE USING (true);


--
-- TOC entry 4464 (class 3256 OID 29240)
-- Name: simplex_machines Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.simplex_machines FOR DELETE USING (true);


--
-- TOC entry 4434 (class 3256 OID 20643)
-- Name: spinning_counts Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.spinning_counts FOR DELETE USING (true);


--
-- TOC entry 4476 (class 3256 OID 20891)
-- Name: spinning_machines Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.spinning_machines FOR DELETE USING (true);


--
-- TOC entry 4484 (class 3256 OID 20899)
-- Name: stoppage_details Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.stoppage_details FOR DELETE USING (true);


--
-- TOC entry 4480 (class 3256 OID 20895)
-- Name: stoppage_heads Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.stoppage_heads FOR DELETE USING (true);


--
-- TOC entry 4469 (class 3256 OID 20883)
-- Name: supervisors Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.supervisors FOR DELETE USING (true);


--
-- TOC entry 4488 (class 3256 OID 27671)
-- Name: tpi_entries Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.tpi_entries FOR DELETE USING (true);


--
-- TOC entry 4427 (class 3256 OID 27675)
-- Name: twc_entries Enable delete for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for all users" ON public.twc_entries FOR DELETE USING (true);


--
-- TOC entry 4449 (class 3256 OID 27605)
-- Name: autoconer_machines Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.autoconer_machines FOR INSERT WITH CHECK (true);


--
-- TOC entry 4519 (class 3256 OID 40689)
-- Name: breaker_drawing_machine_setup Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.breaker_drawing_machine_setup FOR INSERT WITH CHECK (true);


--
-- TOC entry 4511 (class 3256 OID 40681)
-- Name: breaker_drawing_production_detail Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.breaker_drawing_production_detail FOR INSERT WITH CHECK (true);


--
-- TOC entry 4507 (class 3256 OID 40677)
-- Name: breaker_drawing_production_header Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.breaker_drawing_production_header FOR INSERT WITH CHECK (true);


--
-- TOC entry 4515 (class 3256 OID 40685)
-- Name: breaker_drawing_stoppage_entry Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.breaker_drawing_stoppage_entry FOR INSERT WITH CHECK (true);


--
-- TOC entry 4503 (class 3256 OID 40502)
-- Name: carding_machine_setup Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.carding_machine_setup FOR INSERT WITH CHECK (true);


--
-- TOC entry 4453 (class 3256 OID 29045)
-- Name: carding_machines Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.carding_machines FOR INSERT WITH CHECK (true);


--
-- TOC entry 4495 (class 3256 OID 40494)
-- Name: carding_production_detail Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.carding_production_detail FOR INSERT WITH CHECK (true);


--
-- TOC entry 4491 (class 3256 OID 40490)
-- Name: carding_production_header Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.carding_production_header FOR INSERT WITH CHECK (true);


--
-- TOC entry 4499 (class 3256 OID 40498)
-- Name: carding_stoppage_entry Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.carding_stoppage_entry FOR INSERT WITH CHECK (true);


--
-- TOC entry 4457 (class 3256 OID 29141)
-- Name: comber_machines Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.comber_machines FOR INSERT WITH CHECK (true);


--
-- TOC entry 4429 (class 3256 OID 29091)
-- Name: drawing_breaker_machines Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.drawing_breaker_machines FOR INSERT WITH CHECK (true);


--
-- TOC entry 4437 (class 3256 OID 29189)
-- Name: drawing_finisher_machines Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.drawing_finisher_machines FOR INSERT WITH CHECK (true);


--
-- TOC entry 4444 (class 3256 OID 20707)
-- Name: hok_strength_detail Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.hok_strength_detail FOR INSERT WITH CHECK (true);


--
-- TOC entry 4440 (class 3256 OID 20703)
-- Name: hok_strength_head Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.hok_strength_head FOR INSERT WITH CHECK (true);


--
-- TOC entry 4535 (class 3256 OID 45414)
-- Name: lap_former_machine_setup Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.lap_former_machine_setup FOR INSERT WITH CHECK (true);


--
-- TOC entry 4470 (class 3256 OID 29285)
-- Name: lap_former_machines Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.lap_former_machines FOR INSERT WITH CHECK (true);


--
-- TOC entry 4527 (class 3256 OID 45340)
-- Name: lap_former_production_detail Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.lap_former_production_detail FOR INSERT WITH CHECK (true);


--
-- TOC entry 4523 (class 3256 OID 45302)
-- Name: lap_former_production_header Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.lap_former_production_header FOR INSERT WITH CHECK (true);


--
-- TOC entry 4531 (class 3256 OID 45386)
-- Name: lap_former_stoppage_entry Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.lap_former_stoppage_entry FOR INSERT WITH CHECK (true);


--
-- TOC entry 4462 (class 3256 OID 29238)
-- Name: simplex_machines Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.simplex_machines FOR INSERT WITH CHECK (true);


--
-- TOC entry 4432 (class 3256 OID 20641)
-- Name: spinning_counts Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.spinning_counts FOR INSERT WITH CHECK (true);


--
-- TOC entry 4474 (class 3256 OID 20889)
-- Name: spinning_machines Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.spinning_machines FOR INSERT WITH CHECK (true);


--
-- TOC entry 4482 (class 3256 OID 20897)
-- Name: stoppage_details Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.stoppage_details FOR INSERT WITH CHECK (true);


--
-- TOC entry 4478 (class 3256 OID 20893)
-- Name: stoppage_heads Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.stoppage_heads FOR INSERT WITH CHECK (true);


--
-- TOC entry 4467 (class 3256 OID 20881)
-- Name: supervisors Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.supervisors FOR INSERT WITH CHECK (true);


--
-- TOC entry 4486 (class 3256 OID 27669)
-- Name: tpi_entries Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.tpi_entries FOR INSERT WITH CHECK (true);


--
-- TOC entry 4424 (class 3256 OID 27673)
-- Name: twc_entries Enable insert for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for all users" ON public.twc_entries FOR INSERT WITH CHECK (true);


--
-- TOC entry 4448 (class 3256 OID 27604)
-- Name: autoconer_machines Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.autoconer_machines FOR SELECT USING (true);


--
-- TOC entry 4518 (class 3256 OID 40688)
-- Name: breaker_drawing_machine_setup Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.breaker_drawing_machine_setup FOR SELECT USING (true);


--
-- TOC entry 4510 (class 3256 OID 40680)
-- Name: breaker_drawing_production_detail Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.breaker_drawing_production_detail FOR SELECT USING (true);


--
-- TOC entry 4506 (class 3256 OID 40676)
-- Name: breaker_drawing_production_header Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.breaker_drawing_production_header FOR SELECT USING (true);


--
-- TOC entry 4514 (class 3256 OID 40684)
-- Name: breaker_drawing_stoppage_entry Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.breaker_drawing_stoppage_entry FOR SELECT USING (true);


--
-- TOC entry 4502 (class 3256 OID 40501)
-- Name: carding_machine_setup Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.carding_machine_setup FOR SELECT USING (true);


--
-- TOC entry 4452 (class 3256 OID 29044)
-- Name: carding_machines Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.carding_machines FOR SELECT USING (true);


--
-- TOC entry 4494 (class 3256 OID 40493)
-- Name: carding_production_detail Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.carding_production_detail FOR SELECT USING (true);


--
-- TOC entry 4490 (class 3256 OID 40489)
-- Name: carding_production_header Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.carding_production_header FOR SELECT USING (true);


--
-- TOC entry 4498 (class 3256 OID 40497)
-- Name: carding_stoppage_entry Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.carding_stoppage_entry FOR SELECT USING (true);


--
-- TOC entry 4456 (class 3256 OID 29140)
-- Name: comber_machines Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.comber_machines FOR SELECT USING (true);


--
-- TOC entry 4447 (class 3256 OID 20734)
-- Name: departments Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.departments FOR SELECT USING (true);


--
-- TOC entry 4428 (class 3256 OID 29090)
-- Name: drawing_breaker_machines Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.drawing_breaker_machines FOR SELECT USING (true);


--
-- TOC entry 4436 (class 3256 OID 29188)
-- Name: drawing_finisher_machines Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.drawing_finisher_machines FOR SELECT USING (true);


--
-- TOC entry 4443 (class 3256 OID 20706)
-- Name: hok_strength_detail Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.hok_strength_detail FOR SELECT USING (true);


--
-- TOC entry 4439 (class 3256 OID 20702)
-- Name: hok_strength_head Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.hok_strength_head FOR SELECT USING (true);


--
-- TOC entry 4534 (class 3256 OID 45413)
-- Name: lap_former_machine_setup Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.lap_former_machine_setup FOR SELECT USING (true);


--
-- TOC entry 4465 (class 3256 OID 29284)
-- Name: lap_former_machines Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.lap_former_machines FOR SELECT USING (true);


--
-- TOC entry 4526 (class 3256 OID 45339)
-- Name: lap_former_production_detail Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.lap_former_production_detail FOR SELECT USING (true);


--
-- TOC entry 4522 (class 3256 OID 45301)
-- Name: lap_former_production_header Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.lap_former_production_header FOR SELECT USING (true);


--
-- TOC entry 4530 (class 3256 OID 45385)
-- Name: lap_former_stoppage_entry Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.lap_former_stoppage_entry FOR SELECT USING (true);


--
-- TOC entry 4461 (class 3256 OID 29237)
-- Name: simplex_machines Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.simplex_machines FOR SELECT USING (true);


--
-- TOC entry 4431 (class 3256 OID 20640)
-- Name: spinning_counts Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.spinning_counts FOR SELECT USING (true);


--
-- TOC entry 4473 (class 3256 OID 20888)
-- Name: spinning_machines Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.spinning_machines FOR SELECT USING (true);


--
-- TOC entry 4481 (class 3256 OID 20896)
-- Name: stoppage_details Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.stoppage_details FOR SELECT USING (true);


--
-- TOC entry 4477 (class 3256 OID 20892)
-- Name: stoppage_heads Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.stoppage_heads FOR SELECT USING (true);


--
-- TOC entry 4466 (class 3256 OID 20880)
-- Name: supervisors Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.supervisors FOR SELECT USING (true);


--
-- TOC entry 4485 (class 3256 OID 27668)
-- Name: tpi_entries Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.tpi_entries FOR SELECT USING (true);


--
-- TOC entry 4489 (class 3256 OID 27672)
-- Name: twc_entries Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.twc_entries FOR SELECT USING (true);


--
-- TOC entry 4450 (class 3256 OID 27606)
-- Name: autoconer_machines Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.autoconer_machines FOR UPDATE USING (true) WITH CHECK (true);


--
-- TOC entry 4520 (class 3256 OID 40690)
-- Name: breaker_drawing_machine_setup Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.breaker_drawing_machine_setup FOR UPDATE USING (true);


--
-- TOC entry 4512 (class 3256 OID 40682)
-- Name: breaker_drawing_production_detail Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.breaker_drawing_production_detail FOR UPDATE USING (true);


--
-- TOC entry 4508 (class 3256 OID 40678)
-- Name: breaker_drawing_production_header Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.breaker_drawing_production_header FOR UPDATE USING (true);


--
-- TOC entry 4516 (class 3256 OID 40686)
-- Name: breaker_drawing_stoppage_entry Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.breaker_drawing_stoppage_entry FOR UPDATE USING (true);


--
-- TOC entry 4504 (class 3256 OID 40503)
-- Name: carding_machine_setup Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.carding_machine_setup FOR UPDATE USING (true);


--
-- TOC entry 4454 (class 3256 OID 29046)
-- Name: carding_machines Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.carding_machines FOR UPDATE USING (true) WITH CHECK (true);


--
-- TOC entry 4496 (class 3256 OID 40495)
-- Name: carding_production_detail Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.carding_production_detail FOR UPDATE USING (true);


--
-- TOC entry 4492 (class 3256 OID 40491)
-- Name: carding_production_header Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.carding_production_header FOR UPDATE USING (true);


--
-- TOC entry 4500 (class 3256 OID 40499)
-- Name: carding_stoppage_entry Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.carding_stoppage_entry FOR UPDATE USING (true);


--
-- TOC entry 4458 (class 3256 OID 29142)
-- Name: comber_machines Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.comber_machines FOR UPDATE USING (true) WITH CHECK (true);


--
-- TOC entry 4430 (class 3256 OID 29092)
-- Name: drawing_breaker_machines Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.drawing_breaker_machines FOR UPDATE USING (true) WITH CHECK (true);


--
-- TOC entry 4438 (class 3256 OID 29190)
-- Name: drawing_finisher_machines Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.drawing_finisher_machines FOR UPDATE USING (true) WITH CHECK (true);


--
-- TOC entry 4445 (class 3256 OID 20708)
-- Name: hok_strength_detail Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.hok_strength_detail FOR UPDATE USING (true) WITH CHECK (true);


--
-- TOC entry 4441 (class 3256 OID 20704)
-- Name: hok_strength_head Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.hok_strength_head FOR UPDATE USING (true) WITH CHECK (true);


--
-- TOC entry 4536 (class 3256 OID 45415)
-- Name: lap_former_machine_setup Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.lap_former_machine_setup FOR UPDATE USING (true);


--
-- TOC entry 4471 (class 3256 OID 29286)
-- Name: lap_former_machines Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.lap_former_machines FOR UPDATE USING (true) WITH CHECK (true);


--
-- TOC entry 4528 (class 3256 OID 45341)
-- Name: lap_former_production_detail Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.lap_former_production_detail FOR UPDATE USING (true);


--
-- TOC entry 4524 (class 3256 OID 45303)
-- Name: lap_former_production_header Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.lap_former_production_header FOR UPDATE USING (true);


--
-- TOC entry 4532 (class 3256 OID 45387)
-- Name: lap_former_stoppage_entry Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.lap_former_stoppage_entry FOR UPDATE USING (true);


--
-- TOC entry 4463 (class 3256 OID 29239)
-- Name: simplex_machines Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.simplex_machines FOR UPDATE USING (true) WITH CHECK (true);


--
-- TOC entry 4433 (class 3256 OID 20642)
-- Name: spinning_counts Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.spinning_counts FOR UPDATE USING (true) WITH CHECK (true);


--
-- TOC entry 4475 (class 3256 OID 20890)
-- Name: spinning_machines Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.spinning_machines FOR UPDATE USING (true) WITH CHECK (true);


--
-- TOC entry 4483 (class 3256 OID 20898)
-- Name: stoppage_details Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.stoppage_details FOR UPDATE USING (true) WITH CHECK (true);


--
-- TOC entry 4479 (class 3256 OID 20894)
-- Name: stoppage_heads Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.stoppage_heads FOR UPDATE USING (true) WITH CHECK (true);


--
-- TOC entry 4468 (class 3256 OID 20882)
-- Name: supervisors Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.supervisors FOR UPDATE USING (true) WITH CHECK (true);


--
-- TOC entry 4487 (class 3256 OID 27670)
-- Name: tpi_entries Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.tpi_entries FOR UPDATE USING (true) WITH CHECK (true);


--
-- TOC entry 4425 (class 3256 OID 27674)
-- Name: twc_entries Enable update for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for all users" ON public.twc_entries FOR UPDATE USING (true) WITH CHECK (true);


--
-- TOC entry 4400 (class 0 OID 17854)
-- Dependencies: 345
-- Name: autoconer_machines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.autoconer_machines ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4419 (class 0 OID 40615)
-- Dependencies: 379
-- Name: breaker_drawing_machine_setup; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.breaker_drawing_machine_setup ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4417 (class 0 OID 40539)
-- Dependencies: 377
-- Name: breaker_drawing_production_detail; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.breaker_drawing_production_detail ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4416 (class 0 OID 40510)
-- Dependencies: 376
-- Name: breaker_drawing_production_header; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.breaker_drawing_production_header ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4418 (class 0 OID 40573)
-- Dependencies: 378
-- Name: breaker_drawing_stoppage_entry; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.breaker_drawing_stoppage_entry ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4415 (class 0 OID 40466)
-- Dependencies: 374
-- Name: carding_machine_setup; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.carding_machine_setup ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4406 (class 0 OID 29023)
-- Dependencies: 363
-- Name: carding_machines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.carding_machines ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4413 (class 0 OID 40390)
-- Dependencies: 372
-- Name: carding_production_detail; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.carding_production_detail ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4412 (class 0 OID 40361)
-- Dependencies: 371
-- Name: carding_production_header; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.carding_production_header ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4414 (class 0 OID 40424)
-- Dependencies: 373
-- Name: carding_stoppage_entry; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.carding_stoppage_entry ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4408 (class 0 OID 29119)
-- Dependencies: 365
-- Name: comber_machines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comber_machines ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4395 (class 0 OID 17744)
-- Dependencies: 340
-- Name: departments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4407 (class 0 OID 29070)
-- Dependencies: 364
-- Name: drawing_breaker_machines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.drawing_breaker_machines ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4409 (class 0 OID 29168)
-- Dependencies: 366
-- Name: drawing_finisher_machines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.drawing_finisher_machines ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4404 (class 0 OID 17991)
-- Dependencies: 351
-- Name: hok_strength_detail; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hok_strength_detail ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4403 (class 0 OID 17976)
-- Dependencies: 348
-- Name: hok_strength_head; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hok_strength_head ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4423 (class 0 OID 45389)
-- Dependencies: 384
-- Name: lap_former_machine_setup; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lap_former_machine_setup ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4411 (class 0 OID 29264)
-- Dependencies: 368
-- Name: lap_former_machines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lap_former_machines ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4421 (class 0 OID 45305)
-- Dependencies: 382
-- Name: lap_former_production_detail; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lap_former_production_detail ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4420 (class 0 OID 45271)
-- Dependencies: 381
-- Name: lap_former_production_header; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lap_former_production_header ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4422 (class 0 OID 45343)
-- Dependencies: 383
-- Name: lap_former_stoppage_entry; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lap_former_stoppage_entry ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4410 (class 0 OID 29214)
-- Dependencies: 367
-- Name: simplex_machines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.simplex_machines ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4405 (class 0 OID 18320)
-- Dependencies: 354
-- Name: spinning_counts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.spinning_counts ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4396 (class 0 OID 17758)
-- Dependencies: 341
-- Name: spinning_machines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.spinning_machines ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4398 (class 0 OID 17786)
-- Dependencies: 343
-- Name: stoppage_details; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stoppage_details ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4397 (class 0 OID 17773)
-- Dependencies: 342
-- Name: stoppage_heads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stoppage_heads ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4399 (class 0 OID 17836)
-- Dependencies: 344
-- Name: supervisors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.supervisors ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4401 (class 0 OID 17869)
-- Dependencies: 346
-- Name: tpi_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tpi_entries ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4402 (class 0 OID 17890)
-- Dependencies: 347
-- Name: twc_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.twc_entries ENABLE ROW LEVEL SECURITY;

-- Completed on 2025-12-25 23:09:22

--
-- PostgreSQL database dump complete
--

\unrestrict YdHV1XhSYp5Cb0Ii5z0u4OJeQKeRYQTRWc492S4yOTeF2FEnbtcnJA1SzteXlgj

