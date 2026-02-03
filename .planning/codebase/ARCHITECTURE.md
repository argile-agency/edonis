# Architecture

**Analysis Date:** 2026-02-03

## Pattern Overview

**Overall:** Monolithic SPA with server-side rendering (SSR) using AdonisJS 6 + Inertia.js + React 19

**Key Characteristics:**
- Server-rendered Inertia responses (no separate API/frontend builds)
- Single unified codebase with clear backend/frontend separation via `app/` and `inertia/` directories
- Type-safe throughout with TypeScript on both sides
- Session-based authentication with role-based access control (RBAC)
- Progressive Web App (PWA) capable with offline support
- Multi-tenant ready architecture (shared database with `tenant_id` isolation pattern)

## Layers

**HTTP Handler Layer (Request Entry):**
- Purpose: Route incoming HTTP requests to appropriate controllers and apply middleware
- Location: `start/routes.ts`
- Contains: Route definitions organized by feature (auth, courses, enrollments, admin)
- Depends on: Middleware (auth, role), Controllers
- Used by: HTTP server (AdonisJS runtime)

**Middleware Stack:**
- Purpose: Cross-cutting concerns (authentication, authorization, CORS, body parsing)
- Location: `start/kernel.ts` (registration), `app/middleware/` (implementations)
- Contains:
  - Server middleware: static files, CORS, Vite, Inertia setup
  - Router middleware: body parsing, sessions, CSRF shield, auth initialization
  - Named middleware: guest, auth, role (custom RBAC)
