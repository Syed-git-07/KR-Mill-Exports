# Kayaar Exports Private Limited
## Autoconer Production Report
**Date:** 09-02-2026

---

## Report Structure
- **Columns (1-13):** Machine Groups (AC1 to AC13)
- **Rows (1-5):** Machine Numbers within each group
- **Count:** 68 COMBED STAR (68 CS)
- **Values:** Actual Production in Kg

---

### Shift I Production Data
| Machine | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| | **68 CS** | **68 CS** | **68 CS** | **68 CS** | **68 CS** | **68 CS** | **68 CS** | **68 CS** | **68 CS** | **68 CS** | **68 CS** | **68 CS** | **68 CS** |
| **1** | 131.59 | 157.23 | 109.67 | 109.22 | 150.41 | 100.83 | 154.81 | 152.87 | 155.34 | 136.26 | 135.01 | 136.96 | 126.35 |
| **2** | 131.59 | 114.82 | 149.21 | 153.81 | 106.25 | 126.28 | 144.35 | 139.25 | 159.96 | 151.40 | 143.06 | 149.19 | 129.28 |
| **3** | | | 108.34 | 101.39 | 124.24 | 114.68 | 106.40 | 142.18 | | | | | |
| **4** | | | 149.72 | 126.87 | 138.23 | 146.00 | 149.97 | 158.29 | | | | | |
| **5** | | | 104.23 | 111.41 | 135.00 | 130.64 | 111.86 | 124.27 | | | | | |
| **Group Total** | **263.18** | **272.05** | **621.17** | **602.70** | **654.13** | **618.43** | **667.39** | **716.86** | **315.30** | **287.66** | **278.07** | **286.15** | **255.63** |

---

### Database Query Used:
```sql
SELECT 
  am.group_id, 
  am.machine_no, 
  ROUND(SUM(apd.act_prodn), 2) as total_prodn 
FROM 
  autoconer_production_detail apd
JOIN autoconer_production_header aph ON apd.header_id = aph.id
JOIN autoconer_machines am ON apd.machine_id = am.id
WHERE 
  aph.entry_date = '2026-02-09' AND aph.shift = 1
GROUP BY am.group_id, am.machine_no
ORDER BY am.group_id, am.machine_no;
```

---

### Notes:
- Data shown is for **Shift 1 only** on 09-Feb-2026
- Groups 1-2: 2 machines each
- Groups 3-8: 5 machines each
- Groups 9-13: 2 machines each
- All machines producing **68 COMBED STAR** count
- Total machines active: 44

---

### Shift-wise Data Requirements:
For complete report generation, need to query:
1. Shift 1 data (shown above)
2. Shift 2 data (query with `aph.shift = 2`)
3. Shift 3 data (query with `aph.shift = 3`)

---

**AM(P)          GM          MD**
