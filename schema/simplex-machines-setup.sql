-- ============================================
-- SIMPLEX MACHINE MASTER TABLE
-- Module 14: Preparatory Master
-- VB6 Grid: McNo, Mixing Name, Description, Make, Speed, MCEffi, TPI, NoofSpl
-- KEY DIFFERENCE: Has mc_effi, tpi, no_of_spindles (3 NEW fields!)
-- ============================================

-- Drop table if exists (for fresh setup)
-- DROP TABLE IF EXISTS simplex_machines;

CREATE TABLE IF NOT EXISTS simplex_machines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_no TEXT NOT NULL UNIQUE,
  description TEXT,
  make_name TEXT,
  mc_id INTEGER,
  model TEXT,
  prodn_mixing TEXT,
  speed INTEGER,
  prodn_efficiency DECIMAL(5,2) DEFAULT 0,
  mc_effi INTEGER DEFAULT 0,           -- Machine Efficiency (like Comber)
  tpi DECIMAL(5,2) DEFAULT 0,          -- TPI value (NEW - unique to Simplex)
  no_of_spindles INTEGER DEFAULT 0,    -- Number of Spindles (NEW - unique to Simplex)
  installed_date DATE DEFAULT '2015-04-01',
  is_active BOOLEAN DEFAULT true,
  direct_hank_entry BOOLEAN DEFAULT false,
  direct_kgs_entry BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_simplex_machines_machine_no ON simplex_machines(machine_no);
CREATE INDEX IF NOT EXISTS idx_simplex_machines_mc_id ON simplex_machines(mc_id);
CREATE INDEX IF NOT EXISTS idx_simplex_machines_is_active ON simplex_machines(is_active);

-- Enable Row Level Security
ALTER TABLE simplex_machines ENABLE ROW LEVEL SECURITY;

-- RLS policies for simplex_machines (anonymous access)
CREATE POLICY "Enable read access for all users" 
ON simplex_machines FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON simplex_machines FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON simplex_machines FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON simplex_machines FOR DELETE USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE TRIGGER update_simplex_machines_updated_at
  BEFORE UPDATE ON simplex_machines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INSERT SAMPLE DATA (10 machines from VB.NET)
-- ============================================
INSERT INTO simplex_machines (machine_no, description, make_name, prodn_mixing, speed, mc_effi, tpi, no_of_spindles, mc_id, is_active) VALUES
('1', 'SIMPLEX1', 'LMW', '64COMBED GOLD', 1040, 92, 1.73, 140, 1, true),
('2', 'SIMPLEX2', 'LMW', '64COMBED GOLD', 1040, 92, 1.73, 140, 2, true),
('3', 'SIMPLEX3', 'LMW', '60CCT', 1050, 92, 1.69, 140, 3, true),
('4', 'SIMPLEX4', 'LMW', '60CC', 980, 92, 1.73, 120, 4, true),
('5', 'SIMPLEX5', 'LMW', '60CC', 1050, 92, 1.66, 140, 5, true),
('6', 'SIMPLEX6', 'LMW', '60CC', 980, 92, 1.73, 120, 6, true),
('7', 'SIMPLEX7', 'LMW', '64COMBED GOLD', 1050, 92, 1.69, 120, 7, true),
('8', 'SIMPLEX8', 'LMW', '64COMBED GOLD', 1050, 92, 1.69, 120, 8, true),
('9', 'SIMPLEX9', 'LMW', '60CC', 1040, 92, 1.73, 120, 9, true),
('10', 'SIMPLEX10', 'LMW', '64COMBED GOLD', 960, 92, 1.69, 120, 10, true)
ON CONFLICT (machine_no) DO NOTHING;

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- SELECT machine_no, prodn_mixing, description, make_name, speed, mc_effi, tpi, no_of_spindles 
-- FROM simplex_machines ORDER BY machine_no::INTEGER;

-- ============================================
-- DATA COMPARISON WITH OTHER MODULES
-- ============================================
-- | Module           | McNo Prefix | Count | mc_effi | tpi | spindles | ProdnMixing        |
-- |------------------|-------------|-------|---------|-----|----------|-------------------|
-- | Carding          | CA          | 22    | No      | No  | No       | "-"               |
-- | Drawing Breaker  | BD          | 5     | No      | No  | No       | "64"              |
-- | Comber           | CO          | 13    | YES     | No  | No       | "64COMBED GOLD"   |
-- | Drawing Finisher | FD          | 5     | No      | No  | No       | "64"              |
-- | Simplex          | 1-10        | 10    | YES     | YES | YES      | Mixed values      |
-- ============================================

-- ============================================
-- UNIQUE CHARACTERISTICS OF SIMPLEX
-- ============================================
-- 1. Machine numbers are just integers (1, 2, 3...) not prefixed
-- 2. Has 3 additional fields: mc_effi, tpi, no_of_spindles
-- 3. TPI values vary: 1.66, 1.69, 1.73
-- 4. Spindle counts: 120 or 140
-- 5. Mixed mixing values: 64COMBED GOLD, 60CCT, 60CC
-- ============================================
