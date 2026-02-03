# External Integrations

**Analysis Date:** 2026-02-03

## APIs & External Services

**OAuth 2.0 / Social Login:**
- Google OAuth - Sign in with Google
  - SDK/Client: `@adonisjs/ally`
  - Configuration: `config/ally.ts`
  - Controller: `app/controllers/social_auth_controller.ts`
  - Env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - Callback URL: `/auth/google/callback`
  - Scopes: `openid`, `email`, `profile`

- GitHub OAuth - Sign in with GitHub
  - SDK/Client: `@adonisjs/ally`
  - Configuration: `config/ally.ts`
  - Controller: `app/controllers/social_auth_controller.ts`
  - Env vars: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
  - Callback URL: `/auth/github/callback`
  - Scopes: `user:email`

## Data Storage

**Databases:**
- PostgreSQL 12+ (primary database)
  - Connection: Environment variables (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`)
  - Client: `pg` (Node.js PostgreSQL driver)
  - ORM: Lucid (`@adonisjs/lucid`)
  - Migrations: Located in `database/migrations/`
  - Connection config: `config/database.ts`
  - Development setup options:
    - Supabase Local Dev Stack (recommended) - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` env vars
    - Docker Compose PostgreSQL container - Port 5432

**File Storage:**
- Not configured (local filesystem only)
- No cloud storage (S3, Azure Blob, etc.) integration detected

**Caching:**
- In-memory store (development)
  - Driver: `memory` in `config/limiter.ts`
  - Used by: Rate limiter
  - Not suitable for production (single-process only)
- No distributed cache (Redis) configured

## Authentication & Identity

**Auth Provider:**
- Custom session-based authentication (AdonisJS built-in)
  - Implementation: `@adonisjs/auth` v9.4
  - Guard type: Session guard with cookie storage
  - Configuration: `config/auth.ts`
  - User model: `app/models/user.ts`
  - Session storage: Cookie-based (not server-side)

**Two-Factor Authentication:**
- TOTP (Time-based One-Time Password)
  - Library: `otpauth` v9.4
  - Service: `app/services/two_factor_service.ts`
  - Features:
    - Generate TOTP secrets with QR code
    - Verify 6-digit TOTP tokens
    - Generate and consume recovery codes
    - Secrets encrypted at-rest using AdonisJS encryption

**OAuth Integration:**
- Provider: `@adonisjs/ally` v5.1
- Supported: Google OAuth, GitHub OAuth
- Social account linking: `app/models/social_account.ts`
- Controller: `app/controllers/social_auth_controller.ts`

**Encryption:**
- AdonisJS built-in encryption service
  - Uses: `APP_KEY` environment variable
  - Service: `app/services/encryption_service.ts`
  - Used for: TOTP secrets, recovery codes, PII encryption

## Monitoring & Observability

**Error Tracking:**
- Not configured (no Sentry, Rollbar, etc.)

**Logs:**
- Pino logger via `@adonisjs/core/logger`
- Configuration: `config/logger.ts`
- Outputs:
  - Development: Pretty-printed JSON (via `pino-pretty`)
  - Production: Stdout (suitable for container logging)
- Log level: Configurable via `LOG_LEVEL` env var

**Audit Logging:**
- Custom audit trail implementation
  - Service: `app/services/audit_service.ts`
  - Model: `app/models/audit_log.ts`
  - Database-backed audit logs for user actions
  - Used in: User management, course operations, enrollments

## CI/CD & Deployment

**Hosting:**
- Not specified in codebase (framework-agnostic)
- Deployment patterns: Containerization recommended (Node.js + PostgreSQL)
- Docker Compose example: `docker-compose.yml` for local development

**CI Pipeline:**
- GitHub Actions (configured in `.github/workflows/`)
  - CI Pipeline: Lint, type check, build, security audit, unit tests
  - E2E Browser Tests: Playwright automated testing
  - Code Quality: CodeQL, dependency review, Prettier check, commit lint
  - Dependabot: Weekly dependency updates

**Build System:**
- Vite 6.3 for frontend bundling
- AdonisJS assembler for backend compilation
- Build command: `bun run build` → outputs to `./build/`

## Environment Configuration

**Required env vars:**
- Core:
  - `NODE_ENV` - `development`, `production`, or `test`
  - `PORT` - Server port (default: 3333)
  - `HOST` - Server host (default: localhost)
  - `APP_KEY` - Encryption key (generate with: `node ace generate:key`)
  - `LOG_LEVEL` - `debug`, `info`, `warn`, `error`, `fatal`
  - `SESSION_DRIVER` - `cookie` or `memory`

- Database:
  - `DB_HOST` - PostgreSQL hostname
  - `DB_PORT` - PostgreSQL port (5432)
  - `DB_USER` - PostgreSQL username
  - `DB_PASSWORD` - PostgreSQL password (optional)
  - `DB_DATABASE` - PostgreSQL database name

- OAuth:
  - `GOOGLE_CLIENT_ID` - Google OAuth client ID (optional)
  - `GOOGLE_CLIENT_SECRET` - Google OAuth client secret (optional)
  - `GITHUB_CLIENT_ID` - GitHub OAuth client ID (optional)
  - `GITHUB_CLIENT_SECRET` - GitHub OAuth client secret (optional)

- Supabase (optional):
  - `SUPABASE_URL` - Supabase project URL
  - `SUPABASE_ANON_KEY` - Supabase anonymous key
  - `SUPABASE_SERVICE_KEY` - Supabase service key

- Terms & Compliance:
  - `TERMS_VERSION` - Version string for terms of service consent re-prompting (optional)

**Secrets location:**
- Development: `.env` file (git-ignored)
- Production: Environment variables set in deployment platform

**CORS:**
- Configured via `@adonisjs/cors` v2.2
- Configuration: `config/cors.ts`
- Env var: `CORS_ORIGIN` (optional, defaults to localhost)

## Webhooks & Callbacks

**Incoming:**
- OAuth callback routes:
  - `/auth/google/callback` - Handled by `social_auth_controller.ts`
  - `/auth/github/callback` - Handled by `social_auth_controller.ts`

**Outgoing:**
- Not configured (no Stripe webhooks, external API callbacks detected)

## Rate Limiting

**Framework:**
- @adonisjs/limiter 2.4
- Configuration: `config/limiter.ts`
- Store: In-memory (not production-ready for distributed systems)
- Usage: Can be applied to routes for DDoS/abuse protection

## Security Headers & Middleware

**CSRF Protection:**
- @adonisjs/shield 8.2
- Middleware: Enabled globally in `start/kernel.ts`
- Configuration: `config/shield.ts`

**Security Middleware Stack (all active):**
- Static file serving
- CORS middleware
- Vite dev middleware
- Inertia middleware
- Body parser
- Session middleware
- Shield (CSRF)
- Auth initialization
- Custom: Container bindings, DB health check, silent auth

## Progressive Web App

**PWA Support:**
- Configured via `vite-plugin-pwa` 1.2
- Configuration: `vite.config.ts`
- Features:
  - Automatic service worker generation
  - Offline support with runtime caching
  - Manifest: `manifest.json` (auto-generated)
  - Icons: 192px and 512px in `/public/icons/`
  - Offline page: `/offline.html`
  - Cache strategies:
    - Images (PNG, JPG, SVG, GIF, WebP): Cache-first (30 days)
    - JS/CSS assets: Stale-while-revalidate
  - Navigation fallback: `/offline.html` for unregistered routes
  - Excluded from caching: `/api/*`, `/auth/*`, static files

---

*Integration audit: 2026-02-03*
