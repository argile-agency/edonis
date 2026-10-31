# Phase 5: Builder UI - Context

**Gathered:** 2026-10-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade the existing dialog-based course builder (`inertia/pages/courses/builder.tsx`, route `/courses/:id/builder`) to true drag-and-drop (BUILD-01..10). This is a replacement, not a greenfield build: module CRUD, content CRUD, `reorderModules` and `reorderContents` already exist in `CourseContentsController` and are wired in `start/routes.ts`.

What the code scout found (not in the roadmap text):
- The pencil (Edit) and trash (Trash2) buttons on modules and contents in `builder.tsx` have **no handlers**: rename, delete and edit exist only as server routes (`updateModule`, `deleteModule`, `updateContent`, `deleteContent`), not in the UI. The roadmap criterion "existing add / rename / delete flows still work" is therefore only true for *add*; rename, delete and edit must be built.
- `reorderModules` and `reorderContents` only renumber `order` **within** the same course / module (`WHERE module_id = :moduleId`). They cannot move a content to another section nor re-parent a module: a new or extended endpoint is required for BUILD-02 and for changing a section's parent.
- `deleteModule` deletes any module without checking that it is empty.
- Modules are nested (`CourseModule.parentId`, children rendered recursively). `updateModuleValidator` already accepts `parentId`, without a cycle check. `@dnd-kit` is not installed.
- The type selector already offers page, video, file, link, assignment and quiz; type-specific content forms belong to phases 6 to 9.

</domain>

<decisions>
## Implementation Decisions

