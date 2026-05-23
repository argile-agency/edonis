/**
 * Shared prepare/consume configuration for JSON/JSONB model columns.
 *
 * Handles the difference between database engines:
 * - PostgreSQL JSONB returns parsed JavaScript objects
 * - MySQL JSON returns strings
 * - SQLite TEXT returns strings
 */
export const jsonColumnConfig = {
  prepare: (value: any) => (value != null ? JSON.stringify(value) : null),
  consume: (value: any) => {
    if (value == null) return null
    if (typeof value === 'object') return value
    return JSON.parse(value)
  },
}
