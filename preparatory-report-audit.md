# Preparatory report template audit

Reviewed 6 September 2026 against all six PDFs in `C:\Users\afzal\OneDrive\Documents\PREPARATORY REPORTS`.

Original audit verdict: the reports were not fully template-compatible. Most columns existed, but several data mappings and aggregation formulas differed. This was a source-code and PDF arithmetic review, not a comparison against live database output. The PDFs contain printed results, not their original formulas or input workbooks. The numbered findings below preserve that original review; see the implementation and verification status at the end for changes subsequently made.

## Coverage

| Template | Implementation | Result |
| --- | --- | --- |
| PREPARATORY ABSTRACT.pdf | `src/lib/reports/finalReportQueries.js`, `preparatoryAbstract` | Columns largely match; production/time mappings, Simplex Hank, percentage aggregation and date presentation need fixes. |
| PREPARATORY ALL SIDERS PERFORMANCE REPORT.pdf | `src/lib/queries/preparatorySiderPerformanceReportQueries.js` and corresponding report page | Columns match; efficiency/utilization averaging and employee ordering do not. |
| PREPARATORY PARTICULAR SIDER REPORT.pdf | `src/lib/reports/finalReportQueries.js`, `preparatoryParticularSider` | Columns match; currently emits machine detail rows instead of one employee/date/shift row per department. |
| PREPARATORY SHIFT WISE PRODUCTION REPORT.pdf | `src/lib/reports/finalReportQueries.js`, `preparatoryShiftProduction` | Columns largely match; wrong standard-production source, Simplex values, units and footer averages. |
| PREPARATORY STOPPAGE PERCENTAGE REPORT.pdf | `src/lib/queries/preparatoryStoppageReportQueries.js` and corresponding report page | Core shift-percentage formulas match the sample; historical fetching, denominator fallback, rounding and presentation need attention. |
| PREPARATORY WASTE ABSTRACT REPORT.pdf | `src/lib/queries/preparatoryWasteReportQueries.js` and corresponding report page | Column order and department totals layout match; month-to-date boundary is wrong on an India-time server. Percentage basis cannot be certified from these PDFs. |

## 1. Standard-production column fetches the wrong field

Location: `src/lib/reports/finalReportQueries.js:9-15`, shared by Abstract and Shift Wise Production.

For Carding, Breaker Drawing, Lap Former and Finisher Drawing, the report selects `std_prodn`. The production calculation code distinguishes full allocated-time `std_prodn` from stoppage-adjusted `exp_prodn` and calculates efficiency as `act_prodn / exp_prodn * 100`.

The shift PDF's CA1 row shows production 177.48, standard 179.44 and efficiency 98.91%. `177.48 / 179.44 * 100 = 98.91%`. The template column therefore represents the efficiency denominator, corresponding to `exp_prodn`, rather than the unadjusted full-time standard.

Fix: fetch/display/sum `exp_prodn` for those four departments in template reports. Keep the full-time baseline in entry calculations. Confirm the same mapping with the Abstract's source records before final numerical sign-off.

Supporting implementation: `src/lib/productionFormulaMath.js`, `calculateTimeAdjustedProductionMetrics`; Carding stoppage save explicitly persists both fields at `src/lib/queries/cardingEntryQueries.js:775-778`. Breaker, Finisher and Lap Former also persist both.

## 2. Simplex columns are not mapped to the template's quantities

Location: `src/lib/reports/finalReportQueries.js:87-92,112-139,313-337`.

The shift report does not select a Simplex `act_hank` (that field does not exist), but still reads it through the generic mapping; consequently its Hank column becomes zero. Abstract instead sums setup `sl_hank`, a material parameter rather than the time quantity evident in the shift sample.

The Simplex sample demonstrates a different legacy use of the column headings. Machine 1 shows Hank 1.07, Std.Hk/Prod 1.05, efficiency 97.83%, utilization 13.73%, and 440 stopped minutes. With a 510-minute allocation and 92% machine efficiency:

- Working time = 70 minutes.
- Standard time = `70 * 0.92 = 64.4` minutes = 1.0733 decimal hours, printed as 1.07 in Hank.
- Actual running time = 63 minutes = 1.05 decimal hours, printed under Std.Hk/Prod.
- Efficiency = `63 / 64.4 * 100 = 97.83%`.

Fix for the shift template: fetch `run_min` and `std_hrs`; map Simplex Hank to `std_hrs / 60`, and Std.Hk/Prod to `run_min / 60`. Sum the underlying quantities before rounding. Do not use setup `sl_hank` as the report total. The Abstract's Simplex mapping should be checked against its 30-Apr source records; these PDFs alone do not prove its exact mapping, although summing material hank is inconsistent with the shift example.

