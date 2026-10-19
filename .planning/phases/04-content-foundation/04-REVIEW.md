---
phase: 04-content-foundation
reviewed: 2026-10-19T12:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - app/models/content_file.ts
  - app/services/file_storage_service.ts
  - app/controllers/files_controller.ts
  - start/routes.ts
  - database/migrations/1792402903467_create_create_content_files_table.ts
  - database/migrations/1792402903468_create_create_content_content_files_table.ts
  - tests/functional/file_storage_service.spec.ts
  - tests/functional/files_download.spec.ts
findings:
  critical: 1
  warning: 6
  info: 5
  total: 12
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-10-19T12:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

I reviewed the ContentFile model, the FileStorageService (SHA-256 dedup and sharded storage), the authenticated `/files/:id/download` endpoint, both migrations and the two new functional test files. I also checked the helpers the authorization depends on: `Course.hasPermission`, `CourseContent.isAvailable`, `CourseModule.isAvailable`, `User.hasRole`, the learner player in `course_contents_controller.ts`, and AdonisJS `response.attachment`.

What holds up:
- Path containment is sound. The fast regex is backed by `resolve`/`relative`, and absolute paths are rejected.
- `Content-Disposition` is safe. `response.attachment` uses the `content-disposition` package, which quotes and RFC 5987-encodes the name and applies `basename`, so a malicious client filename cannot inject headers.
- The unique-checksum race recovery is correct for the non-transactional case.
- The migrations are portable across engines and follow the existing conventions (`increments().primary()`, timestamps).

What does not hold up:
- The learner authorization has a real gap: it ignores the parent module hierarchy.
- It also ignores course status.
- Dedup trusts the DB row even when the blob is gone, and it carries the first uploader's filename and MIME type over to every later upload.
- The storage root sits inside the app root, which is the regenerated `build/` directory in production.

## Critical Issues

### CR-01: Learners can download files in child modules whose parent module is unpublished

**File:** `app/controllers/files_controller.ts:91-93` (via `app/models/course_module.ts:69-84`)
**Issue:** `isVisibleToLearners` checks `content.isAvailable() && content.module.isAvailable()`, and `CourseModule.isAvailable()` only looks at the module's own `isPublished` and availability window. Modules are hierarchical (`course_modules.parent_id`). The learner player (`course_contents_controller.ts:61-79`) only reaches child modules through a published top-level parent, so unpublishing a parent hides the whole subtree. Nothing cascades `is_published` to the children (no such logic in `course_contents_controller.ts`).

