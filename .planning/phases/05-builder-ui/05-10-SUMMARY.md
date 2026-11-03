---
phase: 05-builder-ui
plan: 10
subsystem: course-builder
tags: [builder, bulk-actions, selection, accessibility, keyboard]
requires: [05-06, 05-07, 05-09]
provides:
  - "Pure selection and bulk helpers in inertia/lib/builder_tree.ts (quickSelect, pruneSelection, selectedItems, topLevelItems, bulkMoveTargets, applyBulkMove, applyBulkPatch, bulkDeleteBlockers, bulkDeletedIds, mergeBulkResult)"
  - "MoveTargetList shared by the per-item and the bulk move dialogs"
  - "SelectionControls and BulkActionBar (inertia/components/builder/bulk-action-bar.tsx)"
  - "Selection state and six bulk SaveOps in the builder page"
affects: [05-08]
tech-stack:
  added: []
  patterns:
    - "Bulk SaveOp: items fixed at enqueue (tree order), tokens read at run time with a snapshot fallback for optimistically deleted rows, response merged by mergeBulkResult through commitSections / commitContents"
    - "Selection pruned inside commitSections / commitContents (functional updater, returns the same Set when nothing changed)"
key-files:
  created:
    - inertia/components/builder/move-target-list.tsx
    - inertia/components/builder/bulk-action-bar.tsx
    - tests/browser/builder_bulk.spec.ts
  modified:
    - inertia/lib/builder_tree.ts
    - tests/unit/builder_tree.spec.ts
    - inertia/components/builder/item-actions-menu.tsx
    - inertia/pages/courses/builder.tsx
decisions:
  - "mergeBulkResult takes an optional third argument `known` (the structure at enqueue time): an affected row that was known then but is absent locally now was removed by a later queued op and is not re-added; only truly new rows (copies) are added"
  - "Every selected item is sent to the server (not only top-level ones): 05-09 normalises move and duplicate itself, and delete needs the full sub-tree selected"
  - "bulkDeleteBlockers mirrors the server: a selected section blocks when any section or content of its whole sub-tree is unselected (BULK_DELETE_ALLOWS_FULL_SUBTREE = true)"
  - "Focus after a bulk delete or 'Désélectionner' goes to the master checkbox (id bulk-select-all) from the bar itself (AlertDialog onCloseAutoFocus / click handler), because the bar unmounts as soon as the selection empties"
metrics:
  duration: "~1h"
  completed: 2026-11-03
  tasks: 4
  files: 7
---

# Phase 05 Plan 10: Bulk selection UI Summary

Teachers can now tick sections and contents, select all or none, or use a quick selection (published, unpublished, by content type). The count is announced politely. A bar then offers Publier, Dépublier, Disponibilité…, Décaler les dates…, Déplacer vers…, Dupliquer, Supprimer… and Désélectionner. Each action goes through the 05-03 save queue to the 05-09 endpoints. Publish, availability, move and delete show at once and roll back on failure. The server response is merged so the next single edit uses fresh tokens.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 90b2172 | feat(builder): add pure selection and bulk action helpers |
| 2a | 0f6c00f | refactor(builder): extract the move destination list |
| 2b | 3e091a1 | feat(builder): add selection controls and bulk action bar |
| 3 | 620f012 | feat(builder): wire selection and bulk actions into the builder |
| 4 | 3bada53 | test(builder): cover selection and bulk actions in the browser |
| 2 (follow-up) | dd08988 | fix(builder): keep the bulk delete button at AA contrast |
| 4 (follow-up) | e4d84f5 | test(builder): use exact locators in bulk browser spec |

## Final component props

```ts
SelectionControls({ total, selectedCount, onSelectAll, onClear, onQuickSelect }: {
  total: number; selectedCount: number
  onSelectAll(): void; onClear(): void; onQuickSelect(q: QuickSelection): void })

BulkActionBar({ count, deleteBlocked, moveTargets, onPublish, onUnpublish, onAvailability,
  onShift, onMove, onDuplicate, onDelete, onClear }: {
  count: number; deleteBlocked: boolean; moveTargets: MoveTarget[]
  onPublish(): void; onUnpublish(): void
  onAvailability(v: { availableFrom: string | null; availableUntil: string | null }): void
  onShift(v: { days: number } | { from: string; to: string }): void
  onMove(parentId: number | null): void
  onDuplicate(): void; onDelete(): void; onClear(): void })

MoveTargetList({ idBase, targets, onChoose }: {
  idBase: string; targets: MoveTarget[]; onChoose(parentId: number | null): void })
```

`bulk-action-bar.tsx` also exports `SELECT_ALL_ID = 'bulk-select-all'`. All the bar's ids use the fixed `bulk-` prefix: `bulk-delete-reason`, `bulk-availability-error`, `bulk-shift-error`, `bulk-shift-help`, and the move reasons `bulk-target-<id|root>-reason`.

## 05-09 response shapes

No deviation. The client reads `{ sections, contents, affected, deleted }` as documented. Dates go out as `YYYY-MM-DD` straight from `<input type="date">`, with `null` for an empty field, and never as `toISO()`. 409 and 422 errors (including the VineJS `errors[0].message` and `E_NOT_EMPTY`) are already mapped by `sendJson`. The indicator shows them, with "Recharger" on a conflict.

## Browser specs

