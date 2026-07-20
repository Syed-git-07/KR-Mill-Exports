# Common UI Instruction: Clean Table Input Display for Entry Modules

Use this instruction in any module that has entry tables for:
- Production
- Stoppage
- Machine Setup

## Objective
Make table values clearly visible and easy to edit.
Prevent overlap, wrapping, and visual noise from inner input borders.
Keep editing experience consistent across all three entry tabs.

## Reusable Prompt
Apply the following rules in the target module:

1. Column Visibility Rule
- Ensure numeric and key text values are readable in every row.
- Prevent value overlap between adjacent columns.
- Keep values in one line for table cells where wrapping hurts readability.

2. No-Wrap and Width Rule
- Use stable column sizing for data-heavy grids.
- Use non-wrapping display for headers and numeric cells.
- For long text columns, apply controlled truncation instead of layout breakage.
- If a cell contains larger content that must be fully visible, increase that column width and allow horizontal scrolling.
- Prefer full value display for important business fields (for example, Count/Name columns) when truncation hides critical meaning.

3. Clean Input Cell Rule
- Remove distracting inner input borders inside table cells.
- Keep a clean cell-like edit style: no extra inner box shadow/ring by default.
- Maintain clear focus behavior while keeping the visual style minimal.

4. Numeric Readability Rule
- Use consistent numeric alignment and tabular digit rendering for number columns.
- Keep decimal values legible without clipping or jumpy width shifts.

5. Scroll and Sticky Header Rule
- Horizontal scroll must preserve readability of all columns.
- Sticky header should align with body columns correctly after style updates.

6. Consistency Rule (Three Tabs)
- Apply the same visual pattern in Production, Stoppage, and Machine Setup tables.
- Do not keep one tab in old style while others use new style.

7. Scope Safety Rule
- Do not alter formulas, calculations, DB fetch logic, or save behavior.
- This instruction is for UI layout and input presentation only.

8. Editing Highlight Rule (Focus Only)
- While a cell is actively being edited (focused), highlight it with orange background and white text.
- Apply this focus-only highlight consistently for manual numeric inputs and employee search inputs.
- Remove highlight automatically when focus leaves the cell.
- Highlight must match full rectangular table-cell shape (edge-to-edge), not a smaller rounded input patch.
- Avoid rounded corners and extra inner cell padding on editable cells when highlight is active.

## Pre-Implementation Checklist
- Identify columns that frequently overlap, wrap, or clip values.
- Identify manual-input cells that show extra inner borders.
- Identify text columns that should truncate instead of expanding.

## Acceptance Checklist
- Values are visible without overlap in Production table.
- Values are visible without overlap in Stoppage table.
- Values are visible without overlap in Machine Setup table.
- Large cell content is fully visible where required, with horizontal scroll support when table width increases.
- Manual input cells appear clean (no distracting inner border box).
- Focused editable cell shows orange highlight with white text only during editing.
- Focus highlight matches rectangular cell shape (no rounded mismatch).
- Numeric columns are easy to read and align consistently.
- Editing remains smooth with no regression in existing save/update flow.

## Validation Scenario (Manual)
1. Open each tab: Production, Stoppage, Machine Setup.
2. Check long rows and dense numeric columns at normal zoom.
3. Enter/edit values in multiple cells and verify visibility while typing.
4. Verify no overlapping text and no unwanted wrapping in critical cells.
5. Verify clean cell appearance and proper focus while editing.
6. Save and confirm behavior remains unchanged (only UI improved).

## Implementation Note
Reuse this instruction for future modules with grid-based entry forms.
Keep rules generic and apply by adapting only file paths and column names.
