---
phase: 02-security-correctness-hardening
plan: 14
subsystem: enrollments
status: paused-at-checkpoint (Task 3, AS5 decision pending)
tags: [enrollments, counters, groups, ci-gates, DEBT-06, DEBT-04, DEBT-05]
requires:
  - 02-13 (EnrollmentService, AlreadyEnrolledException)
  - 02-11 (addParticipant / removeParticipant behind authorize('administer') + validator)
  - 02-01 (withCsrfToken / assertNotCsrfRejected)
provides:
  - addParticipant / removeParticipant through EnrollmentService (C10, C11)
  - "bun run check:debt" (phase gates 1 and 2, enforceable)
  - AS5: unenroll() removes the user's memberships in that course's groups
affects:
  - app/controllers/courses_controller.ts
  - app/services/enrollment_service.ts
  - package.json
tech-stack:
  added: []
  patterns:
    - "per-group DELETE, then a > 0 guarded decrement only when that DELETE removed a row (same double-unenrol guard as 02-13)"
    - "grep-based debt gate as a package script: ! grep ... && ! grep ..."
key-files:
  created: []
  modified:
    - app/controllers/courses_controller.ts
    - app/services/enrollment_service.ts
    - tests/functional/enrollment_counters.spec.ts
    - package.json
decisions:
  - "Admin duplicate participant maps AlreadyEnrolledException to the flash 'Cet utilisateur est déjà inscrit à ce cours.' (302, never 500)"
  - "removeParticipant only finds an enrolment of the course in the URL (where course_id = params.id)"
  - "check:debt also greps hasAnyRole( so the role check cannot be dodged by a sibling helper"
  - "AS5 cleanup runs inside unenroll's transaction and only when the enrolment row was actually deleted"
metrics:
  duration: ~35min
  completed: 2026-10-13
  tasks: 2 of 3 (Task 3 is the AS5 human checkpoint)
  files: 4
---

# Phase 2 Plan 14: Admin participants via EnrollmentService, AS5, check:debt Summary

