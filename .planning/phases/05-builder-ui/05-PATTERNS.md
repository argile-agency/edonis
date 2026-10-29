# Phase 5: Builder UI - Pattern Map

**Mapped:** 2026-10-28
**Files analyzed:** 20 (new + modified)
**Analogs found:** 14 / 20 (6 have no codebase analog: use RESEARCH.md patterns)

---

## READ FIRST: D-02 override of RESEARCH.md numbers (2 levels, not 3)

RESEARCH.md was written when D-02 said "3 levels". CONTEXT.md D-02 was revised: **max 2 levels (section > sub-section)**. Every number below replaces the research text. Do not copy research depth numbers literally.

| Research says | Use instead |
|---------------|-------------|
| `newDepth + subtreeHeight(...) > 2` → 422 (Pattern 3 step 5) | `newDepth + subtreeHeight(...) > 1` → 422 (0-based: root = 0, sub-section = 1) |
| Client clamp `projectedDepth + subtreeHeight(active) ≤ 2` (Pattern 1) | `≤ 1` |
| `createModule`: `depthOf(parent) + 1 ≤ 2` | `depthOf(parent) + 1 ≤ 1`, i.e. refuse when the parent already has a `parentId` |
| Hide "Sous-section" at depth 2 | Hide "+ Sous-section" on **every section with `parentId !== null`** (today `builder.tsx` 193-196 renders it on children too, line 237 recurses: that is how invisible 3rd-level modules are created) |
| Copy "Profondeur maximale : 3 niveaux" | "Profondeur maximale : 2 niveaux" |
| Summary #1, Pitfall 2, Open Question 3: make `learn` / `outline` / `getCourseProgress` / `CoursesController.show` load 3 levels | **Obsolete. Do not plan it.** These stay unchanged, 2-level by design (`course_contents_controller.ts` 59-194, 496-533). |
| "Move" dialog: a Dialog beats nested submenus "for 3 levels" | Still a Dialog; list is at most 2 levels deep |
| Existing data deeper than 3 | Existing data deeper than 2 levels stays as is (A3); builder flat load shows it at its real depth; moves that keep it too deep are refused |

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/controllers/course_contents_controller.ts` (modify: `moveModule`, `moveContent`, JSON negotiation on update/delete, non-empty delete refusal, depth check in `createModule`, flat `builder` props, conflict check) | controller | request-response, CRUD + transaction | `app/controllers/categories_controller.ts` (`update` 122-185, `destroy` 190-217) + same file `reorderContents` 417-439, `updateModule` 244-289 | exact (same domain: tree re-parenting) |
| `app/validators/course_content.ts` (modify: `moveModuleValidator`, `moveContentValidator`, WR-20 `.nullable()` dates, drop `parentId` from `updateModuleValidator`) | validator | transform | same file 19-31, 89-118 | exact |
| `app/helpers/category_tree.ts` (modify: add `depthOf`, `subtreeHeight`) | utility (pure) | transform | same file `wouldCreateCycle` 17-39, `recomputeSubtree` 61-99 | exact |
| `start/routes.ts` (modify: 2 move routes) | route | request-response | same file builder group 349-382 | exact |
| `inertia/pages/courses/builder.tsx` (replace) | page component | event-driven UI + request-response | itself (keep header/dialogs 244-452) | exact (rewrite in place) |
| `inertia/lib/builder_tree.ts` (new, pure: rows, projection, depth/height, positions) | utility (pure, client) | transform | `app/helpers/category_tree.ts` (pure, no imports, terminates on cycles) | role-match |
| `inertia/lib/builder_save_queue.ts` (new: `useSaveQueue`, `sendJson`, `xsrfToken`) | hook / utility | request-response (fetch JSON) | `inertia/pages/courses/learn.tsx` 75-79, 111-136 | partial (fetch + CSRF only) |
| `inertia/components/builder/builder-row.tsx` (new: sortable row + handle) | component | event-driven | `builder.tsx` 154-242 (current row markup) | partial (no dnd analog) |
| `inertia/components/builder/item-actions-menu.tsx` (new: Monter / Descendre / Déplacer vers… / Supprimer) | component | event-driven | `inertia/pages/admin/courses/index.tsx` 265-301 (DropdownMenu) + `admin/categories/index.tsx` 104-133 (AlertDialog) | role-match |
| `inertia/components/builder/save-status.tsx` (new) | component | event-driven | `inertia/components/flash-toaster.tsx` 30-34 (aria-live) | partial |
| `inertia/components/builder/inline-title.tsx` (new) | component | event-driven | none | no analog |
| Details panel (inside builder-row or own file) | component | event-driven | `builder.tsx` 322-339 (Textarea + Switch fields) | partial |
| `package.json` / `bun.lock` (add dnd-kit) | config | — | — | n/a (`bun add`) |
| `tests/functional/builder_moves.spec.ts` (new) | test (functional) | request-response | `tests/functional/authorization_contents.spec.ts` | exact |
| `tests/functional/authorization_contents.spec.ts` (modify: A8 moves to move endpoint if `parentId` dropped; 403 on new routes) | test | request-response | itself 162-198, 297-315 | exact |
| `tests/unit/category_tree.spec.ts` (modify: `depthOf`, `subtreeHeight`) | test (unit) | transform | itself 1-46 | exact |
| `tests/unit/builder_tree.spec.ts` (new) | test (unit) | transform | `tests/unit/category_tree.spec.ts` | exact (shape) |
| `tests/browser/builder.spec.ts` (new) | test (browser) | event-driven | `tests/browser/accessibility.spec.ts` 111-194 | role-match |
| `tests/browser/accessibility.spec.ts` (modify: builder case) | test (browser) | — | itself 111-140 | exact |
| `tests/bootstrap.ts` (modify line 32 only, D-10) | config | — | itself | exact |

---

## Pattern Assignments

### `app/controllers/course_contents_controller.ts` (controller, request-response + transaction)

**Imports already present** (lines 1-18): keep; add `moveModuleValidator`, `moveContentValidator` to the `#validators/course_content` import and `depthOf`, `subtreeHeight` to the helper import:
```ts
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Course from '#models/course'
import CourseModule from '#models/course_module'
import CourseContent from '#models/course_content'
...
import { wouldCreateCycle } from '../helpers/category_tree.js'
```

