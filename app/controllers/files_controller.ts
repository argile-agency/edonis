import type { HttpContext } from '@adonisjs/core/http'
import { normalize } from 'node:path'
import ContentFile from '#models/content_file'
import CourseEnrollment, { type EnrollmentStatus } from '#models/course_enrollment'
import type Course from '#models/course'
import type CourseContent from '#models/course_content'
import type User from '#models/user'
import FileStorageService, { PATH_TRAVERSAL_REGEX } from '#services/file_storage_service'

/** Enrollment statuses that grant access to a published course's material */
const ACCESS_ENROLLMENT_STATUSES: readonly EnrollmentStatus[] = ['active', 'completed']

export default class FilesController {
  /**
   * Download a content file by ID.
   * GET /files/:id/download
   *
   * Authorized when the user is an admin, or for at least one course
   * content referencing the file:
   * - the user is course staff (owner or course_permission >= view), or
   * - the course is published and the user is enrolled (active/completed),
   *   or the course is archived and the enrollment is completed, and the
   *   content, its module and every ancestor module are published and
   *   currently available. Draft courses are staff-only.
   * Files not linked to any content are admin-only.
   */
  async download({ params, response, auth }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isSafeInteger(id) || id <= 0) {
      return response.notFound({ message: 'File not found' })
    }

    const file = await ContentFile.find(id)
    if (!file) {
      return response.notFound({ message: 'File not found' })
    }

    if (!(await this.canDownload(auth.user!, file))) {
      return response.forbidden({ message: 'You do not have access to this file' })
    }

    // Security: prevent path traversal. The regex is a fast reject; resolvePath
    // additionally guarantees the result stays inside the storage root.
    const normalizedPath = normalize(file.storagePath)
    const storage = new FileStorageService()
    const fullPath = PATH_TRAVERSAL_REGEX.test(normalizedPath)
      ? null
      : storage.resolvePath(file.storagePath)

    if (!fullPath) {
      return response.badRequest({ message: 'Invalid file path' })
    }

    response.header('X-Content-Type-Options', 'nosniff')
    return response.attachment(fullPath, file.filename, 'attachment', true, () => [
      'File not found',
      404,
    ])
  }

  private async canDownload(user: User, file: ContentFile): Promise<boolean> {
    if (await user.hasRole('admin')) {
      return true
    }

    const contents = await file
      .related('contents')
      .query()
      .preload('module', (moduleQuery) => moduleQuery.preload('course'))

    for (const content of contents) {
      const course = content.module.course

      if (await course.hasPermission(user.id, 'view')) {
        return true
      }

      const allowedStatuses = this.learnerEnrollmentStatuses(course)
      if (allowedStatuses.length > 0 && (await this.isVisibleToLearners(content))) {
        const enrollment = await CourseEnrollment.query()
          .where('course_id', course.id)
          .where('user_id', user.id)
          .whereIn('status', allowedStatuses)
          .first()

        if (enrollment) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Enrollment statuses that grant learner access given the course status:
   * - published: active or completed enrollments
   * - archived: completed enrollments only (alumni keep their material)
   * - draft (or anything else): nobody but staff
   */
  private learnerEnrollmentStatuses(course: Course): EnrollmentStatus[] {
    if (course.isPublished()) {
      return [...ACCESS_ENROLLMENT_STATUSES]
    }
    if (course.isArchived()) {
      return ['completed']
    }
    return []
  }

  /**
   * Content is visible to learners when it is available and its module and
   * every ancestor module are available (an unpublished parent hides its
   * whole subtree, as in the learner player).
   */
  private async isVisibleToLearners(content: CourseContent): Promise<boolean> {
    return content.isAvailable() && (await content.module.isEffectivelyAvailable())
  }
}
