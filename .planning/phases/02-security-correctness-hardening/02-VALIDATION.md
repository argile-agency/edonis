---
phase: 2
slug: security-correctness-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-09
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `02-RESEARCH.md` § Validation Architecture. Owners filled 2026-10-09 from plans 02-01..02-14 (`02-NN TM` = plan NN, task M).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Japa `@japa/runner` 4.4.0 + `@japa/assert`; `@japa/api-client` 3.2.1 (added by Phase 1 plan 01-03) |
| **Config file** | `tests/bootstrap.ts`, `adonisrc.ts` → `tests.suites` |
| **Quick run command** | `bun run lint && bun run typecheck && node ace test unit` |
| **Full suite command** | `bun run lint && bun run typecheck && node ace test unit && node ace test functional` |
| **Estimated runtime** | unit: seconds (DB-free) · functional: TBD (SQLite via `.env.test`) |

**Suites:**

| Suite | Contents | DB |
|---|---|---|
| `unit` | Pure logic: cycle check, `EncryptionService`, 2FA pending-state reader | none (Phase 1 contract: migrate hook scoped to `functional`) |
| `functional` | Policies, validators, counters, categories-against-DB, PII round-trips, 2FA flow | SQLite `.env.test`, migrate once + `withGlobalTransaction()` per test |

Design constraints (verified in research):
- `db.transaction()` inside a globally-transactioned test becomes a savepoint. A service rollback undoes only its savepoint.
- Concurrency cannot be demonstrated on SQLite under a global transaction. **Test invariants, not races.**
- Engine-specific claims (affected-row semantics, `varchar` widening) are proven only on the CI matrix (pg / mysql / sqlite).

---

## Sampling Rate

- **After every task commit:** `bun run lint && bun run typecheck && node ace test unit`
- **After every plan wave:** `node ace test functional` plus the two grep gates below
- **Before `/gsd:verify-work`:** full suite green on the CI matrix (pg / mysql / sqlite)
- **Max feedback latency:** ~30 seconds (unit gate)

**Grep gates (measurable form of success criteria 1 and 2):**

```bash
grep -rn "hasPermission(\|hasRole(\|instructorId ===\|isInstructor(\|\.roles\.some(" app/controllers | wc -l   # → 0
grep -rn "request\.\(only\|input\|all\)(" app/controllers | wc -l                                              # → 0
```

---

## Per-Task Verification Map

