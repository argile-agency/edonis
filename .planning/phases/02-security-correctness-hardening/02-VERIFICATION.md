---
phase: 02-security-correctness-hardening
verified: 2026-10-28T10:00:00Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 6/7
  gaps_closed:
    - "CR-02: EnrollmentsController.show serialized enrollmentKey to any logged-in user"
    - "CR-03: CoursesController.show sent the unfiltered module/content tree to every viewer of a public course"
  gaps_remaining: []
  regressions: []
gaps: []
deferred: []
human_verification:
  - test: "Run CI on PostgreSQL and MySQL/MariaDB (the full functional + unit matrix) against main"
    expected: "All 218 tests pass on every engine. Phase 2 was only run on SQLite. Watch the widen_users_pii_columns migration, the conditional increments in EnrollmentService and the isUniqueViolation mapping, which are engine-specific."
    why_human: "Needs the CI matrix or local PG/MySQL; not run for this phase's changes."
  - test: "DEBT-08 production gate: on demo.edonis.org run SELECT @@sql_mode, the phone/mobile_phone length query, then node ace pii:scan (and --fix for legacy plaintext). Only after a clean scan set PII_DECRYPT_STRICT=true."
    expected: "No undecryptable rows; sql_mode known. Until then PII_DECRYPT_STRICT stays off (the shipped default)."
    why_human: "Production access. The user skipped these checks (02-07 Q1 = SKIP). Not a code gap: the raise-on-strict behaviour is implemented and tested."
  - test: "Run the browser accessibility suite (node ace test browser tests/browser/accessibility.spec.ts) including the errors/forbidden 403 page"
    expected: "No critical/serious axe violations"
    why_human: "Playwright browser tests were not run in this verification."
  - test: "In a browser, open /courses/:id/enroll as a student on a key-method course, and /courses/:id as an enrolled student"
    expected: "The key form renders (driven by requiresKey) and enrolment with the key works; the course page renders for a learner without the module tree (learners use the outline/learn routes)"
    why_human: "UI rendering after the props contract changed (enrollments/show.tsx interface, courses/show modules now empty for non-editors) is not covered by the functional tests, which assert Inertia props only."
---

# Phase 2: Security and Correctness Hardening Verification Report

**Phase Goal:** Authorization and validation applied uniformly; no silent failures
**Verified:** 2026-10-28
**Status:** human_needed (all code truths verified; only environment/production/browser checks remain)
**Re-verification:** Yes, after gap closure (plans 02-15 and 02-16)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: `app/policies/` exists; ownership checks route through it; grep gate returns 0 | VERIFIED (regression check) | `app/policies/{course,enrollment}_policy.ts`, `main.ts` present. `bun run check:debt` exits 0 (grep gate for `hasPermission(`, `hasRole(`, `instructorId ===`, `.roles.some(` and for `request.only/input/all(` in `app/controllers`). |
| 2 | SC2: DEBT-05 actions read input only through `request.validateUsing()` | VERIFIED (regression check) | Same `check:debt` gate (second clause) exits 0; validation specs are in the green functional run. |
| 3 | SC3: counter mutations transactional and atomic; counters equal COUNT(*) | VERIFIED (regression check; CR-06 caveat stays out of scope) | `app/services/enrollment_service.ts` present; `enrollment_counters.spec.ts` green. |
| 4 | SC4: category cycle rejection and subtree recompute | VERIFIED (regression check) | `app/helpers/category_tree.ts` present; category specs green. |
| 5 | SC5: decryption failures logged, never raw; strict mode raises | VERIFIED (regression check; WR-04 caveat) | `commands/pii_scan.ts` present; unit and functional encryption specs green. |
| 6 | SC6: 2FA pending timeout and documented recovery | VERIFIED (regression check) | `app/helpers/two_factor_pending.ts`, `commands/user_reset_two_factor.ts` present; 2FA specs green. |
| 7 | Goal-level: authorization applied uniformly on read paths (CR-02, CR-03) | VERIFIED | See the two closures below. |

**Score:** 7/7

### Gap closure evidence (code read, not SUMMARY)

**CR-02 (enrolment key disclosure) is closed.**
- `app/models/course_enrollment_method.ts:49` is now `@column({ serializeAs: null }) enrollmentKey`. `serialize()` drops it everywhere, including when the method is nested in `course.serialize()` (the preloaded `enrollmentMethods` relation in `EnrollmentsController.show`).
- `EnrollmentsController.show` (`enrollments_controller.ts:64-95`) now calls `bouncer.with('CoursePolicy').authorize('viewEnrollmentPage', course)` and maps methods through `toLearnerMethod`, an explicit whitelist (id, methodType, name, isEnabled, limits, dates, messages, `requiresKey`, `isAvailable`) with no key.
- `CoursePolicy.viewEnrollmentPage` = `course.canEnroll() || view(...)`; admins pass via `before`. A draft/archived public course is refused (403) to an unrelated student; a private course open for enrolment stays reachable by link (documented design, key not leaked).
- The only remaining `enrollmentKey` reader besides the validator and `validateKey` is `CoursesController.manageEnrollmentMethods` (`courses_controller.ts:314-335`), which is behind `authorize('manage', course)` and adds the key explicitly. `grep` over `app`, `inertia`, `start` shows no other consumer. The learner page (`inertia/pages/enrollments/show.tsx`) now uses `requiresKey` / `isAvailable` and no longer declares `enrollmentKey`.
- Tests: `tests/functional/enrollments_show.spec.ts` asserts the learner props contain neither the sentinel key nor the string `enrollmentKey`, the key form still renders, the manager still sees the key, and the 403/200 matrix (closed private, open private, closed public, public draft, enrolled in archived, view-permission holder and admin).

