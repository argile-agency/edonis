---
phase: 01-code-health-baseline
plan: 05
status: checkpoint-pending
subsystem: ci
tags: [ci, github-actions, eslint, japa, gates]
requires: [01-03, 01-04]
provides:
  - "ESLint step in ci.yml with no continue-on-error (lint can fail the build)"
  - "tests job (renamed from unit-tests) running bare `node ace test unit` and `node ace test functional`"
  - "CI tests-job SESSION_DRIVER=memory, matching .env.test and the Japa session client"
  - "`bun run check` = lint + typecheck"
affects: [01-VALIDATION (references bun run check), e2e.yml (untouched, still cookie)]
tech-stack:
  added: []
  patterns: ["bare run: steps so the exit code propagates; no `||` escapes outside the scoped-out bun audit"]
key-files:
  created: []
  modified: [.github/workflows/ci.yml, package.json]
decisions:
  - "Deleted continue-on-error lines outright (both the lint `true` and the old test step's `false`) instead of flipping them"
  - "Summary echo label is now `Tests:` to match the renamed job"
  - "Local chain runs prefix every command with NODE_ENV=test so migrate/seed hit tmp/test.sqlite3, not the dev DB from .env"
metrics:
  duration: ~15min (Tasks 1-2)
  completed: pending (Task 3 checkpoint)
  tasks: 2 of 3
  files: 2
---

# Phase 1 Plan 05: Enforce CI Gates Summary (checkpoint pending)

Lint, unit-test and functional-test failures now each make the CI step exit non-zero. The ESLint step has no `continue-on-error`. The old `node ace test functional || echo ...` step is now two bare steps, `node ace test unit` and `node ace test functional`. The job is renamed `tests` everywhere, including `summary.needs`. The tests job runs with `SESSION_DRIVER: memory`. All three gates were shown locally to fail on a deliberate break and pass again after the revert. **It has not yet been shown that GitHub Actions turns red.** That is Task 3, which is waiting on a human because it needs a push and a PR.

## Tasks

| # | Task | Commit | Status |
|---|---|---|---|
| 1 | Make lint/test steps real gates in ci.yml; add `check` script | fca2e29 | done |
| 2 | Prove locally that each gate propagates a failure | (no commit, by design) | done |
| 3 | Confirm the gates fire in GitHub Actions | - | **checkpoint:human-verify, pending** |

## Task 1 results

Preconditions, run before any edit: `bun run lint` 0, `bun run typecheck` 0, `node ace test unit` 0 (5 passed), `node ace test functional` 0 (4 passed).

| Check | Result |
|---|---|
| `grep -c continue-on-error ci.yml` | 0 |
| `grep -n unit-tests ci.yml` | no matches |
| `grep -nE '\|\| echo\|\|\| true' ci.yml` | exactly 1: line 75 `run: bun audit \|\| true` |
| `node ace test unit` / `node ace test functional` lines | 174 and 177, each bare (nothing follows on the line) |
| `needs.tests.result` | line 192 |
| `SESSION_DRIVER: memory` / `cookie` count | 1 / 0 (e2e.yml not in diff) |
| YAML parse (PyYAML) | jobs `[build, lint-and-typecheck, security-audit, summary, tests]`; summary.needs `[lint-and-typecheck, build, security-audit, tests]`; tests.services `[mysql, postgres]`; matrix.db `[postgres, mysql, sqlite]`; env SESSION_DRIVER `memory` |
| `scripts.check` | `bun run lint && bun run typecheck`; `bun run check` exits 0 |
| CI-order chain `migration:run --force && db:seed && test unit && test functional` (each with `NODE_ENV=test PORT=38519`) | exit 0. Unit 5 passed, then functional 4 passed after the seed. The unit run did not wipe the schema, and the seeded data did not collide with the functional fixtures. |
| Commit diff | `.github/workflows/ci.yml`, `package.json` only |

## Task 2: six local exit codes

