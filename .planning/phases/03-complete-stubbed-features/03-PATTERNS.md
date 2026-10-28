# Phase 3: Complete Stubbed Features - Pattern Map

**Mapped:** 2026-10-28
**Files analyzed:** 23 (6 new, 17 modified)
**Analogs found:** 21 / 23 (`app/services/mail_service.ts` has no seam analog; the `package.json` dependency add needs none)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/policies/course_policy.ts` (modify: `viewEvaluations`, `scopeGradableCourses`, manager rule in `viewGradebook`/`viewGradebookAsInstructor`) | policy | request-response (authz) | same file: `administer` (83-85), `viewGradebook*` (100-111), `scopeVisibleCourses` (140-159) | exact (shape) |
| `app/controllers/evaluations_controller.ts` (rewrite) | controller | CRUD read (list + aggregate) | `app/controllers/courses_controller.ts` `index` (65-108) | exact |
| `app/validators/listing.ts` (modify: `evaluationIndexQueryValidator`) | validator | transform (query string) | same file `userIndexQueryValidator` (15-23) | exact |
| `app/validators/contact.ts` (new) | validator | transform (body) | `app/validators/auth_validator.ts` `registerValidator` (16-23) | exact |
| `app/controllers/pages_controller.ts` (modify: `store`) or `contact_controller.ts` | controller | request-response (write) | `app/controllers/account_controller.ts` `acceptTerms` (31-49) | role-match |
| `app/models/contact_message.ts` (new) | model | CRUD | `app/models/audit_log.ts` (1-43) | exact |
| `database/migrations/<ts>_create_create_contact_messages_table.ts` (new) | migration | — | `1769789421066_create_create_audit_logs_table.ts` + `1792402903467_create_create_content_files_table.ts` | exact |
| `app/services/mail_service.ts` (new) | service | event-driven (outbound SMTP) | `app/services/audit_service.ts` (static-class shape only) | partial, see No Analog |
| `start/limiter.ts` (modify: `contactThrottle`) | config | — | same file `registerThrottle` (21-27) | exact |
| `start/routes.ts` (modify: `POST /contact`, `/evaluations` stays auth-only) | route | — | same file lines 71-73, 93-97, 247-251 | exact |
| `start/env.ts` (modify: `SMTP_*`, `MAIL_FROM_ADDRESS`) | config | — | same file 48-56, 80-87 | exact |
| `.env.example` (modify) | config | — | same file 39-44 (`CONTENT_STORAGE_PATH` block) | exact |
| `app/controllers/account_controller.ts` (modify: export + delete contact rows, CR-04 fix) | controller | CRUD | same file 55-105, 111-174 | exact |
| `inertia/pages/evaluations/index.tsx` (modify: typed props, filters, table, pagination) | component (page) | request-response | `inertia/pages/courses/index.tsx` + `inertia/pages/users/index.tsx` (labels) | exact |
| `inertia/pages/pages/contact.tsx` (modify: real post, honeypot, flash) | component (page) | request-response | same file 10-25 + `inertia/pages/settings/index.tsx` 3,117 (`FlashMessages`) | exact |
| `database/seeders/student_enrollment_seeder.ts` (modify: assignments + submissions) | seeder | batch | same file 60-79 | exact |
| `tests/functional/helpers/factories.ts` (modify: `createAssignment`, `createSubmission`) | test helper | — | same file `createCourse` (69-84), `createGroup` (143-152) | exact |
| `tests/functional/evaluations.spec.ts` (new) | test | request-response | `tests/functional/grades.spec.ts` + `validation_listing.spec.ts` | exact |
| `tests/functional/contact.spec.ts` (new) | test | request-response | `tests/functional/csrf.spec.ts` + `two_factor.spec.ts` (limiter) | exact |
| `tests/functional/authorization.spec.ts` (extend) | test | — | same file 141-184, 218-249 | exact |
| `tests/functional/grades.spec.ts` (extend: manager 200 + `isInstructor`) | test | — | same file 108-123 | exact |
| `inertia/pages/pages/privacy.tsx` (modify: retention statement, optional) | component | — | static text page | trivial |
| `package.json` / `bun.lock` (modify: add `nodemailer@^10.2.1`) | config | dependency | none (run `bun add nodemailer@^10.2.1`; no `@types/nodemailer`, do NOT run `node ace add @adonisjs/mail`) | n/a |

---

## Pattern Assignments

### `app/policies/course_policy.ts` (policy, authz)

**Analog:** same file.

**Imports already present** (lines 1-6). `ModelQueryBuilderContract` and `Course` are already imported, so `scopeGradableCourses` needs no new imports.

**Resource-less action pattern** (lines 80-85). `viewEvaluations(user)` takes no resource, like `administer`:
```typescript
  administer(_user: User): AuthorizerResponse {
    return false
  }
