import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import AppSetting from '#models/app_setting'
import User from '#models/user'
import { REGISTRATION_CLOSED_MESSAGE, isRegistrationOpen } from '../../app/helpers/registration.js'
import { uniqueSuffix } from '#tests/functional/helpers/factories'

async function setRegistration(allowRegistration: boolean) {
  await AppSetting.query().delete()
  await AppSetting.create({ allowRegistration, isActive: true })
}

test.group('Registration setting', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('isRegistrationOpen follows the active settings row', async ({ assert }) => {
    await AppSetting.query().delete()
    assert.isTrue(await isRegistrationOpen())

    await setRegistration(true)
    assert.isTrue(await isRegistrationOpen())

    // SQLite/MySQL read the boolean back as 0, which the helper must convert
    await setRegistration(false)
    assert.isFalse(await isRegistrationOpen())
  })

  test('closed: GET /register redirects to login with the flash', async ({ client, assert }) => {
    await setRegistration(false)

    // Do not follow the redirect: GET /login needs a built Vite manifest.
    const response = await client.get('/register').redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/login')
    assert.equal(response.flashMessage('error'), REGISTRATION_CLOSED_MESSAGE)
  })

  test('closed: POST /register creates no user, even with a valid payload', async ({
    client,
    assert,
  }) => {
    await setRegistration(false)
    const email = `closed-${uniqueSuffix()}@test.com`

    const response = await client.post('/register').withCsrfToken().redirects(0).form({
      fullName: 'Closed Registration',
      email,
      password: 'password123',
      password_confirmation: 'password123',
      termsAccepted: 'on',
    })

    response.assertStatus(302)
    response.assertHeader('location', '/login')
    assert.equal(response.flashMessage('error'), REGISTRATION_CLOSED_MESSAGE)
    assert.isUndefined(response.flashMessage('inputErrorsBag'))
    assert.isNull(await User.findBy('email', email))
  })

  test('open: GET /register renders the form', async ({ client, assert }) => {
    await setRegistration(true)

    const response = await client.get('/register').withInertia()

    response.assertStatus(200)
    response.assertInertiaComponent('auth/register')
    // The pages read this camelCase key from the shared prop to show « Créer un compte »
    const props = response.inertiaProps as { appSettings?: { allowRegistration?: unknown } }
    assert.isTrue(Boolean(props.appSettings?.allowRegistration))
  })
})
