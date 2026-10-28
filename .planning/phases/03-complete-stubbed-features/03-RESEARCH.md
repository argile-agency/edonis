# Phase 3: Complete Stubbed Features - Research

**Researched:** 2026-10-28
**Domain:** AdonisJS 6 authorization (Bouncer policy scoping), Lucid listing/aggregation across PG/MySQL/SQLite, public write endpoint (VineJS, Shield CSRF, limiter), SMTP notification
**Confidence:** HIGH for the codebase findings. MEDIUM for the mail choice (registry and changelog verified; never run in this repo). LOW for the Infomaniak network specifics.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Evaluations: counters and definitions (area discussed)
- **D-01:** Counters are defined from `Submission.status`: **pending (à corriger) = `submitted`**; **graded (corrigé) = `graded` + `returned`**; **total = pending + graded**, i.e. every submission handed in, excluding `draft`. The invariant `total = pending + graded` must hold and be tested. Counters cover the whole scope, not only the displayed page.

#### Evaluations: scope and access (area discussed)
- **D-02:** A teacher sees submissions of the courses they own plus the courses where they hold an `edit` or `manage` co-instructor permission (consistent with AS2). Reuse `CoursePolicy.viewGradebookAsInstructor`; do not invent a new access rule per course.
- **D-03:** **Admins and managers** see the submissions of **all** courses. There is no "filière" scoping in the permission model (categories do not restrict access), so a manager's own filière cannot be computed in this phase. The manager dashboard card "Évaluations — Superviser les évaluations" (`inertia/pages/dashboard.tsx`) must keep working. Note `CoursePolicy.before` only bypasses for admins: the planner must add an explicit policy-level rule so managers get the global view (no inline role check in the controller; `bun run check:debt` must stay 0).
- **D-04:** Who may open `/evaluations`: teachers (owner or `edit`/`manage` co-instructor of at least one course), admins and managers. **A student gets the 403 page** (Inertia `errors/forbidden`); today any logged-in user can open it. A functional test asserts the 403 for a student.

#### Evaluations: list, filters and ordering (area discussed)
- **D-05:** Default order is **oldest submission first** (`submittedAt` ascending), **20 per page**. Each row shows student, assignment, course and submission date (and late status if available).
- **D-06:** The user explicitly wants more than one order: "Idéalement il n'y aura pas qu'un seul ordre, il y aura des filtres pour organiser et filtrer les soumissions à corriger." Chosen filters and sorts: **filter by course**, **filter by assignment**, **sort by submission date (asc/desc), student and assignment**. A free-text search on student name or e-mail was NOT chosen. Filters and sort come from query-string params and must be validated with a VineJS validator (the empty-string query params problem found in plan 02-12 applies: treat `''` as "no filter").

#### Evaluations: link into the grading view (area discussed)
- **D-07:** Each row links to the **course gradebook** `/grades/courses/:id` (instructor view). This satisfies EVAL-03 with what exists. The gradebook is read-only today: no route exists anywhere to enter a grade or feedback (no POST/PUT for submissions or grading). A per-submission grading page is deferred.

### Claude's Discretion
- **Contact form** (CONTACT-01..03) was not discussed; the planner decides, within these guardrails:
  - Endpoint `POST /contact` validated with VineJS; CSRF-protected like other write routes; works for guests (the page is public).
  - Persist every submission first; then notify the address stored in `AppSetting.contactEmail` (seeded `support@edonis.local`). A notification failure must not lose the submission or leak an error to the visitor (log it).
  - **No mail library is installed** (`@adonisjs/mail` is absent, no `config/mail.ts`). The planner must choose the notification mechanism (AdonisJS mail with SMTP is the natural fit; production is Infomaniak) and keep it configurable via env with a safe "not configured" behaviour. Adding a dependency is allowed here.
  - Rate limit as a named `limiter.define(...)` in `start/limiter.ts`, per IP (existing convention: login 5/min, register 3/min). Pick the values and add a test returning 429.
  - Anti-spam (e.g. honeypot field) is the planner's call.
  - GDPR rule from CLAUDE.md: any new personal data field (name, e-mail, message, IP) must be considered in `AccountController.exportData` and the account anonymization, when it can be tied to a user; document the retention choice.
  - An admin viewer for received messages is NOT required by the roadmap; do not add one unless trivial and the planner justifies it.
- Pagination UI, column layout and the visual treatment of the filters follow existing list pages (e.g. `inertia/pages/courses/index.tsx`).

### Deferred Ideas (OUT OF SCOPE)
- **Grade and feedback entry page** (per submission: points, comment, status `submitted → graded`, with route, validator, policy and tests): new capability, belongs to an assessment phase. EVAL-03 is met by linking to the read-only gradebook.
- **Free-text student search** on the evaluations list: offered, not chosen.
- **Admin inbox for contact messages**: not in the roadmap.

