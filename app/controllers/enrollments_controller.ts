import type { HttpContext } from '@adonisjs/core/http'
import Course from '#models/course'
import CourseEnrollment from '#models/course_enrollment'
import CourseEnrollmentMethod from '#models/course_enrollment_method'
import CourseEnrollmentRequest from '#models/course_enrollment_request'
import CourseGroup from '#models/course_group'
import User from '#models/user'
import EnrollmentService from '#services/enrollment_service'
import CapacityReachedException from '#exceptions/capacity_reached_exception'
import AlreadyEnrolledException from '#exceptions/already_enrolled_exception'
import {
  enrollManualValidator,
  enrollSelfValidator,
  enrollWithKeyValidator,
  requestEnrollmentValidator,
} from '#validators/enrollment'
import { DateTime } from 'luxon'

/**
 * Runs a student-initiated enrolment and turns the two expected refusals
 * into their flash message. Returns null on success; any other error
 * propagates.
 */
async function enrollmentRefusal(enroll: () => Promise<unknown>): Promise<string | null> {
  try {
    await enroll()
    return null
  } catch (error) {
    if (error instanceof CapacityReachedException) {
      return "Cette méthode d'inscription n'est plus disponible."
    }
    if (error instanceof AlreadyEnrolledException) {
      return 'Vous êtes déjà inscrit à ce cours.'
    }
    throw error
  }
}

/**
 * Learner-facing whitelist of an enrolment method; never includes the key.
 */
function toLearnerMethod(method: CourseEnrollmentMethod) {
  return {
    id: method.id,
    methodType: method.methodType,
    name: method.name,
    // SQLite/MySQL return 1/0 for booleans
    isEnabled: Boolean(method.isEnabled),
    maxEnrollments: method.maxEnrollments,
    currentEnrollments: method.currentEnrollments,
    enrollmentStartDate: method.enrollmentStartDate?.toISO() ?? null,
    enrollmentEndDate: method.enrollmentEndDate?.toISO() ?? null,
    approvalMessage: method.approvalMessage,
    welcomeMessage: method.welcomeMessage,
    requiresKey: method.methodType === 'key',
    isAvailable: method.isAvailable(),
  }
}

export default class EnrollmentsController {
  /**
   * Display enrollment page for a course
   */
  async show({ params, auth, bouncer, inertia }: HttpContext) {
    const course = await Course.query()
      .where('id', params.id)
      .preload('instructor')
      .preload('courseCategory')
      .preload('enrollmentMethods', (query) => {
        query.where('is_enabled', true).orderBy('sort_order', 'asc')
      })
      .firstOrFail()

    await bouncer.with('CoursePolicy').authorize('viewEnrollmentPage', course)

    // Check if user is already enrolled
    const existingEnrollment = await CourseEnrollment.query()
      .where('course_id', course.id)
      .where('user_id', auth.user!.id)
      .first()

    // Check if user has a pending request
    const pendingRequest = await CourseEnrollmentRequest.query()
      .where('course_id', course.id)
      .where('user_id', auth.user!.id)
      .where('status', 'pending')
      .first()

    return inertia.render('enrollments/show', {
      course: course.serialize(),
      enrollmentMethods: course.enrollmentMethods.map(toLearnerMethod),
      existingEnrollment: existingEnrollment?.serialize(),
      pendingRequest: pendingRequest?.serialize(),
    })
  }

