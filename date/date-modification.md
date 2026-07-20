# Date-Based Machine Visibility — Implementation Guide

This document describes the pattern for replacing boolean `is_active` machine filtering with **date-range visibility** across production modules, as implemented for `spinning_machines`.

---

## Concept

Instead of showing or hiding machines based on a single `is_active` flag, machines are shown based on whether they were active **on the specific entry date** being viewed.

**Visibility Rule:**
```
activated_at <= entry_date
AND (deactivated_at IS NULL OR deactivated_at > entry_date)
```

- A machine **removed on March 3** is invisible from March 3 onwards, but still appears correctly in all past entries (Feb, Jan, etc.).
- A machine **added today** is visible from today onwards, but does NOT appear in past entries.
- `deactivated_at` is the **removal date itself** — that day is already excluded (`<= entry_date` means removed).

---

## Step 1 — DB Migration

```sql
ALTER TABLE <module>_machines
  ADD COLUMN activated_at  DATE NULL,
  ADD COLUMN deactivated_at DATE NULL;

-- Backfill active machines
UPDATE <module>_machines
SET activated_at = COALESCE(installed_date, DATE(created_at))
WHERE is_active = 1 OR is_active IS NULL;

-- Backfill inactive (removed) machines
UPDATE <module>_machines
SET activated_at   = COALESCE(installed_date, DATE(created_at)),
    deactivated_at = '<migration-date>'
WHERE is_active = 0;
```

> After running, **also append to `schema/updation.sql`** so the other server stays consistent.

> **Important:** After migration, correct `deactivated_at` for any machine whose actual removal date differs from the migration date. The migration date is just a safe fallback — use the real removal date when known.

```sql
UPDATE <module>_machines
SET deactivated_at = '<actual-removal-date>'
WHERE machine_no = '<no>' AND is_active = 0;
```

---

## Step 2 — `prisma/schema.prisma`

Add inside the `<module>_machines` model:

```prisma
activated_at   DateTime? @db.Date
deactivated_at DateTime? @db.Date
```

Then run:

```bash
npx prisma generate
```

---

## Step 3 — Query File Functions

### 3a. `initializeProductionDetails` — first-time load

Fetch `entry_date` from the header, then filter machines by date range:

```js
const header = await prisma.<module>_production_header.findUnique({
  where: { id: headerId },
  select: { entry_date: true }
})
const entryDate = header?.entry_date || new Date()

const machines = await prisma.<module>_machines.findMany({
  where: {
    activated_at: { lte: entryDate },
    OR: [{ deactivated_at: null }, { deactivated_at: { gt: entryDate } }]
  },
  orderBy: { sort_order: 'asc' }
})
```

---

### 3b. `syncNewMachinesToHeader` — called on every page load of an existing entry

This function must both **add** newly visible machines AND **remove** rows for machines that are no longer visible on the entry_date.

```js
// 1. Fetch entry_date
const headerForDate = await prisma.<module>_production_header.findUnique({
  where: { id: headerId },
  select: { entry_date: true }
})
const entryDate = headerForDate?.entry_date || new Date()

// 2. Get currently visible machines
const machines = await prisma.<module>_machines.findMany({
  where: {
    activated_at: { lte: entryDate },
    OR: [{ deactivated_at: null }, { deactivated_at: { gt: entryDate } }]
  },
  orderBy: { sort_order: 'asc' }
})

// 3. Fetch existing detail rows (must select id AND machine_id)
const existingDetails = await prisma.<module>_production_detail.findMany({
  where: { header_id: headerId },
  select: { id: true, machine_id: true }
})
const existingMachineIds = existingDetails.map(d => d.machine_id)

// 4. Find and delete deactivated machine rows
const allExistingMachines = existingMachineIds.length > 0
  ? await prisma.<module>_machines.findMany({ where: { id: { in: existingMachineIds } } })
  : []
const existingMachineMap = {}
allExistingMachines.forEach(m => { existingMachineMap[m.id] = m })

const deactivatedDetailIds = existingDetails
  .filter(d => {
    const m = existingMachineMap[d.machine_id]
    return m?.deactivated_at && new Date(m.deactivated_at) <= entryDate
  })
  .map(d => d.id)

if (deactivatedDetailIds.length > 0) {
  await prisma.<module>_stoppage_entry.deleteMany({
    where: { production_detail_id: { in: deactivatedDetailIds } }
  })
  await prisma.<module>_production_detail.deleteMany({
    where: { id: { in: deactivatedDetailIds } }
  })
}

// 5. Add only truly new machines (use remainingMachineIds after cleanup)
const remainingMachineIds = existingDetails
  .filter(d => !deactivatedDetailIds.includes(d.id))
  .map(d => d.machine_id)

const newMachines = machines.filter(m => !remainingMachineIds.includes(m.id))
```

---

### 3c. `getProductionDetails` — reading an existing entry

Fetch `entry_date` from the header and apply the date visibility filter on the enriched result — do **not** filter when fetching raw machines (use `id: { in: machineIds }` to preserve historical data):

