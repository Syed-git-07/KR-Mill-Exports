# Instructions for Shift-to-Shift Machine Configuration Inheritance

## Goal
Establish a high-fidelity setup cloning sequence between chronologically consecutive production shifts, providing the most accurate default count name and machine parameters during initialization.

---

## Mandatory Pre-Implementation Database Analysis

> [!IMPORTANT]
> **Before implementing the shift-to-shift inheritance in any module**, you **MUST** thoroughly analyze that module's machine setup table and corresponding production details table to verify which setup columns exist and need to be cloned (e.g. `count_name`, `speed`, `tpi`, etc.). 
>
> You must run database analysis queries to inspect the actual tables, verify columns, data types, and check for any custom DB comments or constraints.

### Sample DB Analysis Query Format:
To inspect the tables, columns, and configurations, use the following MySQL query format:
```bash
mysql -u root -p"Alan@2005" kr_production -e "DESCRIBE carding_machine_setup; DESCRIBE carding_production_detail;"
```
Ensure you trace the fields carefully to guarantee that you copy all setup configurations accurately.

---

## Required Architecture Pattern (Common to All Modules)

### 1. Shift-to-Shift Production Detail Setup Cloning Sequence
To provide the most accurate default count name and machine configuration setup when a user initializes a new shift entry, the details generation logic must inherit from the immediate chronological prior shift's production details, rather than only relying on the generic daily template setups.

#### Priority Order for Setup Cloning on target `(Date D, Shift S)`:
1. **Target is Shift 2 `(D, 2)`**: 
   - Check if production details exist for **Shift 1 of the current date `(D, 1)`**.
   - If they exist, copy setup configurations (e.g., `count_name`) directly from **Shift 1 details**.
2. **Target is Shift 3 `(D, 3)`**:
   - Check if production details exist for **Shift 2 of the current date `(D, 2)`**.
   - If they exist, copy setup configurations (e.g., `count_name`) directly from **Shift 2 details**.
3. **Target is Shift 1 `(D, 1)`**:
   - Check if production details exist for **Shift 3 of the previous date `(D-1, 3)`**.
   - If they exist, copy setup configurations (e.g., `count_name`) directly from **Shift 3 details of the previous date**.
4. **Fallback (Unavailable Previous Shift/Date)**:
   - If the chronological prior shift's details are not available (e.g. they were not entered/initialized), look back in the database for the **most recent chronologically entered date/shift header & details** and copy setups from that record.
   - If absolutely no prior details exist (clean database), fall back to using the generic daily setup values for `Date D` (which are created in the setup table).

---

### 2. Automation & UX Rule
- This cloning sequence must happen **automatically** and **implicitly** in the background when initializing or opening a date/shift entry page.
- Under no circumstances should any explicit button, modal warnings, or confirmation dialogs be presented to the user. It must be a seamless, default behavior.

---

### 3. Once-Only Initial Cloning & Date-Scoped Persistence
- The setup cloning must run **only once** at the exact moment of entry initialization (when the entry page for the date/shift is opened/created for the first time).
- Once the production details are created, they are stored independently for that specific date and shift in the database.
- Any subsequent edits or updates to the count name, session number, or machine configuration on this entry must be persisted solely for this date and shift. They must **never** reflect back to or overwrite the prior source shifts, nor affect any other date's records.

---

### 4. Inline Count Dropdown UX Pattern (Common to All Machine Setup Tabs)
To provide the most efficient and seamless experience for machine setup configuration changes directly inside the table grid:
- **Inline Dropdown Grid Cell**: The **Count** (or mixing/count_name) column in any setup grid (e.g. Carding, Comber, Drawing, Spinning, Autoconer) must be rendered as a search-capable, keyboard-navigable `<EnterSelect>` dropdown populated from the respective count master data, instead of static text or raw input.
- **Auto-Fill Sliver Hank / Parameters**: Selecting a count in the inline dropdown must automatically:
  - Retrieve the sliver hank or default count parameters (e.g., `sliver_hank` for Carding/Comber/Drawing, or act_count/speed/tpi for Spinning) from the count master.
  - Auto-fill matching fields (like `hank_constant`) in the table row.
  - Instantly recalculate standard production (`std_prodn`) dynamically in the frontend.
- **Unified Save Transaction**: When the user clicks the **Save** button:
  - The frontend passes all edited setup fields (including the new count name).
  - The backend intercepts the count edit, updates the machine's mixing directly in the machine master table (e.g. `carding_machines.prodn_mixing`), and saves other configuration setups to the machine setup table (e.g. `carding_machine_setup`) in a single unified database action.

---

### 5. Database Reference for Verification
If you need to analyze the database config or entries manually:
```bash
mysql -u root -p"Alan@2005" kr_production -e "SELECT * FROM shift_config WHERE department_code IN ('LAPFORMER', 'BREAKER') ORDER BY department_code, shift;"
```
