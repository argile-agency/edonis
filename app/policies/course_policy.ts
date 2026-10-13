import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import User from '#models/user'
import Course from '#models/course'
import CourseEnrollment from '#models/course_enrollment'

/**
 * Whether a `course_enrollments` row exists for (course, user), whatever its
 * status. Mirrors the inline checks this policy replaces.
 */
async function isEnrolled(user: User, course: Course): Promise<boolean> {
  const enrollment = await CourseEnrollment.query()
    .where('course_id', course.id)
    .where('user_id', user.id)
    .first()
  return enrollment !== null
}

/**
 * Course-level authorization. Every rule is behaviour-preserving: it encodes
 * the inline checks that used to live in the controllers, with no widening.
 */
export default class CoursePolicy extends BasePolicy {
  /**
   * Admin bypass. Runs before the guest check, so `user` may be null.
   */
  async before(user: User | null, action: string): Promise<AuthorizerResponse | undefined> {
    if (!user) {
      return undefined
    }

    /**
     * Deliberate exclusion: today admins are DENIED a course gradebook they
     * neither own nor are enrolled in. Plan 02-09 (AS2) removes this
     * exclusion only after user confirmation.
     */
    if (action === 'viewGradebook' || action === 'viewGradebookAsInstructor') {
      return undefined
    }

    if (await user.hasRole('admin')) {
      return true
    }

    return undefined
  }

  /**
   * Public courses are viewable by any authenticated user; otherwise the
   * owner or anyone holding a `view` (or higher) permission.
   */
  async view(user: User, course: Course): Promise<AuthorizerResponse> {
    return course.visibility === 'public' || course.hasPermission(user.id, 'view')
  }

  async edit(user: User, course: Course): Promise<AuthorizerResponse> {
    return course.hasPermission(user.id, 'edit')
  }

  async manage(user: User, course: Course): Promise<AuthorizerResponse> {
    return course.hasPermission(user.id, 'manage')
  }

  /**
   * Only the owner (admins pass via `before`).
   */
  delete(user: User, course: Course): AuthorizerResponse {
    return course.instructorId === user.id
  }

  /**
   * Admin-only actions. Admins pass via `before`; everyone else is denied.
   */
  administer(_user: User): AuthorizerResponse {
    return false
  }

  /**
   * Enrolled users only (admins pass via `before`). The owner is NOT granted
   * access unless enrolled: widening this is AS3 (plan 02-10).
   */
  async learn(user: User, course: Course): Promise<AuthorizerResponse> {
    return isEnrolled(user, course)
  }

  /**
   * Owner or enrolled user. Admins are NOT bypassed (see `before`).
   */
  async viewGradebook(user: User, course: Course): Promise<AuthorizerResponse> {
    return course.instructorId === user.id || isEnrolled(user, course)
  }

  /**
   * Owner only. Admins are NOT bypassed (see `before`).
   */
  viewGradebookAsInstructor(user: User, course: Course): AuthorizerResponse {
    return course.instructorId === user.id
  }

  /**
   * Not called anywhere until AS4 (plan 02-05) is confirmed. Admins bypass
   * it via `before`.
   */
  enroll(_user: User, course: Course): AuthorizerResponse {
    return course.canEnroll()
  }
}

/**
 * Restricts a course listing query to the courses `user` may see. This is the
 * single listing decision point (Phase 12 extends it).
 *
 * Mutates `query` in place and returns nothing; Lucid builders are thenables,
 * so returning one from an async function would resolve to rows.
 *
 * Call shape: `await scopeVisibleCourses(query, user)`, then keep chaining on
 * `query`.
 */
export async function scopeVisibleCourses(
  query: ModelQueryBuilderContract<typeof Course>,
  user: User
): Promise<void> {
  if (await user.hasRole('admin')) {
    return
  }

  if ((await user.hasRole('manager')) || (await user.hasRole('teacher'))) {
    // One grouped clause, so filters chained afterwards apply to both branches.
    query.where((builder) => {
      builder.where('instructor_id', user.id).orWhereHas('permissions', (permQuery) => {
        permQuery.where('user_id', user.id)
      })
    })
    return
  }

  query.where('status', 'published').where('visibility', 'public')
}