**Auth pattern (every write)** — load the item with its course, then authorize on the *item's* course (lines 245-250, 371-376):
```ts
const module = await CourseModule.query()
  .where('id', params.moduleId)
  .preload('course')
  .firstOrFail()

await bouncer.with('CoursePolicy').authorize('edit', module.course)
```
```ts
const content = await CourseContent.query()
  .where('id', params.contentId)
  .preload('module', (query) => query.preload('course'))
  .firstOrFail()

await bouncer.with('CoursePolicy').authorize('edit', content.module.course)
```

**Course-scoped destination + cycle check** (`updateModule` 254-273) — base for `moveModule`; add depth/height check after `wouldCreateCycle`:
```ts
if (payload.parentId !== undefined && payload.parentId !== null) {
  const parent = await CourseModule.query()
    .where('id', payload.parentId)
    .where('course_id', module.courseId)
    .first()

  const courseModules = await CourseModule.query()
    .where('course_id', module.courseId)
    .select('id', 'parent_id')
  const parentById = new Map<number, number | null>(
    courseModules.map((m) => [m.id, m.parentId])
  )

  if (!parent || wouldCreateCycle(parentById, module.id, payload.parentId)) {
    session.flash('error', PARENT_ERROR)
    return response.redirect().back()
  }
}
```
For `moveModule`, run this inside the transaction with `{ client: trx }`, build `childrenByParent` from the same rows for `subtreeHeight`, and refuse with 422 JSON when `newDepth + subtreeHeight(...) > 1` (see D-02 override).

