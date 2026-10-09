# Phase 2: Security and Correctness Hardening - Research

**Researched:** 2026-10-09
**Domain:** AdonisJS 6 authorization (Bouncer v3 policies), VineJS request validation, Lucid v21 transactions and atomic counters, hierarchical-data integrity, AdonisJS encryption failure semantics, session-based 2FA state
**Confidence:** HIGH for codebase facts (every inventory below was read from the working tree at `9867a76`; key library behaviours verified in installed `node_modules` source). MEDIUM for policy/UX decisions, which are tagged `[ASSUMED]` and need user confirmation.

---

<user_constraints>
## User Constraints

**No CONTEXT.md exists.** The user chose to proceed without `/gsd:discuss-phase`. The constraints below come from the orchestrator brief, STATE.md and ROADMAP.md, and are treated as locked.

### Locked Decisions
- Debt-first ordering is locked: Phases 1-3 (tech debt) precede the content milestone (Phases 4-12).
- Phase 2 **depends on Phase 1**, which is planned but **not yet executed**. Plans must assume Phase 1's outputs exist: `as any` removed, `@japa/api-client` installed, `.env.test` (SQLite), functional suite with `withGlobalTransaction()`, `tests/unit/` created, and CI gates enforced.
- Tier D performance work is **out of scope**: indexes, N+1 fixes, role caching.
- Phase 12 (PERM-01..03, builder access control) will be **built on the policy layer this phase creates**. The policy API must be reusable for "instructor can access builder for own courses / admin any / student 403".
- Requirement IDs to satisfy: DEBT-04, DEBT-05, DEBT-06, DEBT-07, DEBT-08, DEBT-09.

### Claude's Discretion
Everything not listed above: library choice within the AdonisJS ecosystem, policy granularity, timeout values, plan/wave structure. Several discretion items **change user-visible behaviour** and are flagged `[ASSUMED]` + `BEHAVIOUR CHANGE`. The planner should either gate them behind `checkpoint:human-verify` or surface them for confirmation.

### Deferred Ideas (OUT OF SCOPE)
- Role caching, composite indexes, N+1/preload optimisation (Tier D)
- Evaluations module and contact form (Phase 3)
- Builder-specific access control UX (Phase 12; this phase only provides the policy primitives)
- Multi-tenancy (`tenant_id`): **0 occurrences** in `app/` or `database/`, so the CLAUDE.md tenancy rule cannot be applied to this phase
</user_constraints>

---

## Summary

Phase 2's six success criteria are directionally right, but **four of them rest on premises the code contradicts**. Each needs re-scoping before planning, the same way Phase 1 was re-scoped.

1. **Categories (DEBT-07): `buildTree` cannot loop.** It starts from roots (`parentId === null`). In a single-parent graph, a node reachable from a root has an ancestor chain ending at that root, so it is not in a cycle. Cycles are therefore *unreachable* from `buildTree`. That holds for both the controller and `inertia/pages/admin/categories/index.tsx`. The real defect is on the **write path**: `CategoriesController.update` accepts `parentId` equal to the category's own id or to any of its descendants. When that happens the whole subtree **silently vanishes** from the admin UI. The only true infinite loop is `CourseCategory.getFullPath()`, which has **zero callers**. Related gaps: moving or renaming a category recomputes `path` only for *direct* children; grandchildren keep stale paths, and children's `depth` is never updated.
2. **Validators (DEBT-05): "5 validators for 16 controllers" is the wrong metric.** Three controllers already define validators inline (`categories`, `two_factor`, `account`). The actual gap is **13 mutation actions and 4 query-string actions** that read `request.only()` / `request.input()` with no validation. Several of these can 500 on malformed input today. Separately, **existing** validators have contract bugs:
   - `createCourseValidator` accepts `category`, which is not a Course column, so Lucid `merge()` throws.
   - `updateCourseValidator.tags` expects an array while the admin settings form sends a comma string.
   - `categoryId` is silently stripped.
3. **Enrollment counters (DEBT-06): a transaction alone does not fix the race.** Every mutation is read-modify-write on an in-memory model attribute (`course.enrolledCount += 1; save()`). Wrapping that in a transaction does not stop two concurrent enrolments from over-filling a capacity-limited method. `forUpdate()` compiles to an **empty string on SQLite**. The fix is an **atomic conditional `UPDATE ... SET x = x + 1 WHERE (max IS NULL OR x < max)`** inside a transaction, checking the affected-row count. There are also drift bugs a transaction would not catch:
   - `unenroll` and `removeParticipant` never decrement `currentEnrollments`.
   - `CourseGroup.currentMembers` is a third unguarded counter.
4. **Decryption (DEBT-08): `encryption.decrypt()` never throws.** It returns `null` on every failure path, so the `catch` in `EncryptionService` is dead code; the real silent fallback is `?? value`. A bigger live bug sits next to it: `users.phone` and `users.mobile_phone` are **`varchar(20)`** columns, but ciphertext for a phone number is **110 characters**. On PostgreSQL and MySQL/MariaDB strict mode (production is MariaDB), saving a profile with a phone number fails. `ProfileController.update`'s try/catch then reduces that to a generic error flash. On non-strict MySQL it silently truncates the ciphertext, which is unrecoverable.

Authorization (DEBT-04): `@adonisjs/bouncer` is **not installed**, and `npm latest` (4.0.1) **requires `@adonisjs/core ^7`**. The project is on core **6.19.0**, so the install must be pinned to **`@adonisjs/bouncer@^3.1.6`**. The inventory found **~40 inline authorization checks** across 4 controllers. It also found **at least 9 real IDOR / missing-check bugs**, for example:
- `reorderModules` / `reorderContents` update ids from any course.
- `removePermission` deletes a permission from any course.
- `learn?content=` serves content from any course.

`unenroll` crashes with a TypeError for every caller: `auth.user!.roles` is never loaded on that route (verified in Lucid source). Self-unenrolment is therefore currently impossible.

2FA (DEBT-09): the pending state is a bare `session.put('two_factor_user_id', id)`. It has no timestamp, lives as long as the 2-hour cookie session, and is throttled only per IP. User-side recovery codes **already exist and work**. What is missing: admin reset, a CLI escape hatch (when the only admin is the one locked out), any documentation (`docs/USER_MANAGEMENT.md` still lists 2FA as an unchecked TODO), and logging when TOTP decryption fails. Rotating `APP_KEY` silently locks out every 2FA user.

**Primary recommendation:**
1. Install `@adonisjs/bouncer@^3.1.6` (not latest). Add one `CoursePolicy` and one `EnrollmentPolicy` whose `before()` grants admins. Fix the IDORs by scoping child ids to the authorized course.
2. Put every enrolment mutation behind an `EnrollmentService` that uses `db.transaction()` plus atomic conditional `increment`/`decrement`, and add a `recount` ace command.
3. Reject category cycles on write with a pure `wouldCreateCycle()` helper, and bound `getFullPath`.
4. Sequence DEBT-08 carefully: widen the columns, then scan and repair, then make decrypt raise. Raising inside a Lucid `consume` hook runs during `auth.check()` on every request.
5. Replace the bare 2FA session key with `{ userId, expiresAt, attempts }`. Add an audited, throttled admin reset, plus a `node ace` reset command and a doc.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Coarse role gate (admin / staff areas) | API: route middleware (`role_middleware.ts`) | — | Already correct and cheap. Keep it; policies do not replace it |
| Resource-ownership decision ("may this user edit *this* course?") | API: `app/policies/*` (Bouncer) | Domain model (`Course.hasPermission`) as data helper | Single decision point that Phase 12 can extend. Controllers ask, never decide |
| Scoping child ids to an authorized parent (module/content/permission/method/group ∈ course) | API: controller/service query (`where('course_id', course.id)`) | Policy | IDORs here come from **unscoped queries**, not missing policy calls. A policy check on the parent is useless if the child query is unscoped |
| Showing/hiding UI affordances (`canEdit`, `canManage`) | API computes via `bouncer.allows()` → Inertia props | Browser renders | Browser must never be the decision point |
| 403 rendering for Inertia requests | API: `app/exceptions/handler.ts` | Browser: `inertia/pages/errors/forbidden.tsx` | Bouncer's self-handling sends plain text, so the app handler must intercept |
| Input shape/type validation | API: VineJS validators | Browser (UX only) | Server is authoritative |
| Business-rule validation (capacity, enrolment window, cycle) | API: service layer (`EnrollmentService`, category helper) | DB constraints (unique keys already exist) | Needs DB state; not expressible in Vine schema alone |
| Counter consistency | Database (atomic `UPDATE` in transaction) | Service | Only the DB can make increment + capacity check atomic |
| PII encryption at rest | Data layer (Lucid `prepare`/`consume`) | `EncryptionService` | Already the design; Phase 2 changes failure semantics only |
| 2FA pending state | API: session (encrypted cookie store) | — | Must not touch DB until login completes |
| Break-glass 2FA reset | Ops: ace command | API: admin endpoint | Works when no admin can log in |

---

## Roadmap Corrections (feed these into ROADMAP.md before planning)

| Criterion as written | What the code actually shows | Recommended restatement |
|---|---|---|
| 2. "Every controller action accepting user input has a validator (currently 5 validators for 16 controllers)" | 8 validator definitions exist (5 files + inline in 3 controllers). The gap is **17 specific actions** (see DEBT-05 inventory). Count-by-file is not falsifiable. | "Every action in the DEBT-05 inventory reads input only via `request.validateUsing()`; `grep -n "request\.\(only\|input\|all\)" app/controllers` returns 0" |
| 3. "Enrollment counter mutations run inside a database transaction" | A transaction alone does not prevent over-capacity enrolment under concurrency, and SQLite ignores `FOR UPDATE`. | "...run inside a transaction **using atomic conditional increments**, and counters equal `COUNT(*)` of their source rows after any sequence of enrol/unenrol operations" |
| 4. "Category tree building rejects cycles instead of looping" | Tree building cannot loop. The cycle is *created* by `update` and makes subtrees vanish. | "Category update rejects a parent that is the category itself or a descendant; descendant `path`/`depth` are recomputed on move" |
| 5. "Decryption failures are logged and raised, never returned as raw values" | `decrypt` never throws (returns `null`). Raising in `consume` affects `auth.check()` on every request. `phone`/`mobile_phone` are `varchar(20)`, too small for ciphertext. | Keep the criterion, but add as prerequisites: "PII columns can hold ciphertext" and "existing rows scanned/repaired before raising is enabled" |
| 1. "all resource-ownership checks route through `app/policies/`" | Falsifiable as written once given a grep gate. | Add the gate: `grep -rn "hasPermission(\|hasRole(\|instructorId ===\|isInstructor(" app/controllers` returns 0 |

---

## Project Constraints (from CLAUDE.md)