#### Reviewed Todos (not folded)
- `2026-10-20-course-creation-requests-with-save-and-publish-buttons` — matched only on the keyword "courses"; it concerns course creation, unrelated to evaluations or contact. Stays a separate backlog item.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EVAL-01 | Teacher sees submissions awaiting grading, scoped to courses they instruct | `scopeGradableCourses` helper (owner, or `edit`/`manage` permission; admins and managers unrestricted). Submission subquery pattern, sort joins, validator, and the `viewEvaluations` policy action for the student 403 (Patterns 1-4). |
| EVAL-02 | Evaluations dashboard reports accurate total / pending / graded counts | One `GROUP BY status` aggregate over the same scoped base query. `Number()` cast for PG bigint counts. Invariant test (Pattern 3). |
| EVAL-03 | Teacher can navigate from the evaluations list into the grading view | Row link to `grades.course`. `viewGradebook` and `viewGradebookAsInstructor` must admit managers, or the link 403s for them (Pitfall 1). List only published assignments (Pitfall 4). |
| CONTACT-01 | Contact form posts to a backend endpoint with server-side validation | `POST /contact`, `contactValidator` with VineJS, Shield CSRF through the axios `XSRF-TOKEN` cookie, and the `useForm` post (Pattern 5). |
| CONTACT-02 | Submission is persisted and notifies the configured address | `contact_messages` table with `notified_at`. `MailService` on nodemailer 10 with a static transport seam, short timeouts, Reply-To = visitor, persist-then-notify inside try/catch (Patterns 6-7). |
| CONTACT-03 | Contact endpoint is rate-limited | `contactThrottle = limiter.define('contact', ...)` applied with `.use(contactThrottle)`. 429 test after `limiter.clear()`. Caveat about the proxy IP (Pitfall 7). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Package manager: **bun** first, then pnpm, npm last. Production (Infomaniak) builds with `npm i`, and `package-lock.json` is stale (it has no `@adonisjs/bouncer` and no `@fontsource`). Production resolves fresh, so `bun add` plus `bun.lock` is the repo convention. [VERIFIED: grep package-lock.json, memory infomaniak-deployment.md]
- Commits: one-line conventional commits, no AI or Co-Authored-By trailer.
- Migrations must be reversible (`up`/`down`). JSON columns go through `jsonColumn()` (none are needed here).
- JSON columns in models use `jsonColumnConfig` (none are needed).
- **Multi-tenancy:** CLAUDE.md says "All tenant-aware tables must include `tenant_id UUID NOT NULL`". **Conflict:** no table in the repo has `tenant_id`, and `app/` never references it. The tenants migration even creates a table literally named `create_tenants`. [VERIFIED: grep database/migrations app] **Recommendation:** do not add `tenant_id` to `contact_messages`. A lone tenant column with no tenant resolution anywhere would be dead weight and could not be filled correctly. Confirm with the user (Assumption A1).
- Authorization belongs in `app/policies/`. `bun run check:debt` greps `app/controllers` for `hasPermission(`, `hasRole(`, `hasAnyRole(`, `instructorId ===`, `isInstructor(`, `.roles.some(` **and** `request.only|input|all(`. Controllers must read all input through `request.validateUsing`, honeypot field included. [VERIFIED: package.json]
- Every input goes through VineJS, query strings included. Listing query strings map `''` to `null` (`emptyToNull` in `app/validators/listing.ts`).
- Audit logging via `AuditService.logFromContext` for security-relevant actions. A contact submission is not security-relevant. Optional.
- **Rate limiting:** "All auth-related endpoints must have rate limiting". Contact is not auth, but CONTACT-03 requires a throttle anyway.
- **GDPR:** any new personal data field must appear in `AccountController.exportData` and be handled in account deletion.
- **Accessibility:** jsx-a11y lint, and new pages must pass axe-core critical/serious checks.
- **Seeders:** reuse existing seeders, do not add new ones. Anything added must run from `database/seeders/main/index_seeder.ts`.
- **PII encryption** covers phone, address and identification only. `users.email` and `users.full_name` are plaintext, so contact name and email stay plaintext for consistency (Assumption A4).
- Run `bun run typecheck` before committing.

## Summary

**Evaluations.** Everything needed is already in the repo. `Submission` belongs to `Assignment`, which belongs to `Course`. `CoursePermission(course_id, user_id, permission_level ∈ view|edit|manage)` holds co-instructors, and `Course.instructor_id` is the owner. "Courses a user may grade" is `instructor_id = user OR EXISTS permission(user, level IN edit, manage)`, unrestricted for admins and managers. Write it once as `scopeGradableCourses(query, user)` in `app/policies/course_policy.ts`, mirroring `scopeVisibleCourses`. The submission list and the counters then derive from one base query: `submissions WHERE status <> 'draft' AND assignment_id IN (SELECT id FROM assignments WHERE is_published AND course_id IN (<scoped course ids>))`.
- **Counters:** one `GROUP BY status` aggregate, the same SQL on all three engines.
- **List:** filter on `status = 'submitted'`, then sort, preload and paginate.
- **Joins:** only when sorting by student or assignment.

**Three authorization gaps the planner must close.**
1. `middleware.role` returns a raw JSON `response.forbidden()` and never renders `errors/forbidden`, so it cannot satisfy D-04. Use a resource-less policy action (`authorize('viewEvaluations')`, like the existing `administer`).
2. `CoursePolicy.before` bypasses for admins only. Managers need explicit rules in `viewEvaluations`, `scopeGradableCourses`, **and** `viewGradebook`/`viewGradebookAsInstructor`. Without those, a manager who clicks a row (EVAL-03) lands on a 403 gradebook.
3. Never put the manager rule in `before`. `before` grants every action, including `delete` and `administer`.

**Contact.** The page already posts `name/email/subject/message` through `useForm`, and Inertia's axios sends Shield's `XSRF-TOKEN` cookie as `X-XSRF-TOKEN` automatically. `silent_auth` runs globally, so `auth.user` is available on a public POST and the row can carry `user_id` for GDPR. The mail-library question has a clear answer from the registry:
- `@adonisjs/mail@latest` (10.4.0) needs `@adonisjs/core ^7` and Node >= 24 (the project is on core 6.21.0 and Node 22).
- `@adonisjs/mail@9.2.2`, the last release for core 6, pins `nodemailer ^6.9.13`. Nodemailer 6.x has more than 15 open GitHub advisories (moderate and high), patched only in 10.x.
- The repo's Dependency Review job fails PRs on `moderate`.

**Primary recommendation:** for EVAL, add `scopeGradableCourses` + `viewEvaluations` to `CoursePolicy` (managers explicit, never in `before`), build list and counters from one scoped base query, and widen the two gradebook rules to managers. For CONTACT, add `nodemailer@^10.2.1` directly behind a ~30-line static `MailService` with a swappable `transport`. Persist first, then notify inline with short timeouts in a try/catch that records `notified_at`. Add a honeypot field and a named `contact` throttle.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Who may open `/evaluations` | API / Backend (Bouncer policy) | — | D-04, check:debt bans role checks in controllers |
| Gradable-course scoping | API / Backend (policy helper) | Database (subquery) | Single decision point, like `scopeVisibleCourses` |
| Counters total/pending/graded | Database (GROUP BY) | API | Must cover the whole scope, not the page |
| Filters/sort/pagination | API (VineJS + Lucid paginate) | Browser (router.get with params) | Query string is the state |
| Contact validation, CSRF, throttle | API / Backend | Browser (`useForm`, honeypot field) | Trust boundary is the server |
| Contact persistence | Database | — | Persist before any side effect |
| Notification e-mail | API (MailService, SMTP) | External SMTP (Infomaniak) | Failure must not affect the response |
| Flash feedback on contact page | Browser | Frontend server (shared `flash` prop) | Contact page has no AppHeader, so no FlashMessages today |

## Standard Stack

### Core (already installed, verified in node_modules)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @adonisjs/core | 6.21.0 | Framework | [VERIFIED: node_modules] |
| @adonisjs/lucid | 21.8.2 | ORM, `paginate`, `pojo`, `clone`, `whereHas` | [VERIFIED: node_modules] |
| @adonisjs/bouncer | ^3.1.6 | Policies (`authorize`, `allows`, resource-less actions) | Already used: `authorize('administer')` in courses_controller [VERIFIED] |
| @adonisjs/limiter | ^2.4.0 | Named throttles, memory store | [VERIFIED: start/limiter.ts, config/limiter.ts] |
| @adonisjs/shield | ^8.2.0 | CSRF (`enableXsrfCookie: true`) | [VERIFIED: config/shield.ts] |
| @vinejs/vine | ^3.0.1 | Validators | [VERIFIED] |
| @inertiajs/react / core | 2.3.29 (axios ^1.20) | `useForm`, `router.get` | axios default `xsrfCookieName: 'XSRF-TOKEN'` [VERIFIED: node_modules/axios] |

