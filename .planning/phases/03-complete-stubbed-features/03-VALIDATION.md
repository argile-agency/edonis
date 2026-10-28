---
phase: 03
slug: complete-stubbed-features
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-28
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `03-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Japa 4 (`@japa/runner`, `@japa/api-client`, plugin-adonisjs, shield/session/auth/inertia api clients) |
| **Config file** | `tests/bootstrap.ts`, `adonisrc.ts` (functional suite migrates a fresh SQLite) |
| **Quick run command** | `export PATH="$HOME/.local/share/fnm/node-versions/v22.19.0/installation/bin:$PATH"; PORT=3433 DB_FILENAME=./tmp/test-03.sqlite3 node ace test functional --files tests/functional/evaluations.spec.ts` |
| **Full suite command** | `PORT=3433 DB_FILENAME=./tmp/test-03.sqlite3 node ace test functional && bun run typecheck && bun run lint && bun run check:debt` |
| **Estimated runtime** | one functional spec: seconds (SQLite); full functional suite: ~2 minutes |

Notes: the default shell Node 24 breaks `node ace`; use Node 22 as above. The dev server holds ports 3333 and 24678, so every run uses a unique `PORT` and `DB_FILENAME` and deletes the temp DB afterwards.

---

## Sampling Rate

- **After every task commit:** the touched spec file via `--files`, plus `bun run typecheck`
- **After every plan wave:** the full functional suite, `bun run lint` and `bun run check:debt`
- **Before `/gsd:verify-work`:** full suite green; CI PostgreSQL and MySQL matrix runs on push
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Task IDs are assigned by the plans; each row below must be covered by at least one task's automated verify.

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| EVAL-01 | student gets 403 `errors/forbidden`; guest redirected to `/login` | functional | `--files tests/functional/evaluations.spec.ts` | ❌ W0 |
| EVAL-01 | owner and edit/manage co-instructor see pending rows; view-only and unrelated teacher do not; admin and manager see all | functional | same | ❌ W0 |
| EVAL-01 | `courseId` of a non-gradable course yields an empty list, no leak | functional | same | ❌ W0 |
| EVAL-01 | `scopeGradableCourses` agrees with `hasPermission(..., 'edit')`; `viewEvaluations` matrix | functional (policy) | `--files tests/functional/authorization.spec.ts` | ✅ extend |
| EVAL-01 | draft rows never listed; graded/returned not in the list | functional | evaluations.spec | ❌ W0 |
| EVAL-01 | default order `submittedAt` asc; `direction=desc`; `sort=student`, `sort=assignment`; 20 per page | functional | evaluations.spec | ❌ W0 |
| EVAL-01 | empty filters (`?courseId=&assignmentId=&sort=&direction=`) give 200; `sort=bogus` gives 302 + `inputErrorsBag.sort` | functional | evaluations.spec | ❌ W0 |
| EVAL-01 | row props carry no `phone` or `address` (minimal DTO) | functional | evaluations.spec | ❌ W0 |
| EVAL-02 | `stats.total === stats.pending + stats.graded`; counts across more than 20 rows; `returned` counted as graded | functional | evaluations.spec | ❌ W0 |
| EVAL-03 | each row has `course.id`; manager GET `/grades/courses/:id` of a non-owned course gives 200 with `isInstructor: true` | functional | `--files tests/functional/grades.spec.ts` | ✅ extend |
| CONTACT-01 | valid guest POST with CSRF gives 302 + success flash | functional | `--files tests/functional/contact.spec.ts` | ❌ W0 |
| CONTACT-01 | missing CSRF token gives `E_BAD_CSRF_TOKEN`, no row; invalid email or empty message gives `inputErrorsBag`, no row; filled honeypot gives success flash, no row, no mail | functional | contact.spec | ❌ W0 |
| CONTACT-02 | row persisted; authenticated user gives `user_id` set | functional | contact.spec | ❌ W0 |
| CONTACT-02 | fake transport records one message: `to` = `AppSetting.contactEmail`, `replyTo` = visitor; `notified_at` set | functional | contact.spec | ❌ W0 |
| CONTACT-02 | transport throws, or transport not configured: still success for the visitor, row exists, `notified_at` null | functional | contact.spec | ❌ W0 |
| CONTACT-02 | GDPR: export includes contact messages; account deletion removes them (depends on the CR-04 export fix) | functional | contact.spec or account test | ❌ W0 |
| CONTACT-03 | 6th POST within the window gives 429 (`limiter.clear()` in setup) | functional | contact.spec | ❌ W0 |
| a11y | `/evaluations` and `/contact` pass axe wcag2a/aa critical and serious | browser | `node ace test browser tests/browser/accessibility.spec.ts` | ✅ extend (manual or nightly) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/functional/helpers/factories.ts`: add `createAssignment(course, overrides)` (default `isPublished: true`) and `createSubmission(assignment, student, overrides)` (default `status: 'submitted'`, `submittedAt: DateTime.now()`, `attemptNumber: 1`)
- [ ] `tests/functional/evaluations.spec.ts`
- [ ] `tests/functional/contact.spec.ts`: set the mail transport and sender per test, restore both in teardown, call `limiter.clear()` in setup

No framework install is needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real e-mail delivery through Infomaniak SMTP | CONTACT-02 | Needs production credentials and outbound SMTP from the pod | After deploying with the SMTP env vars set, submit the contact form and check that the configured address receives it with the visitor in Reply-To |
| Evaluations page with seeded data in a browser | EVAL-01..03 | Visual check of filters, pagination and links | Run `node ace db:seed`, log in as `teacher@edonis.test`, open `/evaluations`, apply the course and assignment filters, click a row |

---

## Validation Sign-Off

- [ ] All tasks have an automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency under 120 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
