---
phase: 05-builder-ui
plan: 06
subsystem: builder-ui
tags: [builder, inertia, react, autosave, a11y, browser-tests]
requires: [05-02, 05-03, 05-04, 05-05, 05-09]
provides:
  - "inertia/components/builder/builder-row.tsx: BuilderRow (section or content row, handle and selection slots)"
  - "courses.builder renders flat props { course: { id, title, code }, sections, contents } via loadBuilderStructure"
  - "inertia/pages/courses/builder.tsx: flat rows, optimistic autosave through useSaveQueue, queue-aware prop re-sync, auto-expand of new sections"
  - "tests/browser/builder.spec.ts: 9 non-drag builder flows"
affects: [05-07, 05-08, 05-10]
tech-stack:
  added: []
  patterns:
    - "One SaveOp per action: snapshot + mutate in apply, token read from the ref inside run, snapshot restored in rollback"
    - "commitSections / commitContents are the only writers of the state refs (synchronous, token race guard)"
    - "rowProps(row) computes every BuilderRow prop in one place (05-10 adds selection there)"
key-files:
  created:
    - inertia/components/builder/builder-row.tsx
    - tests/browser/builder.spec.ts
  modified:
    - app/controllers/course_contents_controller.ts
    - tests/functional/builder_moves.spec.ts
    - inertia/pages/courses/builder.tsx
decisions:
  - "Creation posts use preserveState: true next to preserveScroll: true; without it the Inertia React adapter remounts the page (new key), which would reset expansion, the save queue and the re-sync refs"
  - "SaveStatus is wrapped in #save-status: the flash toaster has its own live region, so the spec scopes the indicator by id"
  - "builder() authorizes with Course.findOrFail + authorize('edit') before loading the structure (no nested preload)"
metrics:
  duration: "~50 min"
  completed: 2026-11-03
  tasks: 4
  files: 5
---

# Phase 5 Plan 06: Builder page without drag Summary

The builder is now a flat, indented list of section and content rows, one `BuilderRow` per row. Teachers can rename inline, edit details in a panel, move with Monter / Descendre / "Déplacer vers…", and delete after a confirmation. Every action is saved optimistically through the serial queue, with the "Enregistrement… / Enregistré / Erreur" indicator. The controller sends flat, column-selected props built by `loadBuilderStructure`.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 894cb56 | feat(builder): add builder row component |
| 2 | db493e5 | feat(builder): render flat sections and contents props for the builder |
| 3 | 83ff206 | feat(builder): rebuild the course builder with inline editing, move menu and autosave |
| 4 | f52d627 | test(builder): cover menu moves, inline editing, deletes, add flows and save indicator in the browser |
| fix | c3a6660 | fix(builder): keep server tokens on rollback and make delete focus deterministic |

## Final props shape (`courses/builder`)

```
course:   { id: number; title: string; code: string }
sections: BuilderSection[]   // every section of the course, legacy depth included
contents: BuilderContent[]   // no `content` (page body) key
auth, appSettings, menus     // shared props, typed from AppHeader's props
```

## Browser spec

**Not run locally (see 05-02 BROWSER_LOCAL: blocked, Playwright headless shell build 1248 missing).** The spec typechecks and lints. CI `e2e.yml` and the final checkpoint of 05-08 cover it. Its nine tests:
- the move menu (to another section, Monter, a section with the depth rule)
- inline rename with Enter / Escape
- the details panel saving on blur
- deletes: refused for a non-empty section, then a content item and an empty section, with focus on a neighbour
- "+ Sous-section" only on root sections
- a rapid move then rename with no self-conflict
- the chained add flow (section, sub-section, video content) with the scroll check

It also asserts that `body` is not left with `pointer-events: none` after the move and delete dialogs close (05-05 risk). Because it never ran, its selectors are unverified against a real browser. Each label was checked against the component source.

## Contract notes and deviations from 05-05

- No contract deviation. `idBase = row.key` everywhere, so the ids are `s-<id>-title`, `c-<id>-actions` and `<key>-panel`, and the row's `aria-controls` points at the DetailsPanel root.
- Duplicate accessible names, by design of the plan: the InlineTitle button and the pencil button are both named "Renommer la section « … »". The spec targets titles by id (`#s-<id>-title`).
- Delete focus: the neighbour is computed before removal (next row, else previous). `pendingFocusId` focuses `${neighbour}-title` in an effect, and `onCloseFocusTarget` returns the same element for the dialogs.
- "Déplacer vers…" and Monter/Descendre expand the destination section, so the moved row and its actions trigger stay in the DOM for focus.

