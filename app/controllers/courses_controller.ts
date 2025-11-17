import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Course from '#models/course'
import CoursePermission from '#models/course_permission'
import CourseEnrollmentMethod from '#models/course_enrollment_method'
import CourseGroup from '#models/course_group'
import CourseGrouping from '#models/course_grouping'
import CourseCategory from '#models/course_category'
import CourseEnrollment from '#models/course_enrollment'
import User from '#models/user'
import {
  createCourseValidator,
  updateCourseValidator,
  createCoursePermissionValidator,
} from '#validators/course'

export default class CoursesController {
  /**
   * Display a list of courses
   */
  async index({ inertia, auth, request }: HttpContext) {
    const user = auth.user!
    const page = request.input('page', 1)
    const perPage = 15
    const status = request.input('status')
    const category = request.input('category')
    const search = request.input('search')

    const isAdmin = await user.hasRole('admin')
    const isInstructor = await user.hasRole('instructor')

    let query = Course.query().preload('instructor')

    // Filter based on user role
    if (!isAdmin) {
      if (isInstructor) {
        // Instructors see their courses and courses they have permissions for
        query = query.where((builder) => {
          builder.where('instructor_id', user.id).orWhereHas('permissions', (permQuery) => {
            permQuery.where('user_id', user.id)
          })
        })
      } else {
        // Students see only published public courses
        query = query.where('status', 'published').where('visibility', 'public')
      }
    }

    // Apply filters
    if (status) {
      query = query.where('status', status)
    }

    if (category) {
      query = query.where('category', category)
    }

    if (search) {
      query = query.where((builder) => {
        builder
          .whereILike('title', `%${search}%`)
          .orWhereILike('description', `%${search}%`)
          .orWhereILike('code', `%${search}%`)
      })
    }

    const courses = await query.orderBy('created_at', 'desc').paginate(page, perPage)

    return inertia.render('courses/index', {
      courses: courses.serialize(),
      filters: {
        status,
        category,
        search,
      },
    })
  }

  /**
   * Display the form for creating a new course
   */
  async create({ inertia }: HttpContext) {
    return inertia.render('courses/create')
  }

  /**
   * Handle the creation of a new course
   */
  async store({ request, response, auth, session }: HttpContext) {
    const user = auth.user!
    const payload = await request.validateUsing(createCourseValidator)

    const course = await Course.create({
      ...payload,
      startDate: payload.startDate ? DateTime.fromJSDate(payload.startDate) : null,
      endDate: payload.endDate ? DateTime.fromJSDate(payload.endDate) : null,
      instructorId: user.id,
    })

    session.flash('success', 'Course created successfully')
    return response.redirect().toRoute('courses.show', { id: course.id })
  }

  /**
   * Display a single course
   */
  async show({ inertia, params, auth, response }: HttpContext) {
    const user = auth.user!
    const course = await Course.query()
      .where('id', params.id)
      .preload('instructor')
      .preload('permissions', (query) => {
        query.preload('user')
      })
      .preload('modules', (moduleQuery) => {
        moduleQuery
          .whereNull('parent_id')
          .orderBy('order', 'asc')
          .preload('children', (childQuery) => {
            childQuery.orderBy('order', 'asc').preload('contents', (contentQuery) => {
              contentQuery.orderBy('order', 'asc')
            })
          })
          .preload('contents', (contentQuery) => {
            contentQuery.orderBy('order', 'asc')
          })
      })
      .firstOrFail()

    const isAdmin = await user.hasRole('admin')
    const canView = isAdmin || (await course.hasPermission(user.id, 'view'))

    if (!canView && course.visibility !== 'public') {
      return response.forbidden('You do not have permission to view this course')
    }

    const canEdit = isAdmin || (await course.hasPermission(user.id, 'edit'))
    const canManage = isAdmin || (await course.hasPermission(user.id, 'manage'))

    // Check if user is enrolled
    const enrollment = await CourseEnrollment.query()
      .where('course_id', course.id)
      .where('user_id', user.id)
      .first()

    return inertia.render('courses/show', {
      course: course.serialize(),
      modules: course.modules.map((m) => m.serialize()),
      permissions: {
        canEdit,
        canManage,
      },
      isEnrolled: !!enrollment,
    })
  }

