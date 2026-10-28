# Phase 5: Builder UI - Research

**Researched:** 2026-10-28
**Domain:** Nested drag-and-drop tree editor (React 19 + Inertia SSR), AdonisJS 6 move/reorder endpoints, autosave with optimistic UI, WCAG 2.2 drag alternatives
**Confidence:** HIGH for backend and code facts (read in the repo), MEDIUM-HIGH for the dnd-kit design (verified in package sources and official examples), MEDIUM for browser-test feasibility

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Moving sections and contents (area discussed)
- **D-01:** A section can be dragged to **change its parent** by dropping it into another section (not only reordered among siblings). This needs a validated endpoint with **cycle protection** (a section can never be dropped into itself or one of its descendants; `wouldCreateCycle` from `app/helpers/category_tree.ts` was built for this and is reusable) and a recomputation of the order of the affected siblings, in one transaction.
- **D-02:** **Maximum nesting depth is 3 levels** (section > sub-section > sub-sub-section). A drop that would exceed it is refused by the server and prevented in the UI. The planner must decide whether `createModule`/`updateModule` enforce the same limit (consistency) and what to do with existing data deeper than 3.
- **D-03:** A content item can be dropped on **any section, including an empty or collapsed one**; a collapsed section expands after a short hover delay. The content goes to the hovered position or at the end of the list. Moving a content between sections renumbers source and destination in one transaction, scoped to the course and authorized with `CoursePolicy.edit` (no cross-course ids; same IDOR discipline as plan 02-10).
- Drag handle only (the existing `GripVertical` icons become real handles); the whole card is not draggable so that clicks, inputs and buttons keep working.

#### Inline editing and deletion (area discussed)
- **D-04:** **Title is edited in place** (click the title or the pencil: text field, Enter saves, Escape cancels). Description, published/hidden and availability dates open in an **expandable panel under the item** (BUILD-08 allows "modal or expandable form"). The existing creation dialog stays for *adding* sections and contents. Type-specific fields (page body, file, URL) are out of scope until phases 6 to 9.
- **D-05:** **Only an empty section can be deleted** (BUILD-06): no contents and no sub-sections. The delete button is disabled with an explanation ("Déplacez ou supprimez d'abord son contenu"), and **the server also refuses** to delete a non-empty section. A confirmation dialog is shown (`AlertDialog`), including for empty sections. Deleting a content item (BUILD-09) also asks for confirmation.
- **D-06:** The user asked for deletion to go through a **trash with soft delete** (see Deferred Ideas). Until that dedicated phase exists, phase 5 does not allow deleting non-empty sections, so nothing of value is lost.

#### Keyboard, touch and accessibility (area discussed)
- **D-07:** Provide **both**: the dnd-kit keyboard sensor (Space to pick up, arrows to move, Space to drop, Escape to cancel) with **French screen-reader announcements** (`aria-live`), **and** a per-item **"Déplacer vers…" menu** that picks the destination section from a list (also covers changing parent and long moves). The menu is the single-pointer alternative required by WCAG 2.2 criterion 2.5.7 (Dragging Movements) and a fallback for assistive tech and voice control.
- **D-08:** **Touch is supported through the drag handle** (touch sensor on the handle without blocking page scroll elsewhere); the "Déplacer vers…" menu is the reliable fallback on small screens.
- Success criterion 6 of the roadmap (keyboard-accessible equivalents) is met by D-07; the axe-core tests in `tests/browser/accessibility.spec.ts` must cover the builder page.

#### Editing conflicts (decided in the presence discussion)
- **D-09:** Real-time presence ("who is editing where") is **deferred** (see Deferred Ideas). In this phase, saving an element that **another user changed since it was loaded must not silently overwrite their work**: detect it (e.g. compare `updatedAt` on update/move/reorder) and show a clear message ("Cet élément a été modifié par un autre enseignant"), without losing the user's input. The planner decides the exact mechanism.

### Claude's Discretion
- **Autosave and save indicator (BUILD-10)** was not discussed; the planner decides, within these guardrails: each action saves immediately (drop, Enter or blur on a field), a visible and accessible indicator ("Enregistrement…" / "Enregistré" / "Erreur", announced through an `aria-live` region), on failure the UI returns to the previous state and offers a "Réessayer" button; requests are serialized or debounced so drags and edits cannot race; optimistic UI with rollback is welcome.
- Library choice and version: `@dnd-kit` (core, sortable, utilities) is the roadmap's intent; the researcher must verify the current packages, React 19 compatibility and the keyboard/touch sensors before the planner commits. Nested-list drag (cross-container, collapse on drag) is the hard part to research.
- Whether to keep Inertia `router` calls or use `fetch` for the autosave requests (the learner heartbeat used `fetch` in phase 4 to avoid Inertia visits); keep flash messages consistent.
- Visual treatment, spacing, and the exact French copy follow the existing builder and shadcn components.

### Deferred Ideas (OUT OF SCOPE)
- **Trash / soft delete (dedicated phase right after phase 5):** deleting a section or content moves it to a **trash** (`deleted_at`, per the database conventions in CLAUDE.md) instead of removing it, with a confirmation that counts what will be affected. The trash is reachable from the course and from course editing, supports restore, and is **emptied after 30 days by default, with the retention configurable in the platform administration settings**. It makes deleting non-empty sections safe, so it lifts the "empty section only" rule of D-05. It touches the course list, the learner outline and progress queries, so it needs its own phase. A phase should be added to the roadmap.
- **Real-time presence in the builder** ("Marie edits this section", like Figma or a spreadsheet cell being edited): needs a presence signal (periodic polling or server-sent events such as `@adonisjs/transmit`) and a shared state across several Infomaniak instances. Not in this phase; D-09 only prevents silent overwrites. Full co-editing (cursors, live merging, CRDT) is a separate technology and out of reach for now.
- **Undo/redo and keyboard shortcuts** are already BUILD-V2-01 and BUILD-V2-02.
- **Student search, grade entry and similar items** belong to other phases (see phase 3 context).

#### Reviewed Todos (not folded)
- `2026-10-20-course-creation-requests-with-save-and-publish-buttons` — matched on keywords (course, save, controller, inertia, score 0.6) but concerns the course creation page and a platform setting, not the content builder. The user chose to keep it separate.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BUILD-01 | Drag content items to reorder within a section | Flattened single-list sortable (Pattern 1); `POST /contents/:contentId/move` with same `moduleId` (Pattern 3); keyboard via `sortableKeyboardCoordinates`; "Monter / Descendre" menu items for WCAG 2.5.7 |
| BUILD-02 | Drag content items between sections | Same list: parent = nearest section row above the drop slot; collapsed/empty section header is a valid target, auto-expand on hover (Pattern 2); move endpoint renumbers source and destination in one locked transaction |
| BUILD-03 | Drag sections to reorder them | Section drag switches the list to sections-only and uses the official tree projection (horizontal offset / Left-Right keys) for re-parenting (D-01); `POST /modules/:moduleId/move` with cycle + depth + subtree-height checks. **Requires depth-3 support in the builder AND learner pages** (see Summary finding 1) |
| BUILD-04 | Add new section | Keep existing `createModule` dialog; add server depth check; hide "Sous-section" at depth 2; submit with `preserveScroll: true` |
| BUILD-05 | Rename a section | Inline title editor (Pattern 5) → `PUT /modules/:moduleId` returning JSON when `Accept: application/json`, with conflict token |
| BUILD-06 | Delete an empty section | `deleteModule` re-checks emptiness under the course row lock (pitfall 5: FK `ON DELETE CASCADE`); disabled button with `aria-describedby`; `AlertDialog` |
| BUILD-07 | Add content item to a section (type selector) | Keep existing content dialog and its `Select` (page, video, file, link, assignment, quiz); unchanged except `preserveScroll` and props re-sync |
| BUILD-08 | Edit content inline | Disclosure panel (description, published, availability dates); **needs WR-20 validator fix** (dates `.nullable()`, ordering check) or dates can never be cleared |
| BUILD-09 | Delete content item | `AlertDialog` + `DELETE /contents/:contentId` JSON; explicit focus target after delete |
| BUILD-10 | Autosave with save indicator | Single serialized save queue over `fetch` (Pattern 4), optimistic update + rollback, `role="status"` indicator, "Réessayer", navigation guard |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Package manager: **bun** (`bun add @dnd-kit/core@6.3.1 ...`); pnpm then npm only as fallbacks.
- AdonisJS 6 + Inertia + React 19, SSR enabled: client components using browser APIs must be SSR-safe (return `null` on server, portals only after mount).
- Tailwind v4 + shadcn/ui (Radix) components from `inertia/components/ui/`; Lucide icons.
- VineJS validators in `app/validators/`; authorization only through Bouncer policies in `app/policies/` (`bun run check:debt` greps controllers for `hasPermission(`, `hasRole(`, `instructorId ===`, `request.only|input|all(` and fails).
- Migrations reversible; `jsonColumn()` for JSON; multi-engine (PostgreSQL / MySQL-MariaDB / SQLite) — CI runs the functional suite on all three.
- Authorization: authentication AND authorization on protected routes; IDOR discipline from plan 02-10 (child ids scoped with `where('course_id', …)` / `where('module_id', …)`).
- Accessibility: `eslint-plugin-jsx-a11y`; new pages pass axe-core critical/serious checks; `tests/browser/accessibility.spec.ts` must cover the builder.
- GDPR: no new personal data field in this phase (nothing to add to export/anonymization).
- Seeders: reuse existing (`course_seeder.ts`, `course_content_seeder.ts` …); register any new seeder in `index_seeder.ts`.
- Commits: single-line conventional commits, no AI co-author trailer.
- Tests: Japa; `node ace test` must run with Node 22 (`export PATH="$HOME/.local/share/fnm/node-versions/v22.19.0/installation/bin:$PATH"`), unique `PORT` and `DB_FILENAME` (sqlite) because the user's dev server holds 3333/24678 and dev Postgres is on 54322.

