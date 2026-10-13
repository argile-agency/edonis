---
phase: 02-security-correctness-hardening
plan: 06
subsystem: course-categories
tags: [categories, hierarchy, cycle-detection, validation, transactions, ace-command]
requires:
  - 02-01 (tests/functional/helpers/factories.ts, .withCsrfToken(), assertNotCsrfRejected)
provides:
  - app/helpers/category_tree.ts (wouldCreateCycle, recomputeSubtree), pure and generic over { id, parentId }
  - app/validators/category.ts (createCategoryValidator, updateCategoryValidator, reorderCategoriesValidator)
  - node ace categories:check-integrity (read-only)
affects:
  - 02-10 (reuses wouldCreateCycle for course-module parents)
tech-stack:
  added: []
  patterns:
    - "Pure helper in app/helpers/ with no framework imports, relative import '../helpers/x.js'"
    - "Write path: cycle check before the transaction, node save + descendant updates in one db.transaction"
    - "Read-only ace command that sets exitCode = 1 on findings"
key-files:
  created:
    - app/helpers/category_tree.ts
    - tests/unit/category_tree.spec.ts
    - app/validators/category.ts
    - commands/categories_check_integrity.ts
    - tests/functional/categories.spec.ts
  modified:
    - app/models/course_category.ts
    - app/controllers/categories_controller.ts
decisions:
  - "Category update recomputes the node's own path/depth whenever parentId OR slug is sent (effective parent = sent parentId, else current parentId)"
  - "Cycle check treats an already-corrupt chain (revisit or more steps than nodes) as a cycle, so writes are refused instead of hanging"
  - "categories:check-integrity reports nodes on OR below a cycle (both are unreachable from a root)"
metrics:
  duration: ~35min
  completed: 2026-10-13
  tasks: 2
  files: 7
requirements: [DEBT-07, DEBT-05]
---

# Phase 02 Plan 06: Category hierarchy integrity Summary

The category update endpoint now rejects any parent that is the category itself or one of its descendants. Moves and renames rebuild `path` and `depth` for the whole subtree, grandchildren included, inside one transaction. `reorder` is validated. `getFullPath()` is bounded, and a read-only `categories:check-integrity` command lets operators audit existing data.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Pure tree helpers + bounded getFullPath | e838c14 | app/helpers/category_tree.ts, tests/unit/category_tree.spec.ts, app/models/course_category.ts |
| 2 | Cycle rejection, transactional subtree recompute, validated reorder, integrity command | 4336999 | app/validators/category.ts, app/controllers/categories_controller.ts, commands/categories_check_integrity.ts, tests/functional/categories.spec.ts |

## What changed

- **`wouldCreateCycle(parentById, nodeId, newParentId)`** walks up from the proposed parent. It returns `true` if it reaches the node, revisits a node, or takes more than `size + 1` steps. It returns `false` when it reaches `null`. **It is available to plan 02-10** for course-module parents, via `'../helpers/category_tree.js'`.
- **`recomputeSubtree(nodes, rootId, rootPath, rootDepth)`** is a breadth-first rebuild of the descendants. A visited set keeps it terminating on cyclic input.
- **`CourseCategory.getFullPath()`** keeps a visited set and throws `Category hierarchy contains a cycle at category <id>` instead of looping forever. There are no casts.
- **`CategoriesController.update`**:
  - It loads `id/parent_id/slug` once and rejects cyclic parents with the flash `Une catégorie ne peut pas être placée sous elle-même ou sous une de ses sous-catégories.`, then redirects back without writing anything.
  - Otherwise, inside `db.transaction`, it recomputes the node, saves it, and updates every descendant via `query({ client: trx })`.
  - The old direct-children-only loop is gone.
- **`CategoriesController.reorder`** uses `reorderCategoriesValidator`, which accepts 1..1000 positive numeric ids, inside a transaction. The semantics are unchanged: the index becomes `sortOrder` and unknown ids are skipped. An empty body now produces a 302 with `inputErrorsBag.categoryIds`, not a 500 `TypeError`.
- **Validators** moved verbatim to `app/validators/category.ts`. The controller no longer imports `vine` and has no `request.only/input/all`, which satisfies DEBT-05 inventory item V8.

## Verification

