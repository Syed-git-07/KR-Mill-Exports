# Modify 9 - Dynamic Recalculation Pattern (General for All Modules)

## Problem Summary

1. In Machine Setup, when Speed is changed, Std Prodn updates dynamically (this part is already working).
2. But Exp Prodn in Production Entry is not always updating dynamically from the same Speed change.
3. In Production Entry, Effi may update, but Effi shown in Stoppage Entry is not updating dynamically.

## Expected Behavior (Apply to Every Module)

When Speed is edited in M  hn achine Setup (even before Save):

1. Std Prodn in Setup updates dynamically.
2. Exp Prodn in Production updates dynamically.
3. Effi in Production updates dynamically.
4. Effi in Stoppage updates dynamically.

All 4 values must react to draft (unsaved) changes in real time.

---

## Root Cause Pattern

In most modules, one or more of these issues exist:

1. Setup tab keeps edits local only, not shared to parent drafts.
2. Production tab recalculates using only server setup, not effective setup (server + draft override).
3. Stoppage tab recalculates using stale production values or stale setup values.
4. Recalculation fallback prioritizes old stored values (for example old exp_prodn/std_prodn) instead of recalculated formula output.
5. Draft key mismatch (id formatting differences) prevents draft merge.

---

## General Fix Pattern (Use This Everywhere)

### 1. Use shared drafts at page level

Maintain parent drafts object:

- production
- stoppage
- setup

Pass to child tabs:

- sharedDraftEdits
- onSharedDraftEditsChange

Also pass cross-tab dependencies:

- setupDraftEdits into Production and Stoppage
- productionDraftEdits into Stoppage (if needed)
- stoppageDraftEdits into Production

### 2. Setup tab must publish unsaved edits

In setup tab:

1. Use sharedDraftEdits when provided.
2. Use onSharedDraftEditsChange for updates.
3. Keep ref-backed current edits to avoid stale closures.
4. Merge drafts back into loaded setup rows.

Result: Speed draft is available immediately to other tabs.

### 3. Production tab must use effective setup

Create helper:

- getEffectiveSetup(machineId)

Logic:

1. Read base setup from machineSetups.
2. Overlay setupDraftEdits (id and normalized key fallback).
3. Return merged setup.

Use this helper in:

1. Initial server row merge.
2. Recalc useEffect dependencies and calculations.
3. Input-change recalculation.
4. Save-time recalculation.

Important:

- Do not prioritize stale row.exp_prodn when recalculating.
- Use manual exp_prodn only if user explicitly edited exp_prodn in current draft.
- Otherwise always use newly calculated exp_prodn from formula.

### 4. Stoppage tab must also use effective setup

In stoppage recalculation:

1. Compute total stoppage time from current row + draft.
2. Resolve production detail with production draft merge.
3. Resolve setup with setup drafts (effective setup).
4. Recompute work_time, exp_prodn, effi_percent from formula.

Important:

- Do not lock to stale std/exp values from stored production row when effective setup is available.
- Formula should be based on latest effective setup so stoppage Effi reacts to Speed edits instantly.

### 5. Draft key normalization

When reading drafts by id, also support normalized key matching:

- trim
- lowercase
- fallback by both setup id and machine id where relevant

This avoids silent failures where draft exists but is not found.

---

## Calculation Consistency Rule

Across Setup, Production, and Stoppage:

1. Use one consistent formula source per module.
2. Recompute dependent values from current effective inputs.
3. Avoid mixed usage of stale persisted values and newly computed values in the same recalculation pass.

---

## Reference Module

Use Carding module behavior as the implementation reference pattern:

1. Dynamic Speed draft propagation from Setup.
2. Dynamic Exp Prodn recalculation in Production.
3. Dynamic Effi recalculation in Stoppage.

Apply the same architecture and recalculation strategy to all other modules.

---

## Implementation Checklist (Per Module)

1. Page has shared drafts for production/stoppage/setup.
2. Setup tab emits unsaved edits to parent.
3. Production consumes setupDraftEdits and stoppageDraftEdits.
4. Stoppage consumes setupDraftEdits and productionDraftEdits.
5. Effective setup helper is used in all recalculation paths.
6. Recalc effect dependency includes setupDraftEdits.
7. Exp Prodn uses calculated value unless manually overridden in draft.
8. Effi is recalculated from latest Exp Prodn in both Production and Stoppage.
9. Draft id lookup supports normalized fallback keys.
10. Validate with live scenario before save:
   - change Speed in Setup
   - verify Std Prodn, Exp Prodn, Production Effi, Stoppage Effi all update immediately.