  /**
   * Enroll with a key
   */
  async enrollWithKey({ params, request, auth, bouncer, response, session }: HttpContext) {
    const { enrollmentKey, enrollmentMethodId } =
      await request.validateUsing(enrollWithKeyValidator)

    // Scoped to the course in the URL (A9)
    const method = await CourseEnrollmentMethod.query()
      .where('id', enrollmentMethodId)
      .where('course_id', params.id)
      .first()

    if (!method) {
      session.flash('error', "Méthode d'inscription invalide.")
      return response.redirect().back()
    }

    // AS4: the course itself must be open for enrolment (admins bypass)
    const course = await Course.findOrFail(method.courseId)
    if (await bouncer.with('CoursePolicy').denies('enroll', course)) {
      session.flash('error', 'Les inscriptions à ce cours ne sont pas ouvertes.')
      return response.redirect().back()
    }

    // Validate method is available
    if (!method.isAvailable()) {
      session.flash('error', "Cette méthode d'inscription n'est plus disponible.")
      return response.redirect().back()
    }

    // Validate method type
    if (method.methodType !== 'key') {
      session.flash('error', "Méthode d'inscription invalide.")
      return response.redirect().back()
    }

    // Validate key
    if (!method.validateKey(enrollmentKey)) {
      session.flash('error', "Clé d'inscription invalide.")
      return response.redirect().back()
    }

    // Calculate access period
    let timeStart = DateTime.now()
    let timeEnd = null

    if (method.enrollmentDurationDays) {
      timeEnd = DateTime.now().plus({ days: method.enrollmentDurationDays })
    }

    // Seat, enrolment row, counters and auto-assign group in one transaction.
    // The unique (course_id, user_id) constraint is the duplicate guard.
    const refusal = await enrollmentRefusal(() =>
      EnrollmentService.enroll({
        courseId: method.courseId,
        userId: auth.user!.id,
        methodId: method.id,
        courseRole: method.defaultRole,
        enrolledBy: null, // Self-enrolled
        timeStart,
        timeEnd,
        groupId: method.autoAssignGroupId,
        addedBy: null,
      })
    )
    if (refusal) {
      session.flash('error', refusal)
      return response.redirect().back()
    }

    session.flash('success', 'Inscription réussie ! Bienvenue dans le cours.')

    return response.redirect().toRoute('courses.show', { id: method.courseId })
  }

  /**
   * Self-enroll (open enrollment)
   */
  async enrollSelf({ params, request, auth, bouncer, response, session }: HttpContext) {
    const { enrollmentMethodId } = await request.validateUsing(enrollSelfValidator)

    // Scoped to the course in the URL (A9)
    const method = await CourseEnrollmentMethod.query()
      .where('id', enrollmentMethodId)
      .where('course_id', params.id)
      .first()

    if (!method) {
      session.flash('error', "Méthode d'inscription invalide.")
      return response.redirect().back()
    }

    // AS4: the course itself must be open for enrolment (admins bypass)
    const course = await Course.findOrFail(method.courseId)
    if (await bouncer.with('CoursePolicy').denies('enroll', course)) {
      session.flash('error', 'Les inscriptions à ce cours ne sont pas ouvertes.')
      return response.redirect().back()
    }

    // Validate method
    if (!method.isAvailable()) {
      session.flash('error', "Cette méthode d'inscription n'est plus disponible.")
      return response.redirect().back()
    }

    if (method.methodType !== 'self') {
      session.flash('error', "Méthode d'inscription invalide.")
      return response.redirect().back()
    }

    // Calculate access period
    let timeStart = DateTime.now()
    let timeEnd = null

    if (method.enrollmentDurationDays) {
      timeEnd = DateTime.now().plus({ days: method.enrollmentDurationDays })
    }

    const refusal = await enrollmentRefusal(() =>
      EnrollmentService.enroll({
        courseId: method.courseId,
        userId: auth.user!.id,
        methodId: method.id,
        courseRole: method.defaultRole,
        enrolledBy: null,
        timeStart,
        timeEnd,
        groupId: method.autoAssignGroupId,
        addedBy: null,
      })
    )
    if (refusal) {
      session.flash('error', refusal)
      return response.redirect().back()
    }

    session.flash('success', method.welcomeMessage || 'Inscription réussie !')

    return response.redirect().toRoute('courses.show', { id: method.courseId })
  }

