---
phase: 1
slug: code-health-baseline
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-09
planned: 2026-10-09
plans: [01-01, 01-02, 01-03, 01-04, 01-05]
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

> Filled in 2026-10-09 against the five committed plans. Every ❌ "Wave 0" item below is now
> owned by a concrete task.

| Req | Behaviour to prove | Test Type | Automated Command | Owner | Status |
|---|---|---|---|---|---|
| DEBT-01 | `bun run lint` exits 0 | static | `bun run lint` | baseline (`af99ea1`) | ✅ green |
| DEBT-01 | CI **enforces** lint (failure turns CI red) | CI config | `grep -c 'continue-on-error' .github/workflows/ci.yml` → 0 | **01-05 T1**, proven **01-05 T2/T3** | ⬜ pending |
| DEBT-02 | No `as any` in `app/` | static | `bun run lint` (with the `no-restricted-syntax` rule) | **01-01 T1–T3**, **01-02 T1**, rule in **01-04 T2** | ⬜ pending |
| DEBT-02 | Typecheck still passes after cast removal | static | `bun run typecheck` | **01-01 T1–T3**, **01-02 T1** | ⬜ pending |
| DEBT-02 | No grep-dodging variants substituted | static | `grep -rn "as any\|as never\|as unknown as\|@ts-expect-error" app/` → 0 | **01-04 T2** | ⬜ pending |
| DEBT-02 | A re-introduced `as any` fails lint | static | insert a cast → `bun run lint` exits non-zero | **01-04 T2**, re-proven **01-05 T2** | ⬜ pending |
| DEBT-02 (D) | `Course.canEnroll()` actually enforces the date window | unit | `node ace test unit` (`tests/unit/course.spec.ts`, 5 tests) | **01-02 T1** (RED observation mandatory) | ⬜ pending |
| DEBT-02 (D) | Production impact of the window fix is understood | manual | row count + operator confirmation | **01-02 T2** (blocking checkpoint) | ⬜ pending |
| DEBT-02 | Error-handler disclosure gate untouched | static | `git diff -U0 app/exceptions/handler.ts \| grep -E '^[-+].*(debug\|inProduction)'` → empty | **01-01 T2** | ⬜ pending |
| DEBT-03 | Test DB is isolated from the dev DB | config | `grep '^DB_CONNECTION=' .env.test` → `sqlite`; `tmp/test.sqlite3` mtime after a run | **01-03 T1** | ⬜ pending |
| DEBT-03 | Functional suite runs ≥ 1 real test | functional | `node ace test functional` → 4 passed, no `NO TESTS EXECUTED` | **01-03 T3** | ⬜ pending |
| DEBT-03 | Non-enrolled student gets 403 (only automated authz check) | functional | `grep -c "assertStatus(403)" tests/functional/grades.spec.ts` ≥ 1 | **01-03 T3** | ⬜ pending |
| DEBT-03 | No test triggers a full-HTML render (no Vite manifest exists) | functional | suite green while `test ! -f public/assets/.vite/manifest.json` | **01-03 T3** | ⬜ pending |
| DEBT-03 | `unit` suite stays DB-free (migrate hook scoped to `functional`) | config | `node ace test unit` within its 2000ms timeout; hook inside `configureSuite` | **01-03 T2**, re-proven **01-05 T1** | ⬜ pending |
| DEBT-03 | A red functional suite turns CI red | CI config | invert an assertion → non-zero locally, then a failed Actions run | **01-05 T1/T2/T3** | ⬜ pending |
| — | 7 duplicated JSON column configs removed, 3 divergent ones preserved | static | `@column(jsonColumnConfig)` totals 1/2/1/3; `JSON.parse(value)` still 1 each in role/course/app_setting | **01-04 T1** | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All seven are owned by a committed task. Ordered — `.env.test` remains a **data-safety
prerequisite**, not a convenience.

- [x] `.env.test` — isolate the test database. **First task of 01-03.** Throwaway `APP_KEY`
      asserted different from `.env`; `git check-ignore` asserted non-zero so it is tracked.
      → **01-03 T1**
- [x] `bun add -d @japa/api-client` — asserted into `devDependencies`, no postinstall.
      → **01-03 T1**
- [x] `tests/bootstrap.ts` — register `apiClient` + the 3 AdonisJS api_client plugins; add the
      `testUtils.db().migrate()` hook **scoped to the `functional` suite via `configureSuite`**
      (its teardown is `migration:reset`, a full schema drop, so it must not be runner-global).
      → **01-03 T2**
- [x] `tests/functional/grades.spec.ts` — rewritten from scratch; the `.skip` draft is treated as a
      requirements sketch only and deleted. 7 un-ported scenarios preserved as `DEBT-10`.
      → **01-03 T3**
- [x] `tests/unit/` — created with `course.spec.ts`, the 5-test `canEnroll()` regression guard.
      → **01-02 T1**
- [x] `eslint.config.js` — `no-restricted-syntax`, selector `TSAsExpression > TSAnyKeyword`, scoped
      to `app/**` (measured: exactly 16 hits, zero collateral, vs. 98 for `no-explicit-any`).
      Lands in wave 2, **after** the casts are gone.
      → **01-04 T2**
- [x] `.github/workflows/ci.yml` — remove `continue-on-error: true` and the
      `|| echo "No functional tests found yet"` no-op; split into enforced `unit` and `functional`
      steps; rename `unit-tests` → `tests` including the `summary` job's `needs`.
      → **01-05 T1**

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

- [x] All tasks have an automated verify command or a declared Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify
- [x] Wave 0 covers every ❌ reference in the verification map
- [x] No watch-mode flags in any command
- [x] Feedback latency < 20s for the per-task gate (`bun run check`, added in 01-05 T1)
- [x] Cluster D isolated into its own `fix(courses):` commit, manual data check recorded (01-02 T2)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-09 — 5 plans, 3 waves, 13 tasks. Revised after plan-check
iteration 1 (3 blockers, 7 warnings resolved).
