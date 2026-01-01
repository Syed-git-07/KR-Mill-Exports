

1. **Freeze the formulas (final)**
2. **List sample data from the images (LF1 as example)**
3. **Step-by-step calculation**
4. **Verification vs screen values**

---

## 1️⃣ FINAL FORMULAS (LAP FORMER – AS CONFIRMED)

> **Act Hank & Act Prodn are fetched from EL Measure**
> Everything else is calculated.

### Constants

* **Hank = 0.0082**
* **Std Effi = 0.85**
* **Total Time = 510 mins**

---

### 🔹 Formula Set (Final)

```text
Run Time = Total Time − Total Stoppage
Work Time = Run Time

Std Prodn (Kg) =
Speed / 1693 / Hank × Total Time × Std Effi × Delivery

Exp Prodn (Kg) =
Std Prodn × (Run Time / Total Time)

Act Effi (%) =
Actual Prodn / Exp Prodn × 100

Waste % =
Waste / Actual Prodn × 100

UTI (%) =
Run Time / Total Time × 100
```

---

## 2️⃣ SAMPLE DATA (LF1 – FROM SCREEN)

### From EL Measure

* **Act Hank** = **28.36**
* **Act Prodn** = **1568.85 kg**
* **Waste** = **0.85 kg**

### Machine Setup (from Machine Setup tab)

* **Speed** = **120**
* **Std Effi** = **85%**
* **Hank** = **0.0082**
* **Delivery** = **1**
* **Shift Time** = **510 mins**

### Stoppage (from Stoppage Entry tab)

* **Stoppage 1** = 180 mins
* **Stoppage 2** = 120 mins

➡ **Total Stoppage = 300 mins**

---

## 3️⃣ STEP-BY-STEP CALCULATION (LF1)

---

### 🔹 Step 1: Run Time & Work Time

```text
Run Time = 510 − 300 = 210 mins
Work Time = 210 mins
```

✔ Matches screen

---

### 🔹 Step 2: Utilization (UTI %)

```text
UTI = (210 / 510) × 100
UTI = 41.18 %
```

✔ Screen shows **41.18** ✅

---

### 🔹 Step 3: Standard Production (Std Prodn)

```text
Std Prodn =
Speed / 1693 / 0.0082 × 510 × 0.85 × Delivery
```

Substitute values:

```text
Std Prodn =
120 / 1693 / 0.0082 × 510 × 0.85 × 1
```

Step-by-step:

```text
120 / 1693 = 0.07088
0.07088 / 0.0082 = 8.644
8.644 × 510 = 4408.4
4408.4 × 0.85 = 3747.14 kg
```

✔ **Std Prodn = 3747.14 kg**
✔ Screen shows **3747.14** ✅

---

### 🔹 Step 4: Expected Production (Exp Prodn)

```text
Exp Prodn = Std Prodn × (Run Time / Total Time)
Exp Prodn = 3747.14 × (210 / 510)
Exp Prodn = 3747.14 × 0.4118
Exp Prodn = 1542.94 kg
```

✔ Screen shows **1542.94** ✅

---

### 🔹 Step 5: Actual Efficiency (Act Effi %)

```text
Act Effi = Actual Prodn / Exp Prodn × 100
Act Effi = 1568.85 / 1542.94 × 100
Act Effi = 101.68 %
```

✔ Screen shows **101.68** ✅

---

### 🔹 Step 6: Waste %

```text
Waste % = 0.85 / 1568.85 × 100
Waste % = 0.054 % ≈ 0.05 %
```

✔ Screen shows **0.05** ✅

---

## 4️⃣ FINAL VERIFICATION TABLE (LF1)

| Field      | Calculated | Screen  | Match |
| ---------- | ---------- | ------- | ----- |
| Run Time   | 210        | 210     | ✅     |
| Work Time  | 210        | 210     | ✅     |
| Std Prodn  | 3747.14    | 3747.14 | ✅     |
| Exp Prodn  | 1542.94    | 1542.94 | ✅     |
| Act Effi % | 101.68     | 101.68  | ✅     |
| UTI %      | 41.18      | 41.18   | ✅     |
| Waste %    | 0.05       | 0.05    | ✅     |

---

## ✅ FINAL CONCLUSION (VERY IMPORTANT)

* ✔ **All formulas are correct**
* ✔ **System calculations MATCH sample data exactly**
* ✔ **Lap Former logic is internally consistent**
* ✔ **Efficiency here = Actual / Expected (performance-based)**

> This module is **mathematically correct as implemented**.


