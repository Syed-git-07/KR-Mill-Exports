-- KR Production System - Complete Database Setup
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. DEPARTMENT MASTER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code INTEGER NOT NULL UNIQUE,
  department TEXT NOT NULL,
  sl_no INTEGER NOT NULL,
  hok INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Department Master Data (31 departments from the original system)
INSERT INTO departments (code, department, sl_no, hok) VALUES
(1, 'Blow Room', 1, 85),
(2, 'Carding', 2, 90),
(3, 'Draw Frame', 3, 92),
(4, 'Speed Frame', 4, 88),
(5, 'Ring Frame', 5, 95),
(6, 'Auto Coner', 6, 94),
(7, 'TFO', 7, 91),
(8, 'Winding', 8, 93),
(9, 'Warping', 9, 89),
(10, 'Sizing', 10, 87),
(11, 'Drawing In', 11, 86),
(12, 'Weaving', 12, 92),
(13, 'Folding', 13, 88),
(14, 'Grey Inspection', 14, 90),
(15, 'Stitching', 15, 85),
(16, 'Singeing', 16, 89),
(17, 'Desizing', 17, 91),
(18, 'Scouring', 18, 90),
(19, 'Bleaching', 19, 92),
(20, 'Mercerizing', 20, 88),
(21, 'Dyeing', 21, 93),
(22, 'Printing', 22, 89),
(23, 'Stentering', 23, 91),
(24, 'Calendering', 24, 87),
(25, 'Sanforizing', 25, 90),
(26, 'Inspection', 26, 94),
(27, 'Packing', 27, 86),
(28, 'Maintenance', 28, 85),
(29, 'Quality Control', 29, 95),
(30, 'Store', 30, 88),
(31, 'Administration', 31, 90);

-- ============================================
-- 2. SPINNING MACHINE MASTER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS spinning_machines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code INTEGER NOT NULL UNIQUE,
  machine_name TEXT NOT NULL,
  machine_no TEXT NOT NULL,
  spindles INTEGER NOT NULL,
  spindle_gauge DECIMAL(10,2),
  ring_dia DECIMAL(10,2),
  traveller TEXT,
  total_doffs INTEGER,
  total_spindles INTEGER,
  auto_doffing BOOLEAN DEFAULT false,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Spinning Machine Data (33 machines)