  /**
   * Display the form for editing a course
   */
  async edit({ inertia, params, auth, response }: HttpContext) {
    const user = auth.user!
    const course = await Course.query().where('id', params.id).preload('instructor').firstOrFail()

    const isAdmin = await user.hasRole('admin')
    const canEdit = isAdmin || (await course.hasPermission(user.id, 'edit'))

    if (!canEdit) {
      return response.forbidden('You do not have permission to edit this course')
    }

    return inertia.render('courses/edit', {
      course: course.serialize(),
    })
  }

  /**
   * Handle the update of a course
   */
  async update({ request, response, params, auth, session }: HttpContext) {
    const user = auth.user!
    const course = await Course.findOrFail(params.id)

    const isAdmin = await user.hasRole('admin')
    const canEdit = isAdmin || (await course.hasPermission(user.id, 'edit'))

    if (!canEdit) {
      return response.forbidden('You do not have permission to edit this course')
    }

    const payload = await request.validateUsing(updateCourseValidator)
    await course
      .merge({
        ...payload,
        startDate: payload.startDate ? DateTime.fromJSDate(payload.startDate) : undefined,
        endDate: payload.endDate ? DateTime.fromJSDate(payload.endDate) : undefined,
      })
      .save()

    session.flash('success', 'Course updated successfully')
    return response.redirect().toRoute('courses.show', { id: course.id })
  }

  /**
   * Delete a course
   */
  async destroy({ params, response, auth, session }: HttpContext) {
    const user = auth.user!
    const course = await Course.findOrFail(params.id)

    const isAdmin = await user.hasRole('admin')
    const isOwner = await course.isInstructor(user.id)

    if (!isAdmin && !isOwner) {
      return response.forbidden('You do not have permission to delete this course')
    }

    await course.delete()

    session.flash('success', 'Course deleted successfully')
    return response.redirect().toRoute('courses.index')
  }

  /**
   * Publish a course
   */
  async publish({ params, response, auth, session }: HttpContext) {
    const user = auth.user!
    const course = await Course.findOrFail(params.id)

    const isAdmin = await user.hasRole('admin')
    const canManage = isAdmin || (await course.hasPermission(user.id, 'manage'))

    if (!canManage) {
      return response.forbidden('You do not have permission to publish this course')
    }

    await course.publish()

    session.flash('success', 'Course published successfully')
    return response.redirect().toRoute('courses.show', { id: course.id })
  }

  /**
   * Archive a course
   */
  async archive({ params, response, auth, session }: HttpContext) {
    const user = auth.user!
    const course = await Course.findOrFail(params.id)

    const isAdmin = await user.hasRole('admin')
    const canManage = isAdmin || (await course.hasPermission(user.id, 'manage'))

    if (!canManage) {
      return response.forbidden('You do not have permission to archive this course')
    }

    await course.archive()

    session.flash('success', 'Course archived successfully')
    return response.redirect().toRoute('courses.show', { id: course.id })
  }

  /**
   * Add a permission to a course (co-instructor, TA, etc.)
   */
  async addPermission({ request, response, params, auth, session }: HttpContext) {
    const user = auth.user!
    const course = await Course.findOrFail(params.id)

    const isAdmin = await user.hasRole('admin')
    const canManage = isAdmin || (await course.hasPermission(user.id, 'manage'))

    if (!canManage) {
      return response.forbidden('You do not have permission to manage course permissions')
    }

    const payload = await request.validateUsing(createCoursePermissionValidator)

    await CoursePermission.create({
      courseId: course.id,
      ...payload,
    })

    session.flash('success', 'Permission added successfully')
    return response.redirect().toRoute('courses.show', { id: course.id })
  }

