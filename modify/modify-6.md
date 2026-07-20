# Modification 6: Auto Slot Allocation for Partial Stoppage (All Modules)

## Goal
Change partial stoppage behavior in all stoppage entry modules so slot assignment is automatic.

Users should no longer choose slot 1/2/3/4 manually.

## Required Behavior

### 1. Remove manual slot selection
In partial stoppage UI/dialog:
- Remove slot dropdown / slot input / slot buttons.
- Keep only range + stoppage reason + stoppage time inputs.

### 2. Auto-assign slot for partial stoppage
When user applies partial stoppage for machine range:
- System must auto-select slot internally.
- Slot logic must support all slots 1, 2, 3, 4.

### 3. Expected flow example
If there are 10 machines:
- Apply partial stoppage for range 1 to 3 -> write into `stoppage1` fields.
- Apply again for same range 1 to 3 -> write into `stoppage2` fields.
- Apply for different range 4 to 5 -> for that range/machines, start from `stoppage1`.

This must continue correctly for slot 3 and slot 4 as more stoppages are applied.

---

## Slot Assignment Rule (Implementation Standard)
For each machine in selected range:
1. Check slots in order: 1 -> 2 -> 3 -> 4.
2. Choose first available slot where stoppage id is empty/null.
3. If no slot is available, skip machine and record as overflow.

Batch consistency for a range apply:
- Preferred: pick one common slot index for the apply request (same slot for all machines in that range) when possible.
- If common slot not possible due to existing mixed data, fallback per-machine first-available slot.

Same-range repeated apply behavior:
- With above first-available rule, repeated apply on same range naturally moves from slot1 -> slot2 -> slot3 -> slot4.

Different-range apply behavior:
- Different range starts from slot1 for those machines (if empty), matching expected behavior.

---

## Data Update Rules
For each updated row:
- Set `stoppage{n}_id` and `stoppage{n}_time` using chosen slot `n`.
- Recompute `total_stoppage_time` (sum of slot times 1..4).
- Recompute dependent production fields in module-specific query logic (work_time, efficiency, etc.) exactly as existing module formulas require.

Do not overwrite existing filled slots except chosen target slot.

---

## Error and Feedback Rules

### Validation
- From machine and To machine are required.
- Stoppage reason required.
- Stoppage time required and must be > 0.

### User feedback
Success toast should include:
- applied machine count,
- skipped machine count,
- overflow count (machines where all 4 slots are already occupied).

### Failure behavior
- If no machines are updated, show meaningful warning (for example: all slots are full).
- Keep current form values so user can adjust and retry.

### Draft safety (important)
- Applying partial stoppage OR full stoppage must NOT force a "save or discard" prompt for existing unsaved edits in production/stoppage tabs.
- Existing unsaved draft edits under the same header/date/shift must be preserved.
- After apply (partial/full), refresh/merge data in a draft-safe way so current in-memory edits are not lost or reset.
- Do not trigger cross-tab destructive refresh when partial/full apply is executed.

---

## Scope: Apply To All Stoppage Modules
Implement this same behavior in all preparatory and post-preparatory stoppage modules that support partial stoppage:
- Carding
- Breaker Drawing
- Finisher Drawing
- Lap Former
- Simplex
- Comber
- Spinning
- Autoconer

---

## API Contract Change

### Current
Most actions/queries accept `slot` as input for partial stoppage.

### New requirement
- UI should not send slot.
- Action/query layer should auto-resolve slot.
- Keep backward compatibility only if needed (optional slot argument may remain but must be ignored for new flow).

---

## File-Level Implementation Guidance

### Frontend stoppage tabs
- Remove slot selector components from partial stoppage dialogs/forms.
- Update submit handlers to call partial apply action without manual slot.
- Ensure partial apply flow is draft-safe: no forced discard confirmation and no loss of unsaved local edits.
- Ensure full stoppage apply flow is also draft-safe with the same non-destructive behavior.

### Server actions
- Update partial stoppage action signatures to make slot optional/ignored.
- Pass request to query method that resolves slot automatically.

### Query layer
- Centralize auto-slot resolver in each module query file.
- Ensure transactional updates for range apply.
- Recalculate production-dependent values after stoppage update (existing module-specific recalculation path).

---

## Acceptance Checklist
1. Same range repeat test:
- Range 1-3 apply #1 -> slot1 populated.
- Range 1-3 apply #2 -> slot2 populated.
- Range 1-3 apply #3 -> slot3 populated.
- Range 1-3 apply #4 -> slot4 populated.

2. Different range reset behavior:
- After applying on 1-3, apply on 4-5 -> slot1 populated for 4-5.

3. Overflow handling:
- If all four slots filled for target machines, system skips and shows clear warning.

4. Totals and dependent values:
- `total_stoppage_time` updates correctly.
- Production-side dependent values refresh correctly after apply.

5. No manual slot UI:
- User cannot choose slot anywhere in partial stoppage flow.

6. Draft-preserving apply:
- If user already typed unsaved values in stoppage/production and then applies partial stoppage, no save/discard prompt should block apply.
- Existing unsaved values remain visible and intact after apply.

7. Full stoppage draft safety:
- If user already typed unsaved values in stoppage/production and then applies full stoppage, no save/discard prompt should block apply.
- Existing unsaved values remain visible and intact after apply.

8. Dynamic total update check (all modules):
- After applying partial/full stoppage, `total_stoppage_time` must update immediately in the stoppage grid (no stale value).

9. Production sync check (all modules):
- When stoppage values are edited/applied in stoppage tab, `total_stoppage_mins` and dependent values in production tab must update dynamically for the same header state.

10. Stoppage reason UI consistency (all modules):
- Full and Partial stoppage reason selectors must use a consistent searchable autocomplete style/pattern aligned with Spinning.

11. Machine visibility/activation filtering (all modules):
- "From M/c No." and "To M/c No." dropdowns in partial stoppage form must only display active machines.
- Filter condition: `is_active: true` at query level ( `getMachines()` / `getSpinningMachines()` / `getAutoconerMachines()` etc.).
- Matches the machine list visible in production entry pages and stoppage entry grid.
- Ensures users cannot accidentally select deactivated machines in partial stoppage range.

---

## Notes
- This is a behavior standard for all modules to keep stoppage UX consistent.
- Do not change formula definitions; only change slot selection behavior and related flow.
