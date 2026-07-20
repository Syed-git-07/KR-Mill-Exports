-- ============================================
-- Employee Master Table Migration
-- ============================================
-- Purpose: Normalize employee names across all production entry modules
-- Date: 2026-01-31
-- Database: kr_production
-- ============================================

-- Step 1: Create employee_master table
CREATE TABLE IF NOT EXISTS employee_master (
    id CHAR(36) DEFAULT (UUID()) NOT NULL PRIMARY KEY,
    emp_name VARCHAR(100) NOT NULL UNIQUE,
    emp_code VARCHAR(50),
    department VARCHAR(100),
    designation VARCHAR(100),
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_emp_name (emp_name),
    INDEX idx_is_active (is_active),
    INDEX idx_emp_name_active (emp_name, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 2: Migrate existing employee names from all production detail tables
-- Insert distinct employee names from carding_production_detail
INSERT IGNORE INTO employee_master (emp_name)
SELECT DISTINCT TRIM(employee_name) as emp_name
FROM carding_production_detail
WHERE employee_name IS NOT NULL 
  AND TRIM(employee_name) != ''
  AND TRIM(employee_name) NOT IN (SELECT emp_name FROM employee_master);

-- Insert distinct employee names from breaker_drawing_production_detail
INSERT IGNORE INTO employee_master (emp_name)
SELECT DISTINCT TRIM(employee_name) as emp_name
FROM breaker_drawing_production_detail
WHERE employee_name IS NOT NULL 
  AND TRIM(employee_name) != ''
  AND TRIM(employee_name) NOT IN (SELECT emp_name FROM employee_master);

-- Insert distinct employee names from finisher_drawing_production_detail
INSERT IGNORE INTO employee_master (emp_name)
SELECT DISTINCT TRIM(employee_name) as emp_name
FROM finisher_drawing_production_detail
WHERE employee_name IS NOT NULL 
  AND TRIM(employee_name) != ''
  AND TRIM(employee_name) NOT IN (SELECT emp_name FROM employee_master);

-- Insert distinct employee names from comber_production_detail
INSERT IGNORE INTO employee_master (emp_name)
SELECT DISTINCT TRIM(employee_name) as emp_name
FROM comber_production_detail
WHERE employee_name IS NOT NULL 
  AND TRIM(employee_name) != ''
  AND TRIM(employee_name) NOT IN (SELECT emp_name FROM employee_master);

-- Insert distinct employee names from simplex_production_detail
INSERT IGNORE INTO employee_master (emp_name)
SELECT DISTINCT TRIM(employee_name) as emp_name
FROM simplex_production_detail
WHERE employee_name IS NOT NULL 
  AND TRIM(employee_name) != ''
  AND TRIM(employee_name) NOT IN (SELECT emp_name FROM employee_master);

-- Insert distinct employee names from lap_former_production_detail
INSERT IGNORE INTO employee_master (emp_name)
SELECT DISTINCT TRIM(employee_name) as emp_name
FROM lap_former_production_detail
WHERE employee_name IS NOT NULL 
  AND TRIM(employee_name) != ''
  AND TRIM(employee_name) NOT IN (SELECT emp_name FROM employee_master);

-- Step 3: Verify migration
SELECT 
    'Migration Complete' as status,
    COUNT(*) as total_employees,
    COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_employees
FROM employee_master;

-- Display all migrated employees
SELECT id, emp_name, is_active, created_at 
FROM employee_master 
ORDER BY emp_name;
