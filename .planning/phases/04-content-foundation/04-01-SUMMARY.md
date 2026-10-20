---
phase: 04-content-foundation
plan: 01
subsystem: database, storage, api
tags: [lucid, file-storage, sha256, deduplication, authorization, japa]

requires:
  - phase: 01-code-health-baseline
    provides: working Japa functional suite (sqlite test env), no-any lint rule, cross-engine CI matrix
provides:
  - ContentFile model + content_files table (unique SHA-256 checksum)
  - content_content_files pivot (CourseContent <-> ContentFile many-to-many, both sides declared)
  - FileStorageService (store with dedup, sharded storage outside webroot, resolvePath containment)
  - GET /files/:id/download (files.download), auth + per-course authorization
affects: [06-page-content, 07-file-content, 11-moodle-import]

tech-stack:
  added: []
  patterns:
    - "Content blobs live in storage/content_files/{checksum[0:2]}/{cuid}.{ext}; DB stores the POSIX relative path only"
    - "File access authorization = admin, or course staff (hasPermission view), or active/completed enrollment on a published+available content/module"
    - "BIGINT model columns normalised with consume: Number(value) (pg returns strings)"

key-files:
  created:
    - app/models/content_file.ts
    - app/services/file_storage_service.ts
    - app/controllers/files_controller.ts
    - database/migrations/1792402903467_create_create_content_files_table.ts
    - database/migrations/1792402903468_create_create_content_content_files_table.ts
    - storage/content_files/.gitkeep
    - tests/functional/file_storage_service.spec.ts
    - tests/functional/files_download.spec.ts
  modified:
    - app/models/course_content.ts
    - start/routes.ts
    - .gitignore

key-decisions:
  - "File downloads require auth plus per-course authorization (admin / course staff / enrolled learner on published content), not public as the plan stated"
  - "Unlinked (orphan) ContentFiles are downloadable by admins only, since there is no uploader column yet"
  - "Unauthorized download returns 403 (consistent with grades access control), unknown or invalid id returns 404"
  - "No tenant_id on content_files or the pivot: no existing course table carries tenant_id, so we follow the current convention"

patterns-established:
  - "FileStorageService(basePath?) is injectable with a temp root for tests"
  - "Download path safety: PATH_TRAVERSAL_REGEX fast reject + resolve/relative containment check"

requirements-completed: []

duration: 11min
completed: 2026-10-19
---

# Phase 04 Plan 01: Content Foundation Summary

**Deduplicated content file store (SHA-256 unique checksum, sharded under storage/content_files/) with a ContentFile/CourseContent many-to-many and an authenticated, per-course-authorized download endpoint.**

## Performance

- **Duration:** about 11 min
- **Started:** 2026-10-19T09:41:43Z
- **Completed:** 2026-10-19T09:52:31Z
- **Tasks:** 3/3
- **Files:** 11 (8 created, 3 modified)

## Accomplishments

- `content_files` table with a UNIQUE `checksum` and a `content_content_files` pivot (composite PK, CASCADE FKs, reverse index on `content_file_id`). Migrations up, down and up again were verified on SQLite.
- `ContentFile` model with `contents` and `CourseContent.files` many-to-many relations. `storagePath` is hidden from serialization, and `size` is normalised from pg BIGINT strings.
- `FileStorageService.store()` streams a SHA-256 hash, returns the existing record (and deletes the temp upload) on a checksum hit, and otherwise moves the file into its checksum shard under a cuid name. If the insert loses a concurrent race on the unique checksum, it deletes its blob and returns the winning record.
- `GET /files/:id/download` (`files.download`) sits inside the `auth` group. FilesController authorizes per linked course, rejects traversal and out-of-root paths, and serves the file with `response.attachment()` under its original filename plus `nosniff`.
- 16 new functional tests (5 service, 11 download authorization) plus the existing 4 grades tests: 20/20 pass.

## Task Commits

