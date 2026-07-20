# Common Implementation Instruction: Dynamic Act Effi Sync Across Production and Stoppage Tabs

Use this instruction for any entry module that has at least:
- a Production tab (Act Hank/Act Prodn inputs), and
- a Stoppage tab (stoppage mins and Effi display).

## Objective
Keep `Act Effi %` and related derived fields dynamically consistent across tabs in real time.

When user updates values in one tab, dependent values in the other tab must update immediately without requiring:
- save,
- refresh,
- date re-open,
- tab remount.

## Reusable Prompt
Apply the following rules in the target module:

1. Shared Draft Source Rule
- Keep unsaved edits in parent shared state for each tab (for example: `sharedDrafts.production`, `sharedDrafts.stoppage`).
- Child tabs must receive and update shared drafts via props/callbacks.
- Do not depend only on tab-local state for cross-tab dependent calculations.

2. Cross-Tab Dependency Rule
- Production recalculation must consider latest stoppage draft edits.
- Stoppage recalculation must consider latest production draft edits (especially Act Hank / Act Prodn fields).
- For any row, compute with "effective values" = `serverRow + relevantDrafts`.

3. Stable Row Link Rule
- Always map cross-tab row dependency by stable identifiers:
  - Production row key: production detail id.
  - Stoppage row key: stoppage entry id and its linked production detail id.
- Never rely on array index for cross-tab sync.

4. Setup/Master Readiness Rule
- Formula setup map must be ready before first interactive recalculation.
- Use an immediate lookup source (for example ref + state) to avoid first-edit race conditions.
- If setup data is missing, use guarded fallback; do not silently skip recalculation.

5. Recalculation Trigger Rule
- Add reactive effects in both tabs:
  - On `productionDraftEdits` change: recalc stoppage grid derived fields.
  - On `stoppageDraftEdits` change: recalc production grid derived fields.
- Recalculation should update only derived fields; preserve user-entered editable fields.

6. Effective Input Merge Rule
- For each recalculation, derive values in this order:
  1) draft override
  2) server row value
  3) controlled fallback
- Example:
  - Act Prodn from Act Hank when only Act Hank is edited.
  - Act Hank back-calculated when only Act Prodn is edited (if module allows).

7. Formula Consistency Rule
- Use one shared calculation function for both tabs wherever possible.
- Keep formula inputs DB-driven first (setup/master/shift config), fallback-only as backup.
- Ensure same total time and stoppage mins are used by both tabs in the same render cycle.

8. Save/Refresh Safety Rule
- Save flow should persist both tabs' relevant edits and then refresh both views.
- Dynamic cross-tab sync must still work before save.
- Refresh should warn before discarding unsaved shared drafts.

9. UX Integrity Rule
- Inactive tabs can be force-mounted for state preservation, but must remain visually hidden.
- Show unsaved indicator counts consistently based on shared drafts.

## Suggested Data Contracts

Parent -> Production Tab:
- `sharedDraftEdits` (production)
- `onSharedDraftEditsChange`
- `stoppageDraftEdits` (for cross-tab dependency)

Parent -> Stoppage Tab:
- `sharedDraftEdits` (stoppage)
- `onSharedDraftEditsChange`
- `productionDraftEdits` (for cross-tab dependency)

## Acceptance Checklist
- Edit Act Hank in Production, switch to Stoppage: Effi updates immediately.
- Edit stoppage mins in Stoppage, switch to Production: Effi/Exp/UTI updates immediately.
- First-time edit after Initialize works without date re-open.
- No mismatch between tabs for same machine/row after edit.
- Save persists expected values; post-save reload matches in both tabs.
- No runtime errors from missing helper functions or stale setup references.

## Validation Scenario (Manual)
1. Initialize entry for a fresh date and shift.
2. In Production tab, edit Act Hank for one machine.
3. Move to Stoppage tab and verify Effi reflects new Production draft immediately.
4. In Stoppage tab, edit stoppage mins for same machine.
5. Move back to Production tab and verify Effi/Exp/UTI reflects new stoppage mins.
6. Save from common parent Save action.
7. Reload/open same entry and verify values remain consistent.

## Implementation Note
Use this as a common instruction for all multi-tab entry modules with interdependent calculations.
Keep these rules unchanged and only adapt module-specific identifiers, formula function names, and file paths.
