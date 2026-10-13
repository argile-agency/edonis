import vine from '@vinejs/vine'

/**
 * Query string of the course listing (`GET /courses`).
 *
 * The listing page sends empty strings for "no filter" (`?search=&status=&category=`)
 * and query-string values are never converted to null, so `''` is an accepted
 * value for `status` and `category`.
 */
export const courseIndexQueryValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    status: vine.enum(['', 'all', 'draft', 'published', 'archived']).optional().nullable(),
    category: vine
      .string()
      .trim()
      .regex(/^(all|\d+)?$/)
      .optional()
      .nullable(),
    search: vine.string().trim().maxLength(100).optional().nullable(),
  })
)

/**
 * Admin rejection of a course awaiting approval. The approval-queue dialog
 * cannot submit without a reason, so the reason is required.
 */
export const rejectCourseValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().minLength(1).maxLength(2000),
  })
)

/**
 * Admin enrolment of a user into a course from the participants page. An
 * unknown user id is a validation error, not a foreign-key 500.
 */
export const addParticipantValidator = vine.compile(
  vine.object({
    userId: vine.number().positive().exists({ table: 'users', column: 'id' }),
    courseRole: vine
      .enum([
        'instructor',
        'teaching_assistant',
        'non_editing_teacher',
        'student',
        'observer',
        'guest',
      ])
      .optional(),
  })
)
