# Deferred Items — Phase 01

Out-of-scope discoveries logged during execution. Not fixed; tracked for a future plan.

## From 01-01

### 1. 429 page `retryAfter` never populated (pre-existing bug)

- **File:** `app/exceptions/handler.ts` (the `'429'` status page renderer)
- **Finding:** `@adonisjs/limiter`'s `ThrottleException.getDefaultHeaders()`
  (`node_modules/@adonisjs/limiter/build/chunk-RWNA5JOS.js:87`) sets the header as
  `"Retry-After"` (capitalised) with a **numeric** value (`this.response.availableIn`).
  The handler looks up `headers['retry-after']` (lowercase), so the lookup never matches
  and `retryAfter` is always `undefined` on the `errors/too_many_requests` page. This was
  already true before 01-01; the structural-guard refactor kept the same key.
- **Suggested fix:** read `error.headers['Retry-After'] ?? error.headers['retry-after']`.
  Separately, confirm whether a `ThrottleException` reaches `statusPages` at all, or
  whether its own `handle()` renders the response first.

### 2. `ErrorWithHeaders` value type is narrower than the runtime value

- **File:** `app/exceptions/handler.ts`
- **Finding:** `ErrorWithHeaders` types header values as `string | undefined`, but the
  limiter sets numbers (and `X-RateLimit-Limit` / `X-RateLimit-Remaining` are numbers too).
  This is harmless today because `Number.parseInt` coerces its argument to a string at
  runtime. Worth widening to `string | number | undefined` (with an explicit `String(...)`)
  when item 1 is fixed.

## From 01-04

### 3. Three divergent JSON column hooks intentionally NOT deduplicated (Phase 2 correctness candidate, alongside DEBT-08)

These look like `jsonColumnConfig` but have different null/empty semantics. Swapping them onto the shared config changes runtime behaviour, so do not "finish the job" without a data audit and backfill plan:

- **`app/models/role.ts` (`permissions`)**: `prepare` returns the value unchanged when `typeof value === 'string'`. `jsonColumnConfig` would `JSON.stringify` an already-serialized string, which **double-encodes** it.
- **`app/models/course.ts` (`tags`)**: uses falsy checks (`if (!value) return null`) instead of `!= null`. `jsonColumnConfig` would reach `JSON.parse('')` on an empty-string column value and throw a **`SyntaxError` at read time**.
- **`app/models/app_setting.ts` (`socialLinks`)**: `prepare` has no null check and currently stores the literal string `'null'`. `jsonColumnConfig` would store SQL `NULL` instead, a **stored-value change** that needs a backfill.
