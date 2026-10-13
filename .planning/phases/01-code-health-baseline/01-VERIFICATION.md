---
phase: 01-code-health-baseline
verified: 2026-10-13T00:00:00Z
status: human_needed
score: 33/33 must-haves verified locally (5 roadmap criteria + 28 plan truths; roadmap criteria 1 and 4 not yet observed in GitHub Actions; the plan 01-01 behaviour-unchanged truth and the 01-03 dev-DB truth carry warnings)
overrides_applied: 0
re_verification: false
gaps: []
deferred: []
human_verification:
  - test: "Open a PR against main from the phase branch and confirm the CI workflow is green on all jobs, including Tests (postgres), Tests (mysql) and Tests (sqlite)."
    expected: "lint-and-typecheck, build, and all three tests matrix legs pass. The sqlite leg starts despite the empty `image:` service expression. `.env.test` / job `env:` precedence yields the intended database per leg."
    why_human: "Plan 01-05 Task 3 was deferred by the operator. `git fetch origin` fails here and nothing has been pushed. The postgres and mysql legs cannot be run locally."
  - test: "Open a scratch PR with a deliberate `as any` under app/ (lint red) and another with a failing functional assertion."
    expected: "The `Lint & Type Check` job and the `Tests (...)` jobs turn red. The PR cannot merge if those checks are required."
    why_human: "Roadmap criteria 1 and 4 say 'turns CI red'. Only local exit codes plus static inspection of ci.yml exist today."
  - test: "Check the repo's branch protection or ruleset required-status-check list."
    expected: "Required checks use the new name `Tests (postgres|mysql|sqlite)`, not the old `Unit Tests (...)`, and do not rely on `CI Summary` alone."
    why_human: "The `unit-tests` job was renamed to `tests` (REVIEW WR-05) and the `summary` job never fails. GitHub settings are not visible from the repo."
---

# Phase 1: Code Health Baseline Verification Report

**Phase Goal:** Green CI, no `any` escape hatches, and a test suite that actually runs
**Verified:** 2026-10-13
**Status:** human_needed
**Re-verification:** No, initial verification

## Summary

Every roadmap success criterion holds in the working tree, and I confirmed each by running the commands myself, including mutation checks. The one caveat is that "turns CI red" (criteria 1 and 4) has been demonstrated only locally and by static reading of `ci.yml`. No GitHub Actions run has been observed, because plan 01-05 Task 3 was deferred. I record that as a human-verification item. I do not count it as a gap, since the code is in place and the proof step is a push-and-observe action.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A lint failure turns CI red: `continue-on-error` is gone from `ci.yml` | VERIFIED (static + local; Actions run not observed) | `grep continue-on-error .github/workflows/ci.yml` returns nothing. `Run ESLint` is a bare `run: bun run lint` (ci.yml:25-26). `git log -p` shows the removal of `continue-on-error: true` in fca2e29. Lint exits 1 when `as any` is added (mutation below). |
| 2 | `bun run typecheck` exits 0 after removing all `as any` | VERIFIED | `bun run typecheck` returned exit 0 (`tsc --noEmit`, no output). |
| 3 | `grep -rn "as any\|as never\|as unknown as\|@ts-expect-error" app/` returns 0, and a re-introduced `as any` fails lint | VERIFIED | The grep returned exit 1 with no matches. I appended `export const __probe = (1 as any)` to `app/helpers/json_column.ts`, and `bun run lint` exited 1 with `` `as any` is banned in app/ ... no-restricted-syntax ``. I restored the file with `git checkout`. No `eslint-disable`, `ts-ignore` or `ts-nocheck` appears under `app/`. |
| 4 | `node ace test functional` runs real tests, and a failing assertion turns CI red | VERIFIED (static + local; Actions run not observed) | The suite ran 4 real tests (35 migrations applied and reverted) and exited 0. I changed `assertStatus(403)` to `200` in `tests/functional/grades.spec.ts` and the run exited 1 (`3 passed, 1 failed`). I restored the file. In ci.yml the functional step is a bare `run: node ace test functional` (line ~177). The old `\|\| echo "No functional tests found yet"` and `continue-on-error` are removed. |
| 5 | `Course.canEnroll()` enforces its date window, guarded by a unit test | VERIFIED | `app/models/course.ts:272-278` compares the Luxon `DateTime` values directly (`this.startDate > now`, `this.endDate < now`). `tests/unit/course.spec.ts` has 5 tests and all pass (exit 0). Mutation check: I restored the old `DateTime.fromJSDate(this.endDate as any) < now` form, and the unit suite exited 1 with `refuses enrollment when endDate is in the past` failing. The test does guard the bug. I restored the file. |

