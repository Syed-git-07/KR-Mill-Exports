-- ============================================================
-- Migration: Shift-wise Runtime Configuration for Carding Entry
-- Database: kr_production
-- Date: 2026-01-31
-- ============================================================
-- 
-- Changes:
-- 1. Create shift_config table for centralized shift time management
-- 2. Insert default shift configurations
-- 3. Add department-specific shift configs (optional)
-- ============================================================

USE kr_production;

-- ============================================================
-- 1. Create shift_config table
-- ============================================================
-- This table stores shift time configurations for all departments
-- shift_time = total available minutes in the shift
-- default_stoppage = default stoppage time for the department

CREATE TABLE IF NOT EXISTS shift_config (
    id CHAR(36) DEFAULT (UUID()) NOT NULL PRIMARY KEY,
    department_code VARCHAR(50) NOT NULL,              -- 'CARDING', 'BREAKER', 'FINISHER', 'COMBER', 'SIMPLEX', 'LAPFORMER', 'AUTOCONER', 'SPINNING'
    shift INT NOT NULL,                                 -- 1, 2, or 3
    shift_name VARCHAR(50) DEFAULT 'Day',              -- 'Day', 'Evening', 'Night'
    shift_time INT NOT NULL DEFAULT 510,               -- Total shift time in minutes
    default_stoppage INT DEFAULT 0,                    -- Default stoppage time for this shift
    start_time TIME,                                   -- Shift start time (optional)
    end_time TIME,                                     -- Shift end time (optional)
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_dept_shift (department_code, shift),
    CHECK (shift IN (1, 2, 3))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. Insert default shift configurations for CARDING
-- ============================================================
-- Shift 1: 510 minutes (8.5 hours)
-- Shift 2: 450 minutes (7.5 hours)
-- Shift 3: 450 minutes (7.5 hours)

INSERT INTO shift_config (department_code, shift, shift_name, shift_time, default_stoppage, start_time, end_time) 
VALUES 
    ('CARDING', 1, 'Day Shift', 510, 135, '06:00:00', '14:30:00'),
    ('CARDING', 2, 'Evening Shift', 450, 120, '14:30:00', '22:00:00'),
    ('CARDING', 3, 'Night Shift', 450, 120, '22:00:00', '06:00:00')
ON DUPLICATE KEY UPDATE 
    shift_time = VALUES(shift_time),
    default_stoppage = VALUES(default_stoppage);

-- ============================================================
-- 3. Insert default shift configurations for other departments
-- ============================================================

-- BREAKER DRAWING
INSERT INTO shift_config (department_code, shift, shift_name, shift_time, default_stoppage) 
VALUES 
    ('BREAKER', 1, 'Day Shift', 510, 0),
    ('BREAKER', 2, 'Evening Shift', 450, 0),
    ('BREAKER', 3, 'Night Shift', 450, 0)
ON DUPLICATE KEY UPDATE shift_time = VALUES(shift_time);

-- FINISHER DRAWING
INSERT INTO shift_config (department_code, shift, shift_name, shift_time, default_stoppage) 
VALUES 
    ('FINISHER', 1, 'Day Shift', 510, 0),
    ('FINISHER', 2, 'Evening Shift', 450, 0),
    ('FINISHER', 3, 'Night Shift', 450, 0)
ON DUPLICATE KEY UPDATE shift_time = VALUES(shift_time);

-- COMBER
INSERT INTO shift_config (department_code, shift, shift_name, shift_time, default_stoppage) 
VALUES 
    ('COMBER', 1, 'Day Shift', 510, 0),
    ('COMBER', 2, 'Evening Shift', 450, 0),
    ('COMBER', 3, 'Night Shift', 450, 0)
ON DUPLICATE KEY UPDATE shift_time = VALUES(shift_time);

-- SIMPLEX
INSERT INTO shift_config (department_code, shift, shift_name, shift_time, default_stoppage) 
VALUES 
    ('SIMPLEX', 1, 'Day Shift', 510, 0),
    ('SIMPLEX', 2, 'Evening Shift', 450, 0),
    ('SIMPLEX', 3, 'Night Shift', 450, 0)
ON DUPLICATE KEY UPDATE shift_time = VALUES(shift_time);

-- LAP FORMER
INSERT INTO shift_config (department_code, shift, shift_name, shift_time, default_stoppage) 
VALUES 
    ('LAPFORMER', 1, 'Day Shift', 510, 0),
    ('LAPFORMER', 2, 'Evening Shift', 450, 0),
    ('LAPFORMER', 3, 'Night Shift', 450, 0)
ON DUPLICATE KEY UPDATE shift_time = VALUES(shift_time);

-- AUTOCONER
INSERT INTO shift_config (department_code, shift, shift_name, shift_time, default_stoppage) 
VALUES 
    ('AUTOCONER', 1, 'Day Shift', 510, 0),
    ('AUTOCONER', 2, 'Evening Shift', 450, 0),
    ('AUTOCONER', 3, 'Night Shift', 450, 0)
ON DUPLICATE KEY UPDATE shift_time = VALUES(shift_time);

-- SPINNING
INSERT INTO shift_config (department_code, shift, shift_name, shift_time, default_stoppage) 
VALUES 
    ('SPINNING', 1, 'Day Shift', 510, 0),
    ('SPINNING', 2, 'Evening Shift', 450, 0),
    ('SPINNING', 3, 'Night Shift', 450, 0)
ON DUPLICATE KEY UPDATE shift_time = VALUES(shift_time);

-- ============================================================
-- 4. Create a view for easy access to shift configurations
-- ============================================================

CREATE OR REPLACE VIEW v_shift_config AS
SELECT 
    id,
    department_code,
    shift,
    shift_name,
    shift_time,
    default_stoppage,
    shift_time - default_stoppage AS default_work_time,
    start_time,
    end_time,
    is_active
FROM shift_config
WHERE is_active = 1
ORDER BY department_code, shift;

-- ============================================================
-- 5. Verify the data
-- ============================================================

SELECT 
    department_code,
    shift,
    shift_name,
    shift_time,
    default_stoppage,
    shift_time - default_stoppage AS work_time
FROM shift_config
WHERE department_code = 'CARDING'
ORDER BY shift;

-- Expected Output:
-- +------------------+-------+---------------+------------+------------------+-----------+
-- | department_code  | shift | shift_name    | shift_time | default_stoppage | work_time |
-- +------------------+-------+---------------+------------+------------------+-----------+
-- | CARDING          | 1     | Day Shift     | 510        | 135              | 375       |
-- | CARDING          | 2     | Evening Shift | 450        | 120              | 330       |
-- | CARDING          | 3     | Night Shift   | 450        | 120              | 330       |
-- +------------------+-------+---------------+------------+------------------+-----------+