- **Package manager:** `bun` first, then `pnpm`, then `npm` → `bun add @adonisjs/bouncer@^3.1.6`, then `node ace configure @adonisjs/bouncer`. **Do not** run `node ace add @adonisjs/bouncer`: it resolves `latest` = 4.x (core 7).
- **Commits:** conventional, one line, **no Co-Authored-By trailer** (CLAUDE.md and user memory override any tool default).
- **Seeders:** reuse existing seeders; do not create new ones. `course_seeder.ts` sets `enrolledCount: 35/28/42/55/18` with **no matching enrollment rows**. A recount command will change these demo numbers (see Runtime State).
- **Migrations:** always reversible with `down()`. Use `jsonColumn()` helpers for JSON. Note: the PII column-widening migration's `down()` **cannot safely narrow back to 20** once ciphertext is stored (see Pitfalls).
- **Validation:** VineJS validators in `app/validators/`, used via `request.validateUsing()`.
- **Authorization:** "Check both authentication AND authorization in protected routes."
- **Audit logging:** `AuditService.logFromContext(ctx, {...})` for all security-relevant actions. This applies to admin 2FA reset, permission changes and decryption failures.
- **Rate limiting:** "All auth-related endpoints must have rate limiting via `@adonisjs/limiter`." This applies to the new admin 2FA reset endpoint and to a per-user 2FA challenge throttle.
- **GDPR:** any new personal-data field must be in `AccountController.exportData` and anonymized in `deleteAccount`. This phase adds **no** new personal fields. The 2FA pending state lives in the session, not the DB.
- **Multi-DB:** PG / MySQL / MariaDB / SQLite. Every SQL pattern below was chosen to work on all four. Note `forUpdate` is a no-op on SQLite.
- **Multi-tenancy:** CLAUDE.md requires `tenant_id`, but **0 occurrences exist** in the schema or app. Not applicable this phase.
- **Accessibility:** any new page (e.g. `errors/forbidden.tsx`) must pass axe-core critical/serious checks and use shadcn/ui.
- **Project skills** (`.claude/skills/`): `design-to-code-react`, `ecoscore-calculator-engine`, `rgesn-audit-automation`, `skill-creator`, `wcag-compliance-checker`. SKILL.md files read: `wcag-compliance-checker` is an audit workflow (Playwright + axe-core + Vision report) and `design-to-code-react` is a Figma-to-React generator. **Neither imposes coding conventions.** The new `errors/forbidden.tsx` page is covered by the existing axe-core browser suite (`tests/browser/accessibility.spec.ts`); the wcag skill may optionally be used to audit it. No skill constrains the backend work.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEBT-04 | Resource-ownership authorization centralized in `app/policies/` | Bouncer 3.1.6 (pinned, peer-compatible with core 6.19.0). Inventory of ~40 inline checks + 9 IDORs. `CoursePolicy`/`EnrollmentPolicy` design with `before()` admin bypass. Handler intercept for `E_AUTHORIZATION_FAILURE`. Grep gate. See **DEBT-04 Findings**. |
| DEBT-05 | Every action accepting user input has a validator | Per-action inventory (13 body + 4 query-string actions). Existing-validator contract bugs. `router.where()` param matchers for route ids. See **DEBT-05 Findings**. |
| DEBT-06 | Enrollment counter mutations run in a DB transaction | All 12 mutation sites listed. `db.transaction()` + atomic conditional `increment`. `[affected]` row-count semantics verified in Lucid source. `EnrollmentService` + `enrollment:recount`. See **DEBT-06 Findings**. |
| DEBT-07 | Category tree detects/rejects cycles | Proof that `buildTree` cannot loop. Cycle is created by `update`. Pure `wouldCreateCycle()` + bounded `getFullPath` + descendant path/depth recompute. See **DEBT-07 Findings**. |
| DEBT-08 | Decryption failures logged and raised | `decrypt` returns `null`, never throws (verified). Blast radius via `consume` → `auth.check()`. `varchar(20)` overflow (110-char ciphertext measured). Sequenced widen → scan/repair → raise. See **DEBT-08 Findings**. |
| DEBT-09 | 2FA pending state has timeout + documented recovery path | Current mechanism mapped. `{userId, expiresAt, attempts}` design. Per-user throttle. Audited admin reset + ace CLI reset + `docs/TWO_FACTOR_RECOVERY.md`. See **DEBT-09 Findings**. |
</phase_requirements>

---

## Standard Stack

### Core (to add)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@adonisjs/bouncer` | **3.1.6** (pin `^3.1.6`; **not** 4.x) | Policies + abilities, `ctx.bouncer`, `AuthorizationException` | Official AdonisJS authorization package. Generates `app/policies/main.ts` and `#policies/*`; the `#policies/*` subpath import **already exists** in `package.json`. [VERIFIED: npm registry: 3.1.6 peer `@adonisjs/core ^6.17.1`; 4.0.1 peer `@adonisjs/core ^7.0.0`] |

### Already installed, used by this phase (no action)

