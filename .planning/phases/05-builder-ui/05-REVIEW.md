---
phase: 05-builder-ui
reviewed: 2026-11-03T12:56:09Z
depth: deep
files_reviewed: 27
files_reviewed_list:
  - app/controllers/course_bulk_actions_controller.ts
  - app/controllers/course_contents_controller.ts
  - app/helpers/builder_props.ts
  - app/helpers/category_tree.ts
  - app/helpers/date_shift.ts
  - app/models/course_content.ts
  - app/models/course_module.ts
  - app/services/course_structure_service.ts
  - app/validators/course_bulk.ts
  - app/validators/course_content.ts
  - database/migrations/1793500000000_add_copied_from_id_to_course_structure.ts
  - inertia/app/ssr.tsx
  - inertia/components/builder/builder-row.tsx
  - inertia/components/builder/bulk-action-bar.tsx
  - inertia/components/builder/details-panel.tsx
  - inertia/components/builder/inline-title.tsx
  - inertia/components/builder/item-actions-menu.tsx
  - inertia/components/builder/learner-impact.tsx
  - inertia/components/builder/move-target-list.tsx
  - inertia/components/builder/save-status.tsx
  - inertia/components/ui/button.tsx
  - inertia/components/ui/dropdown-menu.tsx
  - inertia/components/ui/select.tsx
  - inertia/lib/builder_save_queue.ts
  - inertia/lib/builder_tree.ts
  - inertia/lib/save_queue.ts
  - inertia/pages/courses/builder.tsx
findings:
  critical: 2
  warning: 5
  info: 4
  total: 11
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-11-03T12:56:09Z
**Depth:** deep
**Files Reviewed:** 27 source files. Also checked: `start/routes.ts`; skimmed: the `show.tsx` diff, and the `tests/bootstrap.ts` and `tests/functional/csrf.spec.ts` diffs. The other test files were in scope but only skimmed for reliability.
**Status:** issues_found

## Summary

Scope: `git diff d8bb4fb..HEAD -- app inertia start database tests`.

**What holds up on the server side**
- Every mutating builder route (moves, updates, deletes, the six bulk actions, delete-impact) authorizes `CoursePolicy.edit` before any write. `createModule` and `createContent` validate first, because the course comes from the payload. Every id is scoped to the course.
- Cycle and depth checks run before the first write, under the course-row lock.
- Bulk refusals roll back.
- Count types are normalised.
- Pivot inserts are chunked.
- On SQLite, the `copied_from_id` migration avoids the cascade trap of a table rebuild.
- `inertia/lib/builder_tree.ts` is compiled into `build/`, so the runtime import from the controller is safe.
- No `dangerouslySetInnerHTML` was introduced. All titles render as React text.

**What I did not report**
- Accepted decisions: `BULK_DELETE_ALLOWS_FULL_SUBTREE`, `COPIES_START_AS_DRAFT`, `SHIFT_ASSIGNMENTS_TABLE`, permanent deletes, progress cascade.
- Documented limitations: the same-second token, the update check-then-save outside the lock, SQLite `forUpdate`.
- Lines that existed before this phase: `dueDate` cannot be cleared, the reorder endpoints.

**Where the defects are:** mostly on the client.
- The details panel keeps stale values and sends both dates every time. A teacher can overwrite a colleague's change with a valid token, so D-09 is bypassed.
- Date-only end dates take effect at 00:00, which cuts the last day.
- The optimistic rollback and merge logic can leave the UI out of step with the database.

## Critical Issues

### CR-01: An open details panel overwrites a colleague's dates with a fresh token (D-09 bypass)

**File:** `inertia/components/builder/details-panel.tsx:33-63`. Related: `inertia/pages/courses/builder.tsx:180-195, 305`.

**Issue:**
- `DetailsPanel` seeds `description`, `isPublished`, `from` and `until` from `values` once, on mount. It never re-reads them.
- `commitDates` always sends **both** `availableFrom` and `availableUntil`, even when only one changed.
- The page refreshes tokens in three ways, and none of them remounts an open panel:
  - "Recharger" (`router.reload`, line 217)
  - a creation post with `preserveState: true` (lines 494-513) followed by the props re-sync
  - a conflict on a rename, which patches in the fresh `updatedAt`