## Deviations from Plan

1. **[Rule 1 - Bug] `preserveState: true` on both creation posts.** Without it, `@inertiajs/react` gives the page a new `key` on every non-preserved visit and remounts it. That would discard the teacher's collapsed sections and the in-flight queue, and the `knownSectionIdsRef` / `appliedPropsRef` logic would never run. Commit 83ff206.
2. **[Rule 2 - a11y] `id="contentType"` on the type `SelectTrigger`.** The existing `<Label htmlFor="contentType">` pointed at nothing, so the label is now associated with the trigger. The spec uses this id. Commit 83ff206.
3. **Content type icons moved into `builder-row.tsx`**, the only place that renders them. Added `assignment` (ClipboardList) and `quiz` (HelpCircle) icons, which fell back to FileText before.
4. **Browser spec uses string `page.evaluate` expressions.** The root tsconfig has no DOM lib, so `window` / `document` in callbacks fail `bun run typecheck`.
5. **[Rule 1 - Bug] A rollback no longer restores stale tokens.** Example: a rename queued behind a move snapshots the item's pre-move `updatedAt`. If the rename then fails, its rollback put that old token back, and "Réessayer" got a false 409. Rollback now restores the snapshot but keeps the current `updatedAt` of every item still present (`withCurrentTokens`). Commit c3a6660.
6. **[Rule 1 - Bug] Delete focus is no longer a race.** Radix FocusScope runs its unmount autofocus in a `setTimeout`, after the page's focus effect. The effect cleared the pending target too early, so Radix could pull focus back to `<body>`. `onCloseFocusTarget` now consumes the ref (`takeFocusTarget`), and the effect no longer clears it. In the spec, test 1 waits for the dialog to detach before the `pointer-events` check, because the exit animation holds the modal layer. Commit c3a6660.
7. **`DB_CONNECTION=sqlite` set on every `node ace` run**, as in 05-02 and 05-09, because the symlinked `.env` selects Postgres.

## Known limitations

- After a title conflict, the queue keeps the failed op until "Réessayer" or "Recharger". When the teacher saves the kept draft again, the status keeps showing the conflict error until it is dismissed. The new save itself goes through with the fresh token.
- `moveTargets` is computed for every row on every render, which is O(rows × sections). That is fine for course-sized trees; memoize it if 05-07 shows lag.

## TDD Gate Compliance

Task 2 RED ran first: the new functional test failed on the old nested props. GREEN followed (53/53 across `builder_moves` and `authorization_contents`). As in 05-04 and 05-09, the plan asks for a single `feat` commit, so there is no separate `test(...)` commit.

## Verification

- `node ace test unit functional` (sqlite, PORT=3456): 329 passed; temp DB deleted
- `bun run typecheck`, `bun run lint`, `bun run check:debt`: exit 0
- Client tsc filtered to `inertia/(pages/courses/builder|components/builder/|lib/builder_|lib/save_queue)`: 0 errors. The project total dropped from 182 to 177, because the page's 5 pre-existing errors are gone.
- Acceptance greps: `: any` 0, `preserveScroll: true` 2, `useSaveQueue()` 1, `sendJson(` 4, ref assignments only in the two commit helpers, `latestPropsRef` 6, `appliedPropsRef` 3, `knownSectionIdsRef` 3, `Edit,|Trash2` 0, `rowProps(` 2. Spec: 9 tests, no user creation, teardown present.

## Threat surface

- T-05-21: props limited to id/title/code plus explicit columns, asserted in the functional test.
- T-05-22: `authorize('edit', course)` kept, and the 02-10 builder test still passes.
- T-05-23: React text only, with no `dangerouslySetInnerHTML` in the new files.

## Known Stubs

None. `handle`, `selected` and `onToggleSelect` are intentional empty slots for 05-07 and 05-10.

## Self-Check: PASSED

- Files exist: builder-row.tsx, builder.tsx, builder.spec.ts, the controller and builder_moves.spec.ts
- Commits 894cb56, db493e5, 83ff206, f52d627 and c3a6660 are on worktree-agent-a2540a06c9497be75
