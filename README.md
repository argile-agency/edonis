# Edonis LMS

A modern Learning Management System built with AdonisJS, React, and PostgreSQL.

## Tech Stack

- **Backend**: AdonisJS 6 (MVC Framework)
- **Frontend**: React 19 + Inertia.js
- **Database**: PostgreSQL
- **Styling**: Tailwind CSS
- **Package Manager**: Bun

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

## License

MIT
