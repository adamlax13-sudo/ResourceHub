# ServiceDetailPanel Extraction — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the full service editing panel (header, actions, form, history, AI enrichment) into a shared component used by both Services and Review pages, giving Review the same complete editing experience as Services.

**Architecture:** Create `ServiceDetailPanel.tsx` as a self-contained component that owns all service-editing queries, mutations, and UI. It exposes an `onDirtyChange` callback so parents can track unsaved edits. Services.tsx delegates its detail panel to this component. Review.tsx renders it for review-flagged items with `highlightFields` + `banner` props, keeping its own approve/reject buttons around it.

**Tech Stack:** React, TanStack Query, Wouter, Shadcn/ui, Tailwind CSS

**Review findings addressed (round 1):**
- Critical: `onDirtyChange` callback prop added to preserve dirty-guard in Services list navigation
- Important: Review approve/reject buttons hidden for review-flagged items (ServiceDetailPanel has its own save flow)
- Important: `review` option added to Review type filter dropdown
- Suggestion: `formatRelativeTime` duplication noted as follow-up, not blocking

**Review findings addressed (round 2):**
- Important: `onSaveSuccess` callback prop added so Review page can invalidate its query cache after service edits
- Suggestion: ChangeTypeBadge updated to handle "review" type with blue badge
- Suggestion: Duplicate beforeunload handler accepted as harmless — not worth the complexity of a `skipBeforeUnload` prop

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `client/src/components/admin/ServiceDetailPanel.tsx` | Modify (already created) | Self-contained service editor. Add `onDirtyChange` callback prop. |
| `client/src/pages/admin/Services.tsx` | Modify | Remove inline detail panel (~320 lines), replace with `<ServiceDetailPanel>`. Keep list/filter/pagination. Wire `onDirtyChange` for dirty guard. |
| `client/src/pages/admin/Review.tsx` | Modify | For review-flagged items, render `<ServiceDetailPanel>`. Hide approve/reject for review type. Keep diff/create/deactivate views for other types. Add "review" to type filter. |

---

### Task 1: Add onDirtyChange prop to ServiceDetailPanel

**Files:**
- Modify: `client/src/components/admin/ServiceDetailPanel.tsx`

- [ ] **Step 1: Add `onDirtyChange` and `onSaveSuccess` to props interface**

```typescript
export interface ServiceDetailPanelProps {
  serviceId: number;
  highlightFields?: string[];
  banner?: React.ReactNode;
  /** Called when the edit form's dirty state changes (unsaved edits) */
  onDirtyChange?: (dirty: boolean) => void;
  /** Called after a successful service update — lets parent invalidate its own queries */
  onSaveSuccess?: () => void;
}
```

- [ ] **Step 2: Pass `onDirtyChange` through to ServiceForm**

In the component body, destructure the new props and pass `onDirtyChange` to the `<ServiceForm>` component where `onDirtyChange={setIsDirty}` currently is. Change to:

```typescript
onDirtyChange={(dirty) => {
  setIsDirty(dirty);
  onDirtyChange?.(dirty);
}}
```

- [ ] **Step 3: Call `onSaveSuccess` in updateMutation**

In the `updateMutation.onSuccess` callback, add:

```typescript
onSuccess: () => {
  toast({ title: "Service updated successfully" });
  queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
  onSaveSuccess?.();
},
```

- [ ] **Step 4: Build and verify**

Run: `npm run build 2>&1 | tail -5`

Expected: Build succeeds.

---

### Task 2: Refactor Services.tsx to use ServiceDetailPanel

**Files:**
- Modify: `client/src/pages/admin/Services.tsx`

The goal: replace ~320 lines of inline detail panel code with a single `<ServiceDetailPanel>` call. Keep the list panel, filters, pagination, URL sync, and the dirty-guard on list navigation.

- [ ] **Step 1: Add import**

```typescript
import { ServiceDetailPanel } from "@/components/admin/ServiceDetailPanel";
```

- [ ] **Step 2: Keep isDirty state for list navigation guard**

