---
phase: 05-builder-ui
verified: 2026-11-03T12:55:00Z
status: human_needed
score: 7/8 success criteria verified, 1 uncertain (SC 8, axe not run); 15/16 requirements satisfied, 1 uncertain (BUILD-16)
overrides_applied: 0
human_verification:
  - test: "Run the e2e workflow (push a branch / open a PR so .github/workflows/e2e.yml runs) and record the run link in 05-VALIDATION.md"
    expected: "tests/browser/builder.spec.ts (16 tests), builder_bulk.spec.ts (11 tests) and accessibility.spec.ts 'course builder has no critical a11y violations' (5 states) all pass"
    why_human: "Never executed: Playwright headless shell missing locally, nothing pushed, no CI e2e run. Criteria 1-3, 6 and 8 have only the walkthrough as behavioural evidence"
  - test: "Let the CI unit/functional matrix run on PostgreSQL and MySQL"
    expected: "341/341 pass, incl. the copied_from_id migration up/down (FK + index drop order on MySQL) and the forUpdate course lock"
    why_human: "Only SQLite runs locally"
  - test: "Pointer and touch drag, and the 600 ms auto-expand of a collapsed section on hover"
    expected: "Dragging by the handle on a mouse and a touch device reorders/moves and saves; hovering a collapsed section expands it"
    why_human: "No automated test covers pointer/touch drags or the auto-expand timer (05-07); only the keyboard path has browser specs (not run)"
---

# Phase 5: Builder UI Verification Report

**Phase Goal:** Upgrade the existing dialog-based builder to true drag-and-drop
**Verified:** 2026-11-03
**Status:** human_needed
**Re-verification:** No, initial verification

Every criterion and requirement has code behind it, and the user approved the walkthrough on 2026-11-03 (05-08-SUMMARY, fixes bd48788, 45fc2f3, 60a937f, 893a2c4, d393afb verified in git log). The server side is well covered by functional tests: I ran them again here. The client side (drag, keyboard, selection, axe) depends on browser specs that have never run. Until a CI e2e run is green, the status stays `human_needed` and not `passed`. No blocker gap found.

## Behavioural checks run by the verifier

| Check | Command | Result |
|-------|---------|--------|
| Unit + functional suite | `PORT=3481 DB_CONNECTION=sqlite DB_FILENAME=./tmp/verify.sqlite3 node ace test unit functional` | **341 passed (341)**, exit 0, 13 s; DB deleted |
| Browser specs | not run | Playwright headless shell missing (known) |

