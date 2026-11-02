import vine from '@vinejs/vine'

/**
 * Builder bulk actions. Every action takes the selected items with their
 * conflict tokens; 1000 bounds the work of one request (T-05-36).
 */
export const bulkItemsSchema = vine
  .array(
    vine.object({
      kind: vine.enum(['section', 'content'] as const),
      id: vine.number().positive().withoutDecimals(),
      updatedAt: vine.string().nullable(),
    })
  )
  .minLength(1)
  .maxLength(1000)

export const bulkPublishValidator = vine.compile(
  vine.object({ items: bulkItemsSchema.clone(), isPublished: vine.boolean() })
)

/** Both keys required; null clears the date. */
export const bulkAvailabilityValidator = vine.compile(
  vine.object({
    items: bulkItemsSchema.clone(),
    availableFrom: vine.date().nullable(),
    availableUntil: vine.date().nullable(),
  })
)

/** Either `days` or `from` + `to` (old start → new start); the controller refuses neither or both. */
export const bulkShiftValidator = vine.compile(
  vine.object({
    items: bulkItemsSchema.clone(),
    days: vine.number().withoutDecimals().range([-3650, 3650]).optional(),
    from: vine.date().optional(),
    to: vine.date().optional(),
  })
)

/** `parentId` null = course root (sections only). */
export const bulkMoveValidator = vine.compile(
  vine.object({ items: bulkItemsSchema.clone(), parentId: vine.number().positive().nullable() })
)

export const bulkDuplicateValidator = vine.compile(vine.object({ items: bulkItemsSchema.clone() }))

export const bulkDeleteValidator = vine.compile(vine.object({ items: bulkItemsSchema.clone() }))