Admin "add participant" and "remove participant" now go through `EnrollmentService`, so all eleven DEBT-06 counter sites (C1 to C11) use one transactional path. A mixed enrol/unenrol/remove sequence leaves `enrolled_count`, `current_enrollments` and `current_members` equal to the `COUNT(*)` of their source rows. Adding someone who is already enrolled now shows a French flash instead of a 500. `bun run check:debt` makes both phase grep gates enforceable. AS5 (unenrolling also removes the user from that course's groups) is shipped as its own commit and is **waiting for the user's decision** at Task 3.

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 | Admin participants via EnrollmentService, mixed-sequence invariant, check:debt | `55be558` test (RED), `9086b3e` fix(courses) (GREEN), `f814ea0` chore(ci) |
| 2 | AS5: unenrol removes the course's group memberships | `975ec59` feat(enrollments) |
| 3 | Checkpoint: confirm AS5 | pending (user decision) |

### Task 1
- `addParticipant`: after `authorize('administer')`, validation and `Course.findOrFail`, it calls `EnrollmentService.enroll({ methodId: null, courseRole: payload.courseRole ?? 'student', enrolledBy: user.id })`. `AlreadyEnrolledException` becomes `session.flash('error', 'Cet utilisateur est déjà inscrit à ce cours.')` plus a redirect back. The `enrolledCount += 1; save()` lines are gone.
- `removeParticipant`: `EnrollmentService.unenroll(enrollment)` replaces the delete and the read-modify-write counter. The lookup is now scoped to the course in the URL.
- New spec group `Counters - mixed sequence (criterion 3)`:
  - Enrol A and B via HTTP `enroll-self` (self method, auto-assigned to group G), then enrol C via admin `participants.add`.
  - Unenrol A via `enrollments.unenroll`, then remove B via admin `participants.remove`.
  - Every step asserts 302, `assertNotCsrfRejected` and its own row effect.
  - Then three `COUNT(*)` equalities: course 1 = 1, method 0 = 0, and group counter = membership rows.
  - A duplicate admin add asserts 302, the exact flash, an unchanged `enrolled_count` and still one row.
- RED was genuine:
  - `current_enrollments` read 1 against a count of 0, because the old remove never decremented the method counter.
  - The duplicate add returned 500 (`SQLITE_CONSTRAINT_UNIQUE`).

### Task 2 (AS5)
- `EnrollmentService.unenroll` now calls `leaveCourseGroups(trx, courseId, userId)` inside the same transaction, after the enrolment row is deleted:
  - it selects the user's memberships in this course's groups with a `whereIn` subquery on `course_groups.course_id`
  - per group, it DELETEs the membership, and only if that DELETE removed a row, decrements `current_members` with a `> 0` guard
- The docstrings of `unenroll` and `addToGroupIfRoom` were updated, and the "AS5 pending" comment was removed.
- New spec group `EnrollmentService - AS5 group cleanup`:
  - The user is a member of G1 and G2 in course X, and of H in course Y. After unenrolling from X, the user is in neither G1 nor G2, G1's counter is 0, and G2 keeps its other member with a counter of 1. H's membership and counter are untouched.
  - Calling unenrol twice on the same enrolment decrements the group only once.
- The commit contains exactly `app/services/enrollment_service.ts` and `tests/functional/enrollment_counters.spec.ts`.
- **AS5 SHA: `975ec59`**. Revert with `git revert --no-edit 975ec59`.

## check:debt

`"check:debt": "! grep -rn \"hasPermission(\\|hasRole(\\|hasAnyRole(\\|instructorId ===\\|isInstructor(\\|\\.roles\\.some(\" app/controllers && ! grep -rn \"request\\.\\(only\\|input\\|all\\)(\" app/controllers"`

| Run | Exit code |
|-----|-----------|
| Clean tree | **0** |
| Temporary `// request.input(` appended to `app/controllers/home_controller.ts` | **1** (the match is printed) |
| Temporary `// user.hasRole(` appended to the same file | **1** |
| After `git checkout -- app/controllers/home_controller.ts` | **0** |

Both gates were already 0 across `app/controllers` before this plan touched anything. No earlier plan left a match.

Phase gates (ROADMAP Phase 2 success criteria 1 and 2):
- gate 1: `grep -rn "hasPermission(\|hasRole(\|instructorId ===\|isInstructor(\|\.roles\.some(" app/controllers | wc -l` gives **0**
- gate 2: `grep -rn "request\.\(only\|input\|all\)(" app/controllers | wc -l` gives **0**
- `grep -rn "hasAnyRole(" app/controllers | wc -l` gives **0**
- `grep -cE "enrolledCount \+=|enrolledCount - 1" app/controllers/courses_controller.ts` gives **0**

## Verification (phase-closing wave gate, with AS5 in place)

- `PORT=3414 DB_FILENAME=./tmp/test-02-14.sqlite3 node ace test unit` gives **28 passed**.
- `PORT=3414 DB_FILENAME=./tmp/test-02-14.sqlite3 node ace test functional` gives **130 passed**.
- Per task:
  - counters + validation + authorization_courses: 42 passed
  - counters + enrollments_access: 33 passed
- `bun run typecheck` and `bun run lint` exit 0, and `bun run check:debt` exits 0.
- CSRF gate: in `enrollment_counters.spec.ts`, every `client.post|delete(` chains `.withCsrfToken()` on the same line.
- Test isolation: as 02-13 recorded, the api client honours `process.env.PORT` and `config/database.ts` reads `DB_FILENAME`. The temporary DB was deleted afterwards.

## AS5 group-usage grep (checkpoint step 2)

`grep -rn "course_group_members\|CourseGroupMember" app inertia/pages`:

```
app/models/course_group_member.ts:9:export default class CourseGroupMember extends BaseModel {
app/models/course_group.ts:6:import CourseGroupMember from '#models/course_group_member'
app/models/course_group.ts:51:  @hasMany(() => CourseGroupMember, {
app/models/course_group.ts:54:  declare members: HasMany<typeof CourseGroupMember>
app/services/enrollment_service.ts:8,149,163,212,218,256  (enrol / AS5 cleanup / recount)
```

The `members` relation is read only by `courses_controller.ts:422/428`, which preloads members to render the current group roster. `current_members` is displayed on `enrollments/show.tsx`, `courses/enrollment/methods.tsx` and `courses/enrollment/groups.tsx`. No messaging, report or history feature reads past memberships. Groups are used only as a current roster plus a capacity counter.

## AS5 decision

**PENDING.** The user's answer will be recorded here verbatim by the continuation agent.
- "approved": nothing changes.
- "reject AS5": `git revert --no-edit 975ec59`, then the full functional suite and `bun run check:debt`. Both must exit 0, because the mixed-sequence invariant holds without AS5.

## Q4 / T-02-53 (teacher `status: 'published'` bypass)

**Deferred, pending user decision (NOT accepted).** The question asked at phase close: "Should non-admin course creation be forced to `draft` (approval required), or may teachers keep publishing directly?" Answer: **still open** (asked in the Task 3 checkpoint).

## Phase 2 release checklist

1. **02-02:** run `node ace pii:scan` in each environment. If it reports legacy plaintext, run `node ace pii:scan --fix` (audited as `cli.pii.reencrypt`) **before** 02-07 is deployed.
2. **02-03:** users who are in the middle of a 2FA challenge at deploy time are sent back to the login page once. This is harmless; they re-enter their password.
3. **02-07:** deploy with `PII_DECRYPT_STRICT` unset or false. Set `PII_DECRYPT_STRICT=true` in an environment **only after** its `pii:scan` reports 0 undecryptable (or after the user-approved remedy was applied). Environments with it on today: **none** (02-07's Q1 production checks were skipped).
4. **02-13:** run `node ace enrollment:recount --dry-run`, then `node ace enrollment:recount` (audited as `cli.enrollment.recount`) in each environment.
5. **02-14:** `bun run check:debt` is available. The CI workflow does not call it yet, so wiring it into `ci.yml` is a follow-up. If AS5 is kept, memberships that predate it (users who unenrolled earlier but are still in a group) stay in place. The recount fixes counters, not memberships.

## Backlog (out of scope for Phase 2; do not make worse)

- plaintext PII in `audit_logs` via `user.serialize()` (including `ProfileController.update`, per 02-02)
- `AccountController.exportData` queries a nonexistent `submissions.user_id`
- `Math.random` passwords in `SocialAuthController`
- no TOTP replay protection
- `inertia/pages/admin/categories/edit.tsx` is missing
- **Q4 / T-02-53, teacher `status: 'published'` bypass: deferred, pending user decision (NOT accepted)**
- C12, cohort `memberCount`, is outside DEBT-06's wording
- `check:debt` is not yet run by CI

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] removeParticipant ignored the course id in the URL**
- **Found during:** Task 1
- **Issue:** `DELETE /admin/courses/:id/participants/:enrollmentId` looked the enrolment up by `enrollmentId` only, so any course id in the URL removed an enrolment of any course.
- **Fix:** added `.where('course_id', params.id)` (404 on mismatch). `.preload('course')` was dropped because nothing uses it any more.
- **Files:** `app/controllers/courses_controller.ts`
- **Commit:** `9086b3e`

**2. check:debt also greps `hasAnyRole(`**
- This enforces the plan's "no regex dodge" acceptance criterion, in addition to the two phase greps.
- **Commit:** `f814ea0`

### Behaviour notes
- Admin-added participants now get `timeStart = now` (set by `EnrollmentService.enroll`). The old code left `timeStart` null.
- Admin add/remove now also keep the method counter consistent: remove decrements `current_enrollments` when the enrolment had a method.

## TDD Gate Compliance

- Task 1: RED `55be558` (`test(02-14)`, 2 failing tests), then GREEN `9086b3e` (`fix(courses)`).
- Task 2: RED was observed but not committed separately. The two AS5 tests failed (membership still present) before the service change. The plan requires the AS5 commit to contain exactly the service and spec files, so that a revert removes both together. A separate test commit would leave failing tests behind after a revert. Test and implementation therefore ship together in `975ec59` (`feat(enrollments)`).

## Known Stubs

None.

## Requirement status

DEBT-06, DEBT-04 and DEBT-05 are met by the code and gates above. They are left for the orchestrator or continuation agent to mark complete once the AS5 checkpoint is answered.
