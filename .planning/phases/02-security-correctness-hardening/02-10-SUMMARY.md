---
phase: 02-security-correctness-hardening
plan: 10
subsystem: course-contents authorization
tags: [authorization, bouncer, idor, validation, behaviour-change]
status: complete
requires:
  - 02-01 (CoursePolicy, factories, withCsrfToken)
  - 02-06 (wouldCreateCycle in app/helpers/category_tree.ts)
  - 02-09 (AS2 gradebook rules)
provides:
  - course_contents_controller fully routed through CoursePolicy (edit / learn)
  - scoped child-id writes for module/content reorder and module parents
  - learnQueryValidator (V17)
  - AS3 enrolment gate on outline / progress / updateProgress / markComplete (approved by the user)
affects:
  - app/controllers/course_contents_controller.ts
  - app/validators/course_content.ts
  - app/policies/course_policy.ts
tech-stack:
  added: []
  patterns:
    - "Controller asks (bouncer.with('CoursePolicy')), scopes children (where course_id / module_id)"
    - "Reorders wrapped in db.transaction"
key-files:
  created:
    - tests/functional/authorization_contents.spec.ts
  modified:
    - app/controllers/course_contents_controller.ts
    - app/validators/course_content.ts
    - app/policies/course_policy.ts
    - tests/functional/authorization.spec.ts
decisions:
  - "A8 parent check in updateModule: same-course lookup plus wouldCreateCycle over the course's own modules; one flash text 'Module parent invalide.' for every refusal"
  - "Out-of-scope ids in reorder payloads are silently ignored (no row matches), not rejected, so the builder's existing request shape still works"
  - "AS3 tests, policy change and authorization.spec.ts row flip live in one commit so a revert leaves a green suite"
  - "Stale CoursePolicy.enroll comment fixed in its own docs commit, outside the AS3 commit, so reverting AS3 does not restore it"
  - "AS3 approved by the user at the Task 3 checkpoint: outline, progress summary and progress recording are limited to enrolled students, users with edit rights (owner or co-instructor) and admins; commit d4bab03 kept"
metrics:
  completed: 2026-10-13
  tasks_completed: 3 of 3
---

# Phase 2 Plan 10: Course contents policy routing and IDOR scoping Summary

The course builder, learn player and progress endpoints now authorize through `CoursePolicy` (`edit` / `learn`). Four IDORs are closed. A2: module reorder is scoped to the course. A3: content reorder is scoped to the module. A5: `learn?content=` is scoped to the course. A8: a module parent must belong to the same course and cannot form a cycle. `learn`'s query is validated (V17). The AS3 enrolment gate shipped as an isolated, revertable commit, and the user approved it at the Task 3 checkpoint.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Route builder/learn through CoursePolicy, scope child ids (A2, A3, A5, A8), validate learn query (V17) | 39d4ad5 | app/controllers/course_contents_controller.ts, app/validators/course_content.ts, tests/functional/authorization_contents.spec.ts |
| (extra) | Fix stale CoursePolicy.enroll comment | 561fafc | app/policies/course_policy.ts |
| 2 | AS3: require enrolment or edit rights for outline / progress / updateProgress / markComplete | **d4bab03** | app/policies/course_policy.ts, app/controllers/course_contents_controller.ts, tests/functional/authorization_contents.spec.ts, tests/functional/authorization.spec.ts |
| 3 | Confirm AS3 (checkpoint:human-verify) | APPROVED (keeps d4bab03) | none |

**AS3 SHA:** `d4bab03`

## What changed

**Task 1 (`fix(contents):`)**
- Ten inline `isAdmin` / `canEdit` / `response.forbidden` blocks were replaced with `bouncer.with('CoursePolicy').authorize('edit', ...)`. The unused `CourseEnrollment` import and `auth`/`user` destructures were removed.
- `reorderModules` adds `where('course_id', course.id)` and `reorderContents` adds `where('module_id', module.id)`. Both run inside `db.transaction`.
- `learn`:
  - validates `?content=` with `learnQueryValidator` (positive number, optional)
  - uses `denies('learn') → redirect courses.show`, which keeps the redirect UX and the admin bypass
  - scopes `?content=` with `whereHas('module', course_id = course.id)` and `firstOrFail`, so a foreign id returns 404
- `createModule` requires the `parentId` to be a module of the same course. `updateModule` requires the same, plus `!wouldCreateCycle(parentById, module.id, parentId)`. Any refusal flashes `'Module parent invalide.'`, redirects back, and writes nothing.

**Task 2 (`feat(contents):`, AS3)**
- `CoursePolicy.learn` is now `hasPermission(edit) || isEnrolled`, so owners and editors can preview the player and outline.
- `outline` and `getCourseProgress` call `authorize('learn', course)`. `updateProgress` and `markComplete` load content → module → course and call `authorize('learn', ...)` before `ContentProgress.getOrCreate`.
- `tests/functional/authorization.spec.ts`: the policy-level `learn` row for a non-enrolled owner flipped from `isFalse` to `isTrue`, and the test title was updated. **Yes, `authorization.spec.ts` needed its `learn` row updated**, so it is the 4th file in the AS3 commit, as the plan allows.

