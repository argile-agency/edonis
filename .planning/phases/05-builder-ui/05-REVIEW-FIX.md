---
phase: 05-builder-ui
fixed_at: 2026-11-03T14:51:00Z
review_path: .planning/phases/05-builder-ui/05-REVIEW.md
iteration: 1
fix_scope: critical_warning
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-11-03T14:51:00Z
**Source review:** .planning/phases/05-builder-ui/05-REVIEW.md
**Iteration:** 1
**Scope:** CR-01, CR-02, WR-01 to WR-05. The user chose this on 2026-11-03 (« Corriger critiques + avert. »). IN-01 to IN-04 are left open on purpose.

**Summary:**
- In scope: 7 findings.
- Fixed: 7, all re-checked against the code first. None turned out wrong.
- Skipped: 0.
- Gate: `node ace test unit functional` passed 349 of 349 (SQLite). `bun run typecheck`, `bun run lint` and `bun run check:debt` all returned 0.
- Browser specs were not run, because the Playwright headless shell is missing locally.
- Based on main at 9e0839a. Main has since gained fc73d82 (docs only). It was not merged here.

## Fixed Issues

### CR-01: An open details panel overwrites a colleague's dates with a fresh token

**Status:** fixed: requires human verification (client state logic)
**Files modified:**
- `inertia/components/builder/details-panel.tsx`
- `inertia/lib/builder_tree.ts`
- `tests/unit/builder_tree.spec.ts`
- `tests/functional/builder_moves.spec.ts`

**Commits:** 99e13c7, plus the follow-up 700c2a5

**Applied fix:**
- The panel now sends only the date bounds that changed since the last send or seed. This is the new `datePatch()` in `builder_tree.ts`.
- A bound held back by the order check is sent once the order is fixed.
- Fields are re-seeded from `values` whenever the props change, except a typed field that is unsaved, held back, or showing a save error: that one keeps its local value (D-09).
- Follow-up 700c2a5: once its save succeeded, a typed field follows `values` again. Before this, a colleague's later change to that field stayed hidden while the panel was open.
- Known limit: a field the teacher edits is sent with the token of the moment. If a colleague changed that same field and the token was refreshed meanwhile (reload, re-sync), the teacher's edit wins. This is ordinary last-write for a field edited on purpose.
- The "Publié" switch is now controlled by `values.isPublished`, so a rollback shows on screen.
- The server already merged a partial PUT with the stored bound.

**Tests:**
- Unit, `datePatch`: only the changed bound is sent; a held-back bound is sent once fixed; a same-day window is accepted.
- Functional: `availableFrom` sent alone keeps the stored `availableUntil`, and is checked against it (422).

### CR-02: "Disponible jusqu'au D" closes at 00:00 on D

**Status:** fixed
**Files modified:**
- `app/helpers/date_shift.ts`
- `app/controllers/course_contents_controller.ts`
- `app/controllers/course_bulk_actions_controller.ts`
- `tests/unit/date_shift.spec.ts`
- `tests/functional/builder_moves.spec.ts`
- `tests/functional/builder_bulk.spec.ts`

**Commit:** e298955

**Applied fix:**
- New `inclusiveEnd()`: an end bound at exactly local midnight is stored as `23:59:59` of that day.
- Milliseconds are zeroed, because MySQL `TIMESTAMP(0)` would round `.999` up to the next day.
- Any other time is kept as sent.
- It is applied in every writer of `availableUntil`: create module, create content, `availability()` (single update of module and content) and bulk availability. In bulk availability it runs before the order check and before `sameInstant`.
- `from == until` is now an open one-day window. The `start > end` refusal is unchanged, both on the client (string compare that allows equality) and on the server.

**Readers checked:**
- `isAvailable()` on `course_module` and `course_content` is the only learner-side reader. It needs no change, because stored values are now inclusive.
- The builder props serialise with `toISO()`. The panel shows `slice(0, 10)`, which is still the same day.
- Bulk shift keeps the wall-clock time, so `23:59:59` stays `23:59:59`.
- Behaviour should be the same on PostgreSQL, MySQL and SQLite by construction: whole-second values, and no SQL date functions. Only SQLite was run locally; the CI matrix covers PostgreSQL and MySQL.
- No Luxon `Settings.defaultZone` override exists in `app`, `config` or `start`, so VineJS and Luxon agree on the local midnight.

**Tests:**
- Unit: `inclusiveEnd`, for a date-only value and for a value with a time.
- Functional, single PUT: a date-only end is stored as `23:59:59`, and `isAvailable()` is true for a today-to-today window. An explicit `14:30:00` is kept.
- Functional, bulk availability: a today-to-today window is stored as `23:59:59` and is available.

**Not done, for a human to decide:**
- **Data migration:** rows saved before this fix with a `00:00:00` end stay exclusive. I did not rewrite stored rows. If needed, a one-off migration could set `available_until` to `23:59:59` where its time is `00:00:00`.
- An explicit `HH:mm = 00:00` end can no longer be told apart from a date-only end. Both now mean the whole day.
- Day boundaries still use the server's timezone, not the teacher's. That point of the review is not addressed.

