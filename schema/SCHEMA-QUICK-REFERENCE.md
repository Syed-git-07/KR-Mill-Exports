# Database Schema Quick Reference
**KR Production System - Supabase PostgreSQL 17.6**

---

## 📊 Master Tables (8 tables)

### 1. departments (31 records)
```sql
id, code, dept_name, sl_no, hok, is_active, created_at, updated_at
```
- **Primary Key:** id (UUID)
- **Unique:** dept_name, code
- **Indexes:** code, dept_name, is_active, sl_no
- **RLS:** ✅ Read-only for anonymous

### 2. supervisors (11 records)
```sql
id, code, supervisor_name, department_id→departments, is_active, created_at, updated_at
```
- **Primary Key:** id (UUID)
- **Unique:** supervisor_name, code
- **Sequence:** supervisors_code_seq (START 1)
- **Indexes:** code, supervisor_name
- **RLS:** ✅ Full CRUD for anonymous

### 3. autoconer_machines (~33 records)
```sql
id, machine_no, description, make_name='MURT', act_effi=0, is_active, created_at, updated_at
```
- **Primary Key:** id (UUID)
- **Unique:** machine_no
- **Indexes:** machine_no
- **RLS:** ❌ **NEEDS ADDING**

### 4. spinning_machines (~150 records)
```sql
id, machine_no, description, make_name='LMW', spindles=1104, frame_no, mc_id='225',
model, group_no=0, installed_date='2015-04-01', production_kgs_manual_entry=false,
direct_hank_entry=true, is_active, remarks, created_at, updated_at
```
- **Primary Key:** id (UUID)
- **Unique:** machine_no
- **Indexes:** machine_no, frame_no, mc_id, group_no
- **RLS:** ❌ **NEEDS ADDING**

### 5. spinning_counts (~40 records)
```sql
id, count_name, short_desc, act_count, mixing_name, fibre, conv_40s_value, ukg,
effi_exp_hank, effi_exp_prodn, is_running_now=false, autoconer_active=false,
sitra_conv_value, cone_weight, effi_actual_prodn, tpi, speed, speed_autoconer,
tw_con, waste_percent, doff_loss, auto_effi, hok_cons, is_active, created_at, updated_at
```
- **Primary Key:** id (UUID)
- **Unique:** count_name
- **Indexes:** count_name, is_active
- **RLS:** ✅ Full CRUD for anonymous

### 6. stoppage_heads (~20 records)
```sql
id, code, stoppage_head_name, description, is_active, created_at, updated_at
```
- **Primary Key:** id (UUID)
- **Unique:** code, stoppage_head_name
- **Sequence:** stoppage_heads_code_seq (START 1)
- **Indexes:** code, stoppage_head_name
- **RLS:** ❌ **NEEDS ADDING**

### 7. stoppage_details (~1446 records)
```sql
id, stoppage_head_id→stoppage_heads, code, stoppage_name, description, short_code,
full_stoppage_name, department_id→departments, is_active, created_at, updated_at
```
- **Primary Key:** id (UUID)
- **Unique:** (stoppage_head_id, code) composite
- **Sequence:** stoppage_details_code_seq (START 1447)
- **Indexes:** code, stoppage_head_id, stoppage_name, department_id
- **RLS:** ❌ **NEEDS ADDING**

---

## 📈 Transaction Tables (4 tables)

### 8. hok_strength_head (Header for HOK entries)
```sql
hok_id, date, total_shift1=0, total_shift2=0, total_shift3=0, created_at, updated_at
```
- **Primary Key:** hok_id (INTEGER, auto-increment)
- **Unique:** date
- **Sequence:** hok_strength_head_hok_id_seq (START 1150)
- **Indexes:** date
- **RLS:** ✅ Full CRUD for anonymous

### 9. hok_strength_detail (Detail for HOK entries)
```sql
id, hok_id→hok_strength_head, department_id→departments, shift1=0, shift2=0, shift3=0,
created_at, updated_at
```
- **Primary Key:** id (INTEGER, auto-increment)
- **Unique:** (hok_id, department_id) composite
- **Sequence:** hok_strength_detail_id_seq (START 1)
- **Indexes:** hok_id, department_id
- **RLS:** ✅ Full CRUD for anonymous

