# Coding Conventions

**Analysis Date:** 2026-02-03

## Naming Patterns

**Files:**
- Controllers: `{resource}_controller.ts` (e.g., `users_controller.ts`, `courses_controller.ts`)
- Models: PascalCase (e.g., `User.ts`, `CourseContent.ts`)
- Validators: `{resource}_validator.ts` or standalone (e.g., `user_validator.ts`, `course.ts`)
- Services: PascalCase with `Service` suffix (e.g., `AuditService.ts`, `EncryptionService.ts`)
- Middleware: `{name}_middleware.ts` (e.g., `auth_middleware.ts`, `role_middleware.ts`)
- React Components: PascalCase in `inertia/components/` and `inertia/pages/`
- React Pages: kebab-case with nested directories matching routes (e.g., `/auth/login.tsx`, `/admin/users/create.tsx`)

**Functions:**
- Backend: camelCase (e.g., `async updateLastLogin()`, `validateEmailUnique()`)
- React: PascalCase for components, camelCase for hooks and utilities
- Static class methods in services start lowercase (e.g., `AuditService.log()`)

**Variables:**
- Backend: camelCase (e.g., `userId`, `isActive`, `resourceId`)
- Database columns: snake_case (e.g., `created_at`, `full_name`, `student_id`)
- React: camelCase (e.g., `showPassword`, `handleSubmit`, `setData`)

**Types:**
- Interfaces/Types: PascalCase (e.g., `AuditOptions`, `ButtonProps`)
- Generics: Single uppercase letters or descriptive PascalCase (e.g., `T`, `ManyToMany`)
- Enums: PascalCase values with snake_case storage (e.g., `enum RoleType { Admin = 'admin' }`)

**Classes:**
- PascalCase (e.g., `User`, `Course`, `AuditLog`)
- Decorators used: `@column()`, `@manyToMany()`, `@beforeSave()`

## Code Style

**Formatting:**
- Tool: Prettier (via `@adonisjs/prettier-config`)
- Run: `bun run format`
- Configuration: Inherited from `@adonisjs/prettier-config` (file-based, not `.prettierrc`)

**Linting:**
- Tool: ESLint with `@adonisjs/eslint-config` and `eslint-plugin-jsx-a11y`
- Run: `bun run lint`
- Config: `eslint.config.js` at root
- Special rules for React a11y in `inertia/` directory
- Includes accessibility checks for JSX components

**Line length:** 100-120 characters (Prettier default)

**Semicolons:** Enabled

**Quotes:** Single quotes in JavaScript, double quotes in JSX attributes

**Indentation:** 2 spaces

## Import Organization

