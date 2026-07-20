# Instructions for Implementing Date-Based Machine Setup

## Goal
Resolve the issue where Machine Setup changes affect historical data in the past. 

### Critical Data Rule (Strict Bidirectional Isolation)
- **Modifying the PAST via the CURRENT/FUTURE is prohibited**: Under no circumstances should edits made today or in the future overwrite or modify machine setups for past dates. We must strictly preserve the historical integrity of past setups.
- **Modifying the FUTURE via the PAST is prohibited**: Similarly, if a user goes back to edit historical entries or setup records, those edits must **never** modify or propagate forward to affect setups of current or future dates.
- **Strict Single-Date Scope**: Every setup change must be strictly date-scoped and isolated to the specific target `entry_date` only.

---

## Required Architecture Pattern (Common to All Modules)

### 1. Database Schema Update
For every module's machine setup table (e.g., `spinning_machine_setup`), we must add an `entry_date` field, a `shift` column, and a combined unique constraint.

**Prisma Example (`prisma/schema.prisma`):**
```prisma
model spinning_machine_setup {
  id                 String    @id @default(dbgenerated("(uuid())")) @db.Char(36)
  machine_id         String    @db.Char(36)
  entry_date         DateTime  @db.Date
  shift              Int       @default(1)
  // ... other setup fields (count_name, speed, tpi, etc.)
  created_at         DateTime? @default(now()) @db.DateTime(0)
  updated_at         DateTime? @default(now()) @db.DateTime(0)

  @@unique([machine_id, entry_date, shift], name: "idx_spinning_machine_setup_date")
}
```

*Note: For existing installations/migrations, we must write a migration or fallback script to populate `entry_date` and `shift` for pre-existing records (e.g., to the current date or a fixed historic fallback date, and default shift to 1).*

---

### 2. Backend Query & Inheritance Layer
Instead of fetching daily setups, retrieval must be shift-specific. We will implement a robust `getOrCreateMachineSetups(entryDate, targetShift)` query:

1. **Exact Match**: Attempt to fetch setup records for the target `entryDate`.
2. **Implicit Shift-Based Inheritance**: If no setups exist at all for `entryDate`, automatically copy all setup parameters (speed, counts, tpi, traveller count, doff loss, etc.) from the **most recent previous date last shift (Shift 3)** by default.
   - Do not ask for user confirmation; perform this copy implicitly and automatically in the background when initializing.
   - Override the target `run_time` based on the targeted shift using fixed proper shift times:
     - **Shift 1**: 510 minutes (fixed)
     - **Shift 2**: 510 minutes (fixed)
     - **Shift 3**: 420 minutes (fixed)
3. **Initialization Fallback**: If no setups exist at all (e.g., a clean database), load all active machines from the module's machine master and create default setup records for `entryDate` using the corresponding shift's fixed duration.

**Reference Implementation Pattern (Queries):**
```javascript
export async function getOrCreateSpinningMachineSetups(entryDate, targetShift) {
  const dateObj = new Date(entryDate);
  const shiftNum = parseInt(targetShift);
  
  // Resolve the fixed run_time based on targetShift:
  // Shift 1: 510, Shift 2: 510, Shift 3: 420
  const targetShiftTime = shiftNum === 3 ? 420 : 510;

  // 1. Try to find setups for this exact date
  let setups = await prisma.spinning_machine_setup.findMany({
    where: { entry_date: dateObj }
  });
  
  if (setups.length > 0) {
    return setups;
  }
  
  // 2. Fallback: Inherit from the most recent previous date
  const latestPreviousSetup = await prisma.spinning_machine_setup.findFirst({
    where: { entry_date: { lt: dateObj } },
    orderBy: { entry_date: 'desc' }
  });
  
  if (latestPreviousSetup) {
    const prevSetups = await prisma.spinning_machine_setup.findMany({
      where: { entry_date: latestPreviousSetup.entry_date }
    });
    
    const cloneData = prevSetups.map(s => {
      const { id, created_at, updated_at, ...rest } = s;
      return {
        ...rest,
        entry_date: dateObj,
        run_time: targetShiftTime // Target shift fixed proper time (510 or 420)
      };
    });
    
    await prisma.spinning_machine_setup.createMany({
      data: cloneData
    });
    
    return prisma.spinning_machine_setup.findMany({
      where: { entry_date: dateObj }
    });
  }
  
  // 3. Fallback: Initialize default setups for all active machines
  const activeMachines = await prisma.spinning_machines.findMany({
    where: { is_active: true }
  });
  
  const defaultSetups = activeMachines.map(m => ({
    machine_id: m.id,
    entry_date: dateObj,
    count_name: '',
    act_count: 69.50,
    tpi: 13.00,
    allocated_spindles: m.allocated_spindles || 1104,
    tw_con: 4,
    doff_loss: 0.70,
    c_waste_percent: 0.90,
    speed: 0,
    session_no: 1,
    run_time: targetShiftTime, // Target shift fixed proper time
    efficiency: 0.985,
    conversion_factor: 2.20456
  }));
  
  if (defaultSetups.length > 0) {
    await prisma.spinning_machine_setup.createMany({
      data: defaultSetups
    });
  }
  
  return prisma.spinning_machine_setup.findMany({
    where: { entry_date: dateObj }
  });
}
```

