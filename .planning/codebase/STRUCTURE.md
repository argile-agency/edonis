# Codebase Structure

**Analysis Date:** 2026-02-03

## Directory Layout

```
edonis/
├── app/                          # Backend application code (TypeScript)
│   ├── controllers/              # HTTP request handlers
│   ├── middleware/               # Custom middleware (auth, guest, role)
│   ├── models/                   # Lucid ORM data models
│   ├── services/                 # Business logic services
│   ├── validators/               # VineJS validation schemas
│   ├── exceptions/               # Custom exception classes
│   ├── listeners/                # Event listeners (unused currently)
│   ├── events/                   # Event definitions (unused currently)
│   ├── mails/                    # Email templates (unused currently)
│   ├── policies/                 # Authorization policies (unused currently)
│   └── abilities/                # Ability checks (unused currently)
│
├── inertia/                      # Frontend code (React 19 + Tailwind)
│   ├── app/
│   │   ├── app.tsx               # Client-side entry point
│   │   └── ssr.tsx               # Server-side rendering entry
│   ├── pages/                    # Inertia page components (route views)
│   │   ├── auth/                 # Login, register pages
│   │   ├── courses/              # Course CRUD, learning, builder
│   │   ├── admin/                # Admin dashboards (users, categories, approvals)
│   │   ├── account/              # User profile, settings, account management
│   │   ├── enrollments/          # Enrollment UI
│   │   ├── evaluations/          # Submission grading view
│   │   ├── grades/               # Gradebook and progress views
│   │   ├── pages/                # Static pages (about, contact, privacy)
│   │   └── errors/               # Error pages (404, 500, 429)
│   ├── components/               # React UI components
│   │   ├── ui/                   # shadcn/ui components (Button, Card, Input, etc.)
│   │   ├── layout/               # Layout components (AppHeader, etc.)
│   │   └── [utility components]  # Theme provider, PWA prompt, connectivity indicator
│   ├── hooks/                    # Custom React hooks
│   ├── lib/                      # Utility functions (cn helper for Tailwind)
│   ├── css/                      # Global styles (Tailwind with custom theme)
│   └── public/                   # Static assets served directly
│
├── config/                       # Application configuration files
│   ├── inertia.ts                # Inertia setup + shared data providers
│   ├── auth.ts                   # Authentication guard configuration
│   ├── database.ts               # Database connection settings
│   ├── session.ts                # Session driver configuration
│   ├── cors.ts                   # CORS settings
│   ├── shield.ts                 # CSRF protection
│   └── [other AdonisJS configs]  # Mail, hash, logging, etc.
│
├── database/                     # Database migrations and seeders
│   ├── migrations/               # Schema definitions (*.migration.ts)
│   └── seeders/                  # Demo data (user_seeder.ts, course_seeder.ts, etc.)
│
├── start/                        # Application bootstrap
│   ├── routes.ts                 # HTTP route definitions
│   ├── kernel.ts                 # Middleware registration
│   ├── limiter.ts                # Rate limiting rules
│   ├── env.ts                    # Environment variable validation
│   ├── views.ts                  # Edge template helpers (for Inertia layout)
│   └── [bootstrap files]
│
├── resources/                    # Edge template files
│   └── views/
│       └── inertia_layout.ts     # Root Inertia layout (HTML skeleton)
│
├── public/                       # Web root (static assets)
│   ├── favicon.ico
│   └── [images, fonts, etc.]
│
├── tests/                        # Test files
│   ├── bootstrap.ts              # Japa test setup
│   ├── functional/               # Integration/API tests
│   ├── browser/                  # E2E browser tests (Playwright)
│   └── unit/                     # Unit tests (unused currently)
│
├── commands/                     # Custom Ace commands (mostly unused)
├── bin/                          # Compiled output entry point
├── build/                        # Production build output
├── docs/                         # Project documentation
└── .planning/                    # GSD planning documents
    └── codebase/
        ├── STACK.md
        ├── INTEGRATIONS.md
        ├── ARCHITECTURE.md
        ├── STRUCTURE.md
        ├── CONVENTIONS.md
        ├── TESTING.md
        └── CONCERNS.md
```

