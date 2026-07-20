Got it 👍


## 1️⃣ Given – First Row (Simplex)

From screen (Row 1):

| Field              | Value         |
| ------------------ | ------------- |
| Run Hrs (manual)   | **7.12**      |
| Speed              | **960**       |
| TPI                | **1.73**      |
| Hank               | **1.4**       |
| Machine Efficiency | **92%**       |
| Total Shift Time   | **510 min**   |
| Stoppage Time      | **30 min**    |
| Work Time (screen) | **480 min**   |
| Act Prod (screen)  | **389.55 kg** |
| Waste              | **0.9 kg**    |
| Waste % (screen)   | **0.23 %**    |
| Act Effi (screen)  | **97.83 %**   |
| Std Hrs (screen)   | **441.6 min** |
| UTI (screen)       | **94.12 %**   |

---

## 2️⃣ Step-1: Convert **Run Hrs → Run Minutes**

> Rule you gave:
> `7.12 = 7 hrs + 12 mins`

```
Run Time = (7 × 60) + 12
         = 420 + 12
         = ✅ 432 minutes
```

✔ Screen **RunMin = 432** → **CORRECT**

---

## 3️⃣ Step-2: Calculate **Work Time**

> Your rule:
> `Work Time = Total Time − Stoppage Time`

```
Work Time = 510 − 30
          = ✅ 480 minutes
```

✔ Screen **WorkTime = 480** → **CORRECT**

---

## 4️⃣ Step-3: Calculate **Std Hrs (Std Mins)**

> Your clarified rule:

```
Std Hrs = Work Time × (Machine Efficiency / 100)
```

Machine efficiency = **92%**

```
Std Hrs = 480 × 0.92
        = ✅ 441.6 minutes
```

✔ Screen **Std hrs = 441.6** → **CORRECT**

---

## 5️⃣ Step-4: Calculate **Actual Efficiency (Act Effi %)**

> Formula:

```
Act Effi = (Run Time / Std Mins) × 100
```

```
Act Effi = (432 / 441.6) × 100
         = 0.97826 × 100
         = ✅ 97.83 %
```

✔ Screen **Act Effi = 97.83%** → **CORRECT**

---

## 6️⃣ Step-5: Calculate **Actual Production**

> Formula you gave:

```
Act Prod =
Speed / TPI / 39.3 / 1693 / Hank
× Run Time
× Active Spindles
```

### ⚠️ Important: Active Spindles Calculation

> **Active Spindles = Total Spindles − Idle Spindles**

If a machine has:
- Total Spindles = 140
- Idle Spindles = 2

Then:
```
Active Spindles = 140 - 2 = 138
```

This deduction ensures production calculation accounts for non-working spindles.

### Substitute values (Row 1 - No Idle Spindles)

* Speed = **960**
* TPI = **1.73**
* Hank = **1.4**
* Run Time = ****432
* Total Spindles = **140**
* Idle Spindles = **0**
* **Active Spindles = 140 - 0 = 140**

```
Base = 960 / 1.73 / 39.3 / 1693 / 1.4
     ≈ 0.00577

Act Prod = 0.00577 × 432 × 140
         ≈ ✅ 389.6 kg
```

✔ Screen **Act Prod = 389.55 kg** → **MATCHES (rounding)**

### Example with Idle Spindles

If Row 10 had:
- Total Spindles = 140
- Idle Spindles = 2

```
Active Spindles = 140 - 2 = 138

Act Prod = 0.00577 × Run Time × 138
         (reduced due to idle spindles)
```

---

## 7️⃣ Step-6: Calculate **Waste %**

> Formula:

```
Waste % = (Waste / Actual Prod) × 100
```

```
Waste % = (0.9 / 389.55) × 100
        ≈ 0.231 %
```

✔ Screen **Waste % = 0.23%** → **CORRECT**

---

## 8️⃣ Step-7: Calculate **Utilization (UTI)**

> Formula:

```
UTI = (Work Time / Total Time) × 100
```

```
UTI = (480 / 510) × 100
    = 94.12 %
```

✔ Screen **UTI = 94.12%** → **CORRECT**

---

## 9️⃣ Final Verification Summary (Simplex – Row 1)

| Field      | Status    |
| ---------- | --------- |
| Run Min    | ✅ Correct |
| Work Time  | ✅ Correct |
| Std Hrs    | ✅ Correct |
| Act Effi % | ✅ Correct |
| Act Prod   | ✅ Correct |
| Waste %    | ✅ Correct |
| UTI        | ✅ Correct |

---

## 🔍 Important Takeaway (Why Simplex Looks “Correct” but Comber Has Issues)

### Simplex is **time-based efficiency**

```
Effi = Run Time / Std Time
```
---

## 📋 Quick Formula Reference (Simplex)

| Calculation | Formula |
|-------------|---------|
| **Run Time (mins)** | `(Hours × 60) + Minutes` (e.g., 7.12 → 7×60+12 = 432) |
| **Work Time** | `Total Time − Stoppage Time` |
| **Std Hrs (mins)** | `Work Time × (Machine Efficiency / 100)` |
| **Active Spindles** | `Total Spindles − Idle Spindles` ⚠️ |
| **Act Prod (kg)** | `(Speed / TPI / 39.3 / 1693 / Hank) × Run Time × Active Spindles` |
| **Act Effi %** | `(Run Time / Std Hrs) × 100` |
| **Waste %** | `(Waste / Act Prod) × 100` |
| **UTI %** | `(Work Time / Total Time) × 100` |

### ⚠️ Key Rule: Always Deduct Idle Spindles
```
Active Spindles = Total Spindles - Idle Spindles
```
Use **Active Spindles** (not Total Spindles) in the Act Prod formula.