The template also shows an unlabeled Simplex value 1 on machine 4 and in the total row. This may correspond to idle spindles, but its meaning requires the original report definition; it should not be assigned a meaning solely from the PDF.

## 3. Time is stored in minutes but printed without conversion

Location: `src/lib/reports/finalReportQueries.js:13-15,140`; `src/lib/utils/simplexCalculations.js`; `src/lib/queries/comberEntryQueries.js:1300-1338`.

Despite its name, `std_hrs` is calculated and stored as `work_time * efficiencyFactor`, in minutes. The report currently displays it directly. The template uses hour-scale numbers, such as Comber 6.39 and Simplex 1.07, and corresponding hour-scale totals.

Fix: use explicit report-unit conversion, dividing minute quantities by 60 for decimal hours. Do not treat the input `run_hrs` HH.MM encoding as decimal hours: 7.45 input means 465 minutes, or 7.75 decimal hours. For Comber, verify whether the legacy column is standard or actual running hours against its original inputs; the PDF does not expose the machine efficiency/run-time inputs required to prove that choice.

## 4. Percentage averaging is demonstrably different

Locations: `src/lib/reports/finalReportQueries.js:188-192,226-229,307,334`; `src/lib/queries/preparatorySiderPerformanceReportQueries.js:107-133`.

Current code weights efficiency and utilization by production kilograms. Recalculation of every machine row in the shift PDF shows that its department totals are arithmetic means:

| Department | PDF Effi | Current weighting applied to PDF rows | PDF UTI | Current weighting applied to PDF rows |
| --- | ---: | ---: | ---: | ---: |
| Carding | 98.70 | 98.81 | 63.41 | 67.60 |
| Breaker Drawing | 97.39 | 97.87 | 66.18 | 77.61 |
| Lap Former | 99.81 | 99.59 | 38.56 | 41.09 |
| Comber | 96.49 | 97.29 | 81.30 | 86.71 |
| Finisher Drawing | 98.51 | 98.46 | 66.11 | 69.30 |
| Simplex | 98.14 | 98.11 | 79.71 | 86.68 |

Carding's 22 rows all belong to Gomathi B. The All Siders PDF reports the same 98.70% efficiency and 63.41% utilization for that employee, independently confirming that production weighting is wrong there too.

Fix: use arithmetic means at the template's machine-record grouping level for shift department and employee/date/shift efficiency and utilization. Keep kilogram totals as sums. Define how split runs contribute before treating every run row as a separate machine. Apply a preparatory-specific aggregator rather than changing the generic `weighted` helper used by unrelated reports.

Abstract daily/month-to-date and Particular Sider period totals need the original aggregation rules or source records to establish their weighting across dates. For example, simply averaging the five printed Particular Sider daily efficiency numbers gives 100.82, not its printed 100.65. Do not replace every percentage with an average of already-aggregated daily rows. Waste percentages also require a separate rule.

## 5. Particular Sider has the wrong row granularity

Location: `src/lib/reports/finalReportQueries.js:290-308`.

The PDF has one Comber row per date/shift for Gayathri S: five rows for 1-5 May. Current code maps each production detail directly into a report row. An employee operating several machines receives repeated date/shift rows, with no machine column to distinguish them. Detail fetching also has no explicit chronological ordering.

Fix: group by payroll employee ID, department, date and shift; aggregate the underlying machine records; sort by date then shift; calculate department totals from the appropriate underlying records. Preserve payroll ID identity instead of grouping people by matching names.

## 6. Waste month-to-date can include the next day

Location: `src/lib/queries/preparatoryWasteReportQueries.js:89-97`; normalized input comes from `src/app/actions/preparatory-reports.js`.

The action sets the end date to 23:59:59 UTC. The query then calls local `getFullYear/getMonth/getDate`. Reproduced with Node using Asia/Calcutta: `2025-05-05T23:59:59Z` has local day 6. Selecting 5 May therefore makes Up To include 6 May on that server. At month end, it can select the following month altogether.

Fix: use UTC getters consistently for the normalized date, or pass a date-only string and construct both boundaries once. Verify 5 May and 31 May in both UTC and Asia/Calcutta. Also standardize the Calendar-Date-to-server handling: local Date objects interpreted in a different server timezone can shift the selected day.

## 7. Stoppage formulas largely match; fetching has gaps

