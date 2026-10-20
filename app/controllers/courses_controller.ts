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
import {
  courseIndexQueryValidator,
  rejectCourseValidator,
  addParticipantValidator,
} from '#validators/course_admin'
import {
  createEnrollmentMethodValidator,
  updateEnrollmentMethodValidator,
} from '#validators/enrollment_method'
import { createGroupingValidator, createGroupValidator } from '#validators/course_group'
import { scopeVisibleCourses } from '#policies/course_policy'
import EnrollmentService from '#services/enrollment_service'
import AlreadyEnrolledException from '#exceptions/already_enrolled_exception'

/**
 * Validated date → DateTime. `undefined` (field absent) stays `undefined` and
 * `null` (field cleared) stays `null`.
 */
function toDateTime(value: Date | null | undefined): DateTime | null | undefined {
  if (value === undefined || value === null) return value
  return DateTime.fromJSDate(value)
}

/**
 * Drops keys whose value is `undefined`, so absent fields are never written.
 */
function omitUndefined<T extends Record<string, unknown>>(values: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined)
  ) as Partial<T>
}

/**
 * True when no group is referenced, or when the referenced group belongs to
 * the given course.
 */
async function isGroupOfCourse(
  groupId: number | null | undefined,
  courseId: number
): Promise<boolean> {
  if (!groupId) return true
  const group = await CourseGroup.query().where('id', groupId).where('course_id', courseId).first()
  return group !== null
}

