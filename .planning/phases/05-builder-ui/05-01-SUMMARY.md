---
phase: 05-builder-ui
plan: 01
subsystem: course-builder
tags: [builder, drag-and-drop, moves, concurrency, audit]
requires: []
provides:
  - "POST /contents/:contentId/move (contents.move)"
  - "POST /modules/:moduleId/move (modules.move)"
  - "CourseStructureService move core (reused by 05-04, 05-09)"
  - "depthOf / subtreeHeight tree helpers"
affects: [05-02, 05-04, 05-06, 05-09]
tech-stack:
  added: []
  patterns:
    - "Intent-based move (destination + 0-based position), server-side dense renumbering"
    - "Course-row forUpdate() lock + updated_at token compared to the second (409)"
key-files:
  created:
    - app/services/course_structure_service.ts
    - tests/functional/builder_moves.spec.ts
  modified:
    - app/helpers/category_tree.ts
    - tests/unit/category_tree.spec.ts
    - app/validators/course_content.ts
    - app/controllers/course_contents_controller.ts
    - start/routes.ts
    - tests/functional/authorization_contents.spec.ts
decisions:
  - "Sibling renumbering writes through trx.from(model.table) (query builder, no updated_at bump), which also avoids the union-model typing of model.query()"
  - "renumber(rows) contract: rows are the full sibling list in final display order; the moved item is included with order = index + 1 so it is skipped, then saved through the model"
  - "PUT modules.update silently drops parentId (VineJS strips unknown keys) instead of rejecting it"
metrics:
  duration: "~35 min"
  completed: 2026-10-31
  tasks: 3
  files: 8
---

# Phase 05 Plan 01: Builder move endpoints Summary

The server side of drag-and-drop is in place. Two JSON move endpoints, for contents and for sections, take a per-course row lock, check an `updated_at` token to the second (409 when stale), and refuse foreign ids, cycles and anything deeper than 2 levels (422). They renumber every sibling list they touch densely, in one transaction, and write exactly one audit row per committed move. The move rules live in `CourseStructureService` so that 05-09's bulk move can reuse them.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 0c68318 | feat(builder): add depthOf and subtreeHeight tree helpers |
| 2 | f50f60a | feat(builder): add content move endpoint with course lock and conflict check |
| 3 | a0334eb | feat(builder): add section move endpoint with cycle and depth checks |

## Response shapes (later plans parse these)

Requests (JSON, `accept: application/json`, CSRF token):
- `POST /contents/:contentId/move` body `{ moduleId: number, position: number, updatedAt: string | null }`
- `POST /modules/:moduleId/move` body `{ parentId: number | null, position: number, updatedAt: string | null }`

Responses:
- **200**: `{ item: { id: number, updatedAt: string | null } }`. `updatedAt` is the moved row's new ISO token. Only the moved row is bumped; renumbered siblings keep their `updated_at`.
- **409**: `{ code: 'E_CONFLICT', message: 'Cet élément a été modifié par un autre enseignant.', item: <fresh row serialize()> }`. `item.updatedAt` is the fresh token, and a retry with it succeeds (tested).
- **422 (structure)**: `{ code: 'E_INVALID_DESTINATION', message: 'Module parent invalide.' }` (foreign destination or parent, cycle) or `{ code: 'E_DEPTH', message: 'Profondeur maximale : 2 niveaux.' }`
- **422 (validation)**: `{ errors: [...] }` (VineJS)
- **403**: Bouncer JSON denial for users without `edit` on the item's course
- A missing item id still renders the HTML 404 page (`firstOrFail`), as before.

**A2 confirmed:** VineJS returned 422 JSON with an `errors` array for a JSON caller (`position: -1` test).

## Final CourseStructureService API (`#services/course_structure_service`)

```ts
export const MAX_SECTION_DEPTH = 1 // 0-based: root = 0, sub-section = 1 (D-02: 2 levels)
export const PARENT_ERROR = 'Module parent invalide.'
export const DEPTH_ERROR = 'Profondeur maximale : 2 niveaux.'
export const CONFLICT_ERROR = 'Cet élément a été modifié par un autre enseignant.'
export type MoveOutcome =
  | { ok: true; fromParentId: number | null; toParentId: number | null; position: number }
  | { ok: false; code: 'E_INVALID_DESTINATION' | 'E_DEPTH'; message: string }
export function sameSecond(stored: DateTime | null, expected: string | null): boolean
export default class CourseStructureService {
  static async renumber(trx: TransactionClientContract, rows: { id: number; order: number }[], model: typeof CourseModule | typeof CourseContent): Promise<void>
  static async moveContent(trx, courseId: number, content: CourseContent, moduleId: number, position: number): Promise<MoveOutcome>
  static async moveModule(trx, courseId: number, module: CourseModule, parentId: number | null, position: number): Promise<MoveOutcome>
}
```

- Precondition on both move methods: the caller holds the course-row lock, has re-read the row with `trx` and has checked its token.
- For `moveContent`, `fromParentId` and `toParentId` are the source and destination **module** ids. The controller maps them to `fromModuleId` and `toModuleId` in the audit metadata.
- `renumber` expects `rows` in final display order and writes `order = i + 1` only where it changed.

Helpers (`app/helpers/category_tree.ts`): `depthOf(parentById, nodeId)` (root = 0, unknown id = 0) and `subtreeHeight(parentById, nodeId)` (leaf = 0). Both terminate on cyclic data.

## Audit

- `course.content.move` / `CourseContent` with metadata `{ courseId, fromModuleId, toModuleId, position }`
- `course.module.move` / `CourseModule` with metadata `{ courseId, fromParentId, toParentId, position }`
- Logged after the transaction commits, only on 200. Tests check that refusals (422, 409) write no row.

## Deviations from Plan

None. The plan ran as written. Small implementation choices:
- `renumber` writes with `trx.from(model.table)` instead of `model.query({ client: trx })`. This is the same query-builder write (no `updated_at` bump) and avoids the union-model call signature.
- The behavior text spells it `subtreeHeight(childrenOf(tree), …)`, but the helper takes `parentById`, as the action specifies. The tests use the `tree` map.

## Known limitations (not fixed, by design or out of scope)

- Moving an item to the position it already holds leaves nothing dirty, so `save()` does not bump `updatedAt`. The returned token is unchanged and stays valid.
- Two teachers writing the same item within the same second are not detected (the `shortcut:` comment on `sameSecond`, as decided).
- On SQLite, `forUpdate()` compiles to nothing; writers are already serialised there.
- `PUT /modules/:moduleId` with a `parentId` field answers 302 and ignores the field rather than rejecting it.

## TDD Gate Compliance

Each task was run RED first (Task 1: the import of the missing exports failed; Task 2: 10/10 failing; Task 3: 11 failing), then GREEN. The commits are single `feat(...)` commits per task, as the plan's commit messages specify, so there is no separate `test(...)` RED commit.

## Verification

- `node ace test unit functional`: 245 passed (sqlite, PORT=3451)
- `bun run typecheck`, `bun run lint`, `bun run check:debt`: exit 0
- The withCsrfToken gate holds for both functional spec files

## Self-Check: PASSED

- Files exist: app/services/course_structure_service.ts, tests/functional/builder_moves.spec.ts
- Commits 0c68318, f50f60a, a0334eb are present on worktree-agent-ae30949e39b29fd92
