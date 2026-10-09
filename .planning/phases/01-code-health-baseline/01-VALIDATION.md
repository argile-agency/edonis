---
phase: 1
slug: code-health-baseline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-09
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `01-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Japa `@japa/runner` 4.4.0 |
| **Config file** | `tests/bootstrap.ts` + `adonisrc.ts` → `tests.suites` |
| **Quick run command** | `bun run lint && bun run typecheck` |
| **Full suite command** | `node ace test` |
| **Estimated runtime** | ~15s static gate · functional suite TBD (Wave 0 builds it) |

**Suites declared in `adonisrc.ts`:**

| Suite | Glob | Timeout | Exists today |
|---|---|---|---|
| `unit` | `tests/unit/**/*.spec(.ts\|.js)` | 2000ms | ✗ directory does not exist |
| `functional` | `tests/functional/**/*.spec(.ts\|.js)` | 30000ms | ✗ only `grades.spec.ts.skip` |
| `browser` | `tests/browser/**/*.spec(.ts\|.js)` | 60000ms | ✓ 5 specs |

> **No combined check script exists.** Consider adding `"check": "bun run lint && bun run typecheck"` to `package.json` so the per-task gate is one command.

---

## Sampling Rate

- **After every task commit:** `bun run lint && bun run typecheck` (no DB, seconds)
- **After every plan wave:** `node ace test functional` against `.env.test`
- **Before `/gsd-verify-work`:** `bun run lint && bun run typecheck && node ace test` all green, **plus** the anti-dodge grep assertion
- **Max feedback latency:** ~20 seconds for the static gate

---

## Per-Task Verification Map

> Task IDs are assigned by the planner. This table is the *requirement → proof* contract
> the planner must satisfy; it is filled in with concrete task IDs once plans exist.

| Req | Behaviour to prove | Test Type | Automated Command | Infra Exists | Status |
|---|---|---|---|---|---|
| DEBT-01 | `bun run lint` exits 0 | static | `bun run lint` | ✅ | ✅ green (`af99ea1`) |
| DEBT-01 | CI **enforces** lint (failure turns CI red) | CI config | `grep -c 'continue-on-error' .github/workflows/ci.yml` → 0 on the lint step | ❌ W0 | ⬜ pending |
| DEBT-02 | No `as any` in `app/` | static | `bun run lint` (with new `no-restricted-syntax` rule) | ❌ W0 | ⬜ pending |
| DEBT-02 | Typecheck still passes after cast removal | static | `bun run typecheck` | ✅ | ⬜ pending |
| DEBT-02 | No grep-dodging variants substituted | static | `grep -rn "as any\|as never\|as unknown as\|@ts-expect-error" app/` → 0 | ✅ | ⬜ pending |
| DEBT-02 (D) | `Course.canEnroll()` actually enforces the date window | unit | `node ace test unit` (new `tests/unit/course.spec.ts`) | ❌ W0 | ⬜ pending |
| DEBT-03 | Functional suite runs ≥ 1 real test | functional | `node ace test functional` | ❌ W0 | ⬜ pending |
| DEBT-03 | A red functional suite turns CI red | CI config | break an assertion, confirm CI fails; `ci.yml` has no `\|\| echo` no-op | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Ordered — `.env.test` is a **data-safety prerequisite**, not a convenience.

- [ ] `.env.test` — isolate the test database. **Do this first.** The draft spec calls
      `User.query().delete()`; without env isolation that runs against the dev DB.
      Needs its own throwaway `APP_KEY`. Confirm `.gitignore` coverage.
- [ ] `bun add -d @japa/api-client` — not installed; blocks DEBT-03 entirely
- [ ] `tests/bootstrap.ts` — register `apiClient` + the 3 AdonisJS api_client plugins;
      add a `testUtils.db().migrate()` setup hook
- [ ] `tests/functional/grades.spec.ts` — rewrite from scratch. The `.skip` draft produces
      **15 TypeScript errors**; treat it as a requirements sketch, not a starting point
- [ ] `tests/unit/` — create; needed for the `canEnroll()` regression test guarding Cluster D
- [ ] `eslint.config.js` — add the `no-restricted-syntax` guard
      (selector `TSAsExpression > TSAnyKeyword`, scoped to `app/**`; measured: catches
      exactly 16, zero collateral — vs. `no-explicit-any` at 98 errors project-wide)
- [ ] `.github/workflows/ci.yml` — remove `continue-on-error: true` from the lint step;
      remove `|| echo "No functional tests found yet"` from the functional step

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| Production data impact of the Cluster D fix | DEBT-02 | Requires querying live data; cannot be asserted in CI | Before merging the `canEnroll()` fix, count `courses` rows where `start_date > now()` or `end_date < now()`. Those enrollments silently pass today and will begin to be refused. Confirm this is intended. |

---

## Risk Notes

**Cluster D is the only runtime behaviour change in this phase.** `DateTime.fromJSDate()`
applied to an already-Luxon `DateTime` returns an invalid DateTime (`valueOf() === NaN`),
so both date guards in `Course.canEnroll()` have always evaluated `false` — enrollment date
windows have never been enforced. Fixing it must land in its own `fix(courses):` commit,
separate from the typing cleanup, with the manual data check above completed first.

Everything else in Phase 1 must be **type- and tooling-only, with zero behaviour delta**.

---

## Validation Sign-Off

- [ ] All tasks have an automated verify command or a declared Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers every ❌ reference in the verification map
- [ ] No watch-mode flags in any command
- [ ] Feedback latency < 20s for the per-task gate
- [ ] Cluster D isolated into its own commit, manual data check recorded
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