Location: `src/lib/queries/preparatoryStoppageReportQueries.js:169,204-205,297-307,348-358,387-407`.

Correct: per-shift stoppage percentage uses stopped minutes divided by available machine minutes. Total is the arithmetic mean of the three shift percentages. Carding Daily Cleaning `(21.35 + 0 + 25) / 3 = 15.45`, matching the PDF. Do not replace this with pooled-minute weighting if template compatibility is the requirement. Production rows without stoppage entries already contribute denominator time, which is appropriate.

Fixes:

- Fetch historically referenced stoppage heads/reasons even if now inactive; current active-only filters silently remove historical stoppages.
- For Comber, prefer recorded header `total_time` or an appropriate historical allocation. Current code omits header total time, uses current active shift configuration, and finally defaults to 510 even for shift 3. Multiple run details also need an explicit allocation rule to avoid counting a full shift for each run.
- Do not silently omit unmapped categories. Use stable category IDs/codes and surface unknown mappings.
- Calculate net totals from unrounded figures, rounding once for display. The sample Comber category totals add to 33.39 while its net is 33.38; current code sums rounded category totals.
- A department query failure must remain visibly incomplete. The query currently substitutes zero totals; the Abstract turns that into 100% utilization. Propagate the error instead.

## 8. Waste percentages cannot be certified from the supplied samples

Location: `src/lib/queries/preparatoryWasteReportQueries.js:77,181-186` and All Siders percentage aggregation.

The implementation uses `sum(wasteKg) / sum(act_prodn) * 100` for Waste Abstract, with preparatory totals calculated from summed waste and production. That is internally coherent, but these PDFs do not establish that it is the legacy rule.

For the same printed date, Carding All Siders production sums to 7,902.88 kg. The Waste Abstract shows 13.29 kg and 0.19%, whereas `13.29 / 7902.88 * 100 = 0.17%` rounded. The difference could reflect averaging, report scope, or different data snapshots. Other department figures also do not settle a single rule.

Required next validation: obtain the original waste percentage expression and the underlying same-snapshot machine rows; establish whether it is a mean of machine waste percentages or a ratio of totals, and which machines/records are included. Do not claim the current formula matches, or replace it with an unproven alternative. For ratio-of-totals calculations, sum raw waste kilograms rather than reweighting rounded stored waste percentages.

## 9. Filtering and presentation differences

- **Abstract:** template is an as-on date plus cumulative values. UI accepts a date range, while the custom heading prints only To Date and hides the range metadata. Either restrict it to one report date or visibly label period totals. Month-to-date interpretation of Up needs business confirmation from source definitions.
- **Shift report:** no shift selector exists. Add an optional/required shift filter matching the single-shift template, pass it to header queries, and organize date/shift before department. It currently fetches all shifts and builds groups department-first.
- **Shift report:** fetch stoppage names as well as codes and emit the code-to-description legend shown in the PDF. For Simplex, derive numeric stoppage totals from slots if retaining the extra footer total; its nonexistent `total_stoppage_mins` currently becomes zero. The template footer does not require that numeric stoppage total.
- **All Siders:** template is alphabetical within department; current query sorts production descending (`preparatorySiderPerformanceReportQueries.js:138`). Sort name, with token/ID tie-breakers. Its columns, department order, payroll token/DOJ mapping and continuous serial numbering otherwise correspond.
- **Stoppage:** serial numbers currently restart within each category (`stoppage-percentage/page.jsx:130` and screen equivalent); PDF numbers continuously from 1 to 30. Sort categories/reasons explicitly to match template order.
- **Signatures:** All Siders, Particular Sider and Shift templates use AM(P), DGM, DIRECTOR; current outputs use GM/MD or combined alternatives. Waste template has no signature block but the app adds one. Adjust per template if exact presentation is required.

## Verification required after fixes

Use fixtures from the original source rows, without changing production records: reproduce all six shift footer values above, Gomathi's employee totals, Gayathri's five grouped rows, Simplex 1.07/1.05 and 97.83%, historical inactive stoppages, zero-stoppage machines, split runs, and May 5/month-end cumulative boundaries. Compare browser and downloaded PDF values. The original machine settings and same-snapshot data are still required to certify upstream production constants, waste percentages and cumulative aggregation.

## Implementation and verification status

Only the preparatory-report fixes supported by this audit were implemented. Production-entry formulas, machine defaults, database records, schema, dependencies, and non-preparatory report calculations were not changed in this task. The pre-existing one-line Prisma schema edit belongs to the earlier schema-validation fix.

