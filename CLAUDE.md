# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Manager

**IMPORTANT**: Always use **bun** as the primary package manager. If bun fails, try **pnpm**. Only use **npm** as a last resort.

```bash
bun install           # Install dependencies
bun add <package>     # Add a package
bun add -d <package>  # Add a dev dependency
```

## Development Commands

```bash
# Development
bun run dev           # Start dev server with HMR (http://localhost:3333)
bun run build         # Build for production
bun start             # Start production server

# Database
node ace migration:run              # Run pending migrations
node ace migration:rollback         # Rollback last batch
node ace migration:fresh            # Drop all tables and re-run migrations
node ace make:migration <name>      # Create a new migration
node ace db:seed                    # Run database seeders

# Code Generation
node ace make:model <name>          # Create a model
node ace make:controller <name>     # Create a controller
node ace make:middleware <name>     # Create middleware
node ace make:validator <name>      # Create a validator

# Code Quality
bun run typecheck     # Type check TypeScript
bun run lint          # Lint code
bun run format        # Format code with Prettier
bun test              # Run all tests
node ace test         # Alternative test command
```

## Development Best Practices

### Demo Data & Seeders

**IMPORTANT**: When developing features that require demo data, ALWAYS use existing seeders instead of creating new ones.

**Existing Seeders**:

- `role_seeder.ts` - Creates roles (admin, manager, teacher, student)
- `user_seeder.ts` - Creates test users (admin, manager, teacher, student)
- `course_seeder.ts` - Creates sample courses with various statuses
- `course_category_seeder.ts` - Creates course categories
- `course_content_seeder.ts` - Creates sample course content
- `enrollment_method_seeder.ts` - Creates enrollment methods
- `cohort_seeder.ts` - Creates student cohorts
- `student_enrollment_seeder.ts` - Enrolls test student in courses
- `app_setting_seeder.ts` - App branding and settings
- `menu_seeder.ts` - Navigation menus (header, footer, user menu)

**Seeder Guidelines**:

1. Run `node ace db:seed` to populate all demo data
2. Reuse existing data models instead of creating duplicates
3. Check for existing records with `findBy()` or `updateOrCreate()`
4. Keep demo data realistic but minimal to avoid bloat during development
5. Document any new seeders in this file

**Test Accounts** (after running seeders):

```
Admin:    admin@edonis.test / password
Manager:  manager@edonis.test / password
Teacher:  teacher@edonis.test / password
Student:  student@edonis.test / password
```

## CI/CD Pipeline

The project uses GitHub Actions for continuous integration and deployment.

### Available Workflows

**1. CI Pipeline** (`.github/workflows/ci.yml`)

- **Triggers**: Push and Pull Requests to main/develop
- **Jobs**: Lint & Type Check, Build, Security Audit, Unit Tests (matrix: PostgreSQL, MySQL, SQLite)
- **Status**: Required checks for PR merges

**2. E2E Browser Tests** (`.github/workflows/e2e.yml`)

- **Triggers**: Pull Requests, nightly schedule (2 AM UTC), manual dispatch
- **Artifacts**: Screenshots, videos, and test reports on failure

**3. Code Quality** (`.github/workflows/code-quality.yml`)

- **Triggers**: Push and Pull Requests to main/develop
- **Jobs**: CodeQL, Dependency Review, Prettier Check, Commit Lint, Code Metrics

**4. Dependabot** (`.github/dependabot.yml`)

- Weekly updates on Mondays at 9 AM, groups minor/patch, auto-assigns to @delwwwinc

### Running CI Checks Locally

```bash
bun run lint && bun run typecheck && bun run build && node ace test
node ace db:seed && node ace test browser    # E2E tests
bun run format --check                       # Formatting check
```

### Conventional Commit Format

```
type(scope): description
```

Valid types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`

**Commit Guidelines:**
- Keep commit messages short and concise (one line preferred)
- Do NOT add AI co-authoring lines (Co-Authored-By, etc.)
- Focus on what changed, not who/what generated it

## Architecture Overview

**AdonisJS 6** application using **Inertia.js** with **React 19** — modern monolithic architecture (no separate API/frontend builds).

### Architectural Principles

1. **Modular Monolithic Design**: Clear module boundaries for future microservices evolution
2. **Domain-Driven Structure**: Organized by business domains, not technical layers
3. **Multi-Tenancy Ready**: Shared database with tenant isolation via `tenant_id`
4. **Type-Safe Throughout**: TypeScript for backend, frontend, and API contracts
5. **Standards Compliant**: Built-in support for educational standards (SCORM, xAPI, LTI, QTI)

> See `docs/PRODUCT_VISION.md` and `docs/FUTURE_ARCHITECTURE.md` for strategic context and planned architecture specs.

### Current Implementation

**Monolithic SPA**: Inertia.js for SPAs without building an API. Server-side routing with client-side navigation.

**SSR Enabled**: Server-side rendering configured in `vite.config.ts`.

**Subpath Imports** (defined in `package.json`):

- `#controllers/*` → `./app/controllers/*.js`
- `#models/*` → `./app/models/*.js`
- `#middleware/*` → `./app/middleware/*.js`
- `#validators/*` → `./app/validators/*.js`
- `#services/*` → `./app/services/*.js`
- Frontend uses `~/` alias → `./inertia/`

**Authentication & Authorization**:

- Session-based auth with `@adonisjs/auth`
- MFA/2FA with TOTP via `otpauth` (QR code setup, recovery codes)
- OAuth 2.0 social login (Google, GitHub) via `@adonisjs/ally`
- Role-based access control (RBAC) with custom `role` middleware in `app/middleware/role_middleware.ts`

**Security**:

- CSP headers via `@adonisjs/shield`
- Rate limiting via `@adonisjs/limiter` on login, register, 2FA, password change
- PII encryption at column level via `EncryptionService` (phone, address, identification)
- Audit logging on all security-relevant actions via `AuditService`

**GDPR Compliance**:

- Audit logs table tracking all user/admin actions with IP, user agent, metadata
- Terms consent versioning with `TERMS_VERSION` env variable and re-consent banner
- Data export (JSON) for data portability
- Account anonymization (right to be forgotten) preserving academic integrity

**Progressive Web App**:

- Service worker with workbox caching (images: CacheFirst, assets: StaleWhileRevalidate)
- Offline fallback page (`public/offline.html`)
- Install prompt banner and connectivity indicator

**Database**: Multi-engine support via Lucid ORM (Knex.js). Engines:

- **PostgreSQL** (recommended for production): JSONB columns, GIN full-text search
- **MySQL / MariaDB**: Native JSON, FULLTEXT search
- **SQLite** (dev/small deployments): Zero setup, file-based

Engine selected via `DB_CONNECTION` env var. See `docs/MULTI_DATABASE.md` for setup guide.

Docker services available: `docker compose up postgres|mysql|mariadb`

### Directory Structure

```
app/
├── controllers/
│   ├── auth_controller.ts          # Login, register, logout (with 2FA redirect)
│   ├── profile_controller.ts       # Profile edit, avatar upload, settings
│   ├── two_factor_controller.ts    # MFA/2FA setup, challenge, recovery
│   ├── social_auth_controller.ts   # OAuth redirect, callback, disconnect
│   ├── account_controller.ts       # Data export, account deletion, terms acceptance
│   ├── audit_logs_controller.ts    # Admin audit log viewer
│   ├── users_controller.ts         # Admin user CRUD
│   ├── courses_controller.ts       # Course management
│   ├── course_contents_controller.ts # Course content/modules
│   ├── categories_controller.ts    # Course categories
│   ├── enrollments_controller.ts   # Enrollment management
│   ├── evaluations_controller.ts   # Evaluation/assessment management
│   ├── grades_controller.ts        # Gradebook
│   ├── dashboard_controller.ts     # Dashboard page
│   ├── home_controller.ts          # Home/landing page
│   └── pages_controller.ts         # Static/dynamic pages
├── models/
│   ├── user.ts                     # User with 2FA, PII encryption, terms versioning
│   ├── role.ts / user_role.ts      # RBAC roles and pivot
│   ├── audit_log.ts                # Audit log entries
│   ├── social_account.ts           # OAuth linked accounts
│   ├── course.ts                   # Course
│   ├── course_module.ts            # Course modules
│   ├── course_content.ts           # Course content items
│   ├── course_category.ts          # Course categories
│   ├── course_enrollment.ts        # Student enrollments
│   ├── course_enrollment_method.ts # Enrollment methods
│   ├── course_enrollment_request.ts # Enrollment requests
│   ├── course_permission.ts        # Course-level permissions
│   ├── course_group.ts / course_group_member.ts / course_grouping.ts # Groups
│   ├── cohort.ts / cohort_member.ts # Student cohorts
│   ├── bulk_enrollment_log.ts      # Bulk enrollment tracking
│   ├── assignment.ts               # Assignments
│   ├── submission.ts               # Student submissions
│   ├── grade_category.ts           # Gradebook categories
│   ├── content_progress.ts         # Content progress tracking
│   ├── app_setting.ts              # App settings
│   └── menu.ts / menu_item.ts / menu_location.ts # Navigation menus
├── services/
│   ├── audit_service.ts            # Audit logging with context extraction
│   ├── two_factor_service.ts       # TOTP generation, verification, recovery codes
│   └── encryption_service.ts       # PII encryption/decryption wrapper
├── middleware/      # Request middleware (auth, guest, role, etc.)
├── validators/      # VineJS validation schemas
└── exceptions/      # Custom exception handler (404, 429, 500 pages)

config/              # AdonisJS configuration files
database/
├── migrations/      # Database schema migrations
└── seeders/         # Database seeders

inertia/
├── app/
│   ├── app.tsx      # Client-side entry (+ PWA install prompt, connectivity indicator)
│   └── ssr.tsx      # Server-side rendering entry
├── pages/
│   ├── auth/        # Login, register (with OAuth buttons)
│   ├── two-factor/  # 2FA setup (QR code) and challenge pages
│   ├── profile/     # Profile edit with 2FA badge
│   ├── settings/    # User settings with linked social accounts
│   ├── account/     # Data export, account deletion (GDPR)
│   ├── admin/       # Admin pages (audit-logs)
│   ├── courses/     # Course management pages
│   ├── enrollments/ # Enrollment management pages
│   ├── evaluations/ # Assessment/evaluation pages
│   ├── grades/      # Gradebook pages
│   ├── pages/       # Dynamic pages
│   ├── users/       # User CRUD pages
│   ├── errors/      # Custom error pages (not_found, too_many_requests, server_error)
│   ├── dashboard.tsx
│   ├── home.tsx
│   └── showcase.tsx
├── components/
│   ├── ui/                          # shadcn/ui components
│   ├── layout/                      # App header, sidebar, footer
│   ├── pwa-install-prompt.tsx       # PWA install banner
│   ├── connectivity-indicator.tsx   # Offline detection banner
│   ├── flash-toaster.tsx            # Toast notifications with aria-live
│   └── terms-consent-banner.tsx     # GDPR terms re-consent banner
├── css/
│   └── app.css      # Tailwind CSS with custom theme
└── lib/
    └── utils.ts     # Utility functions (cn helper)

start/
├── routes.ts        # Application routes definition
├── kernel.ts        # Middleware registration
└── limiter.ts       # Rate limiting rules (named throttles)

public/
├── icons/           # PWA icons (icon-192.png, icon-512.png)
├── offline.html     # PWA offline fallback page
└── uploads/         # User uploads (avatars)

tests/
├── browser/         # E2E browser tests (Playwright via @japa/browser-client)
│   ├── auth.spec.ts
│   ├── navigation.spec.ts
│   ├── user_management.spec.ts
│   ├── grades.spec.ts
│   └── accessibility.spec.ts  # axe-core a11y tests
└── functional/      # API/Integration tests

resources/
└── views/           # Edge templates (Inertia layout, error pages)
```

## Feature Roadmap

### Completed (Phase 1 — Q1 2026)

- **User Management**: Multi-role RBAC, OAuth 2.0 (Google, GitHub), MFA/2FA with TOTP, profile management, user settings
- **Course Management**: Drag-and-drop builder, content organization (modules/lessons/activities), enrollment systems (self/manual/bulk/key/request), categories, approval workflow, permissions, groups
- **Assessment Engine**: Assignments (essay, file_upload, online_text, offline), rubrics, grading types (points/percentage/letter/pass-fail), late submission policies, multiple attempts
- **Gradebook**: Category-based grading, weighted scores, progress dashboards, grade overview, submission tracking, feedback system
- **Security & GDPR**: CSP/CORS/rate limiting, PII encryption, audit logging, terms consent versioning, data export, account anonymization, custom error pages
- **PWA & Accessibility**: Service worker with offline fallback, install prompt, connectivity indicator, jsx-a11y linting, axe-core browser tests, skip links, aria-live regions

### Planned (Phase 2 — Q2-Q3 2026)

- **User Management**: SSO (SAML 2.0), bulk import, parent/guardian portal
- **Course Management**: Templates and cloning
- **Assessment**: Quiz builder with question banks, peer assessment, grade export (CSV/PDF)
- **Communication**: Forums, messaging, announcements, video conferencing, email/push notifications
- **Calendar**: Scheduling, event management, deadline reminders, resource booking
- **AI Features**: Content generation, personalized learning paths, automated assessment, intelligent tutoring
- **Standards**: SCORM 2004, xAPI, LTI 1.3, QTI 2.1

> See `docs/FUTURE_ARCHITECTURE.md` for detailed architecture specs and code examples for planned features.

## Frontend Architecture (Inertia + React)

### Styling: Tailwind CSS v4 + shadcn/ui

- **Tailwind v4**: Uses new `@import 'tailwindcss'` and `@theme` syntax
- **shadcn/ui**: Pre-built accessible components using Radix UI primitives
- **Theme**: Custom color system defined in `inertia/css/app.css` with CSS variables
- **Icons**: Lucide React icons

### Inertia.js Patterns

**Page Components**: Located in `inertia/pages/`, receive props from controllers via `inertia.render()`.

**Forms**: Use `useForm` hook from `@inertiajs/react`.

**Navigation**: Use `<Link>` component or `router` for client-side navigation.

### Component Organization

- **UI Components**: `inertia/components/ui/` - shadcn/ui components (Button, Input, Card, etc.)
- **Page Components**: `inertia/pages/` - Full page components rendered by routes
- **Utility**: `inertia/lib/utils.ts` - Helper functions like `cn()` for class merging

## Backend Architecture (AdonisJS)

### Routing Pattern

Routes defined in `start/routes.ts` with controller actions. Use route groups for applying middleware:

```typescript
router
  .group(() => {
    router.get('/users', [UsersController, 'index'])
  })
  .use(middleware.auth())
  .use(middleware.role({ roles: ['admin', 'manager'] }))
```

### Controller Pattern

Controllers return Inertia responses: `inertia.render('page/name', { props })`.

### Models & Relationships

Lucid ORM with decorators (`@column`, `@manyToMany`, `@hasMany`, etc.).

### Validation

VineJS validators in `app/validators/`. Use in controllers: `await request.validateUsing(validator)`.

### Authentication & Authorization

- `middleware.auth()` - Requires authenticated user
- `middleware.guest()` - Requires unauthenticated user
- `middleware.role({ roles: ['admin', 'manager'] })` - Requires specific roles
- Access user: `auth.user!` (guaranteed by auth middleware)

## Database Conventions

1. **Migrations**: Timestamped files in `database/migrations/`, always include `up()` and `down()`
2. **Naming**: Tables plural snake_case, foreign keys `{table}_id`, pivot tables alphabetically ordered
3. **Timestamps**: Most tables include `created_at` and `updated_at`
4. **Multi-Tenancy**: All tenant-aware tables must include `tenant_id UUID NOT NULL`
5. **Soft Deletes**: Use `deleted_at` for important data rather than hard deletes

## Testing

### Framework: Japa

```bash
bun test                    # Run all tests
node ace test functional    # API/Integration tests
node ace test browser       # E2E browser tests
node ace test unit          # Unit tests
```

### Browser Testing (E2E)

Uses **@japa/browser-client** (Playwright-based). Configuration in `tests/bootstrap.ts`.

```bash
node ace test browser                              # All browser tests
node ace test browser tests/browser/auth.spec.ts   # Specific test file
HEADLESS=false node ace test browser               # Headed mode
BROWSER=firefox node ace test browser              # Specific browser
```

### Adding a New Module/Feature

1. Create Migration: `node ace make:migration create_<table>_table`
2. Create Model: `node ace make:model <Name>`
3. Create Controller: `node ace make:controller <Name>Controller`
4. Create Validator: `node ace make:validator <name>`
5. Define Routes in `start/routes.ts`
6. Create Inertia Pages in `inertia/pages/<name>/`
7. Use shadcn/ui components from `inertia/components/ui/`
8. Write Tests

## Production Build

```bash
bun run build
cd build && bun install --production && node bin/server.js
```

## Environment Configuration

Key environment variables:

```env
PORT=3333
HOST=localhost
NODE_ENV=development
APP_KEY=<generated-key>          # node ace generate:key

# Database — supported: postgres, mysql, sqlite
DB_CONNECTION=postgres           # Engine selector
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_DATABASE=edonis_lms
DB_FILENAME=./tmp/db.sqlite3     # SQLite only

SESSION_DRIVER=cookie
CORS_ORIGIN=http://localhost:3333
TERMS_VERSION=1.0               # Bump to trigger GDPR re-consent banner

# OAuth 2.0 (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=/auth/google/callback
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=/auth/github/callback
```

## Important Development Notes

- **HMR**: Configured for controllers and middleware via `hot-hook` boundaries in `package.json`
- **SSR**: Changes to SSR entry require server restart
- **Type Safety**: Run `bun run typecheck` before committing
- **Migrations**: Always create reversible migrations with proper `down()` methods. Use `jsonColumn()` from `database/helpers/schema_helpers.ts` instead of `table.jsonb()` for cross-engine compatibility (preserves JSONB on PostgreSQL)
- **JSON columns in models**: Always use `prepare`/`consume` with `typeof` guards (or `jsonColumnConfig` from `app/helpers/json_column.ts`) — PostgreSQL returns objects, MySQL/SQLite return strings
- **Authorization**: Check both authentication AND authorization in protected routes
- **Multi-Tenancy**: Always include `tenant_id` in tenant-aware queries
- **Security**: Sanitize user input, use parameterized queries, validate on both client and server
- **Audit Logging**: Use `AuditService.logFromContext(ctx, { ... })` for all security-relevant actions
- **PII Encryption**: Use `EncryptionService.encrypt()`/`decrypt()` or Lucid column `prepare`/`consume` for sensitive fields
- **Rate Limiting**: All auth-related endpoints must have rate limiting via `@adonisjs/limiter`
- **Accessibility**: Use `eslint-plugin-jsx-a11y` rules; all new pages should pass axe-core critical/serious checks
- **GDPR**: Any new personal data field must be included in `AccountController.exportData` and anonymized in account deletion
- **PWA**: Client-side components using browser APIs must handle SSR gracefully (return `null` on server)
