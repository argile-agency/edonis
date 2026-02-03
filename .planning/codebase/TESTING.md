# Testing Patterns

**Analysis Date:** 2026-02-03

## Test Framework

**Runner:**
- Framework: Japa (`@japa/runner` v4.2.0)
- Config: `tests/bootstrap.ts`
- Plugins: Assertion library (`@japa/assert`), AdonisJS plugin (`@japa/plugin-adonisjs`), browser client (`@japa/browser-client` v2.1.1)

**Assertion Library:**
- `@japa/assert` v4.0.1
- Used for assertions in test suites (e.g., `assert.equal()`)

**Run Commands:**
```bash
bun test                              # Run all tests (default)
node ace test                         # Alternative test command
node ace test browser                 # Run browser/E2E tests only
node ace test browser --headed        # Run with visible browser (HEADLESS=false)
node ace test browser <test-file>     # Run specific test file
BROWSER=firefox node ace test browser # Run with specific browser (chromium default)
```

## Test File Organization

**Location:**
- Browser/E2E tests: `tests/browser/` - Playwright-based using `@japa/browser-client`
- Functional tests: `tests/functional/` - API/integration tests (currently minimal)
- Bootstrap config: `tests/bootstrap.ts`

**Naming:**
- Convention: `{feature}.spec.ts` (e.g., `auth.spec.ts`, `user_management.spec.ts`)
- Skip tests: Add `.skip` suffix (e.g., `grades.spec.ts.skip`)

**Structure:**
```
tests/
├── bootstrap.ts              # Test configuration and plugin setup
├── browser/
│   ├── auth.spec.ts         # Authentication flows
│   ├── user_management.spec.ts # User CRUD operations
│   ├── navigation.spec.ts    # Navigation and access control
│   ├── grades.spec.ts        # Gradebook functionality
│   ├── accessibility.spec.ts # WCAG compliance checks
│   └── README.md             # Browser test documentation
└── functional/
    └── grades.spec.ts.skip   # Disabled functional test (API level)
```

## Test Structure

**Suite Organization:**

```typescript
import { test } from '@japa/runner'

test.group('Feature Name', () => {
  test('should do something', async ({ visit, assert }) => {
    // Test implementation
  })

  test('should handle error case', async ({ visit, assert }) => {
    // Test implementation
  })
})
```

**Setup/Teardown:**
- Configured in `tests/bootstrap.ts` via `configureSuite()`
- Browser tests automatically start HTTP server before running
- Server runs on `http://localhost:3333` (baseURL in context options)

**Example from `auth.spec.ts`:**
```typescript
test.group('Authentication', () => {
  test('can login with valid credentials', async ({ visit }) => {
    const page = await visit('/login')

    await page.locator('input[type="email"]').fill('admin@edonis.test')
    await page.locator('input[type="password"]').fill('password')

    await Promise.all([
      page.waitForURL('**/dashboard', { timeout: 5000 }),
      page.locator('button[type="submit"]').click(),
    ])

    await page.assertPath('/dashboard')
  })
})
```

**Common Patterns:**

**Login/Authentication Pattern:**
```typescript
// Login flow with wait for navigation
const page = await visit('/login')
await page.locator('input[type="email"]').fill('admin@edonis.test')
await page.locator('input[type="password"]').fill('password')

await Promise.all([
  page.waitForURL('**/dashboard', { timeout: 5000 }),
  page.locator('button[type="submit"]').click(),
])

await page.assertPath('/dashboard')
```

**Navigation Pattern:**
```typescript
// Click link and wait for navigation
await Promise.all([
  page.waitForURL('**/admin/users', { timeout: 5000 }),
  page.locator('a[href="/admin/users"]').click(),
])

await page.assertTextContains('h1', 'Gestion des utilisateurs')
```

**Form Interaction Pattern:**
```typescript
// Fill form and apply filters
await page.locator('input[placeholder*="Nom, email"]').fill('admin')
await page.locator('button:has-text("Filtrer")').click()
await page.waitForTimeout(500)

// Assert results
await page.assertExists('table tbody tr')
```

**Complex Component Interaction (shadcn/ui Select):**
```typescript
// Radix UI Select doesn't use native HTML select
await page.locator('button#role').click()
await page.locator('[role="option"]:has-text("Administrateur")').click()
await page.locator('button:has-text("Filtrer")').click()
```

