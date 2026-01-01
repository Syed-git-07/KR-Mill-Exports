-- ============================================
-- SUPERVISOR MODULE DIAGNOSTIC QUERIES
-- Run these in Supabase SQL Editor to diagnose the issue
-- ============================================

-- 1. Check if supervisors table exists and has data
SELECT COUNT(*) as total_supervisors FROM supervisors;

-- 2. Check supervisors table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'supervisors'
ORDER BY ordinal_position;

-- 3. View all supervisors with their codes and departments
SELECT 
  s.id,
  s.code,
  s.supervisor_name,
  s.department_id,
  d.dept_name as department_name,
  s.is_active,
  s.created_at
FROM supervisors s
LEFT JOIN departments d ON s.department_id = d.id
ORDER BY s.code;

-- 4. Check if code column has values
SELECT 
  COUNT(*) as total,
  COUNT(code) as with_code,
  MIN(code) as min_code,
  MAX(code) as max_code
FROM supervisors;

-- 5. Check supervisors_code_seq sequence
SELECT 
  last_value,
  is_called
FROM supervisors_code_seq;

-- 6. Check RLS policies on supervisors
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'supervisors'
ORDER BY cmd;

-- 7. Test the exact query used by the app
SELECT 
  *,
  departments.id as dept_id,
  departments.dept_name
FROM supervisors
LEFT JOIN departments ON supervisors.department_id = departments.id
ORDER BY code;

-- 8. Check if department_id foreign keys are valid
SELECT 
  s.code,
  s.supervisor_name,
  s.department_id,
  CASE 
    WHEN d.id IS NULL AND s.department_id IS NOT NULL THEN 'INVALID FK'
    WHEN s.department_id IS NULL THEN 'NO DEPARTMENT'
    ELSE 'VALID'
  END as fk_status
FROM supervisors s
LEFT JOIN departments d ON s.department_id = d.id
ORDER BY s.code;

-- 9. Check permissions
SELECT 
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'supervisors'
  AND grantee IN ('anon', 'authenticated', 'public');

-- 10. Test with RLS OFF (as superuser)
SET ROLE postgres;
SET row_security = OFF;
SELECT * FROM supervisors ORDER BY code;
SET row_security = ON;
