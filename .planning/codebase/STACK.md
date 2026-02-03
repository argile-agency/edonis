# Technology Stack

**Analysis Date:** 2026-02-03

## Languages

**Primary:**
- TypeScript 5.8 - Full codebase (backend controllers, models, middleware, services, validators)
- TSX/JSX - Frontend components in `inertia/` directory using React 19
- Edge Templates - Server-side views (primarily `inertia_layout`)

**Secondary:**
- JavaScript - Build and config files (Vite, PostCSS, Tailwind)
- SQL - Database migrations and queries via Lucid ORM

## Runtime

**Environment:**
- Node.js (version not pinned in `.nvmrc` or `package.json` - uses system Node)
- Recommended: Node.js 18+ for TypeScript and modern async features

**Package Manager:**
- Bun (primary) - See `CLAUDE.md` for project conventions
- Lockfile: Not present in repository (uses Bun's binary lockfile)

## Frameworks

**Core:**
- AdonisJS 6.18 - Full-stack TypeScript framework for backend
- Inertia.js 3.1 - Server-driven SPA framework for seamless frontend integration
- React 19 - Frontend UI library (via `@inertiajs/react`)

**Frontend:**
- React 19.2 - UI components and pages
- Tailwind CSS 4.1 - Utility-first CSS framework with v4 syntax (`@import 'tailwindcss'`)
- shadcn/ui - Pre-built accessible component library (Radix UI primitives + Tailwind)
- Lucide React 0.553 - Icon library

**Testing:**
- Japa 4.2 - Test runner for unit, functional, and browser tests
- @japa/browser-client 2.1 - Playwright-based E2E testing
- @japa/assert 4.0 - Assertion library
- @japa/plugin-adonisjs 4.0 - AdonisJS integration plugin
- Playwright 1.56 - Browser automation (Chromium, Firefox, WebKit)
- @axe-core/playwright 4.11 - Accessibility testing

**Build/Dev:**
- Vite 6.3 - Frontend bundler with HMR support
- @adonisjs/vite 4.0 - AdonisJS Vite integration
- @vitejs/plugin-react 5.0 - React plugin for Vite
- vite-plugin-pwa 1.2 - Progressive Web App manifest and service worker generation
- SWC (@swc/core 1.11) - Fast TypeScript/JavaScript transpiler
- hot-hook 0.4 - Selective hot reload for controllers and middleware

**Linting & Formatting:**
- ESLint 9.26 - Code linting
- @adonisjs/eslint-config 2.0 - AdonisJS ESLint rules
- eslint-plugin-jsx-a11y 6.10 - JSX accessibility checks
- Prettier 3.5 - Code formatting (via `@adonisjs/prettier-config`)
- @adonisjs/prettier-config 1.4 - AdonisJS Prettier configuration

**Type Checking:**
- TypeScript 5.8 - Language and type system

## Key Dependencies

**Critical Framework Dependencies:**
- @adonisjs/core 6.18 - Core framework functionality
- @adonisjs/lucid 21.6 - ORM and database abstraction
- @adonisjs/auth 9.4 - Authentication guard system
- @adonisjs/inertia 3.1 - Inertia server adapter
- @adonisjs/session 7.5 - Session management (cookie-based)
- @adonisjs/ally 5.1 - OAuth provider integration (Google, GitHub)
- @adonisjs/cors 2.2 - CORS middleware
- @adonisjs/shield 8.2 - CSRF protection and security headers
- @adonisjs/limiter 2.4 - Rate limiting
- @adonisjs/static 1.1 - Static file serving

**Database & ORM:**
- pg 8.16 - PostgreSQL client driver
- @adonisjs/lucid 21.6 - Lucid ORM for database abstraction

**Authentication & Security:**
- @adonisjs/auth 9.4 - Session-based authentication
- otpauth 9.4 - TOTP 2FA implementation (OTP generation and validation)
- qrcode 1.5 - QR code generation for 2FA setup

**Frontend Components & Styling:**
- @radix-ui/* (multiple) - Headless UI primitives (Alert Dialog, Avatar, Checkbox, Dialog, Dropdown, Label, Progress, Select, Separator, Slot, Switch, Tabs)
- tailwind-merge 3.3 - Merge Tailwind class names intelligently
- clsx 2.1 - Conditional CSS class concatenation
- class-variance-authority 0.7 - Component variant system
- sonner 2.0 - Toast notification library
- lucide-react 0.553 - Icon library

**Date/Time Handling:**
- luxon 3.7 - Advanced date/time manipulation and formatting

**UI Utilities:**
- Edge.js 6.4 - Template engine for server-side rendering

**Metadata & Reflection:**
- reflect-metadata 0.2 - Polyfill for metadata reflection (used by Lucid decorators)

**Development & Building:**
- @adonisjs/assembler 7.8 - AdonisJS build and development tools
- @adonisjs/tsconfig 1.4 - AdonisJS TypeScript configuration preset
- @types/node 22.15 - Node.js type definitions
- @types/react 19.2 - React type definitions
- @types/react-dom 19.2 - ReactDOM type definitions
- @types/luxon 3.7 - Luxon type definitions
- @types/qrcode 1.5 - QR code library type definitions
- ts-node-maintained 10.9 - TypeScript execution for Node.js
- pino-pretty 13.0 - Pretty-print JSON logs
- docx 9.5 - Word document generation library

## Configuration

**Environment:**
- Environment variables loaded from `.env` file via `start/env.ts`
- Key configs: `NODE_ENV`, `PORT`, `HOST`, `LOG_LEVEL`, `SESSION_DRIVER`, database credentials, OAuth secrets
- See `.env.example` for complete list

**Build Configuration:**
- `vite.config.ts` - Frontend build and SSR configuration
  - Inertia SSR enabled at `inertia/app/ssr.tsx`
  - PWA manifest and service worker via vite-plugin-pwa
  - Runtime caching for images, CSS, JS
- `tsconfig.json` - TypeScript compilation with AdonisJS preset
- `tailwind.config.js` - CSS framework with custom color theme (CSS variables)
- `postcss.config.js` - PostCSS plugins (Tailwind v4, Autoprefixer)
- `eslint.config.js` - ESLint configuration with AdonisJS rules and JSX a11y
- `components.json` - shadcn/ui configuration (component paths, Lucide icons)

**Database Configuration:**
- `config/database.ts` - PostgreSQL connection via Lucid
- Natural sort migrations, migration path: `database/migrations`

**Session Configuration:**
- `config/session.ts` - Cookie-based session store, 2-hour age, httpOnly/secure/sameSite=lax cookies

**Authentication Configuration:**
- `config/auth.ts` - Session-based web guard with User model provider
- `config/ally.ts` - OAuth providers (Google, GitHub) with Ally

**Inertia Configuration:**
- `config/inertia.ts` - Shared data (auth, appSettings, flash messages, menus)
- SSR enabled for server-side rendering
- Root view: `inertia_layout`

## Platform Requirements

**Development:**
- Node.js 18+ (recommended, not enforced)
- Bun package manager
- PostgreSQL 12+ (local via docker-compose or Supabase)
- Modern browser with ES2020+ support

**Production:**
- Node.js 18+
- PostgreSQL database (Supabase recommended, or self-hosted)
- Reverse proxy/load balancer (nginx, Traefik)
- SSL/TLS certificate

**Optional Services:**
- Supabase Local Dev Stack (recommended for development)
- Docker and Docker Compose (for local PostgreSQL)

---

*Stack analysis: 2026-02-03*
