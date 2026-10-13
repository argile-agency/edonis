import { test } from '@japa/runner'
import type { ApiRequest } from '@japa/api-client'
import testUtils from '@adonisjs/core/services/test_utils'
import encryption from '@adonisjs/core/services/encryption'
import limiter from '@adonisjs/limiter/services/main'
import { DateTime } from 'luxon'
import Tokens from 'csrf'
import * as OTPAuth from 'otpauth'
import User from '#models/user'
import AuditLog from '#models/audit_log'
import TwoFactorService from '#services/two_factor_service'

/**
 * Spec-local CSRF helper: does exactly what Shield's `shieldApiClient()`
 * plugin does for `.withCsrfToken()` (seed a `csrf-secret` in the session and
 * send the matching `x-csrf-token` header). Plan 02-08 replaces it with
 * `.withCsrfToken()` once 02-01's plugin registration is merged.
 */
function withCsrf<T extends ApiRequest>(request: T): T {
  const tokens = new Tokens()
  const secret = tokens.secretSync()
  return request
    .withSession({ 'csrf-secret': secret })
    .header('x-csrf-token', tokens.create(secret))
}

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * A user without a TOTP secret: `verifyToken` returns false for any code,
 * so wrong-code paths are deterministic.
 */
async function createUser(prefix: string) {
  return User.create({
    email: `${prefix}-${uniqueSuffix()}@test.com`,
    password: 'password',
    fullName: `Test ${prefix}`,
  })
}

function pendingFor(userId: number, overrides: { expiresAt?: number; attempts?: number } = {}) {
  return {
    userId,
    expiresAt: overrides.expiresAt ?? Date.now() + 5 * 60 * 1000,
    attempts: overrides.attempts ?? 0,
  }
}

async function findAudit(action: string, userId: number) {
  return AuditLog.query().where('action', action).where('resource_id', String(userId)).first()
}

test.group('Two-factor - pending login state', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(async () => {
    // The memory limiter store is shared across the process: without this the
    // per-IP loginThrottle (5/min) answers 429 after a few POSTs in this file.
    await limiter.clear()
  })

  test('expired pending state sends the user back to login and is audited', async ({
    client,
    route,
    assert,
  }) => {
    const user = await createUser('2fa-expired')

    const response = await withCsrf(client.post(route('two-factor.verify')))
      .withSession({ two_factor_pending: pendingFor(user.id, { expiresAt: Date.now() - 1000 }) })
      .form({ token: '000000' })
      .redirects(0)

    response.assertStatus(302)
    assert.equal(response.header('location'), route('login'))
    response.assertSessionMissing('two_factor_pending')
    assert.isUndefined(response.flashMessage('errorsBag.E_BAD_CSRF_TOKEN'))

    const audit = await findAudit('user.login.2fa_expired', user.id)
    assert.isNotNull(audit)
  })

  test('5th wrong code locks the pending state and is audited', async ({
    client,
    route,
    assert,
  }) => {
    const user = await createUser('2fa-locked')

    const response = await withCsrf(client.post(route('two-factor.verify')))
      .withSession({ two_factor_pending: pendingFor(user.id, { attempts: 4 }) })
      .form({ token: '000000' })
      .redirects(0)

    response.assertStatus(302)
    assert.equal(response.header('location'), route('login'))
    response.assertSessionMissing('two_factor_pending')
    assert.equal(response.flashMessage('error'), 'Trop de tentatives. Veuillez vous reconnecter.')

    const audit = await findAudit('user.login.2fa_locked', user.id)
    assert.isNotNull(audit)

    // Once locked there is no pending state left: a follow-up attempt goes to login.
    const followUp = await withCsrf(client.post(route('two-factor.verify')))
      .form({ token: '000000' })
      .redirects(0)

    followUp.assertStatus(302)
    assert.equal(followUp.header('location'), route('login'))
    assert.isUndefined(followUp.flashMessage('errorsBag.E_BAD_CSRF_TOKEN'))
  })

  test('wrong code under the cap increments attempts and redirects back', async ({
    client,
    route,
    assert,
  }) => {
    const user = await createUser('2fa-undercap')
    const pending = pendingFor(user.id, { attempts: 0 })

    const response = await withCsrf(client.post(route('two-factor.verify')))
      .withSession({ two_factor_pending: pending })
      .form({ token: '000000' })
      .redirects(0)

    response.assertStatus(302)
    assert.notEqual(response.header('location'), route('login'))
    assert.isUndefined(response.flashMessage('errorsBag.E_BAD_CSRF_TOKEN'))
    assert.equal(response.flashMessage('error'), 'Code invalide. Veuillez réessayer.')
    assert.deepEqual(response.session('two_factor_pending'), { ...pending, attempts: 1 })
  })

  test('legacy two_factor_user_id session key is ignored', async ({ client, route, assert }) => {
    const user = await createUser('2fa-legacy')

    const response = await client
      .get(route('two-factor.challenge'))
      .withSession({ two_factor_user_id: user.id })
      .redirects(0)

    response.assertStatus(302)
    assert.equal(response.header('location'), route('login'))
    response.assertSessionMissing('two_factor_user_id')
  })

  test('a correct TOTP within the window completes login', async ({ client, route, assert }) => {
    const user = await createUser('2fa-happy')

    const { secret } = await TwoFactorService.generateSecret(user)
    user.twoFactorSecret = secret
    user.twoFactorEnabled = true
    user.twoFactorConfirmedAt = DateTime.now()
    await user.save()

    const base32 = encryption.decrypt<string>(secret)!
    const token = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(base32),
    }).generate()

    const response = await withCsrf(client.post(route('two-factor.verify')))
      .withSession({ two_factor_pending: pendingFor(user.id) })
      .form({ token })
      .redirects(0)

    response.assertStatus(302)
    assert.equal(response.header('location'), route('dashboard'))
    response.assertSessionMissing('two_factor_pending')

    const audit = await findAudit('user.login.2fa', user.id)
    assert.isNotNull(audit)
  })
})
