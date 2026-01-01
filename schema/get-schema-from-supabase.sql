-- ============================================
-- GET COMPLETE SUPERVISORS TABLE SCHEMA
-- Run this in Supabase SQL Editor and save results
-- ============================================

-- 1. Table Structure
SELECT 
  'supervisors' as table_name,
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'supervisors'
ORDER BY ordinal_position;

-- 2. All Constraints
SELECT
  con.conname AS constraint_name,
  CASE 
    WHEN con.contype = 'p' THEN 'PRIMARY KEY'
    WHEN con.contype = 'f' THEN 'FOREIGN KEY'
    WHEN con.contype = 'u' THEN 'UNIQUE'
    WHEN con.contype = 'c' THEN 'CHECK'
  END AS constraint_type,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'supervisors'
  AND rel.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 3. All Indexes
SELECT
  i.relname AS index_name,
  string_agg(a.attname, ', ' ORDER BY array_position(ix.indkey, a.attnum)) AS columns,
  ix.indisunique AS is_unique,
  ix.indisprimary AS is_primary,
  pg_get_indexdef(i.oid) AS index_definition
FROM pg_class t
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
WHERE t.relname = 'supervisors'
  AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
GROUP BY i.relname, ix.indisunique, ix.indisprimary, i.oid
ORDER BY i.relname;

-- 4. Sequence Information
SELECT 
  'supervisors_code_seq' as sequence_name,
  last_value,
  is_called
FROM supervisors_code_seq;

-- 5. RLS Policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as operation,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies 
WHERE tablename = 'supervisors'
ORDER BY cmd, policyname;

-- 6. Current Data Sample
SELECT 
  code,
  supervisor_name,
  department_id,
  is_active,
  created_at,
  updated_at
FROM supervisors
ORDER BY code;