## Success Criteria (ROADMAP Phase 5)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Drag content items to reorder within a section | VERIFIED (browser spec pending) | `inertia/pages/courses/builder.tsx:532-534` (PointerSensor distance 4 + KeyboardSensor), `:573-622` drag handlers + French announcements, `:775-813` DndContext/SortableContext; `POST /contents/:contentId/move` in `start/routes.ts`; `app/services/course_structure_service.ts`; `tests/functional/builder_moves.spec.ts` (39 tests); `tests/unit/builder_tree.spec.ts`; walkthrough step 1 approved |
| 2 | Drag content items between sections | VERIFIED (browser spec pending) | Same drag layer; `builder_moves.spec.ts:170` cross-section renumber + one audit row (BUILD-02), `:213` empty destination section; walkthrough approved |
| 3 | Drag sections to reorder them | VERIFIED (browser spec pending) | `POST /modules/:moduleId/move`; `builder_moves.spec.ts:453` re-parent, `:521` cycle, `:548` 2-level depth, `:699` PUT no longer re-parents; walkthrough step 2 |
| 4 | Add / rename / delete section still work | VERIFIED | `builder_moves.spec.ts:759` rename JSON, `:988` empty section delete + audit, `:1032` HTML callers, `:1138` create depth; `builder.tsx:886-893` create dialog; walkthrough steps 3-5 |
| 5 | Autosave with visible save indicator | VERIFIED | `inertia/lib/save_queue.ts`, `inertia/lib/builder_save_queue.ts` (`useSaveQueue`, used at `builder.tsx:177,253,391`); `inertia/components/builder/save-status.tsx:8-9,33-34` ("Enregistrement…" / "Enregistré", `role="status"` `aria-live="polite"`), rendered at `builder.tsx:719`; `tests/unit/save_queue.spec.ts`; walkthrough step 3 |
| 6 | Keyboard-accessible equivalents of drag | VERIFIED (code + approved walkthrough; browser spec pending) | KeyboardSensor with `builderKeyboardCoordinates` (`builder.tsx:534`), announcements `:607`; menu moves Monter / Descendre / Déplacer vers… at `item-actions-menu.tsx:115,118,126` + `move-target-list.tsx`; walkthrough steps 6-7. Keyboard browser specs and the builder axe test were never run |
| 7 | Select N items, publish/unpublish/shift dates/move/duplicate/delete in ≤ 3 interactions, one audit entry per bulk action | VERIFIED | Bulk bar buttons `bulk-action-bar.tsx:215-252` (counting rule: select-all or a quick selection = 1, action button = 2, dialog submit = 3, typing in dialog fields not counted. Publish/unpublish/duplicate = 2; delete, move, availability, shift = 3); controller `app/controllers/course_bulk_actions_controller.ts:592-635` (one transaction, course row `forUpdate`, one `AuditService.logFromContext` after commit); `tests/functional/builder_bulk.spec.ts` asserts exactly one audit row per action (`:202-205`, `:274`, `:341`, `:447`, `:554`, `:618`, `:656`) and zero on refusal (`:116,148,160,250,390,493,518,637,679`); walkthrough steps 10-12 |
| 8 | Bulk actions and selection keyboard-operable (manual check + axe-core) | UNCERTAIN (manual half approved, axe half never run) | Native checkbox + label `bulk-action-bar.tsx:79-84`, quick selection menu `:86-108`, live count `:112-119`, blocked delete kept focusable with `aria-describedby` `:233-248`; walkthrough step 13 approved. `accessibility.spec.ts:199` (5 states incl. selection) never executed |

## Requirements Coverage

| Req | Plan(s) | Status | Evidence |
|-----|---------|--------|----------|
| BUILD-01 | 05-01, 05-02, 05-06, 05-07 | SATISFIED (browser pending) | Move endpoint + service, `builder_tree.ts` projections + unit tests, dnd-kit layer; walkthrough |
| BUILD-02 | same | SATISFIED (browser pending) | `builder_moves.spec.ts:170,213`; walkthrough |
| BUILD-03 | same | SATISFIED (browser pending) | `builder_moves.spec.ts:453,521,548`; walkthrough |
| BUILD-04 | 05-04, 05-06 | SATISFIED | Create dialogs in `builder.tsx`; `builder_moves.spec.ts:1138` |
| BUILD-05 | 05-04, 05-05 | SATISFIED | `inline-title.tsx`; `builder_moves.spec.ts:759` |
| BUILD-06 | 05-04, 05-05 | SATISFIED | Locked refusal of non-empty delete, `builder_moves.spec.ts:988,1032`; disabled item restyled (893a2c4) |
| BUILD-07 | 05-04, 05-06 | SATISFIED | Type selector `builder.tsx:886-893` (z-index fix bd48788); `builder_moves.spec.ts:1197` |
| BUILD-08 | 05-04, 05-05 | SATISFIED | `details-panel.tsx`, `inline-title.tsx`; `builder_moves.spec.ts:781,860` |
| BUILD-09 | 05-04, 05-05 | SATISFIED | `builder_moves.spec.ts:1059,1096`; learner-impact count in the confirm dialog (`item-actions-menu.tsx:187-188`, d393afb) |
| BUILD-10 | 05-03, 05-06 | SATISFIED | Save queue + `SaveStatus` (see SC 5) |
| BUILD-11 | 05-10 | SATISFIED (browser pending) | Checkboxes, Tout sélectionner / désélectionner, published / unpublished / by-type quick selections, `aria-live` count: `bulk-action-bar.tsx:62-119` |
| BUILD-12 | 05-09, 05-10 | SATISFIED | `course_bulk_actions_controller.ts:292-305`; `builder_bulk.spec.ts:167` |
| BUILD-13 | 05-09, 05-10 | SATISFIED | Availability `:308-327`, shift by days or from→to `:330-365` + `app/helpers/date_shift.ts`, shifts available_from/until and due_date; `builder_bulk.spec.ts:253,299,362`; `tests/unit/date_shift.spec.ts`. Assignments not shifted (OQ-1 default, `SHIFT_ASSIGNMENTS_TABLE = false` at `:33`) |
| BUILD-14 | 05-09, 05-10 | SATISFIED | Move `:369`, duplicate `:431` (copies attachments, sets `copiedFromId: original.id` at `:204` content and `:246` section), delete `:502` with confirmation dialog `bulk-action-bar.tsx:434`; reversible migration `database/migrations/*_add_copied_from_id_to_course_structure.ts` (nullable FK, ON DELETE SET NULL, both tables); `builder_bulk.spec.ts:521,571,640,663,682` |
| BUILD-15 | 05-09 | SATISFIED | VineJS validators `app/validators/course_bulk.ts` (1..1000 items, conflict tokens); one `db.transaction` per action with course lock; refusals roll back (`:610-619`); one ids-only audit row per commit |
| BUILD-16 | 05-07, 05-10, 05-08 | UNCERTAIN (needs CI) | Checkbox and drag handle are separate: `inertia/components/builder/builder-row.tsx:101-106` checkbox with its own aria-label, `:108-114` handle button carries `setActivatorNodeRef`, `{...attributes}`, `{...listeners}` (listeners on the handle only); pointer activation distance 4 (`builder.tsx:533`); walkthrough step 13 approved; axe test and keyboard/checkbox-vs-handle browser specs (`builder_bulk.spec.ts`, 11 tests) never run |

