import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import encryption from '@adonisjs/core/services/encryption'
import env from '#start/env'
import User from '#models/user'
import AuditLog from '#models/audit_log'
import TwoFactorService from '#services/two_factor_service'
import { createUser } from '#tests/functional/helpers/factories'

/**
 * Overwrites the raw `phone` cell (bypassing the model's `prepare` hook) with
 * a truncated ciphertext that can no longer be decrypted.
 */
async function corruptPhone(user: User): Promise<string> {
  const truncated = encryption.encrypt('0612345678').slice(0, -10)
  await db.from('users').where('id', user.id).update({ phone: truncated })
  return truncated
}

/**
 * `verifyToken` reports its failure fire-and-forget, so poll for the audit
 * row (up to ~500 ms) instead of assuming it is already written.
 */
async function waitForDecryptAudit(userId: number): Promise<AuditLog | null> {
  for (let i = 0; i < 50; i++) {
    const row = await AuditLog.query()
      .where('action', 'user.2fa.decrypt_failed')
      .where('resource_id', String(userId))
      .first()
    if (row) return row
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  return null
}

test.group('Decryption failures are loud', (group) => {
  let previousStrict: unknown

  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    previousStrict = env.get('PII_DECRYPT_STRICT')
  })
  group.each.teardown(() => {
    env.set('PII_DECRYPT_STRICT', String(previousStrict ?? 'false'))
  })

  test('strict on: a corrupt PII cell renders the 500 page instead of a silent logout', async ({
    client,
    route,
  }) => {
    const user = await createUser()
    await corruptPhone(user)

    env.set('PII_DECRYPT_STRICT', 'true')

    const response = await client.get(route('dashboard')).withInertia().loginAs(user).redirects(0)

    response.assertStatus(500)
    response.assertInertiaComponent('errors/server_error')
  })

  test('strict off (default): a corrupt PII cell reads as null and the user stays logged in', async ({
    client,
    route,
    assert,
  }) => {
    const user = await createUser()
    const truncated = await corruptPhone(user)

    const response = await client.get(route('dashboard')).withInertia().loginAs(user).redirects(0)

    response.assertStatus(200)
    response.assertInertiaComponent('dashboard')

    const reloaded = await User.findOrFail(user.id)
    assert.isNull(reloaded.phone)
    assert.notEqual(reloaded.phone, truncated)
  })

  test('a 2FA secret that cannot be decrypted denies the code and is audited', async ({
    assert,
  }) => {
    const user = await createUser()
    await db.from('users').where('id', user.id).update({ two_factor_secret: 'not-a-ciphertext' })
    const reloaded = await User.findOrFail(user.id)

    assert.isFalse(TwoFactorService.verifyToken(reloaded, '123456'))

    const audit = await waitForDecryptAudit(user.id)
    assert.isNotNull(audit)
    assert.equal(audit!.resourceType, 'User')
    assert.equal(audit!.userId, user.id)
    assert.deepEqual(audit!.metadata, { field: 'secret' })
  })

  test('recovery codes that cannot be decrypted deny the code and are audited', async ({
    assert,
  }) => {
    const user = await createUser()
    await db
      .from('users')
      .where('id', user.id)
      .update({ two_factor_recovery_codes: 'not-a-ciphertext' })
    const reloaded = await User.findOrFail(user.id)

    assert.isFalse(await TwoFactorService.verifyRecoveryCode(reloaded, 'ABCD-1234'))

    const audit = await waitForDecryptAudit(user.id)
    assert.isNotNull(audit)
    assert.equal(audit!.userId, user.id)
    assert.deepEqual(audit!.metadata, { field: 'recovery_codes' })
  })
})
