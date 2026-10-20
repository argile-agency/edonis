---
status: complete
phase: 04-content-foundation
source: [04-VERIFICATION.md]
started: 2026-10-19T11:52:35Z
updated: 2026-10-19T16:19:25Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Run the functional suite against PostgreSQL and MySQL (CI matrix, after pushing)
expected: All functional tests (incl. file_storage_service and files_download specs) pass on postgres and mysql legs; content_files/content_content_files migrations run and roll back cleanly on both engines. Note the race-recovery test uses a synthetic error, not a real PG unique violation.
result: pass
note: "CI on e4f777d: postgres, mysql, sqlite legs green (see 04-UAT.md test 4)."

### 2. Deploy with CONTENT_STORAGE_PATH on a persistent volume, upload a file, redeploy
expected: Uploaded content files survive the redeploy and remain downloadable via /files/:id/download.
result: skipped
reason: "No deployment environment yet (GitHub repo only). Re-test at first Infomaniak deploy with CONTENT_STORAGE_PATH on persistent storage."

## Summary

total: 2
passed: 1
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps
