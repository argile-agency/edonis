import vine from '@vinejs/vine'

/**
 * Fields shared by enrollment-method creation and update. Bounds follow the
 * `course_enrollment_methods` columns (varchar(255) name, varchar(100) key,
 * unsigned counters).
 */
const enrollmentMethodFields = {
  name: vine.string().trim().maxLength(255).optional().nullable(),
  isEnabled: vine.boolean().optional(),
  sortOrder: vine.number().min(0).optional(),
  maxEnrollments: vine.number().positive().optional().nullable(),
  defaultRole: vine
    .enum([
      'instructor',
      'teaching_assistant',
      'non_editing_teacher',
      'student',
      'observer',
      'guest',
    ])
    .optional(),
  enrollmentStartDate: vine
    .date({ formats: ['YYYY-MM-DD', 'ISO8601'] })
    .optional()
    .nullable(),
  enrollmentEndDate: vine
    .date({ formats: ['YYYY-MM-DD', 'ISO8601'] })
    .optional()
    .nullable(),
  enrollmentDurationDays: vine.number().positive().optional().nullable(),
  enrollmentKey: vine.string().trim().maxLength(100).optional().nullable(),
  keyCaseSensitive: vine.boolean().optional(),
  requiresApproval: vine.boolean().optional(),
  sendWelcomeEmail: vine.boolean().optional(),
  notifyInstructor: vine.boolean().optional(),
  approvalMessage: vine.string().trim().maxLength(2000).optional().nullable(),
  welcomeMessage: vine.string().trim().maxLength(2000).optional().nullable(),
  autoAssignGroupId: vine.number().positive().optional().nullable(),
}

export const createEnrollmentMethodValidator = vine.compile(
  vine.object({
    methodType: vine.enum(['manual', 'self', 'key', 'approval', 'bulk', 'cohort']),
    ...enrollmentMethodFields,
  })
)

/**
 * The method type is fixed once created, so updates do not accept it.
 */
export const updateEnrollmentMethodValidator = vine.compile(
  vine.object({
    ...enrollmentMethodFields,
  })
)