  /**
   * Remove a permission from a course
   */
  async removePermission({ response, params, auth, session }: HttpContext) {
    const user = auth.user!
    const course = await Course.findOrFail(params.courseId)
    const permission = await CoursePermission.findOrFail(params.permissionId)

    const isAdmin = await user.hasRole('admin')
    const canManage = isAdmin || (await course.hasPermission(user.id, 'manage'))

    if (!canManage) {
      return response.forbidden('You do not have permission to manage course permissions')
    }

    await permission.delete()

    session.flash('success', 'Permission removed successfully')
    return response.redirect().toRoute('courses.show', { id: course.id })
  }

  /**
   * Display enrollment methods management page for a course
   */
  async manageEnrollmentMethods({ params, inertia, auth, response }: HttpContext) {
    const user = auth.user!
    const course = await Course.query()
      .where('id', params.id)
      .preload('enrollmentMethods', (query) => {
        query.orderBy('sort_order', 'asc')
      })
      .preload('groups', (query) => {
        query.preload('grouping')
      })
      .firstOrFail()

    const isAdmin = await user.hasRole('admin')
    const canManage = isAdmin || (await course.hasPermission(user.id, 'manage'))

    if (!canManage) {
      return response.forbidden('You do not have permission to manage enrollment methods')
    }

    return inertia.render('courses/enrollment-methods', {
      course: course.serialize(),
      enrollmentMethods: course.enrollmentMethods.map((m) => m.serialize()),
      groups: course.groups.map((g) => g.serialize()),
    })
  }

  /**
   * Create a new enrollment method for a course
   */
  async createEnrollmentMethod({ params, request, auth, response, session }: HttpContext) {
    const user = auth.user!
    const course = await Course.findOrFail(params.id)

    const isAdmin = await user.hasRole('admin')
    const canManage = isAdmin || (await course.hasPermission(user.id, 'manage'))

    if (!canManage) {
      return response.forbidden('You do not have permission to manage enrollment methods')
    }

    const data = request.only([
      'methodType',
      'name',
      'isEnabled',
      'sortOrder',
      'maxEnrollments',
      'defaultRole',
      'enrollmentStartDate',
      'enrollmentEndDate',
      'enrollmentDurationDays',
      'enrollmentKey',
      'keyCaseSensitive',
      'requiresApproval',
      'approvalMessage',
      'welcomeMessage',
      'autoAssignGroupId',
      'sendWelcomeEmail',
      'notifyInstructor',
    ])

    await CourseEnrollmentMethod.create({
      courseId: course.id,
      ...data,
    })

    session.flash('success', 'Enrollment method created successfully')
    return response.redirect().toRoute('courses.enrollment-methods.index', { id: course.id })
  }

  /**
   * Update an enrollment method
   */
  async updateEnrollmentMethod({ params, request, auth, response, session }: HttpContext) {
    const user = auth.user!
    const method = await CourseEnrollmentMethod.query()
      .where('id', params.methodId)
      .preload('course')
      .firstOrFail()

    const isAdmin = await user.hasRole('admin')
    const canManage = isAdmin || (await method.course.hasPermission(user.id, 'manage'))

    if (!canManage) {
      return response.forbidden('You do not have permission to manage enrollment methods')
    }

    const data = request.only([
      'name',
      'isEnabled',
      'sortOrder',
      'maxEnrollments',
      'defaultRole',
      'enrollmentStartDate',
      'enrollmentEndDate',
      'enrollmentDurationDays',
      'enrollmentKey',
      'keyCaseSensitive',
      'requiresApproval',
      'approvalMessage',
      'welcomeMessage',
      'autoAssignGroupId',
      'sendWelcomeEmail',
      'notifyInstructor',
    ])

    method.merge(data)
    await method.save()

    session.flash('success', 'Enrollment method updated successfully')
    return response.redirect().back()
  }

