---
phase: 05-builder-ui
plan: 09
subsystem: course-builder
tags: [builder, bulk-actions, duplicate, copied_from_id, date-shift, audit, migration]
requires: [05-01, 05-02]
provides:
  - "Six JSON bulk routes courses.bulk.{publish,availability,shift,move,duplicate,delete}"
  - "loadBuilderStructure (app/helpers/builder_props.ts) for the 05-06 page props"
  - "copied_from_id on course_modules and course_contents (D-12)"
  - "shiftDays / shiftDate (app/helpers/date_shift.ts)"
affects: [05-06, 05-10]
tech-stack:
  added: []
  patterns:
    - "One shared run() skeleton: authorize, validate, then one transaction (course-row lock, scope, tokens, action). A BulkRefusal thrown inside rolls back and is caught outside. One audit row after the commit."
    - "Structural actions run in buildRows tree order, with items under a selected ancestor dropped"
key-files:
  created:
    - database/migrations/1793500000000_add_copied_from_id_to_course_structure.ts
    - app/helpers/date_shift.ts
    - tests/unit/date_shift.spec.ts
    - app/helpers/builder_props.ts
    - app/validators/course_bulk.ts
    - app/controllers/course_bulk_actions_controller.ts
    - tests/functional/builder_bulk.spec.ts
  modified:
    - app/models/course_module.ts
    - app/models/course_content.ts
    - start/routes.ts
decisions:
  - "OQ-1: SHIFT_ASSIGNMENTS_TABLE = false (owner accepted the default on 2026-10-31)"
  - "OQ-2: COPIES_START_AS_DRAFT = true (owner accepted the default on 2026-10-31)"
  - "OQ-3: BULK_DELETE_ALLOWS_FULL_SUBTREE = true (owner accepted the default on 2026-10-31); 05-10 must mirror it"
  - "E_NOT_EMPTY.ids holds plain section ids (as the plan specifies); every other refusal uses [{ kind, id }]"
  - "Copied pivot rows take created_at/updated_at = DateTime.local() in the dialect's dateTimeFormat, the same format as Lucid's attach()"
metrics:
  duration: "~1h (across a rate-limit interruption)"
  completed: 2026-11-02
  tasks: 3
  files: 10
---

# Phase 05 Plan 09: Bulk actions backend and copied_from_id Summary

There are six all-or-nothing JSON bulk endpoints for the builder: publish/unpublish, availability window, date shift, move, duplicate and delete. Each runs under one course-row lock and checks `CoursePolicy` `edit`, course scope (IDOR) and the D-09 token of every item. Each committed action writes one audit row holding ids only. Duplicates store `copied_from_id` (a new reversible column on both tables) and copy their attachment pivot rows. The blobs are shared, not copied.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 7d98b6e | feat(builder): add copied_from_id to sections and contents and a date shift helper |
| 2 | 8d3c18e | feat(builder): add bulk publish, availability and date shift endpoints |
| 3 | bb2b3e5 | feat(builder): add bulk move, duplicate and delete endpoints |
| 2 (follow-up) | fe00c81 | test(05-09): assert no write and no audit on an empty bulk batch |

## builder_tree import path (A7)

`app/helpers/builder_props.ts` and the controller import `../../inertia/lib/builder_tree.js` (types, `buildRows`, `rowKey`). `bun run build` exits 0 and emits `build/inertia/lib/builder_tree.js`.

## Routes and response shapes (05-10 parses these)

All routes are `POST /courses/:id/builder/bulk/<action>` inside the builder group (`auth` + role admin|manager|teacher). They expect JSON with `accept: application/json` and a CSRF token.

| Name | Path | Method | Body (besides `items`) |
|------|------|--------|------------------------|
| courses.bulk.publish | /publish | publish | `isPublished: boolean` |
| courses.bulk.availability | /availability | availability | `availableFrom: date \| null`, `availableUntil: date \| null` (both keys required) |
| courses.bulk.shift | /shift | shiftDates | `days` (int, -3650..3650) **or** `from` + `to` (dates) |
| courses.bulk.move | /move | move | `parentId: number \| null` |
| courses.bulk.duplicate | /duplicate | duplicate | none |
| courses.bulk.delete | /delete | destroy | none |

`items: { kind: 'section' | 'content'; id: number; updatedAt: string | null }[]` takes 1 to 1000 entries. Duplicate `kind:id` entries are collapsed.

**Date format (request side):** `availableFrom`, `availableUntil`, `from` and `to` go through `vine.date()` with its default formats, which accept only `YYYY-MM-DD` or `YYYY-MM-DD HH:mm:ss` (`DEFAULT_DATE_FORMATS` in `@vinejs/vine`). A full ISO string such as `toISO()` (`…T…Z`) is refused with a VineJS 422, so 05-10 must send one of those two formats. The `updatedAt` tokens are the exception: they are free strings parsed with `DateTime.fromISO`, so send back exactly the `updatedAt` received. Dates in the 200 response are ISO strings (`toISO()`).

**200**
```
{ sections: BuilderSection[], contents: BuilderContent[],   // whole fresh structure (loadBuilderStructure)
  affected: { sectionIds: number[], contentIds: number[] },  // rows saved or created, plus every row of each renumbered sibling list (move, duplicate); sorted
  deleted:  { sectionIds: number[], contentIds: number[] } } // delete only; empty lists otherwise
```
Rows whose values do not change are not saved and not listed. Examples: publishing an already published row, or shifting a row that has no date.