No orphaned requirement: BUILD-01..16 are all claimed by plans.

## Anti-Patterns

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (all non-planning files changed since d8bb4fb) | - | TBD / FIXME / XXX / TODO / HACK | none found | - |
| `app/controllers/course_bulk_actions_controller.ts` | 621 | Audit row written after the transaction commits | Info | If the audit insert fails, the bulk change stays committed without its audit row. Same pattern as the single-item routes (`course_contents_controller.ts:335` transaction, audit after it at `:360`; delete `:389` then `:412`); acceptable but worth knowing for BUILD-15 strictness |
| `app/controllers/course_bulk_actions_controller.ts` | 33, 349 | `SHIFT_ASSIGNMENTS_TABLE = false` guard | Info | Deliberate OQ-1 default: assignment due dates are not shifted |
| `database/migrations/*copied_from_id*` | 10 | `disableTransactions = true` | Info | Needed for SQLite table rebuild; a failed migration on PG/MySQL is not rolled back atomically. First real run is the CI matrix |

## Human / CI Verification Required

1. **CI e2e run**: push so `e2e.yml` runs (`pull_request` + nightly). Expect builder (16), builder_bulk (11) and the builder axe test (5 states) to pass, then link the run in 05-VALIDATION.md and set `nyquist_compliant: true`.
2. **PostgreSQL / MySQL matrix**: expect 341/341, incl. the `copied_from_id` migration up/down and the `forUpdate` lock.
3. **Pointer/touch drag and 600 ms auto-expand**: no automated coverage. Check once on a touch device.

## Open Items (not phase-5 gaps)

- **Trash / soft-delete phase missing from ROADMAP.md.** 05-CONTEXT (D-06, Deferred Ideas) promises a dedicated phase right after Phase 5, and the user's walkthrough answer expects deletes to go to a trash first. By accepted decision, deletes are permanent until that phase exists, and the dialogs say so ("Cette action est irréversible", learner count shown). The phase still has to be added to the roadmap.
- Video embeds blocked by the CSP have been deferred to Phase 8 (`.planning/todos/pending/2026-11-03-video-embeds-blocked-by-csp.md`).
- 05-VALIDATION.md still has `status: draft`, `nyquist_compliant: false` and "Approval: pending". Update it once CI e2e is green.

## Gaps Summary

No code gap blocks the goal. The builder has real dnd-kit drag (content within and between sections, sections), keyboard and menu equivalents, autosave with an indicator, and the full bulk-action set behind one transaction and one audit row each. The suite passes 341/341 on SQLite. What remains is evidence, not implementation: the browser and axe specs (SC 1-3, 6, 8 and BUILD-16) and the PG/MySQL runs exist only as written tests. Until CI runs them, those rows rest on the user's approved walkthrough.

---

_Verified: 2026-11-03_
_Verifier: Claude (gsd-verifier)_
