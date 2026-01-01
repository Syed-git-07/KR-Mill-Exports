-- ============================================
-- AUTOCONER MACHINE - MC_ID FIX
-- ============================================
-- This script updates mc_id to be a serial number (1-35)
-- and group_id to be the machine group from the series name
-- 
-- mc_id: Serial number (1, 2, 3, ... 35) - unique per machine
-- group_id: Machine group extracted from series (AC5-1 = group 5)
-- ============================================

-- ============================================
-- STEP 1: UPDATE MC_ID AS SERIAL NUMBERS
-- ============================================
-- mc_id should be a sequential number for each machine
-- This matches the VB6 application where Mc id is a dropdown
-- with numbers like 1, 2, 3, etc.

-- First, let's update the existing data with proper mc_id (serial 1-35)
-- and group_id (based on machine series)

-- Clear and re-insert with correct mc_id values
TRUNCATE TABLE autoconer_machines;

-- Insert with mc_id as serial (1-35) and group_id as machine group number
INSERT INTO autoconer_machines (
  mc_id, machine_no, description, make_name, act_effi, is_active,
  group_id, model, from_drum, to_drum, no_of_drums,
  speed, count, installed_date, direct_prod_entry
) VALUES
  -- mc_id 1: AC4-5 (Group 4, Position 5)
  (1, 'AC4-5', 'AC4-5', 'MURT', 0, true, 4, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC5 Series (Group 5) - mc_id 2-6
  (2, 'AC5-1', 'AC5-1', 'MURT', 80, true, 5, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (3, 'AC5-2', 'AC5-2', 'MURT', 80, true, 5, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (4, 'AC5-3', 'AC5-3', 'MURT', 80, true, 5, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (5, 'AC5-4', 'AC5-4', 'MURT', 80, true, 5, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (6, 'AC5-5', 'AC5-5', 'MURT', 80, true, 5, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC6 Series (Group 6) - mc_id 7-11
  (7, 'AC6-1', 'AC6-1', 'MURT', 82, true, 6, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (8, 'AC6-2', 'AC6-2', 'MURT', 0, true, 6, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (9, 'AC6-3', 'AC6-3', 'MURT', 0, true, 6, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (10, 'AC6-4', 'AC6-4', 'MURT', 0, true, 6, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (11, 'AC6-5', 'AC6-5', 'MURT', 0, true, 6, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC7 Series (Group 7) - mc_id 12-16
  (12, 'AC7-1', 'AC7-1', 'MURT', 0, true, 7, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (13, 'AC7-2', 'AC7-2', 'MURT', 0, true, 7, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (14, 'AC7-3', 'AC7-3', 'MURT', 0, true, 7, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (15, 'AC7-4', 'AC7-4', 'MURT', 0, true, 7, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (16, 'AC7-5', 'AC7-5', 'MURT', 0, true, 7, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC8 Series (Group 8) - mc_id 17-21
  (17, 'AC8-1', 'AC8-1', 'MURT', 0, true, 8, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (18, 'AC8-2', 'AC8-2', 'MURT', 0, true, 8, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (19, 'AC8-3', 'AC8-3', 'MURT', 0, true, 8, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (20, 'AC8-4', 'AC8-4', 'MURT', 0, true, 8, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (21, 'AC8-5', 'AC8-5', 'MURT', 0, true, 8, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC9 Series (Group 9) - mc_id 22-23
  (22, 'AC9-1', 'AC9-1', 'MURT', 0, true, 9, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (23, 'AC9-2', 'AC9-2', 'MURT', 0, true, 9, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC10 Series (Group 10) - mc_id 24-25
  (24, 'AC10-1', 'AC10-1', 'MURT', 0, true, 10, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (25, 'AC10-2', 'AC10-2', 'MURT', 0, true, 10, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC11 Series (Group 11) - mc_id 26-27
  (26, 'AC11-1', 'AC11-1', 'MURT', 0, true, 11, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (27, 'AC11-2', 'AC11-2', 'MURT', 0, true, 11, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC12 Series (Group 12) - mc_id 28-29
  (28, 'AC12-1', 'AC12-1', 'MURT', 82, true, 12, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (29, 'AC12-2', 'AC12-2', 'MURT', 0, true, 12, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC13 Series (Group 13) - mc_id 30-31
  (30, 'AC13-1', 'AC13-1', 'MURT', 82, true, 13, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (31, 'AC13-2', 'AC13-2', 'MURT', 82, true, 13, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC14 Series (Group 14) - mc_id 32
  (32, 'AC14-1', 'AC14-1', 'MURT', 0, true, 14, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  
  -- AC2A Series (Group 2) - mc_id 33-34
  (33, 'AC2A-1', 'AC2A-1', 'MURT', 0, true, 2, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false),
  (34, 'AC2A-2', 'AC2A-2', 'MURT', 0, true, 2, NULL, NULL, NULL, 0, NULL, NULL, '2015-04-01', false);

-- ============================================
-- STEP 2: ADD UNIQUE CONSTRAINT ON MC_ID
-- ============================================
-- mc_id should be unique as it's the serial identifier
ALTER TABLE autoconer_machines DROP CONSTRAINT IF EXISTS autoconer_machines_mc_id_unique;
ALTER TABLE autoconer_machines ADD CONSTRAINT autoconer_machines_mc_id_unique UNIQUE (mc_id);

-- ============================================
-- STEP 3: CREATE SEQUENCE FOR AUTO-INCREMENT MC_ID
-- ============================================
-- Create sequence starting from 35 (next available)
DROP SEQUENCE IF EXISTS autoconer_machines_mc_id_seq;
CREATE SEQUENCE autoconer_machines_mc_id_seq START WITH 35;

-- ============================================
-- STEP 4: VERIFY THE UPDATE
-- ============================================

-- Check data with proper mc_id and group_id
SELECT 
  mc_id as "Mc ID",
  group_id as "Group ID",
  machine_no as "M/c No.",
  description as "Description",
  make_name as "Make Name",
  act_effi as "ActEffi",
  is_active as "Active"
FROM autoconer_machines
ORDER BY mc_id;

-- Summary by group
SELECT 
  group_id as "Group",
  COUNT(*) as "Machine Count",
  STRING_AGG(machine_no, ', ' ORDER BY mc_id) as "Machines"
FROM autoconer_machines
GROUP BY group_id
ORDER BY group_id;
