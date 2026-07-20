# Common Implementation Instruction: Shift Config and No Hardcoding

Use this instruction for any production module implementation, refactor, or bug fix.

## Objective
Implement all time-based and formula-based calculations using database-driven configuration and setup values.
Do not hardcode shift time, constants, or formula parameters directly in code paths.

## Reusable Prompt
Apply the following rules in the target module:

1. Shift Time Source Rule
- Always fetch shift timing from `shift_config` using `department_code + shift`.
- Use DB value as primary source for `total_time`, `run_time`, and `work_time` derivations.
- Allow fallback only as a guarded backup when DB data is missing, and clearly mark it as fallback.

2. Formula Input Source Rule
- Read formula inputs from machine setup/master tables (for example: `hank_constant`, `std_efficiency_factor`, `divisor_constant`, `delivery`, machine `speed`).
- Use machine master as source of truth for machine-specific runtime attributes if applicable.
- Do not embed formula constants directly in calculation logic unless it is a fallback.

3. No Direct Hardcoding Rule
- Do not write fixed literals like `510`, `420`, `1693`, `0.85`, `0.14`, `0.0082` directly in active calculation flow.
- If fallback is unavoidable, keep it centralized and documented with comments indicating fallback-only usage.

4. Recalculation Rule
- For every create/update/recalculate path, use the same DB-driven source strategy.
- Ensure stoppage and production recalculations use dynamic shift-config values, not fixed literals.

5. UI/Data Consistency Rule
- UI display text must not claim fixed values if values are dynamic from DB.
- Avoid fixed display defaults that can hide missing or incorrect backend values.

6. Persistence Rule
- Store and update values derived from dynamic config consistently in header/detail records.
- Keep behavior identical across initialization, sync, bulk update, and save flows.

## Acceptance Checklist
- No always-hardcoded shift-time literals in calculation/recalculation paths.
- Shift time resolved from `shift_config` in all relevant flows.
- Formula fields resolved from setup/master DB tables in all relevant flows.
- Any fallback is explicit, minimal, and documented.
- UI text and displayed values align with dynamic DB-driven logic.

## Optional Validation Query Pattern
Use this pattern to validate shift and setup availability:

```bash
mysql -u root -p"<password>" <db_name> -e "SELECT * FROM shift_config WHERE department_code IN ('<DEPT1>', '<DEPT2>') ORDER BY department_code, shift;"
```

And validate setup nulls before rollout:

```bash
mysql -u root -p"<password>" <db_name> -e "SELECT COUNT(*) AS rows_cnt, SUM(hank_constant IS NULL) AS hank_nulls, SUM(delivery IS NULL) AS delivery_nulls, SUM(divisor_constant IS NULL) AS divisor_nulls, SUM(shift_time IS NULL) AS shift_nulls, SUM(std_efficiency_factor IS NULL) AS std_effi_nulls FROM <setup_table>;"
```

## Implementation Note
When extending to new modules, copy this instruction and only replace department/table/function names. Keep the above rules unchanged.