**Score:** 5/5 roadmap truths verified locally. The enforcement half of 1 and 4 is pending observation in Actions. Plan-level truths are in the next section (28/28 verified, two with warnings), so the overall score is 33/33.

### Local gate results (my own runs)

| Gate | Command | Result |
|------|---------|--------|
| Lint | `bun run lint` | exit 0 |
| Typecheck | `bun run typecheck` | exit 0 |
| Anti-dodge grep | `grep -rn "as any\|as never\|as unknown as\|@ts-expect-error" app/` | exit 1, 0 matches |
| Unit | `PORT=38520 node ace test unit` | exit 0, 5/5 pass |
| Functional | `PORT=38520 node ace test functional` | exit 0, 4/4 pass |
| Mutation: `as any` in app/ | `bun run lint` | exit 1, rule message shown |
| Mutation: old canEnroll bug | `node ace test unit` | exit 1, 1 failure |
| Mutation: wrong status assertion | `node ace test functional` | exit 1, 1 failure |

I restored the working tree after each mutation and `git status --short` is clean. The Vite port 24678 warning is benign, as expected.

### Plan must-haves (PLAN frontmatter, merged with roadmap SCs)

`gsd-sdk` is not installed in this environment, so `verify.artifacts` and `verify.key-links` could not be run. I checked every `contains:` and `pattern:` entry by hand with grep against the working tree.