| Library | Version | Purpose |
|---|---|---|
| `@adonisjs/core` | 6.19.0 | `router.matchers.number()`, `ExceptionHandler`, ace commands [VERIFIED: node_modules] |
| `@adonisjs/lucid` | 21.8.0 | `db.transaction()`, `Model.query({ client: trx })`, `.increment()/.decrement()`, `useTransaction()` [VERIFIED: `build/src/types/model.d.ts:310-311,417`, `querybuilder.d.ts:514,642-643`] |
| `@adonisjs/encryption` | 6.0.2 | `encryption.decrypt()`: **returns `null`, never throws** [VERIFIED: `build/chunk-CEXVRLXG.js:182-211`] |
| `@vinejs/vine` | 3.0.1 | Validators; `validateUsing` also exposes `params`, `headers`, `cookies` [VERIFIED: `core/build/modules/http/request_validator.js:65-69`] |
| `@adonisjs/limiter` | 2.4.x | Per-user 2FA throttle via `.usingKey()` (pattern already in `start/limiter.ts:passwordThrottle`) |
| `@adonisjs/session` | 7.5.1 | Pending-2FA state; cookie store, `age: '2h'` |
| `@adonisjs/auth` | 9.5.1 | Session guard calls `session.regenerate()` on login [VERIFIED: `modules/session_guard/main.js:282`] |
| `knex` | 3.1.0 | SQLite `forUpdate` → `''` (no-op) [VERIFIED: `dialects/sqlite3/query/sqlite-querycompiler.js:26`]; SQLite `alterColumn` supported via table rebuild [VERIFIED: `sqlite-tablecompiler.js:41,68`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bouncer policies | Plain `app/policies/*.ts` service classes (no package) | Would satisfy "`app/policies/` exists" with zero deps. But you lose `ctx.bouncer`, `AuthorizationException`, the `before`/`after` hooks, container injection and Edge helpers, and Phase 12 gets a bespoke API. Bouncer is the framework convention and the `#policies/*` alias is already reserved for it. **Use Bouncer.** |
| Counter columns + atomic increments | Drop counters, derive with `COUNT(*)` / `withCount` | Removes drift by construction, but touches every read site (6 Inertia pages, `home_controller`, `canEnroll`, `isAvailable`), and capacity checks still need atomicity. The roadmap wording requires transactions, so keep the columns, make writes atomic, and add `recount` for repair. |
| Atomic conditional `UPDATE` | `SELECT ... FOR UPDATE` row lock | Does nothing on SQLite (compiles to `''`). The conditional UPDATE is portable across all 4 engines. |
| Route param matchers (`router.where`) | `params: vine.object({...})` in every validator | Matchers are global, cast to `number`, and turn `/courses/abc` into a 404 instead of a PG `invalid input syntax for type integer` 500. Use matchers for ids, Vine for bodies/query strings. |

**Installation:**
```bash
bun add @adonisjs/bouncer@^3.1.6
node ace configure @adonisjs/bouncer
# creates app/abilities/main.ts, app/policies/main.ts, app/middleware/initialize_bouncer_middleware.ts,
# registers provider + commands in adonisrc.ts, appends middleware to router.use() in start/kernel.ts
```
[VERIFIED: configure hook in `@adonisjs/bouncer@3.1.6/build/index.js`: `makeUsingStub` ×3, `addCommand`, `addProvider`, `registerMiddleware("router", ...)`]

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@adonisjs/bouncer` | npm | created 2021-01-11; 3.1.6 published 2025-06-09 | ~33,000/wk | `github.com/adonisjs/bouncer` | **[OK]** (`slopcheck scan` in an isolated `/tmp` dir, so the project was not mutated) | **Approved, pinned `^3.1.6`** |

Additional verification [VERIFIED: `npm view`]:
- Maintainers: `virk`, `romainlanz`, `julien-r44` (AdonisJS core team).
- **No `install`/`postinstall` script.**
- Sole runtime dependency: `@poppinss/utils ^6.9.4` (already installed at 6.10.1).
- Peers: `@adonisjs/core ^6.17.1` (installed 6.19.0 ✓), `edge.js ^6.2.1` (installed 6.5.1 ✓, optional), `@adonisjs/i18n ^2.2.0` (**optional**, not installed, not needed).
- 🔴 **Version trap:** `latest` = 4.0.1, peer `@adonisjs/core ^7.0.0`. An unpinned install or `node ace add @adonisjs/bouncer` would pull an incompatible major.

**Packages removed due to [SLOP]:** none. **Packages flagged [SUS]:** none.

---

## DEBT-04 Findings: Authorization

### What exists today [VERIFIED: read every controller]

| Mechanism | Where | Notes |
|---|---|---|
| Route role gate | `app/middleware/role_middleware.ts`, applied in `start/routes.ts` | Loads `auth.user.roles` and returns a JSON 403. Correct and **stays**. |
| Course ownership + ACL | `Course.hasPermission(userId, 'view'\|'edit'\|'manage')`, `Course.isInstructor()` | Owner (`instructorId`) = all levels. Otherwise looks up `course_permissions` (unique `(course_id,user_id)`, levels `view<edit<manage`). |
| Global admin check | `await user.hasRole('admin')` inline in ~25 actions | `hasRole` lazy-loads roles. |
| Admin check via preloaded roles | `auth.user!.roles.some(...)` in `enrollManual`, `unenroll` | **Breaks when roles are not loaded** (see Bug A1). |
| Self-ownership by query scope | `SocialAuthController.disconnect` (`where('user_id', user.id)`) | Already correct; leave it (query scoping *is* the policy). |
| **Ignored** authorization data | `course_enrollments.course_role` (`instructor`, `teaching_assistant`, ...), `user_roles.course_id` (contextual roles) | Never consulted. A user enrolled with `course_role='instructor'` gets nothing. → Open Question Q3 for Phase 12. |

### Inline check inventory (what moves into policies)

| Controller | Actions with inline ownership/admin checks | Count |
|---|---|---|
| `courses_controller.ts` | show (view/edit/manage), edit, update, destroy (`isInstructor`), publish, archive, addPermission, removePermission, manageEnrollmentMethods, create/update/deleteEnrollmentMethod, manageGroups, createGrouping, createGroup (all `manage`); index (role branching); approvalQueue, approveCourse, rejectCourse, adminIndex, showParticipants, addParticipant, removeParticipant, showSettings, updateSettings, archiveCourse (`hasRole('admin')`, **redundant**: routes already enforce `role:admin`) | ~28 |
| `course_contents_controller.ts` | builder, createModule, updateModule, deleteModule, reorderModules, createContent, updateContent, deleteContent, reorderContents (`edit`); learn (`hasRole('admin')` bypass) | 10 |
| `enrollments_controller.ts` | enrollManual (`manage` or admin), unenroll (self / `manage` / admin) | 2 |
| `grades_controller.ts` | course: `course.instructorId === user.id` or enrolled | 1 |

### Bugs found: IDOR and missing checks [VERIFIED: code read; behaviour inferred from code paths]

| # | Location | Defect | Severity |
|---|---|---|---|
| A1 | `enrollments_controller.ts:381` `unenroll` | `auth.user!.roles.some(...)` on a route with only `middleware.auth()`. Lucid returns `this.$preloaded[key]` for relations, so it is **`undefined`** when not loaded [VERIFIED: `lucid/build/src/orm/base_model/index.js:1128`]. Nothing in the middleware chain loads roles. **TypeError → 500 for every caller, including self-unenrol.** | High (feature broken) |
| A2 | `course_contents_controller.ts:307` `reorderModules` | Checks `edit` on `params.id`, then `CourseModule.query().where('id', item.id).update(...)` for **any** module id. A teacher can reorder other courses' modules. | High |
| A3 | `course_contents_controller.ts:433` `reorderContents` | Same pattern: content ids not scoped to `params.moduleId`. | High |
| A4 | `courses_controller.ts:296` `removePermission` | Checks `manage` on `params.courseId`, then `CoursePermission.findOrFail(params.permissionId)` with **no course scoping**. A manager of course A can delete permissions on course B. | High |
| A5 | `course_contents_controller.ts:93` `learn` | `?content=<id>` fetched with `where('is_published', true)` only. Any enrolled user can read **any course's** published content. | Medium |
| A6 | `course_contents_controller.ts` `updateProgress`, `markComplete` | Any authenticated user can create `content_progress` rows for any content, with no enrolment check. | Medium |
| A7 | `course_contents_controller.ts` `outline`, `getCourseProgress` | No visibility/enrolment check; private-course structure is readable by any logged-in user. | Medium |
| A8 | `course_contents_controller.ts:213` `createModule`, `updateModule` | `parentId` not checked to belong to the same course (cross-course nesting; self-parent hides the module). | Medium |
| A9 | `enrollments_controller.ts:288,326` `enrollManual`; `courses_controller.ts` `createEnrollmentMethod` (`autoAssignGroupId`), `createGroup` (`groupingId`) | `enrollmentMethodId`, `groupId`, `autoAssignGroupId`, `groupingId` not scoped to the course. Can bump another course's counters or add users to another course's group. | Medium |
| A10 | `enrollments_controller.ts` `enrollSelf`, `enrollWithKey` | Never check `course.status`/`allowEnrollment`/`maxStudents`/date window (`course.canEnroll()`). A student can self-enrol into a **draft** course if a `self` method exists. | Medium |

### Policy design (recommended)

**Two policies, admin bypass in `before()`:**

- **`CoursePolicy`**: `view`, `learn`, `edit`, `manage`, `delete`, `viewGradebook`, `enroll`, `administer`.
- **`EnrollmentPolicy`**: `unenroll(user, enrollment)` (self, or `manage` on the course).

Do **not** create policies for categories, users or audit logs. Those are pure role gates with no ownership, and the route middleware already covers them. "All resource-ownership checks" is satisfied once the course/enrollment checks move.

**Behaviour preservation (every rule below needs to be marked in the plan):**

| Policy action | Rule | Today | Change? |
|---|---|---|---|
| `before` | admin → `true` | admin bypass everywhere via inline `hasRole('admin')` | Preserves |
| `view` | `visibility === 'public'` or `hasPermission(view)` | identical (`show`) | Preserves |
| `edit` | `hasPermission(edit)` | identical | Preserves |
| `manage` | `hasPermission(manage)` | identical | Preserves |
| `delete` | owner (`instructorId`) only | identical | Preserves |
| `administer` | admin only (via `before`) | inline `hasRole('admin')` duplicating route middleware | Preserves |
| `viewGradebook` | owner, or enrolled | `grades_controller`: owner or enrolled; **admins and `edit`-permission co-instructors are denied** | 🟠 **BEHAVIOUR CHANGE** if widened to admin/`edit` [ASSUMED desired] |
| `learn` | enrolled (or `edit`) | `learn` enforces enrolment (redirect); `outline`/`progress`/`updateProgress`/`markComplete` enforce **nothing** | 🟠 **BEHAVIOUR CHANGE** for the 4 unguarded actions [ASSUMED desired] |
| `enroll` | `course.canEnroll()` | not checked server-side | 🟠 **BEHAVIOUR CHANGE**. Note that `canEnroll`'s date window only starts working after Phase 1's 01-02 fix |
| `unenroll` | self, or `manage` | intended identical, currently crashes (A1) | 🟢 Bug fix |

**Grep gate for success criterion 1:**
```bash
grep -rn "hasPermission(\|hasRole(\|instructorId ===\|isInstructor(\|\.roles\.some(" app/controllers   # must return 0
```

### Bouncer 3.1.6 facts the plan depends on [VERIFIED: tarball source `build/chunk-AMP4VOSN.js`, `build/src/*.d.ts`]

1. **`before()` runs *before* the guest check.** `PolicyAuthorizer.execute` calls `policy.before(user, action, ...args)` first; only if it returns non-boolean does it then deny guests. So **`before` receives `user: null`** for guests and must null-guard (`if (user && await user.isAdmin()) return true`).
2. A boolean or `AuthorizationResponse` from `before` short-circuits. Returning `undefined` continues to the action.
3. `bouncer.with(CoursePolicy).authorize('edit', course)` throws `E_AUTHORIZATION_FAILURE` (status 403, code `E_AUTHORIZATION_FAILURE`). `.allows()` / `.denies()` return booleans.
4. Policies are instantiated via `containerResolver.make(Policy)` when the middleware sets the resolver, so `@inject()` works.
5. 🔴 **`AuthorizationException` has its own `handle()` method**, which sends a **plain-text** body for `html` requests. AdonisJS 6's `ExceptionHandler.handle` calls a self-handling exception's `handle()` **before** consulting `statusPages` [VERIFIED: `@adonisjs/http-server/build/index.js:285` vs `:292`]. **Adding a `'403'` status page will not catch Bouncer denials.** The app's `handle()` override must check `error instanceof errors.E_AUTHORIZATION_FAILURE` **before** calling `super.handle`, and render an Inertia `errors/forbidden` page (or flash + redirect back). `inertia/pages/errors/` currently has only `not_found`, `server_error` and `too_many_requests`.
6. Policy unit construction outside HTTP: `new Bouncer(user, abilities, policies).with(CoursePolicy).allows('edit', course)`.

---

## DEBT-05 Findings: Validation

### Existing validator definitions (8, not 5)

| File | Validators |
|---|---|
| `app/validators/auth_validator.ts` | `loginValidator`, `registerValidator` |
| `app/validators/course.ts` | `createCourseValidator`, `updateCourseValidator`, `createCoursePermissionValidator` |
| `app/validators/course_content.ts` | create/update Module, create/update Content, reorderModules, reorderContents, updateProgress |
| `app/validators/profile_validator.ts` | updateProfile, updatePassword, updateSettings |
| `app/validators/user_validator.ts` | createUser, updateUser (+ manual uniqueness helpers) |
| **inline** `categories_controller.ts` | create/updateCategoryValidator |
| **inline** `two_factor_controller.ts` | tokenValidator, passwordValidator, recoveryCodeValidator (compiled **per request** in `verifyRecovery`) |
| **inline** `account_controller.ts` | passwordConfirmValidator |

Recommendation: move the inline ones into `app/validators/` for consistency (`category.ts`, `two_factor.ts`, `account.ts`).

### Unvalidated input inventory [VERIFIED: `grep "request\.(only|input|all|file)" app/controllers`]

**Body input on mutations (must fix):**

| # | Action | Raw input | Concrete failure today |
|---|---|---|---|
| V1 | `courses.createEnrollmentMethod` | `request.only([17 fields])` mass-assigned | `methodType` unconstrained (model union type is a lie at runtime); `autoAssignGroupId` unscoped (A9); date strings unparsed into `@column.dateTime` |
| V2 | `courses.updateEnrollmentMethod` | `request.only([16 fields])` | same; `enrollmentKey` length unbounded |
| V3 | `courses.createGrouping` | `name`, `description` | `name` undefined → DB NOT NULL error 500 |
| V4 | `courses.createGroup` | 6 fields | `groupingId` unscoped (A9); `maxMembers` string |
| V5 | `courses.rejectCourse` | `reason` | `undefined` passed to `reject(..., reason: string)` |
| V6 | `courses.addParticipant` | `userId`, `courseRole` | `Number(undefined)` = `NaN`; `courseRole` free text vs the `CourseRole` union; duplicate → unique-constraint 500 |
| V7 | `courses.updateSettings` | `request.input('tags')` read **after** validation | Admin settings form sends `tags` as a comma string (`settings.tsx:66`), but `updateCourseValidator.tags` is `vine.array`. **Validation rejects the form**, so the string-splitting code after it is dead. `categoryId` (sent by the form) is not in the validator, so it is **silently stripped**. |
| V8 | `categories.reorder` | `categoryIds` | missing → `undefined.entries()` TypeError 500 |
| V9 | `enrollments.enrollWithKey` | `enrollmentKey`, `enrollmentMethodId` | missing key → `undefined.toLowerCase()` TypeError 500 (`course_enrollment_method.ts:126`) |
| V10 | `enrollments.enrollSelf` | `enrollmentMethodId` | `findOrFail(undefined)` |
| V11 | `enrollments.requestEnrollment` | `enrollmentMethodId`, `requestMessage` | unbounded message length |
| V12 | `enrollments.enrollManual` | `userIds`, `courseRole`, `enrollmentMethodId`, `groupId` | missing `userIds` → `for...of undefined` TypeError 500 |
| V13 | `profile.updateAvatar` | `request.file('avatar', {size, extnames})` | Acceptable today; move to `vine.file({ size: '2mb', extnames: [...] })` for uniformity [ASSUMED: vine file rule registered by `vinejs_provider`] |

**Query-string input on reads (should fix):**

| # | Action | Raw input | Concrete risk |
|---|---|---|---|
| V14 | `courses.index` | `page`, `status`, `category`, `search` | `Number(category)` NaN; arbitrary `status` |
| V15 | `users.index` | `page`, **`limit`**, `search`, `role`, `status` | `?limit=1000000` = unbounded page size (cheap DoS) |
| V16 | `audit_logs.index` | `page`, `action`, `userId`, `resourceType`, `dateFrom`, `dateTo` | invalid date strings → PG cast error 500 |
| V17 | `course_contents.learn` | `content` | unscoped id (A5) |

### Existing-validator contract bugs (validators that exist but are wrong)

| Validator | Bug | Evidence |
|---|---|---|
| `createCourseValidator.category` (string) | `Course` has `categoryId`, not `category`. `Course.create({...payload})` → Lucid `merge()` **throws** `Cannot define "category" on "Course" model` when the key is present [VERIFIED: `lucid/build/src/orm/base_model/index.js:1320-1323`]. `create.tsx:29,195` sends `category`. Empty → `null` via `convertEmptyStringsToNull`, so it only fails when a category is selected. [Inferred end-to-end; not executed] |
| `updateCourseValidator.tags` | array vs comma string from `admin/courses/settings.tsx` | see V7 |
| `createCourseValidator.status` | Lets a teacher create a course directly as `published`, bypassing the approval workflow | 🟠 policy question → Open Question Q4 |
| `updateModuleValidator.parentId` | unscoped (A8) | — |
| `createUserValidator/updateUserValidator.roleIds` | ids not checked to exist → FK error 500 | use `vine.number().exists(...)` [ASSUMED: Lucid's vine `exists` rule is available via `@adonisjs/lucid` provider in v21] |

### Route params

Every `:id` / `:courseId` / `:moduleId` / `:contentId` / `:enrollmentId` / `:methodId` / `:permissionId` is passed straight to `findOrFail`. On PostgreSQL a non-numeric id raises `invalid input syntax for type integer` → **500**, not 404. Fix globally:

```ts
// start/routes.ts, top of file [VERIFIED: router.where + router.matchers.number() exist in http-server d.ts]
router.where('id', router.matchers.number())
router.where('courseId', router.matchers.number())
// ...moduleId, contentId, enrollmentId, methodId, permissionId
```
Non-matching params then fail route matching (404) and matched params are cast to `number`.

**DEBT-05 gate:**
```bash
grep -rn "request\.\(only\|input\|all\)(" app/controllers   # must return 0 (validateUsing + request.file only)
```

---

## DEBT-06 Findings: Enrollment counters

### Every counter mutation site [VERIFIED: grep]

| # | File:line | Counter | Operation | In transaction? | Drift bug |
|---|---|---|---|---|---|
| C1 | `enrollments_controller.ts:125` | `CourseGroup.currentMembers` | `+= 1` (enrollWithKey auto-assign) | ✗ | capacity race (`canAddMembers` then `+1`) |
| C2 | `enrollments_controller.ts:131` | `CourseEnrollmentMethod.currentEnrollments` | `+= 1` | ✗ | capacity race vs `isAvailable()` |
| C3 | `enrollments_controller.ts:135` | `Course.enrolledCount` | `+= 1` | ✗ | — |
| C4 | `enrollments_controller.ts:195` | `currentEnrollments` | `+= 1` (enrollSelf) | ✗ | capacity race |
| C5 | `enrollments_controller.ts:199` | `enrolledCount` | `+= 1` | ✗ | — |
| C6 | `enrollments_controller.ts:336` | `currentMembers` | `+= 1` (enrollManual group) | ✗ | per-loop, group unscoped (A9) |
| C7 | `enrollments_controller.ts:348` | `enrolledCount` | `+= n` after loop | ✗ | loop partial failure: counter reflects successes only, OK |
| C8 | `enrollments_controller.ts:352` | `currentEnrollments` | `+= n` | ✗ | method unscoped (A9) |
| C9 | `enrollments_controller.ts:390` | `enrolledCount` | `max(0, -1)` (unenroll) | ✗ | 🔴 **never decrements `currentEnrollments` or `currentMembers`** |
| C10 | `courses_controller.ts:758` | `enrolledCount` | `+= 1` (addParticipant) | ✗ | no capacity check |
| C11 | `courses_controller.ts:784` | `enrolledCount` | `max(0, -1)` (removeParticipant) | ✗ | 🔴 **never decrements `currentEnrollments`/`currentMembers`** |
| C12 | `cohort.ts:44` `updateMemberCount()` | `Cohort.memberCount` | recount from relation | ✗ | Already recount-style; no callers mutate it otherwise. Out of DEBT-06 wording, leave as is. |

**No `transaction` call exists anywhere in `app/`** [VERIFIED: `grep -rn transaction app` → 0].

**No bulk-import endpoint exists.** CONCERNS.md flags "Bulk Enrollment Import" as fragile, but only the `BulkEnrollmentLog` model exists; no controller, route or service references it [VERIFIED: `grep -rln BulkEnrollmentLog app start inertia` returns only the model]. There is no counter site to fix there.

### Why "wrap it in a transaction" is insufficient

`method.currentEnrollments += 1; await method.save()` compiles to `UPDATE ... SET current_enrollments = <value read earlier>`. Two concurrent requests both read 9 (max 10), both pass `isAvailable()`, and both write 10, so **11 enrolments exist and the counter says 10**. A transaction at default isolation (READ COMMITTED on PG, REPEATABLE READ on MySQL) does not prevent this lost update. `forUpdate()` would, but **knex compiles it to `''` on SQLite** [VERIFIED].

### Recommended pattern: atomic conditional increment inside a managed transaction

```ts
// Portable across PG / MySQL / MariaDB / SQLite.
await db.transaction(async (trx) => {
  // 1. Capacity-guarded atomic increment. Fails closed if full.
  const [affected] = await CourseEnrollmentMethod.query({ client: trx })
    .where('id', method.id)
    .where((q) => q.whereNull('max_enrollments').orWhereRaw('current_enrollments < max_enrollments'))
    .increment('current_enrollments', 1)
  if (!affected) throw new CapacityReachedException()   // → rollback

  // 2. Insert; unique(course_id,user_id) is the real duplicate guard
  await CourseEnrollment.create({ ... }, { client: trx })

  // 3. Unconditional atomic increment (no read-modify-write)
  await Course.query({ client: trx }).where('id', method.courseId).increment('enrolled_count', 1)
})
```
- Lucid returns write-query results as an array: `return Array.isArray(rows) ? rows : [rows]` [VERIFIED: `lucid/build/src/orm/query_builder/index.js:124-133`], so `const [affected]` is the driver's affected-row count. That knex resolves `update`/`increment` to an affected-row **number** on `pg`, `mysql2` and `better-sqlite3` is [ASSUMED: knex documented behaviour; not executed per-driver here]. **Wave 0 should include a functional test that asserts `affected === 0` on a full method, run on the CI pg/mysql/sqlite matrix.**
- `increment` on the model query builder skips model hooks and `updatedAt`; that is acceptable for counters.
- The unique constraint `course_enrollments(course_id, user_id)` exists [VERIFIED: migration `1763139386345:53`]. Treat a unique violation as "already enrolled" instead of pre-checking (the pre-check is also racy). Two details are load-bearing:
  - **Catch it *outside* the `db.transaction()` callback**, after the managed transaction has rolled back. On PostgreSQL a constraint error aborts the transaction; any further statement inside it fails with `current transaction is aborted`. Letting the error propagate out of the callback also rolls back the capacity increment.
  - **Engine-specific error shapes** need one detector, e.g. `isUniqueViolation(err)`: PG `code === '23505'`; MySQL/MariaDB `code === 'ER_DUP_ENTRY'` (errno 1062); SQLite (`better-sqlite3`) `code === 'SQLITE_CONSTRAINT_UNIQUE'` [ASSUMED: driver error codes from training knowledge]. The CI-matrix test must enrol the same user twice and assert a clean "already enrolled" result on all three engines.

### Service shape

`app/services/enrollment_service.ts` owns **all** enrol/unenrol paths:
- `enroll({ course, user, method?, role, enrolledBy, groupId?, trx? })`
- `unenroll(enrollment)`: decrements `enrolled_count`, **and** `current_enrollments` when `enrollmentMethodId` is set, **and** `current_members` for any `course_group_members` rows of that user in that course's groups (also delete those membership rows). The last part is [ASSUMED desired; today group membership survives unenrolment].
- `enrollMany(...)` for `enrollManual`: **one transaction per user**, preserving today's partial-success UX ("3 enrolled, 2 errors"). One transaction for the whole batch would turn a single bad id into a total failure, which is a UX change.

Controllers `enrollWithKey`, `enrollSelf`, `enrollManual`, `unenroll`, `addParticipant`, `removeParticipant` then call the service.

### Repair command

`node ace enrollment:recount [--dry-run]` recomputes `courses.enrolled_count`, `course_enrollment_methods.current_enrollments` and `course_groups.current_members` from `COUNT(*)`. It is needed because **drift already exists**: C9/C11 have never decremented method counters, and the seeders write fake counts.

---

## DEBT-07 Findings: Category hierarchy

### Proof that tree building cannot loop [VERIFIED: code read + reasoning]

`CategoriesController.index` and `inertia/pages/admin/categories/index.tsx:44-47` both do:
```ts
roots = categories.filter(c => c.parentId === null)
buildTree(c) => children = categories.filter(x => x.parentId === c.id) ...
```
Each category has **at most one** `parentId`. If node *n* is reachable from a root *r* via child edges, then following `parentId` from *n* reaches *r* (whose parent is null), so *n* is not on a cycle. **Cycle members are never reached, and recursion terminates.** Their observable effect is that the cycle and everything under it **disappear from the admin tree** while still existing (and still holding courses).

### Where cycles come from and what actually loops

| Site | Behaviour |
|---|---|
| `CategoriesController.update` | Accepts `parentId === category.id` (self-loop) or any descendant id (cycle). Only `edit.tsx` UX excludes self (`whereNot('id', category.id)`); descendants are offered. **This is the bug.** |
| `CategoriesController.store` | New row cannot be an ancestor of anything, so **cannot create a cycle**. |
| `CourseCategory.getFullPath()` | `while (current.parentId)` loops forever on a cycle when `path` is null. **0 callers** today [VERIFIED: grep]. Bound it anyway; Phase 1 01-01 already edits this method's typing. |
| `update` path/depth maintenance | On parent change: recomputes `path`/`depth` for the node only. On slug change: recomputes `path` for **direct children only**. **Grandchildren keep stale `path`; children's `depth` is never updated on a move.** |
| DB | FK `parent_id → course_categories.id ON DELETE CASCADE`; no cycle constraint (not portably expressible). |

The same unscoped-parent pattern exists for **course modules** (`updateModuleValidator.parentId`, A8). Module trees are only ever preloaded two levels deep, so there is no loop, but a self-parented module disappears from `builder`/`learn`. Recommend applying the same `wouldCreateCycle` check plus same-course scoping there.

### Recommended fix
1. **Pure helper** (unit-testable, no DB): `wouldCreateCycle(parentById: Map<number, number|null>, nodeId: number, newParentId: number | null): boolean`. Walk from `newParentId` up via `parentById`; return `true` if it reaches `nodeId`, and also stop on a revisit (pre-existing corrupt data) or after `parentById.size` steps.
2. `update`: load the `(id, parent_id)` pairs once (categories are a small table), reject with a validation error (flash + `redirect().back()`, matching the existing UX) if `wouldCreateCycle`.
3. Recompute `path` and `depth` for the **whole subtree** on move/rename (BFS over the same map) inside a `db.transaction`.
4. Bound `getFullPath` with a visited set; throw on a cycle rather than loop.
5. Optional hardening: `edit.tsx` excludes descendants from the parent picker (UX only; the server check is authoritative).
6. One-off check: `node ace categories:check-integrity` (or fold into a migration) to report existing cycles. Existing data is unknown (see Runtime State).

---

## DEBT-08 Findings: Encryption failure handling

### The real failure semantics [VERIFIED: installed source + executed probe]

`@adonisjs/encryption@6.0.2 Encryption.decrypt(value)` returns **`null`** for: non-string input, wrong part count when split on `.`, bad base64, **HMAC mismatch (wrong/rotated APP_KEY, truncated ciphertext)**, and decipher errors (caught internally). **It never throws.** Probe against the installed package:

```
"0612345678" cipher length = 110
"12 rue de la Paix, 75002 Paris" cipher length = 131
decrypt(plaintext)          -> null
decrypt(truncated cipher)   -> null
decrypt(other APP_KEY)      -> null
```

So in `EncryptionService.decrypt`:
```ts
try { return encryption.decrypt<string>(value) ?? value }   // ?? value  ← the actual silent fallback
catch { return value }                                       // dead code
```

### Callers

| Caller | On failure today |
|---|---|
| `User.phone`, `mobilePhone`, `address`, `identificationNumber` (`consume`) | Returns raw stored string (ciphertext or legacy plaintext) to the app, Inertia props, GDPR export and **audit logs** |
| `TwoFactorService.verifyToken` (`encryption.decrypt` directly) | Returns `false`, so the user sees "Code invalide" forever. **No log.** This is the APP_KEY-rotation lockout. |
| `TwoFactorService.verifyRecoveryCode` | Returns `false`, which also locks out the recovery path. **No log.** |

### 🔴 Live bug: PII columns too small for ciphertext

| Column | Type | Ciphertext size | Engine behaviour on write |
|---|---|---|---|
| `users.phone` | `varchar(20)` (`1761584336360_create_extend_users_table.ts:10`) | ~110 | **PG:** `value too long` error. **MySQL/MariaDB strict:** `Data too long` error. **MySQL non-strict:** silent truncation, so the value is unrecoverable. **SQLite:** stored fine. |
| `users.mobile_phone` | `varchar(20)` (`1769783297617...:13`) | ~110 | same |
| `users.identification_number` | `varchar(255)` | ~110-150 for short IDs | OK for realistic inputs |
| `users.address` | `text` | — | OK |

No later migration widens them [VERIFIED: grep]. `ProfileController.update` wraps the save in `try/catch` → `logger.error` + generic flash, so on PG/MariaDB **a user entering a phone number gets "Erreur lors de la mise à jour du profil" and nothing saves**. Production is MariaDB on Infomaniak; whether it errors or truncates depends on `sql_mode` [ASSUMED: strict, the MariaDB ≥10.2.4 default]. **A functional test that saves a phone via `/user/profile` will prove this on the CI pg and mysql legs.**

### Blast radius of "raise instead of return raw" [VERIFIED: code paths]

`consume` runs on **every** `User` hydration:
- `silent_auth_middleware` (global, every routed request) → `ctx.auth.check()` → session guard loads `User` → `consume` throws. The middleware **catches all errors and treats the user as a guest** (`silent_auth_middleware.ts:15-22`), so a single corrupt PII cell **silently logs the user out**: a *new* silent failure.
- `auth_middleware` routes: same load path, unhandled, so a 500 on every page for that user.
- `UsersController.index` (`preload` over a page of users): **one corrupt row breaks the admin user list**, so the admin cannot even reach the user to fix them.

### Recommended sequence (each step is a separate commit; ordering is load-bearing)

1. **Migration: widen `phone` and `mobile_phone` to `text`** (or `string(512)`). `down()` caveat: narrowing back to `varchar(20)` would fail or truncate once ciphertext exists. Make `down()` a documented no-op, or narrow only if `MAX(LENGTH()) <= 20`. SQLite: knex supports `.alter()` via table rebuild [VERIFIED: knex 3.1 sqlite tablecompiler]. Run it in CI on all three engines.
2. **Scan/repair command** `node ace pii:scan [--fix]`. Read raw columns via `db.from('users')` (bypassing `consume`) and classify each non-null value:
   - `ok`: decrypts
   - `legacy-plaintext`: not 3 dot-separated parts. Possible for rows written before `fae6282` (2026-01-30) on long-lived dev DBs; prod first deployed 2026-05-22, after encryption.
   - `undecryptable`: 3 parts, HMAC fails (truncated or other key)

   `--fix` encrypts `legacy-plaintext`. For `undecryptable`, report only, unless `--null-undecryptable` is given (data loss → user decision, Open Question Q2). **Never log values**, only `user_id`, column and classification.
3. **Then switch `EncryptionService.decrypt` to raise.** On `null`: `logger.error({ column, userId }, 'PII decryption failed')` → `throw new DecryptionException(...)` (custom `Exception`, status 500, code `E_PII_DECRYPTION_FAILED`). Use Lucid's `consume(value, attribute, model)` signature to get the column name and model id for the log [CITED: Phase 1 research `model.d.ts:128` for the `prepare` signature; `consume` has the same shape, ASSUMED].
4. **Change `SilentAuthMiddleware`** to rethrow `DecryptionException` (do not downgrade it to guest), so it surfaces via the handler's 500 page and the log.
5. **`TwoFactorService`**: log `logger.error` when `decrypt` returns `null` for the secret or recovery codes (still return `false`, since that path is a security check and not a data read), and add an audit event `user.2fa.decrypt_failed`. This turns the APP_KEY-rotation lockout from invisible into diagnosable, and it feeds DEBT-09's recovery doc.
6. Unit test `EncryptionService.decrypt` raises on garbage and round-trips valid values (no DB needed; the encryption service boots in the unit suite with `.env.test`'s `APP_KEY`).

---

## DEBT-09 Findings: 2FA pending state

### Current mechanism [VERIFIED: code read]

| Step | Where | State |
|---|---|---|
| Password OK + `twoFactorEnabled` | `auth_controller.ts:43` | `session.put('two_factor_user_id', user.id)` → redirect `/two-factor/challenge` |
| Challenge page | `two_factor_controller.ts:174` `challenge` | Requires key, else redirect to `login`. **No guest middleware, no expiry.** |
| TOTP verify | `:189` `verifyChallenge` | `loginThrottle` (5/min **per IP**, block 5 min). On success: `forget` key, `auth.login` (regenerates session), audit `user.login.2fa` |
| Recovery-code verify | `:225` `verifyRecovery` | Same throttle; consumes one of 10 codes; audit `user.login.2fa.recovery` |
| Session store | `config/session.ts` | cookie store, `age: '2h'`, httpOnly, `sameSite: lax`, `secure` in prod |

**Gaps:**
1. **No explicit timeout.** The pending state lives as long as the session (2h). A password-verified half-login stays valid for hours.
2. **Throttle is per IP only.** A distributed attacker who knows the password gets 5 TOTP guesses/min **per IP**. Add a throttle keyed on the pending user id plus an attempts counter in the pending state.
3. **No admin reset.** `UsersController` has no 2FA action; an admin cannot help a user who lost both device and codes.
4. **No break-glass for the last admin.** If the only admin loses their device and codes, the system has no path.
5. **APP_KEY rotation lockout is silent** (see DEBT-08 step 5).
6. **No documentation.** `docs/USER_MANAGEMENT.md:413` still lists "Authentification à deux facteurs (2FA)" as an unchecked TODO. `README.md` lists it as done.
7. Minor: no TOTP replay protection (a valid code can be reused within its ~90s window). Note it; out of DEBT-09 scope.

### Recommended design

- **Pending state:** `session.put('two_factor_pending', { userId, expiresAt: epochMs, attempts: 0 })`. Remove the bare key. A helper `readPendingTwoFactor(session, now)` returns `{ userId } | { expired: true } | null` (pure; unit-testable with an injected `now`).
- **Timeout:** **10 minutes** [ASSUMED; common range 5-15 min]. On expiry: `forget`, audit `user.login.2fa_expired`, flash "Session expirée, reconnectez-vous", redirect `login`.
- **Attempts cap:** 5 wrong codes per pending state → `forget` + audit `user.login.2fa_locked` → back to login (forces password re-entry). [ASSUMED value]
- **Per-user throttle:** a new `twoFactorThrottle` in `start/limiter.ts`, `.usingKey(`2fa_${pendingUserId ?? ctx.request.ip()}`)`, applied **in addition to** `loginThrottle` on both challenge POSTs.
- **Admin reset:** `POST /admin/users/:id/two-factor/reset` → `UsersController.resetTwoFactor`, inside the existing `role:admin` group, **throttled** (CLAUDE.md), **audited** (`admin.user.2fa.reset` with target `resourceId`). It clears `twoFactorSecret`, `twoFactorEnabled`, `twoFactorRecoveryCodes`, `twoFactorConfirmedAt` (the same 4 fields `disable` and `deleteAccount` clear). Add a button on `inertia/pages/users/show.tsx` or `edit.tsx`.
- **Break-glass CLI:** `node ace user:reset-2fa <email>` (`commands/`, `startApp: true`). It writes an `AuditService.log({ userId: null, action: 'cli.user.2fa.reset', ... })` row.
- **Documented recovery path:** new `docs/TWO_FACTOR_RECOVERY.md` covering the user path (recovery codes, regenerate), the admin path (reset button), the operator path (ace command), and the APP_KEY rotation warning (all 2FA secrets become undecryptable; reset affected users). Also update the stale checkbox in `docs/USER_MANAGEMENT.md`.

---

## Architecture Patterns

### System Architecture Diagram (request flow after Phase 2)

```
 Browser (Inertia)                                   CLI (ops)
      │  POST /courses/:id/enroll/self                  │ node ace enrollment:recount
      ▼                                                 │ node ace pii:scan [--fix]
 ┌───────────────────────────────────────────┐          │ node ace user:reset-2fa <email>
 │ router.where(':id', matchers.number())    │──non-numeric──► 404
 └────────────────────┬──────────────────────┘
                      ▼
 ┌───────────────────────────────────────────┐
 │ router middleware: bodyparser → session → │
 │ shield(CSRF) → initialize_auth →          │
 │ silent_auth ──(User.consume → decrypt)────┼──DecryptionException──┐
 │ initialize_bouncer  (ctx.bouncer)         │                        │
 └────────────────────┬──────────────────────┘                        │
                      ▼                                               │
 ┌───────────────────────────────────────────┐                        │
 │ named: auth → role({roles}) (coarse gate) │──fail──► 403 JSON      │
 └────────────────────┬──────────────────────┘                        │
                      ▼                                               │
 ┌───────────────────────────────────────────┐                        │
 │ Controller                                │                        │
 │  1. payload = validateUsing(Validator) ───┼──fail──► 422 / flash   │
 │  2. course = Course.findOrFail(params.id) │                        │
 │  3. bouncer.with(CoursePolicy)            │                        │
 │       .authorize('enroll', course) ───────┼──deny──┐               │
 │  4. child ids scoped: where(course_id)    │        │               │
 │  5. EnrollmentService.enroll(...)         │        │               │
 └────────────────────┬──────────────────────┘        │               │
                      ▼                               ▼               ▼
 ┌───────────────────────────────────────────┐  ┌──────────────────────────────┐
 │ db.transaction(trx):                      │  │ HttpExceptionHandler.handle  │
 │  UPDATE methods SET cur=cur+1             │  │  E_AUTHORIZATION_FAILURE ──► │
 │   WHERE id=? AND (max IS NULL OR cur<max) │  │    Inertia errors/forbidden  │
 │  affected=0 ─► CapacityReached ─► rollback│  │  DB conn error ─► Edge page  │
 │  INSERT course_enrollments (unique c,u)   │  │  else super.handle (status   │
 │  UPDATE courses SET n=n+1                 │  │       pages 404/429/5xx)     │
 └────────────────────┬──────────────────────┘  └──────────────────────────────┘
                      ▼
               AuditService (security-relevant) → redirect + flash
```

### Recommended Project Structure (new files only)
```
app/
├── abilities/main.ts                     # generated by configure; leave near-empty
├── policies/
│   ├── main.ts                           # export const policies = { course: () => import(...), enrollment: ... }
│   ├── course_policy.ts                  # view, learn, edit, manage, delete, viewGradebook, enroll, administer
│   └── enrollment_policy.ts              # unenroll
├── middleware/initialize_bouncer_middleware.ts   # generated
├── services/
│   ├── enrollment_service.ts             # all counter mutations, transactional
│   └── encryption_service.ts             # (modified) raise + log
├── helpers/category_tree.ts              # wouldCreateCycle(), recomputeSubtree() (pure)
├── exceptions/
│   ├── decryption_exception.ts
│   └── capacity_reached_exception.ts
├── validators/
│   ├── enrollment.ts                     # V9-V12
│   ├── enrollment_method.ts              # V1-V2
│   ├── course_group.ts                   # V3-V4
│   ├── course_admin.ts                   # V5-V7, index filters (V14)
│   ├── category.ts                       # moved inline + reorder (V8)
│   ├── listing.ts                        # users.index, audit_logs.index (V15-V16)
│   ├── two_factor.ts / account.ts        # moved inline
commands/
├── enrollment_recount.ts
├── pii_scan.ts
└── user_reset_two_factor.ts
database/migrations/<ts>_widen_users_pii_columns.ts
inertia/pages/errors/forbidden.tsx
docs/TWO_FACTOR_RECOVERY.md
tests/unit/category_tree.spec.ts, encryption_service.spec.ts, two_factor_pending.spec.ts
tests/functional/authorization.spec.ts, enrollment_counters.spec.ts, categories.spec.ts,
                 validation.spec.ts, two_factor.spec.ts, pii.spec.ts
```

### Pattern 1: Policy with admin bypass (Bouncer 3.x)
```ts
// app/policies/course_policy.ts
// Source: @adonisjs/bouncer@3.1.6 stubs (make/policy) + PolicyAuthorizer.execute order (verified)
import User from '#models/user'
import Course from '#models/course'
import CourseEnrollment from '#models/course_enrollment'
import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'

export default class CoursePolicy extends BasePolicy {
  // Runs BEFORE the guest check → user may be null
  async before(user: User | null) {
    if (user && (await user.hasRole('admin'))) return true
  }

  view(user: User, course: Course): AuthorizerResponse | Promise<AuthorizerResponse> {
    if (course.visibility === 'public') return true
    return course.hasPermission(user.id, 'view')
  }
  edit(user: User, course: Course) { return course.hasPermission(user.id, 'edit') }
  manage(user: User, course: Course) { return course.hasPermission(user.id, 'manage') }
  delete(user: User, course: Course) { return course.instructorId === user.id }

  async learn(user: User, course: Course) {
    if (await course.hasPermission(user.id, 'edit')) return true
    const enrolled = await CourseEnrollment.query()
      .where('course_id', course.id).where('user_id', user.id).first()
    return !!enrolled
  }
}
```
```ts
// app/policies/main.ts
export const policies = {
  CoursePolicy: () => import('#policies/course_policy'),
  EnrollmentPolicy: () => import('#policies/enrollment_policy'),
}
```

### Pattern 2: Controller asks, scopes children
```ts
// app/controllers/course_contents_controller.ts — reorderModules (fixes A2)
async reorderModules({ request, params, bouncer, response, session }: HttpContext) {
  const course = await Course.findOrFail(params.id)
  await bouncer.with('CoursePolicy').authorize('edit', course)
  const payload = await request.validateUsing(reorderModulesValidator)

  await db.transaction(async (trx) => {
    for (const item of payload.modules) {
      await CourseModule.query({ client: trx })
        .where('id', item.id)
        .where('course_id', course.id)          // ← the IDOR fix
        .update({ order: item.order })
    }
  })
  session.flash('success', 'Modules réordonnés avec succès')
  return response.redirect().back()
}
```

### Pattern 3: Handler intercept for Bouncer denials (must precede `super.handle`)
```ts
// app/exceptions/handler.ts — inside handle(), after the DB-connection branch
// Source: http-server/build/index.js:283-292 (self-handled exceptions skip statusPages)
import { errors as bouncerErrors } from '@adonisjs/bouncer'

if (error instanceof bouncerErrors.E_AUTHORIZATION_FAILURE) {
  // Inertia XHR *and* full-page browser navigations get the page; JSON clients
  // (e.g. updateProgress / getCourseProgress fetch calls) keep Bouncer's JSON body.
  const wantsJson = ctx.request.accepts(['html', 'json']) === 'json' && !ctx.request.header('x-inertia')
  if (!wantsJson) {
    ctx.response.status(error.status)
    return ctx.inertia.render('errors/forbidden', { message: error.getResponseMessage(ctx) })
  }
}
```
`errors` is exported from the package root (`export * as errors from './src/errors.js'`) [VERIFIED: bouncer@3.1.6 `build/index.d.ts`]. Phase 1 plan 01-01 rewrites this file's `as any` casts into type guards; **build on 01-01's version**.

### Anti-Patterns to Avoid
- **Policy check on the parent, unscoped query on the child.** This is the cause of A2-A4 and A9. Authorization of `course` means nothing if the next query does `where('id', item.id)` without `course_id`.
- **Read-modify-write counters** (`x += 1; save()`), even inside a transaction.
- **`forUpdate()` as the race fix.** It silently does nothing on SQLite.
- **Throwing from `consume` before the data is clean.** It locks users out at `auth.check()`.
- **`node ace add @adonisjs/bouncer`.** It installs 4.x (core 7).
- **A `'403'` status page as the Bouncer renderer.** It never fires (self-handled exception).
- **Relying on `auth.user!.roles` being loaded.** Use `hasRole()` (lazy-loads) or the policy.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Authorization framework | Custom `PermissionService` with ad-hoc `can()` | `@adonisjs/bouncer@^3.1.6` | Hooks, typed actions, container injection, standard exception; Phase 12 extends it |
| Non-numeric route ids | `Number(params.id)` + NaN checks per action | `router.where(name, router.matchers.number())` | Global, casts, 404 on mismatch |
| Concurrency-safe counters | Locks, mutexes, retry loops | Conditional `UPDATE ... increment` + affected-row check in `db.transaction` | One statement, all 4 engines |
| Duplicate-enrolment detection | `SELECT` then `INSERT` | Existing unique `(course_id, user_id)` + catch unique violation | Pre-check is racy |
| Throttling the 2FA challenge | Session counters alone | `@adonisjs/limiter` `.usingKey()` + attempts in the pending state | Limiter survives session reset |
| Request validation | `if (!x) ...` in controllers | VineJS validators | Typed output, consistent 422/flash |
| Encrypted PII read | Try-parse heuristics in controllers | One `EncryptionService.decrypt` that raises + one `pii:scan` command | Single failure point, observable |

**Key insight:** most Phase 2 bugs are *gaps between* existing primitives (policy vs query scope, transaction vs atomic SQL, validator vs actual form payload), not missing primitives. Each fix should close one specific gap and be proven by a test that exercises it.

---

## Plan Sequencing (file-ownership collisions)

The sketched plans **collide on the same files**, and `parallelization: true` in config would otherwise schedule them together.

| File | 02-01 Policy | 02-02 Validators | 02-03 Counters+Categories | 02-04 Encryption+2FA |
|---|:-:|:-:|:-:|:-:|
| `courses_controller.ts` | ✎ | ✎ | ✎ (participants) | |
| `enrollments_controller.ts` | ✎ | ✎ | ✎ | |
| `course_contents_controller.ts` | ✎ | ✎ (learn) | | |
| `categories_controller.ts` | | ✎ (reorder) | ✎ | |
| `users_controller.ts` | | ✎ (index) | | ✎ (reset) |
| `start/routes.ts` | | ✎ (matchers) | | ✎ (reset route) |
| `app/exceptions/handler.ts` | ✎ | | | |
| `start/kernel.ts`, `adonisrc.ts`, `package.json` | ✎ | | | |
| `silent_auth_middleware.ts`, `encryption_service.ts`, `two_factor_*`, `auth_controller.ts`, `start/limiter.ts`, migration, `docs/` | | | | ✎ |

**Recommended waves:**
- **Wave 1 (parallel):** **02-01** (Bouncer + policies + IDOR scoping + handler + 403 page) ∥ **02-04** (encryption sequence + 2FA). Disjoint, except that 02-04 adds one route; give 02-04 the `routes.ts` edit and keep 02-01 out of `routes.ts`.
- **Wave 2:** **02-02** (validators + route matchers). Validators define the typed payloads the service consumes.
- **Wave 3:** **02-03** (`EnrollmentService` + recount + category cycle). Built on Wave 1's policies and Wave 2's payload types.

`granularity: fine`: 02-01 is large (~40 sites, 4 controllers). Consider splitting it: **02-01a** install + `CoursePolicy` + handler + `courses_controller`; **02-01b** `course_contents`/`enrollments`/`grades` + IDOR fixes. Likewise 02-04 could split: **02-04a** PII (migration, scan, raise); **02-04b** 2FA (state, throttle, reset, CLI, doc).

**Overlap with Phase 1 (must execute after it):** Phase 1 01-01 edits `user.ts`, `cohort.ts`, `course_category.ts`, `dashboard_controller.ts`, `handler.ts`, `course_contents_controller.ts`. 01-02 edits `course.ts` (`canEnroll`). 01-03 creates `.env.test`, `tests/bootstrap.ts` plugins and the functional suite. 01-05 enforces CI gates. **Every Phase 2 test depends on 01-03**, and the `enroll` policy semantics depend on 01-02's `canEnroll` fix.

---

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| **Stored data** | (a) Counter drift: `courses.enrolled_count` seeded with fake values (35/28/42/55/18) with no matching enrollment rows; `course_enrollment_methods.current_enrollments` never decremented on unenrol/removeParticipant. (b) PII: possible legacy-plaintext rows on dev DBs created before `fae6282`; possible **truncated ciphertext** in `phone`/`mobile_phone` on any non-strict MySQL. (c) Category cycles: unknown, none possible via `store`, possible via `update`. | (a) **data repair**: `enrollment:recount` per environment (changes demo numbers). (b) **data migration**: widen columns, then `pii:scan` per environment **before** enabling raise. (c) integrity check command / report. |
| **Live service config** | Production on Infomaniak MariaDB (`DB_CONNECTION=mysql`). `sql_mode` not known. Build command runs `node ace migration:run --force` on deploy. | Confirm `sql_mode` (Open Question Q1). Note that ace **commands** (`pii:scan`, `recount`) are **not** run by the deploy pipeline; they must be run manually in the pod or added to the build command. |
| **OS-registered state** | None: no cron, pm2, launchd [VERIFIED: no ecosystem files; deploy = Infomaniak panel]. | None |
| **Secrets / env vars** | `APP_KEY` encrypts PII **and** TOTP secrets/recovery codes. Rotating it makes all of them undecryptable. No key-rotation support in `@adonisjs/encryption@6` single-key setup [ASSUMED]. | Document in `TWO_FACTOR_RECOVERY.md`; no rename. `.env.test` `APP_KEY` (from Phase 1) is sufficient for unit tests. |
| **Session state** | Live sessions hold `two_factor_user_id`. Renaming to `two_factor_pending` means users **mid-challenge at deploy time are bounced to login** (harmless: they re-enter their password). | Release note only; optionally read the legacy key once and treat it as expired. |
| **Build artifacts** | `build/` (stale, gitignored). New `commands/*.ts` need `node ace build` to appear in `build/commands`. | None beyond the normal build. |

---

## Common Pitfalls

### Pitfall 1: Installing Bouncer latest
**What goes wrong:** `node ace add @adonisjs/bouncer` or `bun add @adonisjs/bouncer` installs 4.0.1, which needs `@adonisjs/core ^7`, giving peer conflicts and runtime import failures.
**Avoid:** `bun add @adonisjs/bouncer@^3.1.6 && node ace configure @adonisjs/bouncer`.
**Warning sign:** `package.json` shows `"@adonisjs/bouncer": "^4`.

### Pitfall 2: Expecting a `'403'` status page to render Bouncer denials
**What goes wrong:** Users see a raw "Access denied" text modal from Inertia.
**Why:** `AuthorizationException.handle()` is self-handling and runs before `statusPages`.
**Avoid:** Intercept in `HttpExceptionHandler.handle()` before `super.handle`.

### Pitfall 3: Authorizing the parent, mutating an unscoped child
**What goes wrong:** IDOR survives the policy refactor (A2-A4, A9).
**Avoid:** Every child query carries `where('course_id', course.id)` (or the module equivalent). The functional test should attempt a cross-course id and assert it has no effect.

### Pitfall 4: "Transactional" counters that still race
**What goes wrong:** `trx` wraps `x += 1; save()`; concurrent enrolments still exceed `maxEnrollments`.
**Avoid:** Conditional atomic `increment` + affected-row check, with the unique-violation catch placed outside the transaction callback (PG aborts the transaction on constraint errors) and one cross-engine detector (`23505` / `ER_DUP_ENTRY` / `SQLITE_CONSTRAINT_UNIQUE`). **Do not** cite a test as proof of race safety: under `withGlobalTransaction()` and SQLite, all queries in a test share one connection and run serially. Prove the invariant sequentially (fill to capacity → next enrol rejected; counter equals `COUNT(*)` after mixed ops) and argue race safety from the SQL.

### Pitfall 5: Enabling raise-on-decrypt before data is clean
**What goes wrong:** Users with a corrupt/plaintext PII cell are silently logged out (silent-auth swallows the error) or 500 on every page. The admin user list breaks.
**Avoid:** widen → scan/fix → raise → change silent-auth to rethrow. Gate the "raise" commit on a clean `pii:scan` in each environment (`checkpoint:human-verify`).

### Pitfall 6: A reversible-looking `down()` that destroys ciphertext
**What goes wrong:** `down()` alters `phone` back to `varchar(20)`; PG/MySQL error or truncate.
**Avoid:** A no-op `down()` with a comment, or a guarded narrow.

### Pitfall 7: Logging PII while logging decryption failures
**What goes wrong:** `logger.error('failed to decrypt %s', value)` writes ciphertext (or plaintext) to logs.
**Avoid:** Log `{ column, userId, length }` only.

### Pitfall 8: Category check only on the UI
**What goes wrong:** `edit.tsx` hides descendants, but a crafted PUT still creates a cycle.
**Avoid:** Server-side `wouldCreateCycle` is authoritative; the UI filter is cosmetic.

### Pitfall 9: Policy refactor silently changes who can do what
**What goes wrong:** `viewGradebook`, `learn`, `enroll` rules differ from today's behaviour (see the behaviour-preservation table). Shipped under "refactor", they surprise teachers and admins.
**Avoid:** Commit behaviour changes separately with `fix(...)`/`feat(...)` messages; get user confirmation (no CONTEXT.md exists).

### Pitfall 10: Breaking existing validator-dependent forms
**What goes wrong:** Tightening `updateCourseValidator` (e.g. making `tags` accept a string) changes the edit form contract; `createCourseValidator.category` → `categoryId` changes `create.tsx`.
**Avoid:** Fix validator and form together; add a functional test per form payload shape.

---

## Code Examples

### Atomic, capacity-guarded enrolment
```ts
// app/services/enrollment_service.ts (sketch)
// Sources: lucid query_builder write-result shape (verified), knex sqlite forUpdate no-op (verified)
import db from '@adonisjs/lucid/services/db'
import Course from '#models/course'
import CourseEnrollment from '#models/course_enrollment'
import CourseEnrollmentMethod from '#models/course_enrollment_method'
import CapacityReachedException from '#exceptions/capacity_reached_exception'

export default class EnrollmentService {
  static async enrollViaMethod(method: CourseEnrollmentMethod, userId: number) {
    return db.transaction(async (trx) => {
      const [affected] = await CourseEnrollmentMethod.query({ client: trx })
        .where('id', method.id)
        .where((q) =>
          q.whereNull('max_enrollments').orWhereRaw('current_enrollments < max_enrollments')
        )
        .increment('current_enrollments', 1)
      if (!affected) throw new CapacityReachedException()

      const enrollment = await CourseEnrollment.create(
        { courseId: method.courseId, userId, enrollmentMethodId: method.id, /* ... */ },
        { client: trx }
      )
      await Course.query({ client: trx }).where('id', method.courseId).increment('enrolled_count', 1)
      return enrollment
    })
  }
}
```

### Pure cycle check
```ts
// app/helpers/category_tree.ts
export function wouldCreateCycle(
  parentById: ReadonlyMap<number, number | null>,
  nodeId: number,
  newParentId: number | null
): boolean {
  let current = newParentId
  const seen = new Set<number>()
  while (current !== null) {
    if (current === nodeId) return true
    if (seen.has(current)) return true          // pre-existing corrupt cycle above
    seen.add(current)
    current = parentById.get(current) ?? null
  }
  return false
}
```

### Raising decrypt
```ts
// app/services/encryption_service.ts
import encryption from '@adonisjs/core/services/encryption'
import logger from '@adonisjs/core/services/logger'
import DecryptionException from '#exceptions/decryption_exception'