## Directory Purposes

**app/controllers/:**
- Purpose: HTTP request handlers that process input, call services/models, and render responses
- Contains: 15+ controller files, each handling a feature domain
- Key files:
  - `courses_controller.ts` - Course CRUD, publishing, permissions, enrollments
  - `auth_controller.ts` - Login, register, logout, credential verification
  - `users_controller.ts` - User management (admin only)
  - `enrollments_controller.ts` - Student enrollment into courses
  - `course_contents_controller.ts` - Course structure and learning content
  - `two_factor_controller.ts` - 2FA setup and verification
  - `profile_controller.ts` - User profile, settings, password change
  - `audit_logs_controller.ts` - Audit log viewing (admin)

**app/middleware/:**
- Purpose: Cross-cutting request/response concerns
- Files:
  - `auth_middleware.ts` - Requires authenticated user
  - `guest_middleware.ts` - Requires unauthenticated user
  - `role_middleware.ts` - Checks user has required role(s)
  - `silent_auth_middleware.ts` - Loads auth context without redirecting
  - `db_health_middleware.ts` - Checks database connectivity
  - `container_bindings_middleware.ts` - Injects IoC bindings

**app/models/:**
- Purpose: Data representation and relationships
- Key models (27 total):
  - **User Domain:** `user.ts`, `user_role.ts`, `social_account.ts`
  - **Course Domain:** `course.ts`, `course_category.ts`, `course_module.ts`, `course_content.ts`
  - **Enrollment Domain:** `course_enrollment.ts`, `course_enrollment_method.ts`, `course_enrollment_request.ts`
  - **Assessment Domain:** `assignment.ts`, `submission.ts`, `grade_category.ts`
  - **Course Organization:** `course_group.ts`, `course_grouping.ts`, `course_group_member.ts`, `course_permission.ts`
  - **Progress Tracking:** `content_progress.ts`
  - **Audit:** `audit_log.ts`, `bulk_enrollment_log.ts`
  - **Configuration:** `app_setting.ts`, `menu.ts`, `menu_item.ts`, `menu_location.ts`
  - **Academic:** `cohort.ts`, `cohort_member.ts`

**app/services/:**
- Purpose: Encapsulated business logic and cross-cutting concerns
- Files:
  - `audit_service.ts` - Log user actions with context (IP, user-agent)
  - `encryption_service.ts` - Encrypt/decrypt sensitive fields
  - `two_factor_service.ts` - TOTP generation and verification

**app/validators/:**
- Purpose: Input validation schemas using VineJS
- Files:
  - `auth_validator.ts` - Login/register validation
  - `course.ts` - Course creation/update validation
  - `course_content.ts` - Module/lesson validation
  - `user_validator.ts` - User creation/update
  - `profile_validator.ts` - Profile/password update

**inertia/pages/:**
- Purpose: Page components rendered by Inertia (route views)
- Organized by feature, each receives typed props from controller
- Pages receive shared data (auth, appSettings, menus, flash) automatically
- Patterns:
  - Form pages: controlled inputs via useForm hook
  - List pages: pagination, filtering, sorting
  - Detail pages: display with edit/delete actions
  - Interactive pages: modals, inline editing, drag-drop

**inertia/components/ui/:**
- Purpose: Reusable UI components from shadcn/ui
- Contains: Button, Card, Input, Select, Dialog, etc.
- Styled with Tailwind CSS v4
- Built on Radix UI primitives for accessibility

**inertia/components/layout/:**
- Purpose: Layout structures used across pages
- Files:
  - `app-header.tsx` - Top navigation with user menu
  - Similar components for footer, sidebar (if any)

**config/:**
- Purpose: Framework configuration and startup behavior
- **inertia.ts:** Shared data providers (auth user with roles, app settings, menus, flash messages, terms consent)
- **auth.ts:** Session guard, user model, credential verification
- **database.ts:** PostgreSQL connection, pool settings, migrations
- **session.ts:** Cookie-based session driver configuration
- **shield.ts:** CSRF token generation/validation
- **cors.ts:** Cross-origin resource sharing