### New dependency
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| nodemailer | ^10.2.1 (published 2026-10-22) | SMTP send, `jsonTransport` | Ships its own ESM + CJS types (`dist/esm/nodemailer.d.ts`), so no `@types/nodemailer`. Default export plus named `createTransport`. Node >= 20. License MIT-0. 10.2.1 is past every advisory listed on 2026-10-28 (the latest fixes landed in 10.0.13 and 10.1.4). [VERIFIED: npm view, npm pack inspection, GitHub advisories API] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| nodemailer 10 direct | `@adonisjs/mail@9.2.2` | Gives `mail.fake()` and `node ace add`, but pulls nodemailer 6.10.1 (open advisories GHSA-cc9r-2j5m-2m83 recipient-domain bypass, GHSA-2x7j-588g-ccc2 DoS, etc.), which fails Dependency Review (`fail-on-severity: moderate`). Forcing `overrides: { nodemailer: ^10 }` under mail 9 is untested (LOW). |
| nodemailer 10 direct | `@adonisjs/mail@10.x` | Needs `@adonisjs/core ^7`, `@adonisjs/assembler ^8` and Node >= 24. A framework upgrade is out of scope. [VERIFIED: npm view peerDependencies/engines] |
| Inline send | Queue | No queue is installed. Inline with short timeouts is enough for a contact form. |

**Installation:**
```bash
export PATH="$HOME/.local/share/fnm/node-versions/v22.19.0/installation/bin:$PATH"
bun add nodemailer@^10.2.1
```
Do NOT run `node ace add @adonisjs/mail`.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| nodemailer | npm | ~15 yrs (10.x since 2026-09-04) | very high [ASSUMED] | github.com/nodemailer/nodemailer | [OK] | Approved. No `postinstall` script (scripts: lint/test/build/format/prepare...) |
| @adonisjs/mail | npm | 9.x 2024-06, 10.x 2026 | — | github.com/adonisjs/mail | [OK] | Not recommended (version and peer conflicts, see above) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

Note: `slopcheck install` ran `npm install` in the repo cwd. It aborted with ERESOLVE (`@adonisjs/mail@10` peer `@adonisjs/core ^7`) and left the tree unchanged (`git status` clean apart from the pre-existing `.claude/settings.json`, and no `node_modules/nodemailer`).

## Architecture Patterns

### System Architecture Diagram

```
EVALUATIONS
Browser GET /evaluations?courseId=&assignmentId=&sort=&direction=&page=
   │
   ▼
auth middleware ──(guest)──► 302 /login
   │
   ▼
EvaluationsController.index
   ├─ bouncer.with('CoursePolicy').authorize('viewEvaluations')
   │     admin(before) ─► allow │ manager ─► allow │ owns/edit|manage ≥1 course ─► allow │ else ─► E_AUTHORIZATION_FAILURE ─► handler ─► 403 errors/forbidden
   ├─ request.validateUsing(evaluationIndexQueryValidator)   ('' → null)
   ├─ gradableCourses = Course.query() ; scopeGradableCourses(gradableCourses, user)
   ├─ base = Submission.query() status≠draft, assignment_id IN (published assignments of gradableCourses)
   │        + optional courseId / assignmentId filters
   ├─ stats  = base.clone() GROUP BY status ─► {total, pending, graded}
   ├─ list   = base.clone() status='submitted' [+ join users|assignments for sort] preload ─► paginate(page, 20)
   │                                           .baseUrl('/evaluations').queryString(filters)
   ├─ filter options = gradable courses (id,title) + their published assignments (id,title,courseId)
   ▼
inertia.render('evaluations/index', { submissions(DTO+meta), stats, filters, courses, assignments })
   │  row link ─► GET /grades/courses/:courseId ─► viewGradebook / viewGradebookAsInstructor (manager admitted)

CONTACT
Browser useForm.post('/contact') (X-XSRF-TOKEN header from cookie)
   ▼
shield CSRF ──(bad token)──► 302 back + errorsBag.E_BAD_CSRF_TOKEN
   ▼
contactThrottle (per IP) ──(exceeded)──► 429 errors/too_many_requests
   ▼
ContactController.store
   ├─ validateUsing(contactValidator) ──(invalid)──► 302 back + inputErrorsBag
   ├─ honeypot filled? ──► flash success, persist nothing
   ├─ ContactMessage.create({..., userId: auth.user?.id ?? null, ipAddress})
   ├─ try { recipient = AppSetting.getActiveSettings()?.contactEmail
   │        if (MailService.transport && recipient) await sendMail(...) ; row.notifiedAt = now ; save }
   │  catch (err) { logger.error(...) }            ◄── row is never lost
   ▼
session.flash('success', …) ; redirect back
```

### Recommended file touch list
```
app/policies/course_policy.ts        # + viewEvaluations, scopeGradableCourses; viewGradebook(+AsInstructor) admit managers
app/controllers/evaluations_controller.ts  # replace stub
app/validators/listing.ts            # + evaluationIndexQueryValidator (reuse emptyToNull)
app/validators/contact.ts            # new: contactValidator
app/controllers/pages_controller.ts  # + store (or a small contact_controller.ts)
app/models/contact_message.ts        # new
app/services/mail_service.ts         # new
database/migrations/<ts>_create_contact_messages_table.ts
start/routes.ts, start/limiter.ts, start/env.ts, .env.example
app/controllers/account_controller.ts  # export + delete contact rows; fix CR-04 (student_id)
inertia/pages/evaluations/index.tsx, inertia/pages/pages/contact.tsx
database/seeders/student_enrollment_seeder.ts  # + assignment & submissions (no new seeder)
tests/functional/helpers/factories.ts          # + createAssignment, createSubmission
tests/functional/evaluations.spec.ts, tests/functional/contact.spec.ts
```

