# Edonis LMS

A modern, open-source Learning Management System built with AdonisJS, React, and PostgreSQL.

**Edonis LMS** combines modern architecture, mobile-first design, and native AI integration to deliver a superior learning experience for educational institutions. Built with TypeScript and featuring comprehensive educational standards compliance (SCORM, xAPI, LTI 1.3, QTI 2.1).

## ✨ Key Features

- 🎓 **Complete LMS Functionality**: Course management, assignments, gradebook, and assessments
- 🤖 **AI-Powered Learning**: Content generation, personalized paths, automated grading
- 📱 **Mobile-First PWA**: Offline support, touch-optimized, cross-platform
- 🔌 **Extensible Plugin System**: WordPress-inspired but type-safe
- 📊 **Learning Analytics**: xAPI/SCORM compliance for detailed insights
- 🔒 **Enterprise-Ready**: Multi-tenancy, SSO, role-based access control
- 🌐 **Standards Compliant**: SCORM 2004, xAPI, LTI 1.3, QTI 2.1

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

2. Start the development server:
```bash
npm run dev
```

3. Open your browser:
```
http://localhost:3333
```

---

## Development Commands

```bash
# Run migrations
node ace migration:run

# Rollback migrations
node ace migration:rollback

# Create a new migration
node ace make:migration <name>

# Create a new model
node ace make:model <name>

# Create a new controller
node ace make:controller <name>

# Run tests
npm test

# Build for production
npm run build

# Start production server
npm start
```

---

## Project Structure

```
├── app/
│   ├── controllers/     # HTTP controllers
│   ├── models/         # Database models
│   └── middleware/     # Middleware
├── config/             # Configuration files
├── database/
│   └── migrations/     # Database migrations
├── inertia/
│   ├── pages/          # React pages
│   └── components/     # React components
├── resources/
│   └── views/          # Edge templates
└── start/
    ├── routes.ts       # Application routes
    └── kernel.ts       # Middleware registration
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

| Feature | Edonis | Moodle | Canvas | Blackboard |
|---------|--------|--------|--------|------------|
| **Modern Stack** | ✅ TypeScript/React | ❌ PHP | ❌ Ruby | ❌ Java |
| **AI Integration** | ✅ Native | ⚠️ Plugins | ⚠️ Limited | ⚠️ Limited |
| **Mobile-First** | ✅ PWA | ❌ | ⚠️ | ⚠️ |
| **License** | Apache 2.0 | GPL | AGPL | Proprietary |
| **Developer Experience** | ✅ Excellent | ❌ | ⚠️ | ❌ |
| **Plugin System** | ✅ Type-safe | ✅ | ⚠️ | ❌ |

## 🗺️ Roadmap

See [CLAUDE.md](CLAUDE.md) for detailed architecture and feature roadmap.

### Phase 1 (MVP) - Q4 2025 (Current)
- ✅ User management with RBAC
- ✅ Authentication & authorization
- ✅ Dynamic homepage system with role-based content
- ✅ Theme system (light/dark/system)
- 🚧 Course management system
- 🚧 Course enrollment workflows
- 🚧 Assignment workflow & evaluations
- 🚧 Gradebook & progress tracking
- 🚧 Communication tools (forums, messaging)

### Phase 2 (AI & Mobile) - Q1-Q2 2026
- 🔮 AI content generation (quizzes, summaries, objectives)
- 🔮 Personalized learning paths
- 🔮 Automated assessment & essay scoring
- 🔮 AI tutoring chatbot
- 🔮 PWA with offline support
- 🔮 Mobile optimization & touch gestures
- 🔮 Push notifications

### Phase 3 (Advanced Features) - Q3-Q4 2026
- 🔮 Plugin marketplace & ecosystem
- 🔮 Advanced learning analytics
- 🔮 Video conferencing integration (Zoom, Google Meet)
- 🔮 Gamification features (badges, leaderboards)
- 🔮 Real-time collaboration tools
- 🔮 Multi-language support (i18n)

### Phase 4 (Enterprise & Scale) - 2027
- 🔮 Advanced multi-tenancy features
- 🔮 SSO integrations (SAML, OAuth)
- 🔮 Full standards compliance (SCORM 2004, xAPI, LTI 1.3, QTI 2.1)
- 🔮 Advanced security features
- 🔮 Performance optimization for 10k+ users
- 🔮 Enterprise support & SLA options

## 💬 Support

- **Documentation**: [CLAUDE.md](CLAUDE.md)
- **Issues**: [GitHub Issues](https://github.com/your-org/edonis/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/edonis/discussions)

## 🙏 Acknowledgments

Built with amazing open-source projects:
- [AdonisJS](https://adonisjs.com) - The TypeScript framework
- [React](https://react.dev) - UI library
- [Inertia.js](https://inertiajs.com) - Modern monolith approach
- [shadcn/ui](https://ui.shadcn.com) - Beautiful UI components
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS

---

Made with ❤️ by [argile agency](https://argile.agency) | [Website](https://edonis.dev) | [Documentation](./CLAUDE.md)
