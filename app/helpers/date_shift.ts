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

/** Moves `value` by `days` calendar days (wall-clock time kept across DST); null stays null. */
export function shiftDate(value: DateTime | null, days: number): DateTime | null {
  return value ? value.plus({ days }) : null
}
