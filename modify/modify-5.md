# Modification 5: Spinning Setup - Option Check (Shift-to-Shift Carry Forward)

## Goal
Add a new Option Check action in the Spinning Machine Setup tab to selectively carry setup values from the immediate previous shift into the current date/shift.

This must apply to all eligible machines in the current setup and only the selected fields.

## Scope
Module: Spinning

Primary implementation page/tab:
- Spinning Machine Setup page/tab (`SpinningMachineSetupTab`) is the main UI where this feature must be implemented.

Primary file targets:
- `src/components/modules/post-preparatory/spinning/SpinningMachineSetupTab.jsx`
- `src/app/actions/spinning-entry.js`
- `src/lib/queries/spinningEntryQueries.js`

Optional utility extraction (if needed):
- `src/lib/*` helper for previous-shift resolution.

---

## UI Requirements

### 1. New Option Check controls
Add a new control block in the Setup tab action area:
- Checkboxes:
  - Speed
  - TPI
  - TW.Con
  - Count
- Button:
  - `Check`

### 2. Placement
Place this block in the bottom action button area, before the existing `Count Change` button.

Current order is:
- Count Change
- Add new machine
- Remove machine

Required order after change:
- Option Check block (checkboxes + Check button)
- Count Change
- Add new machine
- Remove machine

### 3. Enable/Disable behavior
`Check` button should be disabled when:
- No option checkbox is selected.

Show a clear toast if user tries to run without required selections.

---

## Functional Requirements

### 1. Source shift logic (immediate previous shift)
When user clicks `Check`, fetch source data from immediate previous shift relative to current entry context:

- If current is Shift 1 on date D:
  - source = Shift 3 on date D-1
- If current is Shift 2 on date D:
  - source = Shift 1 on date D
- If current is Shift 3 on date D:
  - source = Shift 2 on date D

Example:
- Current: 27-Mar Shift 1
- Source: 26-Mar Shift 3

### 2. Copy granularity
Copy for all eligible setup rows in the current setup and only selected fields:

- `Speed` -> `speed`
- `TPI` -> `tpi`
- `TW.Con` -> `tw_con`
- `Count` -> `count_name`

If `Count` is selected:
- update `count_name` from source setup.
- do not auto-override other fields unless their own checkbox is selected.

### 3. Machine matching rule
Use stable machine mapping by machine identity (prefer `machine_id`; fallback `machine_no` only if needed).
Do not map by table index.

### 4. Active/deactive machine handling
Handle machine status robustly:

Target side (current date/shift):
- apply updates to all machines visible/valid in current setup list.
- do not create or reactivate machines as part of Option Check.

Source side (previous shift):
- read whichever machine setup existed in source header for the same machine.
- if source record not found for a machine, skip that machine gracefully.

Deactivated scenarios:
- if machine is deactivated before current entry date, it should not be updated.
- if machine existed in source but not active/visible in current context, skip.

### 5. Missing source data behavior
For each eligible machine:
- if source header not found: show error toast and abort entire action.
- if source header exists but machine setup missing: skip that machine.
- if selected field is null/empty in source: skip field update for that machine (do not blank current value unless explicitly required later).

### 6. Save strategy
Apply changes as edits + persist using batch update action (same pattern as existing count change/save logic).
After success:
- clear local edits state related to this action
- refresh setup table
- trigger parent refresh (`onRefresh`) to keep tabs consistent

### 7. User feedback
Success toast format:
- include source date/shift
- include updated machine count
- include skipped machine count

Failure toasts:
- no source header
- API/server failure
- nothing eligible to update

---

## Backend/API Requirements

### 1. New server action
Add new action in `src/app/actions/spinning-entry.js`, for example:
- `applySpinningOptionCheckAction(payload)`

Payload suggestion:
- `targetDate` (yyyy-mm-dd)
- `targetShift` (1|2|3)
- `options`:
  - `copySpeed` (boolean)
  - `copyTpi` (boolean)
  - `copyTwCon` (boolean)
  - `copyCount` (boolean)

### 2. New query/service function
Add query function in `src/lib/queries/spinningEntryQueries.js`, for example:
- `applySpinningOptionCheck(payload)`

Responsibilities:
- resolve source date/shift using rules above
- fetch source and target header/details/setups
- map all eligible target setup rows -> machine IDs
- copy selected fields from source setup for matching machine
- batch update target setups
- return summary counters

### 3. Transaction safety
Use transaction for read+write consistency when applying batch updates.

---

## Validation Checklist

1. Current: 27-Mar Shift 1, choose Speed+Count, click Check:
- pulls from 26-Mar Shift 3.
- only speed and count_name updated.

2. Current: Shift 2:
- pulls from same date Shift 1.

3. Current: Shift 3:
- pulls from same date Shift 2.

4. No option selected:
- Check disabled or warning shown.

5. Source not found:
- clear error message; no partial write.

6. Some machines missing in source:
- available ones update, missing ones skipped, summary shown.

7. Deactivated machine not in current visible list:
- not updated.

---

## Notes
- Keep this feature independent of existing `Count Change` dialog.
- Do not alter current machine activation/deactivation flows (`Add`/`Remove machine`) except to respect their existing visibility rules.
- Preserve keyboard navigation and existing row-selection behavior.
- Implement the UI controls and trigger action in the Machine Setup page/tab action area (before `Count Change`).