### Moving sections and contents (area discussed)
- **D-01:** A section can be dragged to **change its parent** by dropping it into another section (not only reordered among siblings). This needs a validated endpoint with **cycle protection** (a section can never be dropped into itself or one of its descendants; `wouldCreateCycle` from `app/helpers/category_tree.ts` was built for this and is reusable) and a recomputation of the order of the affected siblings, in one transaction.
- **D-02 (REVISED 2026-10-28 after research, replaces "3 levels"):** **Maximum nesting depth is 2 levels** (section > sub-section). Research found that the builder, the learner player and outline, the progress summary and the course page only load and render two levels, so a third level would make content invisible to learners. The user chose "Limiter à 2 niveaux (Recommandé)" over extending those five places. A drop that would exceed the limit (counting the height of the moved section's own sub-tree) is refused by the server and prevented in the UI; the "Sous-section" action no longer offers a third level. `createModule`/`updateModule` must enforce the same limit; the planner decides what to do with existing data already deeper than 2 (research assumption A3: leave as is). Raising the limit later means extending those five views.
- **D-10:** The user allows a **one-line change in `tests/bootstrap.ts`** so that the browser-test base URL follows the `PORT` variable (default unchanged, so CI is unaffected). This lets the axe and keyboard-drag browser tests run locally on a free port while the dev server holds 3333.
- **D-03:** A content item can be dropped on **any section, including an empty or collapsed one**; a collapsed section expands after a short hover delay. The content goes to the hovered position or at the end of the list. Moving a content between sections renumbers source and destination in one transaction, scoped to the course and authorized with `CoursePolicy.edit` (no cross-course ids; same IDOR discipline as plan 02-10).
- Drag handle only (the existing `GripVertical` icons become real handles); the whole card is not draggable so that clicks, inputs and buttons keep working.

### Inline editing and deletion (area discussed)
- **D-04:** **Title is edited in place** (click the title or the pencil: text field, Enter saves, Escape cancels). Description, published/hidden and availability dates open in an **expandable panel under the item** (BUILD-08 allows "modal or expandable form"). The existing creation dialog stays for *adding* sections and contents. Type-specific fields (page body, file, URL) are out of scope until phases 6 to 9.
- **D-05:** **Only an empty section can be deleted** (BUILD-06): no contents and no sub-sections. The delete button is disabled with an explanation ("Déplacez ou supprimez d'abord son contenu"), and **the server also refuses** to delete a non-empty section. A confirmation dialog is shown (`AlertDialog`), including for empty sections. Deleting a content item (BUILD-09) also asks for confirmation.
- **D-06:** The user asked for deletion to go through a **trash with soft delete** (see Deferred Ideas). Until that dedicated phase exists, phase 5 does not allow deleting non-empty sections, so nothing of value is lost.

### Keyboard, touch and accessibility (area discussed)
- **D-07:** Provide **both**: the dnd-kit keyboard sensor (Space to pick up, arrows to move, Space to drop, Escape to cancel) with **French screen-reader announcements** (`aria-live`), **and** a per-item **"Déplacer vers…" menu** that picks the destination section from a list (also covers changing parent and long moves). The menu is the single-pointer alternative required by WCAG 2.2 criterion 2.5.7 (Dragging Movements) and a fallback for assistive tech and voice control.
- **D-08:** **Touch is supported through the drag handle** (touch sensor on the handle without blocking page scroll elsewhere); the "Déplacer vers…" menu is the reliable fallback on small screens.
- Success criterion 6 of the roadmap (keyboard-accessible equivalents) is met by D-07; the axe-core tests in `tests/browser/accessibility.spec.ts` must cover the builder page.

### Editing conflicts (decided in the presence discussion)
- **D-09:** Real-time presence ("who is editing where") is **deferred** (see Deferred Ideas). In this phase, saving an element that **another user changed since it was loaded must not silently overwrite their work**: detect it (e.g. compare `updatedAt` on update/move/reorder) and show a clear message ("Cet élément a été modifié par un autre enseignant"), without losing the user's input. The planner decides the exact mechanism.

### Bulk selection and bulk actions (product decision 2026-10-31, vault design notes 08/09, arbitrage E5)
- **D-11:** Bulk selection and bulk actions are part of the builder **from day one** (BUILD-11..16), not a later add-on: about 2-3 days if designed into the list rendering now, 5+ days if retrofitted after dnd-kit and inline editing ship (precedents: Moodle 4.2 bulk editing, Blackboard Ultra Batch Edit, Brightspace Manage Dates). Selection: checkboxes on rows, select all/none, quick selections (published, unpublished, by content type), selection count announced via `aria-live`. Actions: publish/unpublish, set availability window, date shift (by N days or "old start → new start", preserving relative spacing, applied to module/content `available_from`/`available_until` and content `due_date`, null dates preserved, computed in TypeScript with Luxon, never in SQL), move to another section, duplicate, delete (confirmation required). Every bulk action: one DB transaction, VineJS-validated payload, Lucid only (no raw SQL: CI runs PostgreSQL, MySQL and SQLite), `CoursePolicy` `edit` authorization, one `audit_logs` entry listing the affected ids and the action. Selection and the bulk action bar are keyboard-operable and pass axe; checkboxes and drag handles do not conflict (handle-only activation).
- **D-12:** Reuse ("edit once, propagate everywhere", deploy to N courses, template × cohorts) is **deferred to v2** (BUILD-V2-05..08). The only hook taken now: duplicated modules and contents record their origin in a nullable `copied_from_id` (FK, ON DELETE SET NULL). No UI, no sync, nothing else.

### Claude's Discretion
- **Autosave and save indicator (BUILD-10)** was not discussed; the planner decides, within these guardrails: each action saves immediately (drop, Enter or blur on a field), a visible and accessible indicator ("Enregistrement…" / "Enregistré" / "Erreur", announced through an `aria-live` region), on failure the UI returns to the previous state and offers a "Réessayer" button; requests are serialized or debounced so drags and edits cannot race; optimistic UI with rollback is welcome.
- Library choice and version: `@dnd-kit` (core, sortable, utilities) is the roadmap's intent; the researcher must verify the current packages, React 19 compatibility and the keyboard/touch sensors before the planner commits. Nested-list drag (cross-container, collapse on drag) is the hard part to research.
- Whether to keep Inertia `router` calls or use `fetch` for the autosave requests (the learner heartbeat used `fetch` in phase 4 to avoid Inertia visits); keep flash messages consistent.
- Visual treatment, spacing, and the exact French copy follow the existing builder and shadcn components.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` — Phase 5 goal, scope note, 6 success criteria, plans 05-01..05-03
- `.planning/REQUIREMENTS.md` — BUILD-01..10 and the BUILD-V2 list (undo/redo, keyboard shortcuts are V2; do not build them)
- `.planning/PROJECT.md` — course builder and content-type context

### Existing builder and backend
- `inertia/pages/courses/builder.tsx` — the page to replace (454 lines; dialogs, recursive `renderModule`, decorative Edit/Trash2 buttons)
- `app/controllers/course_contents_controller.ts` — `builder`, `createModule`, `updateModule`, `deleteModule`, `reorderModules`, `createContent`, `updateContent`, `deleteContent`, `reorderContents`
- `app/validators/course_content.ts` — `createModuleValidator`, `updateModuleValidator` (accepts `parentId`), `reorderModulesValidator`, `reorderContentsValidator`
- `start/routes.ts` — builder route group (`/courses/:id/builder`, `/modules/:moduleId`, `/modules/:moduleId/contents/reorder`, `/courses/:id/modules/reorder`)
- `app/models/course_module.ts` (`parentId`, `children`, ancestor walk that fails closed on cycles) and `app/models/course_content.ts`
- `app/policies/course_policy.ts` — `edit` is the authorization for every builder action
- `app/helpers/category_tree.ts` — `wouldCreateCycle` (written in plan 02-06, reusable for module parents)

### Conventions and tests
- `CLAUDE.md` — conventions (bun, conventional single-line commits, no AI trailer, a11y with jsx-a11y, authorization in `app/policies/`)
- `tests/functional/authorization_contents.spec.ts` — IDOR and policy test patterns for the contents controller
- `tests/functional/helpers/factories.ts` — shared factories; `.withCsrfToken()` and `.withInertia()` patterns
- `tests/browser/accessibility.spec.ts` — axe-core suite to extend with the builder page
- `.planning/phases/02-security-correctness-hardening/02-10-SUMMARY.md` — how the contents controller was scoped and what the learner outline relies on
- `.planning/phases/04-content-foundation/04-01-SUMMARY.md` — content foundation the builder builds upon

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- shadcn `Dialog`, `AlertDialog`, `DropdownMenu`, `Select`, `Button`, `Card`, `Badge` already in `inertia/components/ui/` for the confirmation, the "Déplacer vers…" menu and the expandable panel.
- `GripVertical` icons already rendered on modules and contents (currently `cursor-move` with no drag behaviour): turn them into real handles.
- `wouldCreateCycle` helper for the re-parenting rule.
- Phase 2 test infrastructure (functional factories, `.withCsrfToken()`, unique `PORT`/`DB_FILENAME`, Node 22 for `node ace`).

### Established Patterns
- Controllers authorize with `bouncer.with('CoursePolicy').authorize('edit', course)` and validate with VineJS; ids outside the course are ignored or refused (IDOR discipline).
- Reorder updates run in `db.transaction`.
- Authorization never inline in controllers (`bun run check:debt`).
- Flash messages and `redirect().back()` after mutations today; autosave may need JSON responses instead.

### Integration Points
- `builder.tsx` receives `course`, `modules` (nested with `children` and `contents`), `auth`, `appSettings`, `menus` from `CourseContentsController.builder`.
- The learner outline and the learn page read the same modules and contents: moving or re-parenting must keep their availability rules (`isEffectivelyAvailable` walks ancestors) coherent.
- `package.json`: add the dnd-kit packages with `bun add`.

</code_context>

<specifics>
## Specific Ideas

- The user wants deletion to be recoverable rather than immediate: a trash reachable from the course and from course editing, with a confirmation when deleting.
- The user raised Figma/Microsoft-style presence: seeing that another teacher is working in the same course and where.

</specifics>

<deferred>
## Deferred Ideas

- **Trash / soft delete (dedicated phase right after phase 5):** deleting a section or content moves it to a **trash** (`deleted_at`, per the database conventions in CLAUDE.md) instead of removing it, with a confirmation that counts what will be affected. The trash is reachable from the course and from course editing, supports restore, and is **emptied after 30 days by default, with the retention configurable in the platform administration settings**. It makes deleting non-empty sections safe, so it lifts the "empty section only" rule of D-05. It touches the course list, the learner outline and progress queries, so it needs its own phase. A phase should be added to the roadmap.
- **Real-time presence in the builder** ("Marie edits this section", like Figma or a spreadsheet cell being edited): needs a presence signal (periodic polling or server-sent events such as `@adonisjs/transmit`) and a shared state across several Infomaniak instances. Not in this phase; D-09 only prevents silent overwrites. Full co-editing (cursors, live merging, CRDT) is a separate technology and out of reach for now.
- **Undo/redo and keyboard shortcuts** are already BUILD-V2-01 and BUILD-V2-02.
- **Bulk group restriction, deploy to N courses, template × cohorts, upstream links for shared items** are BUILD-V2-05..08 (D-12: only `copied_from_id` now).
- **Student search, grade entry and similar items** belong to other phases (see phase 3 context).

### Reviewed Todos (not folded)
- `2026-10-20-course-creation-requests-with-save-and-publish-buttons` — matched on keywords (course, save, controller, inertia, score 0.6) but concerns the course creation page and a platform setting, not the content builder. The user chose to keep it separate.

</deferred>

---

*Phase: 05-builder-ui*
*Context gathered: 2026-10-28*
