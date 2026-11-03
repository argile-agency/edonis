---
phase: 05-builder-ui
plan: 07
subsystem: builder-ui
tags: [builder, dnd-kit, drag-and-drop, a11y, ssr, browser-tests]
requires: [05-01, 05-02, 05-06]
provides:
  - '@dnd-kit/core 6.3.1, @dnd-kit/sortable 10.0.0, @dnd-kit/utilities 3.2.2 pinned exactly'
  - 'inertia/components/builder/builder-row.tsx: useSortable row, handle-only activation, projectedDepth placeholder indent'
  - 'inertia/pages/courses/builder.tsx: DndContext id=course-builder, sensors, projections, auto-expand, French announcements, mounted-gated DragOverlay'
  - 'tests/browser/builder.spec.ts: hydration smoke test + 5 keyboard-drag tests'
affects: [05-08, 05-10]
tech-stack:
  added: ['@dnd-kit/core@6.3.1', '@dnd-kit/sortable@10.0.0', '@dnd-kit/utilities@3.2.2']
  patterns:
    - 'Flattened single list; a section drag switches the list to sectionRowsForDrag (sections-only variant)'
    - 'One project(key, overKey) against the same list given to SortableContext; latest result kept in a ref for announcements'
    - "Drops call the menu's move() with focusActions=false: one save path, focus stays on the handle"
key-files:
  created: []
  modified:
    - package.json
    - bun.lock
    - inertia/components/builder/builder-row.tsx
    - inertia/pages/courses/builder.tsx
    - tests/browser/builder.spec.ts
decisions:
  - 'Sections-only list during section drags shipped (not the keep-contents-mounted fallback); keyboard reflow is decided by CI e2e / 05-08'
  - "The handle button is rendered inside BuilderRow (it needs useSortable's setActivatorNodeRef); the unused handle?: ReactNode slot was removed"
  - "move() gained focusActions (default true): drag drops skip focusLater so dnd-kit's restoreFocus keeps focus on the handle and no stale pendingFocusRef is left"
  - "Keyboard getter for sections keeps x on Up/Down (sortableKeyboardCoordinates resets it to the target's left) so a Left/Right level shift survives vertical moves"
  - 'The pick-up onDragOver (over = the row itself, no shift) is not announced, so « X » saisi. stays in the live region'
metrics:
  duration: '~45 min'
  completed: 2026-11-03
  tasks: 3
  files: 5
---

# Phase 5 Plan 07: dnd-kit drag and drop on the builder Summary

Teachers can now drag contents and sections by a grip handle, with the mouse, touch or the keyboard. Contents move within or across sections, including empty and collapsed ones (a collapsed section opens after 600 ms of hover). Sections reorder and change level within the 2-level limit (Left/Right on the keyboard, horizontal offset with the pointer). Every drop goes through the same optimistic `move()` and save queue as "Déplacer vers…", with French screen-reader instructions and announcements.

## Commits

| Task     | Commit  | Message                                                                             |
| -------- | ------- | ----------------------------------------------------------------------------------- |
| 1 (deps) | 65d9706 | build(deps): add dnd-kit core, sortable and utilities pinned                        |
| 1        | 1b23218 | feat(builder): add sortable rows and drag handles with SSR-safe DndContext          |
| 2        | c2a5498 | feat(builder): drag contents and sections with projections and French announcements |
| 3 (fix)  | 26fc65f | fix(builder): keep the pick-up drag announcement audible                            |
| 3        | 64e57f1 | test(builder): cover keyboard drag of contents and sections                         |

## Installed versions

`@dnd-kit/core` 6.3.1, `@dnd-kit/sortable` 10.0.0, `@dnd-kit/utilities` 3.2.2, all exact (no caret), installed with `bun add --exact` (bun 1.4.4). The deps commit holds only `package.json` and `bun.lock`. `bun install --frozen-lockfile` reports no changes.

## Test results