## Summary

The phase is a rewrite of `inertia/pages/courses/builder.tsx` on top of mostly existing endpoints, but five facts found in the code change the plan:

1. **D-02 (depth 3) is not supported anywhere today.** `builder`, `learn`, `outline`, `getCourseProgress` (`course_contents_controller.ts`) and `CoursesController.show` (`courses_controller.ts:159`) preload only two levels (root modules + `children`, never grandchildren). `outline.tsx` and the `allContents`/first-content loops in `learn.tsx` and the `learn` controller are non-recursive. The current "Sous-section" button is shown on child modules too, so it already creates third-level modules that **never render** in the builder or for learners. Once D-01 lets a section with children be dropped into another section, depth-3 content becomes invisible to learners. The planner must add a task that loads three levels (or a flat load + in-memory tree) in every reader listed above, otherwise BUILD-03 silently hides course material. [VERIFIED: codebase read]
2. **Move endpoints must be new.** `reorderModules`/`reorderContents` take client-supplied `{id, order}` arrays scoped to one parent. Cross-section moves and re-parenting need two new intent-based endpoints (`item, destination parent, position`) that recompute orders server-side under a per-course row lock. [VERIFIED: codebase read]
3. **Use the classic `@dnd-kit/core` 6.3.1 + `@dnd-kit/sortable` 10.0.0 + `@dnd-kit/utilities` 3.2.2 with the official "flattened sortable tree" pattern**, specialised for two row kinds: contents drag in the full list (parent = nearest section row above the slot), sections drag in a sections-only list with horizontal depth projection. One `SortableContext`, no nested droppables. Pass `<DndContext id="course-builder">` to avoid the known SSR hydration mismatch. [VERIFIED: npm registry + package source]
4. **Autosave over `fetch` (JSON), not Inertia visits.** Inertia 2.3.29 has no optimistic-update API and synchronous visits cancel each other; the phase 4 heartbeat already uses `fetch` with `X-XSRF-TOKEN`. Gotcha: Shield's CSRF failure always answers `302 back`, which `fetch` follows into a 200 HTML page — use `redirect: 'manual'` and require a JSON content type. [VERIFIED: node_modules sources]
5. **Conflict detection (D-09) must compare `updated_at` at second precision.** Lucid writes `yyyy-MM-dd HH:mm:ss` on SQLite and MySQL but milliseconds on PostgreSQL; query-builder updates (reorders) never bump `updated_at`. Compare `toUnixInteger()`, set the moved row's `updatedAt` explicitly, never bump renumbered siblings. [VERIFIED: Lucid dialect sources]

**Primary recommendation:** one `DndContext` + one flat `SortableContext` over typed rows (`s-<id>` / `c-<id>`), two JSON move endpoints with lock + cycle + depth checks, a single serialized save queue, and the "Déplacer vers… / Monter / Descendre" menu as the non-drag path that every browser test exercises first.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Drag interaction, projection (parent/depth preview), collapse/expand, focus | Browser / Client | — | Pure UI state; dnd-kit runs only in the browser |
| Optimistic tree state, save queue, rollback, save indicator | Browser / Client | — | Must survive Inertia prop refreshes; never trusted by server |
| Initial tree data (sections + contents, flat) | Frontend Server (SSR) via controller | Database | `CourseContentsController.builder` renders the page; SSR must output stable markup |
| Authorization (`CoursePolicy.edit`), IDOR scoping | API / Backend | — | Every mutation; client hiding is cosmetic only |
| Cycle, depth (≤3 levels incl. subtree height), empty-section rule | API / Backend | Browser (preventive UI) | Server is authoritative (D-02, D-05); UI mirrors the same rules to avoid failed saves |
| Order renumbering, concurrency (course row lock), conflict token check | API / Backend | Database | Must be one transaction; depends on engine timestamp precision |
| Learner visibility of moved items (`isEffectivelyAvailable`, published filters) | API / Backend | — | Learner readers must load the same depth the builder allows |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@dnd-kit/core` | 6.3.1 (published 2024-12-05) | DndContext, sensors (Pointer, Keyboard, Touch, Mouse), collision detection, DragOverlay, accessibility announcements | ~33M downloads/week; peer `react >=16.8.0` (accepts 19); API frozen; official tree example exists for this exact tag [VERIFIED: npm registry, api.npmjs.org] |
| `@dnd-kit/sortable` | 10.0.0 (2024-12-04) | `SortableContext`, `useSortable`, `verticalListSortingStrategy`, `sortableKeyboardCoordinates`, `arrayMove` | Peer `@dnd-kit/core ^6.3.0` [VERIFIED: npm registry] |
| `@dnd-kit/utilities` | 3.2.2 (2023-11-06) | `CSS.Transform.toString`, `useUniqueId` | Dependency of core; imported directly for transforms [VERIFIED: npm registry] |

Already installed and reused: `@inertiajs/react` 2.3.29, Radix `dropdown-menu` / `alert-dialog` / `dialog` / `select` / `switch` via shadcn, `sonner` (flash toasts), `lucide-react`. No other package is needed (no state library, no query library: a 40-line queue hook is enough).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@dnd-kit/core` 6.3.1 (classic) | `@dnd-kit/react` 0.5.1 (+ `@dnd-kit/helpers`, `@dnd-kit/dom`) | New architecture by the same author, peer `react ^18 \|\| ^19`, attributes applied client-side (no SSR id risk), `type`/`accept`/`group` built in, a Tree story exists in `apps/stories/stories/react/Sortable/Tree`. But pre-1.0 with API changes at 0.3, 0.4 and 0.5 within 10 months, ~2M downloads/week, far fewer examples. dndkit.com now files the classic API under "Legacy" with no maintenance statement. **Use it only if the Wave 0 smoke test exposes a React 19 blocker in classic.** [VERIFIED: npm registry, dndkit.com] |
| dnd-kit | `@atlaskit/pragmatic-drag-and-drop`, `@hello-pangea/dnd` | Not evaluated in depth: dnd-kit has no blocking problem. hello-pangea does not support nested trees well; pragmatic-dnd has no built-in keyboard dragging (it delegates to menus). [ASSUMED] |