Each command is the exact `run:` string CI uses, run inside the worktree with `NODE_ENV=test PORT=38519` for the ace commands.

| Gate | Break | Broken exit | Broken output | Restored exit | Restored output |
|---|---|---|---|---|---|
| Lint (`bun run lint`) | `export const gsdThrowaway = {} as any` added to `app/helpers/json_column.ts` | **1** | `1 problem (1 error)`: `` `as any` is banned in app/ ... no-restricted-syntax `` | **0** | clean |
| Unit (`node ace test unit`) | `tests/unit/course.spec.ts`: future-startDate test changed `isFalse` to `isTrue` | **1** | `Tests 4 passed, 1 failed (5)` | **0** | `Tests 5 passed (5)` |
| Functional (`node ace test functional`) | `tests/functional/grades.spec.ts`: non-enrolled `assertStatus(403)` changed to `200` | **1** | `Tests 3 passed, 1 failed (4)`; `NO TESTS EXECUTED` appears 0 times | **0** | `Tests 4 passed (4)` |

The first lint break, written as `({} as any)`, also produced a prettier error. I removed the parentheses and re-ran so that the only error left was `no-restricted-syntax`. The recorded exit code comes from that clean run.

After the experiments, `git status --short -- app tests eslint.config.js package.json .github` was empty, `bun run check` exited 0, and HEAD was still `ci: enforce lint and test gates`.

## Task 3: pending (filled in after the checkpoint)

- Green run URL: _pending_
- Red (scratch) run URL: _pending_
- Database per matrix leg (postgres / mysql / sqlite): _pending_
- A2, empty `image:` service expression on the sqlite leg: _pending_

## Out-of-scope CI follow-ups (logged, not fixed)

1. **`bun audit || true`** in `security-audit` is a second gate that can never fail. Making it blocking could turn the build red on unrelated upstream advisories, and neither DEBT-01 nor DEBT-03 covers it. It is now the only `||` escape left in ci.yml.
2. **A2, the empty `image:` expression.** `image: ${{ matrix.db == 'postgres' && 'postgres:16' || '' }}` (and the matching mysql one) gives an empty string on legs that don't use that service. Its runtime behaviour on the sqlite leg has never been observed. Task 3 will resolve it.
3. **A3, browser-suite email collision.** `tests/browser/grades.spec.ts` seeds an email that collides with the seeded `student@edonis.test`. That suite runs in `e2e.yml`, not ci.yml, and was left alone. Note that e2e.yml also triggers on PRs to main, so it may go red on the Task 3 PR for this unrelated reason.
4. **MariaDB is missing from the matrix**, although the stack claims MariaDB support (`docs/MULTI_DATABASE.md`, docker compose service).

## Deviations from Plan

None in the code. Environment adjustments:
- The `<automated>` verify blocks `cd` into the main checkout. I ran the equivalent commands inside the worktree instead, as plans 01-03 and 01-04 did.
- Every `node ace` command was prefixed with `NODE_ENV=test PORT=38519`. Without `NODE_ENV=test`, `migration:run`/`db:seed` would load the dev `.env` and modify the user's dev database. CI sets `NODE_ENV: test` at job level, so this matches CI.
- I corrected Task 3's step 4 in the checkpoint instructions. `ci.yml` only triggers on `push` to main/develop and `pull_request` to main/develop, so pushing a scratch branch on its own starts no CI run. Both demonstrations must go through PRs against main.

## Known Stubs

None.

## Threat Flags

None. The changes make the CI gates stricter. No new network, auth, file or schema surface was added. T-01-19, T-01-20, T-01-21 and T-01-23 are mitigated locally. T-01-22 (whether the CI `env:` block or `.env.test` wins) can only be confirmed in Task 3.

## Self-Check: PASSED (Tasks 1-2)

- FOUND: .github/workflows/ci.yml, package.json (modified in fca2e29)
- FOUND commit: fca2e29
- Task 3 evidence is intentionally missing until the checkpoint resolves.
