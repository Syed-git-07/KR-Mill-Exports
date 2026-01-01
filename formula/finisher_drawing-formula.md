

# 🔷 FINISHER DRAWING – FIELD-WISE LOGIC (FINAL)

## 📅 Sample Data Reference: 25-Dec-2025, Shift 1

---

## 1️⃣ What comes from EL Measure (Machine)

✅ **Only these are fetched automatically:**

| Field         | Source                                     |
| ------------- | ------------------------------------------ |
| **Act Hank**  | EL Measure                                 |
| **Act Prodn** | Calculated from Prod Hank (using constant) |

👉 Everything else is **system calculated or derived from stoppage / setup**

---

## 📊 Sample Production Data (25-Dec-2025, Shift 1)

| Mc No. | Emp. Name | Mixing | Act.Hank | Act.Prodn | Exp.Prodn | Waste | Waste% | Act.Effi | Uti | RunTime | WorkTime |
|--------|-----------|--------|----------|-----------|-----------|-------|--------|----------|-----|---------|----------|
| FD4 | JAYACHITRA. E | 64COMBED GOLD | 138.63 | 449.19 | 451.86 | 0.41 | 0.09 | 99.41 | 66.67 | 510 | 340 |
| FD5 | JAYACHITRA. E | 64COMBED GOLD | 149.46 | 484.27 | 478.44 | 0.41 | 0.08 | 101.22 | 70.59 | 510 | 360 |
| FD6 | KANAGAVALLI R | 64COMBED GOLD | 99.76 | 323.23 | 318.96 | 0.41 | 0.13 | 101.34 | 47.06 | 510 | 240 |
| FD7 | KANAGAVALLI R | 64COMBED GOLD | 104.54 | 338.72 | 345.54 | 0.41 | 0.12 | 98.03 | 50.98 | 510 | 260 |
| FD8 | KANAGAVALLI R | 64COMBED GOLD | 106.68 | 345.66 | 345.54 | 0.41 | 0.12 | 100.03 | 50.98 | 510 | 260 |
| FD9 | JAYACHITRA. E | 64COMBED GOLD | 99.48 | 322.33 | 318.96 | 0.41 | 0.13 | 101.06 | 47.06 | 510 | 240 |
| FD10 | GANDHIMATHI K | 64COMBED GOLD | 115.24 | 373.39 | 385.41 | 0.82 | 0.22 | 96.88 | 56.86 | 510 | 290 |

---

## 📊 Sample Stoppage Data (25-Dec-2025, Shift 1)

| Mcno | Session | Effi | R.Time | Stoppage1 | S.Time1 | Stoppage2 | S.Time2 | Stoppage3 | S.Time3 | Total |
|------|---------|------|--------|-----------|---------|-----------|---------|-----------|---------|-------|
| FD4 | 1 | 99.41 | 510 | EXCESS STOCK | 150 | AIR CLEANING | 20 | - | 0 | 170 |
| FD5 | 1 | 101.22 | 510 | EXCESS STOCK | 130 | AIR CLEANING | 20 | - | 0 | 150 |
| FD6 | 1 | 101.34 | 510 | EXCESS STOCK | 230 | AIR CLEANING | 20 | COTS BUFFING | 20 | 270 |
| FD7 | 1 | 98.03 | 510 | EXCESS STOCK | 210 | AIR CLEANING | 20 | COTS BUFFING | 20 | 250 |
| FD8 | 1 | 100.03 | 510 | EXCESS STOCK | 210 | AIR CLEANING | 20 | COTS BUFFING | 20 | 250 |
| FD9 | 1 | 101.06 | 510 | EXCESS STOCK | 230 | AIR CLEANING | 20 | COTS BUFFING | 20 | 270 |
| FD10 | 1 | 96.88 | 510 | EXCESS STOCK | 160 | AIR CLEANING | 20 | COTS BUFFING | 40 | 220 |

---

## 📊 Sample Machine Setup Data (25-Dec-2025)

