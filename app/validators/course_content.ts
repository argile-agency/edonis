import vine from '@vinejs/vine'

// Module validators
export const createModuleValidator = vine.compile(
  vine.object({
    courseId: vine.number(),
    parentId: vine.number().optional(),
    title: vine.string().trim().minLength(1).maxLength(255),
    description: vine.string().trim().optional(),
    order: vine.number().optional(),
    isPublished: vine.boolean().optional(),
    availableFrom: vine.date().optional(),
    availableUntil: vine.date().optional(),
    requirePreviousCompletion: vine.boolean().optional(),
    estimatedTime: vine.number().optional(),
  })
)

export const updateModuleValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(255).optional(),
    description: vine.string().trim().optional(),
    order: vine.number().optional(),
    isPublished: vine.boolean().optional(),
    availableFrom: vine.date().optional(),
    availableUntil: vine.date().optional(),
    requirePreviousCompletion: vine.boolean().optional(),
    estimatedTime: vine.number().optional(),
    parentId: vine.number().optional(),
  })
)

// Content validators
export const createContentValidator = vine.compile(
  vine.object({
    moduleId: vine.number(),
    contentType: vine.enum(['page', 'file', 'video', 'link', 'assignment', 'quiz']),
    title: vine.string().trim().minLength(1).maxLength(255),
    description: vine.string().trim().optional(),
    content: vine.string().optional(),
    fileUrl: vine.string().trim().url().maxLength(500).optional(),
    fileName: vine.string().trim().maxLength(255).optional(),
    fileSize: vine.number().optional(),
    fileType: vine.string().trim().maxLength(100).optional(),
    externalUrl: vine.string().trim().url().maxLength(500).optional(),
    metadata: vine.object({}).optional(),
    order: vine.number().optional(),
    isPublished: vine.boolean().optional(),
    availableFrom: vine.date().optional(),
    availableUntil: vine.date().optional(),
    completionRequired: vine.boolean().optional(),
    completionType: vine.enum(['manual', 'view', 'submit', 'grade']).optional(),
    minTimeRequired: vine.number().optional(),
    maxPoints: vine.number().optional(),
    dueDate: vine.date().optional(),
    allowLateSubmissions: vine.boolean().optional(),
    latePenaltyPercent: vine.number().min(0).max(100).optional(),
    estimatedTime: vine.number().optional(),
  })
)

export const updateContentValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(255).optional(),
    description: vine.string().trim().optional(),
    content: vine.string().optional(),
    fileUrl: vine.string().trim().url().maxLength(500).optional(),
    fileName: vine.string().trim().maxLength(255).optional(),
    fileSize: vine.number().optional(),
    fileType: vine.string().trim().maxLength(100).optional(),
    externalUrl: vine.string().trim().url().maxLength(500).optional(),
    metadata: vine.object({}).optional(),
    order: vine.number().optional(),
    isPublished: vine.boolean().optional(),
    availableFrom: vine.date().optional(),
    availableUntil: vine.date().optional(),
    completionRequired: vine.boolean().optional(),
    completionType: vine.enum(['manual', 'view', 'submit', 'grade']).optional(),
    minTimeRequired: vine.number().optional(),
    maxPoints: vine.number().optional(),
    dueDate: vine.date().optional(),
    allowLateSubmissions: vine.boolean().optional(),
    latePenaltyPercent: vine.number().min(0).max(100).optional(),
    estimatedTime: vine.number().optional(),
  })
)

// Reorder validators
export const reorderModulesValidator = vine.compile(
  vine.object({
    modules: vine.array(
      vine.object({
        id: vine.number(),
        order: vine.number(),
      })
    ),
  })
)

export const reorderContentsValidator = vine.compile(
  vine.object({
    contents: vine.array(
      vine.object({
        id: vine.number(),
        order: vine.number(),
      })
    ),
  })
)

// Progress validators
export const updateProgressValidator = vine.compile(
  vine.object({
    status: vine.enum(['not_started', 'in_progress', 'completed']).optional(),
    timeSpent: vine.number().optional(),
  })
)
