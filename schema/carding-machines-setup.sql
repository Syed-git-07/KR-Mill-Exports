-- ============================================
-- CARDING MACHINE MASTER - Preparatory Master
-- ============================================
-- Run this in Supabase SQL Editor to add carding_machines table
-- ============================================

-- ============================================
-- CREATE CARDING MACHINES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS carding_machines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_no TEXT NOT NULL UNIQUE,
  description TEXT,
  make_name TEXT,
  mc_id INTEGER,
  model TEXT,
  prodn_mixing TEXT,
  speed INTEGER,
  prodn_efficiency DECIMAL(5,2) DEFAULT 0,
  installed_date DATE DEFAULT '2015-04-01',
  is_active BOOLEAN DEFAULT true,
  direct_hank_entry BOOLEAN DEFAULT false,
  direct_kgs_entry BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CREATE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_carding_machines_machine_no ON carding_machines(machine_no);
CREATE INDEX IF NOT EXISTS idx_carding_machines_mc_id ON carding_machines(mc_id);
CREATE INDEX IF NOT EXISTS idx_carding_machines_model ON carding_machines(model);
CREATE INDEX IF NOT EXISTS idx_carding_machines_is_active ON carding_machines(is_active);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE carding_machines ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for all users" ON carding_machines;
DROP POLICY IF EXISTS "Enable insert for all users" ON carding_machines;
DROP POLICY IF EXISTS "Enable update for all users" ON carding_machines;
DROP POLICY IF EXISTS "Enable delete for all users" ON carding_machines;

-- RLS policies for carding_machines (anonymous access)
CREATE POLICY "Enable read access for all users" 
ON carding_machines FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON carding_machines FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON carding_machines FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON carding_machines FOR DELETE USING (true);

-- ============================================
-- CREATE UPDATE TRIGGER
-- ============================================
CREATE TRIGGER update_carding_machines_updated_at 
BEFORE UPDATE ON carding_machines 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INSERT SAMPLE DATA (22 machines from VB.NET)
-- ============================================
INSERT INTO carding_machines (machine_no, description, model, mc_id, is_active) VALUES
('CA1', 'CA1', 'LC300A', 1, true),
('CA2', 'CA2', 'LC300A', 2, true),
('CA3', 'CA3', 'LC300A', 3, true),
('CA4', 'CA4', 'LC300A', 4, true),
('CA5', 'CA5', 'LC300A', 5, true),
('CA6', 'CA6', 'LC300A', 6, true),
('CA7', 'CA7', 'LC300A', 7, true),
('CA8', 'CA8', 'LC300A V3', 8, true),
('CA9', 'CA9', 'LC300A V3', 9, true),
('CA10', 'CA10', 'LC300A V3', 10, true),
('CA11', 'CA11', 'LC300A', 11, true),
('CA12', 'CA12', 'LC300A', 12, true),
('CA13', 'CA13', 'LC300A', 13, true),
('CA14', 'CA14', 'LC300A V3', 14, true),
('CA15', 'CA15', 'LC300A V3', 15, true),
('CA16', 'CA16', 'LC300A V3', 16, true),
('CA17', 'CA17', 'LC300A V3', 17, true),
('CA18', 'CA18', 'LC300A V3', 18, true),
('CA19', 'CA19', 'LC300A V3', 19, true),
('CA20', 'CA20', 'LC300A V3', 20, true),
('CA21', 'CA21', 'LC300AV3', 21, true),
('CA22', 'CA22', 'LC300AV3', 22, true)
ON CONFLICT (machine_no) DO NOTHING;

-- ============================================
-- REFRESH POSTGREST SCHEMA CACHE
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- VERIFY DATA
-- ============================================
SELECT 
  machine_no as "McNo",
  description as "Description",
  model as "Model",
  COALESCE(prodn_mixing, '-') as "Mixing",
  is_active as "Active"
FROM carding_machines
ORDER BY mc_id;