INSERT INTO spinning_machines (code, machine_name, machine_no, spindles, spindle_gauge, ring_dia, traveller, total_doffs, total_spindles, auto_doffing, remarks) VALUES
(1, 'Ring Frame', 'RF-01', 480, 75.00, 38.00, '7/0', 8, 3840, true, 'High speed machine'),
(2, 'Ring Frame', 'RF-02', 480, 75.00, 38.00, '7/0', 8, 3840, true, 'High speed machine'),
(3, 'Ring Frame', 'RF-03', 480, 75.00, 38.00, '7/0', 8, 3840, true, 'High speed machine'),
(4, 'Ring Frame', 'RF-04', 480, 75.00, 38.00, '7/0', 8, 3840, true, 'High speed machine'),
(5, 'Ring Frame', 'RF-05', 480, 75.00, 38.00, '7/0', 8, 3840, true, 'Standard operation'),
(6, 'Ring Frame', 'RF-06', 480, 75.00, 38.00, '7/0', 8, 3840, true, 'Standard operation'),
(7, 'Ring Frame', 'RF-07', 480, 75.00, 40.00, '8/0', 8, 3840, false, 'Manual doffing'),
(8, 'Ring Frame', 'RF-08', 480, 75.00, 40.00, '8/0', 8, 3840, false, 'Manual doffing'),
(9, 'Ring Frame', 'RF-09', 432, 75.00, 38.00, '7/0', 8, 3456, true, 'Compact machine'),
(10, 'Ring Frame', 'RF-10', 432, 75.00, 38.00, '7/0', 8, 3456, true, 'Compact machine'),
(11, 'Ring Frame', 'RF-11', 432, 75.00, 38.00, '7/0', 8, 3456, true, 'Standard operation'),
(12, 'Ring Frame', 'RF-12', 432, 75.00, 38.00, '7/0', 8, 3456, true, 'Standard operation'),
(13, 'Ring Frame', 'RF-13', 432, 75.00, 40.00, '8/0', 8, 3456, false, 'Old model'),
(14, 'Ring Frame', 'RF-14', 432, 75.00, 40.00, '8/0', 8, 3456, false, 'Old model'),
(15, 'Ring Frame', 'RF-15', 384, 75.00, 38.00, '7/0', 8, 3072, true, 'Fine count machine'),
(16, 'Ring Frame', 'RF-16', 384, 75.00, 38.00, '7/0', 8, 3072, true, 'Fine count machine'),
(17, 'Ring Frame', 'RF-17', 384, 75.00, 38.00, '7/0', 8, 3072, true, 'Standard operation'),
(18, 'Ring Frame', 'RF-18', 384, 75.00, 40.00, '8/0', 8, 3072, false, 'Manual operation'),
(19, 'Ring Frame', 'RF-19', 384, 75.00, 40.00, '8/0', 8, 3072, false, 'Manual operation'),
(20, 'Ring Frame', 'RF-20', 480, 75.00, 38.00, '7/0', 8, 3840, true, 'New installation'),
(21, 'Ring Frame', 'RF-21', 480, 75.00, 38.00, '7/0', 8, 3840, true, 'New installation'),
(22, 'Ring Frame', 'RF-22', 480, 75.00, 38.00, '7/0', 8, 3840, true, 'Standard operation'),
(23, 'Ring Frame', 'RF-23', 480, 75.00, 38.00, '7/0', 8, 3840, true, 'Standard operation'),
(24, 'Ring Frame', 'RF-24', 432, 75.00, 38.00, '7/0', 8, 3456, true, 'Standard operation'),
(25, 'Ring Frame', 'RF-25', 432, 75.00, 38.00, '7/0', 8, 3456, true, 'Standard operation'),
(26, 'Ring Frame', 'RF-26', 432, 75.00, 38.00, '7/0', 8, 3456, true, 'Standard operation'),
(27, 'Ring Frame', 'RF-27', 432, 75.00, 40.00, '8/0', 8, 3456, false, 'Under maintenance'),
(28, 'Ring Frame', 'RF-28', 384, 75.00, 38.00, '7/0', 8, 3072, true, 'Fine spinning'),
(29, 'Ring Frame', 'RF-29', 384, 75.00, 38.00, '7/0', 8, 3072, true, 'Fine spinning'),
(30, 'Ring Frame', 'RF-30', 384, 75.00, 38.00, '7/0', 8, 3072, true, 'Standard operation'),
(31, 'Ring Frame', 'RF-31', 384, 75.00, 40.00, '8/0', 8, 3072, false, 'Backup machine'),
(32, 'Ring Frame', 'RF-32', 480, 75.00, 38.00, '7/0', 8, 3840, true, 'Reserve machine'),
(33, 'Ring Frame', 'RF-33', 480, 75.00, 38.00, '7/0', 8, 3840, true, 'Reserve machine');

-- ============================================
-- 3. STOPPAGE HEAD MASTER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS stoppage_heads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code INTEGER NOT NULL UNIQUE,
  stoppage_head TEXT NOT NULL,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Stoppage Head Data (10 categories)
INSERT INTO stoppage_heads (code, stoppage_head, category, is_active) VALUES
(1, 'Power Failure', 'Electrical', true),
(2, 'Machine Breakdown', 'Mechanical', true),
(3, 'Material Shortage', 'Material', true),
(4, 'Quality Issue', 'Quality', true),
(5, 'Maintenance', 'Scheduled', true),
(6, 'Setup Time', 'Production', true),
(7, 'Operator Absence', 'Manpower', true),
(8, 'Tool Change', 'Production', true),
(9, 'Emergency Stop', 'Safety', true),
(10, 'Others', 'Miscellaneous', true);

-- ============================================
-- 4. STOPPAGE DETAIL MASTER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS stoppage_details (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stoppage_head_id UUID REFERENCES stoppage_heads(id) ON DELETE CASCADE,
  detail_code INTEGER NOT NULL,
  detail_description TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stoppage_head_id, detail_code)
);

-- ============================================
-- 5. SPINNING COUNT MASTER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS spinning_counts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code INTEGER NOT NULL UNIQUE,
  count_name TEXT NOT NULL,
  count_value DECIMAL(10,2) NOT NULL,
  tpi DECIMAL(10,2),
  twc DECIMAL(10,2),
  twist_multiplier DECIMAL(10,2),
  hank_weight DECIMAL(10,3),
  cone_weight DECIMAL(10,3),
  package_type TEXT,
  standard_production INTEGER,
  waste_percentage DECIMAL(5,2),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Spinning Count Data (21 counts)
