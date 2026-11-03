import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import AppSetting from '#models/app_setting'
import PlatformSettingsPolicy from '#policies/platform_settings_policy'
import { assertNotCsrfRejected, createUser } from '#tests/functional/helpers/factories'

const CONTRACT_KEYS = [
  'appName',
  'appLogoUrl',
  'appFaviconUrl',
  'primaryColor',
  'heroTitle',
  'heroSubtitle',
  'heroImageUrl',
  'announcementText',
  'allowRegistration',
  'contactEmail',
  'supportUrl',
  'socialLinks',
]

const VALID_APPEARANCE = {
  appName: 'Démo Edonis',
  appLogoUrl: '/uploads/logo.png',
  appFaviconUrl: '',
  primaryColor: '#12ab34',
}

async function activeCount() {
  const rows = await AppSetting.query().where('is_active', true)
  return rows.length
}

/**
 * Seeders do not run in functional tests; the delete makes every test start
 * from an empty table whatever the test DB holds. Rolled back after each test.
 */
function isolate(group: { each: { setup: (fn: () => Promise<() => Promise<void>>) => void } }) {
  group.each.setup(async () => {
    const rollback = await testUtils.db().withGlobalTransaction()
    await AppSetting.query().delete()
    return rollback
  })
}

test.group('admin settings access', (group) => {
  isolate(group)

  test('anonymous visitors are redirected to /login', async ({ client }) => {
    // Never follow the redirect: GET /login needs a built Vite manifest.
    const get = await client.get('/admin/settings').redirects(0)
    get.assertStatus(302)
    get.assertHeader('location', '/login')

    const anonPut = client.put('/admin/settings/appearance').withCsrfToken()
    const put = await anonPut.json(VALID_APPEARANCE).redirects(0)
    put.assertStatus(302)
    put.assertHeader('location', '/login')
  })

  for (const role of ['teacher', 'manager', 'student'] as const) {
    test(`${role} gets 403 on GET and PUT`, async ({ client, assert }) => {
      const user = await createUser({ roles: [role] })
      const row = await AppSetting.create({ ...AppSetting.DEFAULTS })

      const get = await client.get('/admin/settings').loginAs(user)
      get.assertStatus(403)

      const req = client.put('/admin/settings/appearance').withCsrfToken()
      const put = await req.json(VALID_APPEARANCE).loginAs(user).redirects(0)
      put.assertStatus(403)

      const fresh = await AppSetting.findOrFail(row.id)
      assert.equal(fresh.appName, 'Edonis LMS')
    })
  }

  test('PlatformSettingsPolicy.manage is admin only', async ({ assert }) => {
    const policy = new PlatformSettingsPolicy()
    for (const role of ['admin', 'teacher', 'manager', 'student'] as const) {
      const user = await createUser({ roles: [role] })
      assert.strictEqual(await policy.manage(user), role === 'admin', role)
    }
  })

  test('admin GET on a fresh database creates the single active row', async ({
    client,
    assert,
  }) => {
    const admin = await createUser({ roles: ['admin'] })
    assert.equal(await activeCount(), 0)

    const response = await client.get('/admin/settings').withInertia().loginAs(admin)
    response.assertStatus(200)
    response.assertInertiaComponent('admin/settings')
    const props = response.inertiaProps as { settings: Record<string, unknown>; activeTab: string }
    assert.equal(props.settings.appName, 'Edonis LMS')
    assert.equal(props.activeTab, 'appearance')
    assert.equal(await activeCount(), 1)

    await client.get('/admin/settings').withInertia().loginAs(admin)
    assert.equal(await activeCount(), 1)
  })

  test('activeTab follows ?tab= and falls back to appearance', async ({ client, assert }) => {
    const admin = await createUser({ roles: ['admin'] })

    const contact = await client.get('/admin/settings?tab=contact').withInertia().loginAs(admin)
    assert.equal((contact.inertiaProps as { activeTab: string }).activeTab, 'contact')

    const bogus = await client.get('/admin/settings?tab=bogus').withInertia().loginAs(admin)
    assert.equal((bogus.inertiaProps as { activeTab: string }).activeTab, 'appearance')
  })

  test('settings prop holds exactly the contract keys, legacy empty links as null', async ({
    client,
    assert,
  }) => {
    const admin = await createUser({ roles: ['admin'] })
    await AppSetting.create({
      ...AppSetting.DEFAULTS,
      headerHtml: '<b>x</b>',
      socialLinks: { facebook: '', twitter: '', linkedin: '', github: '' },
    })

    const response = await client.get('/admin/settings').withInertia().loginAs(admin)
    const settings = (response.inertiaProps as { settings: Record<string, unknown> }).settings
    assert.sameMembers(Object.keys(settings), CONTRACT_KEYS)
    assert.deepEqual(settings.socialLinks, {
      facebook: null,
      twitter: null,
      linkedin: null,
      github: null,
    })
    assert.strictEqual(settings.allowRegistration, true)
  })

  test('PUT on an unknown tab is 404', async ({ client, assert }) => {
    const admin = await createUser({ roles: ['admin'] })
    const req = client.put('/admin/settings/bogus').withCsrfToken()
    const response = await req.json({}).loginAs(admin).redirects(0)
    assertNotCsrfRejected(assert, response)
    response.assertStatus(404)
  })
})