**Installation:**
```bash
bun add @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0 @dnd-kit/utilities@3.2.2
```
Pin exact versions (no caret): the project gains nothing from a future 6.x/10.x surprise.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| @dnd-kit/core | npm | ~5 yrs (6.3.1: Dec 2024) | 33.0M/wk | github.com/clauderic/dnd-kit | [OK] | Approved |
| @dnd-kit/sortable | npm | ~5 yrs (10.0.0: Dec 2024) | 31.9M/wk | github.com/clauderic/dnd-kit | [OK] | Approved |
| @dnd-kit/utilities | npm | ~5 yrs (3.2.2: Nov 2023) | (dependency of core) | github.com/clauderic/dnd-kit | [OK] | Approved |
| @dnd-kit/react | npm | 0.5.1: 2026-10-15 | 2.05M/wk | github.com/clauderic/dnd-kit | [OK] | Fallback only (not installed by default) |
| @dnd-kit/helpers | npm | 0.5.1: 2026-10-15 | 1.49M/wk | github.com/clauderic/dnd-kit | [OK] | Fallback only |

No `postinstall` script on any of them (`npm view <pkg> scripts.postinstall` empty). slopcheck run with `-e npm` in a scratch dir (`/tmp/dndprobe`), 5/5 OK.
**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
GET /courses/:id/builder ──► CourseContentsController.builder
                               │ authorize edit; flat query: all course_modules of course
                               │ + course_contents of those modules (ordered by order,id)
                               ▼
                         Inertia SSR render (props: course, sections[], contents[])
                               ▼
Browser: builder.tsx ──► buildRows(sections, contents, expanded) ──► flat typed rows
   │                                              (s-<id> / c-<id>, depth, parentId)
   │ drag (pointer / keyboard)       "Déplacer vers…" / Monter / Descendre / inline edit / delete
   ▼                                              │
DndContext(id="course-builder")                   │
  active kind = content → full list, parent = nearest section above slot
  active kind = section → sections-only list, depth from x-offset / ←→ keys,
                          clamp to depth+height ≤ 2, descendants hidden
   │ onDragEnd → op {kind, id, parentId, position}│
   └──────────────► optimistic setRows ◄──────────┘
                          │ enqueue(op)  (one request in flight, token read at send time)
                          ▼
              fetch POST/PUT/DELETE (JSON, X-XSRF-TOKEN, redirect:'manual')
                          ▼
  /contents/:id/move · /modules/:id/move · PUT /modules/:id · PUT /contents/:id · DELETE …
     │ load item → course; bouncer CoursePolicy.edit
     │ db.transaction: Course row forUpdate()  (serialises structural writes per course)
     │   conflict? updatedAt (unix s) ≠ expected → 409
     │   destination in same course? cycle? depth+height ≤ 2? empty (delete)? → 422/409
     │   splice into destination siblings, renumber 1..n (source too), save moved row
     ▼
  200 {item:{id, updatedAt}}  ──► queue updates token; indicator "Enregistré"
  4xx/5xx/opaqueredirect      ──► rollback to snapshot (or reload props), "Erreur" + Réessayer
```

### Recommended Project Structure
```
inertia/
├── pages/courses/builder.tsx          # page shell: header, dialogs, DndContext, indicator
├── components/builder/
│   ├── builder-row.tsx                # one sortable row (section header or content)
│   ├── inline-title.tsx               # button ⇄ input title editor
│   ├── move-menu.tsx                  # "Déplacer vers…", Monter, Descendre
│   └── save-status.tsx                # role="status" indicator + Réessayer
└── lib/
    ├── builder_tree.ts                # PURE: buildRows, projections, depth/height, positions (no React)
    └── builder_save_queue.ts          # useSaveQueue hook + fetchJson helper
