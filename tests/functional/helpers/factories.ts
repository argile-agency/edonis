import { DateTime } from 'luxon'
import type { Assert } from '@japa/assert'
import type { ApiResponse } from '@japa/api-client'
import User from '#models/user'
import Role from '#models/role'
import Course from '#models/course'
import CoursePermission from '#models/course_permission'
import CourseEnrollment from '#models/course_enrollment'
import CourseEnrollmentMethod from '#models/course_enrollment_method'
import CourseGroup from '#models/course_group'

/**
 * Shared fixture helpers for every Phase 2 functional spec.
 *
 * The functional suite migrates a fresh database but never runs seeders, so
 * every helper creates what it needs (roles included) instead of looking up
 * seeded rows.
 */

export type RoleSlug = 'admin' | 'manager' | 'teacher' | 'student'

const ROLE_NAMES: Record<RoleSlug, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  teacher: 'Teacher',
  student: 'Student',
}

/**
 * Unique suffix so fixtures never collide with seeded rows or each other.
 */
export function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * `courses.code` is unique and limited to 20 characters, so it cannot use
 * `uniqueSuffix()`.
 */
function uniqueCourseCode(): string {
  return `T${Date.now() % 1_000_000_000}${Math.floor(Math.random() * 1_000_000)}`
}

/**
 * Returns the role with the given slug, creating it when the test database
 * has no seeded roles.
 */
export async function ensureRole(slug: RoleSlug): Promise<Role> {
  return Role.firstOrCreate({ slug }, { name: ROLE_NAMES[slug], isSystem: true })
}

export async function createUser(
  opts: { roles?: RoleSlug[]; email?: string; fullName?: string } = {}
): Promise<User> {
  const user = await User.create({
    email: opts.email ?? `u-${uniqueSuffix()}@test.com`,
    password: 'password',
    fullName: opts.fullName ?? 'Test User',
  })

  if (opts.roles && opts.roles.length > 0) {
    const roles = await Promise.all(opts.roles.map((slug) => ensureRole(slug)))
    await user.related('roles').attach(roles.map((role) => role.id))
  }

  return user
}

export async function createCourse(
  instructor: User,
  overrides: Partial<
    Pick<Course, 'code' | 'title' | 'status' | 'visibility' | 'allowEnrollment' | 'maxStudents'>
  > = {}
): Promise<Course> {
  return Course.create({
    code: uniqueCourseCode(),
    title: 'Test Course',
    instructorId: instructor.id,
    status: 'published',
    visibility: 'public',
    allowEnrollment: true,
    ...overrides,
  })
}

export async function grantPermission(
  course: Course,
  user: User,
  level: 'view' | 'edit' | 'manage'
): Promise<CoursePermission> {
  return CoursePermission.create({
    courseId: course.id,
    userId: user.id,
    permissionLevel: level,
  })
}

/**
 * Creates an active student enrollment. Deliberately does NOT touch the
 * course or enrollment-method counters.
 */
export async function enrollUser(
  course: Course,
  user: User,
  overrides: Partial<
    Pick<CourseEnrollment, 'status' | 'courseRole' | 'enrollmentMethodId' | 'enrolledAt'>
  > = {}
): Promise<CourseEnrollment> {
  return CourseEnrollment.create({
    courseId: course.id,
    userId: user.id,
    status: 'active',
    courseRole: 'student',
    enrolledAt: DateTime.now(),
    ...overrides,
  })
}

export async function createEnrollmentMethod(
  course: Course,
  overrides: Partial<
    Pick<
      CourseEnrollmentMethod,
      | 'methodType'
      | 'isEnabled'
      | 'name'
      | 'maxEnrollments'
      | 'enrollmentKey'
      | 'keyCaseSensitive'
      | 'requiresApproval'
      | 'defaultRole'
    >
  > = {}
): Promise<CourseEnrollmentMethod> {
  return CourseEnrollmentMethod.create({
    courseId: course.id,
    methodType: 'self',
    isEnabled: true,
    ...overrides,
  })
}

export async function createGroup(
  course: Course,
  overrides: Partial<Pick<CourseGroup, 'name' | 'description' | 'maxMembers'>> = {}
): Promise<CourseGroup> {
  return CourseGroup.create({
    courseId: course.id,
    name: `Group ${uniqueSuffix()}`,
    ...overrides,
  })
}

/**
 * Fails when Shield rejected the request for a missing or invalid CSRF token.
 * Call it on every 302 assertion of a write, so negative tests cannot pass
 * vacuously.
 */
export function assertNotCsrfRejected(assert: Assert, response: ApiResponse): void {
  assert.isUndefined(
    response.flashMessage('errorsBag.E_BAD_CSRF_TOKEN'),
    'request was rejected by Shield CSRF'
  )
}
