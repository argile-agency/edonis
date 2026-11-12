import type { HttpContext } from '@adonisjs/core/http'

export const EDIT_MODE_KEY = 'editMode'

/**
 * Stored as `{ userId }` because session data survives `logout()` and
 * `regenerate()`: without the id, the next account on the browser would inherit it (D-21).
 */
export type EditModeState = { userId: number }

export function isEditModeOn(ctx: HttpContext): boolean {
  const raw: unknown = ctx.session.get(EDIT_MODE_KEY)
  if (typeof raw !== 'object' || raw === null) return false
  const userId = (raw as Record<string, unknown>).userId
  return typeof userId === 'number' && userId === ctx.auth?.user?.id
}
