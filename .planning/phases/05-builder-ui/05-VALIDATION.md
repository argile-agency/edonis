---
phase: 05
slug: builder-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-28
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `05-RESEARCH.md` § Validation Architecture, adapted to CONTEXT.md D-02 (revised: 2 levels) and D-10 (bootstrap port change allowed).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Japa 4 (`@japa/runner`, `@japa/api-client`, `@japa/assert`, `@japa/browser-client` with Playwright, `@axe-core/playwright`) |
| **Config file** | `adonisrc.ts` (unit/functional/browser suites), `tests/bootstrap.ts`, `.env.test` (sqlite, memory sessions) |
| **Quick run command** | `export PATH="$HOME/.local/share/fnm/node-versions/v22.19.0/installation/bin:$PATH"; PORT=3450 DB_FILENAME=./tmp/test-05.sqlite3 node ace test functional --files tests/functional/builder_moves.spec.ts` |
| **Full suite command** | `PORT=3450 DB_FILENAME=./tmp/test-05.sqlite3 node ace test unit functional && bun run typecheck && bun run lint && bun run check:debt` |
| **Browser suite** | `node ace test browser tests/browser/builder.spec.ts` (CI e2e; locally after the `tests/bootstrap.ts` base-URL change of D-10, on a free `PORT`) |
| **Estimated runtime** | one functional spec: seconds (SQLite); full unit + functional: about 3 minutes |

There is no React component test runner and none must be added: movement logic lives in a pure `inertia/lib/builder_tree.ts` tested through Japa unit tests, and the interaction is covered by the browser suite.

Notes: the default shell Node 24 breaks `node ace`; use Node 22 as above. The dev server holds ports 3333 and 24678 and the dev Postgres is on localhost:54322, so every run uses a unique `PORT` and `DB_FILENAME` and deletes the temp DB afterwards.

---

## Sampling Rate

- **After every task commit:** the touched spec via `--files`, plus `bun run typecheck`
- **After every plan wave:** `node ace test unit functional`, `bun run lint`, `bun run check:debt`
- **Before `/gsd:verify-work`:** full unit + functional green locally; browser and axe green in CI (`e2e.yml`) or locally on a free port
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

Each row is covered by at least one task's automated verify (`<automated>` in the named task).

