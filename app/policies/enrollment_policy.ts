import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'
import User from '#models/user'
import CourseEnrollment from '#models/course_enrollment'

/**
 * Enrollment-level authorization. Behaviour-preserving: encodes the inline
 * checks that used to live in `enrollments_controller`.
 */
export default class EnrollmentPolicy extends BasePolicy {
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
   * The enrolled user themself, or anyone with `manage` on the course.
   *
   * The caller must preload `course` on the enrollment.
   */
  async unenroll(user: User, enrollment: CourseEnrollment): Promise<AuthorizerResponse> {
    return enrollment.userId === user.id || enrollment.course.hasPermission(user.id, 'manage')
  }
}
