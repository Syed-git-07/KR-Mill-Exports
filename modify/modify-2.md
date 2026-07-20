# Common Implementation Instruction: Preserve Entered State Across Tabs

Use this instruction for any module that has multiple tabs (for example: Production, Stoppage, Machine Setup).

## Objective
When a user enters values in one tab and moves to another tab, entered values must remain intact.
No user-entered data should disappear due to tab switch, re-render, lazy load, or background refresh.

## Reusable Prompt
Apply the following rules in the target module:

0. Pre-Implementation Field Analysis Rule
- Before coding, analyze all entry-page tabs and document field categories for that module.
- Identify all state-bearing columns and classify them as user-entered, system-populated, and calculated/derived.
- Confirm where each category is rendered, edited, recalculated, and persisted.
- Start implementation only after this field-flow mapping is complete.

1. Shared State Ownership Rule
- Keep form/entry state in a shared parent-level store for all related tabs.
- Do not keep critical entered data only in tab-local component state.
- Use one source of truth for editable rows/fields across tabs.

2. Tab Lifecycle Rule
- Switching tabs must not reset data.
- Avoid unmount side effects that clear drafts.
- If tabs unmount/remount, restore state from shared store before rendering.

2.1 Tab Visibility Integrity Rule
- On tab switch, display only the selected tab content; inactive tab pages must stay hidden.
- If tab contents are force-mounted for state preservation, enforce active/inactive visibility explicitly.
- Never allow overlapping or stale tab panels where clicking one tab still shows another tab page.

3. Draft Preservation Rule
- Maintain a `draftEdits` structure keyed by stable row/machine identifiers.
- Merge server data with local drafts without dropping unsaved user edits.
- Always prefer local draft values over freshly fetched values until save/cancel.

4. Refresh and Fetch Safety Rule
- During background reload/sync, do not overwrite active edited fields.
- Apply non-destructive merge logic:
  - keep untouched server fields updated,
  - keep touched local fields unchanged.

5. Save/Cancel Behavior Rule
- Save writes merged values from shared state and then clears only successfully persisted draft keys.
- Cancel reverts only the current draft scope explicitly; no silent reset on tab navigation.

5.1 Common Save Entry Rule
- For multi-tab entry modules, provide one common Save Changes action at parent level.
- Place the common Save Changes button directly below Copy Previous Data in the header/action area.
- Parent save must trigger save handlers for all related tabs in one flow (Production, Stoppage, Machine Setup).
- Saving from one page must not leave pending edits unsaved in other tabs.
- Keep per-tab refresh actions allowed, but avoid per-tab primary Save Changes buttons when common save is enabled.
- Show one combined save status summary (total saved and failed tabs/sections if any).

6. UX Safety Rule
- Show dirty/unsaved indicator when drafts exist.
- Warn user before destructive actions (full reset, date/shift change, header change) if unsaved edits exist.
- Preserve cursor/focus behavior where practical after tab switch.

7. Data Boundary Rule
- Do not modify already stable and unrelated implementations.
- Scope changes only to state-management paths needed for cross-tab persistence.

8. Column Coverage Rule
- Manage persistence for all analyzed state-bearing columns in the module, not only visible/active tab fields.
- Ensure cross-tab navigation preserves values for every mapped column category.
- Keep column identity stable using row/machine keys so values do not shift between records.

9. Calculated Field State Rule
- Include calculated/derived fields in draft merge strategy; do not let tab switches clear them.
- Recompute calculated fields from the latest draft + base state when dependencies change.
- Preserve user-entered overrides where allowed by module rules, and avoid silent overwrite during refresh.
- Ensure save payload reflects consistent entered + calculated state.

## Suggested State Pattern
- Parent container holds:
  - `baseData` (latest server snapshot)
  - `draftEdits` (unsaved user overrides)
  - `viewData = merge(baseData, draftEdits)`
- Child tabs read/write through callbacks to parent store.
- Never directly mutate server snapshot in child tabs.

## Acceptance Checklist
- Field analysis completed before coding, with category mapping for module columns.
- Enter values in Production tab, switch to Stoppage tab, return: values remain.
- Enter values in Stoppage tab, switch to Machine Setup tab, return: values remain.
- On each tab click, the correct entry page is displayed and inactive pages are hidden.
- Common Save Changes button is shown below Copy Previous Data and saves all tab edits together.
- Background fetch does not wipe unsaved edited fields.
- Calculated/derived values remain consistent across tab switches and refreshes.
- Save persists data and removes only saved draft entries.
- No regressions in unrelated modules.

## Validation Scenario (Manual)
1. Open an entry and edit multiple fields in Production.
2. Switch to Stoppage, edit values, then switch to Machine Setup.
3. Return to Production and Stoppage.
4. Confirm all unsaved edits are still present.
5. Click the common Save Changes button (below Copy Previous Data) from any active tab.
6. Confirm edits across all tabs are saved in one action.
7. Re-open same entry; confirm persisted values match expected output.

## Implementation Note
Apply this as a common instruction for future modules with multi-tab editing behavior.
Keep the rule set unchanged and only adapt identifiers, table names, and component paths.
