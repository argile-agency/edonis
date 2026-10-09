---
phase: 2
slug: security-correctness-hardening
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-09
approved: 2026-10-09
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `02-RESEARCH.md` § Validation Architecture. Owners filled 2026-10-09 from plans 02-01..02-14 (`02-NN TM` = plan NN, task M). Revised 2026-10-09 after the plan-checker pass: CSRF harness, per-task `--files` sampling, `PII_DECRYPT_STRICT`, CLI audit rows, and the forbidden-page axe case.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Japa `@japa/runner` 4.4.0 + `@japa/assert`; `@japa/api-client` 3.2.1 (added by Phase 1 plan 01-03) |
| **Config file** | `tests/bootstrap.ts`, `adonisrc.ts` → `tests.suites` |
| **CSRF harness** | `shieldApiClient()` from `@adonisjs/shield/plugins/api_client`, registered in `tests/bootstrap.ts` by **02-01 T1**, the only Phase 2 edit to that file. It provides `.withCsrfToken()`. Wave-1 plans 02-02 and 02-03 run in parallel with 02-01, so they use a spec-local `withCsrf()` helper built on the hoisted `csrf@3.1.0` package. 02-08 converts `two_factor.spec.ts` to `.withCsrfToken()`. |
| **Quick run command** | `bun run lint && bun run typecheck && node ace test unit` |
| **Per-task functional command** | `PORT=34NN DB_FILENAME=./tmp/test-02-NN.sqlite3 node ace test functional --files <spec> [--files <spec>]` (only the specs the task touches) |
| **Full suite command** | `bun run lint && bun run typecheck && node ace test unit && node ace test functional` |
| **Estimated runtime** | unit: seconds (DB-free) · one functional spec: seconds (SQLite via `.env.test`) · full functional: once per wave |

**Suites:**

| Suite | Contents | DB |
|---|---|---|
| `unit` | Pure logic: cycle check, `EncryptionService` (both `PII_DECRYPT_STRICT` modes), 2FA pending-state reader | none (Phase 1 contract: migrate hook scoped to `functional`) |
| `functional` | CSRF harness, policies, validators, counters, categories-against-DB, PII round-trips, 2FA flow | SQLite `.env.test`, migrate once + `withGlobalTransaction()` per test |
| `browser` | axe-core a11y, including the new `errors/forbidden` case | seeded DB (`e2e.yml`) |

Design constraints (verified in research and revision):
- `db.transaction()` inside a globally-transactioned test becomes a savepoint. A service rollback undoes only its savepoint.
- Concurrency cannot be demonstrated on SQLite under a global transaction. **Test invariants, not races.**
- Engine-specific claims (affected-row semantics, `varchar` widening) are proven only on the CI matrix (pg / mysql / sqlite).
- Shield CSRF is enforced in the functional suite (`config/shield.ts`: enabled, no `exceptRoutes`). An un-tokened write is redirected back (302) with flash `errorsBag.E_BAD_CSRF_TOKEN` and never reaches the controller. Therefore:
  - every write chains `.withCsrfToken()`
  - negative tests assert a field-specific `inputErrorsBag.<field>` key, an exact flash, or a positive control in the same request
  - 302 assertions call `assertNotCsrfRejected` (`tests/functional/helpers/factories.ts`)
- `env.set('PII_DECRYPT_STRICT', ...)` is process-global; specs restore it in `finally` / `group.each.teardown`.

---

## Sampling Rate

