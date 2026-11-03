import { DateTime } from 'luxon'

export type ShiftInput = { days?: number; from?: DateTime; to?: DateTime }

/** Shift in calendar days: `days` alone, or old start `from` → new start `to`; neither or both → null. */
export function shiftDays(input: ShiftInput): number | null {
  const hasDays = input.days !== undefined
  const hasAnchor = input.from !== undefined && input.to !== undefined
  if (hasDays && input.from === undefined && input.to === undefined) return input.days!
  if (!hasDays && hasAnchor) {
    return Math.round(input.to!.startOf('day').diff(input.from!.startOf('day'), 'days').days)
  }
  return null
}

/**
 * End of an availability window: a date-only value (local midnight) covers that
 * whole day, so it becomes 23:59:59 of it. Whole seconds: MySQL TIMESTAMP(0)
 * would round .999 up to the next day. Any other time is kept as sent.
 */
export function inclusiveEnd(value: DateTime): DateTime {
  if (!value.equals(value.startOf('day'))) return value
  return value.set({ hour: 23, minute: 59, second: 59, millisecond: 0 })
}

/** Moves `value` by `days` calendar days (wall-clock time kept across DST); null stays null. */
export function shiftDate(value: DateTime | null, days: number): DateTime | null {
  return value ? value.plus({ days }) : null
}