**Network Wait Pattern:**
```typescript
// Wait for network idle before assertions
await page.goto('/admin/users')
await page.waitForLoadState('networkidle')

// Then interact
await page.locator('input[placeholder*="Nom"]').fill('search term')
```

## Browser Test API

**Context Methods & Properties:**

**Navigation:**
- `visit(path)` - Navigate to path and return page object
- `page.goto(url)` - Navigate to URL
- `page.waitForURL(pattern, options)` - Wait for URL match

**Locator & Interaction:**
- `page.locator(selector)` - Find element by selector
- `.fill(value)` - Fill input/textarea
- `.click()` - Click element
- `.first()` - Get first matching element (for multiple matches)

**Assertions:**
- `page.assertPath(path)` - Assert current path
- `page.assertUrlContains(text)` - Assert URL contains text
- `page.assertExists(selector)` - Assert element exists
- `page.assertTextContains(selector, text)` - Assert element has text
- `assert.equal(actual, expected, message)` - Manual assertion

**Waiting:**
- `page.waitForURL(pattern, options)` - Wait for URL to match
- `page.waitForLoadState(state)` - Wait for load state (e.g., 'networkidle')
- `page.waitForTimeout(ms)` - Wait for duration (use sparingly)

**Test Accounts (after seeding):**
```
admin@edonis.test / password
manager@edonis.test / password
teacher@edonis.test / password
student@edonis.test / password
```

## Accessibility Testing

**Framework:** Axe-core (`@axe-core/playwright` v4.11.0)

**Pattern:**
```typescript
import AxeBuilder from '@axe-core/playwright'

test('login page has no critical a11y violations', async ({ visit, assert }) => {
  const page = await visit('/login')
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  const critical = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  )

  assert.equal(critical.length, 0, `Found ${critical.length} violations`)
})
```

**Coverage:**
- `tests/browser/accessibility.spec.ts` checks WCAG2A, WCAG2AA, WCAG21A, WCAG21AA
- Runs on key pages: login, register, dashboard, profile, courses
- Filters for critical and serious violations only
- Logs violations to console if found before assertion

**Current Test Pages:**
- Login page
- Register page
- Dashboard (authenticated)
- User profile (authenticated)
- Courses list (authenticated)

## Mocking

**Current State:**
- No explicit mocking framework configured
- Browser tests use real browser with real application instance
- Tests interact with actual database (seeded data)
- Sidestep mocking by using test accounts and seeded data

**Database Setup for Tests:**
- HTTP server starts automatically via `configureSuite()` in `tests/bootstrap.ts`
- Database initialized from seeds during test setup (see CLAUDE.md)
- Test data persists during test run

**Test Accounts:**
Pre-seeded via `database/seeders/` (run `node ace db:seed`):
- Admin user: `admin@edonis.test`
- Manager user: `manager@edonis.test`
- Teacher user: `teacher@edonis.test`
- Student user: `student@edonis.test`

All use password: `password`

**What to Mock:**
- Not needed: Database operations (use seeded test data)
- Not needed: HTTP requests (use real application)

**What NOT to Mock:**
- Don't mock database - use seeded test data instead
- Don't mock API calls - run full application
- Don't mock auth - use test accounts

## Fixtures and Factories

**Test Data:**
- Located in: `database/seeders/`
- Existing seeders: `user_seeder.ts`, `course_seeder.ts`, `course_category_seeder.ts`, `enrollment_method_seeder.ts`, `cohort_seeder.ts`, `student_enrollment_seeder.ts`, `app_setting_seeder.ts`, `menu_seeder.ts`

**Creating Test Data:**
```typescript
// Reuse existing seeders rather than creating new ones
// In tests, query existing data:
const user = await User.findBy('email', 'admin@edonis.test')
const courses = await Course.query().where('status', 'published')
```

**Pattern from CLAUDE.md:**
```
1. Run `node ace db:seed` to populate all demo data
2. Reuse existing data models instead of creating duplicates
3. Check for existing records with `findBy()` or `updateOrCreate()`
4. Keep demo data realistic but minimal to avoid bloat
```

## Coverage

**Requirements:** No coverage targets enforced

**View Coverage:**
- Not configured in current setup
- Would require adding coverage reporting to test config

**Current Practice:**
- Browser tests focus on critical user journeys
- Tests in `tests/browser/` cover authentication, user management, navigation, grades
- Accessibility tests cover WCAG compliance on key pages

## Test Types

