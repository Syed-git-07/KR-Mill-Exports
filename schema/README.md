# Schema Documentation
**KR Production System Database Schema**

---

## 📂 Files in this Directory

### 1. Schema Structure
- **`schema-structure/complete-schema.sql`** - Full PostgreSQL dump of current database (1119 lines)
  - Generated using: `npm run schema:extract-structure`
  - Includes: Tables, constraints, indexes, RLS policies, triggers, sequences
  - Last Updated: November 24, 2025

- **`schema-structure/extract-structure.ps1`** - PowerShell script to auto-extract schema
  - Command: `pg_dump` with proper connection string
  - Region: aws-1-ap-southeast-1 (Supabase pooler)
  - Output: `complete-schema.sql`

### 2. Documentation
- **`SCHEMA-ANALYSIS-REPORT.md`** - Comprehensive analysis comparing plan.md with actual schema
  - Table-by-table detailed breakdown
  - Plan.md compliance check (92% overall)
  - Security audit (RLS policies)
  - Recommendations for improvements

- **`SCHEMA-QUICK-REFERENCE.md`** - Quick lookup guide
  - All 11 tables summarized
  - Relationship diagrams
  - Security matrix
  - Common queries

### 3. SQL Scripts
- **`add-missing-rls-policies.sql`** - Security fix for 6 tables missing RLS protection
  - autoconer_machines
  - spinning_machines
  - stoppage_heads
  - stoppage_details
  - tpi_entries
  - twc_entries
  - **Action:** Run this in Supabase SQL Editor

- **`get-schema-from-supabase.sql`** - Manual queries to extract schema info from Supabase dashboard
  - Useful when pg_dump fails due to network issues

---

## 🚀 Quick Start

### Extract Current Schema
```powershell
# From project root
npm run schema:extract-structure
```

This runs:
```powershell
pg_dump "postgresql://postgres.hdmaifhcaolxfsmbgpel:CKpXO8FlH6vP6j09@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres" `
  --schema=public `
  --schema-only `
  --no-owner `
  --no-privileges `
  --clean `
  --if-exists `
  --file="schema/schema-structure/complete-schema.sql"
```

### Add Missing Security Policies
1. Open Supabase SQL Editor
2. Copy content from `add-missing-rls-policies.sql`
3. Execute script
4. Verify with verification queries at bottom of file

---

## 📊 Database Overview

### Tables (11 total)
| Category | Tables | Count | RLS Status |
|----------|--------|-------|------------|
| **Masters** | departments, supervisors, autoconer_machines, spinning_machines, spinning_counts, stoppage_heads, stoppage_details | 7 | 3/7 ✅ |
| **Transactions** | hok_strength_head, hok_strength_detail, tpi_entries, twc_entries | 4 | 2/4 ✅ |

### Security Status
- ✅ **5 tables** have full RLS protection
- ⚠️ **6 tables** need RLS policies (fix available)

### Compliance
- ✅ **92% match** with plan.md specifications
- ✅ All foreign keys properly defined
- ✅ All indexes in place
- ⚠️ Minor field name difference: `tw_con` vs `twc_con`

---

## 🔧 Maintenance

### Update Schema Documentation
When you make database changes:
1. Run `npm run schema:extract-structure`
2. Review changes in `schema-structure/complete-schema.sql`
3. Update `SCHEMA-ANALYSIS-REPORT.md` if needed
4. Commit changes to git

### Verify RLS Policies
```sql
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
```

Expected: 4 policies per table (SELECT, INSERT, UPDATE, DELETE)

### Check Foreign Keys
```sql
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;
```

---

## 📈 Recent Updates

### November 24, 2025
- ✅ Extracted complete schema using pg_dump
- ✅ Created comprehensive analysis report
- ✅ Identified 6 tables needing RLS policies
- ✅ Created security fix script

### November 23, 2025
- ✅ Added `code` column to supervisors table
- ✅ Created `supervisors_code_seq` sequence
- ✅ Added RLS policies for supervisors
- ✅ Fixed query aliases in supervisorQueries.js

---

## 🔗 Related Files

### Application Code
- `src/lib/supabase/` - All query files
- `supabase-setup.sql` - Initial setup script (899 lines)
- `.env.local` - Database credentials

### Migration Files
- `supabase-supervisor-schema-fix.sql` - Supervisor code column addition
- `supabase-hok-show-all-departments.sql` - HOK department changes
- `supabase-department-update.sql` - Department table updates

---

## 📞 Support

### Issues with pg_dump?
- Check network connectivity to Supabase
- Verify password is correct
- Use `get-schema-from-supabase.sql` as alternative

### RLS Policy Errors?
- Ensure you're using database password (not project password)
- Check Supabase dashboard for policy conflicts
- Review existing policies before adding new ones

### Schema Mismatch with Plan?
- Refer to `SCHEMA-ANALYSIS-REPORT.md` for detailed comparison
- 92% compliance is excellent
- Minor differences are documented

---

## 🎯 Action Items

### Critical
- [ ] Run `add-missing-rls-policies.sql` to secure 6 tables
- [ ] Verify supervisor module displays data correctly

### Recommended
- [ ] Update plan.md with `tw_con` field clarification
- [ ] Document extra fields in spinning_machines
- [ ] Add indexes if query performance issues arise

### Future
- [ ] Consider role-based policies for production environment
- [ ] Add audit logging for critical tables
- [ ] Implement soft delete pattern across all tables

---

**Maintained By:** Development Team  
**Last Schema Dump:** November 24, 2025  
**Database Version:** PostgreSQL 17.6 (Supabase)
