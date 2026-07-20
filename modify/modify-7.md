# modify-7: Finisher Drawing Production Entry Analysis (No Implementation)

## Scope
This is an instruction file.
Analyze the points below and implement the required fixes.

## Problem Statement
In Finisher Drawing Production Entry, user enters Waste, clicks Save Changes, then Waste is cleared and not displayed in table.

Primary question:
Is the issue in frontend, queries, Prisma layer, or database?

## Current Evidence Summary
Observed behavior from debug logs:
1. Waste is correct when user types (input draft shows correct value).
2. Before API save payload is sent, pending edits already contain `waste: 0`.
3. Save payload then sends `waste: 0`, and DB stores `0`.
4. Table reload reflects stored value `0`.

Interpretation:
- The value is being overwritten in client-side draft/state flow before save request.
- This points primarily to frontend draft merge/recalculation logic.

## Layer-by-Layer Analysis

### 0) Spinning Module Reference (Implementation Baseline)
Before implementing the Finisher fix, refer to the Spinning module flow for Waste save behavior.

What to do:
1. Identify how Spinning keeps Waste stable from input -> draft -> payload -> DB -> reload.
2. Compare Spinning draft merge/recalculation order with Finisher.
3. Implement Finisher using the same stable sequence and source-of-truth pattern used in Spinning.
4. Ensure Finisher Save Changes behavior matches Spinning for Waste persistence.

### 1) Frontend (Most likely root cause)
Why likely:
- Waste is valid at input stage but becomes `0` in pending-edits before request.
- That means overwrite happens in memory (state/ref merge) prior to calling server action.

What to verify in frontend:
1. Draft update order for Waste field.
2. Ref vs state precedence while building save payload.
3. Recalculation paths that may re-read stale row values and write back `waste: 0`.
4. Cross-tab shared draft updates (Production/Stoppage/Setup synchronization).
5. Number input transient values (empty/partial) that may be converted to `0` and merged.

### 2) Queries Layer (Secondary check)
Why less likely:
- Save payload itself already carries `waste: 0` in observed logs.

What to verify:
1. `updateFinisherDrawingDetail` should not normalize non-zero waste to zero.
2. No query-side recompute should overwrite provided waste during update.

### 3) Prisma Layer (Secondary check)
Why less likely:
- Prisma update appears to persist exactly what it receives from frontend payload.

What to verify:
1. Update data includes `waste` and `waste_percent` values passed by action.
2. No Prisma middleware/hook mutates `waste`.

### 4) Database Layer (Lowest likelihood from current evidence)
Why less likely:
- If DB were the issue, payload would usually be correct before insert/update.
- Current logs show payload already zero before DB write.

What to verify:
1. Column definitions for `waste`, `waste_percent`.
2. Triggers on Finisher tables (if any) that may modify values.
3. Confirm stored row after save matches request payload.

## Diagnostic Conclusion (Current)
Most probable root cause is frontend state/draft overwrite before save.
Queries/Prisma/DB appear downstream and are likely persisting the already-overwritten value.

## DB Verification Command Pattern
Use this command style for DB analysis:

```bash
mysql -u root -p"Alan@2005" kr_production -e "SELECT * FROM shift_config WHERE department_code IN ('LAPFORMER', 'BREAKER') ORDER BY department_code, shift;"
```

Use the same pattern for Finisher checks, for example:

```bash
mysql -u root -p"Alan@2005" kr_production -e "DESCRIBE finisher_drawing_production_detail;"
```

```bash
mysql -u root -p"Alan@2005" kr_production -e "SHOW TRIGGERS LIKE '%finisher%';"
```

```bash
mysql -u root -p"Alan@2005" kr_production -e "SELECT id, machine_id, act_prodn, waste, waste_percent, updated_at FROM finisher_drawing_production_detail WHERE header_id = 'YOUR_HEADER_ID' ORDER BY updated_at DESC LIMIT 20;"
```

## Instruction for Next Step
Implement based on this analysis in the next step.
Prioritize fixing the frontend draft overwrite path first, then validate queries, Prisma, and DB behavior end-to-end.
Also refer to Spinning module Waste handling and implement Finisher using the same working save pattern.