```

**Gradebook rules to widen for managers** (lines 100-111). Do NOT touch `before` (28-38). It grants every action, including `delete`/`administer`:
```typescript
  async viewGradebook(user: User, course: Course): Promise<AuthorizerResponse> {
    return (await course.hasPermission(user.id, 'edit')) || isEnrolled(user, course)
  }
  async viewGradebookAsInstructor(user: User, course: Course): Promise<AuthorizerResponse> {
    return course.hasPermission(user.id, 'edit')
  }
```

**Scope helper shape** (lines 130-159). Copy the doc comment, the signature, the "mutates in place, returns void (Lucid builders are thenables)" note, and the grouped `query.where((builder) => ...)`:
```typescript
export async function scopeVisibleCourses(
  query: ModelQueryBuilderContract<typeof Course>,
  user: User
): Promise<void> {
  if (await user.hasRole('admin')) {
    return
  }
  if ((await user.hasRole('manager')) || (await user.hasRole('teacher'))) {
    // One grouped clause, so filters chained afterwards apply to both branches.
    query.where((builder) => {
      builder.where('instructor_id', user.id).orWhereHas('permissions', (permQuery) => {
        permQuery.where('user_id', user.id)
      })
    })
    return
  }
  query.where('status', 'published').where('visibility', 'public')
}
```
**TRAP:** this is a shape analog, not a rule analog. `scopeVisibleCourses` restricts managers to their own courses, and its `permissions` subquery has no level filter. `scopeGradableCourses` must:
- return early for `admin` **and** `manager` (D-03), via `user.hasAnyRole(['admin','manager'])`;
- add `.whereIn('permission_level', ['edit', 'manage'])` inside `orWhereHas` (D-02);
- apply to every other user, whatever their role. Do not branch on `teacher`, or a student with an `edit` permission would get nothing.
Full target code is in RESEARCH Pattern 1. Role checks are allowed here: `check:debt` greps `app/controllers` only.

---

### `app/controllers/evaluations_controller.ts` (controller, list + aggregate)

**Analog:** `app/controllers/courses_controller.ts` `index` (65-108). It validates the query, builds the query, awaits the scope, applies filters and paginates.

**Imports pattern** (courses_controller 1-3, 16-26):
```typescript
import type { HttpContext } from '@adonisjs/core/http'
import Course from '#models/course'
import { courseIndexQueryValidator, ... } from '#validators/course_admin'
import { scopeVisibleCourses } from '#policies/course_policy'
```
Becomes: `Course`, `Assignment`, `Submission` from `#models/*`, `evaluationIndexQueryValidator` from `#validators/listing`, and `scopeGradableCourses` from `#policies/course_policy`.

**Authorize first** (grades_controller.ts 80, 87-88). Destructure `bouncer`:
```typescript
  async course({ auth, bouncer, params, inertia }: HttpContext) {
    ...
    // Owner or enrolled user only (CoursePolicy); denials render errors/forbidden
    await bouncer.with('CoursePolicy').authorize('viewGradebook', course)
```
→ `await bouncer.with('CoursePolicy').authorize('viewEvaluations')` (no resource).

