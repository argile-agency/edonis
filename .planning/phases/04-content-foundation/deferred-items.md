# Phase 04 Deferred Items

Out-of-scope discoveries logged during execution. Not fixed by Phase 04 plans.

## From 04-01

1. **Local Node process segfaults on exit (environment, not code).**
   `node ace list` and `node --import=ts-node-maintained/register/esm bin/console.ts --version`
   exit with SIGSEGV (139) after printing their output. This happens before any project code
   loads. The output of `node ace test` children is sometimes lost: Windows pipes are async, so
   the parent sees exit 1 with no output. `@swc/core` and `better-sqlite3` load and exit cleanly
   on their own. Workaround: run `NODE_ENV=test node --import=ts-node-maintained/register/esm bin/test.ts <suite>`
   with output redirected to a file. Suspected local node_modules/native-addon state on this
   Windows machine (node v22.23.3). CI on Linux is unaffected as far as is known.

2. **Local node_modules was out of sync with bun.lock.** `@japa/api-client` (declared in
   package.json) was missing, which broke `bun run typecheck` on tests/. Fixed locally with
   `bun install --frozen-lockfile` (no lockfile change). Noted here in case other dev machines
   hit the same problem.

3. **Pre-existing file columns on course_contents** (`file_url`, `file_name`, `file_size`,
   `file_type`) duplicate what ContentFile now models. Migrating or deprecating them belongs to
   the File content phase (roadmap phase 7).

4. **Orphan file cleanup.** ContentFile rows and blobs with no pivot rows are never deleted.
   This needs a reference-counted cleanup command or job in a later phase.
