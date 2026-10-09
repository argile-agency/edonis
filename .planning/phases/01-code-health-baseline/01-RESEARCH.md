# Phase 1: Code Health Baseline - Research

**Researched:** 2026-10-09
**Domain:** TypeScript type-narrowing in AdonisJS 6 / Lucid v21, ESLint flat config enforcement, Japa functional test infrastructure, GitHub Actions CI gating
**Confidence:** HIGH (nearly every claim below was verified by executing it against this working tree, not inferred)

---

## Summary

This phase is **not** three cleanup chores. It is one finished chore, one solved-and-verified refactor, one genuine runtime bug, and one piece of test infrastructure that does not exist yet.

**DEBT-01 is already satisfied** — `bun run lint` and `bun run typecheck` both exit 0 at `681b697`. But CI does **not** enforce lint: `.github/workflows/ci.yml` sets `continue-on-error: true` on the ESLint step. "Green CI" is currently a claim CI cannot falsify.

**DEBT-02 is fully solved and verified end-to-end.** I removed all 16 `as any` from `app/`, and `tsc --noEmit` + `eslint .` both exit 0. The 16 split into 4 root causes, and the fix for each is known and tested (reference patch saved — see *Code Examples*). One of the four, **Cluster D, is a live runtime bug**: `Course.canEnroll()` passes a Luxon `DateTime` to `DateTime.fromJSDate()`, which returns an *invalid* DateTime whose `valueOf()` is `NaN`, so both date-window guards always evaluate `false`. Enrollment date windows are silently not enforced today, and `canEnroll` is serialized straight to the UI. Fixing the type **changes runtime behaviour** — correctly, but visibly.

**DEBT-03 is substantially larger than the roadmap implies.** `tests/functional/grades.spec.ts.skip` is not a working test that was switched off; it is a **non-compiling draft**. Renaming it to `.ts` produces **15 TypeScript errors**. It calls `client` and `route` fixtures that do not exist because **`@japa/api-client` is not installed**, mixes browser-only (`visit`, `loginAs` option) with API-client APIs, calls a getter as a method, and targets a URL that does not match the route table. On top of that there is no `.env.test`, so running it would point at the **development database**, and its teardown does `await User.query().delete()`. And CI's functional step is `node ace test functional || echo "..."` — I verified the suite exits **0** with `NO TESTS EXECUTED`, so that step can never fail.

**Primary recommendation:** Re-scope the three plan slots to: **01-01** = enforce the baseline in CI (remove `continue-on-error`, add a precise `as any` guard rule) + the *safe subset* of the `jsonColumnConfig` dedup; **01-02** = the verified 4-cluster `as any` removal, with Cluster D isolated into its own commit and surfaced as a behaviour change; **01-03** = build functional-test infrastructure (install `@japa/api-client`, register four Japa plugins, create `.env.test`, rewrite the spec, fix the CI no-op gate).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lint/format enforcement | Build/CI | Developer workstation | A rule that only runs locally is not a gate; `continue-on-error: true` makes it advisory |
| Type narrowing of ORM relations | Data layer (Lucid models) | — | `ExtractModelRelations<this>` is a model-layer typing concern; must not leak into controllers |
| Error metadata narrowing | HTTP tier (`app/exceptions/handler.ts`) | — | `HttpError`/`Exception` shapes are an HTTP-server concern, not a domain concern |
| Aggregate query result typing | Data layer (query builder) | Controller | `pojo<T>()` belongs on the Lucid builder, not as a cast at the call site |
| Enrollment date-window policy | Domain model (`Course`) | Inertia UI (consumes `canEnroll`) | `canEnroll()` is serialized to props — a model bug is directly user-visible |
| Functional test DB isolation | Test bootstrap + `.env.test` | CI service containers | Per-test cleanup is bootstrap's job; providing a *separate* DB is the environment's job |
| CI test gating | GitHub Actions | — | `|| echo` in a run step defeats `continue-on-error: false` |

---

## Project Constraints (from CLAUDE.md)

`./AGENTS.md` does not exist. `./CLAUDE.md` does, and is authoritative:

- **Package manager: `bun` first**, `pnpm` if bun fails, `npm` only as last resort. → Use `bun add -d @japa/api-client`.
  *(Note: `slopcheck` added it as a runtime `dependency` during verification; it belongs in `devDependencies`.)*
- Commands are `bun run lint` / `bun run typecheck` / `bun run format` / `node ace test`.
- **Always reuse existing seeders**; do not create new ones. Existing: `role_seeder`, `user_seeder`, `course_seeder`, etc.
- Test accounts after seeding: `admin@ / manager@ / teacher@ / student@edonis.test` — all with password `password`.
- CI workflows are documented as: `ci.yml` (lint+typecheck, build, audit, tests matrix), `e2e.yml`, `code-quality.yml`.

Project skills in `.claude/skills/` (`design-to-code-react`, `ecoscore-calculator-engine`, `rgesn-audit-automation`, `wcag-compliance-checker`, `skill-creator`) are **not relevant** to this phase.

`.planning/config.json`: `mode: yolo`, `parallelization: true`, `commit_docs: true`, `granularity: fine`, `workflow.{research,plan_check,verifier}: true`. `nyquist_validation` is **absent** → treat as **enabled** (Validation Architecture section included below). `security_enforcement` absent → treat as enabled (Security Domain included).

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEBT-01 | `bun run lint` exits 0 | **Already true** at `681b697` [VERIFIED: ran `bun run lint`, exit 0]. Residual work = make CI *enforce* it (`continue-on-error: true` removal) + add the `as any` guard rule. See *CI Reality*. |
| DEBT-02 | No `as any` in `app/`, typecheck still passes | **Fully solved and verified.** All 16 removed; `tsc --noEmit` exit 0, `eslint .` exit 0. See *Cluster A–D* + *Code Examples*. |
| DEBT-03 | Functional suite re-enabled and runs in CI | Requires: install `@japa/api-client`, register 4 Japa plugins, create `.env.test`, rewrite the 15-error spec, and fix the `|| echo` CI no-op. See *DEBT-03 Findings*. |

---

## Verified Baseline (run today against `681b697`)

| Check | Command | Result |
|---|---|---|
| Lint | `bun run lint` | **exit 0** [VERIFIED] |
| Typecheck | `bun run typecheck` | **exit 0** [VERIFIED] |
| `as any` in `app/` | `grep -rn "as any" app/ --include="*.ts" \| wc -l` | **16** across 7 files [VERIFIED] |
| `as any` outside `app/` | grep | `inertia/pages/courses/enrollment/methods.tsx`, `database/helpers/schema_helpers.ts` — **out of DEBT-02 scope** |
| Functional tests | `node ace test functional` | `NO TESTS EXECUTED`, **exit 0** [VERIFIED] |
| Working tree | `git status --short` | clean except pre-existing `.planning/config.json` |

**Versions** [VERIFIED: `node_modules` + `npm view`]: `@adonisjs/core` 6.x, `@adonisjs/lucid` **21.8.0**, `@japa/runner` **4.4.0**, `@japa/assert` 4.0.1, `@adonisjs/eslint-config` **2.1.2**, `eslint` 9.38.0, `typescript` ~5.8.3, `luxon` **3.7.2**.

---

## DEBT-02: The Four Clusters

I removed all 16 casts and ran `tsc`. The resulting error set is the ground truth for *which casts were load-bearing*.

### Cluster A — `load('<relation>' as any)` — root cause identified

**The real cause is the polymorphic `this` type, not Lucid's relation typing.**

`LucidRow.load` is declared `load: LucidRowPreload<this>` [VERIFIED: `node_modules/@adonisjs/lucid/build/src/types/model.d.ts:487`], which resolves to:

```ts
// relations.d.ts:639
export interface Preload<Model extends LucidRow, Builder> {
  <Name extends ExtractModelRelations<Model>, ...>(relation: Name, callback?: ...): Builder;
}
// relations.d.ts:12
export type ExtractModelRelations<Model extends LucidRow> = {
  [Key in keyof Model]: ... NonNullable<Model[Key]> extends ModelRelations<...> ? Key : never
}[keyof Model];
```

Inside a model method, `this` is an unresolved type parameter, so TypeScript cannot evaluate the mapped type and the string literal widens to `string`:

```
error TS2769: Argument of type 'string' is not assignable to parameter of type 'ExtractModelRelations<this>'.
```

**Decisive evidence:** `app/controllers/dashboard_controller.ts:14` does `user.load('roles' as any)` on a *concrete* `User` variable. When I removed that cast, **it produced no error at all** [VERIFIED]. Same method, same relation — the only difference is `this` vs a concrete type. The relation declarations (`declare roles: ManyToMany<typeof Role>`) are correct and were never the problem.

| Location | Nature | Verified fix |
|---|---|---|
| `dashboard_controller.ts:14` | **cast is a no-op** | Delete it. Zero errors. |
| `user.ts:150, 157, 176` | polymorphic `this` | `const self: User = this; await self.load('roles')` — or `await (this as User).load('roles')`. Both compile. |
| `cohort.ts:44` | polymorphic `this` | `const self: Cohort = this; await self.load('members')` |
| `course_category.ts:77` + `:78` | polymorphic `this` **and** `this`-assignment | **One line fixes both:** change `let current = this` → `let current: CourseCategory = this`. Then `current.load('parent')` and `current = current.parent` both compile. |

**Rejected candidates (tested, do not work):**
- `this.loadOnce('roles')` → **FAILS**, `LucidRowPreloadOnce<this>` has the identical constraint [VERIFIED: `TS2345` at user.ts:177].
- `this.related('roles')` / `$getRelation` → same `ExtractModelRelations<this>` constraint [CITED: model.d.ts:542, 653].
- Switching to `Model.query().preload(...)` → compiles, but **changes runtime semantics** (new query + new instance instead of lazy-loading onto `this`). Do not use here.

**Runtime impact: none.** All Cluster A fixes are pure type annotations. `const self: User = this` and `(this as User)` both erase to nothing.

> ⚠️ Guard against a fake fix: swapping `as any` for `as never`, `@ts-expect-error`, or `as unknown as X` would satisfy a grep but not the intent. The annotated-local pattern above is a *real* narrowing — it is how the compiler is meant to resolve the constraint.

### Cluster B — `(error as any)` in `app/exceptions/handler.ts` (5)

`HttpError` **already declares `code?: string` and `status: number`** [VERIFIED: `node_modules/@adonisjs/http-server/build/src/types/server.d.ts:11-21`]. So the casts are doing less work than they appear to.

Removing them yields two distinct errors [VERIFIED]:
- **lines 28, 29** — `Property 'headers' does not exist on type 'HttpError'`. `headers` comes from `@adonisjs/limiter`'s `ThrottleException` [VERIFIED: `limiter/build/src/errors.d.ts`, `headers?: { [name: string]: any }`].
- **lines 75, 109, 211** — `Property 'code'/'status' does not exist on type '{}'`. Here `error: unknown`; optional chaining strips `null | undefined` leaving `{}`.

**Recommended fix: local structural type guards.** Do *not* `instanceof ThrottleException` — `@adonisjs/limiter` has **no `./errors` export subpath** (only `.`, `/types`, `/stores/*`, `/services/main`, `/limiter_provider`) [VERIFIED: package.json `exports`], so you would import the whole package into the error handler purely for a type check. Structural guards keep the handler decoupled. Verified working — see *Code Examples*.

> ⚠️ **Small runtime difference, call it out.** `(error as any)?.code ?? ''` yields whatever `.code` holds; a `typeof === 'string'` guard yields `''` for a non-string `code`. The old code would then call `.toLowerCase()` on a non-string and **throw**; the guarded version cannot. Same for `status`. The change is strictly safer, but it is a change — mention it in the commit message rather than letting it pass as "just types".

### Cluster C — aggregate result typing (2)

`course_contents_controller.ts:219, 340` — `.max('order as maxOrder')` returns `CourseModule[]` / `CourseContent[]`, and `maxOrder` is not a declared column:
```
TS2339: Property 'maxOrder' does not exist on type 'CourseModule'.
```

**Lucid provides the idiomatic escape: `pojo<T>()`** — `pojo<T>(): ModelQueryBuilderContract<Model, T>` [VERIFIED: `lucid/build/src/types/model.d.ts:368`]. It re-types the result rows without a cast:

```ts
const maxOrderResult = await query.pojo<{ maxOrder: number | null }>().max('order as maxOrder')
const maxOrder = maxOrderResult[0]?.maxOrder ?? null
```
[VERIFIED: compiles, lint clean]

> ⚠️ `pojo<T>()` is an **assertion about driver behaviour**, not a proof. For an `integer` column, `pg`, `mysql2` and `better-sqlite3` all return a JS `number`, so `number | null` holds across the project's engines. If you want belt-and-braces, declare `number | string | null` and coerce: `const maxOrder = Number(maxOrderResult[0]?.maxOrder ?? 0)`. Existing behaviour `(maxOrder || 0) + 1` is preserved either way.

### Cluster D — `DateTime.fromJSDate(this.startDate as any)` — **THIS IS A LIVE BUG**

`course.ts:51-55` declares:
```ts
@column.date()
declare startDate: DateTime | null
@column.date()
declare endDate: DateTime | null
```

So `course.ts:272,276` pass a **Luxon `DateTime`** to `DateTime.fromJSDate()`, which expects a JS `Date`. The `as any` is not papering over a typing quirk — it is suppressing a correct error about genuinely wrong code.

