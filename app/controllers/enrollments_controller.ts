import type { HttpContext } from '@adonisjs/core/http'
import Course from '#models/course'
import CourseEnrollment from '#models/course_enrollment'
import CourseEnrollmentMethod from '#models/course_enrollment_method'
import CourseEnrollmentRequest from '#models/course_enrollment_request'
import User from '#models/user'
import { DateTime } from 'luxon'

export default class EnrollmentsController {
  /**
   * Display enrollment page for a course
   */
  async show({ params, auth, inertia }: HttpContext) {
    const course = await Course.query()
      .where('id', params.id)
      .preload('instructor')
      .preload('courseCategory')
      .preload('enrollmentMethods', (query) => {
        query.where('is_enabled', true).orderBy('sort_order', 'asc')
      })
      .firstOrFail()

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
      enrollmentMethods: await Promise.all(
        course.enrollmentMethods.map(async (method) => ({
          ...method.serialize(),
          isAvailable: method.isAvailable(),
        }))
      ),
      existingEnrollment: existingEnrollment?.serialize(),
      pendingRequest: pendingRequest?.serialize(),
    })
  }

  /**
   * Enroll with a key
   */
  async enrollWithKey({ request, auth, response, session }: HttpContext) {
    const { enrollmentKey, enrollmentMethodId } = request.only([
      'enrollmentKey',
      'enrollmentMethodId',
    ])

    const method = await CourseEnrollmentMethod.findOrFail(enrollmentMethodId)

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

    // Check if already enrolled
    const existingEnrollment = await CourseEnrollment.query()
      .where('course_id', method.courseId)
      .where('user_id', auth.user!.id)
      .first()

    if (existingEnrollment) {
      session.flash('error', 'Vous êtes déjà inscrit à ce cours.')
      return response.redirect().back()
    }

    // Calculate access period
    let timeStart = DateTime.now()
    let timeEnd = null

    if (method.enrollmentDurationDays) {
      timeEnd = DateTime.now().plus({ days: method.enrollmentDurationDays })
    }

    // Create enrollment
    await CourseEnrollment.create({
      courseId: method.courseId,
      userId: auth.user!.id,
      enrollmentMethodId: method.id,
      courseRole: method.defaultRole,
      status: 'active',
      timeStart,
      timeEnd,
      enrolledAt: DateTime.now(),
      enrolledBy: null, // Self-enrolled
    })

    // Auto-assign to group if configured
    if (method.autoAssignGroupId) {
      const CourseGroupMemberModule = await import('#models/course_group_member')
      const CourseGroupMember = CourseGroupMemberModule.default
      const CourseGroupModule = await import('#models/course_group')
      const group = await CourseGroupModule.default.findOrFail(method.autoAssignGroupId)

      if (group.canAddMembers()) {
        await CourseGroupMember.create({
          groupId: group.id,
          userId: auth.user!.id,
          joinedAt: DateTime.now(),
          addedBy: null,
        })

        group.currentMembers += 1
        await group.save()
      }
    }

    // Update enrollment count
    method.currentEnrollments += 1
    await method.save()

    const course = await Course.findOrFail(method.courseId)
    course.enrolledCount += 1
    await course.save()

    session.flash('success', 'Inscription réussie ! Bienvenue dans le cours.')

    return response.redirect().toRoute('courses.show', { id: method.courseId })
  }

  /**
   * Self-enroll (open enrollment)
   */
  async enrollSelf({ request, auth, response, session }: HttpContext) {
    const { enrollmentMethodId } = request.only(['enrollmentMethodId'])

    const method = await CourseEnrollmentMethod.findOrFail(enrollmentMethodId)

    // Validate method
    if (!method.isAvailable()) {
      session.flash('error', "Cette méthode d'inscription n'est plus disponible.")
      return response.redirect().back()
    }

    if (method.methodType !== 'self') {
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

    // Calculate access period
    let timeStart = DateTime.now()
    let timeEnd = null

    if (method.enrollmentDurationDays) {
      timeEnd = DateTime.now().plus({ days: method.enrollmentDurationDays })
    }

    // Create enrollment
    await CourseEnrollment.create({
      courseId: method.courseId,
      userId: auth.user!.id,
      enrollmentMethodId: method.id,
      courseRole: method.defaultRole,
      status: 'active',
      timeStart,
      timeEnd,
      enrolledAt: DateTime.now(),
      enrolledBy: null,
    })

    // Update counts
    method.currentEnrollments += 1
    await method.save()

    const course = await Course.findOrFail(method.courseId)
    course.enrolledCount += 1
    await course.save()

    session.flash('success', method.welcomeMessage || 'Inscription réussie !')

    return response.redirect().toRoute('courses.show', { id: method.courseId })
  }

  /**
   * Request enrollment (requires approval)
   */
  async requestEnrollment({ request, auth, response, session }: HttpContext) {
    const { enrollmentMethodId, requestMessage } = request.only([
      'enrollmentMethodId',
      'requestMessage',
    ])

    const method = await CourseEnrollmentMethod.findOrFail(enrollmentMethodId)

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
  async enrollManual({ params, request, auth, response, session }: HttpContext) {
    const course = await Course.findOrFail(params.id)

    // Check permissions
    const canManage = await course.hasPermission(auth.user!.id, 'manage')
    if (!canManage && !auth.user!.roles.some((r) => r.slug === 'admin')) {
      return response.forbidden("Vous n'avez pas la permission d'inscrire des utilisateurs.")
    }

    const { userIds, courseRole, enrollmentMethodId, groupId } = request.only([
      'userIds',
      'courseRole',
      'enrollmentMethodId',
      'groupId',
    ])

    const method = await CourseEnrollmentMethod.find(enrollmentMethodId)

    const enrolledUsers: string[] = []
    const errors: string[] = []

    for (const userId of userIds) {
      try {
        const user = await User.findOrFail(userId)

        // Check if already enrolled
        const existing = await CourseEnrollment.query()
          .where('course_id', course.id)
          .where('user_id', userId)
          .first()

        if (existing) {
          errors.push(`${user.fullName} est déjà inscrit`)
          continue
        }

        // Create enrollment
        await CourseEnrollment.create({
          courseId: course.id,
          userId: userId,
          enrollmentMethodId: method?.id || null,
          courseRole: courseRole || 'student',
          status: 'active',
          timeStart: DateTime.now(),
          timeEnd: null,
          enrolledAt: DateTime.now(),
          enrolledBy: auth.user!.id,
        })

        // Add to group if specified
        if (groupId) {
          const CourseGroupMemberModule = await import('#models/course_group_member')
          const CourseGroupMember = CourseGroupMemberModule.default
          const CourseGroupModule = await import('#models/course_group')
          const group = await CourseGroupModule.default.findOrFail(groupId)

          if (group.canAddMembers()) {
            await CourseGroupMember.create({
              groupId: group.id,
              userId: userId,
              joinedAt: DateTime.now(),
              addedBy: auth.user!.id,
            })

            group.currentMembers += 1
            await group.save()
          }
        }

        enrolledUsers.push(user.fullName || user.email)
      } catch (error) {
        errors.push(`Erreur pour l'utilisateur ${userId}`)
      }
    }

    // Update course enrolled count
    course.enrolledCount += enrolledUsers.length
    await course.save()

    if (method) {
      method.currentEnrollments += enrolledUsers.length
      await method.save()
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
  async unenroll({ params, auth, response, session }: HttpContext) {
    const enrollment = await CourseEnrollment.query()
      .where('id', params.enrollmentId)
      .preload('course')
      .firstOrFail()

    const course = enrollment.course

    // Check permissions (can unenroll self, or instructor/admin can unenroll others)
    const isSelf = enrollment.userId === auth.user!.id
    const canManage = await course.hasPermission(auth.user!.id, 'manage')
    const isAdmin = auth.user!.roles.some((r) => r.slug === 'admin')

    if (!isSelf && !canManage && !isAdmin) {
      return response.forbidden("Vous n'avez pas la permission de désinscrire cet utilisateur.")
    }

    await enrollment.delete()

    // Update counts
    course.enrolledCount = Math.max(0, course.enrolledCount - 1)
    await course.save()

    session.flash('success', 'Désinscription réussie.')

    return response.redirect().back()
  }
}
