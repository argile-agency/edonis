---
phase: 02-security-correctness-hardening
plan: 09
subsystem: authorization
tags: [bouncer, policy, gradebook, AS2, DEBT-04]
requires: [02-01]
provides:
  - "CoursePolicy.viewGradebook: edit permission (owner included) or enrolled; admin via before()"
  - "CoursePolicy.viewGradebookAsInstructor: edit permission (owner included); admin via before()"
affects:
  - app/controllers/grades_controller.ts (unchanged; behaviour follows the policy)
tech-stack:
  added: []
  patterns: ["behaviour change isolated in a single revertable commit behind a human checkpoint"]
key-files:
  created: []
  modified:
    - app/policies/course_policy.ts
    - tests/functional/authorization.spec.ts
    - tests/functional/grades.spec.ts
decisions:
  - "AS2 implemented as one commit (d11cf3b); user decision PENDING at checkpoint Task 2"
metrics:
  completed: 2026-10-13
  tasks_completed: 1
  tasks_total: 2
status: awaiting-checkpoint
---

# Phase 02 Plan 09: AS2 gradebook access for admins and edit co-instructors Summary

Admins and `edit`-permission co-instructors can now open `/grades/courses/:id` in the instructor view. `view`-only collaborators who are not enrolled are still refused. The whole change is one revertable commit, and it is waiting for the user's AS2 decision.

## AS2 commit

- **SHA:** `d11cf3b` (`feat(grades): let admins and edit co-instructors open the course gradebook`)
- **Fallback lookup** (in case a merge, squash or rebase changes the SHA): `git log --format=%h --grep='^feat(grades): let admins'`
- **Revert path (on reject):** `git revert --no-edit <AS2 sha>`, then `PORT=3409 DB_FILENAME=./tmp/test-02-09.sqlite3 node ace test functional`. It must exit 0.
- The commit touches exactly `app/policies/course_policy.ts`, `tests/functional/authorization.spec.ts` and `tests/functional/grades.spec.ts`.

## User decision

**User decision: PENDING (checkpoint Task 2).** The continuation agent replaces this line with the user's reply, verbatim ("approved" or "reject AS2").

## What changed

`app/policies/course_policy.ts`:
- `before()` no longer excludes `viewGradebook` / `viewGradebookAsInstructor`, so admins are bypassed as for every other action. The parameter was renamed `_action` because it is now unused.
- `viewGradebook` = `course.hasPermission(user.id, 'edit')` (owner included) OR enrolled.
- `viewGradebookAsInstructor` = `course.hasPermission(user.id, 'edit')` (owner included).
- The class docblock now says the gradebook rules are widened by AS2, not "no widening".

Tests:
- `authorization.spec.ts`: the two gradebook matrix rows now assert that admin and the edit co-instructor are ALLOWED both actions, the view-only non-enrolled user is DENIED both, the enrolled student is ALLOWED `viewGradebook` and DENIED instructor view, and the owner is unchanged.
- `grades.spec.ts`: 3 new tests on top of the original 5 (8 total):
  - admin gets 200 with `isInstructor === true`
  - edit co-instructor gets 200 with `isInstructor === true`
  - view-only non-enrolled user gets 403 with `errors/forbidden`

## Verification evidence

- **RED:** 4 failures (the 2 matrix rows, the admin HTTP test and the edit co-instructor HTTP test). The view-only test passed during RED, which is correct: it guards against a regression rather than testing new behaviour.
- **GREEN:** `authorization.spec.ts` + `grades.spec.ts` passed 20/20.
- **Wave gate:** the full functional suite (`PORT=3409 DB_FILENAME=./tmp/test-02-09.sqlite3 node ace test functional`) passed 33/33.
- `bun run typecheck && bun run lint`: OK (exit 0).
- Test isolation: `@japa/api-client` reads `process.env.HOST`/`PORT`, and `config/database.ts` reads `DB_FILENAME`. There was no Vite HMR port conflict. The temp DB was deleted afterwards.

## TDD Gate Compliance

The task is `tdd="true"`, but there is no separate `test(...)` commit. The plan requires AS2 to ship as exactly one commit (policy plus tests) so it can be reverted in one step. RED was run and observed before the implementation (see above). Only the commit structure was merged.

## Deviations from Plan

None in behaviour. One cosmetic point: the class docblock comment was updated and `before()`'s unused `action` parameter was renamed `_action`. Both are in the same file and the same commit.

## Known follow-ups

- `app/controllers/grades_controller.ts:87` still has the comment "Owner or enrolled user only (CoursePolicy)". It was left alone on purpose because the AS2 commit is limited to three files. It should be updated if AS2 is approved.
- DEBT-04 is NOT marked complete here. The plan finishes only after the user's decision.

## Threat model

- T-02-41 (information disclosure): the widening is limited to admins and `edit`+ permission holders. A test asserts that `view`-only collaborators are denied. Every `edit` co-instructor will now see every enrolled student's email, full name and grades.
- T-02-42 (privilege escalation through policy regressions): the matrix rows were updated one by one, and the change is an isolated commit with a documented revert path.

## Self-Check: PASSED

- FOUND: app/policies/course_policy.ts, tests/functional/authorization.spec.ts, tests/functional/grades.spec.ts
- FOUND: commit d11cf3b in git log