Keep these in the component (do NOT remove):
```typescript
const [isDirty, setIsDirty] = useState(false);
const isDirtyRef = useRef(false);
```
And the beforeunload handler. These are used by the list item click handler (line ~501-506) to warn about unsaved changes.

- [ ] **Step 3: Replace the detail variable**

Find the `const detail = selectedId ? (` block (line ~607) through `) : null;` (line ~931).

Replace the ENTIRE block with:
```typescript
const detail = selectedId ? (
  <ServiceDetailPanel
    serviceId={selectedId}
    onDirtyChange={(dirty) => {
      setIsDirty(dirty);
      isDirtyRef.current = dirty;
    }}
  />
) : null;
```

- [ ] **Step 4: Remove unused detail-only code**

Remove these sections now handled by ServiceDetailPanel:
- Detail query (`useQuery` for `/api/admin/services/${selectedId}`)
- History query (`useQuery` for history)
- Enrichment query (`useQuery` for enrichment)
- Duplicate-of query (`useQuery` for `service?.duplicateOf`)
- All 9 mutations (update, deactivate, restore, regenEmbedding, geocode, flagReview, checkDuplicates, markDuplicate, clearDuplicate)
- Detail-only state: `showHistory`, `flagReason`, `showFlagDialog`
- Duplicate state: `showDuplicates`, `duplicates`
- `hasStaleEmbedding` check
- Detail-only interfaces: `ServiceDetail`, `AiEnrichmentRecord`, `EnrichmentData`, `HistoryEntry`
- Duplicate reset effect
- `const service = detailData?.service`

**Keep:** `isDirty`, `isDirtyRef`, beforeunload handler, `formatRelativeTime` (used by list items).

- [ ] **Step 5: Clean up unused imports**

Remove imports only used by the detail panel:
- `useMutation`
- `History`, `Trash2`, `RotateCcw`, `RefreshCw`, `MapPin`, `Flag`, `Sparkles`, `GitCompare`, `ExternalLink`
- `ServiceForm`, `ServiceFormData`
- `Card`, `CardContent`, `CardHeader`, `CardTitle`

Keep all list-related imports. Check `AlertTriangle` — remove only if not used elsewhere.

- [ ] **Step 6: Build and verify**

Run: `npm run build 2>&1 | tail -10`

Expected: Build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/admin/Services.tsx client/src/components/admin/ServiceDetailPanel.tsx
git commit -m "refactor(admin): extract ServiceDetailPanel from Services.tsx

