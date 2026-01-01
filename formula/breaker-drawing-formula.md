Perfect 👍
Now we are **FREEZING the logic exactly as you stated** and doing the **full calculation once again, cleanly and consistently**, for **Breaker Drawing – BD1**.

I will do this in **3 clear parts**:

1. **List ALL formulas (final & accepted)**
2. **List GIVEN values**
3. **Do step-by-step calculations for every field**

No assumptions, no corrections beyond what you approved.

---

# ✅ 1️⃣ FINAL FORMULAS TO BE USED (AS PER YOUR CONFIRMATION)

### 🔹 Breaker Drawing – Final Agreed Logic

```text
Std Prodn (Kg) =
Speed / 1693 / Hank × Total Time × Std Effi × Delivery

Exp Prodn (Kg) =
Std Prodn × (Work Time / Total Time)

Act Effi (%) =
Actual Prodn / Exp Prodn × 100

UTI (%) =
Work Time / Total Time × 100

Waste (%) =
Waste / Actual Prodn × 100

Work Time =
ENTERED SEPARATELY (NOT calculated from stoppages in schema)
Represents actual running time of machine

Run Time (display) =
Total Time (510) - displayed in grid as "Run Time"
```

✔️ This is the **exact logic now used**
✔️ We will calculate everything using this only
✔️ **Work Time** is a separate input field, NOT derived from stoppages in the INSERT

---

# ✅ 2️⃣ GIVEN VALUES (BD1 – FROM YOUR SCREENS)

### Machine / Master Data

* **Speed** = 450
* **Hank** = 0.14
* **Std Effi** = 85% = 0.85
* **Delivery** = 2

### Production (from EL Measure)

* **Act Hank** = 133.36
* **Actual Prodn** = 864.20 kg
* **Waste** = 0.85 kg

### Time

* **Total Time** = 510 mins
* **Stoppage 1** = 160 mins
* **Stoppage 2** = 60 mins
* **Stoppage 3** = 20 mins

---

# ✅ 3️⃣ STEP-BY-STEP CALCULATIONS

---

## 🔹 Step 1: Run Time & Work Time

```text
Total Stoppage = 160 + 60 + 20 = 240 mins

Run Time = 510 − 240 = 270 mins
Work Time = 270 mins
```

---

## 🔹 Step 2: Utilization (UTI %)

```text
UTI = (Run Time / Total Time) × 100
UTI = 270 / 510 × 100
UTI = 52.94 %
```

✔️ Matches screen

---

## 🔹 Step 3: Standard Production (Std Prodn)

```text
Std Prodn =
Speed / 1693 / Hank × Total Time × Std Effi × Delivery
```

Substitute values:

```text
Std Prodn =
450 / 1693 / 0.14 × 510 × 0.85 × 2
```

Step-by-step:

```text
450 / 1693 = 0.2658
0.2658 / 0.14 = 1.8986
1.8986 × 510 = 968.29
968.29 × 0.85 = 823.05
823.05 × 2 = 1646.10 ≈ 1646.06 kg
```

✅ **Std Prodn = 1646.06 kg**

---

## 🔹 Step 4: Expected Production (Exp Prodn)

```text
Exp Prodn = Std Prodn × (Run Time / Total Time)
```

```text
Exp Prodn = 1646.06 × (270 / 510)
Exp Prodn = 1646.06 × 0.5294
Exp Prodn = 871.44 kg
```

✅ **Matches screen exactly**

---

## 🔹 Step 5: Actual Efficiency (Act.Effi %)

```text
Act Effi % = Actual Prodn / Exp Prodn × 100
```

```text
Act Effi = 864.20 / 871.44 × 100
Act Effi = 99.17 %
```

✅ **Matches screen**

---

## 🔹 Step 6: Waste %

```text
Waste % = Waste / Actual Prodn × 100
```

```text
Waste % = 0.85 / 864.20 × 100
Waste % = 0.098 % ≈ 0.10 %
```

✅ **Matches screen**

---

# ✅ FINAL VERIFIED RESULT – BD1

| Field        | Calculated Value |
| ------------ | ---------------- |
| Act Hank     | 133.36           |
| Actual Prodn | 864.20 kg        |
| Std Prodn    | **1646.06 kg**   |
| Exp Prodn    | **871.44 kg**    |
| Act Effi %   | **99.17 %**      |
| UTI %        | **52.94 %**      |
| Waste        | 0.85 kg          |
| Waste %      | **0.10 %**       |
| Run Time     | 270 mins         |
| Work Time    | 270 mins         |


