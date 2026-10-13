import vine from '@vinejs/vine'

/**
 * Course roles accepted on manual enrolment (mirrors `CourseRole`)
 */
const COURSE_ROLES = [
  'instructor',
  'teaching_assistant',
  'non_editing_teacher',
  'student',
  'observer',
  'guest',
] as const

/**
 * Validator for enrolling with an enrolment key (V9)
 */
export const enrollWithKeyValidator = vine.compile(
  vine.object({
    enrollmentMethodId: vine.number().positive(),
    enrollmentKey: vine.string().trim().minLength(1).maxLength(100),
  })
)

/**
 * Validator for open self-enrolment (V10)
 */
export const enrollSelfValidator = vine.compile(
  vine.object({
    enrollmentMethodId: vine.number().positive(),
  })
)

/**
 * Validator for an enrolment request that needs approval (V11)
 */
export const requestEnrollmentValidator = vine.compile(
  vine.object({
    enrollmentMethodId: vine.number().positive(),
    requestMessage: vine.string().trim().maxLength(2000).optional().nullable(),
  })
)

/**
 * Validator for manual enrolment of other users by staff (V12)
 */
export const enrollManualValidator = vine.compile(
  vine.object({
    userIds: vine.array(vine.number().positive()).minLength(1).maxLength(500),
    courseRole: vine.enum(COURSE_ROLES).optional(),
    enrollmentMethodId: vine.number().positive().optional().nullable(),
    groupId: vine.number().positive().optional().nullable(),
  })
)