- So the next date edit sends the panel's stale value for the other date, with a token the server accepts.

**Failure scenario:**
1. Teacher A opens "Détails" on content X. The panel shows until = 15/11.
2. Teacher B sets X's end date to 30/11.
3. A adds a module, which re-syncs props. X's token is now fresh, and the panel is still mounted with 15/11.
4. A changes the start date. `PUT /contents/X` sends `{ availableFrom: <new>, availableUntil: '…-11-15', updatedAt: <fresh> }`. The response is 200.

B's end date is silently reverted. That is exactly what D-09 forbids. The same thing happens with A's own changes: a bulk "Disponibilité…" that A applied to X is undone by the next date edit in a panel that was already open. The `isPublished` switch also keeps showing a rolled-back value after a failed save.

**Fix:** send only the field that changed, and re-seed fields the teacher has not touched when the props change.
```tsx
// details-panel.tsx
const commitDate = (field: 'availableFrom' | 'availableUntil', value: string) => {
  const key = field === 'availableFrom' ? 'from' : 'until'
  if (value === sent.current[key]) return
  sent.current[key] = value
  onSave({ [field]: orNull(value) }) // server merges with the stored value for the order check
}
// and re-seed untouched fields when the props change
useEffect(() => { if (!dirty.from) { setFrom(toDateInput(values.availableFrom)); sent.current.from = toDateInput(values.availableFrom) } }, [values.availableFrom])
// same for until / description / isPublished
```
The client-side order check can then compare against `values.*` for the other bound. The server already does this (`availability()` in `course_contents_controller.ts:46-57`).

### CR-02: "Disponible jusqu'au D" closes at 00:00 on D, and a one-day window is never open

**File:** `inertia/components/builder/details-panel.tsx:53, 62`; `inertia/components/builder/bulk-action-bar.tsx:179-183`; `app/controllers/course_contents_controller.ts:56`; `app/controllers/course_bulk_actions_controller.ts:310-316`.

**Issue:**
- Both new date UIs send `yyyy-MM-dd`.
- `vine.date()` parses that as server-local midnight, and it is stored as `D 00:00`.
- `isAvailable()` (`course_content.ts:129`, `course_module.ts:83`) hides an item once `availableUntil < now`. The end date is therefore exclusive: the item disappears at the **start** of the day the teacher typed.
- Every layer refuses only `from > until` and allows `from == until`. A window "du 10/11 au 10/11" is stored as `[10/11 00:00, 10/11 00:00]`, so it is never open.
- The panel shows a stored datetime as its date only (`toDateInput`, line 25). Because both dates are always re-sent (CR-01), a stored end time such as `23:59` is truncated to `00:00` whenever the start date is edited.
- The timezone is the server's, not the teacher's. A server on UTC opens "à partir du 10/11" at 01:00 Paris time.

**Failure scenario:**
1. A teacher sets an assignment brief "disponible du 10/11 au 10/11" for an in-class session.
2. Learners never see it, and the builder shows no warning.
3. With "jusqu'au 14/11", learners lose access on the morning of the 14th.

**Fix:** treat a date-only end bound as inclusive, at the end of that day. The simplest way is to send `YYYY-MM-DD 23:59:59` from both client UIs. On the server, only adjust values whose time is exactly midnight, so explicit `YYYY-MM-DD HH:mm:ss` values (which vine accepts) stay intact:
```ts
const inclusiveEnd = (d: Date) => {
  const dt = DateTime.fromJSDate(d)
  return dt.equals(dt.startOf('day')) ? dt.endOf('day') : dt
}
``` In either case, keep the `start > end` refusal: with an inclusive end, `from == until` becomes a valid one-day window. If datetimes with a time part are stored, show the time in the panel or preserve it, so editing the other bound does not truncate it.

## Warnings

### WR-01: A failed op's rollback wipes server results of earlier ops (copies and shifted dates vanish from the UI)

**File:** `inertia/pages/courses/builder.tsx:252-268` (single ops) and `380-421` (bulk ops)