1. **Task 1: ContentFile model and migrations**: `4797a9b` (feat)
2. **Task 2: FileStorageService with SHA-256 dedup**: `ae673cf` (feat)
3. **Task 3: FilesController and download route**: `bd50378` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] Downloads authorized instead of public**
- **Found during:** Task 3
- **Issue:** The plan registered `/files/:id/download` with no middleware and deferred authorization to a later phase. Anyone could then fetch any course file by enumerating IDs.
- **Fix:** The route now sits in the existing `middleware.auth()` content group. `FilesController.canDownload()` allows admins, course staff (`course.hasPermission(user.id, 'view')`, which includes the owner), and learners with an `active`/`completed` enrollment when the content and its module are published and inside their availability window. Orphan files are admin-only. Everything else gets a 403.
- **Files:** app/controllers/files_controller.ts, start/routes.ts
- **Commit:** bd50378

**2. [Rule 1 - Bug] `response.download(path, filename)` misuse**
- **Found during:** Task 3
- **Issue:** The plan called `response.download(fullPath, file.filename)`. In AdonisJS 6 the second argument is `generateEtag: boolean`, so this would not typecheck and would never set the download filename.
- **Fix:** Use `response.attachment(fullPath, file.filename, 'attachment', true, () => ['File not found', 404])`.
- **Commit:** bd50378

**3. [Rule 2 - Security] Stronger path containment and safe storage names**
- **Found during:** Tasks 2 and 3
- **Fix:** Kept `PATH_TRAVERSAL_REGEX` and added `FileStorageService.resolvePath()`, which rejects absolute paths and any path that resolves outside the root. The extension used in storage names is limited to `[a-z0-9]{1,16}`, otherwise `.bin`. Storage paths are joined with `posix`, so Windows-written rows stay portable.
- **Commits:** ae673cf, bd50378

**4. [Rule 1 - Bug] Dedup race and orphan blob on failed insert**
- **Found during:** Task 2
- **Issue:** The plan's check-then-insert would throw on a concurrent duplicate upload and leave the moved blob orphaned.
- **Fix:** If `ContentFile.create` fails, delete the moved blob, re-query by checksum and return the winner if one exists, otherwise rethrow.
- **Commit:** ae673cf

**5. [Rule 1 - Bug] pg BIGINT returned as string**
- **Fix:** `size` column `consume: Number(value)`.
- **Commit:** 4797a9b

**6. [Minor] Redundant checksum index dropped**
- The plan added both `.unique()` and `table.index(['checksum'])`. The unique constraint already creates an index, so the duplicate was omitted. A reverse index on the pivot's `content_file_id` was added for the authorization lookup.

**7. [Rule 3 - Blocking] Local node_modules out of sync with bun.lock**
- `@japa/api-client` (declared in package.json) was missing, which broke typecheck on tests/, and later an eslint dependency was corrupt. Fixed with `bun install --frozen-lockfile` (and `--force`). No package.json or bun.lock changes.

**Not applied from plan:** the stale "Phase 9 will add authorization" note, and the output path `.planning/phases/01-content-foundation/01-01-SUMMARY.md` (old numbering). This summary is written to the current phase directory.

## Verification Results

- `bun run lint`: exit 0
- `bun run typecheck`: exit 0
- `prettier --check` on all touched files: clean
- Functional suite (full, SQLite test env): **20 passed / 0 failed**, exit 0
- Unit suite: **5 passed / 0 failed** (process segfaulted *after* the summary; see Issues)
- Migrations on SQLite test DB: run, rollback, run all succeed; `migration:status` shows both as completed
- PostgreSQL/MySQL: not run locally (no project DB containers); covered by the CI matrix on push

## Issues Needing Attention

- **Local Node segfault on process exit** (deferred-items.md #1). On this Windows machine `node ace list` / `bin/console.ts --version` exit with SIGSEGV after printing their output. Because the child's piped output can be lost, `node ace test` sometimes reports exit 1 with no output. The tests themselves pass. This is environmental and independent of this plan's code.
- The plan's `curl` / REPL manual checks were replaced by functional tests that exercise the same behaviour (404 on a missing id, download end to end).

## Known Stubs

None. Nothing calls `FileStorageService.store()` from an HTTP upload route yet. That is intentional: upload UI and routes belong to the Page/File content phases.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-endpoint | app/controllers/files_controller.ts | New authenticated file-serving endpoint. It is authorized per course and path-contained, but it is the first route that streams files from outside the webroot |

## Self-Check: PASSED

- All 8 created files exist on disk
- Commits 4797a9b, ae673cf, bd50378 present in `git log`