  /**
   * Request enrollment (requires approval)
   */
  async requestEnrollment({ params, request, auth, response, session }: HttpContext) {
    const { enrollmentMethodId, requestMessage } = await request.validateUsing(
      requestEnrollmentValidator
    )

    // Scoped to the course in the URL (A9)
    const method = await CourseEnrollmentMethod.query()
      .where('id', enrollmentMethodId)
      .where('course_id', params.id)
      .first()

    if (!method) {
      session.flash('error', "Méthode d'inscription invalide.")
      return response.redirect().back()
    }

    // Validate method
    if (!method.isAvailable()) {
      session.flash('error', "Cette méthode d'inscription n'est plus disponible.")
      return response.redirect().back()
    }

    if (method.methodType !== 'approval') {
      session.flash('error', "Méthode d'inscription invalide.")
      return response.redirect().back()
    }

    // Check if already enrolled
    const existingEnrollment = await CourseEnrollment.query()
      .where('course_id', method.courseId)
      .where('user_id', auth.user!.id)
      .first()

    if (existingEnrollment) {
      session.flash('error', 'Vous êtes déjà inscrit à ce cours.')
      return response.redirect().back()
    }

    // Check if already has pending request
    const existingRequest = await CourseEnrollmentRequest.query()
      .where('course_id', method.courseId)
      .where('user_id', auth.user!.id)
      .where('status', 'pending')
      .first()

    if (existingRequest) {
      session.flash('error', "Vous avez déjà une demande d'inscription en attente.")
      return response.redirect().back()
    }

    // Create enrollment request
    await CourseEnrollmentRequest.create({
      courseId: method.courseId,
      userId: auth.user!.id,
      enrollmentMethodId: method.id,
      status: 'pending',
      requestMessage: requestMessage || null,
    })

    session.flash(
      'success',
      "Votre demande d'inscription a été envoyée. Vous serez notifié une fois qu'elle sera traitée."
    )

    return response.redirect().toRoute('courses.show', { id: method.courseId })
  }

  /**
   * Manual enrollment by instructor/admin
   */
  async enrollManual({ params, request, auth, bouncer, response, session }: HttpContext) {
    const course = await Course.findOrFail(params.id)

    await bouncer.with('CoursePolicy').authorize('manage', course)

    const { userIds, courseRole, enrollmentMethodId, groupId } =
      await request.validateUsing(enrollManualValidator)

    // Method and group must both belong to this course (A9)
    let method: CourseEnrollmentMethod | null = null
    if (enrollmentMethodId) {
      method = await CourseEnrollmentMethod.query()
        .where('id', enrollmentMethodId)
        .where('course_id', course.id)
        .first()

      if (!method) {
        session.flash('error', "Méthode d'inscription invalide.")
        return response.redirect().back()
      }
    }

    let group: CourseGroup | null = null
    if (groupId) {
      group = await CourseGroup.query().where('id', groupId).where('course_id', course.id).first()

      if (!group) {
        session.flash('error', 'Groupe invalide pour ce cours.')
        return response.redirect().back()
      }
    }

    const enrolledUsers: string[] = []
    const errors: string[] = []

    // One transaction per user: a refusal for one user never undoes the others
    for (const userId of userIds) {
      let user: User | null = null
      try {
        user = await User.findOrFail(userId)

        await EnrollmentService.enroll({
          courseId: course.id,
          userId: user.id,
          methodId: method?.id ?? null,
          courseRole: courseRole || 'student',
          enrolledBy: auth.user!.id,
          timeStart: DateTime.now(),
          timeEnd: null,
          groupId: group?.id ?? null,
          addedBy: auth.user!.id,
        })

        enrolledUsers.push(user.fullName || user.email)
      } catch (error) {
        if (error instanceof AlreadyEnrolledException && user) {
          errors.push(`${user.fullName} est déjà inscrit`)
        } else if (error instanceof CapacityReachedException) {
          errors.push(`Capacité atteinte pour l'utilisateur ${userId}`)
        } else {
          errors.push(`Erreur pour l'utilisateur ${userId}`)
        }
      }
    }

    if (enrolledUsers.length > 0) {
      session.flash('success', `${enrolledUsers.length} utilisateur(s) inscrit(s) avec succès.`)
    }

    if (errors.length > 0) {
      session.flash('warning', `Erreurs: ${errors.join(', ')}`)
    }

    return response.redirect().back()
  }

  /**
   * Unenroll a user
   */
  async unenroll({ params, bouncer, response, session }: HttpContext) {
    const enrollment = await CourseEnrollment.query()
      .where('id', params.enrollmentId)
      .preload('course')
      .firstOrFail()

    // Self, `manage` on the course, or admin (A1: no unloaded `roles` access)
    await bouncer.with('EnrollmentPolicy').authorize('unenroll', enrollment)

    // Deletes the row and decrements course + method counters in one transaction
    await EnrollmentService.unenroll(enrollment)

    session.flash('success', 'Désinscription réussie.')

    return response.redirect().back()
  }
}
