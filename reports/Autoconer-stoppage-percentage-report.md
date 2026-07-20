# Autoconer Stoppage Percentage Report

## Company
**Kayaar Exports Private Limited**

---

## Report Title Format
```
Stoppage Percentage Report For Autoconer From  [DD-MM-YYYY]  To  [DD-MM-YYYY]
```

> Supports a **date range** (From / To), unlike the Spinning Stoppage report which uses a single date.

---

## Visual Layout (from Smart Spin Lite)

```
                  Kayaar Exports Private Limited
   Stoppage Percentage Report For Autoconer From  05-05-2025  To  05-05-2025

+-------+------+------------------------------+-----------+------------+-------------+---------+
| SL No |      |           Reasons            | I Shift % | II Shift % | III Shift % | Total % |
+-------+------+------------------------------+-----------+------------+-------------+---------+
| CLEANING WORK                                                                                |
+-------+------+------------------------------+-----------+------------+-------------+---------+
|   1   |  CL  | DAILY CLEANING               |   12.77   |    0.00    |    0.00     |  4.26   |
|       |      | Total :                       |   12.77   |    0.00    |    0.00     |  4.26   |
+-------+------+------------------------------+-----------+------------+-------------+---------+
| MAINTEN. BREAKDOWN                                                                           |
+-------+------+------------------------------+-----------+------------+-------------+---------+
|   2   |  MB  | IDLE DRUM                    |    5.38   |    2.56    |    2.95     |  3.63   |
|       |      | Total :                       |    5.38   |    2.56    |    2.95     |  3.63   |
+-------+------+------------------------------+-----------+------------+-------------+---------+
| MAINTEN. ROUTINE                                                                             |
+-------+------+------------------------------+-----------+------------+-------------+---------+
|   3   |  MR  | FITTER WORK                  |    0.52   |    0.00    |    0.00     |  0.17   |
|       |      | Total :                       |    0.52   |    0.00    |    0.00     |  0.17   |
+-------+------+------------------------------+-----------+------------+-------------+---------+
| OTHERS                                                                                       |
+-------+------+------------------------------+-----------+------------+-------------+---------+
|   4   |  OT  | LUNCH TIME                   |    0.00   |   14.34    |    0.00     |  4.78   |
|   5   |  OT  | BSS                          |    7.54   |   34.47    |   33.39     | 25.13   |
|       |      | Total :                       |    7.54   |   48.81    |   33.39     | 29.91   |
+-------+------+------------------------------+-----------+------------+-------------+---------+
|       |      | Net Total :                   |   26.21   |   51.37    |   36.34     | 37.97   |
+-------+------+------------------------------+-----------+------------+-------------+---------+

    AM(P)                    GM                    M.D
```

---

## Column Structure

| # | Column | Description |
|---|---|---|
| 1 | SL No | Sequential number across all reasons |
| 2 | Code | Short code from `stoppage_details.short_code` (e.g., CL, MB, MR, OT) |
| 3 | Reasons | Reason name from `stoppage_details.stoppage_name` |
| 4 | I Shift % | Stoppage percentage for Shift 1 |
| 5 | II Shift % | Stoppage percentage for Shift 2 |
| 6 | III Shift % | Stoppage percentage for Shift 3 |
| 7 | Total % | Average percentage across all 3 shifts |

> **Header note**: "Reasons" in the visual header spans cols 2-3 (Code + Name), displayed as one merged header label.

---

## Row Structure

| Row Type | Description |
|---|---|
| **Category header** | Full-width shaded row showing the stoppage head name (e.g., `CLEANING WORK`) — bold |
| **Reason row** | One row per stoppage reason: SL No, Code, Name, S1%, S2%, S3%, Total% |
| **Total : row** | Subtotal row per category — sums shift % values across all reasons in that category |
| **Net Total : row** | Bottom row — column-wise sum of all category totals; overall average in Total% |

---

## Percentage Formula

```
Stoppage % (per reason, per shift) =
  SUM(stoppage_time for that reason across all machines in that shift)
  ------------------------------------------------------------------  x 100
  SUM(run_time of all autoconer machines in that shift)
```

### Total % per reason column
```
Total % = (I Shift % + II Shift % + III Shift %) / 3
```

### Category Total row
```
Category Total (per shift) = SUM of all reason % values in that category for that shift
```

### Net Total row
```
Net Total (per shift) = SUM of all category totals for that shift
Net Total (Total %)   = (Net S1% + Net S2% + Net S3%) / 3
```

### Verification with sample data
```
CLEANING WORK Total %  : (12.77 + 0.00 + 0.00) / 3  = 4.26   (correct)
OTHERS Shift 2 total   : 14.34 + 34.47              = 48.81  (correct)
Net Total %            : (26.21 + 51.37 + 36.34) / 3 = 37.97  (correct)
```