---

### 3. Scoped Syncing to Protect Past & Future Data
When saving changes (e.g., updating a `count_name` in machine setup), the application must sync that count name to the corresponding production details.

**CRITICAL DATA INTEGRITY RULE (Strict Bidirectional Isolation):**
- Syncing must **NEVER** affect past or future dates.
- Both single-row updates (`updateSpinningMachineSetup`) and batch updates (`batchUpdateSpinningMachineSetups`) must target only the exact target `entry_date` of the setup row being edited.
- Modifying a setup on date `D` must only synchronize to the production details on date `D`. It must **never** propagate or bleed into other dates (past or future).

**Correct Scoped Syncing Pattern:**
```javascript
// Syncing should only target production details for the specific target date!
if (data.count_name && result.machine_id && result.entry_date) {
  const headers = await prisma.spinning_production_header.findMany({
    where: { entry_date: result.entry_date },
    select: { id: true }
  });
  
  const headerIds = headers.map(h => h.id);
  if (headerIds.length > 0) {
    await prisma.spinning_production_detail.updateMany({
      where: { 
        machine_id: result.machine_id,
        header_id: { in: headerIds }
      },
      data: { count_name: data.count_name }
    });
  }
}
```

---

### 4. Frontend Component Adaptation
The Setup Tab must receive and react to the current `entryDate`:

- Accept `entryDate` as a required prop.
- Include `entryDate` in the load query (e.g., passing it to `getSpinningMachineSetupsAction(shift, entryDate)`).
- When a user changes the date in the main UI, the Setup Tab must discard local edits (with confirmation) and load setups for the newly selected date.

---

### 5. Count Selection & Auto-Population (Spinning Module)
When a user selects or modifies the **Count** (`count_name`) in the Machine Setup grid (either on a single machine or via the bulk Count Change Dialog), the other related setup fields must be automatically populated from the Count Master (`spinning_counts`):
- **TPI**: Auto-populated from `spinning_counts.tpi` (parseFloat)
- **TW.Con**: Auto-populated from `spinning_counts.tw_con` (parseInt)
- **Doff Loss**: Auto-populated from `spinning_counts.doff_loss` (parseFloat)
- **C.Waste %**: Auto-populated from `spinning_counts.waste_percent` (parseFloat)
- **Speed**: Auto-populated from `spinning_counts.speed` (parseInt)
- **Actual Count** (`act_count`): Auto-populated from `spinning_counts.act_count` (parseFloat)

*Note: The **Efficiency %** (`efficiency`) is an independent edit and is not auto-populated when count changes. Furthermore, the user must always be allowed to edit any of these parameters (`Speed`, `TPI`, `TW.Con`, `Doff Loss`, `C.Waste %`, `Efficiency %`) **independently** in the grid, and all overridden values must be persisted uniquely and independently based on the active `entry_date`.*

---

## Implementation Checklist

1. [ ] **Prisma Schema Migration**: Add `entry_date` field and `@@unique([machine_id, entry_date])` to the target `_machine_setup` table.
2. [ ] **Queries**: Implement the `getOrCreateMachineSetups` inheritance flow.
3. [ ] **Date Parameter Propagation**: Update all actions and helper queries (`get`, `update`, `batchUpdate`, `upsert`) to accept and pass `entryDate`.
4. [ ] **Scoping Sync Logic**: Refactor setup-to-detail syncing logic so it only affects production details of the corresponding date.
5. [ ] **Frontend Integration**: Pass `entryDate` to the tab, hook it up to the load query, and test that switching dates loads independent setups correctly.
