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
 * Course-level authorization. Rules encode the inline checks that used to
 * live in the controllers; the gradebook rules are widened by AS2 (plan 02-09).
 */
export default class CoursePolicy extends BasePolicy {
  /**
   * Admin bypass. Runs before the guest check, so `user` may be null.
   */
  async before(user: User | null, _action: string): Promise<AuthorizerResponse | undefined> {
    if (!user) {
      return undefined
    }

    if (await user.hasRole('admin')) {
      return true
    }

    return undefined
  }

  /**
   * Public courses are viewable by any authenticated user once published;
   * draft or archived public courses only by staff and enrolled users (CR-03).
   * Otherwise the owner or anyone holding a `view` (or higher) permission.
   * Admins pass via `before`.
   */
  async view(user: User, course: Course): Promise<AuthorizerResponse> {
    if (course.visibility === 'public' && course.isPublished()) {
      return true
    }
    if (await course.hasPermission(user.id, 'view')) {
      return true
    }
    return course.visibility === 'public' && isEnrolled(user, course)
  }

  /**
   * Owner or any `course_permission` holder (view or higher). Unlike `view`,
   * a public course grants nothing here: gates unpublished course material,
   * e.g. content file downloads.
   */
  async viewAsStaff(user: User, course: Course): Promise<AuthorizerResponse> {
    return course.hasPermission(user.id, 'view')
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
   * Permanent delete and empty trash: owner only, admins via before (D-10).
   */
  emptyTrash(user: User, course: Course): AuthorizerResponse {
    return course.instructorId === user.id
  }

  /**
   * Admin-only actions. Admins pass via `before`; everyone else is denied.
   */
  administer(_user: User): AuthorizerResponse {
    return false
  }

  /**
   * Enrolled users, plus the owner and `edit` (or higher) permission holders
   * so they can preview the player and outline (AS3, plan 02-10). Admins pass
   * via `before`. Gates learn, outline and progress tracking.
   */
  async learn(user: User, course: Course): Promise<AuthorizerResponse> {
    return (await course.hasPermission(user.id, 'edit')) || isEnrolled(user, course)
  }

  /**
   * Owner, `edit` (or higher) permission holders, or enrolled users (admins
   * pass via `before`). A `view`-only collaborator must be enrolled.
   */
  async viewGradebook(user: User, course: Course): Promise<AuthorizerResponse> {
    return (await course.hasPermission(user.id, 'edit')) || isEnrolled(user, course)
  }

  /**
   * Owner or `edit` (or higher) permission holders (admins pass via
   * `before`). Decides whether the gradebook renders the instructor view,
   * which exposes every enrolled student's grades, name and email.
   */
  async viewGradebookAsInstructor(user: User, course: Course): Promise<AuthorizerResponse> {
    return course.hasPermission(user.id, 'edit')
  }

  /**
   * Whether the course accepts enrolments (AS4, plan 02-05); checked by the
   * enrolment controller. Admins bypass it via `before`.
   */
  enroll(_user: User, course: Course): AuthorizerResponse {
    return course.canEnroll()
  }

  /**
   * Enrolment page: courses open for enrolment, or viewable ones (admins via `before`).
   * Not `view` alone: private/unlisted courses open for enrolment are reached by shared link.
   */
  async viewEnrollmentPage(user: User, course: Course): Promise<AuthorizerResponse> {
    return course.canEnroll() || (await this.view(user, course))
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
