import { Exception } from '@adonisjs/core/exceptions'

/**
 * Raised by `EnrollmentService.enroll` when the `unique(course_id, user_id)`
 * constraint rejects the insert. Controllers map it to the
 * "Vous êtes déjà inscrit à ce cours." flash.
 */
export default class AlreadyEnrolledException extends Exception {
  static status = 409
  static code = 'E_ALREADY_ENROLLED'

  constructor(message: string = 'User is already enrolled in this course') {
    super(message)
  }
}