**Core list pattern** (courses_controller 65-97):
```typescript
  async index({ inertia, auth, request }: HttpContext) {
    const user = auth.user!
    const filters = await request.validateUsing(courseIndexQueryValidator)
    const page = filters.page ?? 1
    const perPage = 15
    ...
    const query = Course.query().preload('instructor')
    // Restrict to the courses this user may see (mutates `query` in place)
    await scopeVisibleCourses(query, user)
    // Apply filters
    if (status && status !== 'all') { query.where('status', status) }
    ...
    const courses = await query.orderBy('created_at', 'desc').paginate(page, perPage)
```
**TRAP:** do NOT copy the render at courses_controller 102-104 or users_controller 56-58. Both use `courses.serialize()` / `users.serialize()`:
```typescript
    return inertia.render('courses/index', {
      courses: courses.serialize(),
```
For evaluations:
- `perPage = 20`.
- Call `page.baseUrl('/evaluations').queryString({...})`.
- Render `{ submissions: { data: page.all().map(toDto), meta: page.getMeta() }, stats, filters, courses, assignments }`.
- The DTO has the fields `id, submittedAt (toISO), isLate (Boolean()), attemptNumber, student{id,fullName,email}, assignment{id,title}, course{id,title,code}` (RESEARCH Pitfall 3).
- `serialize()` leaks decrypted PII (CR-01).

**Status filter and published-assignment pattern** (grades_controller 30-42):
```typescript
        const assignments = await Assignment.query()
          .where('course_id', courseId)
          .where('is_published', true)
        ...
        const submissions = await Submission.query()
          .whereIn('assignment_id', assignments.map((a) => a.id))
          .where('student_id', user.id)
          .where('status', 'graded')
```
Use a subquery (`whereIn('submissions.assignment_id', Assignment.query().select('id')...)`), not `.map(a => a.id)`. Counters use `base.clone()` + `groupBy('submissions.status')` + `Number(r.total)` (RESEARCH Pattern 3; PG returns bigint as a string, see the same normalisation comment in `app/models/content_file.ts` 32-37).

**Relations available for preload:** `Submission.student` (submission.ts 73-76, FK `studentId`), `Submission.assignment` (70-71), `Assignment.course` (assignment.ts 93-94).

---

### `app/validators/listing.ts` (validator, query string)

**Analog:** same file, lines 3-23. Reuse the private `emptyToNull` (line 9). Add the new validator in this file so it stays in scope:
```typescript
const emptyToNull = (value: unknown) => (value === '' ? null : value)

export const userIndexQueryValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).parse(emptyToNull).optional().nullable(),
    ...
    status: vine.enum(['active', 'inactive']).parse(emptyToNull).optional().nullable(),
  })
)
```
Numeric ids follow `auditLogIndexQueryValidator.userId` (line 34): `vine.number().positive().parse(emptyToNull).optional().nullable()`. Fields: `page, courseId, assignmentId, sort (enum submitted_at|student|assignment), direction (enum asc|desc)`.

---

### `app/validators/contact.ts` (validator, body)

**Analog:** `app/validators/auth_validator.ts` (16-23):
```typescript
import vine from '@vinejs/vine'

export const registerValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(2).maxLength(255),
    email: vine.string().trim().email().normalizeEmail(),
    ...
  })
)
```
`contactValidator` fields:
- `name`: trim, 2..255, `.regex(/^[^\r\n]*$/)`.
- `email`: trim, `.email()`, `.maxLength(255)`.
- `subject`: trim, 3..200, CR/LF regex.
- `message`: trim, 10..5000.
- `website` (honeypot): `vine.string().nullable().optional()`.

The bodyparser already converts body `''` to null, so no `emptyToNull` is needed here. The honeypot must be read from the validated payload: `request.input('website')` fails `check:debt` (package.json line 16).

---

### `app/controllers/pages_controller.ts` → `store` (controller, write)

**Analog for the write flow:** `app/controllers/account_controller.ts` `acceptTerms` (31-49). It destructures ctx, writes, flashes and redirects back:
```typescript
  async acceptTerms(ctx: HttpContext) {
    const { auth, response, session } = ctx
    ...
    session.flash('success', 'Conditions acceptées. Merci.')
    return response.redirect().back()
  }
```
**Validate-then-use** (account_controller 112-115):
```typescript
    const { request, response, session, auth } = ctx
    const user = auth.user!
    const { password } = await request.validateUsing(passwordConfirmValidator)
```
Contact is public: use `auth.user?.id ?? null`, never `auth.user!`. `silent_auth` runs globally, so `auth.user` is populated when logged in.

**IP extraction:** `ctx.request.ip()`, as in `audit_service.ts` line 47.