```js
// Fetch header entry_date
const header = await prisma.<module>_production_header.findUnique({
  where: { id: headerId },
  select: { entry_date: true }
})
const entryDate = header?.entry_date || new Date()

// Fetch machines by exact IDs (no is_active filter — historical data preservation)
const machines = await prisma.<module>_machines.findMany({
  where: { id: { in: machineIds } },
  orderBy: { sort_order: 'asc' }
})

// Apply visibility filter after enriching
const enrichedData = data
  .map(detail => ({
    ...detail,
    machine: machineMap[detail.machine_id] || null,
    // ...other fields
  }))
  .filter(detail => {
    if (!detail.machine) return false
    const m = detail.machine
    if (m.activated_at && new Date(m.activated_at) > entryDate) return false
    if (m.deactivated_at && new Date(m.deactivated_at) <= entryDate) return false
    return true
  })
```

---

### 3d. `getStoppageEntries` — reading stoppage tab

Same pattern as 3c — fetch `entry_date`, fetch machines by `id: { in: machineIds }`, apply date filter at the end:

```js
const header = await prisma.<module>_production_header.findUnique({
  where: { id: headerId },
  select: { entry_date: true }
})
const entryDate = header?.entry_date || new Date()

const result = details
  .filter(detail => {
    const m = machineMap[detail.machine_id]
    if (!m) return false
    if (m.activated_at && new Date(m.activated_at) > entryDate) return false
    if (m.deactivated_at && new Date(m.deactivated_at) <= entryDate) return false
    return true
  })
  .map(detail => { /* ... */ })
```

---

### 3e. Add machine (create new)

```js
await prisma.<module>_machines.create({
  data: {
    ...machineData,
    is_active: true,
    activated_at: new Date()
  }
})
```

---

### 3f. Reactivate machine (re-adding a previously removed machine)

```js
await prisma.<module>_machines.update({
  where: { id: existingMachine.id },
  data: {
    ...machineData,
    is_active: true,
    activated_at: new Date(),
    deactivated_at: null
  }
})
```

---

### 3g. Remove machine (deactivate)

```js
await prisma.<module>_machines.update({
  where: { id },
  data: {
    is_active: false,
    deactivated_at: new Date()
  }
})
```

---

### 3h. Bulk / historical operations (`applyFullStoppage`, etc.)

Do **not** filter by date or `is_active` — fetch all machines so past records remain intact:

```js
const machines = await prisma.<module>_machines.findMany()
```

---

## Key Rules

| Situation | Pattern |
|---|---|
| Creating new entry rows | Filter by `activated_at <= entryDate AND deactivated_at > entryDate` |
| Reading existing entry rows (production / stoppage) | Fetch by `id: { in: machineIds }`, then filter by date after enriching |
| Sync on page load | Also **delete** stale rows for machines whose `deactivated_at <= entryDate` |
| Historical / bulk ops | No filter — fetch all machines |
| UI machine list (setup screen) | Use `is_active: true` — unchanged |
| Master page machine list | Show ALL machines (no `is_active` filter); inactive rows in red via `getRowClassName` |

---

## Common Pitfall — Stale Rows

If the date-based migration is applied **after** entries were already created (with the old `is_active` filter), stale detail rows may exist for removed machines on dates after their removal. These must be cleaned up manually:

```sql
-- Identify stale rows
SELECT h.entry_date, sm.machine_no, pd.act_prodn
FROM spinning_production_detail pd
JOIN spinning_production_header h ON pd.header_id = h.id
JOIN spinning_machines sm ON pd.machine_id = sm.id
WHERE sm.is_active = 0
  AND h.entry_date >= sm.deactivated_at
ORDER BY h.entry_date, sm.machine_no;

-- Delete stale stoppage entries
DELETE se FROM spinning_stoppage_entry se
  JOIN spinning_production_detail pd ON se.production_detail_id = pd.id
  JOIN spinning_production_header h  ON pd.header_id = h.id
  JOIN spinning_machines sm          ON pd.machine_id = sm.id
  WHERE sm.is_active = 0
    AND h.entry_date >= sm.deactivated_at
    AND pd.act_prodn IS NULL;  -- only blank rows (no real data entered)

-- Delete stale production detail rows
DELETE pd FROM spinning_production_detail pd
  JOIN spinning_production_header h ON pd.header_id = h.id
  JOIN spinning_machines sm         ON pd.machine_id = sm.id
  WHERE sm.is_active = 0
    AND h.entry_date >= sm.deactivated_at
    AND pd.act_prodn IS NULL;
```

> The `syncNewMachinesToHeader` function now handles this automatically going forward — stale rows are deleted on every page load.

---

## Notes

- `is_active` is kept for the machine setup / listing screens — those still use `is_active: true` and are unaffected.
- `activated_at` / `deactivated_at` control only the **production entry and stoppage entry screens**.
- Always use the **real removal date** for `deactivated_at`, not the migration date. The migration date is only a fallback when the exact date is unknown.

---

## Step 4 — Master Page (Machine List) UI

This section documents the pattern for the machine **master list page** (e.g., Autoconer Machine Master, Spinning Machine Master) once `activated_at` / `deactivated_at` columns exist.

