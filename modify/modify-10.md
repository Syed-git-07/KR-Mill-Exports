# Modify 10 - Update/Cancel Across Tabs (Entry Modules)

## Goal
Provide a consistent "Update" (save) and "Cancel" (discard) workflow that works across Production, Stoppage, and Machine Setup tabs in every entry module.

## Expected Behavior
1. "Update" saves all unsaved edits across all tabs, even if edits were made in different tabs.
2. "Cancel" discards all unsaved edits across all tabs and reloads data.
3. Cross-tab recalculation must use draft edits so values update live before save.
4. Entry page button styling should match the Spinning module (top "Save Changes" and footer "Update"/"Cancel").

---

## Required Architecture Pattern

### 1. Shared drafts at page level
Maintain a single drafts object in the entry page:
- production
- stoppage
- setup

Example:
```js
const [sharedDrafts, setSharedDrafts] = useState({
  production: {},
  stoppage: {},
  setup: {}
})
```

### 2. Tab props (required)
Each tab must accept:
- `sharedDraftEdits`
- `onSharedDraftEditsChange`

Tabs must publish edits to parent using `onSharedDraftEditsChange` when provided.

### 3. Cross-tab draft dependencies
Pass drafts between tabs:
- Production receives `setupDraftEdits` and (when relevant) `stoppageDraftEdits`
- Stoppage receives `setupDraftEdits` and `productionDraftEdits`
- Setup receives only `sharedDraftEdits` and `onSharedDraftEditsChange`

### 4. Update (Save) button behavior
Entry page "Update" must:
- call `saveChanges()` on all three tab refs
- aggregate success/failure and show a single toast
- refresh data after save

### 5. Cancel button behavior
Entry page "Cancel" must:
- call `discardChanges()` on all three tab refs
- clear shared drafts state
- reload data

### 6. Draft-safe recalculation
Tabs must recompute values using:
- effective setup (setup + setup drafts)
- effective production data (production + production drafts)
- effective stoppage data (stoppage + stoppage drafts)

### 7. Key matching
Draft lookup must be robust:
- support numeric/string keys
- when possible, include `machine_id` in setup drafts so other tabs can map draft edits

---

## Implementation Checklist (per module)
1. Entry page has shared drafts state for production/stoppage/setup.
2. Tabs receive shared drafts and publish edits to parent.
3. Entry page "Update" saves all tabs.
4. Entry page "Cancel" discards all tabs and clears drafts.
5. Cross-tab draft inputs are used for recalculation before save.
6. Draft key lookup is resilient to id format mismatches.

---

## Reference Implementation
Use the Spinning module after Modify-10 as the working reference.