The result: when an instructor hides a section by unpublishing its parent module (or puts the parent's `availableFrom` in the future), the children stay `is_published = true`. Any active or completed learner can then download every file in that section by ID. IDs are sequential, so enumeration is trivial. The download endpoint grants more access than the UI shows, which is an authorization bypass.
**Fix:** Walk the module ancestry and require every ancestor to be available.
```ts
// files_controller.ts
const contents = await file
  .related('contents')
  .query()
  .preload('module', (m) => m.preload('course').preload('parent'))

private async isVisibleToLearners(content: CourseContent): Promise<boolean> {
  if (!content.isAvailable()) return false
  let mod: CourseModule | null = content.module
  while (mod) {
    if (!mod.isAvailable()) return false
    mod = mod.parentId ? await CourseModule.find(mod.parentId) : null
  }
  return true
}
```
Better still, put an `isEffectivelyAvailable()` helper on `CourseModule` so the player and future content routes share the rule. Add a functional test: published child under an unpublished parent should give 403.

## Warnings

### WR-01: Course status is ignored for learners (draft courses still serve files)

**File:** `app/controllers/files_controller.ts:68-86`
**Issue:** The learner branch checks content, module and enrollment, but never `course.status`. If a course goes back to `draft` (for example, pulled for a content takedown), every learner with an `active` enrollment can still download all of its published files. The existing player has the same gap, but this endpoint is new and is meant to be the security boundary for blobs. It should not copy the weakness. Archived courses with `completed` enrollments are arguably fine, but that should be an explicit decision.
**Fix:** For the learner branch, require `course.isPublished()` (and optionally allow `course.isArchived()` only when the enrollment is `completed`):
```ts
const courseOpen = course.isPublished() || (course.isArchived() && enrollment.status === 'completed')
```
Add tests for draft and archived courses.

### WR-02: A dedup hit trusts the DB row even when the blob is missing, so the file can never be repaired

**File:** `app/services/file_storage_service.ts:45-49`
**Issue:** On a checksum match the service deletes the new upload and returns the existing record without checking that `getFullPath(existing)` exists on disk. If the blob was lost (a failed volume, a manual cleanup, the build-dir wipe in WR-03, or a crash between `file.move` and a later rollback), the row is permanently broken. Every re-upload of the same bytes is thrown away and gets the same dangling record, and downloads keep returning 404. The one action that would fix it (re-uploading) is silently discarded.
**Fix:** Check that the blob exists, and restore it from the incoming upload when it is missing:
```ts
const existing = await ContentFile.findBy('checksum', checksum)
if (existing) {
  const path = this.resolvePath(existing.storagePath)
  if (path && (await access(path).then(() => true, () => false))) {
    await unlink(file.tmpPath).catch(() => {})
    return existing
  }
  // Blob missing: move the upload into place and repair storagePath
  ... move to new shard path, existing.storagePath = newPath; await existing.save(); return existing
}
```

### WR-03: The storage root is inside the app root, which is the regenerated `build/` directory in production

**File:** `app/services/file_storage_service.ts:30`
**Issue:** `app.makePath('storage/content_files')` resolves against the application root. In production that is `build/` (see the CLAUDE.md "Production Build" section), and `node ace build` empties the output directory on every build. An in-place redeploy therefore deletes every uploaded course file while the `content_files` rows survive. Combined with WR-02, those files cannot be recovered by re-uploading. `storage/` is also not in `adonisrc.ts` `metaFiles`, so nothing marks it as persistent.
**Fix:** Make the root configurable and point it outside the build tree:
```ts
// start/env.ts
CONTENT_STORAGE_PATH: Env.schema.string.optional(),
// file_storage_service.ts
constructor(basePath: string = env.get('CONTENT_STORAGE_PATH') ?? app.makePath('storage/content_files'))
```
Document it in CLAUDE.md and the deployment docs, and require it in production.

### WR-04: Dedup returns the first uploader's filename and MIME type for every later upload

**File:** `app/services/file_storage_service.ts:45-49, 63-70`; `app/models/content_file.ts:15-23`
**Issue:** `filename` and `mimeType` live on the deduplicated `content_files` row, not on the pivot. If teacher B uploads `exam-answers-v2.pdf` with the same bytes as teacher A's `B_internal_draft.pdf` in another course, B gets A's record. B's content then downloads under A's filename. That is wrong for B, and it discloses another course's filename across course boundaries. The dedup hit itself (same id returned) is also an existence oracle for arbitrary content across courses.
**Fix:** Move per-use metadata to the pivot. Add `filename` (and optionally `mime_type`) columns to `content_content_files`, set them in `attach()`, and pass the content id to the download route so the right name is used: `/contents/:contentId/files/:fileId/download`. That route also gives a cleaner authorization scope (see IN-04).

### WR-05: The download test suite misses the authorization edges that matter

**File:** `tests/functional/files_download.spec.ts:101-225`
**Issue:** The suite covers the happy paths but none of the rules where defects actually exist:
- no unpublished module, no unpublished parent module (CR-01), and no draft or archived course (WR-01);
- no `availableFrom`/`availableUntil` windows on content or module, and no `completed`, `expired` or `pending` enrollment;
- no file linked to two courses, where only the second grants access (this exercises the loop in `canDownload`);
- the traversal test only uses `../../.env`, which the regex rejects first. The `resolvePath` containment branch, absolute paths (`/etc/passwd`, `C:\...`) and a directory path (`ab`) are never tested through HTTP.

The download tests also write into the real `storage/content_files/` tree. Because `FilesController` hardcodes `new FileStorageService()`, a crashed run leaves `test-*` shard directories in the working tree.
**Fix:** Add the cases above. Inject or configure the storage root (see WR-03) so the HTTP tests can use a temp directory.

### WR-06: The service tests do not exercise race recovery, and the fake `move()` ignores `overwrite`

**File:** `tests/functional/file_storage_service.spec.ts:35-37`
**Issue:** The `catch` branch in `store()` (unlink the blob, return the winner) is the most delicate code in the service and has no test. The fake `move()` ignores `options.overwrite`, so the "Throws on failure (including name collision, since overwrite is off)" contract in `file_storage_service.ts:59-60` is unverified. With `withGlobalTransaction` on Postgres, a unique violation would also abort the shared transaction, so the follow-up `findBy` would fail. A naive test would pass on SQLite and fail in the PG CI job.
**Fix:** Stub `ContentFile.create` to insert the winner and then throw a unique violation, and assert that the blob is removed and the winner is returned. Make the fake `move` honour `overwrite: false` (throw if the target exists). For PG, run the race test without the global transaction, or use a savepoint.

## Info

### IN-01: Over-length client metadata makes `store()` fail on PG/MySQL but not on SQLite

**File:** `app/services/file_storage_service.ts:63-68`; `database/migrations/1792402903467_create_create_content_files_table.ts:18,23`
**Issue:** `filename` is `varchar(255)` and `mime_type` is `varchar(100)`, but both values come from the client and are not truncated. A long name or MIME type raises an error on PG or strict MySQL (the upload becomes a 500), succeeds on SQLite, and is silently truncated on non-strict MySQL. Behaviour differs across engines.
**Fix:** Truncate before insert, for example `file.clientName.slice(0, 255)`, and fall back to `application/octet-stream` when `type/subtype` is longer than 100 characters.

### IN-02: `store()` cannot join a caller's transaction

**File:** `app/services/file_storage_service.ts:45,63,77`
**Issue:** The `ContentFile.findBy` and `ContentFile.create` calls use the default connection. When a future upload route creates a CourseContent and attaches the file inside a transaction that then rolls back, the `content_files` row and the blob stay behind as admin-only orphans. Nothing reference-counts or garbage-collects orphans, and the pivot cascade only removes links.
**Fix:** Accept an optional `{ client: TransactionClientContract }` and pass it to `findBy` and `create`. Plan an orphan sweeper for files with no pivot rows that are older than N hours.

### IN-03: Redundant double traversal check in the controller

**File:** `app/controllers/files_controller.ts:41-45`
**Issue:** The controller runs `normalize()` and the regex, then calls `resolvePath()` on the raw path, which runs the same regex plus the containment check. The duplicate check adds nothing, and its result depends on the platform (`normalize` behaves differently on Windows). Use `storage.getFullPath()` or `resolvePath()` alone.
**Fix:** `const fullPath = new FileStorageService().resolvePath(file.storagePath)` and drop the `normalize` and `PATH_TRAVERSAL_REGEX` imports.

### IN-04: 403 vs 404 is an ID existence oracle, and IDs are loosely parsed

**File:** `app/controllers/files_controller.ts:25-37`
**Issue:** Any authenticated user can tell which file IDs exist (403) from those that do not (404). `Number(params.id)` also accepts `1e3`, `0x10` and ` 12 `, so several URLs map to the same file. Both are low impact, but the stricter pattern is to return 404 for unauthorized access and to match `^\d+$` (for example with `router.get(...).where('id', router.matchers.number())`).
**Fix:** Return `notFound` when `canDownload` fails, and add a numeric route matcher.

### IN-05: The Content-Type is guessed from the stored extension, so inline serving would be an XSS risk

**File:** `app/services/file_storage_service.ts:18,51-53`; `app/controllers/files_controller.ts:51-55`
**Issue:** `SAFE_EXTNAME_REGEX` allows `html`, `svg` and `xhtml`, and `response.download` derives the Content-Type from the extension. That is safe today because the disposition is `attachment` and `nosniff` is set. The plan, however, says Page content will embed images from this store. If anyone switches to `inline` to make that work, user-uploaded HTML or SVG would render on the app origin.
**Fix:** Before any inline use, serve from an allowlist of inline-safe types (raster images and PDF), set `Content-Security-Policy: sandbox` on file responses, or serve from a separate origin.

---

_Reviewed: 2026-10-19T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