**Not run locally.** 05-02 records `BROWSER_LOCAL: blocked` because the Playwright headless shell build 1248 is missing. `tests/browser/builder_bulk.spec.ts` typechecks and lints. CI `e2e.yml` and the 05-08 checkpoint cover it, together with `builder.spec.ts`, which proves that 05-06 and 05-07 still pass with the selection in place. The spec's 11 tests:

1. selection, select all, quick selections;
2. select all then Publier (2 interactions), then Dépublier, with exactly 2 audit rows;
3. availability, including the end-before-start refusal with no request sent;
4. date shift by days, then by anchor dates;
5. move with the root target disabled and the plan order kept;
6. duplicate (draft copy right after the original, `copied_from_id`);
7. delete blocked, then confirmed, with focus back on the master checkbox;
8. token race;
9. Space on the checkbox versus Space on the handle;
10. keyboard only;
11. axe in three states.

## Verification

- `node ace test unit functional` (sqlite, PORT=3460): 339 passed. That is 329 before this plan plus 10 new unit tests. Temp DB deleted.
- `bun run typecheck`, `bun run lint`, `bun run check:debt`: exit 0.
- Filtered client tsc gate (`inertia/(pages/courses/builder|components/builder/|lib/builder_|lib/save_queue)`): 0. The other client tsc errors were already there, in unrelated pages and `app/`.
- Grep gates pass:
  - 10 exported helpers and 0 imports in `builder_tree.ts`;
  - 0 `<ul` in `item-actions-menu.tsx`;
  - 0 `role="status"` / `role="toolbar"` / `useId` / `modal={false}` in the bar;
  - 0 `dangerouslySetInnerHTML` under `components/builder/`;
  - ref assignments only inside `commitSections` / `commitContents`;
  - 0 `: any`.
- Browser spec counts: 3 `keyboard.press('Space')`, 2 `saisi`, 3 `.analyze()`, 1 conflict text, a `group.each.teardown`, and no user creation.

## Deviations from Plan

1. **[Rule 1 - Bug] Re-adding locally deleted rows.** As specified, `mergeBulkResult` would re-add any `affected` server row that is absent locally. That includes a row deleted by an op queued after the bulk op (the queue applies optimistically at enqueue time). I added the optional `known` argument (the structure at enqueue time) and a unit assertion for it. Commit 90b2172.
2. **[Rule 1 - Bug] Tokens for bulk delete.** The optimistic delete removes rows before `run`, so the run-time token lookup falls back to the apply-time snapshot. Without that it would send `null` and trigger a false `E_CONFLICT`. Rollback uses `withCurrentTokens`, like the single-item `save`. Commit 620f012.
3. **Token race test uses "Contenu B" (draft) instead of "Contenu A".** c1 is already published, so the server would not save it and its token would not change, and the test would prove nothing. c2 actually changes.
4. **Focus after a bulk delete** is handled in `bulk-action-bar.tsx` (`onCloseAutoFocus` with `preventDefault`), not in the page. Radix restores focus on a timeout after the bar unmounts, which would override any focus set by the page.
5. **Extra helper `sectionTargets`** (private) in `builder_tree.ts`. It is the label-building code of `moveTargets`, moved out so `bulkMoveTargets` reuses it unchanged.
6. **Duplicated sections are expanded** after the merge (same rule as created sections, through `knownSectionIdsRef`).
7. **[Precaution] `DB_CONNECTION=sqlite` exported for every `node ace` run**, as in 05-02 and 05-09.
8. **[Rule 1 - Bug] Contrast of the enabled "Supprimer…" button.** `text-destructive` (hsl 0 65% 55%) is about 4.2:1 on the light bar, below AA, so axe test 11 would fail on `color-contrast`. The button now uses the default outline text. The AlertDialog still carries the destructive styling. Commit dd08988.
9. **[Rule 1 - Bug] Locators in the spec I could not run.** Playwright matches `name` and `getByLabel` as case-insensitive substrings:
   - "Publier" also matched "Dépublier";
   - "Ancienne date de début" also matched the anchor radio's label.

   The bar, checkbox and dialog-label locators now use `exact: true`. The axe test also waits for the shift dialog to close before opening the move dialog. Commit e4d84f5.

## TDD Gate Compliance

- RED: the new unit group was written first. The run hung while importing the missing exports (the known `node ace test` hang on a failed import), and its own PID was killed. This is a failing RED, recorded here.
- GREEN: 41/41 in `builder_tree.spec.ts` after implementation.
- As in 05-09, the plan asks for one `feat(...)` commit for Task 1, so there is no separate `test(...)` commit.

## Known limits

- A pending single edit of `isPublished` or a date, queued after a bulk op on the same row, is shown with the server value from the bulk response until that later op saves. The DB ends right. The plan's merge rule keeps only the local `title` and `description`.
- If a teacher edits a row and then bulk-deletes it before the edit lands, the delete may send the older token and get a 409 with "Recharger". The single-item delete has the same window.
- If a bulk op is rolled back, its rows come back, but they are no longer selected: pruning already dropped them.

## Known Stubs

None.

## Self-Check: PASSED

- Files exist: move-target-list.tsx, bulk-action-bar.tsx, builder_bulk.spec.ts (browser).
- Commits 90b2172, 0f6c00f, 3e091a1, 620f012, 3bada53, dd08988 and e4d84f5 are present on worktree-agent-aff29f162a400a623.
