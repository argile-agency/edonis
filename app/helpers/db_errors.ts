/**
 * True when `err` is a unique-constraint violation raised by any supported
 * engine:
 * - PostgreSQL: SQLSTATE `23505`
 * - MySQL / MariaDB: `ER_DUP_ENTRY` (errno 1062)
 * - SQLite (better-sqlite3): `SQLITE_CONSTRAINT_UNIQUE`, or the generic
 *   `SQLITE_CONSTRAINT` with a "UNIQUE constraint failed" message
 */
export function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('code' in err)) {
    return false
  }

  const code = err.code

  if (code === '23505' || code === 'ER_DUP_ENTRY' || code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return true
  }

  if ('errno' in err && err.errno === 1062) {
    return true
  }

  if (code === 'SQLITE_CONSTRAINT') {
    const message = 'message' in err && typeof err.message === 'string' ? err.message : ''
    return message.includes('UNIQUE')
  }

  return false
}