### 4a. Show all machines (active + inactive)

Remove the `is_active: true` filter from `getXxxMachines()` and `searchXxxMachines()`. Add an **active-first** sort so inactive machines sink to the bottom.

```js
// getXxxMachines
const data = await prisma.<module>_machines.findMany({});
data.sort((a, b) => {
  if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
  // ...remaining sort (group_id, machine_no, etc.)
});
```

```js
// searchXxxMachines
let whereClause = {};  // was: { is_active: true }
```

---

### 4b. Red highlight inactive rows

Pass `getRowClassName` to `<DataGrid>` so inactive machines display in red:

```jsx
<DataGrid
  getRowClassName={(row) =>
    !row.is_active
      ? '!bg-red-100 hover:!bg-red-200 text-red-700'
      : '!bg-white hover:!bg-yellow-100'
  }
  ...
/>
```

---

### 4c. Right-click / double-click opens form directly

Remove any context-menu popup. Both `onContextMenu` and `onRowDoubleClick` call the same handler:

```jsx
<DataGrid
  onRowDoubleClick={openEditForm}
  onContextMenu={(row, e) => { e.preventDefault(); openEditForm(row); }}
  ...
/>
```

---

### 4d. `updateXxxMachine` — set timestamps when `is_active` changes

```js
export async function updateXxxMachine(id, machineData) {
  const processedData = { ...machineData };
  // ...date conversion...
  if (processedData.is_active === true) {
    processedData.activated_at = new Date();
    processedData.deactivated_at = null;
  } else if (processedData.is_active === false) {
    processedData.deactivated_at = new Date();
  }
  return prisma.<module>_machines.update({ where: { id }, data: processedData });
}
```

---

### 4e. Stats bar — show active / inactive counts

```jsx
<div className="flex gap-4 text-sm text-muted-foreground">
  <span>Total: {machines.length}</span>
  <span className="text-green-600">Active: {machines.filter(m => m.is_active).length}</span>
  <span className="text-red-600">Inactive: {machines.filter(m => !m.is_active).length}</span>
</div>
```

> **Note:** The `is_active` checkbox already exists in the machine form — no form changes are needed. Toggling it and saving triggers the timestamp logic in 4d above.

---

### 4f. Deactivate button — header + form footer

Provide a one-click **Deactivate** shortcut (orange, outline) separate from the full edit flow:

**Header button** — enabled only when the selected machine(s) are currently active:
```jsx
<Button
  onClick={handleDeactivate}
  variant="outline"
  className="border-orange-500 text-orange-600 hover:bg-orange-50"
  disabled={
    isSelectMode
      ? selectedRows.filter(r => r.is_active).length === 0
      : !selectedRowId || !machines.find(m => m.id === selectedRowId)?.is_active
  }
>
  <PowerOff className="w-4 h-4 mr-2" />
  Deactivate
</Button>
```

**`handleDeactivate` logic:**
```js
// Bulk (select mode)
const activeRows = selectedRows.filter(r => r.is_active);
await Promise.all(activeRows.map(row => updateXxxMachineAction(row.id, { is_active: false })));

// Single
await updateXxxMachineAction(targetId, { is_active: false });
// → triggers deactivated_at = new Date() inside updateXxxMachine query
```

**FormModal footer** — show Deactivate button only when editing an active machine (hidden for already-inactive machines):
```jsx
<FormModal
  onSecondaryAction={editingMachine?.is_active ? handleDeactivate : null}
  secondaryActionLabel="Deactivate"
  // ...
/>
```

`FormModal` renders `secondaryAction` on the left side of the footer (alongside "Remove Permanently"), using `border-orange-500 text-orange-600 hover:bg-orange-50` by default. Pass `secondaryActionClassName` to override.

---

## Breaker Drawing Module — Pending Implementation Plan

> Also apply full date-based visibility (Steps 1–3 above) to breaker_drawing_machines: DB migration (activated_at / deactivated_at), Prisma schema update, and all query functions (initializeProductionDetails, syncNewMachinesToHeader, getProductionDetails, getStoppageEntries).

### 1. Master Page — Activate / Deactivate + Red Row Highlight

- Apply the same date-based activation / deactivation pattern (activated_at / deactivated_at) to breaker_drawing_machines as done for spinning_machines.
- On the master list page (BreakerDrawingMachineSetupTab or equivalent):
  - Show ALL machines (active + inactive) — remove is_active: true filter.
  - Inactive machines displayed in red rows using getRowClassName (same pattern as spinning master).
  - Add active / inactive counts in the stats bar (Total / Active / Inactive).
  - Add a Deactivate button in the header (enabled only when an active machine is selected).
  - Show Deactivate button in the form footer when editing an active machine.
  - Right-click and double-click on a row both open the edit form directly (no context menu popup).

---

### 2. Add Machine / Update Machine Form — Field Changes

Replace the current Breaker Drawing machine form fields with the following (in order):

