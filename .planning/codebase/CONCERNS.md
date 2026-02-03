# Codebase Concerns

**Analysis Date:** 2026-02-03

## Tech Debt

**Incomplete Evaluations Module:**
- Issue: `app/controllers/evaluations_controller.ts` is entirely unimplemented. Returns empty array with placeholder data.
- Files: `app/controllers/evaluations_controller.ts`
- Impact: Teachers cannot view assignments awaiting grading. Critical feature is non-functional.
- Fix approach: Implement querying of submissions by course instructor, grade calculation, and review workflow.

**Unimplemented Contact Form:**
- Issue: Contact page (`inertia/pages/pages/contact.tsx`) has form UI but no backend implementation. Form submission is disabled with TODO comment.
- Files: `inertia/pages/pages/contact.tsx`, missing: `app/controllers/pages_controller.ts` contact action
- Impact: Public contact mechanism non-functional. Visitors cannot submit inquiries.
- Fix approach: Implement contact form submission endpoint, email notification service, and request storage.

**Excessive Type Casting with `any`:**
- Issue: Heavy use of `as any` type assertions throughout codebase, particularly in models and controllers.
- Files: `app/models/cohort.ts:44`, `app/models/course.ts:267,271`, `app/models/course_category.ts:77`, `app/models/menu_item.ts:61-65`, `app/controllers/dashboard_controller.ts:14`, `app/controllers/categories_controller.ts:47`
- Impact: Loss of type safety, potential runtime errors, makes refactoring risky. Lucid relationship loading creates type inference issues.
- Fix approach: Define proper TypeScript interfaces for dynamic operations. Use generics instead of `any`. Consider upgrading Lucid ORM types.

**JSON Serialization in Models:**
- Issue: Multiple models use JSON serialization for storing complex types in database columns without proper migration strategy for schema changes.
- Files: `app/models/assignment.ts:59`, `app/models/course.ts:prepare`, `app/models/course_content.ts:45-46`, `app/models/submission.ts:24,54,60`, `app/models/role.ts:25-30`
- Impact: Cannot easily add/remove fields from stored JSON without data migration. Difficult to index or query JSON fields for analytics.
- Fix approach: Document JSON schema versions. Consider migrating frequently-queried fields to proper columns. Add validation for JSON structure.

**Inefficient Role Checking:**
- Issue: `app/middleware/role_middleware.ts` loads user roles on every request, even for cached responses. No caching of role permissions.
- Files: `app/middleware/role_middleware.ts:21`, `app/controllers/courses_controller.ts:29-31` (repeated role checks)
- Impact: Extra database query per request with role checking. Performance degradation at scale with many role checks.
- Fix approach: Cache user roles in session or Redis. Use role bitmap for fast permission checks. Implement permission caching per user.

## Known Bugs

**Session-Based Two-Factor State:**
- Issue: Two-factor auth stores user ID in session (`session.put('two_factor_user_id', user.id)`) which could be exposed if session is compromised.
- Files: `app/controllers/auth_controller.ts:43`
- Workaround: Session is encrypted by default in AdonisJS. Use HTTPS in production.
- Fix approach: Consider using encrypted OTP tokens or JWT instead of session state for 2FA flow.

**Decryption Fallback Logic:**
- Issue: `app/services/encryption_service.ts:26` returns raw value if decryption fails, silently masking data corruption.
- Files: `app/services/encryption_service.ts:26`
- Trigger: Occurs when encrypted data is corrupted or encryption key changes.
- Workaround: Ensure APP_KEY is never rotated without migration script.
- Fix approach: Log decryption failures, implement data repair migration, consider versioning encryption keys.

## Security Considerations

**Insufficient Input Validation:**
- Risk: Controllers accept dynamic input via `request.only()` and `request.input()` without consistent validation. Some endpoints may have unvalidated parameters.
- Files: `app/controllers/enrollments_controller.ts:53-56`, `app/controllers/courses_controller.ts:21-27`
- Current mitigation: Form validators exist for main operations (`#validators/`), but coverage is incomplete.
- Recommendations:
  - Create validators for ALL endpoints accepting user input
  - Validate `params` in controllers explicitly
  - Add request schema validation middleware
  - Generate validators for all controllers

