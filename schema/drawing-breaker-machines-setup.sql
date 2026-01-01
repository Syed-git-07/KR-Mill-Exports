-- ============================================
-- DRAWING BREAKER MACHINE MASTER TABLE
-- Module 11: Preparatory Master
-- VB6 Grid: McNo, Mixing Name, Description, Make, Speed
-- ============================================

-- Drop table if exists (for fresh setup)
-- DROP TABLE IF EXISTS drawing_breaker_machines;

CREATE TABLE IF NOT EXISTS drawing_breaker_machines (
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
CREATE INDEX IF NOT EXISTS idx_drawing_breaker_machines_machine_no ON drawing_breaker_machines(machine_no);
CREATE INDEX IF NOT EXISTS idx_drawing_breaker_machines_mc_id ON drawing_breaker_machines(mc_id);
CREATE INDEX IF NOT EXISTS idx_drawing_breaker_machines_is_active ON drawing_breaker_machines(is_active);

-- Enable Row Level Security
ALTER TABLE drawing_breaker_machines ENABLE ROW LEVEL SECURITY;

-- RLS policies for drawing_breaker_machines (anonymous access)
CREATE POLICY "Enable read access for all users" 
ON drawing_breaker_machines FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" 
ON drawing_breaker_machines FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON drawing_breaker_machines FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" 
ON drawing_breaker_machines FOR DELETE USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE TRIGGER update_drawing_breaker_machines_updated_at
  BEFORE UPDATE ON drawing_breaker_machines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INSERT SAMPLE DATA (5 machines from VB.NET)
-- ============================================
INSERT INTO drawing_breaker_machines (machine_no, description, make_name, prodn_mixing, speed, mc_id, is_active) VALUES
('BD1', 'BD1', 'LMW', '64', 550, 1, true),
('BD2', 'BD2', 'LMW', '64', 500, 2, true),
('BD3', 'BD3', 'LMW', '64', 800, 3, true),
('BD4', 'BD4', 'LMW', '64', 800, 4, true),
('BD11', 'BD11', 'LMW', '64', 0, 11, true)
ON CONFLICT (machine_no) DO NOTHING;

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- SELECT * FROM drawing_breaker_machines ORDER BY machine_no;
