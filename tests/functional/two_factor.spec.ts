import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import encryption from '@adonisjs/core/services/encryption'
import limiter from '@adonisjs/limiter/services/main'
import { DateTime } from 'luxon'
import * as OTPAuth from 'otpauth'
import User from '#models/user'
import AuditLog from '#models/audit_log'
import TwoFactorService from '#services/two_factor_service'
import TwoFactorAdminService from '#services/two_factor_admin_service'
import type { Assert } from '@japa/assert'
import {
  assertNotCsrfRejected,
  createUser as createRoleUser,
} from '#tests/functional/helpers/factories'

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

    const request = client.post(route('two-factor.verify')).withCsrfToken()
    const response = await request
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

    const request = client.post(route('two-factor.verify')).withCsrfToken()
    const response = await request
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
    const followUpRequest = client.post(route('two-factor.verify')).withCsrfToken()
    const followUp = await followUpRequest.form({ token: '000000' }).redirects(0)

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

    const request = client.post(route('two-factor.verify')).withCsrfToken()
    const response = await request
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

    const request = client.post(route('two-factor.verify')).withCsrfToken()
    const response = await request
      .withSession({ two_factor_pending: pendingFor(user.id) })
      .form({ token })
      .redirects(0)

    response.assertStatus(302)
    assert.equal(response.header('location'), route('dashboard'))
    response.assertSessionMissing('two_factor_pending')

    const audit = await findAudit('user.login.2fa', user.id)
    assert.isNotNull(audit)
  })

  test('challenge throttle is keyed per pending user (2fa_user_<id>)', async ({
    client,
    route,
    assert,
  }) => {
    const target = await createUser('2fa-throttled')
    const other = await createUser('2fa-not-throttled')

    // Same options as `twoFactorThrottle` so `use()` returns the limiter
    // instance the middleware consumes from. The middleware prefixes the key
    // with the limiter name: `two_factor_2fa_user_<id>`.
    const twoFactorLimiter = limiter.use({
      requests: 5,
      duration: '1 minute',
      blockDuration: '15 minutes',
    })

    // One real request proves the middleware consumes the per-user key.
    const firstRequest = client.post(route('two-factor.verify')).withCsrfToken()
    const first = await firstRequest
      .withSession({ two_factor_pending: pendingFor(other.id) })
      .form({ token: '000000' })
      .redirects(0)
    first.assertStatus(302)
    assert.equal(await twoFactorLimiter.remaining(`two_factor_2fa_user_${other.id}`), 4)

    // Exhaust the target's per-user key directly. The per-IP loginThrottle
    // has seen only one request, so a 429 below can only come from the
    // per-user key.
    for (let i = 0; i < 5; i++) {
      await twoFactorLimiter.consume(`two_factor_2fa_user_${target.id}`).catch(() => {})
    }

    const blockedRequest = client.post(route('two-factor.verify')).withCsrfToken()
    const blocked = await blockedRequest
      .withSession({ two_factor_pending: pendingFor(target.id) })
      .form({ token: '000000' })
      .redirects(0)
    blocked.assertStatus(429)

    // Another pending user from the same IP is not affected.
    const otherRequest = client.post(route('two-factor.verify')).withCsrfToken()
    const notBlocked = await otherRequest
      .withSession({ two_factor_pending: pendingFor(other.id) })
      .form({ token: '000000' })
      .redirects(0)
    notBlocked.assertStatus(302)
    assert.isUndefined(notBlocked.flashMessage('errorsBag.E_BAD_CSRF_TOKEN'))
  })
})

/**
 * A user with 2FA fully enabled: secret, confirmed timestamp and recovery codes.
 */
async function enableTwoFactor(user: User) {
  const { secret } = await TwoFactorService.generateSecret(user)
  user.twoFactorSecret = secret
  user.twoFactorEnabled = true
  user.twoFactorConfirmedAt = DateTime.now()
  user.twoFactorRecoveryCodes = TwoFactorService.encryptRecoveryCodes(
    TwoFactorService.generateRecoveryCodes()
  )
  await user.save()
  return user
}

function assertTwoFactorCleared(assert: Assert, user: User) {
  assert.isFalse(Boolean(user.twoFactorEnabled))
  assert.isNull(user.twoFactorSecret)
  assert.isNull(user.twoFactorRecoveryCodes)
  assert.isNull(user.twoFactorConfirmedAt)
}

test.group('Two-factor - admin reset', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(async () => {
    // Shared memory limiter store: clear throttle state left by other groups
    // and by twoFactorResetThrottle.
    await limiter.clear()
  })

  test('admin resets another user 2FA, audited without PII', async ({ client, route, assert }) => {
    const admin = await createRoleUser({ roles: ['admin'] })
    const target = await enableTwoFactor(await createRoleUser({ roles: ['student'] }))

    const request = client.post(route('users.two-factor.reset', { id: target.id })).withCsrfToken()
    const response = await request.loginAs(admin).redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.equal(
      response.flashMessage('success'),
      'Authentification à deux facteurs réinitialisée.'
    )

    const fresh = await User.findOrFail(target.id)
    assertTwoFactorCleared(assert, fresh)

    const audit = await AuditLog.query()
      .where('action', 'admin.user.2fa.reset')
      .where('resource_id', String(target.id))
      .first()
    assert.isNotNull(audit)
    assert.equal(audit!.userId, admin.id)
    assert.isNull(audit!.oldValues)
    assert.isNull(audit!.newValues)
    for (const values of [audit!.oldValues, audit!.newValues]) {
      for (const key of ['phone', 'email', 'address']) {
        assert.notProperty(values ?? {}, key)
      }
    }
  })

  test('non-admin gets 403 and the target 2FA is unchanged', async ({ client, route, assert }) => {
    const teacher = await createRoleUser({ roles: ['teacher'] })
    const target = await enableTwoFactor(await createRoleUser({ roles: ['student'] }))

    const request = client.post(route('users.two-factor.reset', { id: target.id })).withCsrfToken()
    const response = await request.loginAs(teacher).redirects(0)

    response.assertStatus(403)

    const fresh = await User.findOrFail(target.id)
    assert.isTrue(Boolean(fresh.twoFactorEnabled))
    assert.isNotNull(fresh.twoFactorSecret)
    assert.isNotNull(fresh.twoFactorRecoveryCodes)
    assert.isNotNull(fresh.twoFactorConfirmedAt)

    const audit = await AuditLog.query()
      .where('action', 'admin.user.2fa.reset')
      .where('resource_id', String(target.id))
      .first()
    assert.isNull(audit)
  })

  test('TwoFactorAdminService.reset clears the four 2FA fields', async ({ assert }) => {
    const target = await enableTwoFactor(await createRoleUser())

    await TwoFactorAdminService.reset(target)

    const fresh = await User.findOrFail(target.id)
    assertTwoFactorCleared(assert, fresh)
  })
})
