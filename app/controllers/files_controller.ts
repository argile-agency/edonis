import type { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'
import { extname, normalize } from 'node:path'
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
      throw new Exception('File not found', { status: 404, code: 'E_FILE_NOT_FOUND' })
    }

    const file = await ContentFile.find(id)
    if (!file) {
      throw new Exception('File not found', { status: 404, code: 'E_FILE_NOT_FOUND' })
    }

    // The download name is the one attached to the content that grants access
    const filename = await this.authorizedFilename(auth.user!, file)
    if (filename === null) {
      // Thrown so the exception handler renders the 403 page for browsers
      throw new Exception('You do not have access to this file', {
        status: 403,
        code: 'E_FILE_ACCESS_DENIED',
      })
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
    return response.attachment(fullPath, filename, 'attachment', true, () => [
      'File not found',
      404,
    ])
  }

  /**
   * Returns the download filename when the user may download the file, or
   * null when access is denied. The filename comes from the pivot row of the
   * first content (by id) that grants access, so a user only ever sees the
   * name used in a course they can access, never another course's name.
   */
  private async authorizedFilename(user: User, file: ContentFile): Promise<string | null> {
    const contents = await file
      .related('contents')
      .query()
      .preload('module', (moduleQuery) => moduleQuery.preload('course'))
      .orderBy('course_contents.id', 'asc')

    if (await user.hasRole('admin')) {
      return contents.length > 0
        ? this.pivotFilename(contents[0], file)
        : this.fallbackFilename(file)
    }

    // Per-course memo: several contents of one course may share the file
    const staffByCourse = new Map<number, boolean>()
    const enrolledByCourse = new Map<number, boolean>()

    for (const content of contents) {
      const course = content.module.course

      if (!staffByCourse.has(course.id)) {
        staffByCourse.set(course.id, await course.hasPermission(user.id, 'view'))
      }
      if (staffByCourse.get(course.id)) {
        return this.pivotFilename(content, file)
      }

      const allowedStatuses = this.learnerEnrollmentStatuses(course)
      if (allowedStatuses.length === 0 || !(await this.isVisibleToLearners(content))) {
        continue
      }

      if (!enrolledByCourse.has(course.id)) {
        const enrollment = await CourseEnrollment.query()
          .where('course_id', course.id)
          .where('user_id', user.id)
          .whereIn('status', allowedStatuses)
          .first()
        enrolledByCourse.set(course.id, enrollment !== null)
      }
      if (enrolledByCourse.get(course.id)) {
        return this.pivotFilename(content, file)
      }
    }

    return null
  }

  private pivotFilename(content: CourseContent, file: ContentFile): string {
    const name: unknown = content.$extras.pivot_filename
    return typeof name === 'string' && name.length > 0 ? name : this.fallbackFilename(file)
  }

  /** Name for files with no attachment metadata (orphans, admin-only) */
  private fallbackFilename(file: ContentFile): string {
    return `file-${file.id}${extname(file.storagePath)}`
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