  /**
   * Delete an enrollment method
   */
  async deleteEnrollmentMethod({ params, auth, response, session }: HttpContext) {
    const user = auth.user!
    const method = await CourseEnrollmentMethod.query()
      .where('id', params.methodId)
      .preload('course')
      .firstOrFail()

    const isAdmin = await user.hasRole('admin')
    const canManage = isAdmin || (await method.course.hasPermission(user.id, 'manage'))

    if (!canManage) {
      return response.forbidden('You do not have permission to manage enrollment methods')
    }

    await method.delete()

    session.flash('success', 'Enrollment method deleted successfully')
    return response.redirect().back()
  }

  /**
   * Display groups management page for a course
   */
  async manageGroups({ params, inertia, auth, response }: HttpContext) {
    const user = auth.user!
    const course = await Course.query()
      .where('id', params.id)
      .preload('groupings', (query) => {
        query.preload('groups', (groupQuery) => {
          groupQuery.preload('members', (memberQuery) => {
            memberQuery.preload('user')
          })
        })
      })
      .preload('groups', (query) => {
        query.preload('grouping').preload('members', (memberQuery) => {
          memberQuery.preload('user')
        })
      })
      .firstOrFail()

    const isAdmin = await user.hasRole('admin')
    const canManage = isAdmin || (await course.hasPermission(user.id, 'manage'))

    if (!canManage) {
      return response.forbidden('You do not have permission to manage course groups')
    }

    return inertia.render('courses/groups', {
      course: course.serialize(),
      groupings: course.groupings.map((g) => g.serialize()),
      groups: course.groups.map((g) => g.serialize()),
    })
  }

  /**
   * Create a grouping
   */
  async createGrouping({ params, request, auth, response, session }: HttpContext) {
    const user = auth.user!
    const course = await Course.findOrFail(params.id)

    const isAdmin = await user.hasRole('admin')
    const canManage = isAdmin || (await course.hasPermission(user.id, 'manage'))

    if (!canManage) {
      return response.forbidden('You do not have permission to manage course groups')
    }

    const { name, description } = request.only(['name', 'description'])

    await CourseGrouping.create({
      courseId: course.id,
      name,
      description,
    })

    session.flash('success', 'Grouping created successfully')
    return response.redirect().back()
  }

  /**
   * Create a group
   */
  async createGroup({ params, request, auth, response, session }: HttpContext) {
    const user = auth.user!
    const course = await Course.findOrFail(params.id)

    const isAdmin = await user.hasRole('admin')
    const canManage = isAdmin || (await course.hasPermission(user.id, 'manage'))

    if (!canManage) {
      return response.forbidden('You do not have permission to manage course groups')
    }

    const { name, description, groupingId, maxMembers, isVisibleToStudents, enableGroupMessaging } =
      request.only([
        'name',
        'description',
        'groupingId',
        'maxMembers',
        'isVisibleToStudents',
        'enableGroupMessaging',
      ])

    await CourseGroup.create({
      courseId: course.id,
      name,
      description,
      groupingId: groupingId || null,
      maxMembers: maxMembers || null,
      isVisibleToStudents: isVisibleToStudents ?? true,
      enableGroupMessaging: enableGroupMessaging ?? true,
    })

    session.flash('success', 'Group created successfully')
    return response.redirect().back()
  }

