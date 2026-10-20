/**
 * Pending two-factor login state.
 *
 * Once the password is verified for a user with 2FA enabled, the login is
 * "pending" until a valid TOTP or recovery code is submitted. That pending
 * state is stored in the session as `{ userId, expiresAt, attempts }`:
 *
 * - `expiresAt`: the pending login lives for TWO_FACTOR_PENDING_TTL_MS
 *   (10 minutes) after the password check. At or after `expiresAt` it is
 *   expired and the user must re-enter the password.
 * - `attempts`: each wrong code increments it. The TWO_FACTOR_MAX_ATTEMPTS-th
 *   (5th) failure locks the pending state, which the caller then destroys.
 *
 * TTL and attempts cap are the values locked in RESEARCH AS6. The attempts
 * cap is defence in depth: the authoritative brute-force control is the
 * server-side per-user `twoFactorThrottle` limiter.
 *
 * Pure functions with an injected `now`: no framework imports, so the module
 * stays unit-testable without a database.
 */

export const TWO_FACTOR_PENDING_KEY = 'two_factor_pending'

/** Pre-expiry session key. It is never honoured, only forgotten. */
export const LEGACY_TWO_FACTOR_KEY = 'two_factor_user_id'

export const TWO_FACTOR_PENDING_TTL_MS = 10 * 60 * 1000

export const TWO_FACTOR_MAX_ATTEMPTS = 5

export type TwoFactorPending = { userId: number; expiresAt: number; attempts: number }

export type PendingReadResult =
  { status: 'none' } | { status: 'expired' } | { status: 'ok'; pending: TwoFactorPending }

export function createPending(userId: number, now: number): TwoFactorPending {
  return { userId, expiresAt: now + TWO_FACTOR_PENDING_TTL_MS, attempts: 0 }
}

export function readPending(raw: unknown, now: number): PendingReadResult {
  if (typeof raw !== 'object' || raw === null) {
    return { status: 'none' }
  }

  const record = raw as Record<string, unknown>
  if (typeof record.userId !== 'number' || typeof record.expiresAt !== 'number') {
    return { status: 'none' }
  }

  if (now >= record.expiresAt) {
    return { status: 'expired' }
  }

  const attempts =
    typeof record.attempts === 'number' && Number.isInteger(record.attempts) && record.attempts >= 0
      ? record.attempts
      : 0

  return {
    status: 'ok',
    pending: { userId: record.userId, expiresAt: record.expiresAt, attempts },
  }
}

export function recordFailedAttempt(p: TwoFactorPending): {
  locked: boolean
  pending: TwoFactorPending
} {
  const attempts = p.attempts + 1
  return {
    locked: attempts >= TWO_FACTOR_MAX_ATTEMPTS,
    pending: { ...p, attempts },
  }
}