---

## Data Source

### Tables Used
| Table | Role |
|---|---|
| `autoconer_production_header` | `entry_date` (date range filter), `shift` |
| `autoconer_production_detail` | `run_time` (denominator for % calc) |
| `autoconer_stoppage_entry` | `stoppage1_id...stoppage4_id`, `stoppage1_time...stoppage4_time` |
| `stoppage_details` | `stoppage_name`, `short_code`, `stoppage_head_id` |
| `stoppage_heads` | `stoppage_head_name` (category group labels) |

### Relationships
```
autoconer_production_header.id
    --> autoconer_production_detail.header_id
           --> autoconer_stoppage_entry.production_detail_id
                  --> stoppage_details (via stoppage1_id ... stoppage4_id)
                         --> stoppage_heads (via stoppage_head_id)
```

### SQL Query (conceptual)
```sql
SELECT
  sh.stoppage_head_name                                 AS category,
  sd.short_code                                         AS code,
  sd.stoppage_name                                      AS reason,
  h.shift,
  SUM(
    CASE WHEN se.stoppage1_id = sd.id THEN COALESCE(se.stoppage1_time, 0) ELSE 0 END +
    CASE WHEN se.stoppage2_id = sd.id THEN COALESCE(se.stoppage2_time, 0) ELSE 0 END +
    CASE WHEN se.stoppage3_id = sd.id THEN COALESCE(se.stoppage3_time, 0) ELSE 0 END +
    CASE WHEN se.stoppage4_id = sd.id THEN COALESCE(se.stoppage4_time, 0) ELSE 0 END
  )                                                     AS total_stoppage_time,
  SUM(pd.run_time)                                      AS total_run_time
FROM autoconer_production_header h
JOIN autoconer_production_detail pd  ON pd.header_id            = h.id
JOIN autoconer_stoppage_entry se     ON se.production_detail_id = pd.id
JOIN stoppage_details sd             ON sd.id IN (
    se.stoppage1_id, se.stoppage2_id, se.stoppage3_id, se.stoppage4_id
  )
JOIN stoppage_heads sh               ON sh.id = sd.stoppage_head_id
WHERE h.entry_date BETWEEN :fromDate AND :toDate
  AND sd.is_active = 1
GROUP BY sh.code, sh.stoppage_head_name, sd.id, sd.short_code, sd.stoppage_name, h.shift
ORDER BY sh.code ASC, sd.code ASC, h.shift ASC;
```

> For a multi-day range the report **sums** all stoppages and run times across all days, then computes the combined percentage.

---

## Report Data Model (JavaScript)

```js
{
  dateRange: {
    from: '05-May-25',
    to:   '05-May-25'
  },
  reportData: [
    {
      headName: 'CLEANING WORK',          // stoppage_heads.stoppage_head_name
      shifts: {
        1:     { percentage: 12.77 },
        2:     { percentage: 0.00  },
        3:     { percentage: 0.00  },
        total: { percentage: 4.26  }
      },
      details: [
        {
          slNo:       1,
          code:       'CL',               // stoppage_details.short_code
          reasonName: 'DAILY CLEANING',   // stoppage_details.stoppage_name
          shifts: {
            1:     { percentage: 12.77 },
            2:     { percentage: 0.00  },
            3:     { percentage: 0.00  },
            total: { percentage: 4.26  }
          }
        }
        // ...more reasons in this category
      ]
    },
    // ...more categories
  ],
  netTotal: {
    1:     { percentage: 26.21 },
    2:     { percentage: 51.37 },
    3:     { percentage: 36.34 },
    total: { percentage: 37.97 }
  }
}
```

---

## Route
```
/reports/autoconer/stoppage-percentage
```

---

## PDF Output
- **Orientation**: Portrait (A4)
- **Header**: Company name (bold, centered) -> Report title -> Date range
- **Table**:
  - Category header rows: full-width bold shaded row (e.g., `CLEANING WORK`)
  - Reason rows: SL No | Code | Reason Name | I Shift % | II Shift % | III Shift % | Total %
  - "Total :" rows: bold, subtotals per shift
  - "Net Total :" row: bold, blue-100 shaded
- **Footer**: `AM(P)` . `GM` . `M.D` on each page

---

## Notes
- Report uses a **date range** (From / To), not a single date
- Only **active** stoppage reasons (`stoppage_details.is_active = 1`) are shown
- Reasons with zero stoppages in all shifts are still displayed (matches Smart Spin Lite behavior)
- `short_code` values: `CL` (Cleaning Work), `MB` (Maint. Breakdown), `MR` (Maint. Routine), `OT` (Others)
- Footer signature order: **AM(P) . GM . M.D**
- The "Reasons" column header in the table visually spans the Code + Reason Name sub-columns