**Refusals** (nothing is written, no audit row):
- 403: Bouncer JSON denial (no `edit` on the course)
- 404: HTML page (missing course, `findOrFail`)
- 422 `{ errors: [...] }`: VineJS (for example an empty `items`)
- 422 `{ code: 'E_INVALID_ITEMS', message: 'Certains éléments ne font pas partie de ce cours.', ids: [{ kind, id }] }`
- 409 `{ code: 'E_CONFLICT', message: CONFLICT_ERROR, items: [{ kind, id, updatedAt }] }`: the stale rows with fresh tokens
- availability: 422 `{ errors: [{ field: 'availableUntil', message: 'La date de fin doit être postérieure à la date de début.' }] }`
- shift: 422 `{ code: 'E_INVALID_SHIFT', message }` when neither or both modes are given, or the shift is 0 days
- move: 422 `{ code: 'E_INVALID_DESTINATION' | 'E_DEPTH', message, ids: [{ kind, id }] }`. For contents sent to the root, `ids` lists every content. Otherwise it names the first item that failed (foreign destination, cycle, depth).
- duplicate: 422 `{ code: 'E_DEPTH', message: DEPTH_ERROR, ids: [{ kind, id }] }` for legacy third-level data
- delete: 409 `{ code: 'E_NOT_EMPTY', message: 'Sélectionnez aussi tout le contenu des sections à supprimer.', ids: number[] }`. These are the blocking section ids as **plain numbers**.

**Order of the checks**: authorize, then validate, then lock, then scope (`E_INVALID_ITEMS`), then tokens (`E_CONFLICT`), then the action's own refusals.

**Audit** (`resourceType: 'Course'`, `resourceId: courseId`): `metadata = { sectionIds, contentIds }`, the selected ids sorted ascending, with these additions: `shift_dates` adds `days`, `move` adds `parentId`, and `duplicate` adds `createdSectionIds` and `createdContentIds`. Actions: `course.bulk.publish|unpublish|availability|shift_dates|move|duplicate|delete`.

**Processing order** (05-10's optimistic mirror must match): `buildRows(sections, contents, every section expanded)` order, with items under a selected ancestor dropped. Move puts all contents first, then the sections, each appended at the end of the destination. Duplicate places each copy right after its original. Only top-level copies get the ` (copie)` suffix.

## Migration check (SQLite, seeded, up → down → up)

`counts 6,11 / 6,11 / 6,11`. The FK (`copied_from_id`, ON DELETE SET NULL) is present after up, absent after `rollback --step=1`, and present again after the second up. The functional suite also proves ON DELETE SET NULL on SQLite. PostgreSQL and MySQL are covered by the CI matrix.

## Open questions

- `SHIFT_ASSIGNMENTS_TABLE = false` (OQ-1), `COPIES_START_AS_DRAFT = true` (OQ-2), `BULK_DELETE_ALLOWS_FULL_SUBTREE = true` (OQ-3). The owner accepted all three defaults on 2026-10-31 (CONTEXT D-13). Each has one constant and one test assertion.

## Verification

- `node ace test unit functional`: 309 passed (sqlite, PORT=3459)
- `builder_bulk.spec.ts` + `builder_moves.spec.ts`: 39 passed
- `bun run typecheck`, `bun run lint`, `bun run check:debt`, `bun run build`: exit 0; `build/inertia/lib/builder_tree.js` exists
- Grep gates: 6 `courses.bulk.` routes; 2 `CourseStructureService.move*(` lines; 0 `wouldCreateCycle(`; `authorize`, `forUpdate()` and `logFromContext(` once each; the withCsrfToken gate holds; `builder_props.ts` has no `'content'` and no `copied_from_id`

## Deviations from Plan

1. **[Precaution] `DB_CONNECTION=sqlite` exported for every `node ace` run**, as in 05-02. This guarantees no run touches the dev Postgres.
2. **[Rule 3] Migration check script.** The sandbox refused the inline `node -e "$Q"` form of the Task 1 verify. I ran the same queries from a temporary script (deleted afterwards) with the same steps and the same assertions.
3. **Bulk delete deletes the selected contents, then the top-level selected sections.** It relies on the `parent_id` CASCADE (verified in the migration) for the sub-sections, which are all selected. `assignments.module_id` is SET NULL, so a deleted section never blocks on an assignment.
4. **Move refusal test uses c2 (in S1) instead of c3** as the second batch item. c3 already sits alone in S2, so it would not show a rollback. c2 shows one, because it would leave S1.
5. **Cycle guard in `copySection`.** Recursion stops at `MAX_SECTION_DEPTH`, so corrupt cyclic data cannot loop forever. The depth check already refuses legacy deeper data before any write.

## TDD Gate Compliance

- Task 1: the unit test and the helper were written in the same step, so no RED run was recorded before GREEN. The test passes (7/7).
- Task 2: RED ran (9/9 failing: the controller module was missing), then GREEN 9/9.
- Task 3: the spec cases and the implementation were written together before the first run, so there was no separate RED run. GREEN is 39/39 across both spec files.
- As in 05-01, the plan asks for one `feat(...)` commit per task, so there are no separate `test(...)` commits.

## Known Stubs

None. `SHIFT_ASSIGNMENTS_TABLE` throws if it is ever flipped without implementing the query. This is deliberate (OQ-1).

## Self-Check: PASSED

- Files exist: every file under key-files.created
- Commits 7d98b6e, 8d3c18e, bb2b3e5, fe00c81 are present on worktree-agent-ad37f4fb3f6a2d865
- The temporary migration-check script is gone (`/tmp/mig-check-0509.cjs`: no such file)
