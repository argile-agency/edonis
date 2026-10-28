# Phase 3: Complete Stubbed Features - Context

**Gathered:** 2026-10-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Nothing in the UI promises a capability the backend does not deliver. Two stubs are completed:

1. **Evaluations module** (EVAL-01..03): `/evaluations` today returns an empty list and zero counters (`TODO` in `EvaluationsController.index`). It must list the submissions awaiting grading, report accurate counts, and link into the grading view.
2. **Contact form** (CONTACT-01..03): `inertia/pages/pages/contact.tsx` has a form whose `post('/contact')` is commented out and there is no POST route. It must post to a validated endpoint, persist the submission, notify the configured address, and be rate-limited.

Entering a grade or feedback is NOT part of this phase (see Deferred Ideas).

</domain>

<decisions>
## Implementation Decisions

### Evaluations: counters and definitions (area discussed)
- **D-01:** Counters are defined from `Submission.status`: **pending (à corriger) = `submitted`**; **graded (corrigé) = `graded` + `returned`**; **total = pending + graded**, i.e. every submission handed in, excluding `draft`. The invariant `total = pending + graded` must hold and be tested. Counters cover the whole gradable scope of the user: they ignore the course/assignment filters and the pagination (the cards summarise everything the user may grade; the filters only narrow the list).

### Evaluations: scope and access (area discussed)
- **D-02:** A teacher sees submissions of the courses they own plus the courses where they hold an `edit` or `manage` co-instructor permission (consistent with AS2). Reuse `CoursePolicy.viewGradebookAsInstructor`; do not invent a new access rule per course.
- **D-03 (REVISED 2026-10-28, replaces the earlier "admins and managers see all"):** **Only admins** see the submissions of all courses on the platform. **Managers get no global view**: the `manager` role is treated like any other user, i.e. they see only the courses they own or on which they hold an `edit`/`manage` permission. User's words: « Un supervisor ou un manager de cours ne voit pas forcément tous les cours. Il ne voit que les cours qu'il manage. À la limite, il faudrait qu'il y ait des permissions pour manager tous les cours d'une catégorie si besoin. Mais autrement, c'est vraiment uniquement les cours concernés. Seuls les admins voient tous les cours de la plateforme. Personne d'autre. » No role-based rule for managers anywhere (`CoursePolicy.before` already bypasses for admins only, leave it as is), and the gradebook rules `viewGradebook` / `viewGradebookAsInstructor` are NOT widened for managers. The manager dashboard card "Évaluations — Superviser les évaluations" (`inertia/pages/dashboard.tsx`) must not promise a global view: reword it, and show it only when the user may open `/evaluations`.
- **D-04:** Who may open `/evaluations`: any user who owns a course or holds an `edit`/`manage` permission on at least one course, and admins. **A student or a manager with no such course gets the 403 page** (Inertia `errors/forbidden`); today any logged-in user can open it. A functional test asserts the 403 for a student and for a manager without a course. A user with such a permission is a de-facto co-instructor whatever their role (accepted).

### Evaluations: list, filters and ordering (area discussed)
- **D-05:** Default order is **oldest submission first** (`submittedAt` ascending), **20 per page**. Each row shows student, assignment, course and submission date (and late status if available).
- **D-06:** The user explicitly wants more than one order: "Idéalement il n'y aura pas qu'un seul ordre, il y aura des filtres pour organiser et filtrer les soumissions à corriger." Chosen filters and sorts: **filter by course**, **filter by assignment**, **sort by submission date (asc/desc), student and assignment**. A free-text search on student name or e-mail was NOT chosen. Filters and sort come from query-string params and must be validated with a VineJS validator (the empty-string query params problem found in plan 02-12 applies: treat `''` as "no filter").