| Req | Behaviour to prove | Test Type | Automated Command | Owner | Status |
|---|---|---|---|---|---|
| DEBT-04 | Owner / edit / manage / admin / student matrix for `CoursePolicy` actions | functional | `node ace test functional --files tests/functional/authorization.spec.ts` (policy matrix) + `--files tests/functional/authorization_courses.spec.ts` (HTTP) | 02-01 T2 (matrix), 02-04 T2 (HTTP), 02-09 T1 (AS2 rows) | ⬜ pending |
| DEBT-04 | Cross-course ids in `reorderModules` / `reorderContents` / `removePermission` have no effect (A2–A4) | functional | `--files tests/functional/authorization_courses.spec.ts` (A4) · `--files tests/functional/authorization_contents.spec.ts` (A2, A3, plus A5, A8) | 02-04 T2 (A4), 02-10 T1 (A2, A3, A5, A8) | ⬜ pending |
| DEBT-04 | `unenroll` by self succeeds (A1 regression) | functional | `node ace test functional --files tests/functional/enrollments_access.spec.ts` | 02-05 T1 | ⬜ pending |
| DEBT-04 | Denied Inertia request → 403 renders `errors/forbidden` | functional | `--files tests/functional/grades.spec.ts` (Test 3 `.withInertia()` → `errors/forbidden`; Test 5 JSON 403) | 02-01 T3 (also asserted in 02-04, 02-05, 02-10) | ⬜ pending |
| DEBT-04 | No inline authorization checks remain in controllers | static | grep gate 1 → 0 (`bun run check:debt`) | 02-14 T1 (per-file gates in 02-01, 02-04, 02-05, 02-10) | ⬜ pending |
| DEBT-05 | Missing / invalid body on the 17 raw-input actions → 422 or flash+redirect, never 500 | functional | V1–V7, V14: `--files tests/functional/validation.spec.ts` · V8: `categories.spec.ts` · V9–V12: `enrollments_access.spec.ts` · V13, V15, V16: `validation_listing.spec.ts` · V17: `authorization_contents.spec.ts` | 02-11 T3, 02-06 T2, 02-05 T1, 02-12 T3, 02-10 T1 | ⬜ pending |
| DEBT-05 | `/courses/abc` → 404 (route param matchers) | functional | `--files tests/functional/validation_listing.spec.ts` | 02-12 T2/T3 | ⬜ pending |
| DEBT-05 | No raw input reads remain | static | grep gate 2 → 0 (`bun run check:debt`) | 02-14 T1 (per-file gates in 02-05, 02-06, 02-10, 02-11, 02-12) | ⬜ pending |
| DEBT-06 | Full method (`max=1`, one enrolled) rejects the next enrolment; counters unchanged | functional | `node ace test functional --files tests/functional/enrollment_counters.spec.ts` | 02-13 T1 (service), 02-13 T2 (HTTP) | ⬜ pending |
| DEBT-06 | After enrol ×3, unenrol ×1, removeParticipant ×1: `enrolled_count`, `current_enrollments`, `current_members` equal `COUNT(*)` | functional | same file (group "Counters - mixed sequence") | 02-14 T1 (+ AS5 variant 02-14 T2) | ⬜ pending |
| DEBT-06 | Conditional-increment affected-row semantics hold on each engine | functional (CI matrix) | same file in `ci.yml` pg/mysql/sqlite matrix (`tryIncrementMethod` returns 0/1 asserted with `strictEqual`) | 02-13 T1 | ⬜ pending |
| DEBT-06 | `enrollment:recount` repairs seeded drift | functional | same file (`EnrollmentService.recount`; command wraps it) | 02-13 T1 (service), 02-13 T2 (command) | ⬜ pending |
| DEBT-07 | `wouldCreateCycle`: self, child, grandchild, unrelated, pre-existing cycle | unit | `node ace test unit --files tests/unit/category_tree.spec.ts` | 02-06 T1 | ⬜ pending |
| DEBT-07 | PUT category with a descendant as parent → rejected, DB unchanged; move recomputes grandchild `path` / `depth` | functional | `node ace test functional --files tests/functional/categories.spec.ts` | 02-06 T2 | ⬜ pending |
| DEBT-08 | `decrypt(garbage)` throws `DecryptionException`; round-trip OK; no value in log | unit | `node ace test unit --files tests/unit/encryption_service.spec.ts` | 02-07 T2 (+ silent-auth / 2FA: `decryption_failures.spec.ts`, 02-07 T3) | ⬜ pending |
| DEBT-08 | A 10-digit phone saved via `/user/profile` persists and reads back (proves column widening) | functional (CI matrix) | `node ace test functional --files tests/functional/pii.spec.ts` | 02-02 T1 | ⬜ pending |
| DEBT-08 | `pii:scan` classifies ok / legacy-plaintext / undecryptable rows | functional | same file | 02-02 T2 | ⬜ pending |
| DEBT-09 | `readPending`: none / expired / ok with injected `now` | unit | `node ace test unit --files tests/unit/two_factor_pending.spec.ts` | 02-03 T1 | ⬜ pending |
| DEBT-09 | Expired pending state → redirect to login + audit row; 5th wrong code clears state (6th attempt finds no state) | functional | `node ace test functional --files tests/functional/two_factor.spec.ts` | 02-03 T2 | ⬜ pending |
| DEBT-09 | Admin reset clears the 4 fields and writes `admin.user.2fa.reset`; non-admin → 403 | functional | same file (group "Two-factor - admin reset") | 02-08 T1 | ⬜ pending |
| DEBT-09 | Recovery doc exists | static | `test -f docs/TWO_FACTOR_RECOVERY.md` | 02-08 T2 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **Phase 1 executed** (01-03 test infrastructure, 01-05 CI gates). Hard prerequisite for every functional test above.
- [ ] Test helpers for user-with-role, course, enrollment method, enrollment (`tests/functional/helpers/factories.ts` or inline). No model factories exist. CLAUDE.md forbids new *seeders*, not test helpers. Use unique emails to avoid seeder collisions.
- [ ] `tests/unit/category_tree.spec.ts`, `tests/unit/encryption_service.spec.ts`, `tests/unit/two_factor_pending.spec.ts`
- [ ] `tests/functional/authorization.spec.ts`, `validation.spec.ts`, `enrollment_counters.spec.ts`, `categories.spec.ts`, `pii.spec.ts`, `two_factor.spec.ts`
- [ ] Optional `package.json` script `check:debt` running the two grep gates

---

## Manual-Only Verifications

| Behaviour | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| Production data impact of widening `users.phone` / `mobile_phone` and of throwing on decrypt failure | DEBT-08 | Needs production MariaDB access | Operator runs the read-only queries from `02-RESEARCH.md` Q1 and confirms no truncated values before the throwing change ships. **Owner: 02-07 Task 1** (`checkpoint:human-action`, blocking, before any raise code) |
| Behaviour changes AS2–AS5 (gradebook access, enrolment-gated outline, server-side `canEnroll`, group cleanup on unenrol) | DEBT-04 / DEBT-06 | Product decisions, no CONTEXT.md exists | Operator confirms each in a checkpoint task before the policy rule ships. **Owners:** AS2 → 02-09 T2 · AS3 → 02-10 T3 · AS4 → 02-05 T3 · AS5 → 02-14 T3 (each an isolated commit with a `git revert` path on reject) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