**Order:**
1. External packages (Node.js, npm) - e.g., `import { DateTime } from 'luxon'`
2. AdonisJS services/types - e.g., `import type { HttpContext } from '@adonisjs/core/http'`
3. Subpath imports (#models, #controllers, etc.)
4. Relative imports (inertia/)

**Path Aliases:**
Backend subpath imports (defined in `package.json`):
- `#controllers/*` → `./app/controllers/*.js`
- `#models/*` → `./app/models/*.js`
- `#middleware/*` → `./app/middleware/*.js`
- `#validators/*` → `./app/validators/*.js`
- `#services/*` → `./app/services/*.js`
- `#exceptions/*` → `./app/exceptions/*.js`
- `#events/*` → `./app/events/*.js`
- `#listeners/*` → `./app/listeners/*.js`
- `#mails/*` → `./app/mails/*.js`
- `#policies/*` → `./app/policies/*.js`
- `#abilities/*` → `./app/abilities/*.js`
- `#database/*` → `./database/*.js`
- `#tests/*` → `./tests/*.js`
- `#start/*` → `./start/*.js`
- `#config/*` → `./config/*.js`

Frontend alias (Inertia):
- `~/` → `./inertia/`

**Example Backend Import:**
```typescript
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import User from '#models/user'
import AuditService from '#services/audit_service'
```

**Example Frontend Import:**
```typescript
import { useForm } from '@inertiajs/react'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'
```

## Error Handling

**Patterns:**
- Use try-catch blocks for async operations in controllers
- Log errors with AdonisJS logger service using structured format
- Flash session messages for user-facing errors
- Return appropriate HTTP responses (redirect, status codes)

**Example from `auth_controller.ts`:**
```typescript
try {
  const user = await User.verifyCredentials(email, password)
  if (!user.isActive) {
    session.flash('error', 'Votre compte a été désactivé.')
    return response.redirect().back()
  }
  await auth.use('web').login(user)
} catch (error) {
  await AuditService.logFromContext(ctx, {
    action: 'user.login.failed',
    resourceType: 'User',
    metadata: { email },
  })
  session.flash('error', 'Email ou mot de passe incorrect')
  return response.redirect().back()
}
```

**Exception Handler:**
- Located in `app/exceptions/handler.ts`
- Renders status pages via Inertia for 404, 429, 500+ errors
- Falls back to Edge template if database connection fails
- Detects connection errors via pattern matching on error messages
- Debug mode enabled in development

**Response Patterns:**
- Validation errors: Return via session.flash() and redirect().back()
- Authorization failures: `response.forbidden()`
- Authentication failures: `response.unauthorized()`
- Success: `response.redirect().toRoute('routeName')` or session.flash('success', '...')`

## Logging

**Framework:** AdonisJS logger service (uses Pino underneath)

**Usage:**
- Import: `import logger from '@adonisjs/core/services/logger'`
- Methods: `logger.error()`, `logger.warn()`, `logger.info()`, `logger.debug()`

**Patterns:**
- Controllers: Log errors with context (e.g., `logger.error('DashboardController: failed to load roles: %s', message)`)
- Include error details: Use `%O` for objects, `%s` for strings
- Never use `console.log()` - use logger instead

**Example:**
```typescript
try {
  // operation
} catch (error) {
  logger.error('Profile update error: %O', error)
  session.flash('error', 'Profile update failed')
}
```

## Comments

**When to Comment:**
- Route definitions with HTTP method and path
- Middleware configuration and options
- Complex query building or transformations
- Section separators for logical groupings in large files

**JSDoc/TSDoc:**
- Used for public-facing functions and middleware
- Simple format: `/** Description */` above function
- Include action type for controller methods (e.g., `/** GET /admin/users */`)
- Example from `auth_controller.ts`:
```typescript
/**
 * Traiter la connexion
 * POST /login
 */
async login(ctx: HttpContext) {
  // ...
}
```

**Inline Comments:**
- Use `//` for inline clarification
- Often bilingual (French and English comments observed)
- Comment why, not what (code should be clear on what)

**Comment Style:**
- Block sections with comment dividers: `/*|---...|*/` pattern
- French is used in UI-facing logic
- English used for technical implementation

## Function Design

**Size:** Controllers range from ~180 to 869 lines (largest files are controllers handling multiple related resources)
- Large controllers: Break into separate methods by HTTP action (index, create, store, edit, update, destroy)
- Services: Keep focused on single responsibility (~50 lines typical)

**Parameters:**
- Use destructuring for HttpContext: `{ inertia, request, response, auth, session } = ctx`
- Type destructured properties for clarity
- Pass full context to functions that need multiple properties

**Return Values:**
- Controllers return Inertia render or HTTP response
- Services return Promises or direct values
- Validation functions return booleans

**Example from `users_controller.ts`:**
```typescript
async index({ inertia, request }: HttpContext) {
  const page = request.input('page', 1)
  const search = request.input('search', '')
  const query = User.query().preload('roles')

  if (search) {
    query.where((subQuery) => {
      subQuery.whereILike('full_name', `%${search}%`)
    })
  }

  const users = await query.paginate(page, limit)
  return inertia.render('users/index', { users: users.serialize() })
}
```

## Module Design

**Exports:**
- Controllers: Default export of class
- Models: Default export of class extending BaseModel
- Services: Default export of class with static methods
- Validators: Named exports for each validator function and helper functions
- Middleware: Default export of class implementing `handle()` method

**Example from `user_validator.ts`:**
```typescript
export const createUserValidator = vine.compile(...)
export const updateUserValidator = vine.compile(...)
export async function validateEmailUnique(email: string): Promise<boolean> { ... }
export async function validateStudentIdUnique(studentId: string): Promise<boolean> { ... }
```

**Barrel Files:** Not observed in current codebase
- Each resource imported directly by path

**Model Conventions:**
- Extends `BaseModel` with `@column()` decorators
- Use `isPrimary: true` for ID columns
- Use `serializeAs: null` to hide sensitive fields (passwords)
- Use `prepare()` and `consume()` for encryption (sensitive fields like phone, address)
- Relationships via `@manyToMany()`, `@hasMany()` decorators

**Example from `user.ts`:**
```typescript
@column({
  prepare: (value: string | null) => EncryptionService.encrypt(value),
  consume: (value: string | null) => EncryptionService.decrypt(value),
})
declare phone: string | null
```

## Database Naming

**Tables:** Plural snake_case (e.g., `users`, `courses`, `user_roles`)
**Columns:** snake_case with clear prefixes
- IDs: `{table}_id` (e.g., `user_id`, `course_id`)
- Booleans: Prefixed with `is_` or `has_` (e.g., `is_active`, `two_factor_enabled`)
- Timestamps: `created_at`, `updated_at` (added automatically by BaseModel)

**Relationships:**
- Many-to-many pivot tables: Alphabetically ordered (e.g., `role_user` not `user_role`)
- Foreign keys: Required with `NOT NULL` constraint for tenant-aware models

**Multi-tenancy:**
- All tenant-aware tables include `tenant_id UUID NOT NULL`
- Models scope queries automatically via `boot()` method

## Frontend Component Conventions

**Button variants:** Extensive palette including education-specific variants
- `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`
- Educational: `success`, `warning`, `info`, `accent`
- Soft variants: `soft-primary`, `soft-success`, `soft-warning`, `soft-destructive`, `soft-info`

**Styling:**
- Tailwind CSS v4 with `@import 'tailwindcss'`
- CSS variables for design tokens in `:root` and `.dark` modes
- Custom utilities via CVA (class-variance-authority)
- Helper function: `cn()` for merging Tailwind classes and custom classes

**Example from button component:**
```typescript
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        aria-busy={loading}
      >
        {loading ? <Loader2 className="animate-spin" /> : leftIcon ? <span>{leftIcon}</span> : null}
        {children}
        {!loading && rightIcon && <span>{rightIcon}</span>}
      </button>
    )
  }
)
```

**Accessibility:**
- All interactive elements have proper `aria-*` attributes
- Icons marked with `aria-hidden="true"`
- Loading state uses `aria-busy` attribute
- ESLint a11y rules enforced for React components

---

*Convention analysis: 2026-02-03*