**database/migrations/:**
- Purpose: Schema versioning
- Files: Timestamped files like `1735401234_create_users_table.ts`
- Pattern: `up()` and `down()` methods for migration/rollback
- All migration files committed to version control
- Run with: `node ace migration:run`

**database/seeders/:**
- Purpose: Populate demo data for development
- Key seeders:
  - `user_seeder.ts` - Creates admin, manager, teacher, student test accounts
  - `course_seeder.ts` - Creates sample courses with various statuses
  - `role_seeder.ts` - Creates admin, manager, teacher, student roles
  - `course_category_seeder.ts` - Creates course categories
  - `enrollment_method_seeder.ts` - Creates enrollment method options
- Run with: `node ace db:seed`

**start/routes.ts:**
- Purpose: HTTP route definitions with middleware chains
- Structure: Routes organized by feature in route groups
- Patterns:
  - Public routes: `/`, `/about`, `/contact`, `/privacy`
  - Auth routes (guest): `/login`, `/register`
  - Protected routes (auth): `/dashboard`, `/profile`, `/courses`
  - Admin routes (auth + role): `/admin/users`, `/admin/categories`
  - Resource routes: `/courses/:id`, `/courses/:id/edit`
- Middleware applied per group: `.use(middleware.auth()).use(middleware.role(...))`

**start/kernel.ts:**
- Purpose: Middleware stack registration
- Server middleware: Applied to all requests (static, CORS, Vite, Inertia)
- Router middleware: Applied to routes with registered HTTP verbs (body parser, session, auth)
- Named middleware: Custom middleware assigned explicitly to routes (guest, auth, role)

**resources/views/inertia_layout.ts:**
- Purpose: Root HTML template for all Inertia responses
- Contains: `<html>`, `<head>`, `<body>` with React hydration target (`<div id="app">`)
- Inline Vite scripts for module loading

## Key File Locations

**Entry Points:**
- `bin/server.js` - Compiled server entry point, starts HTTP server on PORT
- `start/routes.ts` - HTTP route definitions (line 31: GET /)
- `inertia/app/app.tsx` - Client-side React entry point, sets up Inertia
- `inertia/app/ssr.tsx` - Server-side rendering entry (configured in `config/inertia.ts`)

**Configuration:**
- `config/inertia.ts` - Shared data, SSR setup
- `config/auth.ts` - Session-based auth guard, User model binding
- `config/database.ts` - PostgreSQL connection parameters
- `.env` (not committed) - Environment variables (DB_HOST, DB_USER, DB_PASSWORD, APP_KEY, etc.)

**Core Logic:**
- `app/controllers/` - Business logic entry point per request
- `app/models/` - Data representation and relationships
- `app/services/` - Shared business logic (audit, encryption, 2FA)
- `app/validators/` - Input validation rules

**Testing:**
- `tests/bootstrap.ts` - Japa test configuration with AdonisJS and browser client
- `tests/functional/` - Integration tests with HTTP client
- `tests/browser/` - E2E tests with Playwright

## Naming Conventions

**Files:**

- Controllers: `snake_case_controller.ts` (e.g., `courses_controller.ts`, `auth_controller.ts`)
- Models: `PascalCase.ts` (e.g., `Course.ts`, `User.ts`, `CourseEnrollment.ts`)
- Validators: `snake_case.ts` or `feature_validator.ts` (e.g., `course.ts`, `auth_validator.ts`)
- Services: `PascalCase.ts` (e.g., `AuditService.ts`, `EncryptionService.ts`)
- Middleware: `snake_case_middleware.ts` (e.g., `auth_middleware.ts`)
- Pages: PascalCase or `snake_case.tsx` matching route structure (e.g., `dashboard.tsx`, `courses/index.tsx`)
- Components: PascalCase (e.g., `AppHeader.tsx`, `Button.tsx`)
- Hooks: `useCamelCase.ts` (e.g., `useAuth.ts`)

**Directories:**

- Backend folders: `snake_case` (controllers, models, services, validators, middleware)
- Frontend folders: `kebab-case` or `lowercase` (pages, components, hooks, lib, css)
- Feature-based grouping: Plural for collections (courses, enrollments), organized under domain (admin/, auth/, courses/)

**Routes:**

- Resource routes: `/resource`, `/resource/create`, `/resource/:id`, `/resource/:id/edit`
- Nested routes: `/courses/:id/modules`, `/courses/:id/contents`
- Action routes: `/courses/:id/publish`, `/courses/:id/archive`
- Admin routes: Prefixed with `/admin/` (e.g., `/admin/users`, `/admin/categories`)

**Type/Interface Names:**

- Inertia page props: `Props` interface in each page component
- Model types: `PascalCase` (e.g., `CourseRole`, `EnrollmentStatus`)
- Enums: `PascalCase` (e.g., `CourseStatus`, `UserRole`)

## Where to Add New Code

**New Feature (Domain):**

1. **Database Schema:**
   - Create migration: `node ace make:migration create_feature_table`
   - File location: `database/migrations/timestamp_create_feature_table.ts`
   - Tables use plural names, snake_case columns
   - Include timestamps (created_at, updated_at) for audit trail

2. **Model:**
   - Create: `node ace make:model Feature`
   - File location: `app/models/feature.ts`
   - Define relationships with other models via decorators
   - Use BaseModel as base class

3. **Validator:**
   - File location: `app/validators/feature.ts`
   - Export `createFeatureValidator`, `updateFeatureValidator`
   - Use VineJS vine.compile() pattern

4. **Controller:**
   - Create: `node ace make:controller FeaturesController`
   - File location: `app/controllers/features_controller.ts`
   - Methods: index, create, store, show, edit, update, destroy
   - Return inertia.render('features/view', props)

5. **Routes:**
   - Add to `start/routes.ts`
   - Organize in route group with appropriate middleware
   - Use standard REST conventions

6. **Pages:**
   - Create: `inertia/pages/features/index.tsx`, `create.tsx`, `edit.tsx`, `show.tsx`
   - Each page exports default function with Props interface
   - Import UI components from `~/components/ui/`
   - Use Head for title, Link for navigation

7. **Tests:**
   - Functional test: `tests/functional/features.spec.ts`
   - Browser test: `tests/browser/features.spec.ts` (if user-facing)

**New Component (React):**

1. **UI Component:**
   - Location: `inertia/components/ui/component-name.tsx` if shadcn/ui
   - Otherwise: `inertia/components/component-name.tsx`
   - Export default function
   - Accept typed props
   - Use Tailwind CSS for styling

2. **Layout Component:**
   - Location: `inertia/components/layout/component-name.tsx`
   - Wraps page sections (header, footer, sidebar)

3. **Custom Hook:**
   - Location: `inertia/hooks/use-feature-name.ts`
   - Use React hooks inside
   - Return typed values/functions

**Utilities:**

- Shared helpers: `inertia/lib/utils.ts` or feature-specific files
- Backend services: `app/services/FeatureName.ts`
- Common types: Define interfaces in component or dedicated `types/` folder (not yet present, add if needed)

**Middleware (Rare):**

- Location: `app/middleware/feature_middleware.ts`
- Implement handle() method
- Register in `start/kernel.ts` server/router arrays or as named middleware
- Named middleware attached to routes explicitly

## Special Directories

**public/:**
- Purpose: Static files served directly (favicon, images, fonts)
- Generated: No (committed manually)
- Committed: Yes
- Served at: `http://localhost:3333/filename`

**build/:**
- Purpose: Compiled production build output
- Generated: Yes (by `bun run build`)
- Committed: No (in .gitignore)
- Contents: Compiled JavaScript (AdonisJS + Vite bundles), static assets, manifest

**node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes (by `bun install`)
- Committed: No (in .gitignore)

**.planning/codebase/:**
- Purpose: GSD codebase analysis documents
- Generated: Yes (by GSD mapper)
- Committed: Yes

**database/:**
- Purpose: Database schema and seeding
- migrations/ - Committed (version control for DB)
- seeders/ - Committed (demo data for development)

**tests/:**
- Purpose: Test files
- Committed: Yes
- Run: `bun test` or `node ace test functional`, `node ace test browser`

---

*Structure analysis: 2026-02-03*
