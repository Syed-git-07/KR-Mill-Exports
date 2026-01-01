# ============================================================
# EXTRACT SCHEMA STRUCTURE ONLY (No Data)
# ============================================================
# This command extracts complete schema structure including:
# - Tables with all columns and data types
# - Primary keys, foreign keys, unique constraints
# - Indexes for performance optimization
# - Row Level Security (RLS) policies
# - Check constraints and default values
# - Functions, triggers, sequences
# ============================================================

Write-Host "Extracting schema from Supabase..." -ForegroundColor Yellow

# Connection pooler (port 6543) - CORRECT REGION: ap-southeast-1
pg_dump "postgresql://postgres.hdmaifhcaolxfsmbgpel:CKpXO8FlH6vP6j09@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres" `
  --schema=public `
  --schema-only `
  --no-owner `
  --no-privileges `
  --clean `
  --if-exists `
  --file="schema/schema-structure/complete-schema.sql"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Schema structure extracted successfully!" -ForegroundColor Green
    Write-Host "File: schema/schema-structure/complete-schema.sql" -ForegroundColor Cyan
} else {
    Write-Host "Failed to extract schema. Check your connection details." -ForegroundColor Red
}