Moves all service detail editing (~320 lines) into a shared component.
Services.tsx delegates to ServiceDetailPanel with onDirtyChange callback
to preserve the unsaved-changes guard on list navigation."
```

---

### Task 3: Integrate ServiceDetailPanel into Review.tsx

**Files:**
- Modify: `client/src/pages/admin/Review.tsx`

The goal: review-flagged items get the full ServiceDetailPanel. Non-review items (update/create/deactivate) keep their existing diff view + approve/reject buttons.

- [ ] **Step 1: Add import**

```typescript
import { ServiceDetailPanel } from "@/components/admin/ServiceDetailPanel";
```

- [ ] **Step 2: Add "review" to the type filter dropdown**

Find the type filter `<select>` (around line ~215). Add:
```html
<option value="review">Review</option>
```

- [ ] **Step 3: Add "review" case to ChangeTypeBadge**

Find the `ChangeTypeBadge` function (near bottom of Review.tsx). Add before the generic fallback:

```tsx
if (type === "review") {
  return <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">REVIEW</Badge>;
}
```

- [ ] **Step 4: Update detail rendering for review-type items**

In the `detail` JSX variable, replace the content-based-on-type section. The structure should be:

```tsx
{/* Content based on type */}
{isReviewFlag && request.serviceId ? (
  <ServiceDetailPanel
    serviceId={request.serviceId}
    highlightFields={missingFields}
    onSaveSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/review"] })}
    banner={
      missingFields.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <span className="text-sm text-amber-700 font-medium">Missing fields:</span>
          {missingFields.map((f) => (
            <Badge key={f} className="bg-amber-100 text-amber-700 border-amber-300 text-[10px]">
              {FIELD_LABELS[f] || f}
            </Badge>
          ))}
        </div>
      ) : undefined
    }
  />
) : editMode ? (
  <ServiceForm
    initialData={request.proposedChanges as any}
    onSubmit={(data) => editApproveMutation.mutate({ id: request.id, data })}
    isPending={editApproveMutation.isPending}
    submitLabel="Save & Approve"
  />
) : request.changeType === "update" && Object.keys(diffChanges).length > 0 ? (
  <DiffView changes={diffChanges} />
) : /* ... rest of existing cases ... */}
```

- [ ] **Step 5: Hide approve/reject buttons for review-flagged items**

The action buttons block (`{!editMode && (...)}`) should be wrapped with an additional check:

```tsx
{!editMode && !isReviewFlag && (
  <div className="flex gap-2 pt-4 border-t border-gray-200">
    {/* Approve, Edit & Approve, Reject buttons */}
  </div>
)}
```

ServiceDetailPanel has its own save flow. The review item can be marked as resolved separately (approve after editing via the panel).

For review-flagged items, add a simple "Mark Resolved" button below the ServiceDetailPanel:

```tsx
{isReviewFlag && (
  <div className="flex gap-2 pt-4 border-t border-gray-200">
    <Button
      onClick={() => approveMutation.mutate(request.id)}
      disabled={approveMutation.isPending}
      className="bg-emerald-600 hover:bg-emerald-700 text-white"
    >
      {approveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
      <CheckCircle className="h-4 w-4 mr-1" />
      Mark Resolved
    </Button>
    <Button
      variant="outline"
      onClick={() => setRejectDialogOpen(true)}
      className="border-red-300 text-red-500 hover:bg-red-50"
    >
      <XCircle className="h-4 w-4 mr-1" />
      Dismiss
    </Button>
  </div>
)}
```

- [ ] **Step 6: Remove workaround code**

- Remove the "Open Full Editor" `Link` button (added earlier as a workaround)
- Remove the `useEffect` that auto-sets `editMode` for review items — no longer needed
- Remove `currentServiceData` handling from the detail interface (ServiceDetailPanel fetches its own data)
- Keep `ServiceForm` import — still used for non-review edit mode
- Keep `Link` import if used elsewhere; remove `ExternalLink` if only used for the removed button

- [ ] **Step 7: Build and verify**

Run: `npm run build 2>&1 | tail -10`

Expected: Build succeeds. Review page shows:
- Review-flagged items: full ServiceDetailPanel + "Mark Resolved" / "Dismiss" buttons
- Update/create/deactivate items: existing diff view + approve/reject buttons (unchanged)
- Blue REVIEW badge in list, "Review" in type filter dropdown
- Saving a service from Review page refreshes the review list

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/admin/Review.tsx
git commit -m "feat(admin): Review uses full ServiceDetailPanel for flagged items

Review-flagged items now get the same editing experience as Services:
actions (geocode, embedding, duplicates), history, AI enrichment, and
full edit form with highlighted missing fields. Mark Resolved/Dismiss
buttons replace approve/reject for review items."
```

---

### Task 4: Final verification and push

- [ ] **Step 1: Full build**

Run: `npm run build 2>&1 | tail -5`

- [ ] **Step 2: Manual smoke test**

Verify in browser:
1. Services page: select a service → full detail panel with all actions, history, edit form, AI enrichment
2. Services page: start editing, then click a different service → dirty guard prompt appears
3. Review page: flag a service from Quality issues → navigate to Review → click flagged item → full ServiceDetailPanel with missing fields banner and amber highlights
4. Review page: click "Mark Resolved" → item disappears from queue
5. Review page: select a non-review item (update/create) → existing diff view + approve/reject buttons work as before
6. Review page: type filter dropdown includes "Review" option

- [ ] **Step 3: Push**

```bash
git push origin main
```
