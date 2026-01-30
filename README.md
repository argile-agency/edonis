# Edonis LMS

[![CI](https://github.com/argile-agency/edonis/actions/workflows/ci.yml/badge.svg)](https://github.com/argile-agency/edonis/actions/workflows/ci.yml)
[![E2E Tests](https://github.com/argile-agency/edonis/actions/workflows/e2e.yml/badge.svg)](https://github.com/argile-agency/edonis/actions/workflows/e2e.yml)
[![Code Quality](https://github.com/argile-agency/edonis/actions/workflows/code-quality.yml/badge.svg)](https://github.com/argile-agency/edonis/actions/workflows/code-quality.yml)
[![CodeQL](https://github.com/argile-agency/edonis/actions/workflows/code-quality.yml/badge.svg?event=schedule)](https://github.com/argile-agency/edonis/security/code-scanning)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

A modern, open-source Learning Management System built with AdonisJS, React, and PostgreSQL.

**Edonis LMS** combines modern architecture, mobile-first design, and native AI integration to deliver a superior learning experience for educational institutions. Built with TypeScript and featuring comprehensive educational standards compliance (SCORM, xAPI, LTI 1.3, QTI 2.1).

## Key Features

- **Complete LMS Functionality**: Course management, assignments, gradebook, and assessments
- **Security**: MFA/2FA (TOTP), CSP headers, rate limiting, PII encryption
- **OAuth 2.0**: Social login with Google and GitHub
- **GDPR Compliance**: Audit logs, terms consent versioning, data export, account deletion (right to be forgotten)
- **Progressive Web App**: Offline support, install prompt, connectivity detection
- **Accessibility**: ESLint jsx-a11y, axe-core automated tests, skip links, aria-live regions
- **Enterprise-Ready**: Multi-tenancy, RBAC, role-based access control
- **Standards Compliant**: SCORM 2004, xAPI, LTI 1.3, QTI 2.1 (planned)

## 🛠️ Tech Stack

- **Backend**: AdonisJS 6 (TypeScript, MVC Framework)
- **Frontend**: React 19 + Inertia.js + shadcn/ui
- **Database**: PostgreSQL (with Supabase optional)
- **Styling**: Tailwind CSS v4
- **Package Manager**: Bun (preferred) / pnpm / npm
- **Real-time**: WebSocket + SSE for live collaboration

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

You have **two options** for running PostgreSQL in development:

### Option 1: Supabase Local Dev (Recommended) ✨

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

**Advantages:**

- Simpler, fewer dependencies
- Standard PostgreSQL setup
- Lightweight

**Setup:**

1. Start PostgreSQL with Docker Compose:

```bash
docker-compose up -d
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
docker-compose up -d      # Start PostgreSQL
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

When deploying to production with Supabase:

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
2. Email security concerns to the maintainers
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

## 🌟 Why Edonis?

Compared to existing LMS solutions:

| Feature                  | Edonis              | Moodle     | Canvas     | Blackboard  |
| ------------------------ | ------------------- | ---------- | ---------- | ----------- |
| **Modern Stack**         | ✅ TypeScript/React | ❌ PHP     | ❌ Ruby    | ❌ Java     |
| **AI Integration**       | ✅ Native           | ⚠️ Plugins | ⚠️ Limited | ⚠️ Limited  |
| **Mobile-First**         | ✅ PWA              | ❌         | ⚠️         | ⚠️          |
| **License**              | Apache 2.0          | GPL        | AGPL       | Proprietary |
| **Developer Experience** | ✅ Excellent        | ❌         | ⚠️         | ❌          |
| **Plugin System**        | ✅ Type-safe        | ✅         | ⚠️         | ❌          |

## Roadmap

See [CLAUDE.md](CLAUDE.md) for detailed architecture and feature roadmap.

### Phase 1 (MVP) - Q4 2025

- [x] User management with RBAC
- [x] Authentication & authorization
- [x] Dynamic homepage system with role-based content
- [x] Theme system (light/dark/system)
- [x] Course management system
- [x] Course enrollment workflows
- [x] Assignment workflow & evaluations
- [x] Gradebook & progress tracking
- [ ] Communication tools (forums, messaging)

### Phase 1.5 (Security, GDPR, A11y) - Q1 2026 (Current)

- [x] MFA/2FA with TOTP and recovery codes
- [x] OAuth 2.0 social login (Google, GitHub)
- [x] CSP headers and rate limiting
- [x] PII encryption (phone, address, identification)
- [x] Audit logging system with admin page
- [x] GDPR: terms consent versioning and re-consent flow
- [x] GDPR: data export and account deletion (right to be forgotten)
- [x] PWA: service worker, offline page, install prompt, connectivity indicator
- [x] Accessibility: jsx-a11y linting, axe-core tests, skip links, aria-live
- [x] Profile management with avatar upload
- [x] User settings with linked social accounts
- [x] Custom error pages (404, 429, 500)

### Phase 2 (AI & Advanced Features) - Q2-Q3 2026

- [ ] AI content generation (quizzes, summaries, objectives)
- [ ] Personalized learning paths
- [ ] Automated assessment & essay scoring
- [ ] AI tutoring chatbot
- [ ] Push notifications
- [ ] Discussion forums with threading
- [ ] Direct messaging system
- [ ] Video conferencing integration (Zoom, Google Meet)

### Phase 3 (Enterprise & Scale) - Q4 2026

- [ ] Plugin marketplace & ecosystem
- [ ] Advanced learning analytics
- [ ] Gamification features (badges, leaderboards)
- [ ] Real-time collaboration tools
- [ ] Multi-language support (i18n)
- [ ] SSO integration (SAML 2.0)
- [ ] Full standards compliance (SCORM 2004, xAPI, LTI 1.3, QTI 2.1)
- [ ] Performance optimization for 10k+ users
- [ ] Enterprise support & SLA options

## 💬 Support

- **Documentation**: [CLAUDE.md](CLAUDE.md)
- **Issues**: [GitHub Issues](https://github.com/argile-agency/edonis/issues)
- **Discussions**: [GitHub Discussions](https://github.com/argile-agency/edonis/discussions)

## 🙏 Acknowledgments

Built with amazing open-source projects:

- [AdonisJS](https://adonisjs.com) - The TypeScript framework
- [React](https://react.dev) - UI library
- [Inertia.js](https://inertiajs.com) - Modern monolith approach
- [shadcn/ui](https://ui.shadcn.com) - Beautiful UI components
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS

---

Made with ❤️ by [argile agency](https://argile.agency) | [Website](https://edonis.dev) | [Documentation](./CLAUDE.md)
