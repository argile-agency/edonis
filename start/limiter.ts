/*
|--------------------------------------------------------------------------
| Rate Limiter definitions
|--------------------------------------------------------------------------
|
| Defines rate limiting rules for sensitive routes (login, register,
| password change, etc.) to prevent brute-force and abuse.
|
*/

import limiter from '@adonisjs/limiter/services/main'

/**
 * Login throttle: 5 requests per minute per IP.
 * Blocks for 5 minutes after exceeding the limit.
 */
export const loginThrottle = limiter.define('login', () => {
  return limiter.allowRequests(5).every('1 minute').blockFor('5 minutes')
})

/**
 * Register throttle: 3 requests per minute per IP.
 * Blocks for 10 minutes after exceeding the limit.
 */
export const registerThrottle = limiter.define('register', () => {
  return limiter.allowRequests(3).every('1 minute').blockFor('10 minutes')
})

/**
 * Password change throttle: 3 requests per minute per user.
 * Uses authenticated user ID as the key.
 */
export const passwordThrottle = limiter.define('password', (ctx) => {
  if (!ctx.auth?.user) {
    return limiter.allowRequests(3).every('1 minute')
  }
  return limiter
    .allowRequests(3)
    .every('1 minute')
    .blockFor('5 minutes')
    .usingKey(`user_${ctx.auth.user.id}`)
})

/**
 * 2FA challenge throttle: 5 requests per minute per pending user.
 * Keyed on the user whose password was verified (session `two_factor_pending`),
 * so a distributed attacker cannot multiply guesses across IPs.
 * Blocks for 15 minutes after exceeding the limit. Falls back to the IP key
 * when there is no pending user. Applied in addition to the per-IP loginThrottle.
 */
export const twoFactorThrottle = limiter.define('two_factor', (ctx) => {
  const pending = ctx.session?.get('two_factor_pending')
  const userId = pending && typeof pending === 'object' ? pending.userId : undefined
  if (typeof userId !== 'number') {
    return limiter.allowRequests(5).every('1 minute')
  }
  return limiter
    .allowRequests(5)
    .every('1 minute')
    .blockFor('15 minutes')
    .usingKey(`2fa_user_${userId}`)
})