**CR-03 (unfiltered module tree) is closed.**
- `CoursesController.show` (`courses_controller.ts:145-191`) authorizes `view`, then loads modules only `if (canEdit)` and sends `modules: canEdit ? ... : []`. A student (enrolled or not) gets no tree, no content bodies, no `fileUrl`/`externalUrl`.
- `CoursePolicy.view` (`course_policy.ts:46-54`) now requires `course.isPublished()` for the public-visibility shortcut; otherwise owner/permission holder, or a public course the user is enrolled in. Admins pass via `before`. This is the user-approved 02-16 visibility change.
- Tests: `tests/functional/courses_show.spec.ts` covers non-enrolled and enrolled students (empty tree), owner / edit co-instructor / admin (full tree), and the public-draft 403 for an unrelated student with the owner still allowed. `authorization.spec.ts` gained 26 lines for the view rule.
- Sibling paths checked: `outline`, `learn`, progress use `learn` (AS3), content files use `viewAsStaff` (02-14), so no other read path ships the tree.

### Test and gate evidence (run by the verifier, Node 22, SQLite)

| Check | Result |
|-------|--------|
| `node ace test functional` (PORT=3425, own sqlite file) | 190/190 pass |
| `node ace test unit` | 28/28 pass (218 total, matches the claim) |
| `bun run check:debt` | exit 0 |
| `TBD\|FIXME\|XXX` in app, commands, start, database, tests | none |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| DEBT-04 | SATISFIED | Mutations and read paths (`courses.show`, `enrollments.show`, outline, files) route through `CoursePolicy`; gate 0 |
| DEBT-05 | SATISFIED | validator gate 0, specs pass |
| DEBT-06 | SATISFIED | transaction, atomic counters, recount, invariant test (CR-06 caveat) |
| DEBT-07 | SATISFIED | cycle rejection, subtree recompute, integrity command |
| DEBT-08 | SATISFIED (code) / NEEDS HUMAN (prod) | strict raise implemented, default off; production checks skipped by the user |
| DEBT-09 | SATISFIED | 10-min expiry, lockout, admin reset, CLI, doc |

No orphaned IDs. `.planning/REQUIREMENTS.md` still shows DEBT-04..09 as `[ ]` / Pending (lines 28-33, 176-181); update them when the phase is closed.

### Anti-Patterns Found

None in the gap-closure files. No debt markers; no stubs. `toLearnerMethod` is a real whitelist, not a placeholder.

### Out-of-scope observations (unchanged; not gaps)

- CR-01 / CR-05 (`Course.serialize()` embeds `User.serialize()`, decrypted PII; also `course.permissions.user` is still sent to every viewer of `courses.show`, and the instructor on `enrollments.show`), CR-04 (GDPR export queries `submissions.user_id`; the column is `student_id`), CR-06 (`courses.enrolled_count` increment not conditional on `max_students`), and warnings WR-01..WR-20, IN-01..IN-05 from `02-REVIEW.md` were triaged as out of scope earlier and stay as follow-ups. CR-01 and CR-04 are worth a dedicated fix soon.
- User-approved behaviour changes (AS2-AS5, the 02-16 visibility change, `PII_DECRYPT_STRICT` default off) and the deferred "teachers may publish directly" todo are not flagged.
- The unrelated CSS commit 2154b10 was ignored.

### Human Verification Required

1. **CI on PostgreSQL and MySQL/MariaDB.** Run the matrix against main; expect 218/218 on every engine (phase 2 ran on SQLite only).
2. **DEBT-08 production checks.** `SELECT @@sql_mode`, phone-length query, `node ace pii:scan` on demo.edonis.org before enabling `PII_DECRYPT_STRICT`. Skipped by the user; not a code gap.
3. **Browser accessibility suite** including the 403 page.
4. **Manual UI pass** on `/courses/:id/enroll` (key form still drives off `requiresKey`) and `/courses/:id` for a learner (page renders with an empty module list). Functional tests check Inertia props only.

### Gaps Summary

No blocking gaps. Both previous blockers (CR-02, CR-03) are closed in code and covered by regression tests, and the other six truths show no regression (218/218 tests, debt gate 0). Status is `human_needed` solely because of the CI-on-other-engines, production, and browser checks listed above.

---

_Verified: 2026-10-28_
_Verifier: Claude (gsd-verifier)_