**Runtime proof** [VERIFIED: executed against the project's own `luxon@3.7.2`]:

```
DateTime.fromJSDate(aDateTime):
  isValid        = false
  invalidReason  = invalid input
  valueOf()      = NaN
  CURRENT  (fromJSDate(start) > now) = false   <-- guard intended TRUE (course not started)
  CORRECT  (start > now)             = true
  CURRENT  (fromJSDate(end)   < now) = false   <-- guard intended TRUE (course ended)
  CORRECT  (end   < now)             = true
```

Mechanism [VERIFIED: `node_modules/luxon/src/datetime.js:687`]:
```js
static fromJSDate(date, options = {}) {
  const ts = isDate(date) ? date.valueOf() : NaN;
  if (Number.isNaN(ts)) { return DateTime.invalid("invalid input"); }
```
`isDate()` is a `[object Date]` brand check; a Luxon `DateTime` fails it → `NaN` → invalid DateTime → `valueOf()` is `NaN` → **every comparison is `false`**.

**Consequence:** `Course.canEnroll()` has **never** enforced its start/end date window. And `Course.serialize()` returns `canEnroll: this.canEnroll()` (`course.ts:318`), consumed by `inertia/pages/courses/index.tsx` and `show.tsx`. Users see an enrol affordance for not-yet-started and already-ended courses.

**Fix:** `if (this.startDate && this.startDate > now)` / `if (this.endDate && this.endDate < now)`. Luxon `DateTime` comparison works via `valueOf()` → epoch millis. [VERIFIED: compiles; behaviour proven correct above.]

> 🔴 **RUNTIME BEHAVIOUR CHANGE — the only one in DEBT-02.** After this fix, courses with a future `startDate` or past `endDate` **stop accepting enrolment**. That is the intended behaviour, but it is a live functional change shipped under a "typing cleanup" banner. Recommendations:
> 1. Commit Cluster D **separately** from Clusters A–C, with a message that says "fix" not "chore".
> 2. Check seeded/production course data for rows that would flip. `@column.date()` means midnight-local, so a course starting *today* still allows enrolment (`startDate > now` is false) — only genuinely future/past windows flip.
> 3. This is the one item in Phase 1 that plausibly warrants a `checkpoint:human-verify`.

---

## The `as any` Guard — measured, not speculated

| Candidate rule | Errors introduced | Verdict |
|---|---|---|
| `@typescript-eslint/no-explicit-any: 'error'` project-wide | **98** (`inertia/pages` 43, `app/models` 36, `app/controllers` 5, `app/exceptions` 5, `app/services` 3, `app/helpers` 2, `database/helpers` 2, `config/database.ts` 1, `inertia/app` 1) | ❌ Far beyond DEBT-02's scope |
| `@typescript-eslint/no-explicit-any` scoped to `app/**` | **51** (only 16 are `as any`; 35 are `: any` annotations) | ❌ Still scope creep |
| `@typescript-eslint/no-unnecessary-type-assertion` | **Hard crash** | ❌ Requires type-aware linting; `@adonisjs/eslint-config@2.1.2` uses only `tseslint.configs.base`, which sets no `projectService`/`project` |
| **`no-restricted-syntax` / `TSAsExpression > TSAnyKeyword`, scoped to `app/**/*.ts`** | **exactly 16 — zero false positives** | ✅ **RECOMMENDED** |

[All four VERIFIED by temporarily editing `eslint.config.js` and running `eslint`; config restored byte-identical afterwards.]

The `no-restricted-syntax` selector is a precise match for DEBT-02's wording ("no `as any` assertions remain in `app/`"), costs nothing elsewhere, needs no new dependency, and needs no type-aware linting. After the Cluster A–D fixes it reports **0**, so it can be merged in the same PR as a permanent regression gate.

The exact error count it reports today (16) equals the exact number of casts — confirming no collateral and no gaps.

---

## CI Reality — what actually gates today

[All VERIFIED by reading `.github/workflows/*.yml` and executing the test command.]

| Finding | File | Impact |
|---|---|---|
| 🔴 **ESLint step has `continue-on-error: true`** | `ci.yml` "Lint & Type Check" | Lint failures **do not fail CI**. DEBT-01's success criterion is unenforceable until this is removed. |
| 🔴 **`node ace test functional \|\| echo "No functional tests found yet"`** | `ci.yml` "Run unit tests" | The `\|\| echo` swallows every failure. `continue-on-error: false` on the step is irrelevant — the *shell* already exited 0. **DEBT-03's "passing in CI" cannot be satisfied without removing this.** |
| Empty-suite exits 0 | verified locally | `node ace test functional` → `NO TESTS EXECUTED`, **exit code 0**. So even without the `\|\| echo`, an empty suite is green. The gate needs real tests, not just a flag flip. |
| Job misnamed | `ci.yml` | Job is `unit-tests` / "Unit Tests (…)" but runs `node ace test functional`. `tests/unit/` does not exist. |
| DB services **do** exist | `ci.yml` | `postgres:16`, `mysql:8.0`, plus sqlite; migrations + `db:seed` run before tests. **Good news — no new infrastructure needed for DEBT-03.** |
| MariaDB absent from matrix | `ci.yml` | Stack claims MariaDB support; matrix is `[postgres, mysql, sqlite]`. Out of Phase 1 scope but worth logging. |
| ⚠️ Empty service image expression | `ci.yml`, `e2e.yml` | `image: ${{ matrix.db == 'postgres' && 'postgres:16' \|\| '' }}` — an empty `image` is a known GitHub Actions anti-pattern. Verify behaviour on the sqlite leg before trusting the matrix. |
| ⚠️ Seeder/browser-test email collision | `ci.yml` + `tests/browser/grades.spec.ts` | CI runs `db:seed` (creates `student@edonis.test`), then `tests/browser/grades.spec.ts:19` does `User.create({ email: 'student@edonis.test' })`. `users.email` is `.unique()` (`1761293656873_create_users_table.ts:10`). The browser suite is likely already failing in CI. |
| ⚠️ Vite boots during tests | `adonisrc.ts:49` | `@adonisjs/vite/vite_provider` is unscoped, so it loads in `test`. Observed locally: `WebSocket server error: Port 24678 is already in use` + a Vite re-optimize pass. A source of CI slowness/flake. |
| Prettier gate lives elsewhere | `code-quality.yml:72` | Separate `prettier-check` job. Note `bun run lint` *also* enforces prettier via `eslint-plugin-prettier`, so the two overlap. |

---

## DEBT-03 Findings — the functional suite does not exist

### The skipped file does not compile

Copying `tests/functional/grades.spec.ts.skip` → `.ts` and running `tsc --noEmit` produces **15 errors** [VERIFIED]:

| Lines | Error | Cause |
|---|---|---|
| 65, 70 | `'loginAs' does not exist in type { referer?… }` | `visit()` is a **browser-client** fixture; `{ loginAs }` is a browser-client option. `browserClient` is configured `runInSuites: ['browser']` — `visit` is unavailable in `functional`. |
| 109, 109 | `Cannot find name 'client'` / `'route'` | Test destructures `({ visit, assert })` then uses `client.get(route(...))`. |
| 141 | `Cannot find name 'assert'` | Test destructures `({ client, route })` then uses `assert`. |
| 121, 144, 151, 237, 255, 321, 424, 498 | `Property 'client' does not exist on type 'TestContext'` | **`@japa/api-client` is not installed.** `node_modules/@japa/` contains only `assert`, `browser-client`, `core`, `errors-printer`, `plugin-adonisjs`, `runner`. |
| 77, 94 | unused `visit`, unused `submission` | noUnusedLocals |

This file was **never executed**. Treat it as a specification of intent, not as code to re-enable.

### Three further defects a typecheck cannot catch

1. **`inertiaProps` is a getter, not a method.** The spec calls `response.inertiaProps()`. The plugin declares `inertiaProps: Record<string, any>` as an `ApiResponse.getter` [VERIFIED: `@adonisjs/inertia/build/src/plugins/japa/api_client.{d.ts,js}`]. Worse, its implementation calls `ensureIsInertiaResponse()`, which **throws unless `.withInertia()` was called on the request**. Every props assertion in the spec would fail at runtime even after installing `@japa/api-client`.
2. **Wrong URL.** Spec visits `/grades/${course.id}`; the route is `router.get('/grades/courses/:id', …).as('grades.course')` (`start/routes.ts:234`). The `route('grades.course', …)` calls are correct; the raw-string `visit()` calls are not.
3. **No DB lifecycle; destructive teardown.** Each group does `await User.query().delete()` (and 5 more models). With no `.env.test`, `.env` points at `DB_HOST=localhost DB_PORT=54322 DB_DATABASE=postgres` — the **Supabase local dev database**. Running this locally as-is would wipe development data.

### What the official pattern is

[CITED: https://docs.adonisjs.com/guides/testing/resetting-state-between-tests]

- `.env.test` is **auto-loaded** when running tests. The docs explicitly warn: *"Make sure your test environment is configured to use separate databases… Running tests against production data can result in data loss."* → **Create `.env.test` before anything else in this plan.**
- Migrate once globally: `runnerHooks.setup: [() => testUtils.db().migrate()]`.
- Reset per test: global transaction (faster) or `testUtils.db().truncate()`.

> 🔴 **Documentation/version drift — do not copy the docs verbatim.** docs.adonisjs.com now documents **v7** and names the method `wrapInGlobalTransaction()`. The **installed** Lucid 21.8.0 exposes **`withGlobalTransaction()`** [VERIFIED: `lucid/build/src/test_utils/database.js:66` and `database.d.ts`]. Installed surface is exactly: `truncate()`, `seed()`, `migrate()`, `withGlobalTransaction()`.

**Recommended strategy: `testUtils.db().migrate()` globally + `withGlobalTransaction()` per test.** Rationale: it is DB-agnostic (works across pg/mysql/sqlite), it needs no FK-safe delete ordering, and it is non-destructive by construction — which directly neutralises the destructive-teardown risk above. It also removes the dependency on CI's `db:seed` ordering.

### Plugins that must be registered in `tests/bootstrap.ts`

All four exist in `node_modules` today except `@japa/api-client` itself [VERIFIED by inspecting each package's `exports`]:

| Plugin | Package | Export | Provides |
|---|---|---|---|
| `apiClient()` | `@japa/api-client` | root | `client` fixture — **NOT INSTALLED** |
| `authApiClient(app)` | `@adonisjs/auth` | `./plugins/api_client` | `.loginAs()` on `ApiRequest` ✅ present |
| `sessionApiClient(app)` | `@adonisjs/session` | `./plugins/api_client` | session-driver auth in API tests ✅ present |
| `inertiaApiClient(app)` | `@adonisjs/inertia` | `./plugins/api_client` | `.withInertia()`, `inertiaProps`, `assertInertiaComponent/Props` ✅ present |

`route` is supplied by `pluginAdonisJS(app)`, already registered.

`adonisrc.ts` already declares the `functional` suite (`tests/functional/**/*.spec(.ts|.js)`, timeout 30000) and `tests/bootstrap.ts` already starts the HTTP server for it via `configureSuite`. **That wiring is correct and needs no change.**

---

## Standard Stack

### Core (already installed — no action)

| Library | Version | Purpose | Why standard |
|---|---|---|---|
| `@adonisjs/lucid` | 21.8.0 | ORM; supplies `pojo<T>()`, `testUtils.db()` | Official AdonisJS ORM |
| `@japa/runner` | 4.4.0 | Test runner | Official AdonisJS test runner |
| `@adonisjs/eslint-config` | 2.1.2 | Flat config preset (`tseslint.configs.base` + prettier) | Official preset |
| `luxon` | 3.7.2 | Date/time; `DateTime` is the `@column.date()` runtime type | AdonisJS default |

### Supporting (to add)

| Library | Version | Purpose | When |
|---|---|---|---|
| `@japa/api-client` | **3.2.1** | `client` fixture for HTTP/functional tests | DEBT-03 — the only new dependency |

**Installation** (per CLAUDE.md, bun first, and as a **dev** dependency):
```bash
bun add -d @japa/api-client
```

### Alternatives considered

| Instead of | Could use | Tradeoff |
|---|---|---|
| `const self: User = this` | `(this as User)` | Both verified working. The annotated local is slightly more legible and reads as an assertion-free narrowing; the inline cast is terser. Either satisfies DEBT-02. |
| Structural type guards in `handler.ts` | `instanceof ThrottleException` | Requires importing `@adonisjs/limiter` into the error handler; package exposes no `./errors` subpath. Guards keep the HTTP tier decoupled. |
| `withGlobalTransaction()` | `truncate()` | Truncate is slower and actually deletes rows; transactions roll back and are non-destructive. Use truncate only if a test needs committed data visible to a separate connection. |
| `pojo<T>()` | `db.from('course_modules').max(...)` | Dropping to the raw query builder loses model-scope reuse (`query` is already built with `where`/`whereNull` clauses). |

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---|---|---|---|---|---|---|
| `@japa/api-client` | npm | 4 yrs (created 2022-03-21; last publish 2026-01-09) | **186,519/wk** | `github.com/japa/api-client` | **[OK]** — `slopcheck install` completed (slop is always blocked, so completion ⇒ not slop) | **Approved** |

Additional manual verification [VERIFIED: `npm view`]:
- Version **3.2.1**.
- **No `postinstall` script** (`npm view … scripts.postinstall` → empty).
- Maintainers: `virk` (AdonisJS creator), `romainlanz`, `julien-r44` — all AdonisJS core team.
- `peerDependencies`: `@japa/runner: ^3.1.2 || ^4.0.0 || ^5.0.0` ✅ (installed 4.4.0); `@japa/assert: ^2 || ^3 || ^4` ✅ (installed 4.0.1). Both `@japa/assert` and `@japa/openapi-assertions` are `optional: true` in `peerDependenciesMeta`, so **no extra transitive install is forced**.
- Correct ecosystem (npm), matching the project's Node/TypeScript stack — no cross-ecosystem confusion.

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged [SUS]:** none.

> Note for the executor: `slopcheck install` **mutates the project** — it added `@japa/api-client` to `dependencies` (not `devDependencies`) and installed it. I reverted both (`git checkout -- package.json`, removed `node_modules/@japa/api-client`). The real install must use `bun add -d`.

---

## Architecture Patterns

### How the fixes flow

```
                      ┌─────────────────────────────────────────────┐
  developer  ──────►  │  bun run lint  /  bun run typecheck         │
                      └──────────────────┬──────────────────────────┘
                                         │  (today: both exit 0)
                                         ▼
                      ┌─────────────────────────────────────────────┐
  git push   ──────►  │  ci.yml : Lint & Type Check                 │
                      │    ESLint  ──► continue-on-error: true ◄─🔴 │  not a gate
                      │    tsc     ──► enforced                     │
                      └──────────────────┬──────────────────────────┘
                                         ▼
                      ┌─────────────────────────────────────────────┐
                      │  ci.yml : unit-tests (pg | mysql | sqlite)  │
                      │    services: postgres:16 / mysql:8.0  ✅    │
                      │    migration:run --force              ✅    │
                      │    db:seed                            ✅    │
                      │    node ace test functional || echo   ◄─🔴 │  always exit 0
                      └──────────────────┬──────────────────────────┘
                                         ▼
                      ┌─────────────────────────────────────────────┐
                      │  tests/functional/  ──► 1 file, `.skip`,    │
                      │                        15 TS errors         │
                      └─────────────────────────────────────────────┘

  After Phase 1:
      ESLint enforced  +  no-restricted-syntax bans `as any` in app/
      functional suite has real specs, .env.test isolates the DB,
      `|| echo` removed so a red suite turns CI red.
```

### Component responsibilities

| File | Responsibility after Phase 1 |
|---|---|
| `eslint.config.js` | Keeps `eqeqeq {null:'ignore'}`; **adds** `no-restricted-syntax` block scoped to `app/**/*.ts` banning `TSAsExpression > TSAnyKeyword` |
| `.github/workflows/ci.yml` | Remove `continue-on-error: true` from ESLint; replace `… || echo "…"` with a bare `node ace test functional`; rename `unit-tests` → `functional-tests` |
| `.env.test` (**new**) | `DB_*` overrides so tests never touch the dev DB |
| `tests/bootstrap.ts` | Add `apiClient()`, `authApiClient(app)`, `sessionApiClient(app)`, `inertiaApiClient(app)`; add `runnerHooks.setup: [() => testUtils.db().migrate()]` |
| `tests/functional/grades.spec.ts` (**rewrite**) | API-client tests only (no `visit`); `withGlobalTransaction()` per test; `.withInertia()` before props assertions |
| `app/helpers/json_column.ts` | Single source for the **7 identical** JSON column configs |

### Anti-patterns to avoid

- **Grep-satisfying fake fixes.** `as never`, `@ts-expect-error`, `as unknown as X` all make `grep "as any"` return 0 while preserving the unsoundness. The verification step for DEBT-02 should be `grep -c "as any\|as never\|@ts-expect-error\|as unknown as" app/`, not just `as any`.
- **Blanket-deduping all 10 JSON column blocks.** Three of them are *not* equivalent (see below).
- **Disabling the rule instead of fixing the call site.** Adding `/* eslint-disable no-restricted-syntax */` defeats the guard.
- **Trusting docs.adonisjs.com for API names.** The site documents v7; this project is on v6 / Lucid 21.8.0 (`withGlobalTransaction`, not `wrapInGlobalTransaction`).

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Typing an aggregate query result | A cast + a hand-written row interface | `query.pojo<{ maxOrder: number \| null }>()` | Lucid's own result-type override; survives refactors |
| Narrowing `unknown` errors | Ad-hoc casts at each site | 3 small module-level type guards | 5 call sites, one definition, and the guards are reusable |
| Per-test DB cleanup | Hand-ordered `Model.query().delete()` chains | `testUtils.db().withGlobalTransaction()` | Manual chains must track FK order, are destructive, and break when a model is added |
| Test DB isolation | `if (NODE_ENV === 'test')` branches in `config/database.ts` | `.env.test` | Framework-native, auto-loaded, zero code |
| Banning a syntax form | A custom ESLint plugin, or a grep in CI | `no-restricted-syntax` with an AST selector | Built into core ESLint, no type info, zero deps — verified 16/16 precision |
| JSON column prepare/consume | 10 copies of the same closure | `jsonColumnConfig` (7 of the 10) | Already exists and is already proven in `audit_log.ts` |

**Key insight:** every one of this phase's "we need a cast" moments has a first-party API that removes the cast. None of the 16 required inventing anything.

---

## The `jsonColumnConfig` Dedup — safe, but **only for 7 of 10 sites**

### Is sharing one object across many `@column()` decorators safe? **Yes.** [VERIFIED]

`BaseModel.$addColumn(name, options)` **copies** every field into a brand-new object and derives `columnName` per property:

```js
// lucid/build/src/orm/base_model/index.js:210
static $addColumn(name, options) {
  const column = {
    isPrimary: options.isPrimary || false,
    columnName: options.columnName || this.namingStrategy.columnName(this, name),
    serializeAs: options.serializeAs !== undefined ? options.serializeAs : this.namingStrategy.serializedName(this, name),
    serialize: options.serialize, prepare: options.prepare, consume: options.consume, meta: options.meta,
  };
  this.$columnsDefinitions.set(name, column);
```

It never retains or mutates `options`. `prepare`/`consume` are pure stateless closures. And `app/models/audit_log.ts` **already uses `@column(jsonColumnConfig)` three times in production** — empirical confirmation.

*(Caveat for the future: if a shared config ever gains `serializeAs`, every column sharing it would inherit that one name. `jsonColumnConfig` has none, so each column derives its own.)*

### Are the typed `prepare` signatures load-bearing? **No.** [VERIFIED]

`bulk_enrollment_log.ts` writes `prepare: (value: ErrorDetail[] | null) => …`. Lucid declares `prepare?: (value: any, attribute: string, model: LucidRow) => any` [`model.d.ts:128`] — the annotation is local documentation that Lucid never enforces. The real type safety lives in `declare errorDetails: ErrorDetail[] | null`, which is untouched.

### Count correction: **7 identical**, not 8

[VERIFIED by exact-string replacement + `tsc` + `eslint`, both exit 0]

| File | Identical blocks |
|---|---|
| `app/models/assignment.ts` | 1 (`rubricData`) |
| `app/models/bulk_enrollment_log.ts` | 2 (`errorDetails`, `importOptions`) |
| `app/models/course_content.ts` | 1 (`metadata`) |
| `app/models/submission.ts` | 3 (`fileAttachments`, `feedbackAttachments`, `rubricScores`) |
| **Total** | **7** |

STATE.md says 8; the true figure is 7. Side benefit: the dedup drops `app/`'s `no-explicit-any` count from **51 → 39**.

### 🔴 Three more blocks exist — and they are **NOT** safe to dedup

A `grep "JSON.parse(value)" app/` surfaced three additional sites that the brief did not mention. Each diverges from `jsonColumnConfig` in a way that would **silently change runtime behaviour**:

| File | Divergence | What deduping would do |
|---|---|---|
| `app/models/role.ts:27` (`permissions`) | `prepare` returns the value unchanged when `typeof value === 'string'` | `jsonColumnConfig` would `JSON.stringify` an already-serialized string → **double-encoding** (`"x"` → `"\"x\""`) |
| `app/models/course.ts:80` (`tags`) | Uses falsy checks (`if (!value) return null`) rather than `!= null` | `jsonColumnConfig` would reach `JSON.parse('')` on an empty-string column value → **`SyntaxError` at read time** |
| `app/models/app_setting.ts:70` (`socialLinks`) | `prepare: (value) => JSON.stringify(value)` with **no null check** | Currently stores the literal string `'null'`; `jsonColumnConfig` stores SQL `NULL` → **stored-value change** (arguably a bug fix, but a data-visible one) |

**Recommendation:** dedup the **7 identical** blocks in Phase 1. Leave the 3 variants alone, or convert them deliberately in a separate commit with a migration/backfill assessment. This is precisely the "silent behaviour change smuggled in under a typing cleanup" failure mode to avoid.

---

## Common Pitfalls

### Pitfall 1: Treating DEBT-01 as unfinished work
**What goes wrong:** Plan 01-01 is written as "fix 17 lint errors" and the executor finds nothing to fix.
**Why:** ROADMAP.md and REQUIREMENTS.md still carry the pre-`af99ea1` numbers.
**Avoid:** Re-scope 01-01 to *CI enforcement + the `as any` guard rule + the 7-site dedup*.
**Warning sign:** `bun run lint` exits 0 before any work starts.

### Pitfall 2: A "fix" that only satisfies the grep
**What goes wrong:** `as any` → `as never` / `@ts-expect-error` / `as unknown as X`.
**Avoid:** Verify with `grep -rn "as any\|as never\|as unknown as\|@ts-expect-error" app/` **and** confirm the `no-restricted-syntax` rule is active.

### Pitfall 3: Shipping Cluster D as a chore
**What goes wrong:** The enrollment date-window fix lands inside a "chore(types)" commit and nobody notices enrolment behaviour changed.
**Avoid:** Separate commit, `fix(courses):` prefix, explicit note that `canEnroll()` now enforces dates.

### Pitfall 4: Running the functional suite against the dev database
**What goes wrong:** `.env` points at `localhost:54322/postgres`; the spec's teardown runs `User.query().delete()`. Local dev data is destroyed.
**Avoid:** Create `.env.test` **first**; prefer `withGlobalTransaction()` over manual deletes.
**Warning sign:** No `.env.test` in the repo (there is none today).

### Pitfall 5: Declaring DEBT-03 done because CI is green
**What goes wrong:** `node ace test functional || echo "…"` exits 0 unconditionally; an empty suite also exits 0.
**Avoid:** Remove the `|| echo`, **and** assert a non-zero test count. Verify by deliberately breaking an assertion and confirming CI goes red.

### Pitfall 6: Copying `wrapInGlobalTransaction()` from the docs
**What goes wrong:** `TypeError: testUtils.db(...).wrapInGlobalTransaction is not a function`.
**Why:** docs.adonisjs.com now documents v7; installed Lucid 21.8.0 exposes `withGlobalTransaction()`.
**Avoid:** Trust `node_modules/@adonisjs/lucid/build/src/test_utils/database.d.ts`.

### Pitfall 7: Calling `inertiaProps` as a method / forgetting `withInertia()`
**What goes wrong:** `response.inertiaProps()` → not a function; or `"Response is not an Inertia response"`.
**Avoid:** `await client.get(...).withInertia().loginAs(user)`, then read `response.inertiaProps` as a property.

### Pitfall 8: Seeder/test email collisions
**What goes wrong:** CI runs `db:seed` (creates `student@edonis.test`), then `tests/browser/grades.spec.ts:19` creates the same address against a `.unique()` column.
**Avoid:** Unique emails per test (the functional draft already does `student-${n}-${Date.now()}@test.com`), or skip seeding for the test DB. Worth checking whether the browser suite is already red in CI.

---

## Code Examples

> Every snippet below was applied to this working tree; `tsc --noEmit` and `eslint .` both exited 0 afterwards. The complete reference diff (203 lines, 7 files) is saved at
> `/private/var/folders/_c/1c8jqzvs45v057xk7phs9mv40000gn/T/verified-debt02.patch`.
> The tree was restored to `681b697` afterwards — `git status` is clean.

### Cluster A — polymorphic `this`

```ts
// app/models/user.ts — BEFORE
async hasRole(roleSlug: string, _courseId?: number): Promise<boolean> {
  if (!this.roles || this.roles.length === 0) {
    await this.load('roles' as any)
  }
  return this.roles.some((role) => role.slug === roleSlug)
}

// AFTER — annotate a concrete local so ExtractModelRelations<User> can resolve
async hasRole(roleSlug: string, _courseId?: number): Promise<boolean> {
  if (!this.roles || this.roles.length === 0) {
    const self: User = this
    await self.load('roles')
  }
  return this.roles.some((role) => role.slug === roleSlug)
}
```

```ts
// app/models/course_category.ts — ONE annotation fixes BOTH casts (lines 77 and 78)
public async getFullPath(): Promise<string> {
  if (this.path) return this.path
  const parts: string[] = [this.slug]
  let current: CourseCategory = this        // <-- was: let current = this
  while (current.parentId) {
    await current.load('parent')            // <-- was: load('parent' as any)
    current = current.parent                // <-- was: current.parent as any
    parts.unshift(current.slug)
  }
  return '/' + parts.join('/')
}
```

```ts
// app/controllers/dashboard_controller.ts:14 — the cast was a no-op; just delete it
await user.load('roles')
```

### Cluster B — structural error narrowing

```ts
// app/exceptions/handler.ts — module scope
type ErrorWithCode = { code: string }
type ErrorWithStatus = { status: number }
type ErrorWithHeaders = { headers: Record<string, string | undefined> }

function hasCode(error: unknown): error is ErrorWithCode {
  return (
    typeof error === 'object' && error !== null && typeof (error as ErrorWithCode).code === 'string'
  )
}
function hasStatus(error: unknown): error is ErrorWithStatus {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as ErrorWithStatus).status === 'number'
  )
}
function hasHeaders(error: unknown): error is ErrorWithHeaders {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as ErrorWithHeaders).headers === 'object' &&
    (error as ErrorWithHeaders).headers !== null
  )
}

// call sites
retryAfter: hasHeaders(error)
  ? Number.parseInt(error.headers['retry-after'] ?? '', 10) || undefined
  : undefined,
const code = hasCode(error) ? error.code : ''
const statusCode = hasStatus(error) ? error.status : 500
```

### Cluster C — `pojo<T>()`

```ts
// app/controllers/course_contents_controller.ts:219
const maxOrderResult = await query.pojo<{ maxOrder: number | null }>().max('order as maxOrder')
const maxOrder = maxOrderResult[0]?.maxOrder ?? null

// :340
const maxOrderResult = await CourseContent.query()
  .where('module_id', payload.moduleId)
  .pojo<{ maxOrder: number | null }>()
  .max('order as maxOrder')
const maxOrder = maxOrderResult[0]?.maxOrder ?? null
```

### Cluster D — the bug fix (⚠️ behaviour change)

```ts
// app/models/course.ts:272,276
const now = DateTime.now()
if (this.startDate && this.startDate > now) return false   // was: DateTime.fromJSDate(this.startDate as any) > now
if (this.endDate && this.endDate < now) return false       // was: DateTime.fromJSDate(this.endDate as any) < now
```

### ESLint guard — verified 16/16 precision, zero collateral

```js
// eslint.config.js — add as a new config block
{
  files: ['app/**/*.ts'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: 'TSAsExpression > TSAnyKeyword',
        message: '`as any` is banned in app/. Narrow the type properly (see .planning/phases/01-code-health-baseline).',
      },
    ],
  },
},
```

### `tests/bootstrap.ts` — target shape for DEBT-03

```ts
import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import type { Config } from '@japa/runner/types'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import { browserClient } from '@japa/browser-client'
import testUtils from '@adonisjs/core/services/test_utils'
import { authApiClient } from '@adonisjs/auth/plugins/api_client'
import { sessionApiClient } from '@adonisjs/session/plugins/api_client'
import { inertiaApiClient } from '@adonisjs/inertia/plugins/api_client'

export const plugins: Config['plugins'] = [
  assert(),
  apiClient(),
  pluginAdonisJS(app),
  authApiClient(app),
  sessionApiClient(app),
  inertiaApiClient(app),
  browserClient({ runInSuites: ['browser'], contextOptions: { baseURL: 'http://localhost:3333' } }),
]

export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [() => testUtils.db().migrate()],
  teardown: [],
}
```

### Functional test shape

```ts
test.group('Grades - Student View', (group) => {
  // NOTE: withGlobalTransaction() — NOT wrapInGlobalTransaction() (that is v7 docs)
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('student sees their own grades', async ({ client, route, assert }) => {
    const response = await client
      .get(route('grades.course', { id: course.id }))
      .withInertia()            // REQUIRED before reading inertiaProps
      .loginAs(student)

    response.assertStatus(200)
    const props = response.inertiaProps   // getter, NOT inertiaProps()
    assert.isArray(props.grades)
  })
})
```

### `.env.test` — create before running anything

```bash
NODE_ENV=test
DB_CONNECTION=sqlite
DB_FILENAME=./tmp/test.sqlite3
APP_KEY=test_app_key_for_local_test_runs_only
SESSION_DRIVER=cookie
```

---

## Runtime State Inventory

Phase 1 is a refactor, so the usual rename/migration categories apply:

| Category | Items found | Action required |
|---|---|---|
| **Stored data** | **`app_settings.social_links`** may contain the literal string `'null'` (from `app_setting.ts`'s null-free `prepare`). Only relevant if the 3 divergent JSON blocks are deduped. | None in Phase 1 — **do not dedup those 3**. If ever deduped: backfill `'null'` → SQL `NULL`. |
| **Live service config** | None — no n8n/Datadog/Cloudflare-style external config references these symbols. Verified: no such integrations in `config/`. | None |
| **OS-registered state** | None — no Task Scheduler / launchd / pm2 names involved. Verified: no `ecosystem.config.*`, no pm2 references. | None |
| **Secrets / env vars** | **`.env.test` does not exist** (only `.env`, `.env.example`). CI already injects `DB_*`, `APP_KEY`, `NODE_ENV` for the tests job. | **Create `.env.test`**; consider documenting it in `.env.example`. No secret *renames*. |
| **Build artifacts** | `build/` directory exists (stale compiled output from a prior `node ace build`). Not consumed by lint/typecheck/test. | None — `tsconfig.json` excludes `build/`. |
| **Behavioural state (phase-specific)** | 🔴 **Existing `courses` rows with a future `start_date` or past `end_date`** will change enrolment eligibility once Cluster D is fixed. | Inspect affected rows before merging; treat as a release note. |

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| `node` | ace, tsc, eslint | ✓ | v22.18.0 | — |
| `bun` | per CLAUDE.md | ✓ | (runs `bun run lint/typecheck` fine) | `pnpm`, then `npm` |
| `npx` / `npm` | registry verification | ✓ | — | — |
| PostgreSQL (dev) | local dev DB | ⚠️ configured at `localhost:54322` (Supabase local); **not probed** | — | Use `DB_CONNECTION=sqlite` for local functional tests |
| SQLite (`better-sqlite3`) | local test DB | ✓ | 12.8.0 | — |
| `@japa/api-client` | DEBT-03 `client` fixture | ✗ **not installed** | — | **None** — must `bun add -d` |
| `slopcheck` | package legitimacy gate | ✓ (installed during research at `~/Library/Python/3.9/bin/slopcheck`) | — | Manual npm metadata review |
| `ctx7` (Context7 CLI) | doc lookup | ✗ | — | Used WebFetch against docs.adonisjs.com + direct `node_modules` type inspection (more authoritative for *installed* versions) |
| GitHub Actions DB services | CI functional tests | ✓ already declared | `postgres:16`, `mysql:8.0` | — |

**Missing with no fallback:** `@japa/api-client` — blocks DEBT-03 entirely.
**Missing with fallback:** `ctx7` — compensated by reading `node_modules` type definitions directly, which is *more* accurate than published docs here (see the `withGlobalTransaction` drift).

---

## Validation Architecture

### Test framework

| Property | Value |
|---|---|
| Framework | Japa `@japa/runner` 4.4.0 |
| Config | `tests/bootstrap.ts` + `adonisrc.ts` `tests.suites` |
| Suites declared | `unit` (`tests/unit/**` — **directory does not exist**), `functional` (30s), `browser` (60s) |
| Quick run | `node ace test functional` |
| Full suite | `node ace test` |
| Lint/type gate | `bun run lint && bun run typecheck` (**no combined script exists** — consider adding `"check": "bun run lint && bun run typecheck"`) |

### Phase requirements → test map

| Req | Behaviour | Type | Automated command | Exists? |
|---|---|---|---|---|
| DEBT-01 | lint exits 0 | static | `bun run lint` | ✅ passing |
| DEBT-01 | CI *enforces* lint | CI config | inspect `ci.yml` for absence of `continue-on-error` | ❌ Wave 0 |
| DEBT-02 | no `as any` in `app/` | static | `bun run lint` (with the new `no-restricted-syntax` rule) | ❌ Wave 0 (rule not added) |
| DEBT-02 | typecheck still passes | static | `bun run typecheck` | ✅ passing |
| DEBT-02 | no grep-dodging variants | static | `grep -rn "as any\|as never\|as unknown as\|@ts-expect-error" app/` → 0 | ❌ Wave 0 |
| DEBT-02/D | `canEnroll()` enforces the date window | unit | `node ace test unit` (new `tests/unit/course.spec.ts`) | ❌ Wave 0 — **and `tests/unit/` does not exist** |
| DEBT-03 | functional suite runs ≥1 test | functional | `node ace test functional` | ❌ Wave 0 |
| DEBT-03 | a red suite turns CI red | CI config | break an assertion, confirm CI fails | ❌ Wave 0 |

### Sampling rate

- **Per task commit:** `bun run lint && bun run typecheck` (~seconds, no DB)
- **Per wave merge:** `node ace test functional` against `.env.test`
- **Phase gate:** `bun run lint && bun run typecheck && node ace test` all green, plus the grep assertion

### Wave 0 gaps

- [ ] `.env.test` — isolates the test DB (**do this first; it is a data-safety prerequisite**)
- [ ] `bun add -d @japa/api-client`
- [ ] `tests/bootstrap.ts` — register `apiClient` + 3 AdonisJS api_client plugins; add `testUtils.db().migrate()` setup hook
- [ ] `tests/functional/grades.spec.ts` — rewrite (the `.skip` draft has 15 TS errors; use it as a requirements sketch only)
- [ ] `tests/unit/` — directory does not exist; needed for a `canEnroll()` regression test guarding Cluster D
- [ ] `eslint.config.js` — add the `no-restricted-syntax` guard block
- [ ] `.github/workflows/ci.yml` — remove `continue-on-error: true`; remove `|| echo "No functional tests found yet"`

---

## Security Domain

### Applicable ASVS categories

| Category | Applies | Standard control |
|---|---|---|
| V2 Authentication | **yes** (indirectly) | `@adonisjs/auth` session guard; functional tests must use `authApiClient` + `sessionApiClient`, never a hand-rolled session forge |
| V3 Session Management | yes | `SESSION_DRIVER=cookie`; `.env.test` must carry its own `APP_KEY` and never reuse a production key |
| V4 Access Control | **yes** | `grades_controller.ts:95` returns `response.forbidden()` for non-enrolled users. The functional spec asserts 403 — **keep that test**, it is the only automated authz check in this phase. |
| V5 Input Validation | no | No new user input introduced |
| V6 Cryptography | no | `encryption_service.ts` issues are DEBT-08 (Phase 2) |
| V7 Error Handling & Logging | **yes** | Cluster B touches `app/exceptions/handler.ts`. The narrowing must not widen what is disclosed: `this.debug = !app.inProduction` already gates stack/frame exposure — do not alter that. |
| V14 Configuration | **yes** | `.env.test` must not be committed with real credentials; add to `.gitignore` if it is not already covered (`.env` is). |

### Known threat patterns for this stack

| Pattern | STRIDE | Mitigation |
|---|---|---|
| Test suite wipes the dev/prod DB (`User.query().delete()` with no env isolation) | Denial of Service / data loss | `.env.test` + `withGlobalTransaction()` — **the top safety item in this phase** |
| Error handler leaking stack traces in production | Information Disclosure | `this.debug = !app.inProduction` is already correct; Cluster B must not touch it |
| Enrolment date window not enforced (Cluster D) | Elevation of Privilege (weak) | Fix the `fromJSDate` misuse; `canEnroll` is a UI-facing authorization-ish signal |
| Supply-chain: new test dependency | Tampering | `@japa/api-client` verified: official japa org, AdonisJS core maintainers, 186k/wk, no postinstall, slopcheck clean |
| Committed test credentials | Information Disclosure | `.env.test` with a throwaway `APP_KEY`; confirm `.gitignore` coverage |

---

## State of the Art

| Old approach | Current approach | When changed | Impact here |
|---|---|---|---|
| `tests/functional` DB cleanup via manual deletes | `testUtils.db().withGlobalTransaction()` | Lucid v18+ | Replaces the draft spec's 6-model delete chain |
| Hard-coded test DB branches in `config/database.ts` | `.env.test` auto-loaded by `@adonisjs/env` | AdonisJS 6 | Zero-code test DB isolation |
| `wrapInGlobalTransaction()` (docs site, v7) | `withGlobalTransaction()` (installed v21.8.0) | v6→v7 rename | **Use the installed name** |
| Casting aggregate rows | `query.pojo<T>()` | Lucid v18+ | Removes Cluster C casts |
| `@typescript-eslint/no-explicit-any` as a blunt ban | AST-selector `no-restricted-syntax` for the exact construct | ESLint flat config era | 16 precise errors instead of 98 noisy ones |

**Deprecated / outdated in project docs:**
- `ROADMAP.md` success criterion 1 ("currently 17 errors across 4 files") — **stale**, fixed in `af99ea1`.
- `REQUIREMENTS.md` DEBT-01 wording — same staleness.
- `STATE.md` "8 inline JSON column configs" — the correct figure is **7** identical (plus 3 divergent variants that must not be deduped).
- `.planning/codebase/TESTING.md` "Skip tests: add `.skip` suffix" — describes the convention but not that this particular file never compiled.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | `pojo<{ maxOrder: number \| null }>()` matches runtime driver output across pg/mysql2/better-sqlite3 for an `integer` column | Cluster C | Low — `(maxOrder \|\| 0) + 1` coerces anyway. Mitigate with `Number(...)`. Not executed against all three engines. |
| A2 | The empty-string `image:` expression in the CI matrix skips the service cleanly on the sqlite leg | CI Reality | Medium — if it errors, the sqlite leg fails for an unrelated reason. **Not executed**; inferred from YAML. |
| A3 | `tests/browser/grades.spec.ts` currently fails in CI due to the `student@edonis.test` unique-email collision with `db:seed` | CI Reality | Medium — inferred from the unique constraint + seeder + spec, **not** from an observed CI run. Verify against Actions history. |
| A4 | `withGlobalTransaction()` is preferable to `truncate()` for this suite | DEBT-03 | Low — both are first-party. Transactions fail only if a test needs cross-connection visibility. |
| A5 | The Supabase local Postgres at `localhost:54322` is the active dev DB | Environment | Low — read from `.env`; **not probed** (no connection attempted, deliberately). |
| A6 | `slopcheck install` completing implies a non-slop verdict | Package Audit | Low — its own help text states "slop is always blocked"; `--force` is required only for *suspicious* packages. Corroborated by independent npm metadata review. |
| A7 | No production `courses` rows currently sit outside their date window | Runtime State | **Medium-high** — entirely unverified. If wrong, Cluster D visibly removes enrolment access. **Check before merging.** |

---

## Open Questions (RESOLVED)

> All five were dispositioned during planning on 2026-10-09. Dispositions are recorded inline below.

1. **How many existing courses would Cluster D actually affect?**
   **(RESOLVED — planned as `01-02` Task 2, a blocking `checkpoint:human-verify`.)** The operator must
   run the row count and explicitly confirm the behaviour change before merge; the count is recorded
   in `01-02-SUMMARY.md` as a release note.
   - Known: the guards are dead today; fixing them activates both.
   - Unclear: how many rows have a future `start_date` or past `end_date`.
   - Recommendation: run `SELECT count(*) FROM courses WHERE (start_date > now()) OR (end_date < now())` before merging. If non-trivial, gate behind `checkpoint:human-verify`.

2. **Is `tests/browser/grades.spec.ts` already red in CI?**
   **(RESOLVED — scoped OUT, logged.)** That suite runs in `e2e.yml`, not `ci.yml`, so it is outside
   Phase 1's gates. `01-05` Task 1 explicitly lists it as a logged follow-up and forbids drive-by
   fixing it.
   - Known: it creates `student@edonis.test`, which `db:seed` already inserted into a `.unique()` column.
   - Unclear: whether `e2e.yml` has been passing.
   - Recommendation: check the Actions history. If red, it is a pre-existing failure, **not** something Phase 1 introduced — scope it explicitly in or out.

3. **Should `tests/unit/` be created in Phase 1?**
   **(RESOLVED — YES.)** Created in `01-02` Task 1 together with `tests/unit/course.spec.ts`, the
   5-test regression guard for Cluster D. `01-05` Task 1 wires `node ace test unit` into CI as an
   enforced step.
   - `adonisrc.ts` declares a `unit` suite but the directory does not exist. A `canEnroll()` unit test is the natural regression guard for Cluster D and needs no DB.
   - Recommendation: create it — it is ~15 lines and directly protects the phase's only behaviour change. DEBT-03's literal wording covers only the functional suite, so flag this as a small scope addition.

4. **Should the 3 divergent JSON column blocks be unified eventually?**
   **(RESOLVED — excluded from Phase 1, carried to Phase 2.)** `01-04` Task 1 names `role.ts`,
   `course.ts` and `app_setting.ts` explicitly, asserts they are absent from `git diff --name-only`,
   and logs them as a Phase 2 correctness candidate alongside DEBT-08.
   - Each hides a different latent issue (double-encoding, `JSON.parse('')` crash, `'null'` storage).
   - Recommendation: **out of scope for Phase 1.** Log as a Phase 2 (correctness) candidate alongside DEBT-08.

5. **Should `@adonisjs/vite/vite_provider` be environment-scoped?**
   **(RESOLVED — NO. Rejected outright, not merely deferred.)** The provider registers the
   `@viteReactRefresh()` and `@vite([...])` Edge tags used at `resources/views/inertia_layout.edge`
   lines 54 and 56. Scoping it out of `test` would make every full-HTML Inertia render throw an
   unknown-tag error — converting a startup warning into a hard failure. `01-03` Task 2 explicitly
   prohibits the change and asserts `adonisrc.ts` is unmodified. The sanctioned remedy for the
   port-24678 warning is simply not running `bun run dev` during a test run.
   - It boots during tests (observed: port 24678 conflict + a re-optimize pass).
   - Recommendation: out of scope, but note it if functional tests prove slow or flaky in CI.

---

## Sources

### Primary (HIGH confidence — executed or read from installed code)
- Executed against this tree: `bun run lint`, `bun run typecheck`, `npx tsc --noEmit`, `npx eslint .`, `node ace test functional`, plus a full apply-and-revert of the DEBT-02 fix set and three ESLint rule experiments.
- `node_modules/@adonisjs/lucid/build/src/types/model.d.ts` — `load` (487), `loadOnce` (492), `pojo<T>()` (368), `ColumnOptions.prepare` (128), `related` (542), `$getRelation` (653)
- `node_modules/@adonisjs/lucid/build/src/types/relations.d.ts` — `ExtractModelRelations` (12), `Preload` (639), `PreloadWithoutCallback` (643)
- `node_modules/@adonisjs/lucid/build/src/orm/base_model/index.js:210` — `$addColumn` (proves config-object sharing is safe)
- `node_modules/@adonisjs/lucid/build/src/test_utils/database.{js,d.ts}` — `migrate/seed/truncate/withGlobalTransaction`
- `node_modules/@adonisjs/http-server/build/src/types/server.d.ts:11,38` — `HttpError`, `StatusPageRenderer`
- `node_modules/@poppinss/exception/build/src/exception.d.ts` — `Exception.code?`, `Exception.status`
- `node_modules/@adonisjs/limiter/build/src/errors.d.ts` + `package.json` exports — `ThrottleException.headers`, no `./errors` subpath
- `node_modules/@adonisjs/inertia/build/src/plugins/japa/api_client.{d.ts,js}` — `inertiaProps` is a getter; `ensureIsInertiaResponse`
- `node_modules/@adonisjs/auth` + `@adonisjs/session` `package.json` exports — `./plugins/api_client`
- `node_modules/luxon/src/datetime.js:687` — `fromJSDate` + `isDate` guard
- `node_modules/@adonisjs/eslint-config/index.js:154,188` — `tseslint.configs.base` only, no `projectService`
- `npm view @japa/api-client` — version, dates, repo, peerDeps, peerDependenciesMeta, no postinstall; `api.npmjs.org` downloads

### Secondary (MEDIUM-HIGH — official docs, cross-checked against installed code)
- https://docs.adonisjs.com/guides/testing/resetting-state-between-tests — `.env.test` auto-loading, `testUtils.db().migrate()`, transaction vs truncation. **Note: documents v7; method name differs from installed v6/Lucid 21.8.0.**

### Tertiary (LOW — inferred, flagged in Assumptions Log)
- CI matrix empty-`image` behaviour (A2); browser-suite email collision (A3); production course-date distribution (A7). None executed.

---

## Metadata

**Confidence breakdown:**
- DEBT-01 status: **HIGH** — commands executed, exit codes observed
- DEBT-02 root causes & fixes: **HIGH** — every fix applied and compiled; reference patch saved
- Cluster D runtime bug: **HIGH** — reproduced against the project's own luxon build
- ESLint guard options: **HIGH** — all three candidates executed, error counts measured
- `jsonColumnConfig` dedup safety: **HIGH** — proven from `$addColumn` source + an existing production call site + an applied-and-verified refactor
- DEBT-03 defects: **HIGH** — 15 TS errors reproduced; missing package confirmed; empty-suite exit code 0 confirmed
- CI behavioural claims: **HIGH** for config contents and the `|| echo` no-op; **MEDIUM** for the empty-`image` and browser-collision inferences
- Production data impact of Cluster D: **LOW** — not queried

**Research date:** 2026-10-09
**Valid until:** 2026-11-08 (30 days — stack is stable; re-verify if `@adonisjs/lucid` or `@adonisjs/eslint-config` is upgraded, since both directly determine the recommended fixes)

**Working tree state:** restored to `681b697`. `git status --short` shows only the pre-existing `.planning/config.json` modification. `bun run lint` = 0, `bun run typecheck` = 0, `as any` count = 16 (unchanged).