INSERT INTO spinning_counts (code, count_name, count_value, tpi, twc, twist_multiplier, hank_weight, cone_weight, package_type, standard_production, waste_percentage, remarks) VALUES
(1, '10s Carded', 10.00, 12.50, 8.50, 3.50, 5.670, 1.500, 'Cone', 85, 3.50, 'Coarse count'),
(2, '16s Carded', 16.00, 15.80, 10.20, 3.80, 3.543, 1.200, 'Cone', 90, 3.20, 'Standard count'),
(3, '20s Carded', 20.00, 17.60, 11.40, 4.00, 2.835, 1.000, 'Cone', 88, 3.00, 'Standard count'),
(4, '24s Carded', 24.00, 19.30, 12.50, 4.20, 2.362, 0.900, 'Cone', 85, 2.80, 'Medium count'),
(5, '30s Carded', 30.00, 21.60, 14.00, 4.50, 1.890, 0.800, 'Cone', 82, 2.50, 'Medium fine'),
(6, '10s Combed', 10.00, 12.80, 8.70, 3.60, 5.670, 1.500, 'Cone', 88, 2.80, 'Quality yarn'),
(7, '16s Combed', 16.00, 16.00, 10.40, 3.90, 3.543, 1.200, 'Cone', 92, 2.50, 'Quality yarn'),
(8, '20s Combed', 20.00, 17.90, 11.60, 4.10, 2.835, 1.000, 'Cone', 90, 2.30, 'Quality yarn'),
(9, '24s Combed', 24.00, 19.60, 12.70, 4.30, 2.362, 0.900, 'Cone', 88, 2.10, 'Fine quality'),
(10, '30s Combed', 30.00, 21.90, 14.20, 4.60, 1.890, 0.800, 'Cone', 85, 1.90, 'Fine quality'),
(11, '40s Combed', 40.00, 25.30, 16.40, 5.00, 1.417, 0.600, 'Cone', 80, 1.70, 'Very fine'),
(12, '60s Combed', 60.00, 31.00, 20.10, 5.50, 0.945, 0.400, 'Cone', 70, 1.50, 'Extra fine'),
(13, '2/10s', 10.00, 10.50, 7.20, 3.20, 2.835, 1.800, 'Cone', 95, 2.00, 'Doubled yarn'),
(14, '2/16s', 16.00, 13.30, 9.10, 3.40, 1.771, 1.400, 'Cone', 93, 1.80, 'Doubled yarn'),
(15, '2/20s', 20.00, 14.80, 10.10, 3.60, 1.417, 1.200, 'Cone', 91, 1.60, 'Doubled yarn'),
(16, '2/24s', 24.00, 16.20, 11.10, 3.80, 1.181, 1.000, 'Cone', 89, 1.50, 'Fine doubled'),
(17, '2/30s', 30.00, 18.20, 12.50, 4.00, 0.945, 0.900, 'Cone', 87, 1.40, 'Fine doubled'),
(18, '2/40s', 40.00, 21.30, 14.60, 4.30, 0.708, 0.700, 'Cone', 83, 1.30, 'Very fine doubled'),
(19, '80s Combed', 80.00, 35.80, 23.20, 6.00, 0.708, 0.300, 'Cone', 60, 1.20, 'Ultra fine'),
(20, '100s Combed', 100.00, 40.00, 25.90, 6.50, 0.567, 0.250, 'Cone', 50, 1.00, 'Premium quality'),
(21, '2/60s', 60.00, 26.10, 17.90, 4.80, 0.472, 0.600, 'Cone', 75, 1.10, 'Extra fine doubled');

-- ============================================
-- 6. HOK STRENGTH MASTER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS hok_strength (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_date DATE NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  shift TEXT NOT NULL CHECK (shift IN ('A', 'B', 'C')),
  hok_value DECIMAL(10,2) NOT NULL,
  strength_value DECIMAL(10,2),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_date, department_id, shift)
);

-- ============================================
-- 7. SUPERVISOR MASTER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS supervisors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code INTEGER NOT NULL UNIQUE,
  supervisor_name TEXT NOT NULL,
  emp_id TEXT UNIQUE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  phone TEXT,
  email TEXT,
  shift_preference TEXT CHECK (shift_preference IN ('A', 'B', 'C', 'General')),
  is_active BOOLEAN DEFAULT true,
  joining_date DATE,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Supervisor Data (11 supervisors)