### Evaluations: link into the grading view (area discussed)
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` — Phase 3 goal and success criteria (6 criteria), plans 03-01 (Evaluations) and 03-02 (Contact)
- `.planning/REQUIREMENTS.md` — EVAL-01..03 and CONTACT-01..03
- `.planning/phases/02-security-correctness-hardening/02-VERIFICATION.md` and `02-REVIEW.md` — what phase 2 established and the open findings

### Authorization and conventions (from Phase 2)
- `app/policies/course_policy.ts` — `viewGradebookAsInstructor`, `viewAsStaff`, `before` admin bypass, `scopeVisibleCourses`
- `app/policies/main.ts`, `app/abilities/main.ts` — Bouncer registration
- `CLAUDE.md` — conventions (bun, conventional single-line commits, no AI trailer, GDPR and rate-limiting rules, a11y with jsx-a11y)
- `tests/functional/helpers/factories.ts` — shared functional test factories and `.withCsrfToken()` pattern
- `.planning/phases/02-security-correctness-hardening/02-12-SUMMARY.md` — query-string validators: empty strings must mean "no filter"

### Evaluations
- `app/controllers/evaluations_controller.ts` — the stub to replace
- `inertia/pages/evaluations/index.tsx` — page already renders `stats` (total/pending/graded) and `pendingEvaluations` (typed `any[]`, to be typed)
- `start/routes.ts` — `/evaluations` group (auth only today)
- `app/models/submission.ts` — statuses `draft | submitted | graded | returned`, `submittedAt`, `isLate`, `attemptNumber`, `studentId`, `assignmentId`
- `app/models/assignment.ts` — belongs to `Course` (`courseId`) and optionally `CourseModule`
- `app/controllers/grades_controller.ts` and `inertia/pages/grades/course.tsx` — the gradebook the rows link to (instructor view, read-only)
- `inertia/pages/dashboard.tsx` — manager and teacher cards linking to `/evaluations`

### Contact form
- `inertia/pages/pages/contact.tsx` — form with `useForm`, commented `post('/contact')`
- `app/controllers/pages_controller.ts` and the `/contact` route in `start/routes.ts`
- `app/models/app_setting.ts` and `database/seeders/app_setting_seeder.ts` — `contactEmail`
- `start/limiter.ts` — named throttle convention
- `start/env.ts`, `.env.example` — where mail settings would be declared
- `app/controllers/account_controller.ts` — `exportData` and anonymization (GDPR rule)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CoursePolicy.viewGradebookAsInstructor` / `viewAsStaff`: course-level rule for "may see submissions of this course".
- `scopeVisibleCourses` (in `course_policy.ts`): the single listing decision point pattern for restricting a course query; a similar scoping helper for "courses a user may grade" is the natural place for D-02/D-03.
- `limiter.define` named throttles in `start/limiter.ts` plus their route usage (see the 2FA and login routes).
- Phase 2 test infrastructure: functional factories, `.withCsrfToken()`, `.withInertia()` for JSON assertions, unique `PORT`/`DB_FILENAME` per test run (default shell Node 24 breaks `node ace`; use Node 22).
- Existing Inertia list pages and shadcn `Select`, `Table`, `Card`, `Badge` components for the filters and the list.

### Established Patterns
- Authorization lives in `app/policies/`, never inline in controllers (`bun run check:debt` enforces it).
- Every input goes through a VineJS validator (`request.validateUsing`), including query strings.
- Controllers return `inertia.render('page', props)`; denials render `errors/forbidden`.
- Audit logging via `AuditService.logFromContext` for security-relevant actions.

### Integration Points
- `start/routes.ts`: add role/policy protection on `/evaluations`; add `POST /contact` with its throttle.
- `inertia/pages/dashboard.tsx`: cards for managers and teachers already link to `/evaluations`; students never see them.
- `AppSetting.contactEmail`: recipient of the contact notification.
- `start/env.ts` and `.env.example`: new mail variables if a mail library is added.

</code_context>

<specifics>
## Specific Ideas

- The user wants the evaluations list to be organisable and filterable rather than a single fixed order (D-06).
- Today there is no way to enter a grade in the whole application; the user accepted deferring a grading page rather than building it in this phase.

</specifics>

<deferred>
## Deferred Ideas

- **Grade and feedback entry page** (per submission: points, comment, status `submitted → graded`, with route, validator, policy and tests): new capability, belongs to an assessment phase. EVAL-03 is met by linking to the read-only gradebook.
- **Free-text student search** on the evaluations list: offered, not chosen.
- **Admin inbox for contact messages**: not in the roadmap.
- **Category-level manager permissions** ("permissions pour manager tous les cours d'une catégorie", e.g. a filière): a manager could be granted all the courses of a category. New capability in the permission model; not in this phase. Until then a manager sees only the courses they own or hold a permission on.

### Reviewed Todos (not folded)
- `2026-10-20-course-creation-requests-with-save-and-publish-buttons` — matched only on the keyword "courses"; it concerns course creation, unrelated to evaluations or contact. Stays a separate backlog item.

</deferred>

---

*Phase: 03-complete-stubbed-features*
*Context gathered: 2026-10-28*