**Missing Authorization Checks:**
- Risk: Some endpoints perform authorization checks via middleware but not consistently throughout all controllers. Course endpoints check authorization but some admin routes may not.
- Files: `start/routes.ts` (route definitions need audit), individual controllers lack consistent permission guards
- Current mitigation: Role middleware exists but not applied universally.
- Recommendations:
  - Audit all routes for proper permission checks
  - Implement authorization service instead of relying on middleware alone
  - Add explicit guard clauses in controllers for resource ownership
  - Implement resource-level permissions (e.g., verify user owns course before editing)

**OAuth State Validation:**
- Risk: Social auth relies on Ally package state validation. If state mismatch detection fails, CSRF attacks possible.
- Files: `app/controllers/social_auth_controller.ts:46-48`
- Current mitigation: Ally package handles CSRF token validation.
- Recommendations: Verify Ally version is up to date, add additional logging for state mismatches, implement rate limiting on auth endpoints

**No CSRF Protection Verification:**
- Risk: AdonisJS Shield provides CSRF protection but configuration not verified in security review.
- Files: `config/shield.ts` (not reviewed)
- Current mitigation: Shield middleware should be enabled by default.
- Recommendations: Verify CSRF tokens are verified on all state-changing operations, check Shield configuration

**Database Credentials in Environment:**
- Risk: Database password stored in `.env` file. No secret rotation mechanism.
- Files: `start/env.ts:36` (DB_PASSWORD optional)
- Current mitigation: Password is marked optional but still loaded from env.
- Recommendations: Use connection pooler (PgBouncer), implement password rotation procedure, document backup recovery

**Email in Social Account Fallback:**
- Risk: Social account creation extracts email from email.split('@')[0] if full name unavailable, creating weak unique identifiers.
- Files: `app/controllers/social_auth_controller.ts:72`
- Current mitigation: Full name is typically available from OAuth provider.
- Recommendations: Require name from user during signup if provider doesn't provide it, validate email before using

## Performance Bottlenecks

**N+1 Query Problem in Course Listing:**
- Problem: `app/controllers/courses_controller.ts:33-71` preloads instructor but then filters by categories and applies search without proper query optimization.
- Files: `app/controllers/courses_controller.ts:33-71`
- Cause: Multiple preload operations on large result sets without pagination applied first. Categories loaded separately at line 71.
- Improvement path:
  - Move preloads after filtering and before pagination
  - Use lazy loading for instructor where not immediately needed
  - Cache category list separately with long TTL

**Deep Nesting in Course Show:**
- Problem: `app/controllers/courses_controller.ts:116-130` loads modules → children → contents with 4 levels of nesting.
- Files: `app/controllers/courses_controller.ts:116-130`
- Cause: Tree structure requires recursive loading of all nested relations.
- Improvement path:
  - Implement flat structure query, then reconstruct tree in memory
  - Use database recursive CTE for hierarchical queries
  - Implement pagination at each level
  - Cache tree structure with ETags

**Missing Database Indexes on High-Query Columns:**
- Problem: Frequent queries on `user_id`, `course_id`, `is_published`, `status` may lack proper indexes.
- Files: Database schema across migrations
- Cause: Auto-generated migrations may not include composite indexes for common query patterns.
- Improvement path:
  - Add indexes on: (course_id, status), (user_id, created_at), (course_id, user_id), (is_published, created_at)
  - Monitor slow query logs in production
  - Consider partial indexes for active records only

**JSON Column Serialization Overhead:**
- Problem: Models use JSON.stringify/parse on every read/write of metadata, metadata, options fields.
- Files: `app/models/assignment.ts`, `app/models/course_content.ts`, `app/models/submission.ts`, `app/models/role.ts`
- Cause: No caching of deserialized JSON, parsed repeatedly per request.
- Improvement path:
  - Implement lazy loading of JSON fields
  - Add memoization for frequently accessed metadata
  - Consider extracting frequently-queried fields to columns