**Logger import/format** (no controller uses it yet; analog `app/middleware/db_health_middleware.ts` 4, 20):
```typescript
import logger from '@adonisjs/core/services/logger'
logger.warn('DbHealthMiddleware: database unreachable: %s', err.message)
```
Log the message id only, never name/email/body. The persist-then-notify try/catch body is in RESEARCH Pattern 7.

**Recipient:** `AppSetting.getActiveSettings()` (app_setting.ts 89-91) → `.contactEmail` (line 60, `string | null`).

---

### `app/models/contact_message.ts` (model)

**Analog:** `app/models/audit_log.ts` (1-43):
```typescript
import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export default class AuditLog extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number | null
  ...
  @column()
  declare ipAddress: string | null
  ...
  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
```
Add these, taken from submission.ts 63-67:
- `@column.dateTime() declare notifiedAt: DateTime | null`
- `@column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime`

No JSON columns.

---

### `database/migrations/<ts>_create_create_contact_messages_table.ts` (migration)

Generate it with `node ace make:migration create_contact_messages` to get the repo's `create_create_` prefix and timestamp.

**Header and doc-comment style:** `1792402903467_create_create_content_files_table.ts` 1-38 (class doc comment, `protected tableName`, `increments('id').primary()`, `created_at notNullable` / `updated_at nullable`, `down()` → `dropTable`).

**FK, IP and indexes:** `1769789421066_create_create_audit_logs_table.ts` 11-32:
```typescript
      table
        .integer('user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      ...
      table.string('ip_address', 45).nullable()
      ...
      table.index(['user_id'], 'idx_audit_logs_user_id')
      table.index(['created_at'], 'idx_audit_logs_created_at')
```
Use explicit names: `idx_contact_messages_user_id` and `idx_contact_messages_created_at`. No `tenant_id` (RESEARCH A1). Full column list is in RESEARCH "Contact table".

---

### `start/limiter.ts` (config)

**Analog:** same file 13-27:
```typescript
/**
 * Register throttle: 3 requests per minute per IP.
 * Blocks for 10 minutes after exceeding the limit.
 */
export const registerThrottle = limiter.define('register', () => {
  return limiter.allowRequests(3).every('1 minute').blockFor('10 minutes')
})
```
→ `contactThrottle = limiter.define('contact', () => limiter.allowRequests(5).every('10 minutes').blockFor('15 minutes'))`. The doc comment must state the per-IP key.

---

### `start/routes.ts` (route)

**Throttle import** (lines 12-18): add `contactThrottle` to the `./limiter.js` import list.

**Public page routes** (71-73); add the POST next to them:
```typescript
router.get('/contact', [PagesController, 'contact']).as('contact')
```
**Throttle on a POST** (line 97):
```typescript
    router.post('/register', [AuthController, 'register']).use(registerThrottle)
```
→ `router.post('/contact', [PagesController, 'store']).as('contact.store').use(contactThrottle)` (no auth/guest middleware).

**Evaluations group** (247-251): leave it as `middleware.auth()` only. Do NOT add `middleware.role`: it returns JSON 403, not `errors/forbidden` (D-04).

---

### `start/env.ts` / `.env.example` (config)

**Analog:** `start/env.ts` 48-56 (section banner + `.optional()` vars) and 80-87 (banner with explanatory text):
```typescript
  /*
  |----------------------------------------------------------
  | Variables for configuring ally package
  |----------------------------------------------------------
  */
  GOOGLE_CLIENT_ID: Env.schema.string.optional(),
```
Add `SMTP_HOST`, `SMTP_PORT` (`Env.schema.number.optional()`, like `DB_PORT` line 35), `SMTP_USERNAME`, `SMTP_PASSWORD` and `MAIL_FROM_ADDRESS`, **all optional**, or boot fails in CI and tests.

`.env.example` 39-43 is the commented optional-block style to copy:
```
# Course content file storage (optional)
# Absolute path, or relative to the project root. ...
# CONTENT_STORAGE_PATH=
```

---

### `app/controllers/account_controller.ts` (controller, GDPR)

**Export pattern** (55-91). Dynamic import per model, query by user, map `serialize()`, add a key to `exportPayload`:
```typescript
    const { default: ContentProgress } = await import('#models/content_progress')
    const progress = await ContentProgress.query().where('user_id', user.id)
    const progressData = progress.map((p) => p.serialize())
    ...
    const exportPayload = {
      ...
      contentProgress: progressData,
      auditLogs: auditData,
    }
```
→ add `contactMessages`, using the same style.