### Pattern 1: Policy actions (no role check in controllers)
```typescript
// app/policies/course_policy.ts — Source: existing file conventions (administer, scopeVisibleCourses)

/** Admin passes via `before`. Managers see every course (D-03). Others need ≥1 gradable course (D-04). */
async viewEvaluations(user: User): Promise<AuthorizerResponse> {
  if (await user.hasRole('manager')) return true
  const query = Course.query()
  await scopeGradableCourses(query, user)
  return (await query.select('id').first()) !== null
}

async viewGradebook(user: User, course: Course) {
  return (await user.hasRole('manager')) || (await course.hasPermission(user.id, 'edit')) || isEnrolled(user, course)
}
async viewGradebookAsInstructor(user: User, course: Course) {
  return (await user.hasRole('manager')) || course.hasPermission(user.id, 'edit')
}

/** Courses whose submissions `user` may grade: owner or edit/manage permission (D-02); admin and manager unrestricted (D-03). */
export async function scopeGradableCourses(query: ModelQueryBuilderContract<typeof Course>, user: User): Promise<void> {
  if (await user.hasAnyRole(['admin', 'manager'])) return
  query.where((b) => {
    b.where('instructor_id', user.id).orWhereHas('permissions', (p) => {
      p.where('user_id', user.id).whereIn('permission_level', ['edit', 'manage'])
    })
  })
}
```
- `scopeGradableCourses` must match `Course.hasPermission(user.id, 'edit')` exactly (owner, or level index >= edit). Add a policy-matrix test asserting that both agree for owner / edit / manage / view / unrelated.
- Controller: `await bouncer.with('CoursePolicy').authorize('viewEvaluations')`. This throws `E_AUTHORIZATION_FAILURE`, which `app/exceptions/handler.ts` renders as the Inertia `errors/forbidden` page with status 403. [VERIFIED: handler.ts]
- Keep the route group on `middleware.auth()` only. Do **not** add `middleware.role`: it returns `response.forbidden({message})` as JSON and never renders `errors/forbidden`. [VERIFIED: app/middleware/role_middleware.ts]
- `user.hasRole` and `hasAnyRole` exist on User. [VERIFIED: app/models/user.ts:153,161]

### Pattern 2: Validated query string (reuse `emptyToNull`)
```typescript
// app/validators/listing.ts — Source: existing userIndexQueryValidator
export const evaluationIndexQueryValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).parse(emptyToNull).optional().nullable(),
    courseId: vine.number().positive().parse(emptyToNull).optional().nullable(),
    assignmentId: vine.number().positive().parse(emptyToNull).optional().nullable(),
    sort: vine.enum(['submitted_at', 'student', 'assignment']).parse(emptyToNull).optional().nullable(),
    direction: vine.enum(['asc', 'desc']).parse(emptyToNull).optional().nullable(),
  })
)
```
No `exists` rule is needed. An out-of-scope `courseId` hits the scope and returns an empty list, so nothing leaks. Write a test for that case. A validation failure on GET redirects back (302) with `inputErrorsBag`, as for `users.index`. [VERIFIED: 02-12-SUMMARY]

### Pattern 3: One scoped base, counters + page (cross-engine)
```typescript
// app/controllers/evaluations_controller.ts (sketch)
const courses = Course.query()
await scopeGradableCourses(courses, user)

const base = Submission.query()
  .whereNot('submissions.status', 'draft')
  .whereIn('submissions.assignment_id',
    Assignment.query().select('id').where('is_published', true).whereIn('course_id', courses.clone().select('id')))
if (q.courseId) base.whereIn('submissions.assignment_id', Assignment.query().select('id').where('course_id', q.courseId))
if (q.assignmentId) base.where('submissions.assignment_id', q.assignmentId)

const rows = await base.clone().pojo<{ status: string; total: number | string }>()
  .select('submissions.status').count('* as total').groupBy('submissions.status')
const n = (s: string) => rows.filter((r) => r.status === s).reduce((a, r) => a + Number(r.total), 0)
const stats = { pending: n('submitted'), graded: n('graded') + n('returned') }
// total = pending + graded by construction (D-01)

const list = base.clone().where('submissions.status', 'submitted')
// sort: 'student' → .join('users', 'users.id', 'submissions.student_id').orderBy('users.full_name', dir)
//       'assignment' → .join('assignments', 'assignments.id', 'submissions.assignment_id').orderBy('assignments.title', dir)
//       default → .orderBy('submissions.submitted_at', dir ?? 'asc')
// always: .select('submissions.*').orderBy('submissions.id', 'asc')   // stable pages
const page = await list.preload('student').preload('assignment', (a) => a.preload('course'))
  .paginate(q.page ?? 1, 20)
page.baseUrl('/evaluations').queryString({ courseId, assignmentId, sort, direction })
```
- Lucid `pojo`, `clone`, `paginate`, `baseUrl` and `queryString` exist in 21.8.2. [VERIFIED: node_modules/@adonisjs/lucid types and simple_paginator.js]
- Preload costs 3 extra queries per page (users, assignments, courses), not N+1.
- Map rows to a **minimal DTO** (see Pitfall 3).
- Whether counters honour the course/assignment filters is Assumption A2. Either way, both derive from `base`, so switching is a one-line change.

### Pattern 4: Filters UI (follow courses/index, not users/index)
- `inertia/pages/courses/index.tsx` calls `router.get('/courses', { ...filters, page }, { preserveState: true })`. Use that. [VERIFIED]
- `users/index.tsx` links to `meta.nextPageUrl`, and the paginator's default base URL is `'/'`. Its "next" links therefore point to `/?page=2`, an existing bug outside this phase. [VERIFIED: simple_paginator.js `url = '/'`, users_controller has no `baseUrl`]
- Each filter needs a `<Label htmlFor>` bound to `SelectTrigger id`, as in users/index. Radix `Select` cannot hold an empty-string value, so use an `'all'` sentinel and send `''` (the validator maps it to null).
- Sort control: one Select ("Date (plus ancienne)", "Date (plus récente)", "Étudiant", "Devoir"). It maps to `sort` + `direction`.

### Pattern 5: Contact form post
```tsx
// inertia/pages/pages/contact.tsx
const { data, setData, post, processing, errors, reset } = useForm({ name: '', email: '', subject: '', message: '', website: '' })
post('/contact', { preserveScroll: true, onSuccess: () => reset() })
```
- CSRF: Shield sets the `XSRF-TOKEN` cookie (`enableXsrfCookie: true`) and Inertia's axios sends `X-XSRF-TOKEN`, so the form needs no hidden field. [VERIFIED: config/shield.ts, node_modules/axios/lib/defaults]
- Flash: the contact page has no `AppHeader`, so `FlashMessages` (mounted inside `app-header.tsx`) never shows. Render `usePage().props.flash.success` inline in an `role="status"` region, or mount `<FlashMessages />`. [VERIFIED: grep flash-toaster]
- Honeypot field: a real `<input id="website" name="website">` with a `<label>`, `tabIndex={-1}`, `autoComplete="off"`, positioned off-screen (`className="absolute -left-[9999px]"`). Do NOT put focusable content inside `aria-hidden` (axe `aria-hidden-focus`).
- The page hardcodes `contact@edonis.example.com`. Optionally show `appSettings.contactEmail` (shared prop).