**Unindexed Sorting on Large Tables:**
- Problem: `app/controllers/courses_controller.ts:68` sorts by `created_at` without pagination on potentially large dataset.
- Files: `app/controllers/courses_controller.ts:68`
- Cause: Pagination is applied but sort is done before filtering which may scan entire table.
- Improvement path:
  - Ensure index on (created_at) exists
  - Apply filtering before pagination
  - Consider denormalizing last-modified timestamps for popular sort columns

## Fragile Areas

**Course Enrollment Increment Logic:**
- Files: `app/controllers/enrollments_controller.ts:131-136`
- Why fragile: Manual increment/decrement of `enrolledCount` and `currentEnrollments` can fall out of sync if enrollment deleted or updated elsewhere. No transactional guarantee.
- Safe modification: Wrap increment in database transaction. Consider using database triggers or view for calculated counts instead of manual increment.
- Test coverage: No test coverage visible for enrollment count consistency.

**Bulk Enrollment Import:**
- Files: `app/controllers/users_controller.ts` (likely contains bulk import logic), `app/models/bulk_enrollment_log.ts`
- Why fragile: Bulk operations often have partial failure scenarios. If import fails mid-process, some users may be enrolled while others not, with inconsistent error logging.
- Safe modification: Implement atomic bulk operations with rollback on any failure. Add row-level error tracking.
- Test coverage: No unit tests visible for bulk enrollment edge cases.

**Category Hierarchical Queries:**
- Files: `app/controllers/categories_controller.ts:47-50` (buildTree function)
- Why fragile: Recursive tree building in application code. If category hierarchy has cycles, could cause infinite loop. Multiple `.load('parent' as any)` calls throughout.
- Safe modification: Add parent ID validation to prevent cycles at database level. Use proper TypeScript instead of `as any`. Add cycle detection in tree builder.
- Test coverage: No test coverage for circular category references or deep hierarchies.

**Menu Item Visibility Logic:**
- Files: `app/models/menu_item.ts:61-65`
- Why fragile: Visibility check relies on `user?.roles?.some()` with unsafe optional chaining. If roles fail to load, silently returns undefined instead of error.
- Safe modification: Require roles to be preloaded before visibility check. Add explicit error if roles not loaded.
- Test coverage: No tests visible for menu visibility with missing role data.

**Two-Factor Authentication Flow:**
- Files: `app/controllers/two_factor_controller.ts` (262 lines, not fully reviewed)
- Why fragile: Session-based state tracking for pending 2FA. If session expires or database resets, user locked out.
- Safe modification: Add timestamp to 2FA session state, implement timeout handling, provide recovery codes or admin unlock.
- Test coverage: Browser test `tests/browser/auth.spec.ts` may cover happy path but edge cases unknown.

## Scaling Limits

**Session Storage Limitation:**
- Current capacity: In-memory or cookie-based sessions limit concurrent users
- Limit: Cookie-based sessions cannot scale beyond single server without sticky sessions
- Scaling path: Migrate to Redis session store (`SESSION_DRIVER: 'redis'`), configure session Redis cluster

**Database Connection Pool:**
- Current capacity: Default Lucid pool (likely 10-20 connections)
- Limit: Concurrent requests limited by available connections; 100+ concurrent users will hit limits
- Scaling path: Increase pool size in `config/database.ts`. Consider PgBouncer for connection pooling on database side.

**Course Content Preloading:**
- Current capacity: Preloading 4+ levels of relations feasible for ~1000 courses
- Limit: At 10,000+ courses with complex hierarchies, memory usage explodes and queries timeout
- Scaling path: Implement lazy loading, pagination at each hierarchy level, caching layer (Redis)

**In-Memory Role Cache:**
- Current capacity: No caching; every request reloads roles
- Limit: With 10+ roles per user and 1000+ concurrent users, 10,000+ role checks per second
- Scaling path: Implement Redis-backed role cache with 5-minute TTL, session-based role bitmap

