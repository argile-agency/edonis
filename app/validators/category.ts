import vine from '@vinejs/vine'

/**
 * Validator for creating a course category
 */
export const createCategoryValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(255),
    slug: vine.string().trim().minLength(2).maxLength(255),
    description: vine.string().trim().optional(),
    parentId: vine.number().optional(),
    sortOrder: vine.number().optional(),
    isVisible: vine.boolean().optional(),
    icon: vine.string().trim().optional(),
    color: vine.string().trim().optional(),
  })
)

/**
 * Validator for updating a course category
 */
export const updateCategoryValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(255).optional(),
    slug: vine.string().trim().minLength(2).maxLength(255).optional(),
    description: vine.string().trim().optional(),
    parentId: vine.number().optional().nullable(),
    sortOrder: vine.number().optional(),
    isVisible: vine.boolean().optional(),
    icon: vine.string().trim().optional(),
    color: vine.string().trim().optional(),
  })
)

/**
 * Validator for reordering categories: the array index becomes `sortOrder`.
 */
export const reorderCategoriesValidator = vine.compile(
  vine.object({
    categoryIds: vine.array(vine.number().positive()).minLength(1).maxLength(1000),
  })
)