### WR-03: "Réessayer" after a lost response duplicates a second time

**Status:** fixed
**Files modified:**
- `app/controllers/course_bulk_actions_controller.ts`
- `app/services/audit_service.ts`
- `inertia/pages/courses/builder.tsx`
- `tests/functional/builder_bulk.spec.ts`

**Commit:** 1dd433f

**Applied fix:**
- `duplicate` now bumps `updated_at` on each top-level original, so replaying the request is a 409. The bumped originals come back in `affected`, through the renumbered sibling lists, with their new token.
- The bulk audit row is now written inside the transaction, through an optional `client` on `AuditService.log` and `logFromContext`. Committed and audited can no longer diverge.
- **Client:** the builder pins the item tokens of `duplicate` and `shift` on their first send, and re-sends those same tokens on "Réessayer". Without this, the WR-01 re-sync would load the bumped tokens and the replay would pass.
- Only these two actions are pinned, because they are not idempotent. Every other op still reads its token at run time.
- Side effect: after a genuine conflict on duplicate or shift, "Réessayer" keeps returning 409 until the teacher clicks "Recharger".

**Test:** functional. With backdated tokens, a duplicate is replayed:
- the replay returns 409 `E_CONFLICT`;
- each original still has exactly one copy;
- there is one audit row;
- the first response returns the original's new token.

### WR-02: A bulk response puts back the old position of a row moved after enqueueing

**Status:** fixed: requires human verification (client merge logic)
**Files modified:**
- `inertia/lib/builder_tree.ts`
- `inertia/pages/courses/builder.tsx`
- `tests/unit/builder_tree.spec.ts`

**Commit:** 135f586

**Applied fix:**
- Each bulk op records the state right after its own optimistic step, in `apply()`.
- `mergeBulkResult(local, result, known, applied)` handles each affected row field by field:
  - a field that changed locally since then belongs to a later queued op, so it is kept;
  - every other field, and always `updatedAt`, is taken from the server.
- This also covers ops with no optimistic step: the shifted dates are taken even when a rename was queued after the shift.
- Without `applied`, the old behaviour stays (keep the local title and description).

**Test:** unit.
- A publish followed by a move keeps the move (section and order) and takes the server's `isPublished` and token.
- A shift followed by a rename keeps the title and takes the shifted dates.

**Known limit:** if a later op touched a sibling that a duplicate renumbered, the sibling keeps its local `order`. The next re-sync corrects it.

### WR-05: The props re-sync can apply server props computed before an in-flight op committed

**Status:** fixed: requires human verification (Inertia/React timing)
**Files modified:** `inertia/pages/courses/builder.tsx`
**Commit:** 58ff60c

**Applied fix:**
- A counter of settled ops (saved or failed) is kept. A failed op counts too, because a lost response may still have committed.
- Every visit that returns `sections`/`contents` records the counter value at its start, in its `onSuccess`. These visits are the two creation posts, "Recharger" and the new re-sync.
- When props are about to be applied and an op settled since that visit started, the props are dropped. One plain `router.reload({ only: ['sections', 'contents'] })` is issued instead. It is not the `reload()` helper, which would dismiss the retry list.
- The fix relies on Inertia calling `onSuccess` before React re-renders the new props. That is a microtask, against React's scheduler task.
- If that order ever flips, the code falls back to the previous behaviour, applying the props as they are. It does not regress.

**Test:** none. This is page-level React and Inertia timing, and there is no component test harness. The browser specs cannot run locally.

### WR-01: A failed op's rollback wipes server results of earlier ops

**Status:** fixed: requires human verification (client state logic)
**Files modified:** `inertia/pages/courses/builder.tsx`
**Commit:** f295945

**Applied fix:**
- Both rollbacks (single and bulk) still restore their snapshot right away. They now also flag a re-sync.
- Once the queue is idle, the WR-05 effect issues one plain partial reload and applies the server state.
- The retry list is kept. Retried ops re-apply on top of the server state.
- This is the reviewer's "blunt" option.
- Copies and shifted dates may disappear for a moment and come back when the reload lands.

**Test:** none (same reason as WR-05).

### WR-04: Section membership and nesting level are only visual (WCAG 1.3.1)

**Status:** fixed (not browser- or screen-reader-verified)
**Files modified:**
- `inertia/components/builder/builder-row.tsx`
- `inertia/pages/courses/builder.tsx`

**Commit:** b07223e

**Applied fix:**
- Each row has a visually hidden `<span id="{key}-location">`. Its text is:
  - for a content: « dans la section « X » »;
  - for a root section: « section de niveau 1 »;
  - for a sub-section: « sous-section de « X », niveau 2 ».
- Contents get no level number, because "niveau 2" would be misleading for them.
- The row checkbox points to the span with `aria-describedby`.
- The drag handle's `aria-describedby` is left alone, because dnd-kit uses it for the drag instructions.

**Test:** none.
- axe cannot detect this issue.
- A browser assertion could not be run locally, so none was added rather than leaving an unverified spec.

## Not addressed (out of scope by user choice)

IN-01, IN-02, IN-03, IN-04.

---

_Fixed: 2026-11-03T14:51:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
