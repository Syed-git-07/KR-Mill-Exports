-- ============================================
-- LAP FORMER MACHINE MASTER TABLE
-- Module 15: Preparatory Master
-- VB6 Grid: McNo, ProdnMixing Name, Description, Make, Speed
-- SAME STRUCTURE AS: Drawing Breaker/Finisher (NO mc_effi, tpi, spindles)
-- ============================================

-- Drop table if exists (for fresh setup)
-- DROP TABLE IF EXISTS lap_former_machines;

CREATE TABLE IF NOT EXISTS lap_former_machines (
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lap_former_machines_machine_no ON lap_former_machines(machine_no);
CREATE INDEX IF NOT EXISTS idx_lap_former_machines_mc_id ON lap_former_machines(mc_id);
CREATE INDEX IF NOT EXISTS idx_lap_former_machines_is_active ON lap_former_machines(is_active);

-- Enable Row Level Security
ALTER TABLE lap_former_machines ENABLE ROW LEVEL SECURITY;

-- RLS policies for lap_former_machines (anonymous access)
CREATE POLICY "Enable read access for all users" 
ON lap_former_machines FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON lap_former_machines FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON lap_former_machines FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON lap_former_machines FOR DELETE USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE TRIGGER update_lap_former_machines_updated_at
  BEFORE UPDATE ON lap_former_machines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INSERT SAMPLE DATA (3 machines from VB.NET)
-- Prefix: LF (Lap Former)
-- ============================================
INSERT INTO lap_former_machines (machine_no, description, make_name, prodn_mixing, speed, mc_id, is_active) VALUES
('LF1', 'LABFORMER 1', 'LMW', '60CC', 130, 1, true),
('LF2', 'LABFORMER 2', 'LMW', '64COMBED GOLD', 94, 2, true),
('LF3', 'LABFORMER 3', 'LMW', '64COMBED GOLD', 94, 3, true)
ON CONFLICT (machine_no) DO NOTHING;

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- SELECT machine_no, prodn_mixing, description, make_name, speed 
-- FROM lap_former_machines ORDER BY machine_no;

-- ============================================
-- DATA COMPARISON WITH OTHER MODULES
-- ============================================
-- | Module           | McNo Prefix | Count | mc_effi | tpi | spindles | Grid Cols |
-- |------------------|-------------|-------|---------|-----|----------|-----------|
-- | Carding          | CA          | 22    | No      | No  | No       | 5         |
-- | Drawing Breaker  | BD          | 5     | No      | No  | No       | 5         |
-- | Comber           | CO          | 13    | YES     | No  | No       | 6         |
-- | Drawing Finisher | FD          | 5     | No      | No  | No       | 5         |
-- | Simplex          | 1-10        | 10    | YES     | YES | YES      | 8         |
-- | Lap Former       | LF          | 3     | No      | No  | No       | 5         |
-- ============================================

-- ============================================
-- PROCESS FLOW IN SPINNING MILL
-- ============================================
-- Blow Room → Carding (CA) → Drawing Breaker (BD) → LAP FORMER (LF) → 
-- Comber (CO) → Drawing Finisher (FD) → Simplex → Spinning
-- ============================================