| Plan | Truth / artifact / link | Status | Evidence |
|------|-------------------------|--------|----------|
| 01-01 | No `as any` in the six owned files | VERIFIED | Repo-wide `app/` grep returns 0 matches. |
| 01-01 | No grep-dodging substitute (`as never`, `as unknown as`, `@ts-expect-error`, `eslint-disable`) | VERIFIED | The anti-dodge grep returns 0. `eslint-disable`, `ts-ignore` and `ts-nocheck` also return 0 under `app/`. |
| 01-01 | Typecheck and lint still exit 0 | VERIFIED | Both exit 0. |
| 01-01 | Runtime behaviour of role loading, cohort counting and category paths unchanged | VERIFIED, with caveat | `user.ts` (lines 150, 158, 178) and `course_category.ts:74` use the annotated-local pattern with no logic change. The caveat is that 01-01 did change behaviour elsewhere (see the next section). |
| 01-01 | `protected debug = !app.inProduction` untouched | VERIFIED | The line moved from 11 to 45 because of added code above it. `git diff` shows no `+` or `-` line touching it, and the declaration text is identical. |
| 01-01 | Artifacts: `const self: User = this`, `let current: CourseCategory = this`, `function hasCode`, `pojo<{ maxOrder: number \| null }>()` | VERIFIED | Found at `user.ts:150`, `course_category.ts:74`, `handler.ts:15`, `course_contents_controller.ts:218,339`. |
| 01-01 | Key links: `self.load('roles')`, `hasHeaders(error)` | VERIFIED | `user.ts:151,159,179` and `handler.ts:62`. |
| 01-02 | `canEnroll()` false for future start, false for past end, true in window and with null dates | VERIFIED | Four unit tests pass. The mutation test proved the end-date case fails against the old code. |
| 01-02 | A unit test fails if the `fromJSDate` misuse comes back | VERIFIED | Mutation check described above. |
| 01-02 | Operator saw the count of flipped eligibility rows and confirmed | VERIFIED (per orchestrator context) | The orchestrator reports operator approval at the 01-02 checkpoint on 2026-10-13. I cannot observe the checkpoint itself. |
| 01-02 | Artifacts and links: `this.startDate > now`, `canEnroll: this.canEnroll()`, spec of at least 40 lines | VERIFIED | `course.ts:~273` and `:318`. The spec is a substantive 60-plus lines. |
| 01-03 | Functional suite runs at least 4 real tests, all passing | VERIFIED | 4 passed (35 migrations applied and reverted). |
| 01-03 | Never touches the dev DB | VERIFIED, weaker than stated | `.env.test` pins sqlite at `tmp/test.sqlite3`. The guard only checks `NODE_ENV` (REVIEW WR-04), so a shell-exported `DB_*` variable could still point it elsewhere. |
| 01-03 | A broken assertion exits non-zero | VERIFIED | Mutation test: exit 1. |
| 01-03 | Non-enrolled student gets 403, asserted | VERIFIED | The test passes, and the mutation test on its status code proved it is live. |
| 01-03 | No destructive `Model.query().delete()` in functional tests | VERIFIED | `grep "\.delete()" tests/functional/` returns nothing. Tests use `withGlobalTransaction`. |
| 01-03 | No full-HTML Inertia render needed | VERIFIED | The unauthenticated test uses `.redirects(0)` and the others use `.withInertia()`. All 4 pass without a Vite manifest. |
| 01-03 | `unit` suite stays DB-free | VERIFIED | The migrate hook in `tests/bootstrap.ts` is gated by `suite.name === 'functional'`. The unit run applies no migrations. |
| 01-03 | Artifacts and links: `DB_CONNECTION=sqlite`, `apiClient()`, `inertiaApiClient(app)`, `withGlobalTransaction`, `route('grades.course'` | VERIFIED | All present (`.env.test`, `tests/bootstrap.ts:22,26`, spec). |
| 01-04 | Zero `as any` or substitutes under `app/` | VERIFIED | Same grep, 0. |
| 01-04 | A new `as any` fails lint | VERIFIED | Mutation test, exit 1. |
| 01-04 | Seven byte-identical JSON configs replaced by `jsonColumnConfig` | VERIFIED | `submission.ts` has 3 `@column(jsonColumnConfig)`, and 5 model files import the helper from `../helpers/json_column.js`. Together with `bulk_enrollment_log.ts` that makes the seven sites. |
| 01-04 | Three divergent blocks in `role.ts`, `course.ts`, `app_setting.ts` untouched | VERIFIED | Per REVIEW IN-02 and deferred-items #3 they still carry inline copies, and neither the review nor my diff list shows `role.ts` or `app_setting.ts` as changed. `course.ts` changed only in `canEnroll()`. |
| 01-04 | Lint and typecheck exit 0 | VERIFIED | Both exit 0. |
| 01-05 | Lint, functional and unit failures turn CI red | VERIFIED locally, NOT observed in Actions | Bare `run:` steps. Exit 1 on a break for all three (my mutation tests plus the 01-05 SUMMARY table). |
| 01-05 | No `\|\| echo` or `\|\| true` in the tests job | VERIFIED | The only `\|\| true` is `bun audit` in the `security-audit` job (ci.yml:75). The tests job has none. |
| 01-05 | `bun run check` runs lint and typecheck | VERIFIED | `package.json:15`: `"check": "bun run lint && bun run typecheck"`. |

### Behaviour deltas in 01-01 beyond its "zero behaviour delta" framing

01-01 was scoped as type-only. Per REVIEW and my diff of `course_contents_controller.ts`, it changed behaviour in two places:

1. **Module and content `order`.** `pojo<T>()` makes `maxOrder` readable. Before, `(x[0] as any)?.maxOrder` was always `undefined`, so every new module or content item got `order = 1`. It now gets max+1. This is a real bug fix. No test covers it (WR-08).
2. **`Assignment.module` foreignKey.** Corrected to `moduleId`. Lucid's default would have been `courseModuleId`. The grades test creates no assignments, so the preload runs against zero rows (WR-08).

Neither violates a written plan truth. The truth names only role loading, cohort counting and category paths. Both are improvements. **WARNING:** they are unguarded by tests, and the "zero behaviour delta" wording in the plan and SUMMARY is inaccurate. An operator who relied on that wording would have been unaware of them.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.github/workflows/ci.yml` | No `continue-on-error`. Bare lint, unit and functional steps. | VERIFIED | Only remaining `\|\| true` is `bun audit` (ci.yml:75), which is out of scope and logged. |
| `eslint.config.js` | `no-restricted-syntax` ban on `TSAsExpression > TSAnyKeyword` in `app/**/*.ts` | VERIFIED | The guard fired in the mutation test. |
| `tests/unit/course.spec.ts` | Date-window tests | VERIFIED | 5 substantive tests, no DB. |
| `tests/functional/grades.spec.ts` | Real HTTP assertions | VERIFIED | 4 tests using `client`, `route`, `loginAs`, `withInertia`. Wired to the `functional` suite. |
| `.env.test` | Isolates tests from the dev DB | VERIFIED (partially) | sqlite, `tmp/test.sqlite3`, memory sessions. See WR-04 and WR-07 below. |
| `@japa/api-client` | Installed | VERIFIED | Present in package.json (line 41). |
| `tests/functional/grades.spec.ts.skip` | Removed | VERIFIED | `git ls-files` shows no `.skip` file. |
| `app/helpers/json_column.ts` | Shared `jsonColumnConfig` | VERIFIED | Imported by the seven models in 01-04. Three models were deliberately left alone (deferred-items.md #3). |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| ci.yml `tests` job | `node ace test unit` / `functional` | bare `run:` steps | WIRED (exit code propagates). Not observed in Actions. |
| `tests/bootstrap.ts` | `testUtils.db().migrate()` | `configureSuite`, functional suite only | WIRED (35 migrations ran and reverted) |
| `eslint.config.js` | `app/**/*.ts` | `no-restricted-syntax` | WIRED (proved by mutation) |
| `Course.serialize()` | `canEnroll()` | UI flag | WIRED (advisory only, see WR-02) |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DEBT-01 | 01-04, 01-05 | `bun run lint` exits 0 | SATISFIED (locally) | Lint exit 0. The eqeqeq rule is configured `['error','always',{null:'ignore'}]`, so only `== null` and `!= null` are exempt and other loose comparisons still error. CI enforces lint with no `continue-on-error`. Actions run not observed. |
| DEBT-02 | 01-01, 01-02, 01-04 | No `as any` in `app/`, typecheck passes | SATISFIED | Grep returns 0. Typecheck exit 0. The lint guard blocks re-introduction. |
| DEBT-03 | 01-03, 01-05 | Functional suite re-enabled and runs in CI | SATISFIED (locally) | Draft `.skip` replaced by a compiling spec, 4 tests pass, and the CI step is a hard gate. Actions run not observed, and the postgres and mysql legs have never run. |

All three IDs in the roadmap for Phase 1 (DEBT-01, 02, 03) appear in plan frontmatter and in REQUIREMENTS.md. Union of plan `requirements:` = {DEBT-01, DEBT-02, DEBT-03}, so there are no orphaned IDs. DEBT-10 is the documented deferral of the dropped gradebook-computation scenarios. It is not a Phase 1 requirement.

The REQUIREMENTS.md checkboxes for DEBT-01/02/03 are still `[ ]`. This is bookkeeping for the orchestrator.

### Weighing the 01-REVIEW.md findings against the must-haves

None of the 8 warnings or 4 info items contradicts a roadmap success criterion as written. Several limit how strongly a criterion holds:

| Finding | Effect on must-haves | Classification |
|---------|---------------------|----------------|
| WR-01: `endDate` boundary. `this.endDate < now` closes enrollment at the start of the last day. | SC5 says "enforces its date window". It does, but it is off by one day at the end. The operator approved the fix as written. | WARNING. Open follow-up. The unit test uses +/-7 days and cannot see it. |
| WR-02: `canEnroll()` is never called by enrollment endpoints, so the window is not enforced server-side. | SC5 is scoped to the method and a unit test, which hold. Direct POSTs bypass it. | WARNING. Already planned in Phase 2 (02-05). |
| WR-05: `summary` job is `if: always()` and only echoes. `unit-tests` was renamed to `tests`. `bun audit \|\| true` remains. | SC1 and SC4 hold at job level, because individual jobs go red. If branch protection depends on `CI Summary` alone, nothing is gated. Renamed checks may break required-check config. | WARNING. Folded into human item 3. |
| WR-04: test guard checks only `NODE_ENV`. The functional teardown drops the schema. | Not a roadmap criterion. It is a real safety hole: an exported `DB_CONNECTION` or `DB_DATABASE` in the shell overrides `.env.test`. | WARNING (safety). Recommend a follow-up. |
| WR-07: `.env.test` omits `PORT` and `HOST`. | Test run depends on `.env` or the shell. This is why the `PORT=38520` override was needed here. | WARNING. |
| WR-03, WR-06, WR-08, IN-01..04 | Pre-existing bugs or test-coverage gaps. They do not contradict a criterion. IN-03 notes the lint ban is bypassable (`<any>x`) and covers `app/` only. `inertia/pages/courses/enrollment/methods.tsx:222` still has `as any`, which is outside the stated scope. | INFO |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| all files changed in the phase (`git diff e2401d2~1 HEAD` over `app/`, `tests/`, `eslint.config.js`, `.github/`, `package.json`, `.env.test`, `.env.example`) | `TBD`/`FIXME`/`XXX` | none (grep run, zero matches), so the debt-marker gate passes | none |
| same files | `TODO`/`HACK`/`PLACEHOLDER` | none | none |
| `.github/workflows/ci.yml:75` | `bun audit \|\| true` | Info | Deliberately out of scope, logged in 01-05-SUMMARY. |
| `.github/workflows/ci.yml` summary job | Echo-only gate | Warning | See WR-05. |

### Probe Execution

Human-check blocks: `grep human-check *-PLAN.md` found none, so Step 8 harvest added nothing beyond the items above.

SKIPPED: no probes are declared in the phase plans, and no `scripts/*/tests/probe-*.sh` conventional probes apply.

### Human Verification Required

1. **Green CI on a real Actions run.** Open a PR to main and check that all jobs pass, including the postgres, mysql and sqlite test legs. This also resolves the open assumptions about the empty `image:` expression on the sqlite leg and about env-var precedence (job `env:` vs `.env.test`). The postgres and mysql legs have never been run, locally or in CI.
2. **Red CI on deliberate breakage.** Run a scratch PR with an `as any` under `app/` and one with a failing functional assertion. Confirm the corresponding jobs go red. This is the observed proof for roadmap criteria 1 and 4, which was deferred.
3. **Branch protection.** Confirm the required checks reference `Tests (...)` rather than `Unit Tests (...)`. Decide whether to make `CI Summary` fail on any non-success.

### Gaps Summary

There are no blocking gaps. Every criterion that can be verified without a push is verified, with mutation checks proving the lint, unit and functional gates fail correctly. The phase is not fully closed until the GitHub Actions proof is observed. The most valuable cheap follow-ups from the review are the `endDate` inclusive boundary (WR-01), a `DB_CONNECTION`/database-name guard in `tests/bootstrap.ts` (WR-04), `PORT`/`HOST` in `.env.test` (WR-07), and a failing `summary` job (WR-05).

---

_Verified: 2026-10-13_
_Verifier: Claude (gsd-verifier)_
