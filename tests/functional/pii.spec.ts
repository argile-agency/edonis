import { test } from '@japa/runner'
import type { ApiRequest } from '@japa/api-client'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Tokens from 'csrf'
import User from '#models/user'

/**
 * Spec-local CSRF helper: does exactly what `@adonisjs/shield`'s
 * `shieldApiClient().withCsrfToken()` does (session `csrf-secret` + matching
 * `x-csrf-token` header). Temporary: plan 02-07 replaces every call with
 * `.withCsrfToken()` once `shieldApiClient()` is registered in bootstrap.
 */
function withCsrf<T extends ApiRequest>(request: T): T {
  const tokens = new Tokens()
  const secret = tokens.secretSync()
  return request
    .withSession({ 'csrf-secret': secret })
    .header('x-csrf-token', tokens.create(secret))
}

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@test.com`
}

async function createUser(prefix: string) {
  return User.create({
    email: uniqueEmail(prefix),
    password: 'password',
    fullName: `Test ${prefix}`,
  })
}

test.group('PII - column capacity', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  /**
   * NOTE: on SQLite this test passes even without the widen migration, because
   * SQLite does not enforce varchar length. The CI PostgreSQL / MySQL matrix is
   * what proves `users.phone` / `users.mobile_phone` can hold the ~110-char
   * ciphertext.
   */
  test('a phone number saved via the profile form is stored encrypted and reads back', async ({
    client,
    route,
    assert,
  }) => {
    const user = await createUser('pii-profile')

    // Do not follow the redirect: the target page would render the full
    // Inertia HTML layout, which requires a built Vite manifest.
    const response = await withCsrf(
      client.post(route('user.profile.update')).loginAs(user).redirects(0)
    ).form({
      email: user.email,
      firstName: 'Pii',
      lastName: 'Tester',
      phone: '0612345678',
      mobilePhone: '0712345678',
    })

    response.assertStatus(302)
    assert.isUndefined(response.flashMessage('errorsBag.E_BAD_CSRF_TOKEN'))
    assert.isUndefined(response.flashMessage('error'))
    assert.equal(response.flashMessage('success'), 'Profil mis à jour avec succès')

    const raw = await db.from('users').where('id', user.id).first()
    assert.isString(raw.phone)
    assert.isAbove(raw.phone.length, 20)
    assert.notEqual(raw.phone, '0612345678')
    assert.isString(raw.mobile_phone)
    assert.isAbove(raw.mobile_phone.length, 20)

    const reloaded = await User.findOrFail(user.id)
    assert.equal(reloaded.phone, '0612345678')
    assert.equal(reloaded.mobilePhone, '0712345678')
  })
})