## Verification

- Gate 1 (`hasPermission(|hasRole(|instructorId ===|isInstructor(|.roles.some(`) on the controller: **0**. Gate 2 (`request.only|input|all(`): **0**. `response.forbidden`: **0**.
- `where('course_id', course.id)`: 3. `where('module_id', module.id)`: 1. `wouldCreateCycle(`: 1. `db.transaction`: 2. `authorize('learn'`: 4.
- CSRF gate on the spec: 9 `withCsrfToken()` for 9 `client.post|put|patch|delete(` calls.
- Each Task 1 commit had zero `authorize`/`denies` near `outline|getCourseProgress|updateProgress|markComplete` (AS3 was not mixed in).
- `bun run typecheck` and `bun run lint`: exit 0.
- `PORT=3410 DB_FILENAME=./tmp/test-02-10.sqlite3 node ace test functional --files tests/functional/authorization_contents.spec.ts --files tests/functional/authorization.spec.ts`: 26/26 passed.
- Full functional suite (wave gate) after AS3: **88/88 passed**, exit 0.
- RED was observed before each implementation step: 7/8 failing for Task 1, and 6 failing for Task 2 (including the policy row).

Test isolation: `@japa/api-client` reads `process.env.HOST`/`PORT` (`build/index.js:659-660`), and `config/database.ts` reads `DB_FILENAME`, so the unique `PORT=3410` and `DB_FILENAME` were honoured. No Vite HMR port clash occurred. The temp DB was deleted.

## AS3 checkpoint (Task 3)

**Decision: APPROVED.** Commit `d4bab03` is kept. Nothing was reverted, and no new test run was needed because the code did not change after the 88/88 suite run.

The checkpoint asked whether the course outline, progress summary and progress recording should be limited to enrolled students, users with edit rights (owner or co-instructor) and admins, with everyone else getting the forbidden page or a 403.

The user's reply, verbatim: "Oui, il doit être réservé. Un souci, j'approuve la AS3."
Translation: "Yes, it must be restricted. One concern, I approve AS3."

**Open point:** "Un souci" ("one concern") is ambiguous. It may be a typo for "Aucun souci" ("no problem"), or the user may have a concern they did not state. The approval itself is clear. The orchestrator has asked the user to clarify, and that remark is still unresolved.

**Outline-link grep (step 2):** `grep -rn "outline" inertia/pages/courses/show.tsx inertia/pages/courses/index.tsx` returns only `<Badge variant="outline">` / `<Button variant="outline">` styling hits. Neither page links to `/courses/:id/outline`. The only link to the outline anywhere in `inertia/` is inside `inertia/pages/courses/learn.tsx:279`, which only users allowed to learn can reach. No non-enrolled "preview" link would break.

**Side effects accepted with the approval (follow-ups to track):**
- Owners and editors can now open the learn player without enrolling.
- Opening it creates `content_progress` rows for them through `getOrCreate`/`markAsStarted`, so a future teacher completion view (Phase 10) may need to exclude instructors.
- A `view`-only collaborator must still be enrolled to see the outline.

If AS3 ever needs to be undone (for example, if the "Un souci" concern turns out to be an objection): run `git revert --no-edit d4bab03`, then re-run the full functional suite. Task 1's scoping fixes and the comment fix stay.

## Deviations from Plan

### Auto-fixed / additions

**1. [Rule 2 - Test strength] Positive controls added beyond the plan**
- A8 updateModule: after the three refusals, a same-course sibling is accepted. This proves the check does not refuse everything.
- AS3 `contents.progress.update`: an enrolled student sends the same JSON request and gets 200 `success: true` and a row. This proves the denied 403 is the policy, not Shield.
- Commit: 39d4ad5, d4bab03

**2. Extra docs commit `561fafc`**
- The stale `CoursePolicy.enroll` comment ("Not called anywhere until AS4...") was updated. It is kept out of the AS3 commit so a revert does not bring it back.

**3. updateModule same-course check**
- The plan's same-course check and `parentById` build use two queries: an explicit `where('id').where('course_id')` lookup, plus the course's module map for the cycle walk. This matches the plan; noted for clarity.

No architectural changes. `tests/bootstrap.ts`, `adonisrc.ts`, `.env.test` and `config/shield.ts` were not touched.

## Known Stubs

None.

## Threat Flags

None. All surface changes are covered by T-02-43..T-02-48.

## Self-Check: PASSED

- FOUND: tests/functional/authorization_contents.spec.ts
- FOUND: app/controllers/course_contents_controller.ts, app/validators/course_content.ts, app/policies/course_policy.ts
- FOUND commits: 39d4ad5, 561fafc, d4bab03, 509d31b, 80b6e84