app/
├── helpers/category_tree.ts           # add pure depthOf() / subtreeHeight() next to wouldCreateCycle
├── controllers/course_contents_controller.ts   # moveModule, moveContent, JSON negotiation
└── validators/course_content.ts       # moveModuleValidator, moveContentValidator, WR-20 nullables
tests/
├── unit/builder_tree.spec.ts          # pure client projection helpers (relative import)
├── unit/category_tree.spec.ts         # extend with depthOf/subtreeHeight
├── functional/builder_moves.spec.ts   # endpoints, IDOR, depth, cycle, conflict, delete-empty
└── browser/builder.spec.ts            # keyboard drag + menu + axe (CI)
```

### Pattern 1: Flattened sortable tree with two row kinds (recommended)

**What:** Render every visible row (section headers and contents of expanded sections) as siblings in one `<ul>` under one `SortableContext`, indented by `depth`. Hierarchy lives in `parentId`/`depth`, not in DOM nesting. This is the official dnd-kit tree pattern (`stories/3 - Examples/Tree/SortableTree.tsx` at tag `@dnd-kit/core@6.3.1`: `flattenTree`, `buildTree`, `removeChildrenOf`, `getProjection`, `sortableTreeKeyboardCoordinates`, `MeasuringStrategy.Always`, `DragOverlay` in a portal). [VERIFIED: github.com/clauderic/dnd-kit tag @dnd-kit/core@6.3.1]

**Why this and not per-container `SortableContext`s:** the multiple-containers approach puts droppables inside a draggable section; dragging a section drags its nested containers with it, so collision detection sees moving targets and needs custom filtering. Per-container also cannot express "drop a section one level deeper" without extra droppables. The flat list keeps one collision space (`closestCenter`), one keyboard model, and makes collapsed/empty sections trivially targetable because their header row is always present. [CITED: dndkit.com legacy docs; reasoning ASSUMED]

**Specialisation for this data model** (contents always render before child sections inside a section, matching the learner pages):

- Row ids: `s-${module.id}` and `c-${content.id}`. Module 12 and content 12 must not collide in one `SortableContext`.
- **Content drag:** list = all visible rows minus the active one. After `arrayMove`, the destination parent is the **nearest section row above** the slot. Position = number of that section's content rows above the slot. A slot above the first section is invalid: snap to the first section, or cancel. No horizontal projection is needed. Example: `S1, c1, c2, S1.1, c3, ▮, S2` → `S1.1` at the end; `S1, c1, c2, ▮, S1.1` → `S1` at position 2.
- **Section drag:** on `onDragStart`, compute the list as **section rows only**, without the active section's descendants. Hide content rows during the drag, as the official example hides children of the active item. Apply the official `getProjection` (depth from `delta.x / indentationWidth` for pointers, ←/→ for keyboard), then clamp so that `projectedDepth + subtreeHeight(active) ≤ 2` (0-based depth, so 3 levels). `parentId` comes from the projection. Position = index among the new parent's section children.
- Keyboard `coordinateGetter` branches on the active id prefix: `c-` → `sortableKeyboardCoordinates` (vertical), `s-` → the example's `sortableTreeKeyboardCoordinates` (vertical + ←/→ depth).
- `cancelDrop` (DndContext prop) or an `onDragEnd` guard refuses invalid projections, such as depth overflow or a content above every section.
- **Keyboard risk of the sections-only list:** the official example hides only rows *below* the active item, so the active row never moves. Hiding content rows *above* the active section makes the row jump up at drag start, while the keyboard sensor's starting rect may still be the pre-reflow position, so the first ArrowDown can skip rows. Pointer drags are unaffected (the overlay follows the pointer). Cover it with a browser test (keyboard-move a section that sits below expanded content rows). **Fallback if it misbehaves:** keep content rows mounted during section drags and clamp section positions to after the destination parent's content rows.

### Pattern 2: Collapsed and empty sections as targets (D-03)
- A collapsed section's header row stays in the list. When a content drop lands right after it, the nearest section above is that section, so the content goes **at its end**. Compute position = its content count, not 0, when the section is collapsed.
- Auto-expand: in `onDragOver`, when `over.id` is a collapsed `s-` row, start a ~600 ms timer and add the id to `expanded` when it fires. Clear the timer when `over` changes or the drag ends. The new rows mount mid-drag, so use `measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}`, as the official tree example does.
- An empty expanded section is just its header row: same rule, position 0.

### Pattern 3: Intent-based move endpoints (server)

Add, in the existing builder route group (`auth` + `role` middleware):
- `POST /contents/:contentId/move` body `{ moduleId: number, position: number (≥0), updatedAt: string|null }`
- `POST /modules/:moduleId/move` body `{ parentId: number|null, position: number (≥0), updatedAt: string|null }`

Algorithm (both), all inside `db.transaction(async (trx) => …)`:
1. Load the item with its course (`content → module → course`, `module → course`); `bouncer.with('CoursePolicy').authorize('edit', course)`.
2. `await Course.query({ client: trx }).where('id', course.id).forUpdate().first()`. This serialises structural writes per course on PG/MySQL. Knex compiles `forUpdate` to an empty string on SQLite, which serialises writers anyway. [VERIFIED: `knex/lib/dialects/sqlite3/query/sqlite-querycompiler.js:26`]
3. Re-read the item inside the transaction. Conflict: `expected` (ISO from the client) vs `item.updatedAt`, compared with `toUnixInteger()`. Treat both null as equal. On mismatch → **409** `{ code: 'E_CONFLICT', message: 'Cet élément a été modifié par un autre enseignant.', item: <fresh serialized row> }`.
4. Destination scoped to the course: `CourseModule.query({client: trx}).where('id', dest).where('course_id', course.id).first()`. Missing → 422, same discipline as `PARENT_ERROR`.
5. Modules only: load `id, parent_id` of all course modules once, then:
   - `wouldCreateCycle(parentById, module.id, parentId)` → 422.
   - `newDepth + subtreeHeight(childrenByParent, module.id) > 2` → 422 ("Profondeur maximale : 3 niveaux"), where `newDepth = parentId === null ? 0 : depthOf(parentById, parentId) + 1`.
   - Conventions (use the same in the unit test names): `depthOf(root module) = 0`; a `null` parent means the moved section lands at depth 0; `subtreeHeight(section without sub-sections) = 0`. Max allowed depth is 2 (= 3 levels).
   - Both helpers must stay pure and terminate on cyclic data (same style as `wouldCreateCycle`).
6. Destination siblings: `ORDER BY order, id`, excluding the item. Splice the item at `clamp(position, 0, n)`. Write `order = i + 1` only where it changed. If the parent changed, renumber the source siblings too (dense 1..n). Siblings are renumbered with the query builder (no `updated_at` bump). **The moved item is saved through the model** (`item.merge({ moduleId|parentId, order }).useTransaction(trx).save()`), so `autoUpdate` bumps its `updatedAt`.
7. Return `200 { item: { id, updatedAt } }`.

Order values today are not dense: `createModule`/`createContent` use `max+1`, deletes leave gaps, and `reorder*` writes client numbers. Dense renumbering of the touched parents is enough. Never trust client-supplied order numbers again.

Same rules elsewhere (D-02 consistency):
- `createModule`: depth check (`depthOf(parent) + 1 ≤ 2`).
- `updateModule` with `parentId`: route through the same depth check, or drop `parentId` from `updateModuleValidator` now that a move endpoint exists. Dropping it is simpler, and the A8 tests in `authorization_contents.spec.ts` would then move to the new endpoint.
- Existing data deeper than 3: leave it. Show it at its real depth in the builder (flat load), and refuse moves that keep it too deep. No migration. [ASSUMED: planner/user to confirm]

`deleteModule` (D-05): same transaction plus course `forUpdate()`, then `children.count === 0 && contents.count === 0`, else **409** "Déplacez ou supprimez d'abord son contenu". Both FKs (`course_contents.module_id`, `course_modules.parent_id`) are `ON DELETE CASCADE`, so an unlocked check races with a concurrent move and can delete content (data loss). [VERIFIED: migrations]

Note: deleting a content cascades its `content_progress` rows (learner progress lost). This is accepted by D-06 until the trash phase, but the confirmation copy should say so. [VERIFIED: migration 1763370620773, `content_id` FK `onDelete('CASCADE')`]

### Pattern 4: Autosave queue over fetch (client)

```ts
// Source: pattern derived from learn.tsx heartbeat (repo) + fetch spec semantics
function xsrfToken() {
  const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/)
  return m ? decodeURIComponent(m[1]) : ''
}
async function sendJson(method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    redirect: 'manual', // CSRF failure = 302 back; never follow it into a 200 HTML page
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-XSRF-TOKEN': xsrfToken() },
    body: body ? JSON.stringify(body) : undefined,
  })
  const isJson = res.headers.get('content-type')?.includes('application/json')
  if (res.type === 'opaqueredirect') throw { kind: 'session' }       // reload the page
  if (!res.ok || !isJson) throw { kind: res.status === 409 ? 'conflict' : 'error', status: res.status, body: isJson ? await res.json() : null }
  return res.json()
}
```
- **One request in flight**: `queue.current = queue.current.then(() => run(op))`. Each op is a function that reads the latest token from a `rowsRef` **when it runs**, not when it is queued. Otherwise a second queued edit sends a stale token and the user conflicts with their own earlier save.
- **Optimistic**: apply the change to local rows immediately and keep `snapshot = rows before op`. On success: write the returned `updatedAt` into the row. On failure: stop and discard the remaining queued ops, restore the snapshot (or `router.reload({ only: ['sections', 'contents'] })` for server truth), set status `error`, and keep `failedOp` for "Réessayer".
- **Conflict (409) on a title or panel edit**: keep the user's typed value in the field (D-09), show the message, and offer "Recharger" (reload props for that item). Never auto-overwrite.
- **Indicator**: one `<div role="status" aria-live="polite">` with text "Enregistrement…" / "Enregistré" / "Erreur : … [Réessayer]". The Réessayer button sits **outside** the live region so it is not re-announced. dnd-kit keeps its own live region for drag announcements, and two regions are fine.
- **Props re-sync**: creation stays an Inertia `useForm.post` (`preserveState` defaults to `true` for post/put/delete in Inertia 2.3.29; **add `preserveScroll: true`**). When `sections`/`contents` props change, rebuild rows **only if the queue is idle**. `expanded`, the open panel id, and the editing id live in separate state keyed by entity id, so they survive. [VERIFIED: `@inertiajs/core/dist/index.esm.js:2459-2470`]
- **Navigation guard**: while the queue is non-empty, register `router.on('before', …)` (Inertia) and `beforeunload` to warn. [ASSUMED: Inertia `before` event can cancel via `event.preventDefault()` / return false — verify in docs during planning]
- Inertia visits are not used for autosave: 2.3.29 has no optimistic API, and a new synchronous visit cancels the in-flight one. [VERIFIED: core types `async` option; no `optimistic` symbol in core dist]

Server response contract for these endpoints (what `fetch` with `Accept: application/json` actually receives), verified in sources:

| Situation | Response | Source |
|-----------|----------|--------|
| Session expired (`middleware.auth()`) | 401 JSON | `@adonisjs/auth` E_UNAUTHORIZED_ACCESS negotiates `json` [VERIFIED] |
| Wrong role (`role_middleware.ts`) | 403 JSON `{message}` | `response.forbidden({...})` [VERIFIED] |
| Bouncer denial | 403 JSON | `app/exceptions/handler.ts` passes JSON callers through [VERIFIED] |
| `firstOrFail` miss | **404 HTML** (Inertia `errors/not_found` page, status 404) | `statusPages['404']` has no JSON branch [VERIFIED] → client must not parse the body |
| VineJS failure | 422 JSON `{errors:[…]}` | [ASSUMED: AdonisJS content negotiation of E_VALIDATION_ERROR; assert in functional tests] |
| Bad/expired CSRF token | **302 redirect back** (always) | `@adonisjs/shield` E_BAD_CSRF_TOKEN.handle [VERIFIED] → `redirect: 'manual'` |
| Conflict / non-empty delete | 409 JSON (to implement) | — |

Controller negotiation for the existing `updateModule`/`updateContent`/`deleteModule`/`deleteContent`: add `if (request.accepts(['html', 'json']) === 'json') return response.json(...)` and keep the flash + `redirect().back()` path. The 02-10 tests (`authorization_contents.spec.ts`) assert the redirect + flash behaviour and keep passing. Inertia requests send `Accept: text/html, application/xhtml+xml` and keep the old branch.

### Pattern 5: Inline title editor (D-04)
- Read mode: the title is a `<button type="button">` (visible text = title, `aria-label="Renommer « {title} »"` or a visually hidden suffix). The pencil button does the same thing.
- Edit mode: `<input aria-label="Titre de la section">` auto-focused with the text selected. **Enter** saves, **Escape** restores the original value, **blur** saves (per the autosave guardrail). After save or cancel, return focus to the title button (keep a ref; the row is keyed by entity id so it is not remounted).
- Empty title: refuse client-side (validator `minLength(1)`), keep the field open with the error linked by `aria-describedby`.
- The drag handle must not start a drag from the input: listeners live on the handle only (`setActivatorNodeRef`), so this holds by construction.

### Pattern 6: Expandable details panel (disclosure)
- A "Détails" button with `aria-expanded` and `aria-controls={panelId}`, and a panel rendered under the row with `id={panelId}`. `panelId` derives from the entity id (`builder-panel-c-34`), never from a counter, so SSR stays stable. [CITED: w3.org/WAI/ARIA/apg/patterns/disclosure/]
- Fields: description (Textarea), published (Switch), `availableFrom`/`availableUntil` (date inputs), each saved on blur/change through the queue.
- **WR-20 must be fixed for this to work**: `updateModuleValidator`/`updateContentValidator` dates are `.optional()` only, and the controller maps a falsy date to `undefined`, so a date can never be cleared. Add `.nullable()`, map `null → null`, and validate `availableFrom ≤ availableUntil`. [VERIFIED: `app/validators/course_content.ts`, 02-REVIEW WR-20]
- The panel lives inside the sortable row's `<li>`, below the header, and is hidden while that row is being dragged (DragOverlay shows only the header).

### Pattern 7: "Déplacer vers…" menu (D-07, WCAG 2.5.7)
- shadcn `DropdownMenu` per row (trigger: icon button `aria-label="Actions pour « {title} »"`), with items:
  - **Monter**, **Descendre**: reorder among siblings without dragging. 2.5.7 requires every drag outcome to be reachable with a single pointer, and reorder-within-section is a drag outcome. Disable at the bounds.
  - **Déplacer vers…**: opens a `Dialog` listing destination sections as a flat, indented list of buttons (or radio items) labelled with their path ("Section 2 › Sous-section 2.1"). Invalid destinations for a section (itself, descendants, depth overflow) are `aria-disabled` with a reason. Moves append at the end of the destination. A Dialog beats nested `DropdownMenuSub` for 3 levels and long lists (scrollable, searchable later, readable by screen readers).
  - **Supprimer**: `AlertDialog`. For a non-empty section, the item is `aria-disabled="true"` (not `disabled`, so it stays focusable/discoverable) with `aria-describedby` pointing to "Déplacez ou supprimez d'abord son contenu".
- After delete, Radix returns focus to a trigger that no longer exists. Pass `onCloseAutoFocus={(e) => { e.preventDefault(); focusNeighbour() }}` and focus the next row, the previous row, or the parent section title.
- Every menu action goes through the same save queue and move endpoints as drags, so tests can cover the backend logic without pointer drags. [CITED: w3.org/WAI/WCAG22/Understanding/dragging-movements.html]

### Anti-Patterns to Avoid
- **Nested `SortableContext` per section with droppables inside a draggable**: collision detection with moving nested targets; abandoned in favour of Pattern 1.
- **Sending full `{id, order}` arrays from the client** (current `reorder*` style): overwrites concurrent edits by other teachers and trusts client order numbers. Send intent `(id, parent, position)`.
- **Making the whole card draggable**: breaks inline inputs and buttons (D-03 says handle only).
- **Using an array index or `useId()` counter for `useSortable` ids or panel ids**: ids must be entity-derived strings.
- **`createPortal(<DragOverlay>, document.body)` at render time** (as in the official example): crashes SSR. Render the portal only after mount (`const [mounted, setMounted] = useState(false)`).
- **Inertia `router.put` per keystroke or per drop**: visits cancel each other and replace props mid-drag.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pointer/keyboard/touch drag, auto-scroll, live announcements | Custom HTML5 DnD or pointer handlers | `@dnd-kit/core` sensors + `accessibility.announcements` | HTML5 DnD has no keyboard or touch support; dnd-kit handles scroll containers and focus restore (`restoreFocus`) |
| Tree projection (depth from x-offset, keyboard ←/→) | New algorithm | Copy `getProjection`, `removeChildrenOf`, `sortableTreeKeyboardCoordinates` from the 6.3.1 tree example, then add the row-kind and height rules | Edge cases (first row, depth clamping, keyboard coordinates) already solved |
| Cycle detection | New walk | `wouldCreateCycle` in `app/helpers/category_tree.ts` | Already terminates on corrupt cyclic data and is unit-tested |
| Confirmation, menus, focus trap | Custom modals | shadcn `AlertDialog`, `DropdownMenu`, `Dialog` | Already in repo; scroll-lock layout shift already fixed globally |
| CSRF for fetch | New token plumbing | `XSRF-TOKEN` cookie → `X-XSRF-TOKEN` header (learn.tsx) | Shield `enableXsrfCookie: true` already on |

**Key insight:** the hard part is not dragging but the rules (row kinds, depth with subtree height, contents-before-subsections, collapsed targets). Keep all of them in one pure `builder_tree.ts` that is unit-tested, and mirror the depth/cycle rules server-side in pure helpers.

## Common Pitfalls

### Pitfall 1: SSR hydration mismatch from dnd-kit ids
**What goes wrong:** `useDraggable` renders `aria-describedby="DndDescribedBy-N"` from a module-level counter. The SSR process is long-lived, so the counter differs between server and client → React hydration error (known, dnd-kit issue #926).
**How to avoid:** `<DndContext id="course-builder" …>`. `useUniqueId("DndDescribedBy", id)` then returns the given id. The live region renders only after mount (`if (!mounted) return null`), so it is safe. [VERIFIED: `@dnd-kit/core/dist/core.esm.js` lines 97-172, 2903; `@dnd-kit/utilities` useUniqueId]
**Warning signs:** "A tree hydrated but some attributes of the server rendered HTML didn't match" mentioning `aria-describedby`.

### Pitfall 2: Learners cannot see depth-3 sections (D-02 vs 2-level loaders)
**What goes wrong:** a sub-section with children moved into another section becomes depth 3. `learn`/`outline`/`getCourseProgress`/`courses.show` preload only `children`, not grandchildren, so the content disappears from the player, outline and progress percentage.
**How to avoid:** a task that adds a third `.preload('children', …)` level, or replaces the nested preloads with one flat course query + in-memory tree. In `learn` and `outline` the third level **must repeat the same `is_published` filters on the module and on its contents** as the first two levels. Otherwise unpublished depth-3 sections and their bodies reach learners (the WR-02 / CR-03 class of leak). Apply it in: `CourseContentsController.builder|learn|outline|getCourseProgress`, `CoursesController.show` (line ~159). Make `outline.tsx` render recursively and make the `allContents` / first-content loops in `learn.tsx` and the `learn` controller recursive. Builder: flat load (`sections`, `contents` props).
**Warning signs:** the builder shows a section that the learner outline does not.

### Pitfall 3: Timestamp precision breaks the conflict check across engines
**What goes wrong:** PG stores `updated_at` with ms (`timestamptz`); Lucid writes MySQL and SQLite as `yyyy-MM-dd HH:mm:ss`. Comparing full ISO strings or millis yields false conflicts on PG round-trips or false negatives on MySQL. `reorder*`/sibling renumbering via the query builder never bump `updated_at`. Seeded rows inserted with the query builder may have `updated_at = NULL`.
**How to avoid:** compare `DateTime.fromISO(expected).toUnixInteger()` with `item.updatedAt?.toUnixInteger()` (both null = equal). Bump only the item actually edited or moved. Limitation: two writes by different users within the same second are not detected. If that is unacceptable, the alternative is a `lock_version integer` column on both tables (one reversible migration, `increment` on every write). [VERIFIED: `@adonisjs/lucid/build/src/dialects/{pg,mysql,base_sqlite}.js` dateTimeFormat; knex pg timestamp → timestamptz]
**Warning signs:** functional test passes on SQLite and fails on PG in the CI matrix.

### Pitfall 4: fetch silently "succeeds" on CSRF or HTML errors
**What goes wrong:** Shield answers a bad CSRF token with `302 back`, and `fetch` follows it to the builder page (200 HTML). The 404 status page is HTML even for JSON callers.
**How to avoid:** `redirect: 'manual'`; treat `opaqueredirect` as "session expirée, rechargez"; require `ok && content-type json`. [VERIFIED: shield `chunk-IGRWBR6H.js`; handler.ts]

### Pitfall 5: Delete-empty race with cascading FKs
**What goes wrong:** teacher A deletes an empty section while teacher B moves a content into it; without a shared lock the delete cascades B's content away.
**How to avoid:** delete and move take the same course-row `forUpdate()` lock inside the transaction and re-check emptiness after acquiring it.

### Pitfall 5b: Deleting a content with attachments
**What goes wrong:** `content_content_files.course_content_id` is `ON DELETE CASCADE`, so `deleteContent` removes the pivot rows but leaves the `content_files` rows and their stored blobs. Blobs are SHA-256 deduplicated and may be shared, and phase 4 deliberately makes orphan files admin-only downloadable.
**How to avoid:** no new code in this phase (do not delete blobs: they may be shared; cleanup belongs to the trash phase). Add a functional case: deleting a content with an attachment returns 200, removes the pivot row, and leaves the `content_files` row. [VERIFIED: migration 1792402903468, 04-01-SUMMARY]

### Pitfall 6: Collapsed or unrendered rows are not drop targets
**What goes wrong:** with nested containers, a collapsed section has no rendered container to drop into.
**How to avoid:** Pattern 1 keeps the header row; Pattern 2 auto-expands. Use `MeasuringStrategy.Always` so rows inserted mid-drag are measured. With a few hundred rows this is fine; above ~500, switch to `WhileDragging` and profile. [CITED: official tree example measuring config]

### Pitfall 7: Touch drag blocks page scroll, or never starts
**What goes wrong:** `touch-action: none` on the card blocks scrolling; without it on the handle, iOS scrolls instead of dragging.
**How to avoid:** listeners + `setActivatorNodeRef` on the handle `<button>` only, with `className="touch-none"` on that button. Use `PointerSensor` with `activationConstraint: { distance: 4 }` (mouse/pen); add `TouchSensor` with `{ delay: 150, tolerance: 5 }` if real-device testing shows accidental drags. Distance and delay are mutually exclusive per sensor. The handle must be ≥ 24×24 CSS px (WCAG 2.5.8); the current `h-4 w-4` icon alone is too small, so wrap it in a `size-8`/`size-9` button. [CITED: dndkit.com/api-documentation/sensors/pointer]

### Pitfall 8: Focus loss after reorder or delete
**What goes wrong:** re-render with new keys or a removed row loses keyboard focus.
**How to avoid:** key rows by entity id (`s-12`), never by index. Keep `accessibility.restoreFocus` (default). After a menu move, focus the moved row's handle. After delete, use the explicit neighbour focus (Pattern 7). Hiding content rows during a section drag is fine because the section row itself stays mounted.

### Pitfall 9: Handle semantics and axe
**What goes wrong:** dnd-kit spreads `role="button"`, `tabIndex=0`, `aria-roledescription="draggable"` (English), `aria-describedby`. On a `<button>` the role is redundant (best-practice, not serious). A missing accessible name on the icon-only handle is a **serious** axe violation.
**How to avoid:** `<button type="button" aria-label="Déplacer « {title} »" {...attributes} {...listeners}>` and pass `useSortable({ id, attributes: { roleDescription: 'élément déplaçable' } })`. Provide French `screenReaderInstructions.draggable` ("Pour déplacer, appuyez sur Espace, utilisez les flèches haut et bas (gauche et droite pour changer de niveau d'une section), puis Espace pour déposer ou Échap pour annuler.") and French `announcements` (onDragStart/Over/End/Cancel) that name the projected parent and position ("Déposé dans « Section 2 », position 3 sur 5").

### Pitfall 10: Radix scroll lock and the builder
**What goes wrong:** Radix dialogs and menus lock scroll by hiding the root scrollbar → horizontal jump.
**How to avoid:** already fixed globally (`inertia/css/app.css`: `html body[data-scroll-locked] { overflow: visible !important; margin-right: 0 !important; }` + `scrollbar-gutter: stable`, commit 2154b10). Use the shadcn wrappers as-is. Do not add `modal={false}` workarounds or custom body styles; do not open a Dialog during a drag. [VERIFIED: app.css lines 129-144]

### Pitfall 11: `node ace` and ports in this environment
**What goes wrong:** the default shell Node 24 breaks `node ace`; ports 3333/24678 are held by the dev server; dev Postgres is on 54322.
**How to avoid:** `export PATH="$HOME/.local/share/fnm/node-versions/v22.19.0/installation/bin:$PATH"`, then `PORT=34xx DB_FILENAME=./tmp/test-05-xx.sqlite3 node ace test functional --files …` (pattern proven in 02-10). [VERIFIED: lsof on the machine; 02-10-SUMMARY]

## Code Examples

### DndContext setup (classic, SSR-safe, French a11y)
```tsx
// Source: @dnd-kit/core 6.3.1 typings (DndContext Props: id, accessibility.{announcements,
// screenReaderInstructions,restoreFocus}, measuring, cancelDrop) + official Tree example
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  useSensor(KeyboardSensor, { coordinateGetter: builderKeyboardCoordinates /* branches on 'c-' / 's-' */ })
)
<DndContext
  id="course-builder"
  sensors={sensors}
  collisionDetection={closestCenter}
  measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
  accessibility={{ announcements: frAnnouncements, screenReaderInstructions: { draggable: FR_INSTRUCTIONS } }}
  onDragStart={…} onDragMove={…} onDragOver={…} onDragEnd={…} onDragCancel={…}