  /**
   * Display course approval queue (admin only)
   */
  async approvalQueue({ inertia, auth, response }: HttpContext) {
    const user = auth.user!
    const isAdmin = await user.hasRole('admin')

    if (!isAdmin) {
      return response.forbidden('Only administrators can access the approval queue')
    }

    const pendingCourses = await Course.query()
      .where('approval_status', 'pending_approval')
      .preload('instructor')
      .preload('courseCategory')
      .orderBy('submitted_for_approval_at', 'desc')

    const approvedCourses = await Course.query()
      .where('approval_status', 'approved')
      .preload('instructor')
      .preload('courseCategory')
      .preload('approver')
      .orderBy('approved_at', 'desc')
      .limit(50)

    const rejectedCourses = await Course.query()
      .where('approval_status', 'rejected')
      .preload('instructor')
      .preload('courseCategory')
      .orderBy('approved_at', 'desc')
      .limit(50)

    return inertia.render('admin/courses/approval-queue', {
      pendingCourses: pendingCourses.map((c) => ({
        ...c.serialize(),
        instructor: {
          id: c.instructor.id,
          fullName: c.instructor.fullName,
          email: c.instructor.email,
        },
      })),
      approvedCourses: approvedCourses.map((c) => ({
        ...c.serialize(),
        instructor: {
          id: c.instructor.id,
          fullName: c.instructor.fullName,
          email: c.instructor.email,
        },
        approvedBy: c.approver ? { id: c.approver.id, fullName: c.approver.fullName } : undefined,
      })),
      rejectedCourses: rejectedCourses.map((c) => ({
        ...c.serialize(),
        instructor: {
          id: c.instructor.id,
          fullName: c.instructor.fullName,
          email: c.instructor.email,
        },
      })),
    })
  }

  /**
   * Approve a course
   */
  async approveCourse({ params, auth, response, session }: HttpContext) {
    const user = auth.user!
    const isAdmin = await user.hasRole('admin')

    if (!isAdmin) {
      return response.forbidden('Only administrators can approve courses')
    }

    const course = await Course.findOrFail(params.id)
    await course.approve(user.id)

    session.flash('success', 'Course approved successfully')
    return response.redirect().back()
  }

  /**
   * Reject a course
   */
  async rejectCourse({ params, request, auth, response, session }: HttpContext) {
    const user = auth.user!
    const isAdmin = await user.hasRole('admin')

    if (!isAdmin) {
      return response.forbidden('Only administrators can reject courses')
    }

    const { reason } = request.only(['reason'])
    const course = await Course.findOrFail(params.id)
    await course.reject(user.id, reason)

    session.flash('success', 'Course rejected')
    return response.redirect().back()
  }

  /**
   * Admin: List all courses for management
   */
  async adminIndex({ inertia, auth, response }: HttpContext) {
    const user = auth.user!
    const isAdmin = await user.hasRole('admin')

    if (!isAdmin) {
      return response.forbidden('Only administrators can access this page')
    }

    const courses = await Course.query()
      .preload('instructor')
      .preload('courseCategory')
      .orderBy('created_at', 'desc')

    const stats = {
      total: courses.length,
      published: courses.filter((c) => c.status === 'published').length,
      draft: courses.filter((c) => c.status === 'draft').length,
      archived: courses.filter((c) => c.status === 'archived').length,
    }

    return inertia.render('admin/courses/index', {
      courses: courses.map((c) => c.serialize()),
      stats,
    })
  }