**TRAP (CR-04):** do not copy lines 68-69:
```typescript
    const { default: Submission } = await import('#models/submission')
    const submissions = await Submission.query().where('user_id', user.id)
```
The column is `student_id` (submissions migration line 17). Fix it to `.where('student_id', user.id)` in the same plan, or any export test fails.

**Delete pattern** (111-174): the user is anonymized (134-160), never deleted, so the `ON DELETE SET NULL` FK never fires. Add `await ContactMessage.query().where('user_id', user.id).delete()` before `user.save()` / the audit log (lines 160-167).

---

### `inertia/pages/evaluations/index.tsx` (page)

**Keep:** the existing header, the `AppHeader` and the stats cards (lines 1-73). Remove the "fonctionnalité sera développée" `Alert` (84-90). Replace `pendingEvaluations: any[]` (line 19) with typed `submissions: { data: Row[]; meta: PaginationMeta }`.

**Filter-change and router pattern** (`inertia/pages/courses/index.tsx` 109-130):
```tsx
  const [status, setStatus] = useState(filters.status || '')
  ...
  const handleFilterChange = (filterType: string, value: string) => {
    const newFilters: any = { search }
    ...
    router.get('/courses', newFilters, { preserveState: true })
  }
```
**`'all'` sentinel** (courses/index.tsx 198-215):
```tsx
              <Select
                ...
                onValueChange={(value) =>
                  handleFilterChange('category', value === 'all' ? '' : value)
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
```
**TRAP (a11y):** the courses Selects have no label. Take the label binding from `inertia/pages/users/index.tsx` 135-161:
```tsx
                  <Label htmlFor="role">Rôle</Label>
                  ...
                    <SelectTrigger id="role">
```
**Pagination** (courses/index.tsx 279-293). It uses `router.get` with `{...filters, page}`, not `meta.nextPageUrl`, whose base URL is `/`:
```tsx
        {courses.meta.lastPage > 1 && (
          <div className="mt-8 flex justify-center gap-2">
            {Array.from({ length: courses.meta.lastPage }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={page === courses.meta.currentPage ? 'default' : 'outline'}
                onClick={() =>
                  router.get('/courses', { ...filters, page }, { preserveState: true })
                }
              >
```
`PaginationMeta` interface: courses/index.tsx 48-55. The row link goes to `/grades/courses/${row.course.id}` via `<Link>`.

---

### `inertia/pages/pages/contact.tsx` (page)

**Analog:** same file 10-25. Uncomment the post and add the honeypot:
```tsx
  const { data, setData, post, processing, errors, reset } = useForm({
    name: '', email: '', subject: '', message: '',
  })
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    // TODO: Implement contact form submission
    console.log('Contact form submitted:', data)
    // post('/contact', {
    //   onSuccess: () => reset(),
    // })
  }
```
Remove the `console.log`, which leaks PII to the console. Add `website: ''` and `post('/contact', { preserveScroll: true, onSuccess: () => reset() })`.

**Field markup to copy for the honeypot** (98-107: `Label htmlFor` + `Input id` + error `<p>`). Position it off-screen with `tabIndex={-1}` and `autoComplete="off"`. Never use `aria-hidden` on a focusable element.

**Flash:** the page has no `AppHeader`, so mount `FlashMessages` as `inertia/pages/settings/index.tsx` does (line 3 import, line 117 `<FlashMessages />`). The component (`inertia/components/flash-toaster.tsx` 15-35) already has the `aria-live` region.

---

### `database/seeders/student_enrollment_seeder.ts` (seeder, extend)

**Analog:** same file. Lookup-or-bail (9-18) and idempotent enroll (60-79):
```typescript
    const student = await User.query().where('email', 'student@edonis.test').preload('roles').first()
    if (!student) {
      console.log('❌ Student user not found. Please run user_seeder first.')
      return
    }
    ...
      const existing = await CourseEnrollment.query()
        .where('user_id', student.id)
        .where('course_id', course.id)
        .first()
      if (!existing) { await CourseEnrollment.create({ ... }) }
```
Add these steps:
- Look up `teacher@edonis.test` and pick a course with `instructor_id = teacher.id`.
- Enroll the student there if missing.
- Create 2 assignments with `Assignment.updateOrCreate({ courseId, title }, { isPublished: true, maxPoints: 20 })`. `is_published` defaults to **false** (assignments migration line 63).
- Create submissions with `updateOrCreate` on `(assignmentId, studentId, attemptNumber)` (unique, submissions migration line 57): `submitted` ×2 and `graded` ×1, always with `submittedAt` set.