**Re-parent in a transaction, model save + query-builder sibling updates** (`categories_controller.ts` 144-180) — closest analog for `moveModule` / `moveContent`:
```ts
await db.transaction(async (trx) => {
  ...
  category.useTransaction(trx)
  category.merge(data)
  await category.save()        // model save → autoUpdate bumps updatedAt

  for (const d of descendants) {
    await CourseCategory.query({ client: trx })   // query builder → no updated_at bump
      .where('id', d.id)
      .update({ path: d.path, depth: d.depth })
  }
})
```
Apply: moved row through the model (`item.merge({ parentId|moduleId, order }).useTransaction(trx).save()`; `course_module.ts:44` has `@column.dateTime({ autoCreate: true, autoUpdate: true })` so `updatedAt` is bumped); renumbered siblings through `CourseModule.query({ client: trx }).where('id', ..).update({ order })` (no bump, per Pitfall 3).

**Scoped sibling writes in a transaction** (`reorderContents` 427-435):
```ts
// Ids outside this module match no row and are ignored
await db.transaction(async (trx) => {
  for (const item of payload.contents) {
    await CourseContent.query({ client: trx })
      .where('id', item.id)
      .where('module_id', module.id)
      .update({ order: item.order })
  }
})
```
Do not reuse the "client sends `{id, order}`" shape for new endpoints (RESEARCH anti-pattern); keep the scoping and transaction.

**Typed error thrown inside the transaction, mapped outside** (`app/services/enrollment_service.ts` 91-134) — use this shape for the 409 conflict / 422 invalid destination so the managed transaction rolls back first (PG aborts on errors):
```ts
try {
  return await db.transaction(async (trx) => {
    if (opts.methodId) {
      const seat = await this.tryIncrementMethod(trx, opts.methodId)
      if (Number(seat) < 1) {
        throw new CapacityReachedException()
      }
    }
    ...
  })
} catch (error) {
  if (isUniqueViolation(error)) {
    throw new AlreadyEnrolledException()
  }
  throw error
}
```

**Non-empty delete refusal** (`categories_controller.ts` `destroy` 190-210):
```ts
const category = await CourseCategory.query()
  .where('id', params.id)
  .preload('children')
  .preload('courses')
  .firstOrFail()

if (category.children.length > 0) {
  session.flash('error', 'Impossible de supprimer une catégorie qui a des sous-catégories.')
  return response.redirect().back()
}
```
**Deviation required:** the analog checks before and outside any transaction. `deleteModule` must take the course-row lock inside `db.transaction`, *then* count children/contents with `{ client: trx }` (Pitfall 5: both FKs are `ON DELETE CASCADE`). Copy: "Déplacez ou supprimez d'abord son contenu" → 409 JSON, flash + back on the HTML branch.

**JSON success shape** (`updateProgress` 468-471):
```ts
return response.json({
  success: true,
  progress: progress.serialize(),
})
```
For move/update/delete use `{ item: { id, updatedAt } }` (RESEARCH Pattern 3 step 7).

**Content negotiation source** (`app/exceptions/handler.ts` 60-63, 96-98):
```ts
'403': (error, { inertia, request, response }) =>
  request.accepts(['html', 'json']) === 'json'
    ? response.forbidden({ message: error.message })
    : inertia.render('errors/forbidden', { error }),
```
```ts
const wantsJson =
  ctx.request.accepts(['html', 'json']) === 'json' && !ctx.request.header('x-inertia')
```
Apply to `updateModule`, `updateContent`, `deleteModule`, `deleteContent`: JSON branch returns JSON; otherwise keep `session.flash(...)` + `response.redirect().back()` so A2/A3/A8 tests still pass. Note handler line 64: **404 has no JSON branch** (HTML page) — client must not parse it.

