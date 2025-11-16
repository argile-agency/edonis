import vine from '@vinejs/vine'

/**
 * Validator for creating a new course
 */
export const createCourseValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(2).maxLength(20),
    title: vine.string().trim().minLength(3).maxLength(255),
    description: vine.string().trim().optional(),
    objectives: vine.string().trim().optional(),
    status: vine.enum(['draft', 'published', 'archived']).optional(),
    visibility: vine.enum(['public', 'private', 'unlisted']).optional(),
    maxStudents: vine.number().positive().optional(),
    allowEnrollment: vine.boolean().optional(),
    isFeatured: vine.boolean().optional(),
    startDate: vine.date({ formats: ['YYYY-MM-DD', 'ISO8601'] }).optional(),
    endDate: vine.date({ formats: ['YYYY-MM-DD', 'ISO8601'] }).optional(),
    thumbnailUrl: vine.string().url().optional(),
    coverImageUrl: vine.string().url().optional(),
    category: vine.string().trim().maxLength(100).optional(),
    level: vine.string().trim().maxLength(50).optional(),
    language: vine.string().trim().minLength(2).maxLength(10).optional(),
    estimatedHours: vine.number().positive().optional(),
    tags: vine.array(vine.string().trim()).optional(),
  })
)

/**
 * Validator for updating an existing course
 */
export const updateCourseValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(2).maxLength(20).optional(),
    title: vine.string().trim().minLength(3).maxLength(255).optional(),
    description: vine.string().trim().optional(),
    objectives: vine.string().trim().optional(),
    status: vine.enum(['draft', 'published', 'archived']).optional(),
    visibility: vine.enum(['public', 'private', 'unlisted']).optional(),
    maxStudents: vine.number().positive().optional(),
    allowEnrollment: vine.boolean().optional(),
    isFeatured: vine.boolean().optional(),
    startDate: vine.date({ formats: ['YYYY-MM-DD', 'ISO8601'] }).optional(),
    endDate: vine.date({ formats: ['YYYY-MM-DD', 'ISO8601'] }).optional(),
    thumbnailUrl: vine.string().url().optional(),
    coverImageUrl: vine.string().url().optional(),
    category: vine.string().trim().maxLength(100).optional(),
    level: vine.string().trim().maxLength(50).optional(),
    language: vine.string().trim().minLength(2).maxLength(10).optional(),
    estimatedHours: vine.number().positive().optional(),
    tags: vine.array(vine.string().trim()).optional(),
  })
)

/**
 * Validator for adding course permissions
 */
export const createCoursePermissionValidator = vine.compile(
  vine.object({
    userId: vine.number().positive(),
    permissionLevel: vine.enum(['view', 'edit', 'manage']),
    roleInCourse: vine.string().trim().maxLength(100).optional(),
  })
)