**Browser Tests (E2E):**
- Scope: Full user workflows from login to feature interaction
- Framework: @japa/browser-client (Playwright wrapper)
- Approach: Real browser, real application, real database
- Files: `tests/browser/*.spec.ts`
- Example: `auth.spec.ts` - Login, register, logout flows

**Accessibility Tests:**
- Scope: WCAG 2.1 AA compliance on key pages
- Framework: Axe-core for automated checking
- Approach: Integrated into browser tests via AxeBuilder
- Files: `tests/browser/accessibility.spec.ts`
- Coverage: Critical and serious violations only

**Functional Tests:**
- Scope: API/integration level (minimal current implementation)
- Framework: Japa with HTTP client
- Status: Only one skipped example in `tests/functional/grades.spec.ts.skip`
- Pattern: Would use `client.post()`, `client.get()` etc.

**Unit Tests:**
- Status: Not currently implemented
- Would test: Models, services, validators in isolation

## Common Patterns

**Async Testing:**
```typescript
test('can login with valid credentials', async ({ visit }) => {
  const page = await visit('/login')

  await page.locator('input[type="email"]').fill('admin@edonis.test')
  await page.locator('input[type="password"]').fill('password')

  // Wait for navigation promise alongside click
  await Promise.all([
    page.waitForURL('**/dashboard', { timeout: 5000 }),
    page.locator('button[type="submit"]').click(),
  ])

  await page.assertPath('/dashboard')
})
```

**Error Testing:**
```typescript
test('shows validation errors on invalid login', async ({ visit }) => {
  const page = await visit('/login')

  await page.locator('input[type="email"]').fill('invalid@example.com')
  await page.locator('input[type="password"]').fill('wrongpassword')
  await page.locator('button[type="submit"]').click()

  await page.waitForTimeout(1000)

  // Assert still on login page (error state)
  await page.assertPath('/login')
})
```

**Form Testing with Complex Components:**
```typescript
test('can filter users by role', async ({ visit }) => {
  const page = await visit('/login')
  // ... login steps ...

  await page.goto('/admin/users')
  await page.waitForLoadState('networkidle')

  // Radix UI Select requires special handling
  await page.locator('button#role').click()
  await page.locator('[role="option"]:has-text("Administrateur")').click()
  await page.locator('button:has-text("Filtrer")').click()
  await page.waitForTimeout(500)

  await page.assertExists('table tbody tr')
})
```

**Waiting Best Practices:**
```typescript
// Good: Wait for specific URL during action
await Promise.all([
  page.waitForURL('**/dashboard', { timeout: 5000 }),
  page.locator('button[type="submit"]').click(),
])

// Good: Wait for network idle after navigation
await page.goto('/admin/users')
await page.waitForLoadState('networkidle')

// Avoid: Use timeout sparingly
await page.waitForTimeout(500)  // Only when absolutely needed
```

## CI/CD Integration

**GitHub Actions Workflows:**

**E2E Tests Workflow** (`.github/workflows/e2e.yml`):
- Triggers: Pull Requests, nightly (2 AM UTC), manual dispatch
- Runs: Playwright tests with Chromium (on PR), extended matrix (nightly/manual)
- Matrix: Chromium, Firefox, Webkit (nightly/manual only)
- Timeout: 20 minutes (single), 30 minutes (matrix)
- Artifacts: Screenshots, videos, test reports on failure

**CI Workflow** (`.github/workflows/ci.yml`):
- Runs lint, typecheck, build, security audit, unit tests
- Tests run with PostgreSQL service container
- Follows conventional commits format

## Test Development Guide

**Adding a New Test:**

1. Create file in `tests/browser/{feature}.spec.ts`
2. Import and use test.group():
```typescript
import { test } from '@japa/runner'

test.group('Feature Name', () => {
  test('should test behavior', async ({ visit, assert }) => {
    // Implement test
  })
})
```

3. Use standard patterns from existing tests
4. Login first if testing authenticated pages
5. Use seeded test data (`admin@edonis.test` / `password`)
6. Run: `node ace test browser`

**Debugging Failed Tests:**

```bash
# Run with visible browser
HEADLESS=false node ace test browser tests/browser/auth.spec.ts

# Run specific test file
node ace test browser tests/browser/user_management.spec.ts

# Run with specific browser
BROWSER=firefox node ace test browser
```

**Database Reset Between Runs:**
- Currently test data persists
- To reset: Run seeders again with `node ace db:seed`

---

*Testing analysis: 2026-02-03*