## Dependencies at Risk

**Edge.js Version:**
- Risk: `edge.js@^6.4.0` is a template engine in maintenance mode. Limited activity indicates potential abandonment.
- Impact: Bug fixes may be slow. Emerges as bottleneck if issues found.
- Migration plan: Monitor for critical bugs. Alternative: Consider Eta or Handlebars if issues arise. Edge is stable for current use.

**AdonisJS Minor Version Updates:**
- Risk: Multiple minor version dependencies (`@adonisjs/*@^7.x`, `@adonisjs/*@^6.x`) may introduce breaking changes in patches.
- Impact: Security patches in dependencies could break compatibility.
- Migration plan: Pin to patch versions for critical services (`@adonisjs/core`, `@adonisjs/auth`). Test minor updates before upgrading.

**Playwright for E2E Tests:**
- Risk: Playwright 1.56.1 is current as of analysis date but rapid release cycle means future versions may drop features or change API.
- Impact: Test infrastructure fragile to version changes.
- Migration plan: Keep in sync with upstream. Use compatible version ranges for other `@japa/*` dependencies.

## Missing Critical Features

**Evaluations Dashboard:**
- Problem: Teacher grading interface completely missing. `app/controllers/evaluations_controller.ts` returns placeholder data.
- Blocks: Teachers cannot review submissions, assign grades, provide feedback. Core LMS functionality unavailable.
- Priority: **CRITICAL** - This is a core teaching feature.

**Contact Form Backend:**
- Problem: Contact page UI exists but no backend endpoint or email service.
- Blocks: Public messaging/inquiry mechanism non-functional.
- Priority: **Medium** - Useful for user support but not core learning feature.

**Real-Time Collaboration:**
- Problem: WebSocket or SSE infrastructure for collaborative editing not visible in codebase.
- Blocks: Document sharing, group assignments, live chat not possible.
- Priority: **Medium** - Enhancement feature, not MVP blocker.

**Learning Analytics/xAPI:**
- Problem: CLAUDE.md mentions xAPI compliance but no implementation visible. `app/services/` only has 3 services (audit, encryption, 2FA).
- Blocks: Learning record store integration and learning analytics features not available.
- Priority: **High** - Roadmap feature needed for institutional adoption.

## Test Coverage Gaps

**No Unit Tests:**
- What's not tested: Models, services, validators have no unit test suite.
- Files: All of `app/models/`, `app/services/`, `app/validators/`
- Risk: Refactoring models is extremely risky. Service behavior unverified.
- Priority: **High** - Critical for code quality and maintainability.

**No Functional/API Tests:**
- What's not tested: No visible functional tests for controllers. Only browser E2E tests exist.
- Files: Missing `tests/functional/` directory with API tests
- Risk: API changes could break frontends without detection. Business logic untested.
- Priority: **Critical** - API contracts need verification.

**Incomplete E2E Coverage:**
- What's not tested: Only 5 browser test files visible. Major user journeys likely uncovered:
  - Course creation and content management
  - Assignment submission and grading flow
  - Grade calculation and reporting
  - Bulk enrollment
  - Two-factor recovery scenarios
  - Social auth flow edge cases
- Files: `tests/browser/` (only auth, user_management, grades, navigation, accessibility)
- Risk: Production bugs in untested workflows.
- Priority: **High** - Add tests for critical user journeys before launch.

**No Performance/Load Tests:**
- What's not tested: No load testing or performance benchmarking visible.
- Files: No `tests/performance/` or load test configuration
- Risk: Scaling limits unknown. Performance regressions undetected.
- Priority: **Medium** - Important before production scale-up.

**No Security Tests:**
- What's not tested: No security-focused tests (CSRF, XSS, SQL injection, authorization bypasses).
- Files: No `tests/security/` or vulnerability scanning integration
- Risk: Security vulnerabilities could reach production undetected.
- Priority: **High** - Add security test suite before public launch.

---

*Concerns audit: 2026-02-03*
