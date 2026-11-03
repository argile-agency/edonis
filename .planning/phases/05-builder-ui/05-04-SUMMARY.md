---
phase: 05-builder-ui
plan: 04
subsystem: course-builder
tags: [builder, autosave, conflict, delete, depth, csrf, audit]
requires: ["05-01"]
provides:
  - "JSON branches on PUT modules.update / contents.update (200 / 409 / 422)"
  - "JSON branches on DELETE modules.delete / contents.delete (200 / 409 E_NOT_EMPTY)"
  - "Depth checks under the course-row lock in createModule / createContent"
affects: [05-06]
tech-stack:
  added: []
  patterns:
    - "request.accepts(['html','json']) === 'json' negotiation; the HTML flash + back branch is kept"
    - "Optional updatedAt token on updates: undefined = no check, present (even null) = sameSecond"
key-files:
  created: []
  modified:
    - app/validators/course_content.ts
    - app/controllers/course_contents_controller.ts
    - tests/functional/builder_moves.spec.ts
    - tests/functional/csrf.spec.ts
decisions:
  - "The 409 item on updates is row.serializeAttributes() (attributes only), so the preloaded course / module relations are not sent back"
  - "createModule depth check is parent.parentId !== null (no tree load); createContent uses depthOf over the course's id/parent_id map"
  - "No explicit detach on content delete: content_content_files cascades (FK ON DELETE CASCADE, SQLite foreign_keys=ON)"
metrics:
  duration: "~40 min (plus a rate-limit pause)"
  completed: 2026-11-02
  tasks: 2
  files: 4
---

# Phase 05 Plan 04: JSON edits and deletes, non-empty refusal, creation depth Summary

The builder can now autosave edits and deletes through JSON. Updates detect conflicts with the optional `updatedAt` token. Dates and description can be cleared, and an inverted date range is refused. The server refuses to delete a non-empty section, checking under the course-row lock. Creating a section or a content item takes the same lock and enforces the 2-level limit. Each committed delete writes exactly one audit row, with ids only. A test confirms that a JSON caller without a CSRF token gets Shield's 302.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 5437ddc | feat(builder): return JSON with conflict check from module and content updates |
| 2 | 78e32fa | feat(builder): refuse deleting non-empty sections and enforce depth on creation |

## Response shapes (05-06 parses these)

JSON only when `Accept: application/json`. Inertia requests and requests with no Accept header keep flash + redirect back.

**PUT `/modules/:moduleId`, PUT `/contents/:contentId`** (body may include `updatedAt: string | null`):
- **200**: `{ item: { id: number, updatedAt: string | null } }`, where `updatedAt` is the new token.
- **409**: `{ code: 'E_CONFLICT', message: 'Cet élément a été modifié par un autre enseignant.', item: <row attributes, camelCase> }`. Sent only when `updatedAt` was sent and is stale. Retrying with `item.updatedAt` succeeds (tested).
- **422 (date order)**: `{ errors: [{ field: 'availableUntil', message: 'La date de fin doit être postérieure à la date de début.' }] }`. The check runs against the stored values merged with the payload, so a partial update is refused as well.
- **422 (validation)**: VineJS `{ errors: [...] }`.
- **403**: Bouncer JSON denial.
- Field semantics: `undefined` leaves the field untouched, `null` clears it (description, availableFrom, availableUntil), and a date string sets it.
- HTML: a conflict or an inverted range gives flash `error` + back; success gives flash `success` + back, as before.

**DELETE `/modules/:moduleId`**:
- **200**: `{ item: { id } }`
- **409**: `{ code: 'E_NOT_EMPTY', message: "Déplacez ou supprimez d'abord son contenu." }`. Returned when the section has any content or sub-section; the counts run after `forUpdate()` in the same transaction.
- HTML: flash `error` with the same message + back, or flash `success` + back.

**DELETE `/contents/:contentId`**:
- **200**: `{ item: { id } }`. The `content_content_files` pivot rows and `content_progress` rows cascade. `content_files` rows and blobs are kept.

**POST create routes** (HTML only, unchanged shape): flash `error` `Profondeur maximale : 2 niveaux.` when the parent is a sub-section or the target section is a legacy third level, and flash `error` `Module parent invalide.` when the parent is missing or foreign. Nothing is created in either case.

**CSRF (BUILD-10)**: when a JSON caller sends no token, Shield returns a **302** with `errorsBag.E_BAD_CSRF_TOKEN`. Nothing is written. This matches what 05-03's `sendJson` expects.

## Audit

- `course.module.delete` / `CourseModule`, metadata `{ courseId, parentId }`
- `course.content.delete` / `CourseContent`, metadata `{ courseId, moduleId }`
- Written once after a committed delete, in both the JSON and the HTML branch. A refused (409) or forbidden (403) delete writes none (tested).

## Deviations from Plan

**1. [Rule 1 - Test] Engine-neutral boolean assertion.** SQLite returns `is_published` as `0`/`1` on a fresh fetch, so the BUILD-08 test asserts `Boolean(after.isPublished)`. This is how the model already reads booleans and not a controller change.

**2. [Rule 2] The 409 body on updates uses `serializeAttributes()`, not `serialize()`.** The update actions preload `course` (and `module.course`), and `serialize()` would have echoed those relations. The 05-01 move 409s serialize an unpreloaded fresh row, so the shapes match in practice.

**3. [Test fixture] Widened the `createModule` / `createContent` helper overrides** to accept `description`, `availableFrom` and `availableUntil`.

## Known limitations

- The update conflict check is a check-then-save on one row, outside the course lock, as decided. As in 05-01, two writes in the same second are not detected.
- On SQLite, `forUpdate()` compiles to nothing, so the tests cannot reproduce the create-vs-delete race. The lock's position is checked by grep instead: one lock per create method, before `.create(`.

## TDD Gate Compliance

Both tasks ran RED first (Task 1: 6 failing; Task 2: 7 failing), then GREEN. The plan asks for one `feat` commit per task, so there are no separate `test(...)` commits.

## Verification

- `node ace test unit functional` (sqlite, PORT=3454): 302 passed
- `bun run typecheck`, `bun run lint`, `bun run check:debt`: exit 0
- Acceptance greps: `updatedAt: vine.string().nullable().optional()` = 2, `vine.date().nullable().optional()` = 4, `sameSecond(` = 4, audit actions = 2, `withCsrfToken()` 9 ≥ 9 writes, `E_BAD_CSRF_TOKEN` = 2, no `...payload` in the update actions

## Self-Check: PASSED

- Modified files exist; commits 5437ddc and 78e32fa are present on worktree-agent-a069d3e3501b61f4a