static decrypt(value: string | null | undefined, ctx?: { column?: string; id?: unknown }) {
  if (value === null || value === undefined || value === '') return value as string | null
  const out = encryption.decrypt<string>(value)   // returns null on ANY failure; never throws
  if (out === null) {
    logger.error({ column: ctx?.column, id: ctx?.id, length: value.length }, 'PII decryption failed')
    throw new DecryptionException(`Cannot decrypt ${ctx?.column ?? 'value'}`)
  }
  return out
}
// model: consume: (v, attribute, model) => EncryptionService.decrypt(v, { column: attribute, id: model.$primaryKeyValue })
```

### Pending 2FA state
```ts
// app/helpers/two_factor_pending.ts (pure)
export const TWO_FACTOR_PENDING_TTL_MS = 10 * 60 * 1000   // [ASSUMED value]
export type Pending = { userId: number; expiresAt: number; attempts: number }

export function readPending(raw: unknown, now: number):
  | { status: 'none' } | { status: 'expired' } | { status: 'ok'; pending: Pending } {
  if (!raw || typeof raw !== 'object') return { status: 'none' }
  const p = raw as Partial<Pending>
  if (typeof p.userId !== 'number' || typeof p.expiresAt !== 'number') return { status: 'none' }
  if (now >= p.expiresAt) return { status: 'expired' }
  return { status: 'ok', pending: { userId: p.userId, expiresAt: p.expiresAt, attempts: p.attempts ?? 0 } }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bouncer v2 (`Bouncer.define` in `start/bouncer.ts`, Adonis v5) | Bouncer v3: `BasePolicy` classes, `app/policies/main.ts`, `initialize_bouncer_middleware`, `ctx.bouncer` | AdonisJS 6 (2024) | Old blog posts show the v5 API. Ignore them. |
| Bouncer v3 (core 6) | Bouncer v4 (core 7) | 4.0.0 / 2026 | `latest` tag is v4; the docs site now documents v7. **Pin v3; read v6-docs.adonisjs.com.** |
| `wrapInGlobalTransaction()` (v7 docs) | `withGlobalTransaction()` (installed Lucid 21.8) | — | Carried over from Phase 1 research; same drift applies here. |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| AS1 | Production MariaDB runs in strict `sql_mode` (phone save errors rather than truncates) | DEBT-08 | If non-strict, prod already holds truncated, unrecoverable phone ciphertext; `pii:scan` must expect `undecryptable` rows |
| AS2 | Widening `viewGradebook` to admins/`edit` co-instructors is desired | DEBT-04 | Unwanted access expansion |
| AS3 | Requiring enrolment for `outline`/`progress`/`updateProgress`/`markComplete` is desired | DEBT-04 | Breaks any flow where non-enrolled users preview outlines (e.g. a "course preview" link) |
| AS4 | Server-side `course.canEnroll()` check in `enrollSelf`/`enrollWithKey` is desired | DEBT-04/06 | Enrolments that "worked" (draft courses, out-of-window) start being rejected |
| AS5 | Unenrol should also remove the user's group memberships and decrement `current_members` | DEBT-06 | Group rosters change on unenrol |
| AS6 | Pending-2FA TTL 10 min, 5 attempts | DEBT-09 | Too short frustrates users; too long weakens the control |
| AS7 | knex resolves `update`/`increment` to an affected-row number on pg, mysql2, better-sqlite3 | DEBT-06 | Capacity guard always passes or always fails. **Mitigated by the Wave 0 matrix test.** |
| AS9 | Lucid `consume` receives `(value, attribute, model)` | DEBT-08 | Logging context unavailable; fall back to a column-specific closure per column |
| AS10 | `vine.file()` and Lucid `exists` rules are available in the installed vine/lucid providers | DEBT-05 | Use `request.file()` / a manual existence query instead |
| AS11 | Teachers creating a course directly as `published` is unintended | DEBT-05 | Constraining `status` breaks a workflow someone relies on |
| AS12 | No APP_KEY rotation support in the single-key encryption setup | Runtime State | Rotation guidance in the doc would be wrong |

---

## Open Questions

1. **Q1: Production MariaDB `sql_mode`**
   - Known: prod is MariaDB via `mysql2`; phone/mobile_phone are `varchar(20)`; ciphertext is ~110 chars.
   - Unclear: whether writes error (strict) or truncate (non-strict).
   - Recommendation: run `SELECT @@sql_mode;` and `SELECT id, LENGTH(phone), LENGTH(mobile_phone) FROM users WHERE phone IS NOT NULL OR mobile_phone IS NOT NULL;` on prod before 02-04 executes. Read-only, user action.
2. **Q2: Undecryptable PII policy**
   - Known: scan can classify rows.
   - Unclear: null them (data loss, GDPR-neutral) or keep and block the user until an admin edits them?
   - Recommendation: default to report-only; `--null-undecryptable` requires explicit user consent.
3. **Q3: Course-level roles for Phase 12**
   - Known: `course_enrollments.course_role` and `user_roles.course_id` exist but are ignored by authorization.
   - Recommendation: Phase 2 preserves current semantics (owner + `course_permissions`); record this as a Phase 12 decision.
4. **Q4: Approval-workflow bypass**
   - `createCourseValidator.status` lets teachers publish directly. Constrain `status` to `draft` for non-admins?
   - Recommendation: flag; do not change in Phase 2 without confirmation.
5. **Q5: Behaviour changes AS2-AS5**
   - Recommendation: one `checkpoint:human-verify` in the 02-01 plan, listing the policy table.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | v22.18 (Phase 1 probe); fnm also exposes v24.20 | — |
| bun | install (CLAUDE.md) | ✓ | — | pnpm → npm |
| `@adonisjs/bouncer@3.1.6` | DEBT-04 | ✗ not installed | registry 3.1.6 | **None, must install** |
| SQLite (`better-sqlite3` 12.8) | local functional tests (`.env.test` from Phase 1) | ✓ | 12.8.0 | — |
| PostgreSQL / MySQL | engine-specific proofs (varchar overflow, affected-row semantics) | CI service containers (`postgres:16`, `mysql:8.0`) | — | Local docker compose (`docker compose up postgres|mysql`) |
| MariaDB | prod parity | ✗ not in CI matrix (noted in Phase 1) | — | Accept mysql:8.0 as proxy; Q1 checks prod directly |
| `.env.test`, `@japa/api-client`, functional suite | all Phase 2 tests | ✗ **until Phase 1 01-03 executes** | — | **Blocking: Phase 2 must run after Phase 1** |
| `slopcheck` | legitimacy gate | ✓ `~/Library/Python/3.9/bin/slopcheck` (not on PATH) | — | — |
| `ctx7` / Context7 | docs | ✗ | — | Read installed `node_modules` source + v6-docs.adonisjs.com (more accurate for pinned versions) |

**Missing, no fallback:** `@adonisjs/bouncer` (install step); Phase 1 test infrastructure (sequencing).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Japa `@japa/runner` 4.4.0 + `@japa/assert`; `@japa/api-client` 3.2.1 **added by Phase 1 01-03** |
| Config file | `tests/bootstrap.ts`, `adonisrc.ts` `tests.suites` |
| Suites | `unit` (**DB-free by Phase 1 contract**: migrate hook scoped to `functional` only, because its teardown runs `migration:reset`), `functional` (migrate once + `withGlobalTransaction()` per test, SQLite via `.env.test`) |
| Quick run | `node ace test unit` (no DB) |
| Functional run | `node ace test functional` |
| Full suite | `bun run lint && bun run typecheck && node ace test unit && node ace test functional` |

Facts that shape test design [VERIFIED]:
- App code calling `db.transaction()` inside a test running under `withGlobalTransaction()` gets a **nested transaction (savepoint)**. `Database.connection()` returns the global `TransactionClient` (`lucid/build/src/database/main.js:86-89`), and `TransactionClient.transaction()` calls `knexClient.transaction()` on it. Service rollbacks therefore roll back only their savepoint; the test still rolls back everything at the end.
- Policies, counters, categories-against-DB and PII round-trips need the DB → **functional** suite. Pure logic → **unit**.
- Concurrency cannot be demonstrated under a global transaction on SQLite (serial). Test invariants, not races.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEBT-04 | Owner/edit/manage/admin/student matrix for `CoursePolicy` actions | functional | `node ace test functional --files tests/functional/authorization.spec.ts` | ❌ Wave 0 |
| DEBT-04 | Cross-course `reorderModules`/`reorderContents`/`removePermission` ids have no effect (A2-A4) | functional | same file | ❌ Wave 0 |
| DEBT-04 | `unenroll` self succeeds (A1 regression) | functional | same file | ❌ Wave 0 |
| DEBT-04 | Inertia request denied → 403 renders `errors/forbidden` | functional | `client.get(...).withInertia().loginAs(student)` → `assertStatus(403)`, `assertInertiaComponent('errors/forbidden')` | ❌ Wave 0 |
| DEBT-04 | No inline checks remain | static | `grep -rn "hasPermission(\|hasRole(\|instructorId ===\|isInstructor(\|\.roles\.some(" app/controllers \| wc -l` → 0 | ❌ gate |
| DEBT-05 | Missing/invalid body on V1-V12 → 422 (or flash+redirect), never 500 | functional | `tests/functional/validation.spec.ts` | ❌ Wave 0 |
| DEBT-05 | `/courses/abc` → 404 (matchers) | functional | same | ❌ Wave 0 |
| DEBT-05 | No raw input reads | static | `grep -rn "request\.\(only\|input\|all\)(" app/controllers \| wc -l` → 0 | ❌ gate |
| DEBT-06 | Full method (`max=1`, one enrolled) rejects next enrol; counters unchanged | functional | `tests/functional/enrollment_counters.spec.ts` | ❌ Wave 0 |
| DEBT-06 | After enrol ×3, unenrol ×1, removeParticipant ×1: `enrolled_count`, `current_enrollments`, `current_members` == `COUNT(*)` | functional | same | ❌ Wave 0 |
| DEBT-06 | `increment` affected-row semantics hold on each engine | functional (CI matrix pg/mysql/sqlite) | same file, runs in the `ci.yml` matrix | ❌ Wave 0 |
| DEBT-06 | `enrollment:recount` fixes seeded drift | functional | invoke via `ace.exec('enrollment:recount')` from `@adonisjs/core/services/ace` [ASSUMED API] or test the service function it wraps | ❌ Wave 0 |
| DEBT-07 | `wouldCreateCycle` for self, child, grandchild, unrelated, pre-existing cycle | unit | `node ace test unit --files tests/unit/category_tree.spec.ts` | ❌ Wave 0 |
| DEBT-07 | PUT category with descendant parent → rejected, DB unchanged; move recomputes grandchild `path`/`depth` | functional | `tests/functional/categories.spec.ts` | ❌ Wave 0 |
| DEBT-08 | `decrypt(garbage)` throws `DecryptionException`; round-trip OK; no value in log | unit | `tests/unit/encryption_service.spec.ts` | ❌ Wave 0 |
| DEBT-08 | Saving a 10-digit phone via `/user/profile` persists and reads back (proves column widening on pg/mysql) | functional (CI matrix) | `tests/functional/pii.spec.ts` | ❌ Wave 0 |
| DEBT-08 | `pii:scan` classifies ok / legacy-plaintext / undecryptable rows inserted via raw `db.table('users')` | functional | same | ❌ Wave 0 |
| DEBT-09 | `readPending` none/expired/ok with injected `now` | unit | `tests/unit/two_factor_pending.spec.ts` | ❌ Wave 0 |
| DEBT-09 | Expired pending state → redirect login + audit row; 6th wrong code clears state | functional | `tests/functional/two_factor.spec.ts` (session manipulation via `withSession()` from `sessionApiClient` [ASSUMED API]) | ❌ Wave 0 |
| DEBT-09 | Admin reset clears 4 fields, writes `admin.user.2fa.reset`; non-admin → 403 | functional | same | ❌ Wave 0 |
| DEBT-09 | Recovery doc exists and is linked | static | `test -f docs/TWO_FACTOR_RECOVERY.md` | ❌ |

### Sampling Rate
- **Per task commit:** `bun run lint && bun run typecheck && node ace test unit`
- **Per wave merge:** `node ace test functional` (SQLite) plus the two grep gates
- **Phase gate:** full suite green on the CI matrix (pg/mysql/sqlite) before `/gsd:verify-work`; this is what proves the engine-specific claims (AS7, varchar)

### Wave 0 Gaps
- [ ] Phase 1 executed (01-03 test infra + 01-05 CI gates): **hard prerequisite**
- [ ] `tests/functional/helpers/factories.ts` (or inline helpers): create user-with-role, course, method, enrollment. **No model factories exist**; CLAUDE.md forbids new *seeders*, not test helpers. Use unique emails (`x-${Date.now()}@test`) to avoid seeder collisions.
- [ ] `tests/unit/category_tree.spec.ts`, `encryption_service.spec.ts`, `two_factor_pending.spec.ts`
- [ ] `tests/functional/authorization.spec.ts`, `validation.spec.ts`, `enrollment_counters.spec.ts`, `categories.spec.ts`, `pii.spec.ts`, `two_factor.spec.ts`
- [ ] Optional `package.json` script `"check:debt"` running the two grep gates

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (2FA) | TOTP via `otpauth`; pending-state TTL + attempts; per-user limiter; audited admin reset |
| V3 Session Management | yes | `@adonisjs/session` (encrypted cookie), `session.regenerate()` on login (verified); pending-2FA key with expiry |
| V4 Access Control | **yes, primary** | `@adonisjs/bouncer@3` policies; child-id scoping; route role middleware |
| V5 Input Validation | yes | VineJS validators; route param matchers |
| V6 Cryptography | yes | `@adonisjs/encryption` (AES-256-CBC + HMAC); never hand-roll; fail loudly |
| V7 Error Handling & Logging | yes | Decryption failures logged without values; audit events for 2FA expiry/lock/reset |
| V11 Business Logic | yes | Atomic capacity guards; enrolment window via `canEnroll` |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR via unscoped child ids (A2-A5, A8-A9) | Tampering / Info disclosure | Authorize parent with policy **and** scope child query by parent id |
| Privilege escalation via mass assignment (`request.only` → `create`) | Elevation | Validators with explicit field lists + enums |
| Race on capacity (overbooking) | Tampering | Conditional atomic UPDATE + affected-row check |
| TOTP brute force across IPs | Spoofing | Limiter keyed on pending user id + attempts cap + TTL |
| Silent auth downgrade on decryption error | Repudiation / DoS | Rethrow `DecryptionException`; log |
| PII in logs while reporting failures | Info disclosure | Log ids/columns only |
| Unbounded `limit` on listings | DoS | Validator `max()` |

---

## Out-of-Scope Findings (log, do not plan)

- 🔴 **Plaintext PII in audit logs.** `UsersController.store/update/forceDestroy` and `ProfileController.update` pass `user.serialize()` as `oldValues`/`newValues`. That includes **decrypted** `phone`, `mobilePhone`, `address`, `identificationNumber`, so the column-level encryption is bypassed in `audit_logs`. It is a GDPR-relevant leak and should be its own task or phase. A minimal fix is to strip PII keys (or mark the columns `serializeAs: null` plus an explicit profile serializer).
- `AccountController.exportData` queries `Submission.query().where('user_id', ...)`, but `Submission` has **no `user_id` column**: it declares `studentId` (`app/models/submission.ts:15`, FK at `:94`) [VERIFIED]. The GDPR export will raise an unknown-column error on PG/MySQL (and likely SQLite), so data portability is broken. Verify by execution in a quick task.
- `SocialAuthController.generateRandomPassword` uses `Math.random()`. Use `randomBytes` (already used in `account_controller`).
- No TOTP replay protection.
- Menu tree (`menu.ts`) uses a map-based builder that is cycle-safe for the same reason as categories; no action.

---

## Sources

### Primary (HIGH confidence)
- Working tree at `9867a76`: every controller, `start/routes.ts`, `start/kernel.ts`, `start/limiter.ts`, `config/session.ts`, `config/inertia.ts`, models (`course`, `course_category`, `course_enrollment_method`, `course_group`, `course_permission`, `user`, `cohort`), services, validators, relevant migrations, `inertia/pages/{courses/create,admin/courses/settings,admin/categories/index,two-factor/challenge}.tsx`
- `node_modules/@adonisjs/encryption@6.0.2/build/chunk-CEXVRLXG.js` (decrypt never throws) + executed probe (ciphertext lengths, null on plaintext/truncated/rotated key)
- `node_modules/@adonisjs/lucid@21.8.0`: `base_model/index.js:1128` (`$getRelated`), `:1276-1323` (`merge` throws on unknown keys), `orm/query_builder/index.js:124-133` (write-query result shape), `database/main.js:86-89` (global transaction), `transaction_client/index.js:197` (nested transactions), `types/model.d.ts`, `types/querybuilder.d.ts`
- `node_modules/knex@3.1.0`: sqlite `forUpdate = ''`, sqlite `alterColumn`
- `node_modules/@adonisjs/http-server/build/index.js:283-292` (self-handled exceptions before status pages)
- `node_modules/@adonisjs/core/build/modules/http/request_validator.js:65-69` (validateUsing data incl. params)
- `node_modules/@adonisjs/auth@9.5.1/build/modules/session_guard/main.js:282` (session regenerate)
- `@adonisjs/bouncer@3.1.6` tarball (read-only): `build/src/*.d.ts`, `build/chunk-AMP4VOSN.js` (`AuthorizationException.handle`, `PolicyAuthorizer.execute` hook order), stubs, configure hook
- npm registry: `@adonisjs/bouncer` versions, peers, maintainers, scripts, weekly downloads

### Secondary (MEDIUM confidence)
- https://v6-docs.adonisjs.com/guides/security/authorization: install/configure, `BasePolicy`, `before`/`after`, `allowGuest`, `bouncer.with().denies()`, `E_AUTHORIZATION_FAILURE`
- `.planning/phases/01-code-health-baseline/01-RESEARCH.md` and `01-0{1..5}-PLAN.md`: Phase 1 outputs and file ownership

### Tertiary (LOW confidence)
- knex per-driver affected-row return values (training knowledge; to be proven by the Wave 0 matrix test)
- MariaDB default `sql_mode` (training knowledge; Q1)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Bouncer version/peer compatibility verified on the registry; all other libraries inspected in `node_modules`.
- Codebase inventories (auth checks, IDORs, validators, counters, categories, encryption, 2FA): HIGH. Read directly; key behaviours verified in library source.
- Fix patterns: HIGH for mechanics (Lucid/knex verified); MEDIUM for cross-engine affected-row semantics (AS7, test-gated).
- Policy rules / UX values (TTL, attempts, gradebook/learn/enrol widening): MEDIUM/LOW. Flagged `[ASSUMED]`, need user confirmation.
- Pitfalls: HIGH. Each is tied to a verified code path.

**Research date:** 2026-10-09
**Valid until:** 2026-11-08 (30 days; pinned versions are stable, but Bouncer 4/AdonisJS 7 docs drift is ongoing)
