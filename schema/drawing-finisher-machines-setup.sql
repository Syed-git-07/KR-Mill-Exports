-- ============================================
-- DRAWING FINISHER MACHINE MASTER TABLE
-- Module 13: Preparatory Master
-- VB6 Grid: McNo, Mixing Name, Description, Make, Speed
-- SAME STRUCTURE AS: Drawing Breaker Machine (NO mc_effi field)
-- ============================================

-- Drop table if exists (for fresh setup)
-- DROP TABLE IF EXISTS drawing_finisher_machines;

CREATE TABLE IF NOT EXISTS drawing_finisher_machines (
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
CREATE INDEX IF NOT EXISTS idx_drawing_finisher_machines_machine_no ON drawing_finisher_machines(machine_no);
CREATE INDEX IF NOT EXISTS idx_drawing_finisher_machines_mc_id ON drawing_finisher_machines(mc_id);
CREATE INDEX IF NOT EXISTS idx_drawing_finisher_machines_is_active ON drawing_finisher_machines(is_active);

-- Enable Row Level Security
ALTER TABLE drawing_finisher_machines ENABLE ROW LEVEL SECURITY;

-- RLS policies for drawing_finisher_machines (anonymous access)
CREATE POLICY "Enable read access for all users" 
ON drawing_finisher_machines FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON drawing_finisher_machines FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON drawing_finisher_machines FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON drawing_finisher_machines FOR DELETE USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE TRIGGER update_drawing_finisher_machines_updated_at
  BEFORE UPDATE ON drawing_finisher_machines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INSERT SAMPLE DATA (Based on industry pattern)
-- Prefix: FD (Finisher Drawing)
-- Similar to Drawing Breaker structure
-- ============================================
INSERT INTO drawing_finisher_machines (machine_no, description, make_name, prodn_mixing, speed, mc_id, is_active) VALUES
('FD1', 'FD1', 'LMW', '64', 550, 1, true),
('FD2', 'FD2', 'LMW', '64', 500, 2, true),
('FD3', 'FD3', 'LMW', '64', 600, 3, true),
('FD4', 'FD4', 'LMW', '64', 600, 4, true),
('FD5', 'FD5', 'LMW', '64', 550, 5, true)
ON CONFLICT (machine_no) DO NOTHING;

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- SELECT machine_no, prodn_mixing, description, make_name, speed 
-- FROM drawing_finisher_machines ORDER BY machine_no;

-- ============================================
-- DATA COMPARISON WITH OTHER MODULES
-- ============================================
-- | Module           | McNo Prefix | Count | Has McEffi | ProdnMixing      |
-- |------------------|-------------|-------|------------|------------------|
-- | Carding          | CA          | 22    | No         | "-"              |
-- | Drawing Breaker  | BD          | 5     | No         | "64"             |
-- | Comber           | CO          | 13    | YES        | "64COMBED GOLD"  |
-- | Drawing Finisher | FD          | 5     | No         | "64"             |
-- ============================================

-- ============================================
-- PROCESS FLOW IN SPINNING MILL
-- ============================================
-- Blow Room → Carding (CA) → Drawing Breaker (BD) → Lap Former → 
-- Comber (CO) → Drawing Finisher (FD) → Simplex → Spinning
-- ============================================