INSERT INTO supervisors (code, supervisor_name, emp_id, department_id, phone, email, shift_preference, is_active, joining_date, remarks) VALUES
(1, 'Rajesh Kumar', 'SUP001', (SELECT id FROM departments WHERE code = 5), '9876543210', 'rajesh.k@kayaar.com', 'A', true, '2020-01-15', 'Senior supervisor'),
(2, 'Amit Sharma', 'SUP002', (SELECT id FROM departments WHERE code = 5), '9876543211', 'amit.s@kayaar.com', 'B', true, '2020-03-20', 'Experienced'),
(3, 'Suresh Patel', 'SUP003', (SELECT id FROM departments WHERE code = 5), '9876543212', 'suresh.p@kayaar.com', 'C', true, '2020-06-10', 'Night shift expert'),
(4, 'Vijay Singh', 'SUP004', (SELECT id FROM departments WHERE code = 6), '9876543213', 'vijay.s@kayaar.com', 'A', true, '2019-11-05', 'Auto coner specialist'),
(5, 'Prakash Jain', 'SUP005', (SELECT id FROM departments WHERE code = 6), '9876543214', 'prakash.j@kayaar.com', 'B', true, '2021-02-18', 'Quality focused'),
(6, 'Ramesh Gupta', 'SUP006', (SELECT id FROM departments WHERE code = 2), '9876543215', 'ramesh.g@kayaar.com', 'A', true, '2018-08-22', 'Carding expert'),
(7, 'Mahesh Yadav', 'SUP007', (SELECT id FROM departments WHERE code = 3), '9876543216', 'mahesh.y@kayaar.com', 'B', true, '2019-04-15', 'Draw frame specialist'),
(8, 'Dinesh Kumar', 'SUP008', (SELECT id FROM departments WHERE code = 4), '9876543217', 'dinesh.k@kayaar.com', 'A', true, '2020-09-30', 'Speed frame expert'),
(9, 'Sandeep Verma', 'SUP009', (SELECT id FROM departments WHERE code = 1), '9876543218', 'sandeep.v@kayaar.com', 'General', true, '2021-07-12', 'Blow room supervisor'),
(10, 'Anil Tiwari', 'SUP010', (SELECT id FROM departments WHERE code = 29), '9876543219', 'anil.t@kayaar.com', 'General', true, '2017-05-20', 'Quality control head'),
(11, 'Mukesh Desai', 'SUP011', (SELECT id FROM departments WHERE code = 28), '9876543220', 'mukesh.d@kayaar.com', 'General', true, '2016-03-10', 'Maintenance head');

-- ============================================
-- 8. AUTOCONER MACHINE MASTER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS autoconer_machines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code INTEGER NOT NULL UNIQUE,
  machine_name TEXT NOT NULL,
  machine_no TEXT NOT NULL UNIQUE,
  spindles INTEGER NOT NULL,
  winding_speed INTEGER,
  is_active BOOLEAN DEFAULT true,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Autoconer Machine Data (33 machines)
INSERT INTO autoconer_machines (code, machine_name, machine_no, spindles, winding_speed, is_active, remarks) VALUES
(1, 'Autoconer', 'AC-01', 48, 1200, true, 'High speed winding'),
(2, 'Autoconer', 'AC-02', 48, 1200, true, 'High speed winding'),
(3, 'Autoconer', 'AC-03', 48, 1200, true, 'Standard operation'),
(4, 'Autoconer', 'AC-04', 48, 1200, true, 'Standard operation'),
(5, 'Autoconer', 'AC-05', 48, 1200, true, 'Standard operation'),
(6, 'Autoconer', 'AC-06', 48, 1000, true, 'Medium speed'),
(7, 'Autoconer', 'AC-07', 48, 1000, true, 'Medium speed'),
(8, 'Autoconer', 'AC-08', 48, 1000, true, 'Medium speed'),
(9, 'Autoconer', 'AC-09', 40, 1200, true, 'Compact model'),
(10, 'Autoconer', 'AC-10', 40, 1200, true, 'Compact model'),
(11, 'Autoconer', 'AC-11', 40, 1000, true, 'Standard operation'),
(12, 'Autoconer', 'AC-12', 40, 1000, true, 'Standard operation'),
(13, 'Autoconer', 'AC-13', 40, 1000, true, 'Standard operation'),
(14, 'Autoconer', 'AC-14', 48, 1200, true, 'New installation'),
(15, 'Autoconer', 'AC-15', 48, 1200, true, 'New installation'),
(16, 'Autoconer', 'AC-16', 48, 1200, true, 'Standard operation'),
(17, 'Autoconer', 'AC-17', 48, 1000, true, 'Standard operation'),
(18, 'Autoconer', 'AC-18', 48, 1000, true, 'Standard operation'),
(19, 'Autoconer', 'AC-19', 40, 1200, true, 'Fine winding'),
(20, 'Autoconer', 'AC-20', 40, 1200, true, 'Fine winding'),
(21, 'Autoconer', 'AC-21', 40, 1000, true, 'Standard operation'),
(22, 'Autoconer', 'AC-22', 40, 1000, true, 'Standard operation'),
(23, 'Autoconer', 'AC-23', 48, 1200, true, 'Reserve machine'),
(24, 'Autoconer', 'AC-24', 48, 1200, true, 'Reserve machine'),
(25, 'Autoconer', 'AC-25', 48, 1000, true, 'Backup unit'),
(26, 'Autoconer', 'AC-26', 48, 1000, true, 'Backup unit'),
(27, 'Autoconer', 'AC-27', 40, 1200, true, 'Standard operation'),
(28, 'Autoconer', 'AC-28', 40, 1200, true, 'Standard operation'),
(29, 'Autoconer', 'AC-29', 40, 1000, true, 'Standard operation'),
(30, 'Autoconer', 'AC-30', 40, 1000, true, 'Standard operation'),
(31, 'Autoconer', 'AC-31', 48, 1200, true, 'Under maintenance'),
(32, 'Autoconer', 'AC-32', 48, 1000, true, 'Standard operation'),
(33, 'Autoconer', 'AC-33', 48, 1000, true, 'Standard operation');