1. Mch No — machine number input
2. Description — text input
3. Make Name — text input
4. Model — text input
5. Count — replace "Prodn Mixing" field with a count search/select (same autocomplete / EnterSelect pattern as the Carding module's count field)
6. Speed — manual number input (keep as-is or rename to "Speed Manual" if currently labelled differently)
7. Delivery — number input (stored as delivery on the machine record)
8. Sliver Hank — decimal number input (stored as sliver_hank on the machine record)
9. Std Efi % — rename "Prodn Effi %" to "Std Efi %" (same field, label change only)
10. Installed Date — date picker, properly formatted and saved (not a plain text field)
11. Is Active checkbox — already present; ensure saving triggers activated_at / deactivated_at timestamp logic (same as spinning updateMachine pattern)

---

### 3. Machine Setup — Auto-fill from Master on Machine No Entry

When the user types / selects a machine number in the Machine Setup "Add Machine" dialog:
- Look up the machine record from breaker_drawing_machines by machine_no.
- Auto-fill all remaining fields (Description, Make Name, Model, Count, Speed, Delivery, Sliver Hank, Std Efi %, Installed Date) from the master record.
- Follow the exact same implementation as SpinningMachineSetupTab: lookupMachineByNo() query + lookupMachineByNoAction() server action + onBlur / onKeyDown (Enter) trigger on the machine_no input.
- User can still manually override any auto-filled value before saving.

---

## Comber Module — Pending Implementation Plan

> Also apply full date-based visibility (Steps 1–3 above) to comber_machines: DB migration (activated_at / deactivated_at), Prisma schema update, and all query functions (initializeProductionDetails, syncNewMachinesToHeader, getProductionDetails, getStoppageEntries).

### 1. Master Page — Activate / Deactivate + Red Row Highlight

- Same pattern as Breaker Drawing (Step 4 above): show all machines, red rows for inactive, stats bar, Deactivate button in header and form footer, right-click / double-click opens edit form directly.

---

### 2. Add Machine / Update Machine Form — Field Changes

Replace the current Comber machine form fields with the following (in order):

1. Mc No — machine number input
2. Description — text input
3. Make Name — text input
4. Model — text input
5. Count — replace "Prodn Mixing" with count name search/select (same autocomplete / EnterSelect pattern as the Carding module)
6. Speed — manual number input
7. Sliver Hank — decimal number input (stored as sliver_hank on the machine record)
8. Std Effi % — rename "Mc Effi %" to "Std Effi %" (label change only); remove "Prodn Effi %" field entirely
9. Installed Date — date picker, properly formatted and saved
10. Is Active checkbox — ensure saving triggers activated_at / deactivated_at timestamp logic (same as spinning updateMachine pattern)

---

### 3. Machine Setup — Auto-fill from Master on Machine No Entry

When the user types / selects a machine number in the Machine Setup "Add Machine" dialog:
- Look up the machine record from comber_machines by machine_no.
- Auto-fill all remaining fields (Description, Make Name, Model, Count, Speed, Sliver Hank, Std Effi %, Installed Date) from the master record.
- Follow the exact same implementation as SpinningMachineSetupTab: lookupMachineByNo() query + lookupMachineByNoAction() server action + onBlur / onKeyDown (Enter) trigger on the machine_no input.
- User can still manually override any auto-filled value before saving.

---

## Finisher Drawing Module — Pending Implementation Plan

> Also apply full date-based visibility (Steps 1–3 above) to finisher_drawing_machines: DB migration (activated_at / deactivated_at), Prisma schema update, and all query functions (initializeProductionDetails, syncNewMachinesToHeader, getProductionDetails, getStoppageEntries).

### 1. Master Page — Activate / Deactivate + Red Row Highlight

- Same pattern as Breaker Drawing (Step 4 above): show all machines, red rows for inactive, stats bar, Deactivate button in header and form footer, right-click / double-click opens edit form directly.

---

### 2. Add Machine / Update Machine Form — Field Changes

Replace the current Finisher Drawing machine form fields with the following (in order):

1. Mc No — machine number input
2. Description — text input
3. Make Name — text input
4. Model — text input
5. Count — replace "Prodn Mixing" with count name search/select (same autocomplete / EnterSelect pattern as the Carding module)
6. Speed — manual number input
7. Std Effi % — rename "Prodn Effi %" to "Std Effi %" (label change only)
8. Installed Date — date picker, properly formatted and saved
9. Is Active checkbox — ensure saving triggers activated_at / deactivated_at timestamp logic (same as spinning updateMachine pattern)

---

### 3. Machine Setup — Auto-fill from Master on Machine No Entry

When the user types / selects a machine number in the Machine Setup "Add Machine" dialog:
- Look up the machine record from finisher_drawing_machines by machine_no.
- Auto-fill all remaining fields (Description, Make Name, Model, Count, Speed, Std Effi %, Installed Date) from the master record.
- Follow the exact same implementation as SpinningMachineSetupTab: lookupMachineByNo() query + lookupMachineByNoAction() server action + onBlur / onKeyDown (Enter) trigger on the machine_no input.
- User can still manually override any auto-filled value before saving.

---

## Simplex Module — Pending Implementation Plan

> Also apply full date-based visibility (Steps 1–3 above) to simplex_machines: DB migration (activated_at / deactivated_at), Prisma schema update, and all query functions (initializeProductionDetails, syncNewMachinesToHeader, getProductionDetails, getStoppageEntries).

### 1. Master Page — Activate / Deactivate + Red Row Highlight

- Same pattern as Breaker Drawing (Step 4 above): show all machines, red rows for inactive, stats bar, Deactivate button in header and form footer, right-click / double-click opens edit form directly.

---

### 2. Add Machine / Update Machine Form — Field Changes

Replace the current Simplex machine form fields with the following (in order):

1. Mc No — machine number input
2. Description — text input
3. Make Name — text input
4. Model — text input
5. Count Name — replace "Prodn Mixing" with count name search/select (same autocomplete / EnterSelect pattern as the Carding module)
6. Speed — manual number input
7. Std Effi % — rename "Prodn Effi %" to "Std Effi %" (label change only)
8. Remove "Mc Effi %" field from the form
9. TPI — auto-fetch from selected Count Name
10. No of Spindles — number input
11. Installed Date — date picker, properly formatted and saved
12. Is Active checkbox — ensure saving triggers activated_at / deactivated_at timestamp logic (same as spinning updateMachine pattern)

---

### 3. Machine Setup — Auto-fill from Master on Machine No Entry

When the user types / selects a machine number in the Machine Setup "Add Machine" dialog:
- Look up the machine record from simplex_machines by machine_no.
- Auto-fill all remaining fields (Description, Make Name, Model, Count Name, Speed, Std Effi %, TPI, No of Spindles, Installed Date) from the master record.
- When Count Name is selected or changed, fetch TPI from the selected Count Name using the same Count linkage pattern used in spinning.
- Follow the exact same implementation as SpinningMachineSetupTab: lookupMachineByNo() query + lookupMachineByNoAction() server action + onBlur / onKeyDown (Enter) trigger on the machine_no input.
- User can still manually override any auto-filled value before saving.

---

## Lap Former Module — Pending Implementation Plan

> Also apply full date-based visibility (Steps 1–3 above) to lap_former_machines: DB migration (activated_at / deactivated_at), Prisma schema update, and all query functions (initializeProductionDetails, syncNewMachinesToHeader, getProductionDetails, getStoppageEntries).

### 1. Master Page — Activate / Deactivate + Red Row Highlight

- Same pattern as Breaker Drawing (Step 4 above): show all machines, red rows for inactive, stats bar, Deactivate button in header and form footer, right-click / double-click opens edit form directly.

---

### 2. Add Machine / Update Machine Form — Field Changes

Replace the current Lap Former machine form fields with the following (in order):

1. Mc No — machine number input
2. Description — text input
3. Make Name — text input
4. Model — text input
5. Count — replace "Prodn Mixing" with count name search/select (same autocomplete / EnterSelect pattern as the Carding module)
6. Speed — manual number input
7. Std Effi % — rename "Prodn Effi %" to "Std Effi %" (label change only)
8. Installed Date — date picker, properly formatted and saved
9. Is Active checkbox — ensure saving triggers activated_at / deactivated_at timestamp logic (same as spinning updateMachine pattern)

---

### 3. Machine Setup — Auto-fill from Master on Machine No Entry

When the user types / selects a machine number in the Machine Setup "Add Machine" dialog:
- Look up the machine record from lap_former_machines by machine_no.
- Auto-fill all remaining fields (Description, Make Name, Model, Count, Speed, Std Effi %, Installed Date) from the master record.
- Follow the exact same implementation as SpinningMachineSetupTab: lookupMachineByNo() query + lookupMachineByNoAction() server action + onBlur / onKeyDown (Enter) trigger on the machine_no input.
- User can still manually override any auto-filled value before saving.

---

## Common Post-Implementation Checklist

Run through every item below after completing each module's date-based visibility migration. These issues were discovered during the Breaker Drawing module implementation and apply to **all modules**.

> **Reference module:** The spinning module (`spinningEntryQueries.js`, `SpinningMachineSetupTab.jsx`) correctly implements every item below. When in doubt, compare against it.

---

### ✅ 1 — `removeMachine` must set `deactivated_at`

> **Spinning reference:** `removeSpinningMachine` — `src/lib/queries/spinningEntryQueries.js`

**Problem:** Removing a machine via the setup tab only set `is_active: false` but left `deactivated_at = NULL`. The date-range filter (`deactivated_at <= entryDate`) then never matched, so the machine was still treated as active everywhere.

**Fix / Verify:**
```js
// removeSpinningMachine — same pattern for every module:
await prisma.<module>_machines.update({
  where: { id: machineId },
  data: { is_active: false, deactivated_at: new Date() }  // ← both fields required
});
```
**Test:** Remove a machine today → open today's production entry → machine must be absent.

---

### ✅ 2 — Removed machine must disappear from production + stoppage entry on the removal date

> **Spinning reference:** `syncNewMachinesToSpinningHeader` stale-row deletion block — `src/lib/queries/spinningEntryQueries.js`

**Problem:** After removal, the machine still showed in the production and stoppage entry screens for the same date. `syncNewMachinesToHeader` only added new machines — it never deleted stale rows.

**Fix / Verify:** `syncNewMachinesToHeader` must delete rows where `deactivated_at <= entryDate` before adding new machines:
```js
const staleDetailIds = existingDetails
  .filter(d => {
    const m = existingMachineMap[d.machine_id];
    return m?.deactivated_at && new Date(m.deactivated_at) <= entryDate;
  })
  .map(d => d.id);

if (staleDetailIds.length > 0) {
  await prisma.<module>_stoppage_entry.deleteMany({
    where: { production_detail_id: { in: staleDetailIds } }
  });
  await prisma.<module>_production_detail.deleteMany({
    where: { id: { in: staleDetailIds } }
  });
}
```
**Test:** Remove a machine, refresh the production entry page for today → machine row gone from both production and stoppage tabs.

---

### ✅ 3 — Adding a deactivated machine via setup must not error with "already exists in setup"

> **Spinning reference:** `handleMachineNoLookup` in `SpinningMachineSetupTab.jsx` — note it does **not** check `has_setup` at all; `lookupSpinningMachineByNo` falls back gracefully to any machine's existing setup data.

**Problem:** `lookupMachineByNo` returned `has_setup: true` for deactivated machines (they kept their setup record). The setup tab's lookup handler blocked with an error toast and returned early — the user could never re-add a deactivated machine.

**Fix / Verify (UI):** Remove the early-return block. When `has_setup = true`, show an info toast ("will be reactivated") and still fill the form:
```js
// WRONG: if (result.data.has_setup) { toast.error(...); return; }
// CORRECT:
if (d.has_setup) {
  toast.info(`Machine ${val} found – it will be reactivated with existing setup`, { id: toastId });
} else {
  toast.success(`Machine ${val} details filled`, { id: toastId });
}
// Always fill the form regardless of has_setup
```
**Fix / Verify (query):** Pre-fill setup fields from the existing setup so the form shows the last-used values. In spinning, `lookupSpinningMachineByNo` returns all setup fields (`count_name`, `tpi`, `speed`, etc.) merged directly — follow the same pattern for each module's relevant setup fields.

**Test:** Remove a machine from setup, then re-add it by machine number → no error, form fills correctly, reactivation succeeds.

---

### ✅ 4 — Active machine with no setup (created via master form) must be addable via setup

> **Spinning reference:** `addSpinningMachine` active-branch (`else { machine = existingMachine; reactivated = false }`) — `src/lib/queries/spinningEntryQueries.js`. It continues past the active-machine check and creates a setup if one is not found, instead of throwing.

**Problem:** When a machine was created via the master form, it became active but had no setup record. `addMachine` in the setup tab checked `is_active = true` and immediately threw "already exists and is active" — even though no setup existed.

**Fix / Verify:** When the machine is active, check whether a setup exists **before** throwing:
```js
if (existingMachine && existingMachine.is_active) {
  const existingSetup = await prisma.<module>_machine_setup.findUnique({
    where: { machine_id: existingMachine.id }
  });
  if (existingSetup) {
    throw new Error(`Machine ${machineData.machine_no} already exists and is active`);
  }
  // No setup yet — create it and return (same as new machine flow)
  const newSetup = await prisma.<module>_machine_setup.create({ data: { machine_id: existingMachine.id, ... } });
  return { machine: existingMachine, setup: newSetup, reactivated: false };
}
```
**Test:** Create a machine via the master form, then add it in setup → succeeds without error.

---

### ✅ 5 — Reactivated machine must NOT appear in past dates

> **Spinning reference:** `addSpinningMachine` — `src/lib/queries/spinningEntryQueries.js`. The function returns immediately after creating/reactivating the machine and setup — there is **no** loop over past headers.

**Problem:** `addMachine` in the setup query was calling `syncNewMachinesToHeader` for **all headers from the last 30 days** after reactivation. Since the sync used the old `is_active: true` filter (no date check), the machine was added to entries from weeks before its `activated_at`.

**Fix / Verify:** Remove the proactive 30-day sync loop entirely. `syncNewMachinesToHeader` is already called on every entry page load — that is sufficient. The `activated_at` date filter ensures the machine only appears from today onwards:
```js
// WRONG — this adds the machine to all past headers regardless of activated_at:
const existingHeaders = await prisma.<module>_production_header.findMany({ ... });
for (const header of existingHeaders) {
  await syncNewMachinesToHeader(header.id, header.shift);
}

// CORRECT — do nothing; the per-page-load sync handles it with the date filter:
return { machine, setup, reactivated: true };
```

**Test:** Reactivate a machine today → open an entry from last week → machine must NOT appear.

---

### ✅ 6 — `reactivateMachine` must set `activated_at: new Date()` and `deactivated_at: null`

> **Spinning reference:** `addSpinningMachine` reactivation block — `src/lib/queries/spinningEntryQueries.js` (`activated_at: new Date()`, `deactivated_at: null`).

**Problem:** The reactivation path in `addMachine` updated `is_active: true` but did not update `activated_at` or clear `deactivated_at`. This left the machine with a stale old `activated_at` and a non-null `deactivated_at`, making it permanently invisible to the date-range filter.

**Fix / Verify:**
```js
await prisma.<module>_machines.update({
  where: { id: existingMachine.id },
  data: {
    is_active: true,
    activated_at: new Date(),    // ← set to today
    deactivated_at: null,        // ← clear removal date
    ...otherFields
  }
});
```
**Test:** Reactivate a machine → verify `activated_at = today` and `deactivated_at = NULL` in the DB.

---

### ✅ 7 — DB: verify `deactivated_at` values after migration

After migration, query the machine table to confirm:
- All active machines have `deactivated_at = NULL`
- All inactive machines have a non-null `deactivated_at` that matches the actual removal date (not just the migration date)

```sql
-- Active machines must have NULL deactivated_at
SELECT machine_no, activated_at, deactivated_at FROM <module>_machines
WHERE is_active = 1 AND deactivated_at IS NOT NULL;
-- ↑ must return 0 rows

-- Inactive machines must have a real deactivated_at
SELECT machine_no, activated_at, deactivated_at FROM <module>_machines
WHERE is_active = 0 AND deactivated_at IS NULL;
-- ↑ must return 0 rows — fix any that show up with the actual removal date
```

**Correct any wrong dates before go-live** — use the actual documented removal date, not `NOW()`:
```sql
UPDATE <module>_machines
SET deactivated_at = '<actual-removal-date>'
WHERE machine_no = '<no>' AND is_active = 0;
```

---

### ✅ 8 — Only machines with a setup entry must appear in production/stoppage entries

> **Spinning reference:** `initializeSpinningProductionDetails` and `syncNewMachinesToSpinningHeader` — `src/lib/queries/spinningEntryQueries.js` (both use `setup: { isNot: null }` in the Prisma where-clause).

**Problem:** When a machine is created via the **master form** it becomes `is_active: true` but has **no setup record** (`breaker_drawing_machine_setup` / `spinning_machine_setup` etc.). Both `initializeDetails` and `syncNewMachinesToHeader` were querying all active machines, so master-only machines (no setup) were automatically inserted into production and stoppage entries without the user ever configuring them via the Machine Setup tab.

**Fix / Verify (`initializeDetails` and `syncNewMachines` queries):**

**Option A — module has a Prisma `setup` relation** (e.g. `autoconer_machines`, `drawing_breaker_machines`):
```js
const machines = await prisma.<module>_machines.findMany({
  where: {
    activated_at: { lte: entryDate },
    OR: [{ deactivated_at: null }, { deactivated_at: { gt: entryDate } }],
    setup: { isNot: null }   // ← works because @relation exists in schema
  },
  ...
});
```

**Option B — module does NOT have a Prisma `setup` relation** (e.g. `spinning_machines`):

Check `prisma/schema.prisma` — if the `<module>_machines` model has no `setup <module>_machine_setup?` line, use the pre-fetch approach instead:
```js
// Pre-fetch machine IDs that have a setup record
const setupRows = await prisma.<module>_machine_setup.findMany({ select: { machine_id: true } })
const machineIdsWithSetup = setupRows.map(s => s.machine_id)

const machines = await prisma.<module>_machines.findMany({
  where: {
    id: { in: machineIdsWithSetup },          // ← replaces setup: { isNot: null }
    activated_at: { lte: entryDate },
    OR: [{ deactivated_at: null }, { deactivated_at: { gt: entryDate } }]
  },
  ...
});
```

**Fix / Verify (stale-row cleanup in `syncNewMachines`):**

**Option A** (has relation) — include setup and check `m.setup`:
```js
const allExistingMachines = await prisma.<module>_machines.findMany({
  where: { id: { in: existingMachineIds } },
  include: { setup: true }
});

const staleDetailIds = existingDetails
  .filter(d => {
    const m = existingMachineMap[d.machine_id];
    if (m?.deactivated_at && new Date(m.deactivated_at) <= entryDate) return true;
    if (m && !m.setup) return true;
    return false;
  })
  .map(d => d.id);
```

**Option B** (no relation) — use `machineIdsWithSetup` from the pre-fetch above:
```js
const allExistingMachines = await prisma.<module>_machines.findMany({
  where: { id: { in: existingMachineIds } }
  // no include: { setup: true } — relation doesn't exist
});

const staleDetailIds = existingDetails
  .filter(d => {
    const m = existingMachineMap[d.machine_id];
    if (m?.deactivated_at && new Date(m.deactivated_at) <= entryDate) return true;
    if (!machineIdsWithSetup.includes(m?.id)) return true;  // ← use pre-fetched IDs
    return false;
  })
  .map(d => d.id);
```

**Test:** Create a machine via the master form (no setup). Open any production entry → the machine must **not** appear. Then add the machine via the Machine Setup tab → from today's entry onwards, the machine appears.

---

### ✅ 9 — New machine `sort_order` must be set to `max + 1`, not left at default 0

> **Spinning reference:** `addSpinningMachine` — `src/lib/queries/spinningEntryQueries.js` (queries `MAX(sort_order)` before creating).

**Problem:** When a new machine is created (via master form or setup tab), `sort_order` was left at the DB default (`0`). Since all existing machines have `sort_order ≥ 1`, the new machine sorted to the **top** of every list instead of the bottom.

**Fix / Verify:** Before the `prisma.<module>_machines.create(...)` call, compute `max + 1`:
```js
const maxSortResult = await prisma.<module>_machines.findFirst({
  orderBy: { sort_order: 'desc' },
  select: { sort_order: true }
})
const nextSortOrder = (maxSortResult?.sort_order || 0) + 1

machine = await prisma.<module>_machines.create({
  data: {
    ...machineData,
    is_active: true,
    activated_at: new Date(),
    sort_order: nextSortOrder    // ← always set explicitly
  }
})
```

This applies to **both** the new-machine path and the master-form `addMachine` function. If the machine is being re-activated (not newly created), `sort_order` should remain unchanged.

**DB fix if already wrong:** If machines were created with `sort_order = 0`, update them manually:
```sql
UPDATE <module>_machines SET sort_order = <correct_value> WHERE machine_no = '<no>';
```

**Test:** Add a new machine → it appears at the **bottom** of the machine list in setup and production entry screens.

---

### ✅ 10 — Add Machine form fields must match the DB schema (master form + setup tab)

> **Reference modules:** Carding, Comber, Breaker Drawing — field audits performed March 2026.

**Problem:** Over time, DB columns are added (e.g. `model`, `installed_date`, `sort_order`) but the corresponding form fields, `newMachine` state keys, lookup handler fills, and Prisma `create`/`update` calls are not updated in sync. This leads to fields silently saving as `NULL` or `[object Object]` appearing in inputs.

**Two places to check per module:**

#### A — Machine Master Form (master page edit/add form)

Compare every column in `<module>_machines` against:
1. The form fields rendered in the add/edit dialog
2. The state object (e.g. `newMachine`, `formData`, `editData`)
3. The Prisma `create` / `update` call in `addXxxMachine` / `updateXxxMachine`

**Common mismatches found:**
| Column | Issue |
|---|---|
| `model` | Present in DB but missing from BD and Comber add-machine dialogs |
| `installed_date` | Present in DB but missing from BD add-machine dialog |
| `sort_order` | Present in Comber DB/Prisma but missing from Carding + BD DB and Prisma schema |
| `make_name` | Rendered as `<Select>` dropdown in Comber but should be free-text `<Input>` |

**Fix pattern:**
```js
// 1. Add missing keys to the initial state
const [newMachine, setNewMachine] = useState({
  machine_no: '', description: '', make_name: 'LMW',
  model: '',           // ← add if missing
  installed_date: '',  // ← add if missing
  ...
})

// 2. Fill missing fields in lookup handler
setNewMachine(prev => ({
  ...prev,
  model: d.model || prev.model,
  installed_date: d.installed_date ? String(d.installed_date).split('T')[0] : prev.installed_date,
}))

// 3. Add form inputs in the dialog
<Input value={newMachine.model} onChange={(e) => setNewMachine(prev => ({ ...prev, model: e.target.value }))} />
<Input type="date" value={newMachine.installed_date} onChange={(e) => setNewMachine(prev => ({ ...prev, installed_date: e.target.value }))} />

// 4. Pass to Prisma create / update
await prisma.<module>_machines.create({
  data: {
    ...
    model: machineData.model || null,
    installed_date: machineData.installed_date ? new Date(machineData.installed_date) : null,
  }
})
```

**Also include in the reset after save:**
```js
setNewMachine({ ..., model: '', installed_date: '' })
```

---

#### B — Machine Setup Tab "Add Machine" Dialog

The setup tab has its own separate "Add Machine" dialog (used to add a machine to the production setup — different from the master form). Check the same four things as above: DB columns vs. dialog fields, state keys, lookup fill, and Prisma call.

**Additional checks specific to the setup tab:**
- The setup table's **editable row columns** must match the `<module>_machine_setup` table columns. Every setup column that the user adjusts per-session (speed, hank, efficiency, delivery, etc.) should have a corresponding editable cell.
- `hank_constant` in setup vs. `sliver_hank` in machine master — these are often stored under different names. Confirm the correct field is read and written for each table.
- If the lookup calls `lookupXxxMachineByNo`, verify it returns all fields that the form needs to auto-fill (including `model`, `installed_date`, `sliver_hank`, etc.).

**Verification query (run against DB before and after):**
```sql
-- Check all DB columns for the machine table
DESCRIBE <module>_machines;
DESCRIBE <module>_machine_setup;

-- Cross-check actual data to see which columns are always NULL (likely missing from form):
SELECT machine_no, model, installed_date, sort_order FROM <module>_machines LIMIT 10;
```

**Test:**
1. Open the Add Machine dialog (both master form and setup tab dialog).
2. Enter a machine number and trigger lookup — verify every field auto-fills correctly (no `[object Object]`, no blank where value exists in DB).
3. Save a new machine, then query the DB row — confirm `model`, `installed_date`, `sort_order`, etc. are saved (not `NULL` unless intentionally left blank by user).
4. Reopen the saved machine for editing — all fields must show the saved values.