### 10. tpi_entries (TPI measurements)
```sql
id, entry_date, spinning_count_id→spinning_counts, tpi_value, machine_id→spinning_machines,
shift∈('A','B','C'), remarks, created_at, updated_at
```
- **Primary Key:** id (UUID)
- **Indexes:** entry_date
- **RLS:** ❌ **NEEDS ADDING**

### 11. twc_entries (TWC measurements)
```sql
id, entry_date, spinning_count_id→spinning_counts, twc_value, machine_id→spinning_machines,
shift∈('A','B','C'), remarks, created_at, updated_at
```
- **Primary Key:** id (UUID)
- **Indexes:** entry_date
- **RLS:** ❌ **NEEDS ADDING**

---

## 🔗 Relationships

```
departments (31)
    ├─→ supervisors.department_id (11)
    ├─→ stoppage_details.department_id (1446)
    └─→ hok_strength_detail.department_id (many)

stoppage_heads (20)
    └─→ stoppage_details.stoppage_head_id (1446)

hok_strength_head (variable)
    └─→ hok_strength_detail.hok_id (many)

spinning_counts (40)
    ├─→ tpi_entries.spinning_count_id (many)
    └─→ twc_entries.spinning_count_id (many)

spinning_machines (150)
    ├─→ tpi_entries.machine_id (many)
    └─→ twc_entries.machine_id (many)
```

---

## 🔐 Security Matrix

| Table | RLS | Policies | Anon Access |
|-------|-----|----------|-------------|
| departments | ✅ | 1 | SELECT |
| supervisors | ✅ | 4 | ALL |
| autoconer_machines | ❌ | 0 | ⚠️ None |
| spinning_machines | ❌ | 0 | ⚠️ None |
| spinning_counts | ✅ | 5 | ALL |
| stoppage_heads | ❌ | 0 | ⚠️ None |
| stoppage_details | ❌ | 0 | ⚠️ None |
| hok_strength_head | ✅ | 4 | ALL |
| hok_strength_detail | ✅ | 4 | ALL |
| tpi_entries | ❌ | 0 | ⚠️ None |
| twc_entries | ❌ | 0 | ⚠️ None |

**Action Required:** Run `add-missing-rls-policies.sql` to secure all tables

---

## 📁 Schema Files

```
schema/
├── schema-structure/
│   ├── complete-schema.sql          ← Full pg_dump output
│   └── extract-structure.ps1        ← Automated extraction script
├── SCHEMA-ANALYSIS-REPORT.md        ← Detailed analysis
├── SCHEMA-QUICK-REFERENCE.md        ← This file
├── add-missing-rls-policies.sql     ← Security fixes
└── get-schema-from-supabase.sql     ← Manual extraction queries
```

---

## 🛠️ Common Queries

### Get all tables with record counts
```sql
SELECT 
  schemaname,
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;
```

### Check RLS status
```sql
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
```

### List all foreign keys
```sql
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;
```

### Check all sequences
```sql
SELECT 
  sequence_name,
  last_value,
  is_called
FROM information_schema.sequences
WHERE sequence_schema = 'public'
ORDER BY sequence_name;
```

---

## 🎯 Module Status

| Module | Table(s) | Status | RLS | Notes |
|--------|----------|--------|-----|-------|
| Departments | departments | ✅ Live | ✅ | 31 records |
| Supervisors | supervisors | ✅ Live | ✅ | Code column added Nov 23 |
| Autoconer | autoconer_machines | ✅ Live | ⚠️ | Needs RLS |
| Spinning Machines | spinning_machines | ✅ Live | ⚠️ | Needs RLS |
| Spinning Counts | spinning_counts | ✅ Live | ✅ | 40 counts |
| Stoppage Master | stoppage_heads, stoppage_details | ✅ Live | ⚠️ | Needs RLS |
| HOK Strength | hok_strength_head, hok_strength_detail | ✅ Live | ✅ | Header-detail |
| TPI/TWC | tpi_entries, twc_entries | ✅ Live | ⚠️ | Needs RLS |

---

**Last Updated:** November 24, 2025  
**Database:** hdmaifhcaolxfsmbgpel.supabase.co  
**Version:** PostgreSQL 17.6