**WR-20 date mapping to fix** (lines 278-283 and 383-388) — falsy → `undefined` means a date can never be cleared:
```ts
availableFrom: payload.availableFrom
  ? DateTime.fromJSDate(payload.availableFrom)
  : undefined,
```
Change to: `undefined` → `undefined` (field absent), `null` → `null`, `Date` → `DateTime.fromJSDate(...)`.

**`builder` props** (lines 30-54): replace nested preload with two flat, column-selected queries (`sections`, `contents`) per RESEARCH "Existing UI"; keep `bouncer.with('CoursePolicy').authorize('edit', course)` (line 48) and `inertia.render('courses/builder', ...)`.

**Unchanged by design (2 levels):** `learn` 59-144, `outline` 149-194, `getCourseProgress` 496-533.

---

### `app/validators/course_content.ts` (validator)

**Analog:** same file.

Style (lines 19-31):
```ts
export const updateModuleValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(255).optional(),
    description: vine.string().trim().optional(),
    ...
    availableFrom: vine.date().optional(),
    availableUntil: vine.date().optional(),
    ...
    parentId: vine.number().optional(),
  })
)
```
- New `moveModuleValidator`: `{ parentId: vine.number().nullable(), position: vine.number().min(0), updatedAt: vine.string().nullable() }`; `moveContentValidator`: `{ moduleId: vine.number(), position: vine.number().min(0), updatedAt: vine.string().nullable() }`. Positive-id style exists at line 116: `vine.number().positive().optional()`.
- WR-20: `availableFrom` / `availableUntil` at lines 25-26 and 75-76 become `.nullable().optional()`; add ordering check (`availableFrom ≤ availableUntil`).
- Add `updatedAt: vine.string().nullable().optional()` to the update validators for the D-09 conflict token.
- Line 29 `parentId`: drop (single re-parenting path through `moveModule`, RESEARCH Open Question 2). If dropped, A8 test (`authorization_contents.spec.ts` 162-198) must move to `modules.move`.

---

### `app/helpers/category_tree.ts` (pure utility) — add `depthOf`, `subtreeHeight`

**Analog:** `wouldCreateCycle` 17-39 (termination style to copy):
```ts
export function wouldCreateCycle(
  parentById: ReadonlyMap<number, number | null>,
  nodeId: number,
  newParentId: number | null
): boolean {
  const seen = new Set<number>()
  const maxSteps = parentById.size + 1
  let current: number | null = newParentId
  let steps = 0

  while (current !== null) {
    if (current === nodeId) return true
    if (seen.has(current)) return true
    seen.add(current)

    steps += 1
    if (steps > maxSteps) return true

    current = parentById.get(current) ?? null
  }

  return false
}
```
`childrenByParent` construction to copy for `subtreeHeight` (`recomputeSubtree` 67-76) and its visited-set BFS (79-96). Conventions (keep in unit test names): `depthOf(root) = 0`; `subtreeHeight(leaf section) = 0`; max allowed `depth + height` = **1**. Header comment (1-7) already states "Every helper terminates on corrupt (cyclic) input" — keep that contract.

---

### `start/routes.ts` (route)

**Analog:** builder group 349-382. Add inside the same group (inherits `middleware.auth()` + `middleware.role({ roles: ['admin','manager','teacher'] })`):
```ts
router
  .put('/modules/:moduleId', [CourseContentsController, 'updateModule'])
  .as('modules.update')
...
router
  .post('/modules/:moduleId/contents/reorder', [CourseContentsController, 'reorderContents'])
  .as('modules.contents.reorder')
})
.use(middleware.auth())
.use(middleware.role({ roles: ['admin', 'manager', 'teacher'] }))
```
New: `.post('/modules/:moduleId/move', [...,'moveModule']).as('modules.move')` and `.post('/contents/:contentId/move', [...,'moveContent']).as('contents.move')`. Leave `reorder*` routes in place (unused, tested).