- **After every task commit:** `bun run lint && bun run typecheck && node ace test unit --files <touched unit spec>` plus `node ace test functional --files <touched functional spec(s)>` (the task's `<verify>`)
- **After every plan (wave gate):** the full `node ace test functional` (each plan's `<verification>`), plus the two grep gates below
- **Before `/gsd:verify-work`:** full suite green on the CI matrix (pg / mysql / sqlite), plus `e2e.yml` for the browser a11y suite
- **Max feedback latency:** under 30 seconds per task (unit gate plus one or a few `--files` specs)

**Grep gates (measurable form of success criteria 1 and 2):**

```bash
grep -rn "hasPermission(\|hasRole(\|instructorId ===\|isInstructor(\|\.roles\.some(" app/controllers | wc -l   # → 0
grep -rn "request\.\(only\|input\|all\)(" app/controllers | wc -l                                              # → 0
```

**Per-spec CSRF gate (every spec that sends writes):**

```bash
test "$(grep -c "withCsrfToken()" F)" -ge "$(grep -cE "client\.(post|put|patch|delete)\(" F)"   # wave 1 (02-02, 02-03): count withCsrf( instead, same -ge
```

---

## Per-Task Verification Map

| Req | Behaviour to prove | Test Type | Automated Command | Owner | Status |
|---|---|---|---|---|---|
| (harness) | A write without a CSRF token is rejected (flash `errorsBag.E_BAD_CSRF_TOKEN`, DB unchanged); with `.withCsrfToken()` it reaches the controller | functional | `--files tests/functional/csrf.spec.ts` | 02-01 T1 | ⬜ pending |
| DEBT-04 | Owner / edit / manage / admin / student matrix for `CoursePolicy` actions; `scopeVisibleCourses` mutates in place with a grouped OR | functional | `--files tests/functional/authorization.spec.ts` (policy matrix) + `--files tests/functional/authorization_courses.spec.ts` (HTTP) | 02-01 T2 (matrix), 02-04 T2 (HTTP), 02-09 T1 (AS2 rows) | ⬜ pending |
| DEBT-04 | Cross-course ids in `reorderModules` / `reorderContents` / `removePermission` have no effect (A2–A4), each with an in-scope positive control | functional | `--files tests/functional/authorization_courses.spec.ts` (A4) · `--files tests/functional/authorization_contents.spec.ts` (A2, A3, plus A5, A8) | 02-04 T2 (A4), 02-10 T1 (A2, A3, A5, A8) | ⬜ pending |
| DEBT-04 | `unenroll` by self succeeds (A1 regression) | functional | `--files tests/functional/enrollments_access.spec.ts` | 02-05 T1 | ⬜ pending |
| DEBT-04 | Denied Inertia request → 403 renders `errors/forbidden` | functional | `--files tests/functional/grades.spec.ts` (Test 3 `.withInertia()` → `errors/forbidden`; Test 5 JSON 403) | 02-01 T3 (also asserted in 02-04, 02-05, 02-10) | ⬜ pending |
| DEBT-04 | `errors/forbidden` has no critical/serious axe violations | browser | `node ace test browser --files tests/browser/accessibility.spec.ts` (seeded; authoritative run in `e2e.yml`) · task gate: grep for the new case | 02-01 T3 | ⬜ pending |
| DEBT-04 | No inline authorization checks remain in controllers | static | grep gate 1 → 0 (`bun run check:debt`) | 02-14 T1 (per-file gates in 02-01, 02-04, 02-05, 02-10) | ⬜ pending |
| DEBT-05 | Missing / invalid body on the 17 raw-input actions → 422 or flash+redirect with the field-specific `inputErrorsBag` key, never 500 | functional | V1–V7, V14: `--files tests/functional/validation.spec.ts` · V8: `categories.spec.ts` · V9–V12: `enrollments_access.spec.ts` · V13, V15, V16: `validation_listing.spec.ts` · V17: `authorization_contents.spec.ts` | 02-11 T3, 02-06 T2, 02-05 T1, 02-12 T3, 02-10 T1 | ⬜ pending |
| DEBT-05 | `/courses/abc` → 404 (route param matchers) | functional | `--files tests/functional/validation_listing.spec.ts` | 02-12 T2/T3 | ⬜ pending |
| DEBT-05 | No raw input reads remain | static | grep gate 2 → 0 (`bun run check:debt`) | 02-14 T1 (per-file gates in 02-05, 02-06, 02-10, 02-11, 02-12) | ⬜ pending |
| DEBT-06 | Full method (`max=1`, one enrolled) rejects the next enrolment; counters unchanged | functional | `--files tests/functional/enrollment_counters.spec.ts` | 02-13 T1 (service), 02-13 T2 (HTTP) | ⬜ pending |
| DEBT-06 | After enrol ×3, unenrol ×1, removeParticipant ×1: `enrolled_count`, `current_enrollments`, `current_members` equal `COUNT(*)`; each step asserts its own effect | functional | same file (group "Counters - mixed sequence") | 02-14 T1 (+ AS5 variant 02-14 T2) | ⬜ pending |
| DEBT-06 | Conditional-increment affected-row semantics hold on each engine | functional (CI matrix) | same file in `ci.yml` pg/mysql/sqlite matrix (`tryIncrementMethod` returns 0/1 asserted with `strictEqual`) | 02-13 T1 | ⬜ pending |
| DEBT-06 | `enrollment:recount` repairs seeded drift; real runs write `cli.enrollment.recount` audit rows, dry runs write none | functional | same file (`EnrollmentService.recount`; command wraps it) | 02-13 T1 (service + audit), 02-13 T2 (command) | ⬜ pending |
| DEBT-07 | `wouldCreateCycle`: self, child, grandchild, unrelated, pre-existing cycle | unit | `node ace test unit --files tests/unit/category_tree.spec.ts` | 02-06 T1 | ⬜ pending |
| DEBT-07 | PUT category with a descendant as parent → rejected with the exact flash, DB unchanged; move recomputes grandchild `path` / `depth` | functional | `--files tests/functional/categories.spec.ts` | 02-06 T2 | ⬜ pending |
| DEBT-08 | `decrypt(garbage)`: throws `DecryptionException` when `PII_DECRYPT_STRICT=true`, returns `null` when off/unset; never the raw value; round-trip OK; no value in log | unit | `node ace test unit --files tests/unit/encryption_service.spec.ts` | 02-07 T2 (+ silent-auth both modes / 2FA: `decryption_failures.spec.ts`, 02-07 T3) | ⬜ pending |
| DEBT-08 | A 10-digit phone saved via `/user/profile` persists and reads back (proves column widening) | functional (CI matrix) | `--files tests/functional/pii.spec.ts` | 02-02 T1 | ⬜ pending |
| DEBT-08 | `pii:scan` classifies ok / legacy-plaintext / undecryptable rows; `--fix` / `--null-undecryptable` write `cli.pii.*` audit rows without values; report-only writes none | functional | same file | 02-02 T2 | ⬜ pending |
| DEBT-09 | `readPending`: none / expired / ok with injected `now` | unit | `node ace test unit --files tests/unit/two_factor_pending.spec.ts` | 02-03 T1 | ⬜ pending |
| DEBT-09 | Expired pending state → redirect to exactly `/login` + audit row; 5th wrong code clears state (6th attempt finds no state) | functional | `--files tests/functional/two_factor.spec.ts` | 02-03 T2 | ⬜ pending |
| DEBT-09 | Admin reset clears the 4 fields and writes `admin.user.2fa.reset`; non-admin → 403 | functional | same file (group "Two-factor - admin reset") | 02-08 T1 | ⬜ pending |
| DEBT-09 | Recovery doc exists | static | `test -f docs/TWO_FACTOR_RECOVERY.md` | 02-08 T2 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

**Precondition (not a Phase 2 deliverable):** Phase 1 executed (01-03 test infrastructure, 01-05 CI gates). It is not done yet: `tests/bootstrap.ts` on disk is still the pre-Phase-1 version. Plan 02-01's `<interfaces>` STOP guard enforces it: no `grades.spec.ts`, no `.env.test`, or no `sessionApiClient(app)` in `tests/bootstrap.ts` means stop.

Phase 2 Wave 0 items, each owned by a planned task:
- [x] CSRF harness: `shieldApiClient()` in `tests/bootstrap.ts` plus `tests/functional/csrf.spec.ts`. **Owner: 02-01 T1**
- [x] Test helpers for user-with-role, course, enrollment method, enrollment, group, and `assertNotCsrfRejected` in `tests/functional/helpers/factories.ts`. No model factories exist; CLAUDE.md forbids new *seeders*, not test helpers; unique emails avoid seeder collisions. **Owner: 02-01 T1** (wave-1 plans 02-02/02-03 create users inline)
- [x] `tests/unit/category_tree.spec.ts` (02-06 T1), `tests/unit/encryption_service.spec.ts` (02-07 T2), `tests/unit/two_factor_pending.spec.ts` (02-03 T1)
- [x] `tests/functional/authorization.spec.ts` (02-01 T2), `validation.spec.ts` (02-11 T3), `enrollment_counters.spec.ts` (02-13 T1), `categories.spec.ts` (02-06 T2), `pii.spec.ts` (02-02 T1), `two_factor.spec.ts` (02-03 T2)
- [x] `package.json` script `check:debt` running the two grep gates. **Owner: 02-14 T1**

---

## Manual-Only Verifications

| Behaviour | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| Production data impact of widening `users.phone` / `mobile_phone` and of raising on decrypt failure | DEBT-08 | Needs production MariaDB access | Operator runs the read-only queries from `02-RESEARCH.md` Q1 and records per-environment `pii:scan` counts. **Owner: 02-07 Task 1** (`checkpoint:human-action`, blocking, before any raise code). |
| Turning on `PII_DECRYPT_STRICT=true` per environment | DEBT-08 | Ops step after deploy | Only after that environment's `pii:scan` reports 0 undecryptable (and legacy plaintext was `--fix`ed before 02-07 deployed). Release ordering in `02-07-SUMMARY.md`, `.env.example`, and the 02-14 release checklist. |
| Behaviour changes AS2–AS5 (gradebook access, enrolment-gated outline, server-side `canEnroll`, group cleanup on unenrol) | DEBT-04 / DEBT-06 | Product decisions, no CONTEXT.md exists | Operator confirms each in a checkpoint task before the policy rule ships. **Owners:** AS2 → 02-09 T2 · AS3 → 02-10 T3 · AS4 → 02-05 T3 · AS5 → 02-14 T3 (each an isolated commit with a `git revert` path on reject) |
| Q4 / T-02-53: teachers creating courses as `published` | DEBT-05 (adjacent) | Open product decision, deferred and NOT accepted | Recorded in `02-11-SUMMARY.md` (`<deferred_open>`) and asked again in `02-14-SUMMARY.md`. No validator change in Phase 2. |
| Forbidden-page axe run when local browser env is unavailable | DEBT-04 | Needs seeded DB, port 3333, Playwright | 02-01 T3 records the local result or defers to `e2e.yml` on the PR. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s (per-task `--files` sampling; the full functional suite runs once per wave)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-09