export default class CoursesController {
  /**
   * Display a list of courses
   */
  async index({ inertia, auth, request }: HttpContext) {
    const user = auth.user!
    const filters = await request.validateUsing(courseIndexQueryValidator)
    const page = filters.page ?? 1
    const perPage = 15
    const status = filters.status ?? undefined
    const category = filters.category ?? undefined
    const search = filters.search ?? undefined

    const query = Course.query().preload('instructor')

    // Restrict to the courses this user may see (mutates `query` in place)
    await scopeVisibleCourses(query, user)

    // Apply filters
    if (status && status !== 'all') {
      query.where('status', status)
    }

    if (category && /^\d+$/.test(category)) {
      query.where('category_id', Number(category))
    }

    if (search) {
      query.where((builder) => {
        builder
          .whereILike('title', `%${search}%`)
          .orWhereILike('description', `%${search}%`)
          .orWhereILike('code', `%${search}%`)
      })
    }

    const courses = await query.orderBy('created_at', 'desc').paginate(page, perPage)

    // Get all categories for filter dropdown
    const categories = await CourseCategory.query().orderBy('name', 'asc')

    return inertia.render('courses/index', {
      courses: courses.serialize(),
      categories: categories.map((cat) => cat.serialize()),
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
    const categories = await CourseCategory.query().orderBy('name', 'asc')

    return inertia.render('courses/create', {
      categories: categories.map((cat) => ({ id: cat.id, name: cat.name })),
    })
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
  async show({ inertia, params, auth, bouncer }: HttpContext) {
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

    await bouncer.with('CoursePolicy').authorize('view', course)

    const canEdit = await bouncer.with('CoursePolicy').allows('edit', course)
    const canManage = await bouncer.with('CoursePolicy').allows('manage', course)

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
  async edit({ inertia, params, bouncer }: HttpContext) {
    const course = await Course.query().where('id', params.id).preload('instructor').firstOrFail()

    await bouncer.with('CoursePolicy').authorize('edit', course)

    const categories = await CourseCategory.query().orderBy('name', 'asc')

    return inertia.render('courses/edit', {
      course: course.serialize(),
      categories: categories.map((cat) => ({ id: cat.id, name: cat.name })),
    })
  }

  /**
   * Handle the update of a course
   */
  async update({ request, response, params, bouncer, session }: HttpContext) {
    const course = await Course.findOrFail(params.id)

    await bouncer.with('CoursePolicy').authorize('edit', course)

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
  async destroy({ params, response, bouncer, session }: HttpContext) {
    const course = await Course.findOrFail(params.id)

    await bouncer.with('CoursePolicy').authorize('delete', course)

    await course.delete()

    session.flash('success', 'Course deleted successfully')
    return response.redirect().toRoute('courses.index')
  }

  /**
   * Publish a course
   */
  async publish({ params, response, bouncer, session }: HttpContext) {
    const course = await Course.findOrFail(params.id)

    await bouncer.with('CoursePolicy').authorize('manage', course)

    await course.publish()

    session.flash('success', 'Course published successfully')
    return response.redirect().toRoute('courses.show', { id: course.id })
  }

  /**
   * Archive a course
   */
  async archive({ params, response, bouncer, session }: HttpContext) {
    const course = await Course.findOrFail(params.id)

    await bouncer.with('CoursePolicy').authorize('manage', course)

    await course.archive()

    session.flash('success', 'Course archived successfully')
    return response.redirect().toRoute('courses.show', { id: course.id })
  }

  /**
   * Add a permission to a course (co-instructor, TA, etc.)
   */
  async addPermission({ request, response, params, bouncer, session }: HttpContext) {
    const course = await Course.findOrFail(params.id)

    await bouncer.with('CoursePolicy').authorize('manage', course)

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
  async removePermission({ response, params, bouncer, session }: HttpContext) {
    const course = await Course.findOrFail(params.courseId)

    await bouncer.with('CoursePolicy').authorize('manage', course)

    // Scope to the authorized course: a permission row of another course is a 404
    const permission = await CoursePermission.query()
      .where('id', params.permissionId)
      .where('course_id', course.id)
      .firstOrFail()

    await permission.delete()

    session.flash('success', 'Permission removed successfully')
    return response.redirect().toRoute('courses.show', { id: course.id })
  }

  /**
   * Display enrollment methods management page for a course
   */
  async manageEnrollmentMethods({ params, inertia, bouncer }: HttpContext) {
    const course = await Course.query()
      .where('id', params.id)
      .preload('enrollmentMethods', (query) => {
        query.orderBy('sort_order', 'asc')
      })
      .preload('groups', (query) => {
        query.preload('grouping')
      })
      .firstOrFail()

    await bouncer.with('CoursePolicy').authorize('manage', course)

    return inertia.render('courses/enrollment-methods', {
      course: course.serialize(),
      enrollmentMethods: course.enrollmentMethods.map((m) => m.serialize()),
      groups: course.groups.map((g) => g.serialize()),
    })
  }

  /**
   * Create a new enrollment method for a course
   */
  async createEnrollmentMethod({ params, request, bouncer, response, session }: HttpContext) {
    const course = await Course.findOrFail(params.id)

    await bouncer.with('CoursePolicy').authorize('manage', course)

    const payload = await request.validateUsing(createEnrollmentMethodValidator)

    // The auto-assign group must belong to this course (A9)
    if (!(await isGroupOfCourse(payload.autoAssignGroupId, course.id))) {
      session.flash('error', 'Groupe invalide pour ce cours.')
      return response.redirect().back()
    }

    const { enrollmentStartDate, enrollmentEndDate, ...fields } = payload

    await CourseEnrollmentMethod.create(
      omitUndefined({
        ...fields,
        courseId: course.id,
        enrollmentStartDate: toDateTime(enrollmentStartDate),
        enrollmentEndDate: toDateTime(enrollmentEndDate),
      })
    )

    session.flash('success', 'Enrollment method created successfully')
    return response.redirect().toRoute('courses.enrollment-methods.index', { id: course.id })
  }

  /**
   * Update an enrollment method
   */
  async updateEnrollmentMethod({ params, request, bouncer, response, session }: HttpContext) {
    const method = await CourseEnrollmentMethod.query()
      .where('id', params.methodId)
      .preload('course')
      .firstOrFail()

    await bouncer.with('CoursePolicy').authorize('manage', method.course)

    const payload = await request.validateUsing(updateEnrollmentMethodValidator)

    // The auto-assign group must belong to the method's own course (A9)
    if (!(await isGroupOfCourse(payload.autoAssignGroupId, method.courseId))) {
      session.flash('error', 'Groupe invalide pour ce cours.')
      return response.redirect().back()
    }

    const { enrollmentStartDate, enrollmentEndDate, ...fields } = payload

    // Absent fields are left untouched; an explicit null clears the column
    method.merge(
      omitUndefined({
        ...fields,
        enrollmentStartDate: toDateTime(enrollmentStartDate),
        enrollmentEndDate: toDateTime(enrollmentEndDate),
      })
    )
    await method.save()

    session.flash('success', 'Enrollment method updated successfully')
    return response.redirect().back()
  }

  /**
   * Delete an enrollment method
   */
  async deleteEnrollmentMethod({ params, bouncer, response, session }: HttpContext) {
    const method = await CourseEnrollmentMethod.query()
      .where('id', params.methodId)
      .preload('course')
      .firstOrFail()

    await bouncer.with('CoursePolicy').authorize('manage', method.course)

    await method.delete()

    session.flash('success', 'Enrollment method deleted successfully')
    return response.redirect().back()
  }

  /**
   * Display groups management page for a course
   */
  async manageGroups({ params, inertia, bouncer }: HttpContext) {
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

    await bouncer.with('CoursePolicy').authorize('manage', course)

    return inertia.render('courses/groups', {
      course: course.serialize(),
      groupings: course.groupings.map((g) => g.serialize()),
      groups: course.groups.map((g) => g.serialize()),
    })
  }

  /**
   * Create a grouping
   */
  async createGrouping({ params, request, bouncer, response, session }: HttpContext) {
    const course = await Course.findOrFail(params.id)

    await bouncer.with('CoursePolicy').authorize('manage', course)

    const { name, description } = await request.validateUsing(createGroupingValidator)

    await CourseGrouping.create({
      courseId: course.id,
      name,
      description: description ?? null,
    })

    session.flash('success', 'Grouping created successfully')
    return response.redirect().back()
  }

  /**
   * Create a group
   */
  async createGroup({ params, request, bouncer, response, session }: HttpContext) {
    const course = await Course.findOrFail(params.id)

    await bouncer.with('CoursePolicy').authorize('manage', course)

    const { name, description, groupingId, maxMembers, isVisibleToStudents, enableGroupMessaging } =
      await request.validateUsing(createGroupValidator)

    // The grouping must belong to this course (A9)
    if (groupingId) {
      const grouping = await CourseGrouping.query()
        .where('id', groupingId)
        .where('course_id', course.id)
        .first()

      if (!grouping) {
        session.flash('error', 'Regroupement invalide pour ce cours.')
        return response.redirect().back()
      }
    }

    await CourseGroup.create({
      courseId: course.id,
      name,
      description: description ?? null,
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
  async approvalQueue({ inertia, bouncer }: HttpContext) {
    await bouncer.with('CoursePolicy').authorize('administer')

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
  async approveCourse({ params, auth, bouncer, response, session }: HttpContext) {
    const user = auth.user!
    await bouncer.with('CoursePolicy').authorize('administer')

    const course = await Course.findOrFail(params.id)
    await course.approve(user.id)

    session.flash('success', 'Course approved successfully')
    return response.redirect().back()
  }

  /**
   * Reject a course
   */
  async rejectCourse({ params, request, auth, bouncer, response, session }: HttpContext) {
    const user = auth.user!
    await bouncer.with('CoursePolicy').authorize('administer')

    const { reason } = await request.validateUsing(rejectCourseValidator)
    const course = await Course.findOrFail(params.id)
    await course.reject(user.id, reason)

    session.flash('success', 'Course rejected')
    return response.redirect().back()
  }

  /**
   * Admin: List all courses for management
   */
  async adminIndex({ inertia, bouncer }: HttpContext) {
    await bouncer.with('CoursePolicy').authorize('administer')

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
  async showParticipants({ params, inertia, bouncer }: HttpContext) {
    await bouncer.with('CoursePolicy').authorize('administer')

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
  async addParticipant({ params, request, auth, bouncer, response, session }: HttpContext) {
    const user = auth.user!
    await bouncer.with('CoursePolicy').authorize('administer')

    const payload = await request.validateUsing(addParticipantValidator)
    const course = await Course.findOrFail(params.id)

    // Counters move only through EnrollmentService (DEBT-06)
    try {
      await EnrollmentService.enroll({
        courseId: course.id,
        userId: payload.userId,
        methodId: null,
        courseRole: payload.courseRole ?? 'student',
        enrolledBy: user.id,
      })
    } catch (error) {
      if (error instanceof AlreadyEnrolledException) {
        session.flash('error', 'Cet utilisateur est déjà inscrit à ce cours.')
        return response.redirect().back()
      }
      throw error
    }

    session.flash('success', 'Participant added successfully')
    return response.redirect().back()
  }

  /**
   * Admin: Remove participant from course
   */
  async removeParticipant({ params, bouncer, response, session }: HttpContext) {
    await bouncer.with('CoursePolicy').authorize('administer')

    const enrollment = await CourseEnrollment.query()
      .where('id', params.enrollmentId)
      .where('course_id', params.id)
      .firstOrFail()

    await EnrollmentService.unenroll(enrollment)

    session.flash('success', 'Participant removed successfully')
    return response.redirect().back()
  }

  /**
   * Admin: Show course settings
   */
  async showSettings({ params, inertia, bouncer }: HttpContext) {
    await bouncer.with('CoursePolicy').authorize('administer')

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
  async updateSettings({ params, request, bouncer, response, session }: HttpContext) {
    await bouncer.with('CoursePolicy').authorize('administer')

    const course = await Course.findOrFail(params.id)
    // The settings form splits its comma-separated tags into an array before submit
    const payload = await request.validateUsing(updateCourseValidator)

    const data = {
      ...payload,
      startDate: payload.startDate ? DateTime.fromJSDate(payload.startDate) : undefined,
      endDate: payload.endDate ? DateTime.fromJSDate(payload.endDate) : undefined,
    }

    await course.merge(data).save()

    session.flash('success', 'Course settings updated successfully')
    return response.redirect().back()
  }

  /**
   * Admin: Archive course
   */
  async archiveCourse({ params, bouncer, response, session }: HttpContext) {
    await bouncer.with('CoursePolicy').authorize('administer')

    const course = await Course.findOrFail(params.id)
    await course.archive()

    session.flash('success', 'Course archived successfully')
    return response.redirect().back()
  }
}