- **Browser spec: not run locally.** 05-02 records `BROWSER_LOCAL: blocked` (Playwright headless shell build 1248 missing). The cache was not modified. CI `e2e.yml` and the 05-08 checkpoint cover it. The spec has 15 tests: the 9 from 05-06, the hydration smoke test, and 5 keyboard tests:
  1. BUILD-01: Contenu A, ArrowDown, Space → order B, A in the DB and after reload
  2. BUILD-02: Contenu A, 3 × ArrowDown → announced "Sera déposé dans « S2 », position 1." → `moduleId = S2`
  3. BUILD-03: S2, ArrowRight → announced "« S1 », position 2" → `parentId = S1`; then S1 (which has sub-sections), ArrowRight + Space → no save, S1 stays a root
  4. Reflow: S2 (below S1's contents), one ArrowUp → announced "« S1 », position 1" → S1's children are [S2, S11]
  5. Escape → "Déplacement annulé.", no "Enregistrement", order unchanged
- **SSR smoke (local, instead of the browser).** I rendered the built SSR bundle (`build/ssr/ssr.js`) with Node. It renders without error, the handles carry `aria-describedby="course-builder"` (stable thanks to `id="course-builder"`, the same value on the client), and the live region and DragOverlay are client-only portals. The only warning was React's `asChild` on a DOM element, which comes from the app header (phase 4, already known), not from dnd-kit.
- `node ace test unit functional` (sqlite, PORT=3457): 329 passed; temp DB deleted.
- `bun run typecheck`, `bun run lint`, `bun run check:debt`, `bun run build`: exit 0. Client tsc filtered to the builder files: 0 errors.
- Acceptance greps: no caret on @dnd-kit; `createPortal` gated by `mounted`; `touch-none` 1, `setActivatorNodeRef` 2 (destructure + button), `roleDescription: 'élément déplaçable'` 1, `{...listeners}` 1 on the handle button, the checkbox (`onToggleSelect`) still renders before the handle; `sectionRowsForDrag(` 1, `600` 1, `clearTimeout` 2 (over change, end/cancel through `endDrag`); `sendJson(` still 4 (no second save path).

## Section-drag variant shipped

**Sections-only list** (RESEARCH Pattern 1), not the fallback. I checked the dnd-kit 6.3.1 source for the reflow risk:

- `useRect` re-measures the active node on any body `childList` mutation
- the keyboard sensor takes its reference coordinates from `collisionRect` at the first key press, which is already after the reflow
- `MeasuringStrategy.Always` re-measures the droppables

So keyboard steps should be consistent with the post-reflow layout. Browser test 4 proves it in CI. If it fails there, apply the documented fallback.

## Fallback trigger

Not fired. No hydration mismatch naming dnd-kit (SSR check above), no dnd-kit runtime error at build or SSR. Trigger (c), the keyboard sensor not starting from a focused handle, can only be observed in a browser, so it is open until CI e2e or the 05-08 walkthrough.

## Deviations from Plan

1. **[Rule 1 - Bug] Drops skip the menu's focus move.** `move()` ends with a `focusLater` call on the row's actions button. On a drop, that would pull focus off the handle (Task 2 requires focus to stay there), and a stale `pendingFocusRef` would be consumed by the next dialog close. `move(row, placement, focusActions = true)`, and drops pass `false`. Commit c2a5498.
2. **[Rule 1 - Bug] Pick-up announcement.** dnd-kit fires `onDragOver` with `over` = the row itself right after pick-up, which replaced "« X » saisi." in the live region (05-10 Task 4 waits for "saisi"). That announcement is now skipped while over is the row itself with no level shift. Commit 26fc65f.
3. **Keyboard getter for sections keeps x on Up/Down.** `sortableKeyboardCoordinates` returns the target's `left`, which would discard an earlier ArrowRight. Commit c2a5498.
4. **Handle rendered in `BuilderRow`, and the `handle?: ReactNode` prop removed.** `setActivatorNodeRef` comes from the row's `useSortable`. A `projectedDepth` prop indents the dragged section at its projected level.
5. **BUILD-03 test uses ArrowRight alone.** "ArrowUp past S11, then ArrowRight" already forces depth 1, because the next row is S11 at depth 1, so ArrowRight would prove nothing. ArrowRight alone proves the level change (S2 → S1, position 2), and the reflow test covers the ArrowUp path (S2 → S1, position 1).
6. **Content drop refused, wording.** A `null` content projection (above every section, or into a level-3 section) announces "Déplacement impossible : un contenu doit rester dans une section." The depth message is used for sections only.
7. **Environment:** fresh `bun install` in the worktree; `npm rebuild better-sqlite3` under Node 22 (the bun-built binary had the wrong ABI); `.env` symlinked (not committed); `DB_CONNECTION=sqlite` set explicitly.

## Known limitations

- With the pointer, hiding content rows at the start of a section drag can make the DragOverlay sit above the cursor when the page cannot scroll to compensate (dnd-kit's layout-shift compensation scrolls only when possible). This is cosmetic: collisions follow the overlay the teacher sees.
- A keyboard user who moves back onto the starting slot hears no announcement for that step (the same rule as the pick-up).

## Threat surface

- T-05-SC: exact pins, lockfile committed, frozen install OK.
- T-05-25: drops use the 05-01 move endpoints unchanged (server re-validates scope, cycle, depth, lock, token).
- T-05-26: `touch-none` and the listeners are on the handle button only.
- T-05-27: announcements are plain strings rendered as text by dnd-kit's live region.

No new surface beyond the threat model.

## Known Stubs

None.

## Self-Check: PASSED

- Files exist: package.json, bun.lock, builder-row.tsx, builder.tsx, builder.spec.ts
- Commits 65d9706, 1b23218, c2a5498, 26fc65f and 64e57f1 are on worktree-agent-a05ff19453b081d85
