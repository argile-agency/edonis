---
phase: 04-content-foundation
verified: 2026-10-19T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run the functional suite against PostgreSQL and MySQL (CI matrix, not yet pushed)"
    expected: "Migrations, BIGINT size handling, the pivot composite PK and the unique-checksum dedup all pass on both engines"
    why_human: "Only SQLite was run locally. The concurrent-insert race test uses a synthetic error, so it does not hit a real PG unique violation."
  - test: "Deploy with CONTENT_STORAGE_PATH set to a persistent volume, upload a file, redeploy, then download it"
    expected: "The blob survives the redeploy and the download works"
    why_human: "Real deployment storage persistence cannot be checked from the repo."
---

# Phase 04: Content Foundation Verification Report

**Phase Goal:** Establish database models and file storage infrastructure that all content types will use
**Status:** human_needed (all automated checks pass)
**Re-verification:** No, initial verification

## Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ContentFile model has filename, storage path, MIME type, size and checksum | VERIFIED (with deliberate deviation) | `app/models/content_file.ts` has `storagePath`, `size` (BIGINT, normalised to number) and `checksum`. `filename` and `mime_type` are on the `content_content_files` pivot (review fix WR-04), exposed through `pivotColumns: ['filename','mime_type']` on both `ContentFile.contents` and `CourseContent.files`. The controller serves them as Content-Disposition via `pivotFilename()`. The intent is met, and the deviation is better on correctness: deduped bytes can carry different names per course. It does not break the goal. |
| 2 | FileStorageService stores files outside webroot with random names | VERIFIED | `file_storage_service.ts`: root is `CONTENT_STORAGE_PATH` or `<project>/storage/content_files`, never `public/`. The name is `{checksum[0:2]}/{cuid}.{safe-ext}` and the move uses `overwrite:false`. `.gitignore` excludes the contents and `.gitkeep` is tracked. Tests: sharded storage, `.bin` fallback, collision never overwrites. |
| 3 | Retrieve files by ID and serve downloads | VERIFIED | `GET /files/:id/download` is registered inside the `middleware.auth()` group. `FilesController.download` does `ContentFile.find`, path containment through `resolvePath`, a role/enrollment/availability check, then `response.attachment` with `nosniff`. 24 download tests pass, covering auth, authorization edges and traversal. |
| 4 | Deduplication by checksum | VERIFIED | `checksum` is `unique` in the migration. `store()` does `findBy('checksum')` and returns the existing record, discarding the upload. It also handles a lost blob (self-heal) and the concurrent-insert race. Tests cover the duplicate-returns-existing, restore and race cases. |

**Score:** 4/4

## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `app/models/content_file.ts` | VERIFIED | Substantive and wired. Imported by the service, controller and `CourseContent`. |
| `app/services/file_storage_service.ts` | VERIFIED | Substantive. Used by the controller and tests. `PATH_TRAVERSAL_REGEX` was moved here and is imported by the controller. |
| `app/controllers/files_controller.ts` | VERIFIED | Wired through the route. |
| `database/migrations/1792402903467_create_create_content_files_table.ts` | VERIFIED | Unique checksum (which also gives the index), size BIGINT unsigned. |
| `database/migrations/1792402903468_create_create_content_content_files_table.ts` | VERIFIED | Cascade FKs, composite PK, `file_id` index, pivot filename and mime_type. |
| `CourseContent.files` relation | VERIFIED | `course_content.ts` lines 102-112. |
| `start/env.ts` `CONTENT_STORAGE_PATH` | VERIFIED | Optional string, used by `resolveContentStorageRoot()`. |

## Key Links

| From | To | Status |
|------|----|--------|
| service | `ContentFile.create` / `findBy('checksum')` | WIRED |
| controller | `ContentFile.find(id)` | WIRED |
| routes | `FilesController.download` | WIRED (`files.download`, behind auth) |

## Data Flow

Download resolves the DB row, then the pivot filename (through the related contents query), then the on-disk blob. This is real data with no static returns.

## Behavioral Checks

| Check | Result |
|-------|--------|
| Functional suite (`bin/test.ts functional`, SQLite) | PASS: 47/47. The Node segfault on exit is the known local issue and the results were intact. |
| `bun run typecheck` | PASS |
| `bun run lint` | PASS |
| Debt markers (TBD/FIXME/XXX) in phase files | None |

## Requirements Coverage

The plan declares no requirement IDs. REQUIREMENTS.md maps BUILD-*, FILE-* and IMPORT-10 to later phases (all Pending), so no orphaned requirements are attributable to Phase 04. FILE-04 (stored outside webroot) is enabled here by the infrastructure.

## Plan deviations (informational)

- The route is authenticated and authorized per course. The plan said "public, auth in Phase 9". This is stricter, and an improvement.
- `filename` and `mime_type` moved to the pivot (WR-04). Details are in truth 1.
- The storage root is configurable (WR-03). The plan hardcoded `storage/content_files`.

## Anti-Patterns

None blocking. Open review Info items IN-02 to IN-05 (transaction support, redundant traversal check, 403/404 existence oracle, inline-serving XSS caveat) were out of fix scope and are not goal-blocking. Orphan cleanup is tracked in `deferred-items.md`.

## Human Verification Required

1. **Postgres and MySQL runs.** CI has not been pushed. Only SQLite was exercised locally. The race-recovery test simulates the unique violation, so it does not hit a real PG error.
2. **Persistence in a real deployment.** Set `CONTENT_STORAGE_PATH` to a persistent volume, redeploy, and confirm the files survive.

## Gaps Summary

No gaps. The phase goal is achieved on SQLite. The status is human_needed only because multi-engine and deployment behavior cannot be confirmed locally.

_Verified: 2026-10-19_
_Verifier: Claude (gsd-verifier)_