---

### `inertia/pages/courses/builder.tsx` (page, replace)

**Analog:** itself.

**Keep — imports and shadcn usage** (lines 1-38): `Head, Link, router, useForm` from `@inertiajs/react`; `~/components/ui/*` imports; Lucide icons; `AppHeader` from `~/components/layout/app-header`.

**Keep — header, empty state, creation dialogs** (lines 244-452). Creation stays Inertia `useForm.post` (lines 109-127); add `preserveScroll: true`:
```ts
moduleForm.post(`/courses/${course.id}/modules`, {
  onSuccess: () => {
    setIsModuleDialogOpen(false)
    moduleForm.reset()
  },
})
```

**Keep — content type icon switch** (139-152) and "Brouillon" badge (182-186).

**Replace / dead UI:**
- 163, 215: `<GripVertical className="... cursor-move" />` → handle `<button>` (size ≥ 24px, `aria-label="Déplacer « {title} »"`, `touch-none`, `setActivatorNodeRef`).
- 166-172: collapse `<button>` without label / `aria-expanded` → labelled disclosure button.
- 193-196: "+ Sous-section" → render only when `parentId === null` (D-02).
- 198-204, 225-231: `Edit` / `Trash2` buttons with no handlers → inline title + move menu.
- 154-242: recursive `renderModule` → flat `rows.map(row => <BuilderRow key={row.key} .../>)` under one `SortableContext` (RESEARCH Pattern 1).
- Props: `auth.user: any`, `appSettings: any`, `value: any` (368) → tighten.

---

### `inertia/lib/builder_save_queue.ts` (hook/utility, fetch JSON)

**Analog:** `inertia/pages/courses/learn.tsx`.

CSRF helper (75-79) — move it here (export it) rather than writing a third copy; whether `learn.tsx` then imports it is a planner choice:
```ts
/** CSRF token from the XSRF-TOKEN cookie set by Shield, for fetch() calls */
function xsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : ''
}
```
fetch call (119-130):
```ts
fetch(`/contents/${currentContent.id}/progress`, {
  method: 'POST',
  credentials: 'same-origin',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-XSRF-TOKEN': xsrfToken(),
  },
  body: JSON.stringify({ timeSpent: 30 }),
}).catch(() => {
  // Background heartbeat: a missed beat only under-counts time spent
})
```
**Do NOT copy** the `.catch(() => {})` swallow or the unchecked response: autosave needs `redirect: 'manual'`, `res.type === 'opaqueredirect'` → session error, `res.ok && content-type includes application/json`, 409 → conflict (RESEARCH Pattern 4 + Pitfall 4). Queue logic itself: no analog (see below).

---

### `inertia/components/builder/item-actions-menu.tsx` (component)

**DropdownMenu analog:** `inertia/pages/admin/courses/index.tsx` 265-301:
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="sm">
      <MoreVertical className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuLabel>Actions</DropdownMenuLabel>
    <DropdownMenuSeparator />
    ...
    <DropdownMenuItem
      onClick={() => router.post(`/admin/courses/${course.id}/archive`)}
    >
      <Archive className="h-4 w-4 mr-2" />
      Archiver
    </DropdownMenuItem>
