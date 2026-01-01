-- ============================================
-- COMBER MACHINE MASTER TABLE
-- Module 12: Preparatory Master
-- VB6 Grid: McNo, ProdnMixing Name, Description, Make, Speed, McEffi
-- KEY DIFFERENCE: Has mc_effi field (Machine Efficiency)
-- ============================================

-- Drop table if exists (for fresh setup)
-- DROP TABLE IF EXISTS comber_machines;

CREATE TABLE IF NOT EXISTS comber_machines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_no TEXT NOT NULL UNIQUE,
  description TEXT,
  make_name TEXT,
  mc_id INTEGER,
  model TEXT,
  prodn_mixing TEXT,
  speed INTEGER,
  prodn_efficiency DECIMAL(5,2) DEFAULT 0,
  mc_effi INTEGER DEFAULT 0,  -- Machine Efficiency (NEW FIELD - unique to Comber)
  installed_date DATE DEFAULT '2015-04-01',
  is_active BOOLEAN DEFAULT true,
  direct_hank_entry BOOLEAN DEFAULT false,
  direct_kgs_entry BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_comber_machines_machine_no ON comber_machines(machine_no);
CREATE INDEX IF NOT EXISTS idx_comber_machines_mc_id ON comber_machines(mc_id);
CREATE INDEX IF NOT EXISTS idx_comber_machines_is_active ON comber_machines(is_active);

-- Enable Row Level Security
ALTER TABLE comber_machines ENABLE ROW LEVEL SECURITY;

-- RLS policies for comber_machines (anonymous access)
CREATE POLICY "Enable read access for all users" 
ON comber_machines FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON comber_machines FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON comber_machines FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON comber_machines FOR DELETE USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE TRIGGER update_comber_machines_updated_at
  BEFORE UPDATE ON comber_machines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INSERT SAMPLE DATA (13 machines from VB.NET)
-- ============================================
INSERT INTO comber_machines (machine_no, description, make_name, prodn_mixing, speed, mc_effi, mc_id, is_active) VALUES
('CO1', 'COMBER 1', 'LMW', '64COMBED GOLD', 350, 93, 1, true),
('CO2', 'COMBER 2', 'LMW', '64COMBED GOLD', 350, 93, 2, true),
('CO3', 'COMBER 3', 'LMW', '64COMBED GOLD', 350, 93, 3, true),
('CO4', 'COMBER 4', 'LMW', '64COMBED GOLD', 350, 93, 4, true),
('CO5', 'COMBER 5', 'LMW', '64COMBED GOLD', 350, 93, 5, true),
('CO6', 'COMBER 6', 'LMW', '64COMBED GOLD', 450, 93, 6, true),
('CO7', 'COMBER 7', 'LMW', '64COMBED GOLD', 400, 93, 7, true),
('CO8', 'COMBER 8', 'LMW', '64COMBED GOLD', 400, 93, 8, true),
('CO9', 'COMBER 9', 'LMW', '64COMBED GOLD', 350, 93, 9, true),
('CO10', 'COMBER 10', 'LMW', '64COMBED GOLD', 350, 93, 10, true),
('CO11', 'COMBER 11', 'LMW', '64COMBED GOLD', 400, 93, 11, true),
('CO12', 'COMBER 12', 'LMW', '64COMBED GOLD', 400, 93, 12, true),
('CO13', 'COMBER 13', 'LMW', '64COMBED GOLD', 400, 93, 13, true)
ON CONFLICT (machine_no) DO NOTHING;

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- SELECT machine_no, prodn_mixing, description, make_name, speed, mc_effi 
-- FROM comber_machines ORDER BY machine_no;

-- ============================================
-- DATA COMPARISON WITH OTHER MODULES
-- ============================================
-- | Module          | McNo Prefix | Count | Has McEffi | ProdnMixing      |
-- |-----------------|-------------|-------|------------|------------------|
-- | Carding         | CA          | 22    | No         | "-"              |
-- | Drawing Breaker | BD          | 5     | No         | "64"             |
-- | Comber          | CO          | 13    | YES        | "64COMBED GOLD"  |
-- ============================================
