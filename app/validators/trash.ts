import vine from '@vinejs/vine'

const kind = () => vine.enum(['section', 'content'] as const)
const id = () => vine.number().positive().withoutDecimals()

/** One trash row; `withSection` or `moduleId` answer a content whose section is trashed (D-05). */
export const restoreValidator = vine.compile(
  vine.object({
    kind: kind(),
    id: id(),
    withSection: vine.boolean().optional(),
    moduleId: id().optional(),
  })
)

/** The builder undo: every root of one trash batch. */
export const restoreBatchValidator = vine.compile(vine.object({ batch: vine.string().uuid() }))

export const trashItemValidator = vine.compile(vine.object({ kind: kind(), id: id() }))
