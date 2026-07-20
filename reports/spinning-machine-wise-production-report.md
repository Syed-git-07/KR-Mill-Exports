# Spinning Machine-wise Production Report

## Company
**Kayaar Exports Private Limited**

---

## Report Title Format
```
Spinning Machine wise Production  from  [DD-MM-YYYY]  To  [DD-MM-YYYY]
```

---

## Visual Layout (from Smart Spin Lite)

```
                  Kayaar Exports Private Limited
   Spinning Machine wise Production  from  05-05-2025  To  05-05-2025

+--------+-----------+-----------+-----------+-----------+-----------+-----------+--------+
| McName |   SHIFT-1 |           |   SHIFT-2 |           |   SHIFT-3 |           | Total  |
|        |   Std.    |   Act.    |   Std.    |   Act.    |   Std.    |   Act.    |        |
+--------+-----------+-----------+-----------+-----------+-----------+-----------+--------+
| RF1    |   59.58   |   59.39   |   59.58   |   60.56   |   59.58   |   59.84   | 59.93  |
| RF2    |   59.35   |   58.80   |   59.35   |   60.37   |   59.35   |   59.33   | 59.50  |
|  ...   |    ...    |    ...    |    ...    |    ...    |    ...    |    ...    |  ...   |
| TOTAL  |   49.32   |   49.32   |   49.32   |   49.01   |   48.59   |   49.35   | 48.98  |
+--------+-----------+-----------+-----------+-----------+-----------+-----------+--------+

    M.D                     GM                     AM(P)
```

---

## Column Structure

| # | Header Group | Sub-column | Full Label | Description |
|---|---|---|---|---|
| 1 | McName | — | Machine Name | Machine name (e.g., RF1, RF2 … RF47, RF1A, RF2A) |
| 2 | SHIFT-1 | Expected G.P.S | Expected G.P.S | Expected Grams Per Spindle for Shift 1 (`exp_gps`) |
| 3 | SHIFT-1 | Achieved G.P.S | Achieved G.P.S | Achieved Grams Per Spindle for Shift 1 (`gps`) |
| 4 | SHIFT-2 | Expected G.P.S | Expected G.P.S | Expected Grams Per Spindle for Shift 2 (`exp_gps`) |
| 5 | SHIFT-2 | Achieved G.P.S | Achieved G.P.S | Achieved Grams Per Spindle for Shift 2 (`gps`) |
| 6 | SHIFT-3 | Expected G.P.S | Expected G.P.S | Expected Grams Per Spindle for Shift 3 (`exp_gps`) |
| 7 | SHIFT-3 | Achieved G.P.S | Achieved G.P.S | Achieved Grams Per Spindle for Shift 3 (`gps`) |
| 8 | Total | — | Total | Average of Achieved G.P.S across 3 shifts: `(Act1 + Act2 + Act3) / 3` |

> **G.P.S** = Grams Per Spindle per hour.
> - **Std.** = Expected G.P.S → sourced from `spinning_production_detail.exp_gps`
> - **Act.** = Achieved G.P.S → sourced from `spinning_production_detail.gps`

---

## Row Structure

| Row Type | Description |
|---|---|
| Machine row | One row per active machine, ordered by `sort_order` |
| **TOTAL** | Bottom row: Average Std & Act GPS across all machines for each shift column; overall average in Total |

---

## Data Source

### Tables Used
| Table | Role |
|---|---|
| `spinning_production_header` | `entry_date`, `shift` |
| `spinning_production_detail` | `exp_gps` (Expected G.P.S / Std.), `gps` (Achieved G.P.S / Act.) |
| `spinning_machines` | `machine_no`, `sort_order`, `is_active` |

### Relationships
```
spinning_production_header.id  <-->  spinning_production_detail.header_id
spinning_machines.id           <-->  spinning_production_detail.machine_id
```

### SQL Query
```sql
SELECT
  m.machine_no,
  m.sort_order,
  h.shift,
  ROUND(AVG(d.exp_gps), 2) AS expected_gps,   -- Std. (Expected G.P.S)
  ROUND(AVG(d.gps),     2) AS achieved_gps    -- Act. (Achieved G.P.S)
FROM spinning_production_header h
JOIN spinning_production_detail d ON d.header_id = h.id
JOIN spinning_machines m           ON d.machine_id = m.id
WHERE h.entry_date BETWEEN :fromDate AND :toDate
  AND m.is_active = 1
GROUP BY m.machine_no, m.sort_order, h.shift
ORDER BY m.sort_order ASC, m.machine_no ASC, h.shift ASC;
```

> For a single-day report, `AVG()` collapses to a single value.
> For a multi-day range, the report averages GPS across all days in the range for each machine � shift.

---

## Report Data Model (JavaScript)

```js
{
  dateRange: {
    from: '05-May-25',
    to:   '05-May-25'
  },
  machines: [
    {
      machineNo:  'RF1',
      sortOrder:  1,
      shift1: { std: 59.58, act: 59.39 },   // std = Expected G.P.S, act = Achieved G.P.S
      shift2: { std: 59.58, act: 60.56 },
      shift3: { std: 59.58, act: 59.84 },
      total:  59.93    // avg of Achieved G.P.S across 3 shifts
    },
    // ...one entry per machine
  ],
  totals: {
    shift1: { std: 49.32, act: 49.32 },
    shift2: { std: 49.32, act: 49.01 },
    shift3: { std: 48.59, act: 49.35 },
    total:  48.98      // overall average
  }
}
```

---

## Raw Data Observed (from Smart Spin Lite export)

The legacy export order per row is:
```
McName  Act1  Act2  Act3  AvgTotal  Std1  Std2  Std3
```

Example � RF1:
```
RF1  59.39  60.56  59.84  59.93  59.58  59.58  59.58
```
Display re-ordering for the table: `McName | Std1 | Act1 | Std2 | Act2 | Std3 | Act3 | Total`

---

## Route
```
/reports/spinning/machine-wise-production
```

---

## PDF Output
- **Orientation**: Landscape (A4) � 8 columns need width
- **Header**: Company name (bold, centered) ? Report title ? Date range
- **Table**: Merged column headers (SHIFT-1 spanning Std+Act), machine rows, Total row (bold, shaded)
- **Footer**: `M.D` � `GM` � `AM(P)` on each page

---

## Notes
- Report covers **all active spinning machines** regardless of whether data exists (machines with no entry show 0.00)
- `exp_gps` → **Expected G.P.S** (Std.) and `gps` → **Achieved G.P.S** (Act.) both come from `spinning_production_detail`
- Machines RF28�RF34 show 0.00 for all columns ? idle / no data entered for those machines on that date
- Machine list: RF1�RF47, RF1A, RF2A (49 machines total)
- Multi-day range: GPS values are averaged across all days in the range
