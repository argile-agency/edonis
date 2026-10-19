---
status: partial
phase: 04-content-foundation
source: [04-01-SUMMARY.md, 04-REVIEW.md, 04-HUMAN-UAT.md]
started: 2026-10-19T11:54:58Z
updated: 2026-10-19T15:51:11Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Stop the dev server. `node ace migration:fresh --seed` completes without errors, creating content_files and content_content_files. `bun run dev` boots and student@edonis.test can log in and see their courses.
result: pass
reported_initially: "Je suis pas sûr que nous puissions considérer le test 1 comme réussi. Le user étudiant de test étant inscrit à aucun cours, il n'est pas possible de s'auto-inscrire à un cours ou de voir un catalogue de cours, donc impossible aussi de faire le test 2."
severity_initially: major
note: "dev server initially exited with code 1; resolved by `bun update` (package.json/bun.lock left modified, uncommitted, outside phase scope). Pre-existing defect, not introduced by phase 04. Retest with ordered `db:seed --files` workaround: student enrolled in demo courses OK; durable seeder-order fix landed in 1c79159; user retest passed (migration:fresh --seed, student enrolled without workaround)."

### 2. Enrolled student downloads an attached file
expected: After attaching a file via the REPL recipe (uat-recipe below) to published content in a course the student is actively enrolled in, visiting /files/{id}/download as student@edonis.test downloads the file named "UAT notes.txt" containing "hello from UAT". (Recipe writes the blob manually under storage/content_files/ua/; random naming + dedup via the service are covered by automated tests.)
result: pass

### 3. Access denied when content is hidden or user is logged out
expected: Set that content's is_published=false (or its parent module's) → the same URL returns 403 for the student. Logged out → redirected to login. Re-publish → download works again.
result: pass
note: "Unpublished → access denied (HTTP 403 via response.forbidden) but the browser shows raw JSON {\"message\":\"You do not have access to this file\"} instead of an error page; re-publish → download OK; logged out → redirected to login. Raw-JSON display tracked as OBS-04."

### 4. CI matrix green on PostgreSQL and MySQL
expected: After pushing, the CI "Tests (postgres)" and "Tests (mysql)" legs pass, including file_storage_service and files_download specs; phase-04 migrations run on both engines.
result: blocked
blocked_by: other
blocked_reason: "Set aside by user: previous CI run stuck (mysql/sqlite jobs hung after teardown failure, cannot cancel without force-cancel API). Re-run CI after pushing 7119d5e, 3a86210, e810af8."
reported_initially: "mysql et sqlite : Tests 48 passed (48) mais FAILED — functional: Setup hook cleanup function, \"migration:reset\" failed (mysql: 1763139591301_create_update_courses_table_add_enrollment_fields_table ; sqlite: 1769791152246_create_add_terms_version_to_users_table)"
severity: major
note: "Pre-existing, not phase 04 (phase-04 migrations rolled back fine). Fixed in 7119d5e (MySQL: drop FKs before indexes) and 3a86210 (CI seeded the DB before the functional suite, whose migration:reset teardown then failed on SQLite FK checks; seed now runs after tests). Verified locally on throwaway mysql:8.0 and sqlite: 48/48 + reset + migrate + seed. Awaiting CI re-run after push (postgres leg status not yet reported)."

### 5. Stored files survive a redeploy
expected: With CONTENT_STORAGE_PATH pointing at a persistent volume, upload/attach a file, redeploy, and the file is still downloadable via /files/{id}/download.
result: skipped
reason: "No production/staging deployment available yet — only a GitHub repo. Re-test when deploying (Infomaniak) with CONTENT_STORAGE_PATH on persistent storage."

## Summary

total: 5
passed: 3
issues: 0
pending: 0
skipped: 1
blocked: 1

## Gaps

- truth: "After `node ace db:seed`, student@edonis.test is actively enrolled in published demo courses and can see them"
  status: resolved
  reason: "User reported: student enrolled in no course; no self-enrollment or catalogue reachable, blocks file download tests"
  severity: major
  test: 1
  root_cause: "No main seeder and no `seeders.paths` in config/database.ts, so `db:seed` runs files alphabetically: student_enrollment_seeder runs before user_seeder (student not found → returns), course_content_seeder runs before course_seeder, role_seeder after cohort. Pre-existing, not phase 04."
  artifacts: [database/seeders/*.ts, config/database.ts]
  missing: ["database/seeders/main/index_seeder.ts calling seeders in dependency order + seeders.paths pointing at it"]
  fixed_in: 1c79159
  fix_note: "Verified on a fresh SQLite DB: migration:run + db:seed completes in order, student enrolled in demo courses. User retest passed: migration:fresh --seed → student enrolled without workaround." 

- truth: "CI functional suite passes and tears down cleanly on mysql and sqlite"
  status: fixed_pending_ci
  reason: "migration:reset teardown failed on mysql (index needed by FK) and sqlite (seeded data before tests)"
  severity: major
  test: 4
  fixed_in: [7119d5e, 3a86210]

## Out-of-Scope Observations
<!-- Pre-existing defects seen during phase-04 UAT; not phase-04 gaps. Route to backlog / owning phase. -->

- id: OBS-01
  where: inertia/pages/courses/learn.tsx:111 → POST /contents/:contentId/progress (CourseContentsController.updateProgress)
  reported: "All Inertia requests must receive a valid Inertia response, however a plain JSON response was received. {\"success\":true,\"progress\":{...}}" — appears after ~30s on CS101 learn view
  cause: "30s heartbeat uses Inertia router.post() against an endpoint that returns plain JSON; should use fetch/axios with CSRF token (or the endpoint should redirect back). Phase 02-10 gates this route but does not fix the client call."
  severity: major
- id: OBS-02
  where: CS101 learn view, section "Concepts fondamentaux"
  reported: "La section cause une page blanche qui force à recharger la page"
  cause: "Not yet diagnosed — likely a client render crash for one content type; needs browser console error."
  severity: major
- id: OBS-03
  where: database/seeders/course_content_seeder.ts:70 (CS101 file content)
  reported: "http://localhost:3333/files/course-plan.pdf → 404"
  cause: "Seed data uses legacy course_contents.file_url/file_name pointing at a file that never existed; no route serves /files/<name>. Legacy file_* columns overlap the new ContentFile model (already deferred in 04-01-SUMMARY). Migrate seed + file content rendering to ContentFile in Phase 7 (File Content)."
  severity: minor
- id: OBS-04
  where: app/controllers/files_controller.ts:41
  reported: "{\"message\":\"You do not have access to this file\"} — pas de page d'erreur 403 visible"
  cause: "response.forbidden() returns a JSON body even for browser navigations; no 403 status page exists yet. Plan 02-01 adds errors/forbidden + handler intercept — when it lands, make this denial go through it (throw / content-negotiate) so browsers get the 403 page."
  severity: minor
  fixed_in: f1475b1
  fix_note: "Added errors/forbidden page + '403' status page (JSON kept for accept: application/json); FilesController throws 403/404 exceptions. 02-01 plan annotated (265a0a5). User retest passed: student sees the 403 \"Accès refusé\" page when content unpublished; re-published → download resumes (browser keeps previous page displayed — expected for Content-Disposition: attachment)." 