- `node ace test unit`: 22/22 passed, including the 8 `Category tree helpers` cases.
- `PORT=3406 DB_FILENAME=./tmp/test-02-06.sqlite3 node ace test functional`: 36/36 passed, including the 6 `Categories - hierarchy integrity` cases. The temp DB was deleted afterwards.
- `bun run typecheck` and `bun run lint`: exit 0.
- Grep gates:
  - `withCsrfToken()` count is 6, matching 6 write calls.
  - The controller has 0 `request.only/input/all` and 0 `vine.compile`.
  - The command has 0 `.update(`, `.save(` or `.delete(`.
  - The helper has 0 framework imports.
- `node ace list` shows `categories:check-integrity`.
- `@japa/api-client` derives its base URL from `process.env.HOST`/`PORT`, and `config/database.ts` reads `DB_FILENAME`, so the isolated port and DB worked. No HMR port clash occurred.

### `categories:check-integrity` against the dev DB (Postgres, read-only)

```
[ info ] Checked 22 categories
[ success ] 0 categories on or below a parent cycle
[ success ] 0 categories with a stale path/depth
```
Exit code 0. The dev data is currently consistent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A slug-only update never refreshed the node's own path**
- **Found during:** Task 2
- **Issue:** The plan said to compute the node's path/depth "exactly as today". Today that happens only when `parentId` is sent, so `PUT { slug }` left A at `/a` while its children were rebuilt from the stale path. The rename test (`A is /z…`) could not pass.
- **Fix:** The node is now recomputed whenever `parentId` OR `slug` is sent. The effective parent is the sent `parentId`, or else the current `parentId`. The effective slug is `data.slug ?? category.slug`.
- **Files modified:** app/controllers/categories_controller.ts
- **Commit:** 4336999

**2. [Test adjustment] The rename fixture uses the slug `zz` instead of `z`**
- **Issue:** `updateCategoryValidator`, which had to be moved verbatim, enforces `slug.minLength(2)`, so `{ slug: 'z' }` would fail validation.
- **Fix:** The test sends `{ slug: 'zz' }` and asserts `/zz`, `/zz/b`, `/zz/b/c`. The validator is unchanged.

**3. [Test hardening] The reorder fixtures use non-zero initial `sortOrder` (A=7, D=5)**
- `sort_order` defaults to 0, so "D is 0" would otherwise pass even if the controller never ran. The empty-payload test also asserts that both rows keep their original order.

### TDD note
Both tasks were `tdd="true"`, and RED was observed for each before implementation:
- Task 1: the module was missing.
- Task 2: 5 of 6 functional cases failed, including the reorder `TypeError` 500.

As the plan dictated, each task went in as one commit (`fix(categories): ...`), not as separate `test(...)` and `feat(...)` commits.

### Harness note
After its run finishes, `node ace test` stays alive when an error occurs at import time, because the Vite dev server keeps the process open. Local runs went through a wrapper that kills the process once the summary line is printed. Successful runs exit on their own.

## Findings (out of scope)

- **`inertia/pages/admin/categories/edit.tsx` does not exist**, so `GET /admin/categories/:id/edit` (`CategoriesController.edit`) cannot render. That is why the update endpoint is reachable only through hand-built requests today. Recommend a quick task to add the edit page, which should reuse the server-side cycle rejection. This is outside Phase 2 scope, and the page was NOT created here.
- A rename to a slug that already exists still hits the DB `UNIQUE` constraint, which gives a 500. This is pre-existing and not part of DEBT-07, so it is logged here only.

## Threat Model Coverage

| Threat | Status |
|--------|--------|
| T-02-26 cyclic parent | Mitigated: server-side `wouldCreateCycle`. Tests assert the exact flash and that the row is unchanged when re-read from the DB |
| T-02-27 getFullPath loop | Mitigated: visited set + throw. The helpers are also bounded |
| T-02-28 partial path updates | Mitigated: node save + descendant updates in one `db.transaction` |
| T-02-29 reorder 500 | Mitigated: `reorderCategoriesValidator` |
| T-02-30 EoP | Accepted: the `role:admin` route gate is unchanged |

## Self-Check: PASSED

- FOUND: app/helpers/category_tree.ts, tests/unit/category_tree.spec.ts, app/validators/category.ts, commands/categories_check_integrity.ts, tests/functional/categories.spec.ts
- FOUND commits: e838c14, 4336999
