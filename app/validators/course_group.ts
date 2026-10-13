import vine from '@vinejs/vine'

export const createGroupingValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
    description: vine.string().trim().maxLength(2000).optional().nullable(),
  })
)

export const createGroupValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
    description: vine.string().trim().maxLength(2000).optional().nullable(),
    groupingId: vine.number().positive().optional().nullable(),
    maxMembers: vine.number().positive().optional().nullable(),
    isVisibleToStudents: vine.boolean().optional(),
    enableGroupMessaging: vine.boolean().optional(),
  })
)