### Pattern 6: MailService with a test seam
```typescript
// app/services/mail_service.ts — nodemailer 10 API verified from package dist
import nodemailer, { type SendMailOptions } from 'nodemailer'  // named type exports verified in dist/esm/nodemailer.d.ts
import env from '#start/env'

type Transport = { sendMail(message: SendMailOptions): Promise<unknown> }

function fromEnv(): Transport | null {
  const host = env.get('SMTP_HOST')
  if (!host) return null                                  // "mail not configured"
  return nodemailer.createTransport({
    host,
    port: env.get('SMTP_PORT', 587),                       // 465 → nodemailer sets secure automatically
    auth: env.get('SMTP_USERNAME') ? { user: env.get('SMTP_USERNAME')!, pass: env.get('SMTP_PASSWORD', '') } : undefined,
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,  // defaults are 120s/30s/600s
  })
}

export default class MailService {
  /** Test seam: specs set BOTH `transport` and `from` (`.env.test` has no SMTP vars, so both are null) and restore both in teardown. */
  static transport: Transport | null = fromEnv()
  static from = env.get('MAIL_FROM_ADDRESS') ?? env.get('SMTP_USERNAME') ?? null
}
```
- Timeouts: verified defaults are connection 120 s, greeting 30 s, socket 600 s. [VERIFIED: nodemailer dist smtp-connection d.ts, nodemailer.com/smtp]
- Port 465 sets `secure` automatically. Ports 587 and 25 use STARTTLS. [CITED: nodemailer.com/smtp]
- Env: add `SMTP_HOST`, `SMTP_PORT` (`Env.schema.number.optional()`), `SMTP_USERNAME`, `SMTP_PASSWORD` and `MAIL_FROM_ADDRESS` to `start/env.ts`, **all `.optional()`**. Otherwise boot fails in CI, in tests and on Infomaniak until they are set. Document them in `.env.example`.

### Pattern 7: Persist, then notify (never lose the row)
```typescript
const payload = await request.validateUsing(contactValidator)
if (payload.website) { session.flash('success', MSG); return response.redirect().back() }  // honeypot: silent
const message = await ContactMessage.create({ name, email, subject, message: body, userId: auth.user?.id ?? null, ipAddress: request.ip() })
try {
  const to = (await AppSetting.getActiveSettings())?.contactEmail
  if (MailService.transport && MailService.from && to) {
    await MailService.transport.sendMail({ from: MailService.from, to, replyTo: payload.email,
      subject: `[Contact] ${payload.subject}`, text: `${payload.name} <${payload.email}>\n\n${payload.message}` })
    message.notifiedAt = DateTime.now(); await message.save()
  } else {
    logger.warn('contact message %d stored, notification skipped: mail not configured', message.id)
  }
} catch (error) {
  logger.error('contact message %d stored, notification failed: %s', message.id, (error as Error).message)
}
session.flash('success', MSG); return response.redirect().back()
```
- `From` is the authenticated mailbox. The visitor goes in `Reply-To`. The body is text only (no HTML injection surface).
- Never log name, email or message body. Log the id only.

### Contact table (proposed)
```typescript
// database/migrations/<ts>_create_contact_messages_table.ts
this.schema.createTable('contact_messages', (table) => {
  table.increments('id').primary()
  table.integer('user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
  table.string('name', 255).notNullable()
  table.string('email', 255).notNullable()
  table.string('subject', 255).notNullable()
  table.text('message').notNullable()
  table.string('ip_address', 45).nullable()   // abuse tracing; same width as audit_logs.ip_address
  table.timestamp('notified_at').nullable()   // null = not (yet) delivered
  table.timestamp('created_at').notNullable()
  table.timestamp('updated_at').nullable()
  table.index(['user_id'])
  table.index(['created_at'])                 // retention purge
})
// down(): this.schema.dropTable('contact_messages')
```
Validator: `name` trim 2..255, `email` `.email().maxLength(255)`, `subject` trim 3..200, `message` trim 10..5000, `website` `vine.string().nullable().optional()`. Bodyparser `convertEmptyStringsToNull: true` already turns an empty honeypot into null for bodies. [VERIFIED: config/bodyparser.ts] Reject CR/LF in `name` and `subject` (`.regex(/^[^\r\n]*$/)`) as a cheap header-injection belt (nodemailer also encodes headers; that part is [ASSUMED]).

### GDPR
- `exportData`: add `contactMessages: ContactMessage.query().where('user_id', user.id)`.
- `deleteAccount`: it **anonymizes the user row and never deletes it**, so the `ON DELETE SET NULL` FK never fires. Add `await ContactMessage.query().where('user_id', user.id).delete()`. Messages sent as a guest cannot be tied reliably to an account; out of scope.
- **CR-04 blocker:** `exportData` queries `Submission.query().where('user_id', ...)`, but the column is `student_id`. [VERIFIED: account_controller.ts, submissions migration] Any export test fails until it is fixed. Include the one-word fix in 03-02.
- Retention: recommend 12 months (state it in `inertia/pages/pages/privacy.tsx`). No purge command this phase (Assumption A5).

### Rate limit
```typescript
// start/limiter.ts
/** Contact form: 5 messages per 10 minutes per IP, then blocked 15 minutes. */
export const contactThrottle = limiter.define('contact', () =>
  limiter.allowRequests(5).every('10 minutes').blockFor('15 minutes'))
// start/routes.ts (public, next to GET /contact)
router.post('/contact', [PagesController, 'store']).as('contact.store').use(contactThrottle)
```
- The throttle consumes on every POST, including invalid ones, which is the desired behaviour against abuse.
- The memory store is per process, so tests must call `limiter.clear()` in `group.each.setup`. [VERIFIED: two_factor.spec.ts]

### Seed data (dev)
- No seeder creates assignments or submissions today. [VERIFIED: grep database/seeders]
- Extend **`student_enrollment_seeder.ts`**, the last in the chain: it already resolves `student@edonis.test` and enrollments.
  - Look up `teacher@edonis.test` and one course where `instructor_id = teacher.id`. `course_seeder` picks instructors with an unordered `.limit(3)`, so do not assume which course the teacher owns.
  - Enroll the student there if missing.
  - `Assignment.updateOrCreate({ courseId, title: 'Devoir 1 : Premier projet' }, { isPublished: true, maxPoints: 20, ... })`.
  - Create submissions with `updateOrCreate` on `(assignmentId, studentId, attemptNumber)`, with statuses submitted ×2 (different assignments or attempts) and graded ×1.