The seeder is already registered in `database/seeders/main/index_seeder.ts` line 22, so no new seeder is needed.

---

### `tests/functional/helpers/factories.ts` (test helper, extend)

**Analog:** `createCourse` (69-84) and `createGroup` (143-152). Positional parent arg, `Partial<Pick<...>>` overrides, spread last:
```typescript
export async function createGroup(
  course: Course,
  overrides: Partial<Pick<CourseGroup, 'name' | 'description' | 'maxMembers'>> = {}
): Promise<CourseGroup> {
  return CourseGroup.create({
    courseId: course.id,
    name: `Group ${uniqueSuffix()}`,
    ...overrides,
  })
}
```
- `createAssignment(course, overrides)`: required `courseId` and `title`. Default `isPublished: true`, because the DB default is false.
- `createSubmission(assignment, student, overrides)`: default `status: 'submitted'`, `submittedAt: DateTime.now()`, `attemptNumber: 1`. `DateTime` is already imported at line 1.

---

### `tests/functional/evaluations.spec.ts` (new test)

**Imports and group setup** (grades.spec.ts 1-10, 59-60). Import from the shared factories. **TRAP:** do NOT copy grades.spec.ts 17-31, which re-implements local `uniqueSuffix`/`createUser` helpers:
```typescript
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { createUser, createCourse, grantPermission, enrollUser } from '#tests/functional/helpers/factories'

test.group('...', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
```
**Guest redirect** (grades.spec.ts 62-69): `.redirects(0)`, then `assertStatus(302)` and `assertHeader('location', '/login')`.

**403 page assertion** (grades.spec.ts 83-94):
```typescript
    const response = await client
      .get(route('grades.course', { id: course.id }))
      .withInertia()
      .loginAs(outsider)
    response.assertStatus(403)
    response.assertInertiaComponent('errors/forbidden')
```
**Inertia props** (grades.spec.ts 104-105): `assert.isTrue(response.inertiaProps.isInstructor)`.

**Empty filters and invalid sort** (validation_listing.spec.ts 44-52, 66-84):
```typescript
    const response = await client
      .get(route('users.index'))
      .qs({ search: '', role: '', status: '' })
      .withInertia()
      .loginAs(admin)
      .redirects(0)
    response.assertStatus(200)
    ...
    tooBig.assertStatus(302)
    assert.isDefined(tooBig.flashMessage('inputErrorsBag.limit'))
```

---

### `tests/functional/contact.spec.ts` (new test)

**No-CSRF rejection and CSRF pass** (csrf.spec.ts 17-58):
```typescript
    const request = client.post(route('user.account.accept-terms'))
    const response = await request.loginAs(user).redirects(0)
    response.assertStatus(302)
    assert.isDefined(response.flashMessage('errorsBag.E_BAD_CSRF_TOKEN'))
    ...
    const request = client.post(route('user.account.accept-terms')).withCsrfToken()
    const response = await request.loginAs(user).redirects(0)
    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.equal(response.flashMessage('success'), 'Conditions acceptées. Merci.')
```
For the guest case, omit `.loginAs`. Send the body with `.form({...})` (two_factor.spec.ts 63).

**Limiter reset** (two_factor.spec.ts 45-51):
```typescript
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(async () => {
    // The memory limiter store is shared across the process ...
    await limiter.clear()
  })
```
**429:** primary pattern is 6 real POSTs (each `.withCsrfToken().form({...}).redirects(0)`) after `limiter.clear()`, then `assertStatus(429)` on the 6th. This matches the RESEARCH test map and does not depend on the internal key format. (two_factor.spec.ts 199-208 shows the direct `limiter.use(...).consume(key)` alternative, but it only verified the key prefix for a `usingKey` throttle, not the IP default, so do not rely on it.)