  /**
   * Admin: Show course participants
   */
  async showParticipants({ params, inertia, auth, response }: HttpContext) {
    const user = auth.user!
    const isAdmin = await user.hasRole('admin')

    if (!isAdmin) {
      return response.forbidden('Only administrators can access this page')
    }

    const course = await Course.findOrFail(params.id)
    const enrollments = await CourseEnrollment.query()
      .where('course_id', course.id)
      .preload('user')
      .orderBy('enrolled_at', 'desc')

    // Get users not enrolled in this course
    const enrolledUserIds = enrollments.map((e) => e.userId)
    const availableUsers = await User.query().whereNotIn('id', enrolledUserIds)

    const stats = {
      total: enrollments.length,
      active: enrollments.filter((e) => e.status === 'active').length,
      completed: enrollments.filter((e) => e.status === 'completed').length,
      suspended: enrollments.filter((e) => e.status === 'suspended').length,
    }

    return inertia.render('admin/courses/participants', {
      course: {
        id: course.id,
        code: course.code,
        title: course.title,
      },
      enrollments: enrollments.map((e) => ({
        id: e.id,
        userId: e.userId,
        courseRole: e.courseRole,
        status: e.status,
        progressPercentage: e.progressPercentage,
        enrolledAt: e.enrolledAt.toISO(),
        user: {
          id: e.user.id,
          fullName: e.user.fullName,
          email: e.user.email,
        },
      })),
      availableUsers: availableUsers.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
      })),
      stats,
    })
  }

  /**
   * Admin: Add participant to course
   */
  async addParticipant({ params, request, auth, response, session }: HttpContext) {
    const user = auth.user!
    const isAdmin = await user.hasRole('admin')

    if (!isAdmin) {
      return response.forbidden('Only administrators can add participants')
    }

    const { userId, courseRole } = request.only(['userId', 'courseRole'])
    const course = await Course.findOrFail(params.id)

    await CourseEnrollment.create({
      courseId: course.id,
      userId: Number(userId),
      courseRole: courseRole || 'student',
      status: 'active',
      enrolledBy: user.id,
      enrolledAt: DateTime.now(),
    })

    // Update enrolled count
    course.enrolledCount += 1
    await course.save()

    session.flash('success', 'Participant added successfully')
    return response.redirect().back()
  }

  /**
   * Admin: Remove participant from course
   */
  async removeParticipant({ params, auth, response, session }: HttpContext) {
    const user = auth.user!
    const isAdmin = await user.hasRole('admin')

    if (!isAdmin) {
      return response.forbidden('Only administrators can remove participants')
    }

    const enrollment = await CourseEnrollment.query()
      .where('id', params.enrollmentId)
      .preload('course')
      .firstOrFail()

    await enrollment.delete()

    // Update enrolled count
    enrollment.course.enrolledCount = Math.max(0, enrollment.course.enrolledCount - 1)
    await enrollment.course.save()

    session.flash('success', 'Participant removed successfully')
    return response.redirect().back()
  }

  /**
   * Admin: Show course settings
   */
  async showSettings({ params, inertia, auth, response }: HttpContext) {
    const user = auth.user!
    const isAdmin = await user.hasRole('admin')

    if (!isAdmin) {
      return response.forbidden('Only administrators can access this page')
    }

    const course = await Course.findOrFail(params.id)
    const categories = await CourseCategory.query().orderBy('name', 'asc')

    return inertia.render('admin/courses/settings', {
      course: {
        ...course.serialize(),
        startDate: course.startDate?.toISODate() || null,
        endDate: course.endDate?.toISODate() || null,
      },
      categories: categories.map((c) => c.serialize()),
    })
  }

  /**
   * Admin: Update course settings
   */
  async updateSettings({ params, request, auth, response, session }: HttpContext) {
    const user = auth.user!
    const isAdmin = await user.hasRole('admin')

    if (!isAdmin) {
      return response.forbidden('Only administrators can update course settings')
    }

    const course = await Course.findOrFail(params.id)
    const payload = await request.validateUsing(updateCourseValidator)

    // Convert tags string to array if needed
    const tagsInput = request.input('tags')
    const tags =
      typeof tagsInput === 'string'
        ? tagsInput
            .split(',')
            .map((t: string) => t.trim())
            .filter((t: string) => t.length > 0)
        : payload.tags

    const data = {
      ...payload,
      startDate: payload.startDate ? DateTime.fromJSDate(payload.startDate) : undefined,
      endDate: payload.endDate ? DateTime.fromJSDate(payload.endDate) : undefined,
      tags,
    }

    await course.merge(data).save()

    session.flash('success', 'Course settings updated successfully')
    return response.redirect().back()
  }

  /**
   * Admin: Archive course
   */
  async archiveCourse({ params, auth, response, session }: HttpContext) {
    const user = auth.user!
    const isAdmin = await user.hasRole('admin')

    if (!isAdmin) {
      return response.forbidden('Only administrators can archive courses')
    }

    const course = await Course.findOrFail(params.id)
    await course.archive()

    session.flash('success', 'Course archived successfully')
    return response.redirect().back()
  }
}