```
Deviations: the trigger is icon-only with no accessible name (serious axe violation) → add `aria-label="Actions pour « {title} »"`; items call the save queue, not `router.post`; add `onCloseAutoFocus` neighbour-focus after delete (Pattern 7).

**AlertDialog analog:** `inertia/pages/admin/categories/index.tsx` 104-133:
```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button size="sm" variant="outline" disabled={children.length > 0}>
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Supprimer la catégorie</AlertDialogTitle>
      <AlertDialogDescription>
        Êtes-vous sûr de vouloir supprimer "{category.name}" ? Cette action est
        irréversible.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Annuler</AlertDialogCancel>
      <AlertDialogAction
        onClick={() => handleDelete(category.id)}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        Supprimer
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```
Deviations (D-05 / Pattern 7): use `aria-disabled="true"` + `aria-describedby` → "Déplacez ou supprimez d'abord son contenu" instead of `disabled`; trigger needs an `aria-label`; content-delete copy must mention that learner progress is lost (RESEARCH Pitfall 5b note).

**"Déplacer vers…" Dialog:** reuse `Dialog` / `DialogContent` / `DialogHeader` / `DialogTitle` / `DialogDescription` / `DialogFooter` exactly as `builder.tsx` 298-352 does.

---

### `inertia/components/builder/save-status.tsx` (component)

**Analog:** `inertia/components/flash-toaster.tsx` 30-34:
```tsx
return (
  <div aria-live="polite" aria-atomic="true" className="sr-only">
    {liveMessage}
  </div>
)
```
Deviations: indicator must be **visible** (not `sr-only`), `role="status"`, texts "Enregistrement…" / "Enregistré" / "Erreur : …"; the "Réessayer" button sits **outside** the live region.

---

### Details panel (expandable form)

**Analog:** field markup in `builder.tsx` 322-339 (Label + Textarea, Switch + Label with matching `id`/`htmlFor`):
```tsx
<div className="space-y-2">
  <Label htmlFor="description">Description</Label>
  <Textarea id="description" value={...} onChange={...} rows={3} />
</div>
<div className="flex items-center space-x-2">
  <Switch id="isPublished" checked={...} onCheckedChange={...} />
  <Label htmlFor="isPublished">Publier immédiatement</Label>
</div>
```
Deviation: ids must be entity-derived (`builder-panel-c-34-description`), since many panels exist on one page; save on blur/change through the queue. Disclosure semantics (`aria-expanded`, `aria-controls`): no analog, RESEARCH Pattern 6.

---

### `tests/functional/builder_moves.spec.ts` (new) and `authorization_contents.spec.ts` (extend)

**Analog:** `tests/functional/authorization_contents.spec.ts`.

Imports + local helpers (1-51): copy `createModule` / `createContent` helpers (or promote them to `factories.ts`):
```ts
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import type Course from '#models/course'
import CourseModule from '#models/course_module'
import CourseContent from '#models/course_content'
import {
  assertNotCsrfRejected,
  createCourse,
  createUser,
  enrollUser,
} from '#tests/functional/helpers/factories'