-- ============================================
-- 9. TPI ENTRY MASTER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tpi_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_date DATE NOT NULL,
  spinning_count_id UUID REFERENCES spinning_counts(id) ON DELETE CASCADE,
  tpi_value DECIMAL(10,2) NOT NULL,
  machine_id UUID REFERENCES spinning_machines(id) ON DELETE SET NULL,
  shift TEXT CHECK (shift IN ('A', 'B', 'C')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. TWC ENTRY MASTER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS twc_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_date DATE NOT NULL,
  spinning_count_id UUID REFERENCES spinning_counts(id) ON DELETE CASCADE,
  twc_value DECIMAL(10,2) NOT NULL,
  machine_id UUID REFERENCES spinning_machines(id) ON DELETE SET NULL,
  shift TEXT CHECK (shift IN ('A', 'B', 'C')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_departments_code ON departments(code);
CREATE INDEX idx_spinning_machines_code ON spinning_machines(code);
CREATE INDEX idx_spinning_machines_machine_no ON spinning_machines(machine_no);
CREATE INDEX idx_stoppage_heads_code ON stoppage_heads(code);
CREATE INDEX idx_spinning_counts_code ON spinning_counts(code);
CREATE INDEX idx_hok_strength_date ON hok_strength(entry_date);
CREATE INDEX idx_hok_strength_dept ON hok_strength(department_id);
CREATE INDEX idx_supervisors_code ON supervisors(code);
CREATE INDEX idx_supervisors_emp_id ON supervisors(emp_id);
CREATE INDEX idx_autoconer_machines_code ON autoconer_machines(code);
CREATE INDEX idx_tpi_entries_date ON tpi_entries(entry_date);
CREATE INDEX idx_twc_entries_date ON twc_entries(entry_date);

-- ============================================
-- ENABLE ROW LEVEL SECURITY (Optional)
-- ============================================
-- Uncomment if you want to enable RLS for tables
-- ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE spinning_machines ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE stoppage_heads ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE stoppage_details ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE spinning_counts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE hok_strength ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE supervisors ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE autoconer_machines ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tpi_entries ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE twc_entries ENABLE ROW LEVEL SECURITY;

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_spinning_machines_updated_at BEFORE UPDATE ON spinning_machines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stoppage_heads_updated_at BEFORE UPDATE ON stoppage_heads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stoppage_details_updated_at BEFORE UPDATE ON stoppage_details FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_spinning_counts_updated_at BEFORE UPDATE ON spinning_counts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hok_strength_updated_at BEFORE UPDATE ON hok_strength FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_supervisors_updated_at BEFORE UPDATE ON supervisors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_autoconer_machines_updated_at BEFORE UPDATE ON autoconer_machines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tpi_entries_updated_at BEFORE UPDATE ON tpi_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_twc_entries_updated_at BEFORE UPDATE ON twc_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify data insertion
-- SELECT COUNT(*) as total_departments FROM departments;
-- SELECT COUNT(*) as total_machines FROM spinning_machines;
-- SELECT COUNT(*) as total_stoppage_heads FROM stoppage_heads;
-- SELECT COUNT(*) as total_counts FROM spinning_counts;
-- SELECT COUNT(*) as total_supervisors FROM supervisors;
-- SELECT COUNT(*) as total_autoconer FROM autoconer_machines;