| Mc.No. | Make | Mixing | Session | ShiftTime | Std.Prodn | Speed | Std.Effi | Sl.Hank | Deliver | TYPE |
|--------|------|--------|---------|-----------|-----------|-------|----------|---------|---------|------|
| FD4 | RIETER | 64COMBED GOLD | 1 | 510 | 677.79 | 350 | 90 | 0.14 | 1 | FINISHER |
| FD5 | RIETER | 64COMBED GOLD | 1 | 510 | 677.79 | 350 | 90 | 0.14 | 1 | FINISHER |
| FD6 | LMW | 64COMBED GOLD | 1 | 510 | 677.79 | 350 | 90 | 0.14 | 1 | FINISHER |
| FD7 | LMW | 64COMBED GOLD | 1 | 510 | 677.79 | 350 | 90 | 0.14 | 1 | FINISHER |
| FD8 | LMW | 64COMBED GOLD | 1 | 510 | 677.79 | 350 | 90 | 0.14 | 1 | FINISHER |
| FD9 | LMW | 64COMBED GOLD | 1 | 510 | 677.79 | 350 | 90 | 0.14 | 1 | FINISHER |
| FD10 | LMW | 64COMBED GOLD | 1 | 510 | 677.79 | 350 | 90 | 0.14 | 1 | FINISHER |

---

## 2️⃣ CONSTANT & ACTUAL PRODUCTION (Kg)

### Given:

```
Hank = 0.14
```

### Constant:

```
Constant = 1 / 2.20456 / 0.14
         ≈ 3.240
```

### Actual Production:

```
Act Prodn (Kg) = Prod Hank × Constant
```

✔ This matches the **Act Prodn values** on screen
(no mismatch here)

---

## 3️⃣ TOTAL SHIFT TIME (FIXED)

From Machine Setup:

```
Shift Time = 510 mins
```

This is constant for all FD machines.

---

## 4️⃣ STOPPAGE ENTRY → RUN TIME (KEY PART)

From **Stoppage Entry tab**, for each machine:

Example FD4:

* Excess stock = 150
* Air cleaning = 20

```
Total Stoppage = 170 mins
```

### ✅ Run Time calculation:

```
Run Time (mins) = 510 − Total Stoppage
               = 510 − 170
               = 340 mins
```

✔ Matches **RunTime = 340** on Production Entry screen

👉 **Run Time is NOT manual**
👉 **Run Time always comes from stoppage**

---

## 5️⃣ UTILIZATION (UTI %)

```
UTI (%) = Run Time / Total Time × 100
```

For FD4:

```
= 340 / 510 × 100
= 66.67%
```

✔ Matches screen exactly

---

## 6️⃣ STANDARD PRODUCTION (Std Prodn)

### Formula you gave (correct):

```
Std Prodn (Kg) =
Speed / 1693 / Hank
× Total Mins
× Std Effi (0.90)
```

For FD machines:

```
Speed = 350
Hank  = 0.14
Total mins = 510
Std Effi = 0.90
```

```
Std Prodn =
350 / 1693 / 0.14 × 510 × 0.90
≈ 677.79 Kg
```

✔ Matches **Std Prodn = 677.79** in Machine Setup

👉 **Std Prodn is machine-setup based, not daily based**

---

## 7️⃣ EXPECTED PRODUCTION (Exp Prodn)

### Formula:

```
Exp Prodn = Std Prodn × (Run Time / Total Time)
```

For FD4:

```
= 677.79 × (340 / 510)
= 451.86 Kg
```

✔ Screen shows **451.86**

✅ **Perfect match**

---

## 8️⃣ ACTUAL EFFICIENCY (Act Effi %)

### Correct formula:

```
Act Effi (%) = Act Prodn / Exp Prodn × 100
```

For FD4:

```
= 449.19 / 451.86 × 100
≈ 99.41%
```

✔ Matches **Act Effi = 99.41**

---

## 9️⃣ WASTE & WASTE %

### Waste:

* Entered manually (or fixed per process)
* Example FD4: `0.41`

### Waste %:

```
Waste % = Waste / Act Prodn × 100
```

For FD4:

```
= 0.41 / 449.19 × 100
≈ 0.09%
```

✔ Matches screen



---

# ✅ FINAL VERIFIED FLOW (FINISHER DRAWING)

```
EL Measure
   ↓
Act Hank / Prod Hank
   ↓
Act Prodn (using constant)
   ↓
Stoppage Entry
   ↓
Run Time = 510 − Stoppage
   ↓
Std Prodn (from machine setup)
   ↓
Exp Prodn = Std Prodn × (Run Time / 510)
   ↓
Act Effi = Act Prodn / Exp Prodn × 100
   ↓
UTI = Run Time / 510 × 100
```

