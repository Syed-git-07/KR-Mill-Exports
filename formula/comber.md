

## 🔹 CORRECT BASE DATA (as per your clarification)

| Item               | Value         |
| ------------------ | ------------- |
| **Total Time**     | 510 min       |
| **Total Stoppage** | **360 min** ✅ |
| **Work Time**      | **150 min** ✅ |
| MC Efficiency      | 0.93          |
| Act Hank           | 21.61         |
| Run Hrs (manual)   | 1.56          |
| Run Min (screen)   | 116           |
| Act Prodn          | 70.02         |
| Waste              | 0.96          |
| Hank               | 0.14          |

---

# ✅ STEP-BY-STEP VERIFICATION (ROW 1)

---

## 1️⃣ Work Time

You corrected this 👇

```
Work Time = Total Time − Total Stoppage
          = 510 − 360
          = 150 min
```

✔️ **Screen shows WorkTime = 150 → CORRECT**

---

## 2️⃣ Std Run Minutes (Std Hrs)

### Your defined formula (correct):

```
Std Run Mins = Work Time × MC Efficiency
             = 150 × 0.93
             = 139.5 min
```

✔️ **Screen shows Std Hrs = 139.5 → CORRECT**

👉 So **Std Hrs is NOT wrong**
Earlier confusion was only due to swapped WorkTime / Stoppage values.

---

## 3️⃣ Run Hrs → Run Minutes

Run Hrs is **manual HH.MM input**:

```
1.56 = 1 hour 56 minutes
Run Min = (1 × 60) + 56
        = 116 min
```

✔️ **RunMin = 116 → CORRECT**

---

## 4️⃣ Actual Efficiency (Act Effi %)

### Formula (correct):

```
Act Effi % = (Actual Run Min / Std Run Min) × 100
```

### Calculation:

```
Act Effi = (116 / 139.5) × 100
         = 83.15 %
```

✔️ **Screen shows Act Effi = 83.15 → CORRECT**

👉 **NO ISSUE in Act Effi formula**
👉 It becomes correct **only when WorkTime = 150 is used**

---

## 5️⃣ Constant

```
Constant = 1 / 2.20456 / Hank
         = 1 / 2.20456 / 0.14
         ≈ 3.240
```

✔️ Correct

---

## 6️⃣ Actual Production

```
Act Prod = Constant × Act Hank
         = 3.240 × 21.61
         = 70.02 kg
```

✔️ **Matches screen → Act Prodn is 100% CORRECT**

---

## 7️⃣ Waste %

```
Waste % = (Waste / Act Prod) × 100
        = (0.96 / 70.02) × 100
        = 1.37 %
```

✔️ **Matches screen**

---

## 8️⃣ Utilization (UTI %)

### Formula you defined:

```
UTI % = Work Time / Total Time × 100
```

### Calculation:

```
UTI = (150 / 510) × 100
    = 29.41 %
```

✔️ **Screen shows 29.41 → CORRECT**

---

# ✅ FINAL CONCLUSION (VERY IMPORTANT)

### ✔️ NOTHING IS WRONG IN COMBER FORMULAS

Once the **correct base meaning** is used:

| Field                | Status |
| -------------------- | ------ |
| Total Stoppage = 360 | ✅      |
| Work Time = 150      | ✅      |
| Std Hrs = 139.5      | ✅      |
| Run Min = 116        | ✅      |
| Act Effi % = 83.15   | ✅      |
| Act Prodn = 70.02    | ✅      |
| Waste %              | ✅      |
| UTI %                | ✅      |


