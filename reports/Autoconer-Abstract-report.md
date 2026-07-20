# Kayaar Exports Private Limited
## Autoconer Abstract Report — 05-05-2025

---

### Section 1 — Shift-wise Abstract (As on Date + Upto Date)

This section has two halves side-by-side, both sharing a single bordered table:

**Left half heading:** `Autoconer Abstract Report as on   05-05-2025`
**Right half heading:** `Autoconer Abstract Upto   05-05-2025`

| SHIFT  | PROD(KGS) | EFFI  | RED Light | UTTI  | PROD(KGS) | EFFI  | RED Light | UTTI  |
|:-------|----------:|------:|----------:|------:|----------:|------:|----------:|------:|
| 1.00   | 3078.00   | 83.64 | 1.18      | 88.49 | 14636.00  | 82.59 | 1.21      | 92.05 |
| 2.00   | 2584.00   | 83.49 | 1.21      | 88.79 | 12873.00  | 82.76 | 1.16      | 86.16 |
| 3.00   | 2403.00   | 84.36 | 1.13      | 97.75 | 12051.00  | 82.62 | 1.88      | 91.89 |
| **TOTAL :** | **8065.00** | **83.83** | **1.17** | **91.68** | **39560.00** | **82.66** | **1.42** | **90.03** |

#### Column Definitions

- **SHIFT** — Shift number (1.00 = Shift I, 2.00 = Shift II, 3.00 = Shift III)
- **PROD(KGS)** — Actual production in KGs for that shift
  - Formula: Sum of `actual_production` across all autoconer machines for that shift on the selected date
  - TOTAL = sum of all three shifts
- **EFFI (%)** — Efficiency percentage for that shift
  - Formula: `(Actual Production / Expected Production) × 100`
  - Expected Production = sum of `exp_production` across all machines for that shift
  - TOTAL = average efficiency across all three shifts weighted by production
- **RED Light (%)** — Red light time percentage (machine idle / fault indicator)
  - Formula: `(Total red_light_time across all machines in shift / Total shift_run_time across all machines) × 100`
  - TOTAL = average of three shifts
- **UTTI (%)** — Utilization percentage (drum/spindle utilization)
  - Formula: `(Total utti_time across all machines in shift / Total possible_time across all machines) × 100`
  - TOTAL = average of three shifts
- **Upto Date columns** — Same four metrics but cumulative from the 1st of the month to the selected date (sum/average across all days)

---

### Section 2 — Count-wise Abstract (Upto Date)

**Heading:** `Autoconer Count Abstract Upto   05-05-2025`

Two tables side by side:

#### Left table — ON DATE

| CountName      | Prodnkgs | Effi  |
|:---------------|---------:|------:|
| 68 COMBED STAR | 8065.00  | 83.82 |
| **Total**      | **8,065.00** | **83.82** |

- **CountName** — Yarn count name (e.g., 68 COMBED STAR)
- **Prodnkgs** — Total actual production (KGs) for that count on the selected date (all shifts combined)
  - Formula: Sum of `actual_production` for all machines running that count on the selected date
- **Effi** — Average efficiency for that count on the selected date (all shifts combined)
  - Formula: `(Sum of actual_production / Sum of exp_production) × 100` for that count on the selected date
- **Total row** — Sum of Prodnkgs; weighted average of Effi across all counts

#### Right table — UP TO DATE

| CountName      | UProdnkgs  | UEffi |
|:---------------|-----------:|------:|
| 68 COMBED STAR | 39,560.00  | 82.66 |
| **Total**      | **39,560.00** | **82.66** |

- **UProdnkgs** — Cumulative actual production (KGs) for that count from 1st of month to selected date
- **UEffi** — Cumulative average efficiency for that count from 1st of month to selected date
  - Formula: `(Sum of actual_production / Sum of exp_production) × 100` across all days for that count
- **Total row** — Sum of UProdnkgs; weighted average of UEffi across all counts

---

**AM(P)          GM          M.D**

---
**Report generated for Kayaar Exports Private Limited**
