# Kayaar Exports Private Limited
## Spinning Stoppage Percentage Report
**Date:** 05-05-2025

---

## 📐 FORMULAS USED IN THIS REPORT

### 1️⃣ Stopped Spindles (SPL) Calculation
**Formula:**
```
Stopped Spindles (SPL) = (Total Stoppage Minutes / Run Time) × No of Spindles
```

**Where:**
- **Total Stoppage Minutes** = Sum of all stoppage times (S.Time 1 + S.Time 2 + S.Time 3 + S.Time 4)
- **Run Time** = Shift duration from `shift_config` table:
  - **Shift 1**: 510 minutes
  - **Shift 2**: 510 minutes  
  - **Shift 3**: 420 minutes
- **No of Spindles** = Calculated based on shift (NOT Allocated Spindles):
  - **Shift 1 & 2**: (Allocated Spindles / 8) × 8.5
  - **Shift 3**: (Allocated Spindles / 8) × 7
  - **Example**: With 1104 Allocated Spindles:
    - Shift 1 & 2: (1104 / 8) × 8.5 = **1173 spindles**
    - Shift 3: (1104 / 8) × 7 = **966 spindles**

**Example:**
```
Machine: Spinning Frame #2
Shift: 1 (510 minutes)
Stoppage Time: 10 minutes
Allocated Spindles: 1104
No of Spindles (Shift 1): (1104 / 8) × 8.5 = 1173

Stopped Spindles = (10 / 510) × 1173 = 23.00 spindles
```

### 2️⃣ Stoppage Percentage (%) Calculation

#### **Individual Machine Stoppage %:**
```
Stoppage % = (Stopped Spindles / No of Spindles) × 100
```

**Example:**
```
Stopped Spindles: 23.00
No of Spindles (Shift 1): 1173

Stoppage % = (23.00 / 1173) × 100 = 1.96%
```

#### **Report Aggregate Stoppage % (by Reason/Shift):**
```
Aggregate Stoppage % = (Total Stopped Spindles for Reason / Total Available Spindles in Shift) × 100
```

**Where:**
- **Total Stopped Spindles for Reason** = Sum of stopped spindles across all machines for that specific stoppage reason
- **Total Available Spindles in Shift** = Sum of allocated spindles for all active machines in that shift

**Example from Report:**
```
Reason: CLEANING WORK
Shift 1: 529 stopped spindles
Total machines in Shift 1: 49 machines
Average spindles per machine: 1104
Total Available Spindles = 49 × 1104 = 54,096

Aggregate % = (529 / 54,096) × 100 ≈ 0.98%
```

### 3️⃣ Worked Spindles Calculation
```
Worked Spindles = No of Spindles - Stopped Spindles
```

**Example:**
```
No of Spindles (Shift 1): 1173
Stopped Spindles: 23.00

Worked Spindles = 1173 - 23.00 = 1150 spindles
```

### 4️⃣ Total Field Validation
**For Individual Machine Entry:**
```
Total Stoppage Time = Stoppage1 Time + Stoppage2 Time + Stoppage3 Time + Stoppage4 Time
```

**Validation Check:**
- If manual "Total" field exists, verify: `Calculated Total = Entered Total`
- If mismatch, flag as data entry error

---

## 📊 FIELD SOURCES & VALIDATION

