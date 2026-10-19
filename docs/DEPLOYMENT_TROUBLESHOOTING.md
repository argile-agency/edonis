# Deployment Troubleshooting (Infomaniak)

Developer reference for issues commonly encountered when deploying this app on **Infomaniak managed Node.js hosting** (Kubernetes-based, with managed MariaDB).

## Setup recap

- **Hosting**: Infomaniak Node.js (Manager → Paramètres avancés → onglet Node.js). Both *Commande d'exécution* and *Commande de construction* accept shell commands.
- **Database**: MariaDB → `DB_CONNECTION=mysql` (no `mariadb` value; the `mysql2` driver handles MariaDB).
- **Run command**: `cd build && node bin/server.js`
- **Build command**:
  ```
  npm i && npm run build && cp .env build/.env && cd build && npm i --omit=dev && node ace migration:run --force
  ```
- **`.env` location**: AdonisJS resolves its app root from `import.meta.url`, so the runtime reads `build/.env`. The build command copies the root `.env` into `build/` because `build/` is regenerated on every deploy.
- **Mandatory `.env` values**: `HOST=0.0.0.0` (k8s pod — loopback unreachable), `PORT=3333` (matches *Port d'écoute*), `DB_CONNECTION=mysql`, plus `APP_KEY`, `SESSION_DRIVER`, `DB_HOST/PORT/USER/PASSWORD/DATABASE`.
- **Course content files**: set `CONTENT_STORAGE_PATH` to an absolute path on persistent storage. The default (`<project>/storage/content_files`, resolved outside `build/` even when running from it) survives `npm run build`, but not a redeploy that replaces the checkout or the pod filesystem.

## Issues encountered

### 1. `Cannot find module 'bin/server.js'` at startup

| | |
|---|---|
| **Symptom** | `npm start` fails with `MODULE_NOT_FOUND` for `bin/server.js` |
| **Cause** | Source not compiled. The source `bin/` only contains TypeScript; `bin/server.js` only exists inside `build/`. |
| **Fix** | Run from the compiled output: set *Commande d'exécution* to `cd build && node bin/server.js`. |

### 2. TypeScript build error on `@axe-core/playwright`

| | |
|---|---|
| **Symptom** | `TS2351: This expression is not constructable` + cascading `TS7006: 'v' implicitly has any` in `tests/browser/accessibility.spec.ts` |
| **Cause** | `@axe-core/playwright` is CJS; the default import resolves to the namespace object (not constructible). |
| **Fix** | Use the named import: `import { AxeBuilder } from '@axe-core/playwright'`. |
| **Quick bypass** | `npm run build -- --ignore-ts-errors` (note the `--` separator — without it npm swallows the flag). |

### 3. `EnvValidationException: Missing environment variable …`

| | |
|---|---|
| **Symptom** | App crashes at startup listing missing env vars (`NODE_ENV`, `APP_KEY`, `HOST`, `DB_HOST`, …) |
| **Cause** | `.env` absent from `build/`. AdonisJS reads it from the app root, which is `build/` for the compiled entry — not the project root. |
| **Fix** | Keep a `.env` at the project root and have the build command copy it: `cp .env build/.env`. |
| **Note** | Vars *not* listed in the missing-vars output are already in `process.env`. Infomaniak typically injects `PORT` from the *Port d'écoute* panel field. |

### 4. App running but site shows maintenance screen

| | |
|---|---|
| **Symptom** | Log says `started HTTP server on 127.0.0.1:3333`, but Infomaniak shows the maintenance page |
| **Cause** | The app runs inside a Kubernetes pod (hostname pattern: `ik-...-xxxxx`). Binding to `127.0.0.1` (loopback) makes it unreachable to the proxy/probe, which connects via the pod IP. |
| **Fix** | `HOST=0.0.0.0` in `.env`. Log should then read `started HTTP server on 0.0.0.0:3333`. |

### 5. `pg-protocol: received invalid response: 60`

| | |
|---|---|
| **Symptom** | Migration crashes with `Parser.handlePacket: received invalid response: 60` |
| **Cause** | `DB_CONNECTION=postgres` (or default), so Lucid uses the `pg` driver — which sends PostgreSQL wire-protocol to a MariaDB server. Byte `60` is `<`, the first byte of MariaDB's handshake. |
| **Fix** | `DB_CONNECTION=mysql` in `.env`. There is no `mariadb` value (schema enum is `postgres / mysql / sqlite`); `mysql2` handles MariaDB. |

### 6. `pg/lib/client.js` errors even with `DB_CONNECTION=mysql`

| | |
|---|---|
| **Symptom** | `Connection terminated unexpectedly` / `ECONNRESET` with stack trace going through `node_modules/pg/lib/client.js` |
| **Cause** | The `build/` on the server is stale (predates the multi-DB code in source). The compiled `build/config/database.js` doesn't have the `mysql` block, so Lucid falls back to `pg`. |
| **Fix** | Full rebuild (re-trigger the Infomaniak build command). Verify with: `grep -c "client: 'mysql2'" build/config/database.js` → should return ≥ 1. |

### 7. `Cannot find module 'mysql2'`

| | |
|---|---|
| **Symptom** | Knex error: `Cannot find module 'mysql2'`, stack pointing to `node_modules/knex/lib/dialects/mysql2/index.js` |
| **Cause** | `node_modules/` is stale (from before `mysql2` was added to `package.json`). The build regenerated the compiled code but `npm i` wasn't actually re-run since the dependency was added. |
| **Fix** | At project root: `npm install`. If running commands from `build/`: also `cd build && npm install --omit=dev`. Cleanest: re-trigger the full Infomaniak build command (it does both layers). |

### 8. MariaDB: `Host 'x.x.x.x' is blocked because of many connection errors`

| | |
|---|---|
| **Symptom** | `mysql2` error: `Host '<your-pod-ip>' is blocked … unblock with 'mariadb-admin flush-hosts'` |
| **Cause** | MariaDB has tripped `max_connect_errors` after accumulated failed handshakes (typically from the previous wrong-driver attempts). |
| **Fix (free, often works)** | **Restart the Node.js app from the Infomaniak panel** — the pod is replanified in k8s, the egress IP usually changes, the new IP is not blocked. |
| **Fix (fallback)** | Open a support ticket asking Infomaniak to run `FLUSH HOSTS;` (the `RELOAD` privilege is not granted on managed accounts). Template below. |
| **Prevention** | Always re-verify DB credentials before retrying after a flush — a few wrong attempts re-trip the block immediately. Wrap passwords with special chars in single quotes in `.env`: `DB_PASSWORD='m0n$Pa#sword'`. |

## Pre-deployment checklist

Before triggering a build/restart on prod, validate:

```bash
# .env files in sync (root → build copied during build)
diff <(grep '^DB_' .env) <(grep '^DB_' build/.env)

# Correct driver pulled in the compiled config
grep -c "client: 'mysql2'" build/config/database.js   # → ≥ 1

# Correct dependencies installed
ls node_modules/mysql2 build/node_modules/mysql2

# Required env vars present in build/.env
grep -E '^(NODE_ENV|APP_KEY|HOST|PORT|DB_CONNECTION|DB_HOST|DB_USER|DB_DATABASE)=' build/.env
```

## Support ticket template (MariaDB host blocked)

> Bonjour,
>
> L'IP de mon hébergement Node.js est bloquée par le serveur MariaDB de ma base à cause d'erreurs de handshake accumulées (résolu côté code). Pouvez-vous exécuter `FLUSH HOSTS;` sur l'instance s'il vous plaît ?
>
> Site : `<votre-domaine>` — base : `<nom-de-la-base>`
>
> Merci !

## Useful one-liners

```bash
# Check what DB_CONNECTION the running build actually uses
grep '^DB_CONNECTION' build/.env

# OS-level env override check (only PORT is injected by Infomaniak in this setup)
env | grep -i DB_

# Verify migrations are reachable from build/
cd build && node ace migration:status

# Apply pending migrations only (non-destructive)
cd build && node ace migration:run --force

# Drop everything and re-seed (⚠️ DESTRUCTIVE — non-prod environments only)
cd build && node ace migration:fresh --seed
```