**Mail seam:** set both `MailService.transport` and `MailService.from` in each test and restore both in `group.each.teardown`. `.env.test` has no SMTP vars. Create an `AppSetting` row with `contactEmail` and `isActive: true` (there are no seeds in tests).

---

### `tests/functional/authorization.spec.ts` (extend)

**Policy matrix** (21-27, 165-184), no HTTP:
```typescript
function bouncerFor(user: User) {
  return new Bouncer(user, abilities, policies)
}
function coursePolicy(user: User) {
  return bouncerFor(user).with('CoursePolicy')
}
...
    assert.isTrue(await coursePolicy(editor).allows('viewGradebookAsInstructor', course))
    assert.isFalse(await coursePolicy(viewer).allows('viewGradebookAsInstructor', course))
```
→ add `manager` rows to the `viewGradebook*` matrices and a new `viewEvaluations` matrix (`allows('viewEvaluations')`, no resource).

**Scope helper test** (218-249). Copy `visibleIds` as `gradableIds`:
```typescript
    const visibleIds = async (user: User) => {
      const query = Course.query()
      await scopeVisibleCourses(query, user)
      const rows = await query.whereIn('id', createdIds)
      return rows.map((course) => course.id).sort((a, b) => a - b)
    }
```
Matrix: owner, edit, manage → in; view and unrelated → out; admin and manager → all. Also assert agreement with `course.hasPermission(user.id, 'edit')`. Copy the grouped-OR test (251-265) too: a chained filter must not escape the OR.

### `tests/functional/grades.spec.ts` (extend)
Copy the admin test (108-123) with `createUserWithRoles({ roles: ['manager'] })` and expect 200 + `isInstructor: true` (Pitfall 1, EVAL-03).

---

## Shared Patterns

### Authorization (policy, never inline)
**Source:** `app/controllers/grades_controller.ts` 88-91, `courses_controller.ts` 155-157
**Apply to:** `evaluations_controller.ts`
```typescript
    await bouncer.with('CoursePolicy').authorize('viewGradebook', course)
    const isInstructor = await bouncer.with('CoursePolicy').allows('viewGradebookAsInstructor', course)
```
`E_AUTHORIZATION_FAILURE` → `app/exceptions/handler.ts` renders `errors/forbidden` (403). `check:debt` (package.json 16) bans `hasRole(`/`hasAnyRole(`/`hasPermission(`/`request.input|only|all(` in `app/controllers`.

### Input validation
**Source:** `courses_controller.ts` 67, `users_controller.ts` 21, `account_controller.ts` 115
**Apply to:** both controllers. Always `await request.validateUsing(validator)`. Query strings go through `emptyToNull` (`listing.ts` 9).

### Flash + redirect back
**Source:** `account_controller.ts` 47-48
**Apply to:** contact `store` (success, honeypot and notification-failure paths all return the same flash).

### Static service class
**Source:** `app/services/audit_service.ts` 16-51 (static methods, default export, `#services/*` import)
**Apply to:** `mail_service.ts` (shape only).

### Functional test harness
**Source:** `grades.spec.ts` 59-60, `csrf.spec.ts`, `factories.ts` 154-164 (`assertNotCsrfRejected`)
**Apply to:** all new specs. `withGlobalTransaction`, `.withInertia()` or `.redirects(0)` (no Vite manifest), `.withCsrfToken()` on writes, `assertNotCsrfRejected` on every 302 of a write.
Run with Node 22: `PORT=3433 DB_FILENAME=./tmp/test-03.sqlite3 node ace test functional --files ...`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/services/mail_service.ts` | service | event-driven (SMTP) | No mail code exists, and no service exposes a swappable static member (grep `static x =` in `app/services` returned nothing). Use RESEARCH Pattern 6 (nodemailer 10, `fromEnv()` returning null when `SMTP_HOST` is unset, short timeouts, static `transport` + `from` test seam). Add the dependency with `bun add nodemailer@^10.2.1`; do not add `@types/nodemailer`. |

## Metadata

**Analog search scope:** `app/{controllers,policies,validators,models,services,middleware}`, `start/`, `database/{migrations,seeders}`, `inertia/pages/{courses,users,evaluations,pages,settings}`, `inertia/components/flash-toaster.tsx`, `tests/functional/`
**Files scanned:** ~35
**Pattern extraction date:** 2026-10-28