async function createModule(
  course: Course,
  overrides: Partial<Pick<CourseModule, 'parentId' | 'order' | 'isPublished' | 'title'>> = {}
): Promise<CourseModule> {
  return CourseModule.create({ courseId: course.id, title: 'Test Module', order: 1, isPublished: true, ...overrides })
}
```
Group setup (53-54):
```ts
test.group('Course contents - authorization and scoping', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
```
Refusal loop + DB-state assertion + positive control (162-198) — the template for cycle / foreign-course / depth refusals:
```ts
for (const parentId of [moduleB.id, moduleA.id, childOfA.id]) {
  const req = client.put(url).withCsrfToken()
  const response = await req.json({ parentId }).loginAs(ownerA).redirects(0)
  response.assertStatus(302)
  assertNotCsrfRejected(assert, response)
  assert.equal(response.flashMessage('error'), PARENT_ERROR)
  const after = await CourseModule.findOrFail(moduleA.id)
  assert.isNull(after.parentId)
}
// Positive control: a sibling module of the same course is accepted.
```
JSON calls with 403 + positive control (331-348):
```ts
const deniedReq = client.post(url).withCsrfToken()
const denied = await deniedReq
  .header('accept', 'application/json')
  .json({ status: 'in_progress' })
  .loginAs(outsider)
denied.assertStatus(403)
```
Fixtures: `factories.ts` `createUser({ roles: ['teacher'] })` 52-67, `createCourse(owner)` 69-84, `grantPermission(course, user, 'edit')` 86-96 (non-owner editor case), `assertNotCsrfRejected` 159-164 (call it on every 302 assertion).

**CSRF failure case** (BUILD-10 row): `tests/functional/csrf.spec.ts` 17-37 — request without `.withCsrfToken()`, `.redirects(0)`, assert 302 + `flashMessage('errorsBag.E_BAD_CSRF_TOKEN')` defined + nothing written. Add `.header('accept','application/json')` to prove a JSON caller still gets 302 (not 200 JSON).

---

### `tests/unit/category_tree.spec.ts` (extend) and `tests/unit/builder_tree.spec.ts` (new)

**Analog:** `tests/unit/category_tree.spec.ts` 1-46:
```ts
import { test } from '@japa/runner'
import { recomputeSubtree, wouldCreateCycle } from '../../app/helpers/category_tree.js'

const tree: ReadonlyMap<number, number | null> = new Map<number, number | null>([
  [1, null],
  [2, 1],
  [3, 2],
  [4, null],
])

test.group('Category tree helpers', () => {
  test('wouldCreateCycle rejects a node as its own parent', ({ assert }) => {
    assert.isTrue(wouldCreateCycle(tree, 2, 2))
  })
  ...
  test('wouldCreateCycle terminates on a pre-existing corrupt cycle', ({ assert }) => {
    const corrupt = new Map<number, number | null>([[5, 6], [6, 5], [7, null]])
    assert.isTrue(wouldCreateCycle(corrupt, 7, 5))
  })
```
Add `depthOf` / `subtreeHeight` cases incl. a corrupt-cycle termination case, same style. Note the fixture `tree` already has depth 2 (node 3) — useful for "existing data deeper than 2" cases.

**Unverified (A7):** root `tsconfig.json` excludes `./inertia/**/*` and `adonisrc.ts` (line 87) runs `tests/unit/**/*.spec.ts` under the backend config. Whether `../../inertia/lib/builder_tree.js` imports cleanly is untested. Fallback carried from research: put the pure helper in `app/helpers/` and import it from the client by relative path, or test only via the browser suite. Make this the first task step (Wave 0).

---

### `tests/browser/builder.spec.ts` (new) and `accessibility.spec.ts` (extend)

**Analog:** `tests/browser/accessibility.spec.ts`.

Seeded-data lookup without creating users (142-159):
```ts
const student = await User.findByOrFail('email', 'student@edonis.test')
...
if (!forbiddenCourse) {
  assert.fail('No seeded course found ... Run ... (node ace db:seed) first.')
  return
}
```
Login + goto + axe (111-139):
```ts
const page = await visit('/login')
await page.locator('input[type="email"]').fill('admin@edonis.test')
await page.locator('input[type="password"]').fill('password')
await Promise.all([
  page.waitForURL('**/dashboard', { timeout: 5000 }),
  page.locator('button[type="submit"]').click(),
])
await page.goto('/courses')
await page.waitForLoadState('networkidle')
const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  .analyze()
const critical = results.violations.filter(
  (v) => v.impact === 'critical' || v.impact === 'serious'
)
assert.equal(critical.length, 0, `Found ${critical.length} critical/serious a11y violations`)
```
Do **not** use `tests/browser/grades.spec.ts` as an analog: its `group.each.setup` re-creates `student@edonis.test`, which collides with the seeded accounts the browser suite relies on. Optional: tags stop at `wcag21aa`; add `wcag22aa` to have axe check handle target size (2.5.8).

---

### `tests/bootstrap.ts` (D-10, one line)

Line 32 only:
```ts
browserClient({
  runInSuites: ['browser'],
  contextOptions: {
    baseURL: 'http://localhost:3333',   // → `http://localhost:${process.env.PORT ?? 3333}`
  },
}),
```
Nothing else in this file changes.

---

## Shared Patterns

### Authorization (all controller writes)
**Source:** `course_contents_controller.ts` 250, 300, 345, 376, 406, 423; `app/policies/course_policy.ts` 28-38 (`before`: admin passes), 65-67 (`edit` → `course.hasPermission(user.id, 'edit')`).
```ts
await bouncer.with('CoursePolicy').authorize('edit', module.course)
```
Authorize on the moved item's course; destination must be loaded with `.where('course_id', course.id)`. `bun run check:debt` (package.json line 16) fails on `hasPermission(`, `hasRole(`, `instructorId ===`, `request.only|input|all(` inside `app/controllers` — use `request.validateUsing(...)` only.

### Validation
**Source:** `request.validateUsing(validator)` everywhere (e.g. controller 202, 252, 425). VineJS style in `app/validators/course_content.ts`.

### Transactions
**Source:** `db.transaction(async (trx) => { ... })` with `Model.query({ client: trx })` (controller 319-326, 428-435; `categories_controller.ts` 144-180). Model saves inside: `item.useTransaction(trx)`.

### JSON vs HTML response
**Source:** `app/exceptions/handler.ts` 60-63, 96-98 (`request.accepts(['html','json']) === 'json'`); JSON body style `response.json({...})` (controller 468-471, 528-532). HTML branch keeps `session.flash` + `response.redirect().back()`.

### Client fetch + CSRF
**Source:** `learn.tsx` 75-79, 119-127 (`credentials: 'same-origin'`, `X-XSRF-TOKEN`). Add `redirect: 'manual'` and response checks (see save queue section).

### shadcn components / a11y
**Source:** `inertia/components/ui/{dialog,alert-dialog,dropdown-menu,switch,textarea,button}.tsx` (already exported, Radix-based). Every icon-only trigger needs `aria-label` (existing analogs lack it). Scroll lock already fixed globally (`inertia/css/app.css`), do not add workarounds.

---

## No Analog Found

| File / concern | Role | Data Flow | Reason → use |
|---|---|---|---|
| dnd-kit `DndContext` / `SortableContext` / `useSortable` (builder.tsx, builder-row.tsx) | component | event-driven | Library not installed → RESEARCH "Code Examples" + Pattern 1, 2; `id="course-builder"` for SSR (Pitfall 1) |
| `inertia/lib/builder_tree.ts` projection logic | utility | transform | No client tree logic exists → RESEARCH Pattern 1 (row kinds `s-`/`c-`, nearest-section-above rule); copy only the purity/termination style of `category_tree.ts` |
| Save queue / optimistic rollback (`useSaveQueue`) | hook | request-response | No queue anywhere → RESEARCH Pattern 4 |
| `inline-title.tsx` | component | event-driven | No inline editor exists → RESEARCH Pattern 5 |
| Disclosure panel semantics | component | event-driven | No `aria-expanded`/`aria-controls` disclosure in repo → RESEARCH Pattern 6 |
| Course-row lock `Course.query({ client: trx }).where('id', ...).forUpdate().first()` | controller | transaction | Zero `forUpdate` occurrences in `app/` → RESEARCH Pattern 3 step 2 (SQLite compiles it to nothing) |
| 409 conflict response + `updatedAt` second-precision compare | controller | request-response | No 409 anywhere in `app/` → RESEARCH Pattern 3 step 3 + Pitfall 3 (`toUnixInteger()`) |
| `depthOf` / `subtreeHeight` | utility | transform | New; copy `wouldCreateCycle` termination style (see above) |

## Metadata

**Analog search scope:** `app/controllers`, `app/validators`, `app/helpers`, `app/services`, `app/policies`, `app/exceptions`, `app/models`, `inertia/pages`, `inertia/components`, `start/routes.ts`, `tests/{unit,functional,browser}`, `tests/bootstrap.ts`, `package.json`, `tsconfig.json`, `adonisrc.ts`
**Files scanned:** ~25
**Pattern extraction date:** 2026-10-28