**Issue:**
- Each op takes `snapshot` in `apply()`, at enqueue time.
- "Dupliquer" and "Décaler les dates" have no optimistic step. Their effect reaches local state only when their `run()` merges the server response.
- Suppose another op is enqueued while one of these is in flight, and then fails. Its rollback restores a snapshot from before the duplicate or shift landed.
- `withCurrentTokens` only refreshes tokens on rows that are in the snapshot. It does not re-add rows and does not keep the new dates.

**Failure scenario:**
1. Teacher clicks "Dupliquer" on three items.
2. While the request is in flight, the teacher renames another item. Someone else had edited it, so the rename gets a 409.
3. The rollback removes the three copies from the builder, but they exist in the database.
4. The teacher duplicates again and gets six copies. With a shift instead of a duplicate, the shifted dates revert on screen while the database has them shifted.

**Fix:** make each rollback undo only its own mutation. One way is to record the pre-mutation values of the touched rows in `apply()` and restore only those fields in `rollback()`. The bluntest fix is to call `router.reload({ only: ['sections', 'contents'] })` once the queue is idle after any failure, and let the re-sync effect apply server truth. Do not use the existing `reload()` helper here: it calls `queue.dismiss()`, which would drop the retry list.

### WR-02: A bulk response puts back the old position of a row the teacher moved after enqueueing it

**File:** `inertia/lib/builder_tree.ts:675-681`; `inertia/pages/courses/builder.tsx:259-262`

**Issue:**
- `mergeRows` replaces every `affected` row with the server row and keeps only the local `title` and `description`.
- If a single move, publish toggle or date edit of that row was queued after the bulk op and already applied optimistically, the bulk response overwrites it with the pre-edit server state.
- The later op's `run()` patches only `updatedAt` (`builder.tsx:261`), so local state is never corrected.
- 05-10 documents this for `isPublished` and dates. It says the value is wrong "until that later op saves", but in fact it stays wrong until a reload. It does not mention moves.

**Failure scenario:**
1. Select content A, then "Publier".
2. Immediately drag A from section S to section T.
3. The publish response puts A back under S on screen. The move then succeeds, so the database has A in T.
4. The teacher sees A in S. The next "Monter/Descendre" or drag is computed from the wrong list, and the server places A somewhere the teacher did not intend.

**Fix:** in `mergeBulkResult`, keep a row's local optimistic fields when a later queued op touches that row. For example, pass the set of row keys with pending ops and keep the local row for them, taking only `updatedAt` from the server. Alternatively, have single-op `run()` merge the server's authoritative row (return `serializeAttributes()` on 200) instead of only the token.

### WR-03: "Réessayer" after a lost response duplicates a second time, because duplicate is not token-protected

**File:** `app/controllers/course_bulk_actions_controller.ts:431-495, 610-626`; `inertia/lib/save_queue.ts:94-100`

**Issue:**
- Moves, renames and publishes bump the item's `updated_at`, so replaying them gives a 409.
- `duplicate` never modifies the originals: renumbering goes through the query builder, which does not bump `updated_at`. Their tokens stay valid.
- If the server commits but the client gets an error, "Réessayer" replays the request, and it succeeds again. The client can get an error after a commit in two ways:
  - a network drop gives `Connexion perdue.`
  - `AuditService.logFromContext` runs after the commit (line 621) and throws, which gives a 500. The commit has happened, the client rolls back, and there is no audit row for that commit.

**Failure scenario:** a flaky connection on "Dupliquer" (a section with 40 contents). The teacher clicks "Réessayer" and gets 82 new rows instead of 41.

**Fix:** in `duplicate`, bump the originals' `updated_at` (set `original.updatedAt = DateTime.now()` and `save()` with the trx; a plain `save()` without changes is a no-op), so a replay gives a 409. Alternatively, accept a client-generated idempotency key per op. Write the audit row inside the transaction with `{ client: trx }`, so "committed" and "audited" cannot diverge.

### WR-04: Section membership and nesting level are only visual (WCAG 1.3.1)

**File:** `inertia/components/builder/builder-row.tsx:88-96`; `inertia/pages/courses/builder.tsx:794-798`

