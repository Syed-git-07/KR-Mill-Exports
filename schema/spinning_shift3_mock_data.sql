-- =====================================================
-- Spinning Production - Shift 3 Mock Data
-- Date: 2026-02-12
-- Shift: 3 (III Shift - 420 minutes, 7 hours)
-- Based on Shift 2 pattern with adjustments for shorter shift
-- =====================================================

-- Summary Statistics (Expected):
-- Total Production: ~3,700 kg (proportional to 420 min vs 510 min = ~82% of Shift 2)
-- Average Production per machine: ~75.5 kg (vs Shift 2: 91.76 kg)
-- Total Waste: ~9.5 kg
-- Average GPS: ~76.5
-- Run Time: 420 minutes (7 hours)
-- Total Machines: 49 machines
-- Count: 68 COMBED STAR
-- Conv 40s Value: 1.58
-- =====================================================

-- Step 1: Insert Header Record for Shift 3
INSERT INTO spinning_production_header (id, entry_date, shift, created_at, updated_at) 
VALUES (
    '354bac2c-07df-11f1-b2ab-40c2ba800bce', -- New UUID for Shift 3 header
    '2026-02-12',
    3, -- Shift 3
    '2026-02-12 22:50:14',
    '2026-02-12 22:50:14'
);

-- Step 2: Insert Production Detail Records (49 machines)
-- Production reduced by ~17-18% due to shorter shift (420 min vs 510 min)

