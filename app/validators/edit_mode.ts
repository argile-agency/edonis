import vine from '@vinejs/vine'

/** `from` is an enum, never a URL: the controller maps it to a named route. */
export const editModeValidator = vine.compile(
  vine.object({
    enabled: vine.boolean(),
    courseId: vine.number().positive().withoutDecimals(),
    from: vine.enum(['show', 'learn', 'builder'] as const),
  })
)