**Issue:**
- The outline is one flat `<ul>`. Depth and parent are expressed only through `paddingLeft`.
- A screen-reader user moving through the list hears "Renommer le contenu « Quiz 1 »" with no clue which section, or which level, it belongs to.
- Drag announcements do say where an item lands (`builder.tsx:607-633`). The gap is browsing the list afterwards: no row's name says its section or level.
- axe does not detect this, so the a11y spec stays green.

**Fix:** expose the hierarchy in each row's accessible name or description. For example, add a visually hidden `<span className="sr-only">dans « {parentTitle} », niveau {depth + 1}</span>`, or put `aria-describedby` on the row pointing to it. Alternatively, render nested `<ul>`s, or `role="tree"`/`treeitem` with `aria-level`. Nested lists conflict with the single dnd-kit sortable list, so the sr-only text is the cheaper option.

### WR-05: The props re-sync can apply server props computed before an in-flight op committed

**File:** `inertia/pages/courses/builder.tsx:180-195`

**Issue:**
- A creation post (not queued) and a queued move can run at the same time.
- The redirect GET that builds the new `sections`/`contents` props can read the database before the move commits.
- The effect only waits for `queue.pending === 0`, then applies those props wholesale. The moved item jumps back to its old place with its old `updatedAt`.

**Failure scenario:**
1. With two saves still queued, drag content A to another section (the move is third in the queue).
2. Submit "Nouveau module" right away. Its redirect GET can read the database before the move has even been sent.
3. The new module appears, but A is shown back in its old section.
4. The teacher's next move of A gets a false 409, "Cet élément a été modifié par un autre enseignant".

**Fix:** if any op completed between the start of the visit and the arrival of the props, drop those props and issue one more `router.reload({ only: ['sections', 'contents'] })` once the queue is idle. Alternatively, route creations through the save queue so they are serialised with the other writes.

## Info

### IN-01: "Réessayer" is offered for errors where a retry cannot succeed

**File:** `inertia/components/builder/save-status.tsx:40-50`

**Issue:** for `forbidden` (403), `validation` (422, e.g. a depth or destination refusal) and `session`, the retry button replays the same request to the same refusal.

**Fix:** show "Réessayer" only for `kind === 'error'` and `conflict`. For the others, offer "Annuler" (`dismiss`) or "Recharger".

### IN-02: The learner-impact count includes staff who used "Aperçu"

**File:** `app/controllers/course_bulk_actions_controller.ts:568-582`

**Issue:**
- `CoursePolicy.learn` admits `edit` holders.
- `learn()` calls `ContentProgress.getOrCreate` + `markAsStarted` for anyone who opens it, including teachers using the builder's "Aperçu" link.
- `deleteImpact` counts every distinct `user_id`, so the dialog shows teachers as "apprenants concernés".

**Fix:** restrict the count to enrolled users, for example by joining `course_enrollments` on `course_id`. Alternatively, stop `learn()` from writing progress for users whose access comes from `edit`.

### IN-03: The leave guard ignores rolled-back, unsaved ops

**File:** `inertia/lib/builder_save_queue.ts:110-133`

**Issue:**
- The guard is active only while `pending > 0`.
- After a failure, the failed ops are kept for "Réessayer" (`failedCount > 0`), but navigation and unload no longer prompt.
- The teacher can leave and lose the edits that were kept for retry.

**Fix:** use `const busy = state.pending > 0 || state.failedCount > 0`.

### IN-04: `Button asChild` silently drops `disabled`, `loading`, `leftIcon` and `rightIcon`

**File:** `inertia/components/ui/button.tsx:74-78`

**Issue:**
- The `Slot` branch takes the props after `disabled`, `loading` and the icons have been destructured out, so they never reach the child.
- `<Button asChild disabled><Link/></Button>` would therefore render an active link. There is no such usage today.

**Fix:** pass `aria-disabled={disabled || loading}` and `data-disabled` to the `Slot`. Alternatively, make the type refuse `loading`/icons together with `asChild`.

---

_Reviewed: 2026-11-03T12:56:09Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
