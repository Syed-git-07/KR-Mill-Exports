

# ✅ STEP-BY-STEP CALCULATION FLOW (PROPER & CLEAN)

## 🔹 INPUTS (From Machine / Shift)

### Machine Inputs (ONLY THESE)

* **Act Hank** → from EL Measure
* **Act Prodn (Actual Production)** → from EL Measure

### Shift Inputs

* **Total Time** → 510 mins
* **Stoppage Time** → 135 mins
* **Run Time** → 375 mins

### Constants / Master Data

* **Speed** → 130 (from VB6 Machine Setup screenshot)
* **Hank constant** → 0.13
* **Std Efficiency factor** → 0.98
* **Waste** → 0.34 kg
* **Divisor Constant** → 1693

---

## 1️⃣ STEP-1: Calculate Run Time & Work Time

```
Run Time = Total Time − Stoppage Time
Work Time = Run Time
```

Example:

```
Run Time = 510 − 135 = 375 mins
Work Time = 375 mins
```

---

## 2️⃣ STEP-2: Calculate Standard Production (Std Prodn)

> Base reference (100% capacity) - Uses TOTAL TIME, not Run Time

```
Std Prodn = (Speed / 1693 / Hank_Constant) × Total Time × Std_Efficiency_Factor
```

Example (from VB6 screenshot):

```
Std Prodn = (130 / 1693 / 0.13) × 510 × 0.98
Std Prodn = 0.5907 × 510 × 0.98
Std Prodn = 295.22 kg
```

---

## 3️⃣ STEP-3: Calculate Expected Production (Exp Prodn)

> Time-adjusted target (adjusted for actual run time)

```
Exp Prodn = Std Prodn × Run Time / Total Time
```

Example:

```
Exp Prodn = 295.22 × 375 / 510
Exp Prodn = 217.07 kg
```

---

## 4️⃣ STEP-4: Calculate PERFORMANCE % (Act / Exp)


> ✔️ This is **performance vs expected target**

```
Performance % = Actual Production / Expected Production × 100
```

Example:

```
Performance % = 225.82 / 217.07 × 100
Performance % = 104.03 %
```

📌 Meaning:

> Actual output exceeded the time-adjusted target by 4.03%

---

## 5️⃣ STEP-5: Calculate TRUE Efficiency % (For Reference)

> Machine efficiency (recommended KPI)

```
Efficiency % = Actual Production / Standard Production × 100
```

Example:

```
Efficiency % = 225.82 / 295.23 × 100
Efficiency % = 76.51 %
```

---

## 6️⃣ STEP-6: Calculate Utilization (UTI %)

```
UTI % = Run Time / Total Time × 100
```

Example:

```
UTI = 375 / 510 × 100 = 73.53 %
```

---

## 7️⃣ STEP-7: Calculate Waste %

```
Waste % = Waste / Actual Production × 100
```

Example:

```
Waste % = 0.34 / 225.82 × 100 = 0.15 %
```

---

# 🧾 FINAL SUMMARY TABLE (CA1)

| Metric            | Formula Used    | Value      |
| ----------------- | --------------- | ---------- |
| Act Hank          | Machine         | 64.72      |
| Act Prodn         | Machine         | 225.82     |
| Std Prodn         | Speed based     | 295.23     |
| Exp Prodn         | Time adjusted   | 217.07     |
| **Performance %** | Act / Exp × 100 | **104.03** |
| **Efficiency %**  | Act / Std × 100 | **76.51**  |
| UTI %             | Run / Total     | 73.53      |
| Waste %           | Waste / Act     | 0.15       |
| Run Time          | Calc            | 375        |
| Work Time         | Calc            | 375        |