### Implemented

- **Finding 1:** the four kilogram-based standard columns now fetch `exp_prodn` in preparatory report builders.
- **Findings 2-3:** the shift report's Simplex columns use `std_hrs / 60` and `run_min / 60`; Comber's existing standard-time field is converted from minutes to decimal hours. The Abstract's standard-time values also receive the unit conversion.
- **Finding 4:** shift footer and all-siders efficiency/utilization now average the underlying stored detail percentages. The particular-sider daily/shift rows use the same averaging. Production sums and the shared weighting helper for other report families are unchanged. These means count each stored run detail once; a different legacy weighting for split runs remains unverified.
- **Finding 5:** particular-sider rows group by the selected payroll employee, department, date and shift, and sort chronologically.
- **Finding 6:** preparatory Calendar selections are sent as date-only strings; action normalization and waste month-to-date boundaries use UTC consistently.
- **Finding 7:** historical reasons/categories are fetched even when inactive. Comber counts each header/machine allocation once, preferring recorded header time and using a 420-minute night fallback when no historical/configured time exists. Department nets round after summation. Missing/unmapped stoppage definitions and department failures now fail the report rather than silently presenting zero stoppage. The existing supported category-name mapping is retained; unknown categories are explicitly rejected rather than guessed.
- **Finding 9:** shift filtering, date/shift/department ordering, stoppage legends, alphabetical all-siders ordering, continuous stoppage serial numbers, explicit Abstract period labels, and the audited signature changes are implemented. The extra numeric shift stoppage footer was removed, matching the template's blank cell.

### Verification performed

- Added `tests/fixtures/preparatory-shift-template.json`: 59 machine rows extracted from the supplied shift PDF. Values are printed PDF values, not original database rows.
- Added `tests/preparatory-report-template.test.mjs`: real query modules run with read-only mocked Prisma fixtures. Some database fields are reconstructed to test mapping and units; these tests do not independently prove upstream production formulas.
- Verified all six printed shift efficiency/utilization totals: Carding **98.70 / 63.41**, Breaker **97.39 / 66.18**, Lap Former **99.81 / 38.56**, Comber **96.49 / 81.30**, Finisher **98.51 / 66.11**, Simplex **98.14 / 79.71**.
- Verified Gomathi's **4,066.57 kg**, **98.70% efficiency**, **63.41% utilization** and the Simplex **64.4 minutes / 63 minutes -> 1.07 / 1.05 hours** mapping.
- Verified five chronological particular-sider date/shift rows using a synthetic multi-machine fixture. This verifies grouping, not Gayathri's actual five-day source totals.
- Verified May 5 and May 31 month-to-date boundaries under both UTC and Asia/Calcutta, inactive historical stoppages, zero-stoppage denominator contributions, Comber split-run denominator handling, net rounding, invalid category rejection, and shift filtering.
- Compiled and rendered all six real report page bodies with Next/SWC and React static rendering using injected report data. Executed the real PDF generators and checked screen/PDF values and relevant headings/signatures. This is component rendering, not a logged-in browser or live-database end-to-end test.
- Focused preparatory suite: **11 tests passed**. Final full repository run: **245 tests passed**, with no failures (`node --test --test-reporter=dot tests/*.test.mjs`).
- ESLint found no errors in the changed JavaScript files. The existing ESLint configuration ignores JSX; the SWC compilation/render tests cover those changed page bodies instead.
- Diff review confirmed that the non-preparatory builders and generic weighted calculation in the shared report query file are unchanged. `git diff --check` passed.

### Remaining alignment limits

Full template equivalence is **not certified**. As required by the audit, no replacement formula was invented for:

- Waste percentages (Finding 8): existing formulas retained.
- Abstract and particular-sider cumulative/period weighting (Finding 4): existing weighting retained.
- Abstract Simplex Hank (Finding 2): existing setup-hank mapping retained pending the original definition; it should not be considered verified.
- Comber standard versus actual time (Finding 3): unit conversion is fixed, but the existing `std_hrs` source choice still needs original input data.
- The unlabeled Simplex value in the PDF and legacy split-run percentage weighting.

The PDF generators emit table-width warnings for the existing dedicated page column widths (5 mm for all-siders, 2 mm for waste, 17 mm for stoppage with the test fixtures). Those width settings predate this task and were not changed because they were not listed as a fix in the audit. Exact pagination and visual equivalence remain unverified. The tested field mappings, sample averages, grouping, date boundaries and specified presentation changes pass; the items above still need source definitions/data or a separately scoped layout correction.