- The unique key is `(assignment_id, student_id, attempt_number)`. [VERIFIED: migration] Only one student account exists, so use two assignments to get two pending rows.

### Anti-Patterns to Avoid
- **Manager rule in `before`:** it grants `delete`, `administer`, `edit` and everything else to managers.
- **`middleware.role` for the student gate:** it returns JSON, not the 403 page (D-04 test fails).
- **`submission.serialize()` with preloaded student/course:** this leaks decrypted PII (CR-01 pattern) and the course instructor.
- **Counting from the paginated rows:** counters must cover the whole scope (D-01).
- **`await`ing SMTP with default timeouts:** a request could hang up to 2 minutes.
- **`From: visitor@…`:** SPF/DMARC rejection on Infomaniak. Use Reply-To.
- **Paginator links without `baseUrl`:** they point to `/?page=n`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SMTP client / MIME | raw `net.Socket` SMTP | nodemailer 10 | TLS, AUTH, header encoding, address parsing |
| Rate limiting | counters in session/DB | `limiter.define` | Existing convention, 429 page already wired |
| CSRF on public POST | custom token | Shield + axios XSRF cookie | Already enforced globally |
| 403 page | custom response in controller | Bouncer `authorize` + exception handler | Handler already renders `errors/forbidden` |
| Pagination | manual offset math | Lucid `paginate` + `baseUrl/queryString` | Meta for UI |
| Empty query params | ad-hoc `|| undefined` | `emptyToNull` in listing.ts | Plan 02-12 precedent |

## Common Pitfalls

### Pitfall 1: Managers 403 on the gradebook link (EVAL-03)
**What goes wrong:** a manager sees all submissions (D-03), clicks a row and gets a 403. **Why:** `viewGradebook` = edit permission OR enrolled. Managers are neither, and `before` only admits admins. **Avoid:** add the manager rule to `viewGradebook` and `viewGradebookAsInstructor`, and test a manager opening a non-owned course gradebook (200, `isInstructor: true`).

### Pitfall 2: Teacher with zero gradable courses
The dashboard shows the Évaluations card to every teacher (`isTeacher` in dashboard.tsx). Under D-04, a teacher with no owned or edit/manage course gets the 403 page. See Open Question 1.

### Pitfall 3: PII in page props
`User.serialize()` exposes decrypted phone, address, identification number, and more. `Course.serialize()` embeds the instructor (02-REVIEW CR-01). Map each row to a DTO: `{ id, submittedAt: s.submittedAt?.toISO() ?? null, isLate: Boolean(s.isLate), attemptNumber, student: { id, fullName, email }, assignment: { id, title }, course: { id, title, code } }`. `Boolean()` is needed because MySQL and SQLite return 0/1 for booleans (the model column has no cast). Never call `page.serialize()` (it serializes the preloaded User and Course). Pass `{ data: page.all().map(toDto), meta: page.getMeta() }`.

### Pitfall 4: Rows that the gradebook does not show
The gradebook lists only `is_published = true` assignments and **enrolled** students. [VERIFIED: grades_controller.ts] Restrict the evaluations base query to published assignments; Assignment A3 covers this. Submissions of since-unenrolled students still link to a gradebook row that is not there. Known limitation of D-07, document it.

### Pitfall 5: Counts are strings on PostgreSQL
`count('*')` returns bigint as a string on pg and a number elsewhere. Always use `Number(r.total)`. CI runs PG, MySQL and SQLite. [ASSUMED from pg driver behaviour; HIGH-confidence common knowledge]

### Pitfall 6: Non-deterministic order across pages
Sorting by `full_name`, `title` or `submitted_at` has ties. Add `orderBy('submissions.id')` last. NULL ordering of `submitted_at` differs (PG puts NULLs last on ASC, MySQL and SQLite first). A `submitted` row should never have a null `submitted_at`; the seeder and factory must set it.

### Pitfall 7: Per-IP throttle may be site-wide in production
`http` config has no `trustProxy`, and the AdonisJS default trusts only loopback (`proxyAddr.compile("loopback")`). [VERIFIED: http-server chunk line 4596] On Infomaniak's Kubernetes ingress, `request.ip()` may be the proxy IP, which would make login, register and contact limits global. Check: `SELECT DISTINCT ip_address FROM audit_logs WHERE action LIKE 'user.login%'` in prod (actions `user.login`, `user.login.failed`, `user.login.blocked`, `user.login.2fa_required` verified in auth_controller.ts). Do **not** blindly set `trustProxy: true` (spoofable `X-Forwarded-For`). Open Question 2 / HUMAN-UAT.

### Pitfall 8: Empty query strings
`?courseId=&sort=` arrives as `''`. Without `.parse(emptyToNull)`, validation rejects every unfiltered submit. Write a regression test with exactly the payload the UI sends.

### Pitfall 9: Joins break `select *` and ambiguous columns
Once you join users or assignments, use `select('submissions.*')` and qualify `status`, `id` and `assignment_id`. Otherwise `id` collides and models hydrate the wrong id.

### Pitfall 10: Multiple attempts
`max_attempts > 1` allows several `submitted` rows per student and assignment. D-01 counts submissions, so each attempt is a row. Accept that and document it.

### Pitfall 11: Test environment
- The default shell has Node 24, which breaks `node ace`. Prefix commands with `export PATH="$HOME/.local/share/fnm/node-versions/v22.19.0/installation/bin:$PATH"`.
- The user's dev server occupies 3333 and 24678, so run tests with a unique `PORT` and `DB_FILENAME`: `PORT=3433 DB_FILENAME=./tmp/test-03.sqlite3 node ace test functional`. The `Port 24678 is already in use` Vite warning is non-fatal. [VERIFIED: 02-12-SUMMARY]
- `.env.test` has no SMTP vars, so `MailService.transport` **and** `MailService.from` are `null` in tests. A spec that sets only `transport` silently takes the "not configured" branch.
- The test DB has no `app_settings` row: create an `AppSetting` with `contactEmail` and `isActive: true` in the notification tests.

### Pitfall 12: `check:debt` gate 2
The honeypot must be read from the validated payload. `request.input('website')` fails `check:debt`.

