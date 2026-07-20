# Cross-Module Validation Checklist (modiy-8)

Use this checklist while testing all modules.

## 1) Value modification and persistence
- If a value is changed, save and reload the page/tab.
- Verify the changed value remains the same after reload.
- If a value is not changed, verify the existing value remains unchanged.
- Confirm no other related fields are unintentionally overwritten.

## 2) Decimal value storage
- In every editable numeric cell, enter decimal values (for example: 0.25, 1.75, 99.99).
- Save and reload, then verify the exact decimal precision is retained.
- Check both setup and entry tabs for decimal consistency.
- Verify no truncation, integer conversion, or unexpected rounding occurs.

## 3) Dynamic production recalculation for speed-linked entries
- Identify production fields that depend on speed (for example: Std Prodn, Exp Prodn, Effi-related values).
- Change speed and verify dependent production values recalculate dynamically.
- Confirm recalculation works before save (live preview) and after save/reload (persisted result).
- Verify this behavior across all modules where production is speed-driven.

## Test Result Notes
- Module:
- Screen/Tab:
- Field changed:
- Expected result:
- Actual result:
- Pass/Fail:
- Remarks:
