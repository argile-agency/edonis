# Edonis LMS

[![CI](https://github.com/argile-agency/edonis/actions/workflows/ci.yml/badge.svg)](https://github.com/argile-agency/edonis/actions/workflows/ci.yml)
[![E2E Tests](https://github.com/argile-agency/edonis/actions/workflows/e2e.yml/badge.svg)](https://github.com/argile-agency/edonis/actions/workflows/e2e.yml)
[![Code Quality](https://github.com/argile-agency/edonis/actions/workflows/code-quality.yml/badge.svg)](https://github.com/argile-agency/edonis/actions/workflows/code-quality.yml)
[![CodeQL](https://github.com/argile-agency/edonis/actions/workflows/code-quality.yml/badge.svg?event=schedule)](https://github.com/argile-agency/edonis/security/code-scanning)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

An open-source alternative to the dominant Learning Management Systems, built with AdonisJS, React and TypeScript.

> **Status: in active development.** See the [public roadmap](https://edonis.org/changelog) · [Website](https://edonis.org) · [Live demo](https://demo.edonis.org)

## Key Features

Available today:

- **Course builder**: drag-and-drop sections and content, inline editing with autosave, bulk actions (publish, move, duplicate, shift dates)
- **Assignments, rubrics and grades**: text, file, online text and offline assignments; points, percentage, letter or pass/fail grading; late submissions, multiple attempts, weighted gradebook
- **Roles and enrollment**: four roles (admin, manager, teacher, student); self, manual, key, on-request and bulk enrollment; cohorts and groups
- **Security**: MFA/2FA (TOTP), Google and GitHub login, CSP headers, rate limiting, PII encryption, uniform authorization policies
- **Data sovereignty and GDPR**: self-hosted on PostgreSQL, MySQL, MariaDB or SQLite; audit log, terms consent versioning, data export, account anonymization
- **Accessibility and sobriety**: installable PWA with offline fallback, self-hosted fonts, automated accessibility checks (axe-core, jsx-a11y). No accessibility certification is claimed.

Planned work (page editor, AI governance, interoperability) is listed in the [Roadmap](#roadmap).

## 🛠️ Tech Stack

- **Backend**: AdonisJS 6 (TypeScript, MVC Framework)
- **Frontend**: React 19 + Inertia.js + shadcn/ui
- **Database**: PostgreSQL (recommended, Supabase optional), MySQL, MariaDB or SQLite via Lucid ORM
- **Styling**: Tailwind CSS v4
- **Package Manager**: Bun (preferred) / pnpm / npm

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed
- [Docker](https://www.docker.com) installed (for database options)

### Installation

1. Clone the repository
2. Install dependencies:

```bash
bun install
```

3. Set up your environment:

```bash
cp .env.example .env
```

4. Choose your database option (see below)

---

## Database Setup Options

Edonis runs on **PostgreSQL** (recommended), **MySQL**, **MariaDB** or **SQLite**. Pick the engine with `DB_CONNECTION` in `.env`. See [docs/MULTI_DATABASE.md](docs/MULTI_DATABASE.md) for MySQL, MariaDB and SQLite setup.

For PostgreSQL in development you have **two options**:

### Option 1: Supabase Local Dev (PostgreSQL) ✨

**Advantages:**

- Full Supabase features (Auth, Storage, Realtime, Row Level Security)
- Visual database UI (Supabase Studio)
- Easy sync to production Supabase
- Includes all Supabase services locally

**Setup:**

1. Install Supabase CLI:

```bash
brew install supabase/tap/supabase
```

2. Start Supabase local:

```bash
supabase start
```

3. Get your credentials:

```bash
supabase status
```

4. Update your `.env` with the values from `supabase status`:

```env
DB_HOST=127.0.0.1
DB_PORT=54322
DB_USER=postgres
DB_PASSWORD=postgres
DB_DATABASE=postgres

SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<from supabase status>
SUPABASE_SERVICE_KEY=<from supabase status>
```

5. Access Supabase Studio:

```
http://127.0.0.1:54323
```

**Useful Commands:**

```bash
supabase status      # Check running services
supabase stop        # Stop all services
supabase db reset    # Reset database to fresh state
```

---

### Option 2: Docker PostgreSQL (Simple) 🐳

`docker-compose.yml` also provides `mysql` and `mariadb` services.

**Advantages:**

- Simpler, fewer dependencies
- Standard PostgreSQL setup
- Lightweight

**Setup:**

1. Start PostgreSQL with Docker Compose:

```bash
docker-compose up -d postgres
```

2. Update your `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=edonis
DB_PASSWORD=edonis_dev_password
DB_DATABASE=edonis_lms
```

**Useful Commands:**

```bash
docker-compose up -d postgres  # Start PostgreSQL
docker-compose down       # Stop PostgreSQL
docker-compose down -v    # Stop and remove data
docker logs edonis_postgres  # View logs
```

---

## Running the Application

1. Run database migrations:

```bash
node ace migration:run
```

2. Seed the database with demo data:

```bash
node ace db:seed
```

3. Start the development server:

```bash
bun run dev
```

4. Open your browser:

```
http://localhost:3333
```

### Test Accounts

After running seeders, these accounts are available:

| Role    | Email               | Password |
| ------- | ------------------- | -------- |
| Admin   | admin@edonis.test   | password |
| Manager | manager@edonis.test | password |
| Teacher | teacher@edonis.test | password |
| Student | student@edonis.test | password |

---

## Development Commands

```bash
# Development
bun run dev              # Start dev server with HMR
bun run build            # Build for production
bun start                # Start production server

# Database
node ace migration:run       # Run pending migrations
node ace migration:rollback  # Rollback last batch
node ace migration:fresh     # Drop all tables and re-run
node ace db:seed             # Run database seeders

# Code Generation
node ace make:migration <name>   # Create a migration
node ace make:model <name>       # Create a model
node ace make:controller <name>  # Create a controller
node ace make:validator <name>   # Create a validator

# Code Quality
bun run typecheck        # Type check TypeScript
bun run lint             # Lint code
bun run format           # Format with Prettier

# Testing
bun test                 # Run all tests
node ace test            # Alternative test command
node ace test browser    # Run E2E browser tests
```

---

## Project Structure

```
├── app/
│   ├── controllers/     # HTTP controllers (auth, profile, 2FA, OAuth, audit, account)
│   ├── models/          # Lucid ORM models (User, Role, AuditLog, SocialAccount)
│   ├── services/        # Business logic (AuditService, TwoFactorService, EncryptionService)
│   ├── middleware/       # Request middleware (auth, guest, role)
│   ├── validators/      # VineJS validation schemas
│   └── exceptions/      # Custom exception handler (404, 429, 500 pages)
├── config/              # AdonisJS config (shield, cors, limiter, ally, inertia)
├── database/
│   ├── migrations/      # Database schema migrations
│   └── seeders/         # Database seeders (users, courses, menus)
├── inertia/
│   ├── pages/           # React pages (auth, dashboard, profile, settings, 2FA, account, admin)
│   └── components/      # React components (UI, layout, PWA, a11y, flash-toaster)
├── public/
│   ├── icons/           # PWA icons (192x192, 512x512)
│   └── offline.html     # PWA offline fallback page
├── resources/
│   └── views/           # Edge templates (Inertia layout, error pages)
├── start/
│   ├── routes.ts        # Application routes
│   ├── kernel.ts        # Middleware registration
│   └── limiter.ts       # Rate limiting configuration
└── tests/
    └── browser/         # E2E browser tests (auth, navigation, a11y)
```

---

## Production Deployment

Run `node ace migration:run --force` against any supported engine. When deploying to production with Supabase (PostgreSQL):

1. Create a project at [supabase.com](https://supabase.com)
2. Update `.env` with production credentials:

```env
DB_HOST=db.xxxxx.supabase.co
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<your-production-password>
DB_DATABASE=postgres

SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=<your-production-anon-key>
```

3. Run migrations:

```bash
node ace migration:run --force
```

---

## Security

Edonis LMS takes security seriously, especially given that LMS platforms handle sensitive student data.

### Application Security

- **MFA/2FA**: TOTP-based two-factor authentication with recovery codes
- **CSP Headers**: Content Security Policy with strict directives via `@adonisjs/shield`
- **Rate Limiting**: Protection against brute-force on login, register, 2FA challenge, and password change endpoints
- **PII Encryption**: Automatic column-level encryption for sensitive user data (phone, address, identification number)
- **CORS**: Environment-based origin validation
- **OAuth 2.0**: Social login with Google and GitHub via `@adonisjs/ally`
- **Audit Logging**: All security-relevant actions are logged with IP, user agent, and metadata

### Automated Security Scanning

- **CodeQL Analysis**: Runs on every PR and weekly, scanning for:
  - SQL/Command injection vulnerabilities
  - Cross-Site Scripting (XSS)
  - Authentication/authorization flaws
  - Sensitive data exposure
  - Cryptography issues
- **Dependency Review**: Checks for vulnerable dependencies on PRs
- **Security Audit**: `bun audit` runs in CI to detect known vulnerabilities

### GDPR Compliance

- **Audit Logs**: Track all user actions with resource type, old/new values, and metadata
- **Terms Consent**: Versioned consent tracking with re-consent banner when terms change
- **Data Export**: Users can export all their data as JSON (profile, enrollments, submissions, progress)
- **Right to Be Forgotten**: Account anonymization preserving academic integrity

### Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public issue
2. Report it privately through [GitHub Security Advisories](https://github.com/argile-agency/edonis/security/advisories/new) or email contact@edonis.org
3. Allow time for a fix before public disclosure

See [GitHub Security Advisories](https://github.com/argile-agency/edonis/security/advisories) for known issues.

## 🤝 Contributing

We welcome contributions! Please see our [CLAUDE.md](CLAUDE.md) for architecture details and development guidelines.

### Quick Start for Contributors

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes following our coding standards
4. Run tests: `bun test`
5. Commit with conventional commits: `git commit -m "feat: add amazing feature"`
6. Push and create a Pull Request

## 📄 License

**Apache License 2.0**

Copyright 2025 argile agency

Licensed under the Apache License, Version 2.0 (the "License"). You may obtain a copy of the License at:

http://www.apache.org/licenses/LICENSE-2.0

This project uses Apache 2.0 for:

- 🛡️ Patent protection for users and contributors
- 🏢 Enterprise-friendly adoption
- 🔒 Trademark protection for the "Edonis" brand
- ⚖️ Clear contribution terms

See [LICENSE](LICENSE) and [NOTICE](NOTICE) files for details.

## 🌟 How Edonis Compares

| Fact                 | Edonis                       | Moodle            | Canvas LMS (open source) | Blackboard Learn  |
| -------------------- | ---------------------------- | ----------------- | ------------------------ | ----------------- |
| **Main language**    | TypeScript (AdonisJS, React) | PHP               | Ruby on Rails            | Java              |
| **License**          | Apache 2.0                   | GPL v3            | AGPL v3                  | Proprietary       |
| **Source available** | Yes                          | Yes               | Yes                      | No                |
| **Mobile access**    | Installable PWA              | Native mobile app | Native mobile apps       | Native mobile app |

## Roadmap

Edonis is in active development. The public roadmap lives at [edonis.org/changelog](https://edonis.org/changelog).

### Delivered

- **January 2026: LMS foundation**: courses, sections and content; multi-method enrollment, cohorts and groups; assignments, rubrics and gradebook; 2FA, Google and GitHub login; GDPR (audit log, data export, anonymization); installable PWA and automated accessibility tests
- **May 2026: Multi-database**: PostgreSQL, MySQL, MariaDB and SQLite
- **October 2026: Reliability and security**: green CI on all three engines, uniform authorization and input validation, transactional enrollments with reliable counters, course files stored outside the web root with authorized download
- **November 2026: Course builder**: drag-and-drop sections and content, inline editing with autosave, bulk actions (publish, move, duplicate, shift dates), accessible drag-and-drop announcements

### Planned

- **End of 2026 (target): Page editor**: rich editor with a sanitized HTML source mode; full teacher → learner path, internal use first
- **Q1 2027 (target): AI governance and first pilots**: AI off by default, policy-routed, budgeted and traceable; designed to support compliance with articles 5 and 50 of the EU AI Act; learner accommodation profile; installation, backup and admin documentation; unified rubric and per-question marking; files, external links and progress tracking
- **Spring 2027 (target): Gradual launch** to about fifty early adopters

### Under consideration (no date)

- **Interoperability**: SCORM, xAPI, H5P, LTI and an extension system, in the order the first institutions need them
- **Course import**: Moodle backups (`.mbz`) and spreadsheet-based course designs

## 💬 Support

- **Documentation**: [CLAUDE.md](CLAUDE.md)
- **Issues**: [GitHub Issues](https://github.com/argile-agency/edonis/issues)
- **Discussions**: [GitHub Discussions](https://github.com/argile-agency/edonis/discussions)
- **Pilot institutions**: [contact@edonis.org](mailto:contact@edonis.org)

## 🙏 Acknowledgments

Built with amazing open-source projects:

- [AdonisJS](https://adonisjs.com) - The TypeScript framework
- [React](https://react.dev) - UI library
- [Inertia.js](https://inertiajs.com) - Modern monolith approach
- [shadcn/ui](https://ui.shadcn.com) - Beautiful UI components
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS

---

Made with ❤️ by [argile agency](https://argile.agency) | [Website](https://edonis.org) | [Demo](https://demo.edonis.org) | [Documentation](./CLAUDE.md)