>
  <SortableContext items={rows.map((r) => r.key)} strategy={verticalListSortingStrategy}>
    {rows.map((row) => <BuilderRow key={row.key} row={row} … />)}
  </SortableContext>
  {mounted && createPortal(<DragOverlay>{activeRow && <RowPreview row={activeRow} />}</DragOverlay>, document.body)}
</DndContext>
```

### Sortable row with handle-only activation
```tsx
// Source: @dnd-kit/sortable useSortable (setActivatorNodeRef, attributes, listeners)
const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } =
  useSortable({ id: row.key, data: { kind: row.kind }, attributes: { roleDescription: 'élément déplaçable' } })
<li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition, paddingLeft: row.depth * 24 }}
    className={isDragging ? 'opacity-40' : undefined}>
  <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners}
          aria-label={`Déplacer « ${row.title} »`} className="touch-none size-9 …">
    <GripVertical aria-hidden className="h-4 w-4" />
  </button>
  …
</li>
```

### Server move (shape only)
```ts
// Source: existing controller conventions (bouncer, db.transaction, scoped where) + Pattern 3
await db.transaction(async (trx) => {
  await Course.query({ client: trx }).where('id', course.id).forUpdate().first()
  const fresh = await CourseContent.query({ client: trx }).where('id', content.id).firstOrFail()
  if (!sameSecond(fresh.updatedAt, payload.updatedAt)) throw conflict(fresh)
  const dest = await CourseModule.query({ client: trx }).where('id', payload.moduleId).where('course_id', course.id).first()
  if (!dest) throw invalidDestination()
  // splice into dest siblings ordered by (order, id), renumber dest (and source if different) 1..n,
  // query-builder updates for siblings; fresh.merge({ moduleId, order }).useTransaction(trx).save()
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-beautiful-dnd` | dnd-kit / pragmatic-drag-and-drop | rbd archived 2024 [ASSUMED] | Do not use rbd forks for trees |
| `@dnd-kit/core` + `sortable` (DndContext) | `@dnd-kit/react` (DragDropProvider, plugins, `type/accept/group`) | 0.x since 2024, 0.5.1 on 2026-10-15; classic labelled "Legacy" on dndkit.com | Classic still the low-risk choice for an executor today; plan a possible migration later, isolated to `builder.tsx` + `components/builder/` |
| Keyboard-only alternative for drag | Single-pointer alternative required (WCAG 2.2 SC 2.5.7, AA) | WCAG 2.2, Oct 2023 | Keyboard sensor alone does not satisfy 2.5.7; the menu (Monter/Descendre/Déplacer vers…) does [CITED: w3.org Understanding 2.5.7] |

**Deprecated/outdated in this repo:**
- Decorative `Edit`/`Trash2` buttons in `builder.tsx` (lines 198-204, 225-231) have no handler: dead UI, replaced.
- `GripVertical` with `cursor-move` and no behaviour: becomes the handle button.
- Collapse toggle `<button onClick … className="p-1">` without `aria-expanded` or label: replace with a labelled disclosure button.
- `value: any` on the content type `Select` and `auth.user: any` props: tighten while rewriting.

## Existing UI: what to keep, what is dead (question 6)

- **Props contract today:** `course { id, title, code }` (actually the full `course.serialize()`), `modules` (roots, each with `children` (one level only) and `contents`), plus shared `auth`, `appSettings`, `menus`, `flash`. Recommended new contract: `course`, `sections: {id, parentId, title, description, order, isPublished, availableFrom, availableUntil, updatedAt}[]`, `contents: {id, moduleId, contentType, title, description, order, isPublished, availableFrom, availableUntil, updatedAt}[]`. Select only these columns: the builder does not need page bodies (`content`), which keeps the Inertia payload small.
- **Keep:** header (back link, "Aperçu" → `/courses/:id/learn`, "Nouveau module"), empty state, module and content creation dialogs (fields, `Select` of 6 types, publish switch), "Brouillon" badges, content type icons, `+ Contenu` and `+ Sous-section` per section (hide `+ Sous-section` at depth 2).
- **Dead / to build:** Edit, Trash2, drag handles, any rename/delete/edit UI.
- **Learner coupling:** learn/outline read `is_published` per level, and `CourseModule.isEffectivelyAvailable()` walks ancestors (fails closed on cycles). Moving content under an unpublished or scheduled section hides it from learners, which is expected. A badge "Masqué (section parente)" in the builder is optional polish. Re-parenting never needs data fixes because availability is computed, not stored.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@dnd-kit/core` 6.3.1 has no blocking React 19.3 issue beyond the SSR id mismatch | Standard Stack | Executor hits a runtime bug → fall back to `@dnd-kit/react` 0.5.1 (Wave 0 smoke test catches it) |
| A2 | VineJS failures answer 422 JSON to `Accept: application/json` | Pattern 4 | Client mislabels a validation error; functional test asserts it |
| A3 | Existing data deeper than 3 levels is left as is (shown, not migrated) | Pattern 3 | User may want a cleanup; low impact (such rows are invisible today) |
| A4 | Inertia `before` event can block navigation while saves are pending | Pattern 4 | Use `beforeunload` + disable links only |
| A5 | Same-second conflict blind spot is acceptable (vs a `lock_version` column) | Pitfall 3 | Rare silent overwrite; planner/user decide |
| A7 | A unit test can import a React-free `inertia/lib/builder_tree.ts` via a relative `.js` path under the backend tsconfig (root `tsconfig.json` excludes `inertia/**` from its initial set, imports still compile) | Validation | If it fails, move the pure helper to `app/helpers/` and import it from the client through a relative path, or test it only through the browser suite |
| A8 | pragmatic-dnd / hello-pangea assessment | Alternatives | None (not recommended anyway) |

## Open Questions

1. **Conflict token: `updated_at` (second precision) or a new `lock_version` column?**
   - What we know: `updated_at` exists, is maintained by Lucid on model save, and has seconds precision on SQLite/MySQL.
   - Recommendation: use `updated_at` with `toUnixInteger()` (no migration); revisit only if the user wants stronger guarantees.
2. **Keep or remove `reorderModules`/`reorderContents` and `updateModule.parentId`?**
   - Recommendation: the new UI uses only the move endpoints. Remove `parentId` from `updateModuleValidator` (and move its A8 tests to the move endpoint) so there is a single re-parenting path with depth checks. Leave the `reorder*` endpoints in place (scoped, tested), unused, so the phase scope stays small.
3. **Depth-3 support in learner pages: this phase or a prerequisite plan?**
   - Recommendation: a small plan in this phase (05-01 or a dedicated wave-1 plan) before re-parenting ships. It is a correctness fix and BUILD-03 is unsafe without it.
4. **Browser suite locally** (see Validation): changing `baseURL` in `tests/bootstrap.ts` to follow `PORT` is a one-line Wave 0 change, but 02-01 treated `bootstrap.ts` as off-limits. The user should confirm.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 22 (fnm) | `node ace` | ✓ | v22.19.0 | — (default Node 24 breaks ace) |
| bun | install | ✓ | 1.4.3 | pnpm |
| Playwright browsers | browser suite | ✓ | chromium 1194–1243, firefox, webkit | CI |
| Port 3333 / 24678 | browser suite base URL / Vite HMR | ✗ (held by dev server, PID 98587) | — | CI e2e, or Wave 0 `baseURL` from `PORT` |
| Dev Postgres | — | ✓ on 54322 (docker) | — | tests use sqlite via `.env.test` |

**Missing dependencies with no fallback:** none.
**Missing with fallback:** local browser run blocked by ports → CI `e2e.yml` (seeded PG, port 3333) is authoritative.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Japa 4 (`@japa/runner` ^4.5) with `@japa/api-client`, `@japa/assert`, `@japa/browser-client` (Playwright) + `@axe-core/playwright` |
| Config file | `adonisrc.ts` (suites unit/functional/browser), `tests/bootstrap.ts`, `.env.test` (sqlite, `SESSION_DRIVER=memory`) |
| Quick run command | `PORT=3450 DB_FILENAME=./tmp/test-05.sqlite3 node ace test functional --files tests/functional/builder_moves.spec.ts` (Node 22 PATH) |
| Full suite command | `PORT=3450 DB_FILENAME=./tmp/test-05.sqlite3 node ace test unit functional` + `bun run typecheck && bun run lint && bun run check:debt` |
| Browser | `node ace test browser tests/browser/builder.spec.ts` (CI e2e; locally only after the Wave 0 baseURL change and with the dev server stopped or on a free port) |

There is **no React component test runner** (no Vitest/RTL in `package.json`). Do not add one: put the logic in pure `inertia/lib/builder_tree.ts` (unit-tested via Japa) and cover the interaction through the browser suite.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUILD-01 | content move within section renumbers densely; position clamped | functional | `… --files tests/functional/builder_moves.spec.ts` | ❌ Wave 0 |
| BUILD-01 | projection: content slot → (parent, position) | unit | `node ace test unit --files tests/unit/builder_tree.spec.ts` | ❌ Wave 0 |
| BUILD-02 | content to other section (incl. empty), source + destination renumbered; foreign `moduleId` (other course) refused, nothing written | functional | builder_moves.spec.ts | ❌ |
| BUILD-03 | module reorder + re-parent; cycle refused; depth+subtree height > 3 refused; parent `null` accepted; foreign ids refused | functional + unit (`depthOf`, `subtreeHeight` in category_tree.spec.ts) | as above | ⚠ extend existing |
| BUILD-03 | depth-3 content visible in learn/outline/progress | functional (`.withInertia()` props assertions) | builder_moves.spec.ts or courses_learn_depth.spec.ts | ❌ |
| BUILD-04 | createModule refuses depth > 3 | functional | builder_moves.spec.ts | ❌ |
| BUILD-05/08 | PUT JSON returns `updatedAt`; stale token → 409 with fresh item; dates clearable (null); from>until → 422 | functional | builder_moves.spec.ts | ❌ |
| BUILD-06 | delete non-empty section → 409 and nothing deleted; empty → 200 | functional | builder_moves.spec.ts | ❌ |
| BUILD-09 | delete content JSON 200; teacher without edit → 403 | functional | builder_moves.spec.ts | ❌ |
| BUILD-10 | CSRF failure is not a 200 JSON (302) → client error path | functional (request without token, `.redirects(0)`) | builder_moves.spec.ts | ❌ |
| All | authorization: non-editor teacher 403 on every new route; admin passes | functional | authorization_contents.spec.ts (extend) | ⚠ extend |
| BUILD-01/02/03, D-07 | keyboard drag: focus handle, Space, ArrowDown×n, (ArrowRight for sections), Space → DOM order changed, reload → persisted | browser | `node ace test browser tests/browser/builder.spec.ts` | ❌ |
| D-07 | "Déplacer vers…" dialog moves a content; Monter/Descendre reorder | browser | builder.spec.ts | ❌ |
| BUILD-03 | keyboard-move a section located below expanded content rows lands where announced (sections-only reflow risk) | browser | builder.spec.ts | ❌ |
| BUILD-09 | delete a content with an attachment: 200, pivot row gone, `content_files` row kept | functional | builder_moves.spec.ts | ❌ |
| BUILD-10 | indicator shows "Enregistré" in `role=status` after an action | browser | builder.spec.ts | ❌ |
| D-07/a11y | builder page: no critical/serious axe violations (closed, with a panel open, with menu open) | browser | `tests/browser/accessibility.spec.ts` (add case) | ⚠ extend |
| SSR | no hydration warning on builder (listen to `page.on('console')` for "hydrat") | browser | builder.spec.ts | ❌ |

Functional test conventions (from 02-10): `group.each.setup(() => testUtils.db().withGlobalTransaction())`; JSON calls use `.header('Accept', 'application/json').withCsrfToken().loginAs(user)`; redirect-style calls use `.redirects(0)`; positive controls for every refusal; assert DB state after each refusal (nothing written). The nested `db.transaction` inside the global transaction becomes a savepoint, which works on all three engines. CI runs this suite on PG, MySQL and SQLite, which is what exercises Pitfall 3.

Browser test notes: the browser suite has no migrate hook and relies on a seeded DB (`node ace db:seed`), using `admin@edonis.test` / `teacher@edonis.test`. Create a dedicated course in the test through models, or reuse `course_seeder` data, and restore order afterwards. Playwright keyboard drag: `await handle.focus(); await page.keyboard.press('Space'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space')`. Wait for the `role=status` text "Enregistré" before reloading. Avoid pointer drags in CI (flaky); one smoke pointer drag with `page.mouse` steps is optional.

### Sampling Rate
- **Per task commit:** quick run (functional file of the task) + `bun run typecheck`
- **Per wave merge:** `node ace test unit functional` + lint + check:debt
- **Phase gate:** full unit + functional green locally; browser + axe green in CI `e2e.yml` before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/functional/builder_moves.spec.ts`: local `createModule`/`createContent` helpers (copy from `authorization_contents.spec.ts` or promote them to `tests/functional/helpers/factories.ts`)
- [ ] `tests/unit/builder_tree.spec.ts`: verify that importing `../../inertia/lib/builder_tree.js` compiles under the backend runner (A7)
- [ ] `tests/browser/builder.spec.ts` + one case in `accessibility.spec.ts`
- [ ] Optional one-line change: `baseURL: \`http://localhost:${process.env.PORT ?? 3333}\`` in `tests/bootstrap.ts` (needs user OK; also unverified whether the test server starts a Vite HMR server on 24678 — LOW confidence)
- [ ] `bun add @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0 @dnd-kit/utilities@3.2.2` + SSR smoke: render `/courses/:id/builder` and check the console for hydration warnings

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (inherited) | `middleware.auth()` on the builder group; 401 JSON for fetch |
| V3 Session Management | yes | Session cookie + Shield CSRF (`X-XSRF-TOKEN`) on every fetch; handle CSRF 302 |
| V4 Access Control | yes | `CoursePolicy.edit` on the item's course; destination ids scoped with `where('course_id', course.id)`; never authorize on the destination only |
| V5 Input Validation | yes | VineJS: `position` `number().min(0)`, `parentId` `number().nullable()`, `updatedAt` `string().nullable()`, WR-20 nullables + date order |
| V6 Cryptography | no | — |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR: move content into another course's module | Tampering / Elevation | Load destination with `course_id = item's course`; 422 + nothing written (test it) |
| IDOR: authorize on destination course, not source | Elevation | Authorize on the item's course; require the destination in the same course |
| Cycle / depth bomb via crafted `parentId` | DoS / Tampering | `wouldCreateCycle` + pure height check, both terminating on corrupt data |
| Lost update between teachers | Tampering (integrity) | Conflict token (409) + course-row lock |
| Cascade delete race | Tampering (data loss) | Lock + re-check emptiness |
| CSRF on JSON endpoints | Spoofing | Shield CSRF stays enabled (no `exceptRoutes`) |
| XSS via titles | Tampering | React escapes text; never `dangerouslySetInnerHTML` for titles in the menu or announcements (announcements are plain strings) |

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view`, api.npmjs.org downloads) for `@dnd-kit/{core,sortable,utilities,accessibility,react,dom,helpers,abstract,collision}`: versions, publish dates, peer deps
- Package sources inspected in `/tmp/dndprobe`: `@dnd-kit/core/dist/core.esm.js` (Accessibility mounted guard, `useUniqueId("DndDescribedBy", id)`, draggable attributes), `DndContext.d.ts` (id, accessibility, restoreFocus, cancelDrop, measuring), keyboard sensor types; `@dnd-kit/dom/index.js` (imperative attributes)
- Official examples: `clauderic/dnd-kit` tag `@dnd-kit/core@6.3.1`, `stories/3 - Examples/Tree/*`; `main` `apps/stories/stories/react/Sortable/Tree/*`
- Repo: `course_contents_controller.ts`, `course_content.ts` validators, `course_module.ts`, `course_content.ts`, `category_tree.ts`, migrations, `routes.ts`, `course_policy.ts`, `builder.tsx`, `learn.tsx`, `outline.tsx`, `handler.ts`, `role_middleware.ts`, `config/shield.ts`, `config/inertia.ts`, `tests/bootstrap.ts`, `.env.test`, `e2e.yml`, `app.css`
- node_modules: `@adonisjs/lucid` dialect `dateTimeFormat`, `knex` sqlite `forUpdate`, knex pg `timestamptz`, `@adonisjs/shield` E_BAD_CSRF_TOKEN, `@adonisjs/auth` E_UNAUTHORIZED_ACCESS negotiation, `@inertiajs/core` 2.3.29 router defaults

### Secondary (MEDIUM confidence)
- [dndkit.com pointer sensor (legacy)](https://dndkit.com/api-documentation/sensors/pointer): touch-action, handles, activation constraints
- [dndkit.com](https://dndkit.com/): Latest vs Legacy toggle
- [dndkit.com multiple sortable lists guide](https://dndkit.com/react/guides/multiple-sortable-lists): new API `group/type/accept`, `move()`
- [W3C Understanding SC 2.5.7 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)
- [Zenn article on DndDescribedBy hydration mismatch](https://zenn.dev/knmr216/articles/d4e24316f253b8) (refers to dnd-kit issue #926)
- [newreleases.io @dnd-kit/react 0.5.0](https://newreleases.io/project/github/clauderic/dnd-kit/release/@dnd-kit%2Freact@0.5.0), [0.4.0](https://newreleases.io/project/github/clauderic/dnd-kit/release/@dnd-kit%2Freact@0.4.0), [0.3.0](https://newreleases.io/project/github/clauderic/dnd-kit/release/@dnd-kit%2Freact@0.3.0): API churn across minors

### Tertiary (LOW confidence)
- Assessment of pragmatic-drag-and-drop / hello-pangea (training knowledge only)
- Whether the Japa browser test server starts a Vite HMR server on 24678

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (registry and source verified; React 19 runtime compatibility of classic is A1, guarded by Wave 0 smoke)
- Architecture: MEDIUM-HIGH (flattened tree is the official pattern; the two-row-kind specialisation is my design, unit-testable)
- Backend design: HIGH (all constraints read in code and node_modules)
- Pitfalls: HIGH for SSR id, CSRF redirect, precision, cascade; MEDIUM for touch tuning
- Browser test feasibility: MEDIUM-LOW locally, HIGH in CI

**Research date:** 2026-10-28
**Valid until:** 2026-11-27 (dnd-kit new API moves fast; classic is frozen)
