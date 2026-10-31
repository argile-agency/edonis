---
phase: 05-builder-ui
plan: 02
subsystem: builder (client rules)
tags: [builder, tree, dnd, pure-functions, japa, d-10]
requires: []
provides:
  - "inertia/lib/builder_tree.ts: rows, content/section drop projections, move targets, sibling moves, optimistic apply, delete rule"
  - "tests/bootstrap.ts: browser base URL follows PORT (D-10)"
affects: [05-05, 05-06, 05-07, 05-08]
tech-stack:
  added: []
  patterns:
    - "Import-free client module unit-tested by the backend Japa runner through a relative .js import (A7 confirmed)"
key-files:
  created:
    - inertia/lib/builder_tree.ts
    - tests/unit/builder_tree.spec.ts
  modified:
    - tests/bootstrap.ts
decisions:
  - "Section rows carry a required contentCount, so projectContentDrop can place a drop on a collapsed section at its end without a contents argument"
  - "Sections caught in a parentId cycle are shown as roots by buildRows, so they stay visible and movable"
  - "moveTargets applies the depth rule to 'Racine du cours' too (0 + height > MAX), as the server would refuse that move"
  - "Reason precedence for section targets: self/descendant, then 'Emplacement actuel', then DEPTH_MESSAGE"
metrics:
  duration: "~45 min"
  completed: 2026-10-31
  tasks: 2
  files: 3
---

# Phase 5 Plan 02: Pure builder tree rules Summary

`inertia/lib/builder_tree.ts` is a pure, import-free module holding every builder movement rule: flat rows, nearest-section content drops, 2-level section drops, "Déplacer vers…" targets with reasons, Monter/Descendre, and optimistic apply that renumbers like the 05-01 server. It is covered by 31 Japa unit tests. The plan also ships the one-line D-10 `PORT` base URL.

## A7 result

The module path stayed `inertia/lib/builder_tree.ts`. The backend runner compiles and resolves it through `'../../inertia/lib/builder_tree.js'`, so the `app/helpers/` fallback was not needed. The root `tsc` and the client `tsc` (filtered to this file) report no errors.

## Browser probe

BROWSER_LOCAL: blocked: browserType.launch: Executable doesn't exist at /Users/vdelaleu/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell

- **Cause: environmental.** Playwright expects headless shell build 1248, and only builds up to 1243 are installed in `~/Library/Caches/ms-playwright/`. Migration and `db:seed` on the temp sqlite DB succeeded. No test assertion ran.
- **Remedy (user action):** `npx playwright install chromium` downloads the matching headless shell. Pointing the launcher at chromium-1243 instead would require editing `tests/bootstrap.ts` beyond the D-10 line, which this plan forbids.
- **Command:** the probe ran with `DB_CONNECTION=sqlite` added, because `.env` points at the dev Postgres and the probe does not go through `.env.test`. The temp DB was deleted afterwards.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 474af7f | test(builder): add builder tree module contract and import check |
| 1 | 6110554 | test: let the browser suite base URL follow PORT (1 insertion, 1 deletion, `tests/bootstrap.ts` only) |
| 2 (RED) | 00d488e | test(builder): add failing builder tree tests |
| 2 (GREEN) | 02982f1 | feat(builder): implement pure builder tree rules |

## Verification

- `node ace test unit --files tests/unit/builder_tree.spec.ts`: 31 passed
- Full `node ace test unit`: 59 passed
- `bun run typecheck`: exit 0. `bun run lint`: exit 0.
- `grep -c "^import" inertia/lib/builder_tree.ts` = 0; no `document.` / `window.` / `React` / `not implemented`

## Deviations from Plan

**1. [Rule 3 - Blocking] `contentCount` added to the section variant of `BuilderRow`**
- **Found during:** Task 2
- **Issue:** the contract asks `projectContentDrop(rows, activeKey, overKey)` to return a collapsed section's content count. Its content rows are not in `rows`, so the count could not be computed with the binding signature.
- **Fix:** `buildRows` now fills a required `contentCount: number` on every section row. The change is additive and no signature changed. No later plan builds section rows by hand (grep of 05-03..05-10). 05-07 can read `row.contentCount`.
- **Files:** inertia/lib/builder_tree.ts
- **Commit:** 02982f1

**2. [Rule 3 - Blocking] `DB_CONNECTION=sqlite` added to the browser probe command**
- **Issue:** the plan's probe command sets only `DB_FILENAME`, and `.env` selects Postgres, so the probe would have migrated the user's dev Postgres.
- **Fix:** added `DB_CONNECTION=sqlite` to that one run. Unit runs already resolve to sqlite through `.env.test`.

**Note:** a test file whose `test.group` body throws at import (the RED run against throwing stubs) leaves `node ace test` hanging. Only my own processes were killed.

## TDD Gate Compliance

RED `00d488e` (`test(...)`), then GREEN `02982f1` (`feat(...)`). No refactor commit was needed: the prettier fix went into the GREEN commit before it was made.

## Known Stubs

None.

## Self-Check: PASSED

- inertia/lib/builder_tree.ts, tests/unit/builder_tree.spec.ts, tests/bootstrap.ts: present
- Commits 474af7f, 6110554, 00d488e, 02982f1: present in `git log`
