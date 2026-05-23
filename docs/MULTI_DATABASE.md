# Multi-Database Support

Edonis LMS supports **PostgreSQL**, **MySQL**, **MariaDB**, and **SQLite** as database engines. A single environment variable (`DB_CONNECTION`) selects the active engine.

## Quick Start

### PostgreSQL (recommended for production)

```bash
docker compose up postgres -d
```

```env
DB_CONNECTION=postgres
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=edonis
DB_PASSWORD=edonis_dev_password
DB_DATABASE=edonis_lms
```

### MySQL

```bash
docker compose up mysql -d
```

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=edonis
DB_PASSWORD=edonis_dev_password
DB_DATABASE=edonis_lms
```

### MariaDB

MariaDB uses the `mysql` driver (wire-compatible).

```bash
docker compose up mariadb -d
```

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=edonis
DB_PASSWORD=edonis_dev_password
DB_DATABASE=edonis_lms
```

### SQLite (no server needed)

```env
DB_CONNECTION=sqlite
DB_FILENAME=./tmp/db.sqlite3
```

No Docker service required. The database file is created automatically on first migration.

## Which Engine to Choose?

| Engine | Best For | Pros | Cons |
|--------|----------|------|------|
| **PostgreSQL** | Production, large deployments | JSONB indexing, GIN full-text search, advanced features | Requires server setup |
| **MySQL** | Production, widely hosted | Native FULLTEXT search, broad hosting support | No JSONB (uses JSON) |
| **MariaDB** | Production, MySQL-compatible | Drop-in MySQL replacement, active community | Same as MySQL |
| **SQLite** | Development, small deployments | Zero setup, file-based, fast for dev | No concurrent writes, limited full-text search |

## Engine-Specific Behavior

### JSON/JSONB Columns

- **PostgreSQL**: Uses `jsonb` (binary, indexed, queryable with operators like `->`, `->>`, `@>`)
- **MySQL/MariaDB**: Uses `json` (native JSON type since MySQL 5.7 / MariaDB 10.2)
- **SQLite**: Uses `text` (stored as JSON strings, parsed at the application level)

All JSON columns are automatically handled by the ORM — no application code changes needed.

### Full-Text Search

- **PostgreSQL**: GIN index with `to_tsvector('french', ...)` for French-aware tokenization
- **MySQL/MariaDB**: FULLTEXT index on `title` and `description` columns
- **SQLite**: No index — uses `LIKE`-based search (sufficient for small datasets)

The search index is created conditionally during migration based on the active engine.

### ENUM Columns

- **PostgreSQL**: CHECK constraint
- **MySQL/MariaDB**: Native ENUM type
- **SQLite**: Stored as TEXT (no constraint enforcement)

Handled transparently by Knex — no changes needed.

## Known Limitations

### SQLite

- **No concurrent writes**: SQLite uses file-level locking. WAL mode is enabled for improved read concurrency, but only one writer at a time.
- **No full-text search index**: Course search uses `LIKE` instead of indexed full-text search.
- **Limited ALTER TABLE**: Some complex migration operations may behave differently.
- **No network access**: Database must be on the same filesystem as the application.

**Recommendation**: Use SQLite for development, single-user deployments, or testing only. For production with multiple users, use PostgreSQL or MySQL.

### MySQL / MariaDB

- **No JSONB**: JSON columns use MySQL's native JSON type, which is less performant than PostgreSQL's JSONB for complex queries.
- **ENUM rigidity**: Adding new values to an ENUM column requires an ALTER TABLE statement.

## Running Migrations

After setting your `DB_CONNECTION`, run:

```bash
node ace migration:run
node ace db:seed
```

Migrations automatically detect the database engine and apply engine-specific optimizations (JSONB on PostgreSQL, FULLTEXT on MySQL, etc.).

## CI/CD

The CI pipeline runs unit tests against all three engines (PostgreSQL, MySQL, SQLite) via a GitHub Actions matrix strategy. E2E browser tests run against PostgreSQL by default, with multi-engine support available for nightly/manual runs.

## Switching Engines

To switch from one engine to another:

1. Export your data (if needed)
2. Update `DB_CONNECTION` and related env vars in `.env`
3. Start the new database service (if needed)
4. Run `node ace migration:run`
5. Re-seed or import your data