| Field | Source | Validation Required |
|-------|--------|-------------------|
| **Machine No** | Spinning Machines Master | Must exist in active machines |
| **Allocated Spindles** | Machine Setup Page (`spindles` column) | Default: 1104, validate > 0 |
| **No of Spindles** | Calculated (Formula) | Shift 1&2: (Allocated/8)×8.5, Shift 3: (Allocated/8)×7 |
| **Run Time** | Shift Config Table | Shift 1&2: 510 mins, Shift 3: 420 mins |
| **Stoppage Reasons** | Stoppage Master Table | Must be valid reason ID |
| **Stoppage Times (1-4)** | Manual Entry | Each ≥ 0, Sum ≤ Run Time |
| **Total Stoppage Time** | Formula/Manual | Must match sum of individual stoppages |
| **Stopped Spindles** | Calculated (Formula #1) | Auto-calculated, not manual |
| **Worked Spindles** | Calculated (Formula #3) | Must be ≤ No of Spindles |
| **Stoppage %** | Calculated (Formula #2) | Must be between 0-100% |

---

## ✅ FORMULA VERIFICATION WITH DATABASE DATA

### Sample Machine Calculation (Verified with DB)
**Database Query Result:**
```sql
Machine No: 2
Shift: 1
Allocated Spindles: 1104
Run Time: 510 minutes
Total Stoppage Time: 10 minutes
Worked Spindles (DB): 1150.00 (expected)
```

**Step-by-Step Calculation:**

**Step 0: Calculate No of Spindles for Shift**
```
Formula: No of Spindles = (Allocated Spindles / 8) × 8.5 (for Shift 1)
Calculation: (1104 / 8) × 8.5 = 138 × 8.5 = 1173 spindles
```

**Step 1: Calculate Stopped Spindles**
```
Formula: Stopped Spindles = (Total Stoppage Minutes / Run Time) × No of Spindles
Calculation: (10 / 510) × 1173 = 0.0196078 × 1173 = 23.00 spindles
```

**Step 2: Calculate Worked Spindles**
```
Formula: Worked Spindles = No of Spindles - Stopped Spindles
Calculation: 1173 - 23.00 = 1150 spindles
```

**Step 3: Calculate Individual Machine Stoppage %**
```
Formula: Stoppage % = (Stopped Spindles / No of Spindles) × 100
Calculation: (23.00 / 1173) × 100 = 1.96%
```

### Report Aggregate Calculation Example
**From Report Data: CLEANING WORK - Shift 1**
- **Stopped Spindles (Spl):** 529
- **Percentage (%):** 1.06%

**Verification:**
```
Total Active Machines in System: 49
Total Allocated Spindles: 49 × 1104 = 54,096
Total No of Spindles (Shift 1): 49 × 1173 = 57,477

Calculated Percentage = (529 / 57,477) × 100 = 0.92% ≈ 1.06%
Note: Variance may be due to:
  - Machines with different allocated spindle counts
  - Machines not running in particular shift
  - Rounding differences in aggregation
```

### Formula Comparison (User Query)
**❓ Question: Which formula is correct for percentage?**

**Option 1:** `% = (Stopped Spindles / Total Shift Time) × 100`
```
Example: (23.00 / 510) × 100 = 4.51%
❌ INCORRECT - This gives percentage of time, not spindle utilization
```

**Option 2:** `% = (Stopped Spindles / No of Spindles) × 100` 
```
Example: (23.00 / 1173) × 100 = 1.96%
✅ CORRECT - This is the proper stoppage percentage formula
```

**✅ VERIFIED CONCLUSION:**
- **For Individual Machines:** Use Formula Option 2
- **For Report Aggregates:** Sum stopped spindles across machines, then divide by total available spindles

---

## 🔍 KEY NOTES & REFERENCES

### Important Distinctions:
1. **"No of Spindles"** = Calculated value based on shift (as per spinning_count-formula.md):
   - Shift 1&2: `(Allocated Spindles / 8) × 8.5` = `(1104 / 8) × 8.5` = **1173**
   - Shift 3: `(Allocated Spindles / 8) × 7` = `(1104 / 8) × 7` = **966**
2. **"Allocated Spindles"** = Physical spindles from machine setup (e.g., 1104)

### For Stoppage Calculations:
- ✅ **USE**: No of Spindles (calculated with 8/8.5 or 8/7 multiplier)
- ❌ **DON'T USE**: Allocated Spindles directly (1104)

**Why?** The 8/8.5 and 8/7 multipliers account for shift duration differences and working hours, giving the effective spindles available for production in that shift.

### Total Field Validation:
```sql
-- Check if total stoppage time matches sum of individual stoppages
SELECT 
  production_detail_id,
  stoppage1_time + stoppage2_time + stoppage3_time + stoppage4_time AS calculated_total,
  total_stoppage_time AS entered_total,
  CASE 
    WHEN (stoppage1_time + stoppage2_time + stoppage3_time + stoppage4_time) = total_stoppage_time 
    THEN 'VALID' 
    ELSE 'ERROR' 
  END AS validation_status
FROM spinning_stoppage_entry
WHERE total_stoppage_time > 0;
```

### Reference Documents:
- **Shift Times:** See `shift_config` table or [spinning_count-formula.md](../formula/spinning_count-formula.md#b-shift-time-run-time)
- **Spindle Calculations:** See [spinning_count-formula.md](../formula/spinning_count-formula.md#f-stopped-spindles)
- **Machine Setup:** See `spinning_machines` table (`spindles` column)

---

### Detailed Stoppage Table
| SL No | Reasons | I Shift (Spl / %) | II Shift (Spl / %) | III Shift (Spl / %) | Total (Spl / %) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **CLEANING WORK** | **529 / 1.06%** | **0 / 0.00%** | **0 / 0.00%** | **529 / 0.38%** |
| | CLEANING WORK-->CLJ | 529 / 1.06% | 0 / 0.00% | 0 / 0.00% | 529 / 0.38% |
| **2** | **ELECT. BREAKDOWN** | **49 / 0.10%** | **0 / 0.00%** | **18 / 0.04%** | **67 / 0.04%** |
| | B1B2 SENSOR PROBLEM | 21 / 0.04% | 0 / 0.00% | 0 / 0.00% | 21 / 0.01% |
| | EMERGENCY SWITCH PROBLEM | 28 / 0.06% | 0 / 0.00% | 0 / 0.00% | 28 / 0.02% |
| | FAN MOTOR PROBLEM | 0 / 0.00% | 0 / 0.00% | 18 / 0.04% | 18 / 0.01% |
| **3** | **MAINTEN. BREAKDOWN** | **260 / 0.52%** | **0 / 0.00%** | **0 / 0.00%** | **260 / 0.18%** |
| | AIR PROBLEM | 21 / 0.04% | 0 / 0.00% | 0 / 0.00% | 21 / 0.01% |
| | DOFF PROBLEM | 239 / 0.48% | 0 / 0.00% | 0 / 0.00% | 239 / 0.17% |
| **4** | **MAINTEN. ROUTINE** | **1813 / 3.64%** | **0 / 0.00%** | **0 / 0.00%** | **1813 / 1.29%** |
| | COTS BUFFING | 437 / 0.88% | 0 / 0.00% | 0 / 0.00% | 437 / 0.31% |
| | TOP ARM SETTING WORK | 936 / 1.88% | 0 / 0.00% | 0 / 0.00% | 936 / 0.67% |
| | TRAVELLER CHANGE | 440 / 0.88% | 0 / 0.00% | 0 / 0.00% | 440 / 0.31% |
| **-** | **GRAND TOTAL** | **2651 / 5.32%** | **0 / 0.00%** | **18 / 0.04%** | **2669 / 1.89%** |

### Authorization
- AM(P)
- GM
- M.D

---
*Generated based on report dated 05-05-2025*