- Depends on: @adonisjs/* packages
- Used by: All routes via middleware.use() chains

**Controller Layer:**
- Purpose: HTTP request handling, input validation, business logic orchestration
- Location: `app/controllers/`
- Contains: Action methods returning Inertia responses
- Key files: `courses_controller.ts`, `auth_controller.ts`, `users_controller.ts`, `enrollments_controller.ts`
- Depends on: Models, Validators, Services, Inertia
- Used by: Routes

**Validation Layer:**
- Purpose: Request payload validation with VineJS
- Location: `app/validators/`
- Contains: Compiled validators for auth, courses, course content, users, profiles
- Pattern: Separates validation logic from controllers, reusable across requests
- Depends on: @vinejs/vine
- Used by: Controllers via `request.validateUsing()`

**Service Layer:**
- Purpose: Business logic, cross-cutting concerns (audit logging, encryption, 2FA)
- Location: `app/services/`
- Key files:
  - `audit_service.ts` - Logging user actions with context extraction
  - `encryption_service.ts` - Sensitive data encryption/decryption (phone, address, ID)
  - `two_factor_service.ts` - TOTP generation and verification
- Depends on: Models, external libraries (otpauth, crypto)
- Used by: Controllers, Models

**Model Layer (Data):**
- Purpose: Data representation and relationships via Lucid ORM
- Location: `app/models/`
- Key models:
  - `user.ts` - User with auth mixin, encrypted fields (phone, address), roles relationship
  - `course.ts` - Course with instructor, category, modules, enrollments
  - `course_enrollment.ts` - Course enrollment with role/status tracking
  - `course_module.ts` - Course module with content
  - `course_content.ts` - Content items (lessons) within modules
  - `assignment.ts` - Assignment with rubric/grading
  - `submission.ts` - Student submission with progress
  - `role.ts`, `user_role.ts` - RBAC implementation
  - `audit_log.ts` - Action audit trail
- Relationships: belongsTo, hasMany, manyToMany defined via decorators
- Depends on: @adonisjs/lucid, Luxon (dates)
- Used by: Controllers, Services

**Frontend Component Layer:**
- Purpose: React 19 UI components
- Location: `inertia/components/`
- Contains:
  - `ui/` - shadcn/ui components (Button, Card, Input, Select, etc.)
  - `layout/` - Layout components (AppHeader, etc.)
  - Utility components (ThemeProvider, PwaInstallPrompt, ConnectivityIndicator)
- Depends on: React, @radix-ui/*, Tailwind CSS, Lucide icons
- Used by: Page components

**Page Component Layer:**
- Purpose: Full-page Inertia components receiving serialized props from controllers
- Location: `inertia/pages/`
- Organized by feature:
  - `auth/` - Login, Register
  - `courses/` - Index, Show, Create, Edit, Learn, Builder, Enrollment
  - `admin/` - User management, Categories, Course approval, Audit logs
  - `enrollments/`, `evaluations/`, `grades/` - Student features
- Pattern: Each page receives typed props from controller, uses shared data (auth, menus, flash)
- Depends on: Components, Inertia hooks, Lucide icons
- Used by: Inertia render() calls

**Configuration Layer:**
- Purpose: Environment and feature configuration
- Location: `config/`
- Key files:
  - `inertia.ts` - Inertia setup, shared data providers (auth, appSettings, menus, flash)
  - `auth.ts` - Auth guard and session configuration
  - `database.ts` - Database connection settings
- Depends on: Environment variables
- Used by: Application bootstrap

**Database Layer:**
- Purpose: Schema definitions and data seeders
- Location: `database/`
- Migrations: Define tables, relationships, indexes
- Seeders: Create demo data (users, courses, roles, categories)
- Depends on: @adonisjs/lucid
- Used by: ORM during queries

## Data Flow

**User Authentication Request:**
1. GET /login → HomeController.showLogin() renders `auth/login` page
2. POST /login → AuthController.login() validates credentials via loginValidator
3. AuthController queries User.verifyCredentials(), checks isActive and twoFactorEnabled
4. On success: auth.login(user), updates lastLogin, logs audit event, redirects to /dashboard
5. /dashboard → DashboardController.index() queries user enrollments/teaching courses, renders via Inertia

**Shared Data Flow (on every request):**
1. Controller action calls inertia.render('page-name', { data })
2. Inertia config sharedData resolvers execute (with error handling):
   - `auth` - Loads user.roles relationship, serializes user
   - `appSettings` - Fetches active AppSetting record
   - `flash` - Extracts session flash messages (success/error)
   - `menus` - Builds menu trees for header/footer/user-menu
3. Response includes shared props + page-specific props
4. Client hydrates React app with complete props

**Course Creation Flow:**
1. GET /courses/create → CoursesController.create() renders `courses/create` form
2. POST /courses → CoursesController.store()
   - Validates payload via createCourseValidator
   - Creates Course with instructorId = auth.user.id
   - Logs audit event via AuditService.logFromContext()
   - Flashes success message to session
   - Redirects to /courses/:id/edit
3. Client receives flash message in sharedData.flash and displays toast

**Course Content Building Flow:**
1. GET /courses/:id/builder → CourseContentsController.builder()
   - Loads course with modules/contents preloaded
   - Renders `courses/builder` interactive page
2. POST /modules/:moduleId/contents → CourseContentsController.createContent()
   - Validates content payload via courseContentValidator
   - Creates CourseContent with order
   - Returns updated course structure for client re-render
3. Client updates UI optimistically or refetches on success

**Enrollment Flow:**
1. GET /courses/:id/enroll → EnrollmentsController.show() renders enrollment methods
2. POST /courses/:id/enroll/self → EnrollmentsController.enrollSelf()
   - Checks course enrollment settings
   - Creates CourseEnrollment with status/role
   - Sets progress_percentage = 0
   - Logs audit event
   - Redirects to courses.learn
3. Student can now access course content via courses.learn route

**Progress Tracking Flow:**
1. Student viewing course content: GET /courses/:id/learn → CourseContentsController.learn()
   - Renders modules/lessons with interactive player
2. Student completes content: POST /contents/:contentId/complete → CourseContentsController.markComplete()
   - Creates/updates ContentProgress record
   - Calculates enrollment.progressPercentage based on completed content
   - Returns updated progress to client
3. Client displays progress bar update

## State Management

**Server-side Session State:**
- `auth.user` - Authenticated user context per request (via auth guard)
- `session.flashMessages` - One-time messages (success/error) displayed on next render
- `session.put('two_factor_user_id', user.id)` - Transient 2FA state during challenge

**Client-side State:**
- React component state for forms, modals, filters
- Inertia shared props (auth, appSettings, menus, flash) available on all pages
- URL query parameters for pagination/filtering (searchParams in routes)

**Database State:**
- Lucid models represent domain entities
- Relationships defined via decorators (belongsTo, hasMany, manyToMany)
- Query builder with eager loading (preload) and lazy loading

## Key Abstractions

**Authentication (AuthFinder + Auth Middleware):**
- Purpose: Unified user authentication via email/password
- Files: `app/models/user.ts`, `app/middleware/auth_middleware.ts`, `config/auth.ts`
- Pattern: User model uses @adonisjs/auth withAuthFinder() mixin for credential verification
- Implementation:
  ```typescript
  // In controller
  const user = await User.verifyCredentials(email, password)
  await auth.use('web').login(user)

  // In middleware
  const user = auth.user! // Available after auth middleware
  ```

**Role-Based Access Control (RBAC):**
- Purpose: Fine-grained permission checks via user roles
- Files: `app/models/role.ts`, `app/models/user_role.ts`, `app/middleware/role_middleware.ts`
- Pattern: hasMany relationship on User, pivot table user_roles
- Implementation:
  ```typescript
  // In routes
  .use(middleware.role({ roles: ['admin', 'manager'] }))

  // In controllers
  const hasRole = await user.hasRole('teacher')
  const roles = await user.load('roles')
  ```

**Validation (VineJS):**
- Purpose: Declarative request validation with custom rules
- Files: `app/validators/`
- Pattern: Compiled validators reused across requests
- Implementation:
  ```typescript
  const payload = await request.validateUsing(createCourseValidator)
  ```

**Audit Logging (AuditService):**
- Purpose: Track all user actions for compliance
- File: `app/services/audit_service.ts`, `app/models/audit_log.ts`
- Pattern: Context-aware logging with automatic IP/user-agent extraction
- Implementation:
  ```typescript
  await AuditService.logFromContext(ctx, {
    action: 'course.created',
    resourceType: 'Course',
    resourceId: course.id,
    metadata: { category: course.categoryId }
  })
  ```

**Encryption (EncryptionService):**
- Purpose: At-rest encryption for sensitive PII
- File: `app/services/encryption_service.ts`
- Encrypted fields: phone, mobilePhone, address, identificationNumber
- Pattern: Column prepare/consume hooks in models
- Implementation:
  ```typescript
  @column({
    prepare: (value) => EncryptionService.encrypt(value),
    consume: (value) => EncryptionService.decrypt(value),
  })
  declare phone: string | null
  ```

**Two-Factor Authentication (2FA):**
- Purpose: TOTP-based multi-factor authentication
- Files: `app/services/two_factor_service.ts`, `app/controllers/two_factor_controller.ts`
- Pattern: TOTP generation, QR code display, recovery codes
- Flow: User enables 2FA, scans QR code, gets recovery codes, verifies TOTP on next login

**Inertia Shared Data:**
- Purpose: Inject data into all page renders without passing through each controller
- File: `config/inertia.ts`
- Providers: auth (user+roles), appSettings (branding), flash (messages), menus (navigation), termsConsentRequired
- Benefit: Avoid redundant queries in every controller action

**Multi-Tenancy Ready:**
- Purpose: Support multiple organizations in future with tenant isolation
- Pattern: All tenant-aware tables include `tenant_id` column
- Implementation: Models can add `.where('tenant_id', tenantId)` to queries via middleware
- Future: Tenant context from subdomain or header

## Entry Points

**HTTP Server:**
- Location: `bin/server.js` (compiled output), `start/kernel.ts` (middleware setup)
- Triggers: Application boot
- Responsibilities: Register middleware stack, error handling

**Router:**
- Location: `start/routes.ts`
- Triggers: HTTP request matching
- Responsibilities: Map requests to controllers, apply route-level middleware

**Controllers:**
- Location: `app/controllers/*_controller.ts`
- Triggers: Route match
- Responsibilities: Validate input, call services/models, render Inertia response

**Database Migrations/Seeders:**
- Location: `database/migrations/`, `database/seeders/`
- Triggers: `node ace migration:run`, `node ace db:seed`
- Responsibilities: Create/drop tables, populate demo data

**Inertia (Frontend):**
- Location: `inertia/app/app.tsx` (client entry), `inertia/app/ssr.tsx` (server entry)
- Triggers: Server render response, client hydration
- Responsibilities: Set up React app, load page component, apply theme/plugins

## Error Handling

**Strategy:** Centralized error handler with graceful degradation for shared data failures

**Patterns:**

1. **Controller-level validation:**
   ```typescript
   try {
     const payload = await request.validateUsing(validator)
   } catch (error) {
     // VineJS throws validation error, caught by error handler
   }
   ```

2. **Error handler (centralized):**
   - File: `app/exceptions/handler.ts`
   - Converts exceptions to HTTP responses
   - Returns JSON for API, Inertia error pages for SPA

3. **Shared data graceful degradation:**
   ```typescript
   // config/inertia.ts
   sharedData: {
     auth: (ctx) => ctx.inertia.always(async () => {
       try {
         return { user: await fetchUser() }
       } catch (error) {
         logger.warn('Failed to load auth: %s', error.message)
         return { user: null } // Fallback
       }
     })
   }
   ```

4. **Custom exceptions:**
   - Location: `app/exceptions/`
   - Extend base AdonisJS exception classes
   - HTTP status and response format automatic

## Cross-Cutting Concerns

**Logging:** Pino logger via `@adonisjs/core/services/logger`, used in shared data providers for failures

**Validation:** VineJS validators in `app/validators/`, applied in controllers via middleware pattern

**Authentication:** @adonisjs/auth with session guard, checked via middleware.auth()

**Authorization (RBAC):** Custom role_middleware with user.hasRole() checks

**Audit:** AuditService logs all state changes with user/IP context for compliance

**Encryption:** EncryptionService for PII at column level via Lucid prepare/consume

**Database:** PostgreSQL via @adonisjs/lucid ORM with connection pooling configured in `config/database.ts`

---

*Architecture analysis: 2026-02-03*
