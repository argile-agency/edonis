import { Exception } from '@adonisjs/core/exceptions'

/**
 * Raised by `EnrollmentService.enroll` when the conditional capacity increment
 * on the enrolment method matched no row: the method is full (or gone).
 * Controllers map it to the "n'est plus disponible" flash.
 */
export default class CapacityReachedException extends Exception {
  static status = 409
  static code = 'E_ENROLLMENT_CAPACITY_REACHED'

  constructor(message: string = 'Enrolment method capacity reached') {
    super(message)
  }
}