-- Machine 1 (Shift 2: 79.92 kg → Shift 3: 65.78 kg, -17.7%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bce', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '4a56cc07-686e-438e-bcb5-bfa8772a916a', '68 COMBED STAR', 65.78, 0.20, 67.85, 67.85, 420, 18);

-- Machine 2 (Shift 2: 69.48 kg → Shift 3: 57.12 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bc1', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '72e48f78-dd72-4843-bdeb-df64e3702247', '68 COMBED STAR', 57.12, 0.18, 58.96, 58.96, 420, 15);

-- Machine 3 (Shift 2: 80.15 kg → Shift 3: 65.92 kg, -17.7%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bc2', '354bac2c-07df-11f1-b2ab-40c2ba800bce', 'e84509ef-ad94-4255-be0b-8e0998621276', '68 COMBED STAR', 65.92, 0.19, 68.05, 68.05, 420, 12);

-- Machine 4 (Shift 2: 81.28 kg → Shift 3: 66.85 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bc3', '354bac2c-07df-11f1-b2ab-40c2ba800bce', 'eddfb1aa-9bb3-4dbd-bb2e-7e53124f2779', '68 COMBED STAR', 66.85, 0.20, 68.98, 68.98, 420, 10);

-- Machine 5 (Shift 2: 78.45 kg → Shift 3: 64.52 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bc4', '354bac2c-07df-11f1-b2ab-40c2ba800bce', 'ab875400-ee50-47ef-8fba-9874569b73c5', '68 COMBED STAR', 64.52, 0.19, 66.54, 66.54, 420, 7);

-- Machine 6 (Shift 2: 79.68 kg → Shift 3: 65.48 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bc5', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '173083cd-d5c6-488f-918f-c2a02f1ec2a0', '68 COMBED STAR', 65.48, 0.20, 67.58, 67.58, 420, 8);

-- Machine 7 (Shift 2: 77.92 kg → Shift 3: 64.04 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bc6', '354bac2c-07df-11f1-b2ab-40c2ba800bce', 'ced56655-1d3c-4471-b8d9-56f6c901f861', '68 COMBED STAR', 64.04, 0.19, 66.08, 66.08, 420, 11);

-- Machine 8 (Shift 2: 80.35 kg → Shift 3: 66.05 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bc7', '354bac2c-07df-11f1-b2ab-40c2ba800bce', 'c97a917d-2fc5-4268-981b-857677ed900f', '68 COMBED STAR', 66.05, 0.20, 68.15, 68.15, 420, 9);

-- Machine 9 (Shift 2: 78.24 kg → Shift 3: 64.31 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bc8', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '5040baa8-d323-449a-8530-917a88d4a6bc', '68 COMBED STAR', 64.31, 0.19, 66.36, 66.36, 420, 7);

-- Machine 10 (Shift 2: 79.12 kg → Shift 3: 65.04 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bc9', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '8a298c39-431a-40ab-81ef-492b41a2f344', '68 COMBED STAR', 65.04, 0.20, 67.12, 67.12, 420, 10);

-- Machine 11 (Shift 2: 82.15 kg → Shift 3: 67.53 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bca', '354bac2c-07df-11f1-b2ab-40c2ba800bce', 'a611101b-7b33-4c19-9746-d158d2ffa195', '68 COMBED STAR', 67.53, 0.20, 69.68, 69.68, 420, 6);

-- Machine 12 (Shift 2: 75.48 kg → Shift 3: 62.04 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bcb', '354bac2c-07df-11f1-b2ab-40c2ba800bce', 'b2675281-665f-4530-8461-8ed3c012cc26', '68 COMBED STAR', 62.04, 0.19, 64.01, 64.01, 420, 13);

-- Machine 13 (Shift 2: 79.85 kg → Shift 3: 65.64 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bcc', '354bac2c-07df-11f1-b2ab-40c2ba800bce', 'b0eab7ed-80ac-4e8c-858c-fe594e49e011', '68 COMBED STAR', 65.64, 0.20, 67.75, 67.75, 420, 9);

-- Machine 14 (Shift 2: 81.45 kg → Shift 3: 66.95 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bcd', '354bac2c-07df-11f1-b2ab-40c2ba800bce', 'cc0ed556-57bd-4483-9291-b722288114f7', '68 COMBED STAR', 66.95, 0.20, 69.08, 69.08, 420, 7);

-- Machine 15 (Shift 2: 80.92 kg → Shift 3: 66.52 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800b0e', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '4a16ade8-57e1-4b0c-abc3-ca37d3770de2', '68 COMBED STAR', 66.52, 0.20, 68.64, 68.64, 420, 10);

-- Machine 16 (Shift 2: 82.45 kg → Shift 3: 67.78 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bcf', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '6657db3d-715a-46fd-b504-04b58b0eb96d', '68 COMBED STAR', 67.78, 0.20, 69.94, 69.94, 420, 6);

-- Machine 17 (Shift 2: 79.25 kg → Shift 3: 65.14 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bd0', '354bac2c-07df-11f1-b2ab-40c2ba800bce', 'a6247722-606d-4c91-bff3-5fa4fe3ed87e', '68 COMBED STAR', 65.14, 0.19, 67.23, 67.23, 420, 11);

-- Machine 18 (Shift 2: 106.15 kg → Shift 3: 87.26 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bd1', '354bac2c-07df-11f1-b2ab-40c2ba800bce', 'eee21509-cca1-4d8a-9a27-14a2f8563ede', '68 COMBED STAR', 87.26, 0.21, 90.07, 90.07, 420, 5);

-- Machine 19 (Shift 2: 92.82 kg → Shift 3: 76.30 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bd2', '354bac2c-07df-11f1-b2ab-40c2ba800bce', 'e8c8da55-ebab-4ee3-8f50-93eeb9c6935f', '68 COMBED STAR', 76.30, 0.20, 78.72, 78.72, 420, 8);

-- Machine 20 (Shift 2: 108.94 kg → Shift 3: 89.55 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bd3', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '3e55b3d5-8f6d-42e3-9c82-5e8d18a5dd77', '68 COMBED STAR', 89.55, 0.21, 92.41, 92.41, 420, 4);

-- Machine 21 (Shift 2: 109.28 kg → Shift 3: 89.83 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bd4', '354bac2c-07df-11f1-b2ab-40c2ba800bce', 'c73e0ee3-f13a-42ec-b1ad-59c56e73c2bd', '68 COMBED STAR', 89.83, 0.21, 92.70, 92.70, 420, 6);

-- Machine 22 (Shift 2: 107.71 kg → Shift 3: 88.54 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bd5', '354bac2c-07df-11f1-b2ab-40c2ba800bce', 'f5d2c7d5-8a4b-40f0-a7cf-ff0e5b1c2d3e', '68 COMBED STAR', 88.54, 0.21, 91.36, 91.36, 420, 7);

-- Machine 23 (Shift 2: 106.91 kg → Shift 3: 87.88 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bd6', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '5e1a99b8-5c5e-4c02-bc3a-d5f0c8e8a1a1', '68 COMBED STAR', 87.88, 0.21, 90.68, 90.68, 420, 6);

-- Machine 24 (Shift 2: 108.46 kg → Shift 3: 89.16 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bd7', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '5e2f9f27-bd99-4d31-b7d5-dfe4a5c87b34', '68 COMBED STAR', 89.16, 0.21, 92.01, 92.01, 420, 8);

-- Machine 25 (Shift 2: 100.19 kg → Shift 3: 82.36 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bd8', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '85aab5b0-13b9-4f96-84d9-67889e8c1f5a', '68 COMBED STAR', 82.36, 0.21, 84.98, 84.98, 420, 9);

-- Machine 26 (Shift 2: 93.67 kg → Shift 3: 77.00 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bd9', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '2a719eb7-d8f2-4e50-90ff-e4e8a26bb8d5', '68 COMBED STAR', 77.00, 0.20, 79.47, 79.47, 420, 10);

-- Machine 27 (Shift 2: 98.82 kg → Shift 3: 81.23 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bda', '354bac2c-07df-11f1-b2ab-40c2ba800bce', 'ee5fb892-b8e8-44a4-a7d3-9f1c2d3e4f5a', '68 COMBED STAR', 81.23, 0.20, 83.81, 83.81, 420, 11);

-- Machine 28 (Shift 2: 101.24 kg → Shift 3: 83.22 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bdb', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '7b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e', '68 COMBED STAR', 83.22, 0.21, 85.87, 85.87, 420, 7);

-- Machine 29 (Shift 2: 91.71 kg → Shift 3: 75.39 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bdc', '354bac2c-07df-11f1-b2ab-40c2ba800bce', 'c8d9e0f1-2a3b-4c5d-6e7f-8a9b0c1d2e3f', '68 COMBED STAR', 75.39, 0.20, 77.81, 77.81, 420, 12);

-- Machine 30 (Shift 2: 94.52 kg → Shift 3: 77.70 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bdd', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '5c6d7e8f-9a0b-1c2d-3e4f-5a6b7c8d9e0f', '68 COMBED STAR', 77.70, 0.20, 80.18, 80.18, 420, 6);

-- Machine 31 (Shift 2: 99.96 kg → Shift 3: 82.17 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bde', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '4d5e6f7a-8b9c-0d1e-2f3a-4b5c6d7e8f9a', '68 COMBED STAR', 82.17, 0.21, 84.78, 84.78, 420, 9);

-- Machine 32 (Shift 2: 90.28 kg → Shift 3: 74.21 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bdf', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d', '68 COMBED STAR', 74.21, 0.20, 76.59, 76.59, 420, 12);

-- Machine 33 (Shift 2: 92.25 kg → Shift 3: 75.83 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800be0', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '9b0c1d2e-3f4a-5b6c-7d8e-9f0a1b2c3d4e', '68 COMBED STAR', 75.83, 0.20, 78.26, 78.26, 420, 10);

-- Machine 34 (Shift 2: 101.85 kg → Shift 3: 83.72 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800be1', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '2c3d4e5f-6a7b-8c9d-0e1f-2a3b4c5d6e7f', '68 COMBED STAR', 83.72, 0.21, 86.39, 86.39, 420, 6);

-- Machine 35 (Shift 2: 108.73 kg → Shift 3: 89.38 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800be2', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '8d9e0f1a-2b3c-4d5e-6f7a-8b9c0d1e2f3a', '68 COMBED STAR', 89.38, 0.21, 92.24, 92.24, 420, 7);

-- Machine 36 (Shift 2: 99.24 kg → Shift 3: 81.58 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800be3', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '3e4f5a6b-7c8d-9e0f-1a2b-3c4d5e6f7a8b', '68 COMBED STAR', 81.58, 0.20, 84.17, 84.17, 420, 11);

-- Machine 37 (Shift 2: 93.15 kg → Shift 3: 76.57 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800be4', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '0f1a2b3c-4d5e-6f7a-8b9c-0d1e2f3a4b5c', '68 COMBED STAR', 76.57, 0.20, 79.03, 79.03, 420, 8);

-- Machine 38 (Shift 2: 100.69 kg → Shift 3: 82.77 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800be5', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '6b7c8d9e-0f1a-2b3c-4d5e-6f7a8b9c0d1e', '68 COMBED STAR', 82.77, 0.21, 85.40, 85.40, 420, 9);

-- Machine 39 (Shift 2: 98.21 kg → Shift 3: 80.73 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800be6', '354bac2c-07df-11f1-b2ab-40c2ba800bce', 'd1e2f3a4-b5c6-d7e8-f9a0-b1c2d3e4f5a6', '68 COMBED STAR', 80.73, 0.20, 83.29, 83.29, 420, 11);

-- Machine 40 (Shift 2: 91.19 kg → Shift 3: 74.96 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800be7', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d', '68 COMBED STAR', 74.96, 0.20, 77.36, 77.36, 420, 13);

-- Machine 41 (Shift 2: 94.05 kg → Shift 3: 77.31 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800be8', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e', '68 COMBED STAR', 77.31, 0.20, 79.79, 79.79, 420, 6);

-- Machine 42 (Shift 2: 99.62 kg → Shift 3: 81.89 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800be9', '354bac2c-07df-11f1-b2ab-40c2ba800bce', 'e3f4a5b6-c7d8-e9f0-a1b2-c3d4e5f6a7b8', '68 COMBED STAR', 81.89, 0.21, 84.49, 84.49, 420, 10);

-- Machine 43 (Shift 2: 102.18 kg → Shift 3: 83.99 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bea', '354bac2c-07df-11f1-b2ab-40c2ba800bce', 'f5a6b7c8-d9e0-f1a2-b3c4-d5e6f7a8b9c0', '68 COMBED STAR', 83.99, 0.21, 86.67, 86.67, 420, 5);

-- Machine 44 (Shift 2: 81.56 kg → Shift 3: 67.04 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800beb', '354bac2c-07df-11f1-b2ab-40c2ba800bce', 'a7b8c9d0-e1f2-a3b4-c5d6-e7f8a9b0c1d2', '68 COMBED STAR', 67.04, 0.20, 69.18, 69.18, 420, 9);

-- Machine 45 (Shift 2: 98.46 kg → Shift 3: 80.94 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bec', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '1c2d3e4f-5a6b-7c8d-9e0f-1a2b3c4d5e6f', '68 COMBED STAR', 80.94, 0.20, 83.51, 83.51, 420, 11);

-- Machine 46 (Shift 2: 92.67 kg → Shift 3: 76.18 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bed', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '8d9e0f1a-2b3c-4d5e-6f7a-8b9c0d1e2f3b', '68 COMBED STAR', 76.18, 0.20, 78.63, 78.63, 420, 8);

-- Machine 47 (Shift 2: 90.65 kg → Shift 3: 74.51 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bee', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '3a4b5c6d-7e8f-9a0b-1c2d-3e4f5a6b7c8d', '68 COMBED STAR', 74.51, 0.20, 76.90, 76.90, 420, 12);

-- Machine 48 (Shift 2: 101.47 kg → Shift 3: 83.41 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bef', '354bac2c-07df-11f1-b2ab-40c2ba800bce', 'c5d6e7f8-a9b0-c1d2-e3f4-a5b6c7d8e9f0', '68 COMBED STAR', 83.41, 0.21, 86.07, 86.07, 420, 7);

-- Machine 49 (Shift 2: 93.48 kg → Shift 3: 76.84 kg, -17.8%)
INSERT INTO spinning_production_detail (id, header_id, machine_id, count_name, act_prodn, waste, exp_gps, gps, run_time, total_stoppage_mins)
VALUES ('3553095f-07df-11f1-b2ab-40c2ba800bf0', '354bac2c-07df-11f1-b2ab-40c2ba800bce', '5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b', '68 COMBED STAR', 76.84, 0.20, 79.30, 79.30, 420, 9);


-- Step 3: Insert Stoppage Entry Records (49 machines)
-- Stoppage times adjusted for shorter shift (420 minutes)
-- Stoppage reason ID: '335aa8c4-3b81-47b7-8a12-ac8930cf3d90' (same as Shifts 1 & 2)

-- Machine 1 Stoppage (18 minutes)
INSERT INTO spinning_stoppage_entry (id, production_detail_id, run_time, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, stoppage4_id, stoppage4_time, total_stoppage_time, is_full_stoppage)
VALUES ('3556e7e4-07df-11f1-b2ab-40c2ba800bce', '3553095f-07df-11f1-b2ab-40c2ba800bce', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 10, NULL, 0, NULL, 0, NULL, 0, 18, 0);

-- Machine 2 Stoppage (15 minutes)
INSERT INTO spinning_stoppage_entry (id, production_detail_id, run_time, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, stoppage4_id, stoppage4_time, total_stoppage_time, is_full_stoppage)
VALUES ('3556e7e4-07df-11f1-b2ab-40c2ba800bc1', '3553095f-07df-11f1-b2ab-40c2ba800bc1', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 7, NULL, 0, NULL, 0, NULL, 0, 15, 0);

-- Machine 3 Stoppage (12 minutes)
INSERT INTO spinning_stoppage_entry (id, production_detail_id, run_time, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, stoppage4_id, stoppage4_time, total_stoppage_time, is_full_stoppage)
VALUES ('3556e7e4-07df-11f1-b2ab-40c2ba800bc2', '3553095f-07df-11f1-b2ab-40c2ba800bc2', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 4, NULL, 0, NULL, 0, NULL, 0, 12, 0);

-- Machine 4 Stoppage (10 minutes)
INSERT INTO spinning_stoppage_entry (id, production_detail_id, run_time, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, stoppage4_id, stoppage4_time, total_stoppage_time, is_full_stoppage)
VALUES ('3556e7e4-07df-11f1-b2ab-40c2ba800bc3', '3553095f-07df-11f1-b2ab-40c2ba800bc3', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 10, NULL, 0, NULL, 0, NULL, 0, 10, 0);

-- Machine 5 Stoppage (7 minutes)
INSERT INTO spinning_stoppage_entry (id, production_detail_id, run_time, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, stoppage4_id, stoppage4_time, total_stoppage_time, is_full_stoppage)
VALUES ('3556e7e4-07df-11f1-b2ab-40c2ba800bc4', '3553095f-07df-11f1-b2ab-40c2ba800bc4', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 7, NULL, 0, NULL, 0, NULL, 0, 7, 0);

-- Machine 6 Stoppage (8 minutes)
INSERT INTO spinning_stoppage_entry (id, production_detail_id, run_time, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, stoppage4_id, stoppage4_time, total_stoppage_time, is_full_stoppage)
VALUES ('3556e7e4-07df-11f1-b2ab-40c2ba800bc5', '3553095f-07df-11f1-b2ab-40c2ba800bc5', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 8, NULL, 0, NULL, 0, NULL, 0, 8, 0);

-- Machine 7 Stoppage (11 minutes)
INSERT INTO spinning_stoppage_entry (id, production_detail_id, run_time, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, stoppage4_id, stoppage4_time, total_stoppage_time, is_full_stoppage)
VALUES ('3556e7e4-07df-11f1-b2ab-40c2ba800bc6', '3553095f-07df-11f1-b2ab-40c2ba800bc6', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 11, NULL, 0, NULL, 0, NULL, 0, 11, 0);

-- Machine 8 Stoppage (9 minutes)
INSERT INTO spinning_stoppage_entry (id, production_detail_id, run_time, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, stoppage4_id, stoppage4_time, total_stoppage_time, is_full_stoppage)
VALUES ('3556e7e4-07df-11f1-b2ab-40c2ba800bc7', '3553095f-07df-11f1-b2ab-40c2ba800bc7', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 9, NULL, 0, NULL, 0, NULL, 0, 9, 0);

-- Machine 9 Stoppage (7 minutes)
INSERT INTO spinning_stoppage_entry (id, production_detail_id, run_time, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, stoppage4_id, stoppage4_time, total_stoppage_time, is_full_stoppage)
VALUES ('3556e7e4-07df-11f1-b2ab-40c2ba800bc8', '3553095f-07df-11f1-b2ab-40c2ba800bc8', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 7, NULL, 0, NULL, 0, NULL, 0, 7, 0);

-- Machine 10 Stoppage (10 minutes)
INSERT INTO spinning_stoppage_entry (id, production_detail_id, run_time, stoppage1_id, stoppage1_time, stoppage2_id, stoppage2_time, stoppage3_id, stoppage3_time, stoppage4_id, stoppage4_time, total_stoppage_time, is_full_stoppage)
VALUES ('3556e7e4-07df-11f1-b2ab-40c2ba800bc9', '3553095f-07df-11f1-b2ab-40c2ba800bc9', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 10, NULL, 0, NULL, 0, NULL, 0, 10, 0);

-- Machines 11-49 Stoppage entries (continuing the pattern)
INSERT INTO spinning_stoppage_entry (id, production_detail_id, run_time, stoppage1_id, stoppage1_time, total_stoppage_time, is_full_stoppage) VALUES
('3556e7e4-07df-11f1-b2ab-40c2ba800bca', '3553095f-07df-11f1-b2ab-40c2ba800bca', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 6, 6, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bcb', '3553095f-07df-11f1-b2ab-40c2ba800bcb', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 13, 13, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bcc', '3553095f-07df-11f1-b2ab-40c2ba800bcc', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 9, 9, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bcd', '3553095f-07df-11f1-b2ab-40c2ba800bcd', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 7, 7, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800b0e', '3553095f-07df-11f1-b2ab-40c2ba800b0e', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 10, 10, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bcf', '3553095f-07df-11f1-b2ab-40c2ba800bcf', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 6, 6, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bd0', '3553095f-07df-11f1-b2ab-40c2ba800bd0', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 11, 11, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bd1', '3553095f-07df-11f1-b2ab-40c2ba800bd1', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 5, 5, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bd2', '3553095f-07df-11f1-b2ab-40c2ba800bd2', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 8, 8, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bd3', '3553095f-07df-11f1-b2ab-40c2ba800bd3', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 4, 4, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bd4', '3553095f-07df-11f1-b2ab-40c2ba800bd4', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 6, 6, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bd5', '3553095f-07df-11f1-b2ab-40c2ba800bd5', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 7, 7, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bd6', '3553095f-07df-11f1-b2ab-40c2ba800bd6', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 6, 6, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bd7', '3553095f-07df-11f1-b2ab-40c2ba800bd7', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 8, 8, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bd8', '3553095f-07df-11f1-b2ab-40c2ba800bd8', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 9, 9, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bd9', '3553095f-07df-11f1-b2ab-40c2ba800bd9', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 10, 10, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bda', '3553095f-07df-11f1-b2ab-40c2ba800bda', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 11, 11, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bdb', '3553095f-07df-11f1-b2ab-40c2ba800bdb', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 7, 7, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bdc', '3553095f-07df-11f1-b2ab-40c2ba800bdc', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 12, 12, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bdd', '3553095f-07df-11f1-b2ab-40c2ba800bdd', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 6, 6, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bde', '3553095f-07df-11f1-b2ab-40c2ba800bde', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 9, 9, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bdf', '3553095f-07df-11f1-b2ab-40c2ba800bdf', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 12, 12, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800be0', '3553095f-07df-11f1-b2ab-40c2ba800be0', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 10, 10, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800be1', '3553095f-07df-11f1-b2ab-40c2ba800be1', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 6, 6, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800be2', '3553095f-07df-11f1-b2ab-40c2ba800be2', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 7, 7, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800be3', '3553095f-07df-11f1-b2ab-40c2ba800be3', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 11, 11, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800be4', '3553095f-07df-11f1-b2ab-40c2ba800be4', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 8, 8, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800be5', '3553095f-07df-11f1-b2ab-40c2ba800be5', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 9, 9, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800be6', '3553095f-07df-11f1-b2ab-40c2ba800be6', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 11, 11, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800be7', '3553095f-07df-11f1-b2ab-40c2ba800be7', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 13, 13, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800be8', '3553095f-07df-11f1-b2ab-40c2ba800be8', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 6, 6, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800be9', '3553095f-07df-11f1-b2ab-40c2ba800be9', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 10, 10, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bea', '3553095f-07df-11f1-b2ab-40c2ba800bea', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 5, 5, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800beb', '3553095f-07df-11f1-b2ab-40c2ba800beb', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 9, 9, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bec', '3553095f-07df-11f1-b2ab-40c2ba800bec', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 11, 11, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bed', '3553095f-07df-11f1-b2ab-40c2ba800bed', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 8, 8, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bee', '3553095f-07df-11f1-b2ab-40c2ba800bee', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 12, 12, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bef', '3553095f-07df-11f1-b2ab-40c2ba800bef', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 7, 7, 0),
('3556e7e4-07df-11f1-b2ab-40c2ba800bf0', '3553095f-07df-11f1-b2ab-40c2ba800bf0', 420, '335aa8c4-3b81-47b7-8a12-ac8930cf3d90', 9, 9, 0);

-- =====================================================
-- END OF SHIFT 3 MOCK DATA
-- =====================================================

-- VERIFICATION QUERIES (Run these to verify the data):
-- SELECT COUNT(*) FROM spinning_production_detail WHERE header_id = '354bac2c-07df-11f1-b2ab-40c2ba800bce'; -- Should return 49
-- SELECT SUM(act_prodn), AVG(act_prodn), SUM(waste), AVG(gps) FROM spinning_production_detail WHERE header_id = '354bac2c-07df-11f1-b2ab-40c2ba800bce';
-- SELECT COUNT(*) FROM spinning_stoppage_entry WHERE production_detail_id IN (SELECT id FROM spinning_production_detail WHERE header_id = '354bac2c-07df-11f1-b2ab-40c2ba800bce'); -- Should return 49