| Requirement | Behavior | Test Type | Covered by (plan / task) | Automated Command | File Exists | Status |
|-------------|----------|-----------|--------------------------|-------------------|-------------|--------|
| BUILD-01 | content move within a section renumbers densely; position clamped | functional | 05-01 T2 | `--files tests/functional/builder_moves.spec.ts` | ❌ W0 (05-01 T2) | ⬜ |
| BUILD-01 | projection: content slot gives (parent, position); optimistic renumber mirrors server | unit | 05-02 T2 | `node ace test unit --files tests/unit/builder_tree.spec.ts` | ❌ W0 (05-02 T1) | ⬜ |
| BUILD-02 | content to another section (including an empty one); source and destination renumbered; foreign `moduleId` refused, nothing written; legacy level-3 destination refused | functional | 05-01 T2 | builder_moves.spec.ts | ❌ W0 | ⬜ |
| BUILD-03 | module reorder and re-parent; cycle refused; depth plus sub-tree height above 2 levels refused; parent `null` accepted; foreign ids refused; PUT no longer re-parents | functional + unit | 05-01 T1, T3 | builder_moves.spec.ts, `tests/unit/category_tree.spec.ts`, `authorization_contents.spec.ts` (A8 moved to `modules.move`) | ⚠ extend | ⬜ |
| BUILD-04 | `createModule` refuses a parent that is a sub-section (depth above 2 levels); `updateModule` cannot re-parent | functional | 05-04 T2, 05-01 T3 | builder_moves.spec.ts | ❌ W0 | ⬜ |
| BUILD-05, BUILD-08 | PUT JSON returns `updatedAt`; stale token gives 409 with the fresh item; description and dates clearable (null); start after end gives 422 | functional | 05-04 T1 | builder_moves.spec.ts | ❌ W0 | ⬜ |
| BUILD-06 | deleting a non-empty section gives 409 and deletes nothing; an empty one gives 200 | functional | 05-04 T2 | builder_moves.spec.ts | ❌ W0 | ⬜ |
| BUILD-07 | content creation with the type selector still works; refused into a legacy level-3 section | functional | 05-04 T2 | builder_moves.spec.ts | ❌ W0 | ⬜ |
| BUILD-09 | delete content JSON 200; teacher without edit permission gets 403; attached file row kept | functional | 05-04 T2 | builder_moves.spec.ts | ❌ W0 | ⬜ |
| BUILD-10 | CSRF failure is not a 200 JSON (302 with `redirects(0)`), so the client takes its error path | functional | 05-04 T2 | `tests/functional/csrf.spec.ts` (kept out of builder_moves.spec.ts so its withCsrfToken gate holds) | ⚠ extend | ⬜ |
| BUILD-10 | serial queue: ordering, reverse rollback of failed + cancelled ops, retry, dismiss | unit | 05-03 T1 | `node ace test unit --files tests/unit/save_queue.spec.ts` | ❌ W0 (05-03 T1) | ⬜ |
| All | non-editor teacher gets 403 on every new or JSON route; admin passes | functional | 05-01 T2, T3; 05-04 T1, T2 | builder_moves.spec.ts | ❌ W0 | ⬜ |
| All | builder props are flat, column-selected, include legacy deep sections, no page bodies | functional | 05-06 T2 | builder_moves.spec.ts | ❌ W0 | ⬜ |
| D-07 | "Déplacer vers…" moves a content or a section; Monter / Descendre reorder; invalid destinations aria-disabled with reason | browser | 05-06 T3 | `tests/browser/builder.spec.ts` | ❌ W0 (05-06 T3) | ⬜ |
| BUILD-05, BUILD-06, BUILD-08, BUILD-09 | inline rename, details panel, delete with confirmation, non-empty delete explained, focus after delete | browser | 05-06 T3 | builder.spec.ts | ❌ W0 | ⬜ |
| BUILD-10 | indicator shows "Enregistré" in a `role=status` region after an action; two rapid actions on one item never self-conflict | browser | 05-06 T3 | builder.spec.ts | ❌ W0 | ⬜ |
| BUILD-01..03, D-07 | keyboard drag: focus handle, Space, arrows (Left/Right for section level), Space; order changed and persisted after reload; Escape cancels; reflow case | browser | 05-07 T3 | builder.spec.ts | ❌ W0 | ⬜ |
| SSR | no dnd-kit hydration mismatch on the builder page (console listener) | browser | 05-07 T1 | builder.spec.ts | ❌ W0 | ⬜ |
| a11y | builder page: no critical or serious axe violations (at rest, panel open, menu open, move dialog open) | browser | 05-08 T1 | `tests/browser/accessibility.spec.ts` | ⚠ extend | ⬜ |
| Build | production build compiles SSR + client with dnd-kit | build | 05-08 T2 | `bun run build` | ✅ | ⬜ |

Browser rows run locally only when `05-02-SUMMARY.md` records `BROWSER_LOCAL: ok` (probe in 05-02 T1); otherwise CI `e2e.yml` is authoritative, plus the 05-08 human checkpoint. Frontend files are type-checked with a filtered `tsc -p inertia/tsconfig.json` gate, because `bun run typecheck` excludes `inertia/**` and the client config has unrelated pre-existing errors.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/functional/builder_moves.spec.ts`: module and content creation helpers (copy from `authorization_contents.spec.ts` or promote to `tests/functional/helpers/factories.ts`)
- [ ] `tests/unit/builder_tree.spec.ts`: first check that importing `inertia/lib/builder_tree` compiles under the backend runner (research assumption A7)
- [ ] `tests/browser/builder.spec.ts` and one case in `tests/browser/accessibility.spec.ts`
- [ ] D-10: one-line change in `tests/bootstrap.ts` so the base URL follows `PORT` (default 3333 unchanged)
- [ ] `bun add @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0 @dnd-kit/utilities@3.2.2` plus an SSR smoke check of `/courses/:id/builder` for hydration warnings

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pointer and touch drag feel (handle activation, no page-scroll conflict) | BUILD-01..03, D-08 | Pointer and touch drags are flaky in CI | In the browser and on a tablet, drag a content between sections, drag a section into another, scroll the page with a finger outside the handle |
| Screen-reader announcements in French | D-07 | Needs a real screen reader | With VoiceOver, pick up an item with Space, move with arrows and check the announcements |
| Two teachers editing the same course | D-09 | Needs two sessions | Edit the same title in two browsers; the second save shows the conflict message and keeps the typed text |

---

## Validation Sign-Off

- [ ] All tasks have an automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency under 180 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
