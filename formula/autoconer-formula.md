# Autoconer Production Formulas

## Overview
Autoconer machines are used for winding yarn from ring frame bobbins onto cones. Production is measured in terms of actual production (kg), efficiency, and drum utilization.

---

## Formulas

### 1. Waste Percentage
```
Waste % = (Waste / Act Prod) × 100
```

**Where:**
- **Waste** = Waste in Kg (Manual Entry)
- **Act Prod** = Actual Production in Kg (Manual Entry)

**Example:**
- Waste = 0.5 kg
- Act Prod = 215 kg
- Waste % = (0.5 / 215) × 100 = **0.23%**

---

### 2. Utilization Percentage (UTI %)
```
UTI % = (Run Time / Total Time) × 100
```

**Where:**
- **Run Time** = Total Time - Total Stoppage Time (mins)
- **Total Time** = Shift-specific time (Shift 1: 510 mins, Shift 2: 510 mins, Shift 3: 420 mins)

**Example (Shift 1 or 2):**
- Total Time = 510 mins
- Total Stoppage = 30 mins
- Run Time = 510 - 30 = 480 mins
- UTI % = (480 / 510) × 100 = **94.12%**

**Example (Shift 3):**
- Total Time = 420 mins
- Total Stoppage = 30 mins
- Run Time = 420 - 30 = 390 mins
- UTI % = (390 / 420) × 100 = **92.86%**

---

### 3. Idle Drum Percentage
```
Idle Drum % = (Idle Drum / Total Drum) × 100
```

**Where:**
- **Idle Drum** = Number of idle/stopped drums (Manual Entry)
- **Total Drum** = Total drums in machine (from machine master)

**Example:**
- AC1-1 has 5 Idle Drums
- Total Drums = 60
- Idle Drum % = (5 / 60) × 100 = **8.33%**

---

### 4. Production Efficiency (Adjusted UTI %)
The actual UTI% considers idle drums:

```
Drum Efficiency = 100 - Idle Drum %
Adjusted UTI % = (Run Time / Total Time) × Drum Efficiency
```

**Example (AC1-1, Shift 1):**
1. Idle Drum = 5, Total Drum = 60
2. Idle Drum % = (5 / 60) × 100 = 8.33%
3. Drum Efficiency = 100 - 8.33 = **91.67%**
4. Total Time = 510 mins (Shift 1)
5. Total Stoppage = 30 mins
6. Run Time = 510 - 30 = 480 mins
7. UTI % = (480 / 510) × 91.67 = **86.27%**

**Example (AC1-1, Shift 3):**
1. Idle Drum = 5, Total Drum = 60
2. Idle Drum % = (5 / 60) × 100 = 8.33%
3. Drum Efficiency = 100 - 8.33 = **91.67%**
4. Total Time = 420 mins (Shift 3)
5. Total Stoppage = 30 mins
6. Run Time = 420 - 30 = 390 mins
7. UTI % = (390 / 420) × 91.67 = **85.16%**

---

### 5. Actual Efficiency (Act. Effi.)
```
Act. Effi. = From Machine Master (autoconer_machines.act_effi)
```
This is a stored value from the machine configuration, typically 80-82%.

---

### 6. Production Efficiency (Prodn Effi.)
```
Prodn Effi. % = (Act Prodn / Std Prodn) × 100
```

**Where:**
- **Act Prodn** = Actual Production (Manual Entry)
- **Std Prodn** = Standard/Expected Production based on machine parameters

---

## Data Entry Fields

### Production Entry Tab
| Field | Type | Description |
|-------|------|-------------|
| Mc No. | Display | Machine Number (AC1-1, AC2-1, etc.) |
| Emp Name | Autocomplete | Employee Name |
| Count Name | Dropdown | Count Name (e.g., 68 COMBED STAR) |
| Drum From | Display | Starting Drum Number |
| Drum To | Display | Ending Drum Number |
| Drum Total | Display | Total Drums (to_drum - from_drum + 1) |
| Act. Prodn | Manual | Actual Production in Kg |
| Prodn Effi. | Calculated | Production Efficiency % |
| Red Light | Manual | Red Light Count |
| Idle Drum | Manual | Number of Idle Drums |
| Idle Reason | Dropdown | Reason for Idle Drums |
| Act. Effi. | Display | Actual Efficiency from Master |
| Waste Kg | Manual | Waste in Kg |
| Waste % | Calculated | Waste Percentage |

### Stoppage Entry Tab
| Field | Type | Description |
|-------|------|-------------|
| M/c ID | Display | Machine ID |
| Mc No | Display | Machine Number |
| Count Name | Display | Count Name |
| Session | Display | Session Number (default 1) |
| R. Time | Display | Run Time (Shift-specific: 510/510/420 mins) |
| Stoppage 1-4 | Dropdown | Stoppage Reason |
| S. Time 1-4 | Manual | Stoppage Time in Minutes |

### Machine Setup Tab
| Field | Type | Description |
|-------|------|-------------|
| Mc No | Display | Machine Number |
| Make Name | Display | Make Name (MURT) |
| Count Name | Dropdown | Count Name |
| Act Count | Manual | Actual Count Value (e.g., 69.5) |
| Session | Display | Session Number |
| R. Time | Display | Run Time (Shift-specific: 510/510/420) |

---

## Special Features

### Full Stoppage
Apply same stoppage to ALL machines at once:
- Select Stoppage Reason
- Enter Stoppage Minutes
- Click "Apply" to update all machines

### Partial Stoppage
Apply stoppage to a RANGE of groups:
- Select Stoppage Reason
- Select "From Group No." and "To Group No."
- Enter Stoppage Minutes
- Click "Apply" to update machines in selected groups

---

## Machine Grouping Rules

| Group Type | Machines | Drum Split | No. of Drums |
|------------|----------|------------|--------------|
| 1 Machine | AC1-1 | 1-60 | 60 |
| 2 Machines | AC2-1, AC2-2 | 1-30, 31-60 | 30 each |
| 5 Machines | AC3-1 to AC3-5 | 1-12, 13-24, 25-36, 37-48, 49-60 | 12 each |

---

## Constants
| Constant | Value | Description |
|----------|-------|-------------|
| Total Time | 510/510/420 | Shift-specific time (Shift 1, 2, 3) in minutes |
| Default R.Time | 510/510/420 | Shift-specific run time (Shift 1, 2, 3) |
| Default Session | 1 | Default session number |
| Act. Effi | 80-82 | Default actual efficiency % |