## Code Examples
See Patterns 1-7 above. They are built from verified repo code (`course_policy.ts`, `listing.ts`, `users_controller.ts`, `two_factor.spec.ts`) and the nodemailer 10.2.1 `dist` typings.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@adonisjs/mail` 9 + nodemailer 6 | `@adonisjs/mail` 10 needs AdonisJS 7 / Node 24 | mail 10.0 (2026) | Core-6 apps should use nodemailer 10 directly or upgrade the framework |
| nodemailer bundled `@types/nodemailer` | Types ship in-package | nodemailer 10.0.0 (2026-09-04) | Do not add `@types/nodemailer` |
| nodemailer `NoAuth` error code | `ENOAUTH` | 8.0.0 | Only relevant if matching codes |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `contact_messages` gets no `tenant_id` despite CLAUDE.md, because no table has one | Project Constraints | Low. Adding a column later is a migration. |
| A2 | Counters follow the course/assignment filters (scope ∩ filters, never pagination), which makes `paginator.total === stats.pending` testable. The alternative is counters ignoring filters (literal "whole scope") | Pattern 3 | UX only; a one-line switch |
| A3 | The evaluations list shows only submissions of **published** assignments, matching what the gradebook shows | Pitfall 4 | Submissions of unpublished assignments would be invisible in the list |
| A4 | Contact name and email are stored plaintext (same as `users.email`/`full_name`) | Constraints | GDPR posture; encrypting later is possible |
| A5 | Retention 12 months, documented on the privacy page, no purge job now | GDPR | Data kept longer than stated until a purge exists |
| A6 | Throttle 5 per 10 min, block 15 min per IP | Rate limit | Too tight if the proxy IP is shared (Pitfall 7) |
| A7 | Inline send with 10-15 s timeouts is acceptable (no queue) | Pattern 6 | Slow submit when SMTP is degraded |
| A8 | Infomaniak SMTP: `mail.infomaniak.com`, 587 STARTTLS or 465 TLS, full mailbox address as username, auth mandatory; From must be that mailbox. Outbound SMTP from the Node.js pods is allowed | Environment | No delivery in prod. Row still kept. |
| A9 | Widening `viewGradebook`/`viewGradebookAsInstructor` to managers is accepted as a consequence of D-03 + D-07 | Pattern 1 | A manager sees every student's grades, name and email in every course |

## Open Questions

1. **Teacher without any gradable course.**
   - What we know: the dashboard card shows for every teacher, and D-04 gives such a teacher a 403.
   - Recommendation: keep the 403, since D-04 is literal, and confirm with the user. Alternative: let any `teacher` role in and show an empty list.
2. **Is `request.ip()` the client IP on Infomaniak?**
   - Recommendation: before deploying, check distinct `audit_logs.ip_address` for logins in prod. If they are all one private IP, configure `trustProxy` to the ingress CIDR in a separate change. Add a HUMAN-UAT item.
3. **Counters vs filters (A2).** Recommend filters apply. The planner may pick either, provided it is tested.
4. **Production mail settings.** Set `SMTP_*`, `MAIL_FROM_ADDRESS` and a real `AppSetting.contactEmail` (seed is `support@edonis.local`) in prod. The Node version on Infomaniak is unknown, and nodemailer 10 needs Node >= 20. HUMAN-UAT: one real message delivered.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node (fnm) | `node ace` | ✓ | v22.19.0 (default shell v24.20.0 breaks ace) | prefix PATH |
| bun | install/scripts | ✓ | 1.4.3 | npm |
| SQLite (better-sqlite3) | tests | ✓ | ^12.11.1 | — |
| SMTP server | CONTACT-02 in dev/prod | ✗ locally | — | "not configured" path logs a warning, row kept |
| Context7 / ctx7 | docs lookup | ✗ | — | WebFetch + npm pack inspection used |

**Missing dependencies with no fallback:** none for development and tests.
**Missing dependencies with fallback:** SMTP (prod setup is a HUMAN-UAT item).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Japa 4 (`@japa/runner`, `@japa/api-client`, plugin-adonisjs, shield/session/auth/inertia api clients) |
| Config file | `tests/bootstrap.ts`, `adonisrc.ts` (functional suite migrates a fresh SQLite) |
| Quick run command | `export PATH="$HOME/.local/share/fnm/node-versions/v22.19.0/installation/bin:$PATH"; PORT=3433 DB_FILENAME=./tmp/test-03.sqlite3 node ace test functional --files tests/functional/evaluations.spec.ts` |
| Full suite command | `PORT=3433 DB_FILENAME=./tmp/test-03.sqlite3 node ace test functional && bun run typecheck && bun run lint && bun run check:debt` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EVAL-01 | student → 403 `errors/forbidden` (`.withInertia()`, `assertInertiaComponent`) | functional | `... --files tests/functional/evaluations.spec.ts` | ❌ Wave 0 |
| EVAL-01 | guest → 302 `/login` (`.redirects(0)`) | functional | same | ❌ |
| EVAL-01 | owner sees own pending rows; edit/manage co-instructor sees them; view-only and unrelated teacher do not | functional | same | ❌ |
| EVAL-01 | admin and manager see rows of a course they neither own nor hold | functional | same | ❌ |
| EVAL-01 | `courseId` of a non-gradable course → empty list, no leak | functional | same | ❌ |
| EVAL-01 | `scopeGradableCourses` agrees with `hasPermission(...,'edit')` matrix; `viewEvaluations` matrix | functional (policy, no HTTP; `bouncerFor` pattern) | `--files tests/functional/authorization.spec.ts` | ✅ extend |
| EVAL-01 | draft rows never listed; graded/returned not in list | functional | evaluations.spec | ❌ |
| EVAL-01 | default order `submittedAt` asc; `direction=desc`; `sort=student`, `sort=assignment`; 20 per page | functional | evaluations.spec | ❌ |
| EVAL-01 | empty filters `?courseId=&assignmentId=&sort=&direction=` → 200; `sort=bogus` → 302 + `inputErrorsBag.sort` | functional | evaluations.spec | ❌ |
| EVAL-01 | row props carry no `phone`/`address` (DTO) | functional | evaluations.spec | ❌ |
| EVAL-02 | `stats.total === stats.pending + stats.graded`; counts across >20 rows (page 2 does not change stats); `returned` counted as graded | functional | evaluations.spec | ❌ |
| EVAL-03 | each row has `course.id`; manager GET `/grades/courses/:id` of non-owned course → 200, `isInstructor: true` | functional | `--files tests/functional/grades.spec.ts` | ✅ extend |
| CONTACT-01 | valid POST (`.withCsrfToken()`, guest) → 302 + flash success, `assertNotCsrfRejected` | functional | `--files tests/functional/contact.spec.ts` | ❌ Wave 0 |
| CONTACT-01 | without CSRF token → `errorsBag.E_BAD_CSRF_TOKEN`, no row | functional | contact.spec | ❌ |
| CONTACT-01 | invalid email / missing message → 302 + `inputErrorsBag.email`, no row | functional | contact.spec | ❌ |
| CONTACT-01 | honeypot filled → success flash, no row, no mail | functional | contact.spec | ❌ |
| CONTACT-02 | row persisted with fields; authenticated user → `user_id` set | functional | contact.spec | ❌ |
| CONTACT-02 | fake transport records 1 message: `to` = AppSetting.contactEmail, `replyTo` = visitor; `notified_at` set | functional | contact.spec | ❌ |
| CONTACT-02 | transport throws → still 302 success, row exists, `notified_at` null | functional | contact.spec | ❌ |
| CONTACT-02 | transport null (not configured) → row exists, `notified_at` null | functional | contact.spec | ❌ |
| CONTACT-02 | GDPR: export includes `contactMessages`; delete removes them (needs CR-04 fix) | functional | contact.spec or new account test | ❌ |
| CONTACT-03 | 6th POST within window → 429 (`limiter.clear()` in setup) | functional | contact.spec | ❌ |
| a11y | `/evaluations` and `/contact` pass axe wcag2a/aa critical+serious | browser | `node ace test browser tests/browser/accessibility.spec.ts` | ✅ extend (manual/nightly; needs built assets and seeded DB) |

### Sampling Rate
- **Per task commit:** the touched spec file via `--files`, plus `bun run typecheck`.
- **Per wave merge:** the full functional suite, `bun run lint` and `bun run check:debt`.
- **Phase gate:** full suite green before `/gsd:verify-work`. CI PG and MySQL matrix runs on push.

### Wave 0 Gaps
- [ ] `tests/functional/helpers/factories.ts`: add `createAssignment(course, overrides)` (default `isPublished: true`, `title`) and `createSubmission(assignment, student, overrides)` (default `status: 'submitted'`, `submittedAt: DateTime.now()`, `attemptNumber: 1`).
- [ ] `tests/functional/evaluations.spec.ts`
- [ ] `tests/functional/contact.spec.ts`: set `MailService.transport` and `MailService.from` per test, restore both in `group.each.teardown`, and call `limiter.clear()` in setup.
- No framework install is needed.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (no auth change) | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | Bouncer `viewEvaluations`, `scopeGradableCourses`, gradebook rules; the scope applies to filter params too |
| V5 Input Validation | yes | VineJS validators (query + body), `emptyToNull`, CR/LF rejection in name and subject |
| V6 Cryptography | no (SMTP TLS via nodemailer) | nodemailer TLS defaults; never `rejectUnauthorized: false` |
| V7 Error handling/logging | yes | log id only, no PII; generic success to visitor |
| V8 Data protection | yes | DTO without PII, GDPR export/delete, retention |
| V11 Business logic / anti-automation | yes | `contactThrottle`, honeypot |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR via `courseId` / `assignmentId` filter | Information disclosure | Filters intersect the gradable scope; test with a foreign id |
| Privilege widening through `before` | Elevation | Manager rule only in the named actions |
| PII leakage in Inertia props | Information disclosure | Explicit DTO |
| Contact spam / mail-bombing the recipient | DoS | Per-IP throttle + honeypot + fixed recipient (visitor never controls `to`) |
| Email header injection | Tampering | Validator rejects CR/LF; nodemailer header encoding; visitor only in `Reply-To` |
| CSRF on public POST | Tampering | Shield CSRF (global), test without a token |
| SMTP hang → request exhaustion | DoS | Short connection/greeting/socket timeouts |
| Vulnerable mail dependency | Tampering/DoS | nodemailer >= 10.2.1, not mail 9 + nodemailer 6 |

## Out-of-scope observations (for the planner, not this phase)
- `inertia/pages/users/index.tsx` pagination links point to `/?page=n` (paginator `baseUrl` not set in `users_controller`). The audit-logs list likely has the same issue (not checked).
- 02-REVIEW CR-01 (instructor PII in `Course.serialize()`) is still open. The evaluations DTO must not reintroduce it.

## Sources

### Primary (HIGH confidence)
- Repo code read directly:
  - `app/policies/course_policy.ts`, `app/models/{submission,assignment,course_permission,course,user,app_setting}.ts`
  - `app/controllers/{evaluations,grades,pages,account,users,courses}_controller.ts`, `app/middleware/role_middleware.ts`, `app/exceptions/handler.ts`
  - `start/{routes,limiter,kernel,env}.ts`, `config/{shield,inertia,app,bodyparser,limiter}.ts`, `app/validators/listing.ts`
  - `tests/functional/{helpers/factories,grades,csrf,two_factor,authorization}.spec.ts`
  - migrations for submissions, assignments, audit_logs and content_files; `database/seeders/*`; `package.json`; `.env.test`; `.github/workflows/{ci,code-quality}.yml`
- `node_modules/@adonisjs/lucid` 21.8.2 (paginator `url='/'`, `queryString`, `baseUrl`, `pojo`, `clone`)
- `node_modules/@adonisjs/http-server` (trustProxy default loopback)
- `node_modules/axios` (XSRF defaults)
- npm registry: `@adonisjs/mail` (10.4.0 peers core ^7, Node >= 24; 9.2.2 peers core ^6.2, deps nodemailer ^6.9.13), `nodemailer` 10.2.1 (engines Node >= 20, types in-package, no postinstall)
- `npm pack nodemailer@10.2.1` inspection (default + named `createTransport`, `jsonTransport`, timeout options)
- GitHub Advisory API `affects=nodemailer` (2026-10-28 listing)
- https://github.com/nodemailer/nodemailer/blob/master/CHANGELOG.md (breaking changes 7-10)
- https://nodemailer.com/smtp (option defaults, secure/port semantics)

### Secondary (MEDIUM confidence)
- [Infomaniak FAQ 468 — mail ports and protocols](https://www.infomaniak.com/en/support/faq/468/understanding-mail-ports-and-protocols): `mail.infomaniak.com`, 587 STARTTLS / 465 SSL, mandatory auth with the full address. Infomaniak's own pages disagree on the preferred port.
- [Infomaniak FAQ 468 (ports to use)](https://www.infomaniak.com/en/support/faq/468/ports-to-use-for-messaging)

### Tertiary (LOW confidence)
- Outbound SMTP being allowed from Infomaniak Node.js pods, and the ingress IP behaviour, are unverified.
- Context7 / ctx7 was not available in this session.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH for existing packages. MEDIUM for nodemailer 10 (registry, typings and changelog verified; not yet run in this repo).
- Architecture: HIGH. Every pattern derives from existing code in the repo.
- Pitfalls: HIGH for the codebase ones (verified in source). LOW for the Infomaniak network ones.

**Research date:** 2026-10-28
**Valid until:** 2026-11-11 for the mail dependency (nodemailer advisories are landing weekly; re-check `npm view nodemailer version` at install). 30 days for the rest.