---

# 🔢 FORMULA VERIFICATION WITH SAMPLE DATA (25-Dec-2025)

## FD4 Verification:
```
Given:
- Act Hank (from EL Measure) = 138.63
- Total Stoppage = 150 + 20 = 170 mins
- Speed = 350, Hank = 0.14, Std Effi = 0.90

Calculations:
1. Run Time = 510 - 170 = 340 mins ✓
2. UTI% = (340 / 510) × 100 = 66.67% ✓
3. Std Prodn = 350 / 1693 / 0.14 × 510 × 0.90 = 677.79 Kg ✓
4. Exp Prodn = 677.79 × (340 / 510) = 451.86 Kg ✓
5. Act Prodn = 138.63 × 3.240 = 449.19 Kg ✓
6. Act Effi = (449.19 / 451.86) × 100 = 99.41% ✓
7. Waste% = (0.41 / 449.19) × 100 = 0.09% ✓
```

## FD5 Verification:
```
Given:
- Act Hank = 149.46
- Total Stoppage = 130 + 20 = 150 mins

Calculations:
1. Run Time = 510 - 150 = 360 mins ✓
2. UTI% = (360 / 510) × 100 = 70.59% ✓
3. Exp Prodn = 677.79 × (360 / 510) = 478.44 Kg ✓
4. Act Prodn = 149.46 × 3.240 = 484.27 Kg ✓
5. Act Effi = (484.27 / 478.44) × 100 = 101.22% ✓
```

## FD6 Verification:
```
Given:
- Act Hank = 99.76
- Total Stoppage = 230 + 20 + 20 = 270 mins

Calculations:
1. Run Time = 510 - 270 = 240 mins ✓
2. UTI% = (240 / 510) × 100 = 47.06% ✓
3. Exp Prodn = 677.79 × (240 / 510) = 318.96 Kg ✓
4. Act Prodn = 99.76 × 3.240 = 323.23 Kg ✓
5. Act Effi = (323.23 / 318.96) × 100 = 101.34% ✓
```

## FD10 Verification:
```
Given:
- Act Hank = 115.24
- Waste = 0.82 Kg
- Total Stoppage = 160 + 20 + 40 = 220 mins

Calculations:
1. Run Time = 510 - 220 = 290 mins ✓
2. UTI% = (290 / 510) × 100 = 56.86% ✓
3. Exp Prodn = 677.79 × (290 / 510) = 385.41 Kg ✓
4. Act Prodn = 115.24 × 3.240 = 373.39 Kg ✓
5. Act Effi = (373.39 / 385.41) × 100 = 96.88% ✓
6. Waste% = (0.82 / 373.39) × 100 = 0.22% ✓
```

---

# 📋 KEY DIFFERENCES: FINISHER vs BREAKER DRAWING

| Parameter | Breaker Drawing | Finisher Drawing |
|-----------|-----------------|------------------|
| Machines | BD1-BD4 (4 machines) | FD4-FD10 (7 machines) |
| Speed | 450-750 m/min | 350 m/min (uniform) |
| Std Efficiency | 85% | 90% |
| Default Waste | 0.85 Kg | 0.41 Kg |
| Std Prodn | 1371.72-1646.06 Kg | 677.79 Kg |
| Machine Makes | N/A | RIETER, LMW |
| Machine Type | BREAKER | FINISHER |
| Hank | 0.14 | 0.14 |
| Divisor | 1693 | 1693 |

---

# 🏭 STOPPAGE CODES FOR FINISHER DRAWING

| Code | Stoppage Name | Short Code | Common Usage |
|------|---------------|------------|--------------|
| 1530 | EXCESS STOCK | ECI | Very frequent (150-230 mins) |
| 1531 | AIR CLEANING | AIC | Every machine (20 mins) |
| 1532 | COTS BUFFING | CBG | Most machines (20-40 mins) |
| 1533 | COILER PROBLEM | CLP | Occasional |
| 1534 | SUCTION PROBLEM | SP | Occasional |
| 1535 | MATERIAL SHORTAGE | MS | Occasional |


