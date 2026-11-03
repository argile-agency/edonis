import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import type { Assert } from '@japa/assert'
import testUtils from '@adonisjs/core/services/test_utils'
import AppSetting from '#models/app_setting'
import AuditLog from '#models/audit_log'
import type User from '#models/user'
import { COLOR_MESSAGE, IMAGE_URL_MESSAGE, LINK_URL_MESSAGE } from '#validators/app_setting'
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

async function auditRows() {
  return AuditLog.query().where('action', 'admin.settings.update')
}

async function putTab(
  client: ApiClient,
  admin: User,
  tab: string,
  body: Record<string, unknown>,
  assert: Assert
) {
  const req = client.put(`/admin/settings/${tab}`).withCsrfToken()
  const response = await req.json(body).loginAs(admin).redirects(0)
  assertNotCsrfRejected(assert, response)
  return response
}

const INVALID_CASES: Array<{
  name: string
  tab: string
  body: Record<string, unknown>
  field: string
  message?: string
}> = [
  {
    name: 'colour name',
    tab: 'appearance',
    body: { ...VALID_APPEARANCE, primaryColor: 'red' },
    field: 'primaryColor',
    message: COLOR_MESSAGE,
  },
  { name: 'bad email', tab: 'contact', body: { contactEmail: 'nope' }, field: 'contactEmail' },
  {
    name: 'javascript: support URL',
    tab: 'contact',
    body: { supportUrl: 'javascript:alert(1)' },
    field: 'supportUrl',
    message: LINK_URL_MESSAGE,
  },
  {
    name: 'javascript: social link',
    tab: 'contact',
    body: { socialLinks: { facebook: 'javascript:alert(1)' } },
    field: 'socialLinks.facebook',
    message: LINK_URL_MESSAGE,
  },
  {
    name: 'foreign image host',
    tab: 'appearance',
    body: { ...VALID_APPEARANCE, appLogoUrl: 'https://evil.example/x.png' },
    field: 'appLogoUrl',
    message: IMAGE_URL_MESSAGE,
  },
  {
    name: 'protocol-relative image',
    tab: 'appearance',
    body: { ...VALID_APPEARANCE, appLogoUrl: '//evil.example/x.png' },
    field: 'appLogoUrl',
    message: IMAGE_URL_MESSAGE,
  },
  {
    name: '101-character name',
    tab: 'appearance',
    body: { ...VALID_APPEARANCE, appName: 'a'.repeat(101) },
    field: 'appName',
  },
  {
    name: '281-character announcement',
    tab: 'home',
    body: { heroTitle: 'Titre', announcementText: 'a'.repeat(281) },
    field: 'announcementText',
  },
]

test.group('admin settings save', (group) => {
  isolate(group)

  test('appearance save updates the row and writes one changed-keys audit row', async ({
    client,
    assert,
  }) => {
    const admin = await createUser({ roles: ['admin'] })
    const row = await AppSetting.create({ ...AppSetting.DEFAULTS, appFaviconUrl: '/old.ico' })

    const response = await putTab(client, admin, 'appearance', VALID_APPEARANCE, assert)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/settings?tab=appearance')
    assert.equal(response.flashMessage('success'), 'Réglages enregistrés.')

    const fresh = await AppSetting.findOrFail(row.id)
    assert.equal(fresh.appName, 'Démo Edonis')
    assert.equal(fresh.primaryColor, '#12AB34')
    assert.equal(fresh.appLogoUrl, '/uploads/logo.png')
    assert.isNull(fresh.appFaviconUrl)
    assert.equal(await activeCount(), 1)

    const audits = await auditRows()
    assert.lengthOf(audits, 1)
    assert.equal(audits[0].resourceId, String(row.id))
    assert.equal(audits[0].userId, admin.id)
    assert.sameMembers(Object.keys(audits[0].newValues!), [
      'appName',
      'primaryColor',
      'appLogoUrl',
      'appFaviconUrl',
    ])
    assert.equal(audits[0].oldValues!.appFaviconUrl, '/old.ico')
  })

  test('home save stores the announcement', async ({ client, assert }) => {
    const admin = await createUser({ roles: ['admin'] })
    const row = await AppSetting.create({ ...AppSetting.DEFAULTS })

    const body = {
      heroTitle: AppSetting.DEFAULTS.heroTitle,
      heroSubtitle: AppSetting.DEFAULTS.heroSubtitle,
      heroImageUrl: '',
      announcementText: 'Maintenance samedi',
    }
    const response = await putTab(client, admin, 'home', body, assert)
    response.assertStatus(302)
    assert.equal((await AppSetting.findOrFail(row.id)).announcementText, 'Maintenance samedi')
    const audits = await auditRows()
    assert.lengthOf(audits, 1)
    assert.sameMembers(Object.keys(audits[0].newValues!), ['announcementText'])
  })

  test('access save stores a strict false, read back by the next GET', async ({
    client,
    assert,
  }) => {
    const admin = await createUser({ roles: ['admin'] })
    const row = await AppSetting.create({ ...AppSetting.DEFAULTS })

    const response = await putTab(client, admin, 'access', { allowRegistration: false }, assert)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/settings?tab=access')
    assert.strictEqual((await AppSetting.findOrFail(row.id)).allowRegistration, false)

    const page = await client.get('/admin/settings').withInertia().loginAs(admin)
    const settings = (page.inertiaProps as { settings: Record<string, unknown> }).settings
    assert.strictEqual(settings.allowRegistration, false)
  })

  test('unchanged access save writes nothing', async ({ client, assert }) => {
    const admin = await createUser({ roles: ['admin'] })
    await AppSetting.create({ ...AppSetting.DEFAULTS, allowRegistration: true })

    const response = await putTab(client, admin, 'access', { allowRegistration: true }, assert)
    response.assertStatus(302)
    assert.equal(response.flashMessage('success'), 'Aucune modification à enregistrer.')
    assert.lengthOf(await auditRows(), 0)
  })

  test('contact save audits only socialLinks when one link changes', async ({
    client,
    assert,
  }) => {
    const admin = await createUser({ roles: ['admin'] })
    const row = await AppSetting.create({ ...AppSetting.DEFAULTS })

    const body = {
      contactEmail: '',
      supportUrl: '',
      socialLinks: { facebook: '', twitter: '', linkedin: '', github: 'https://github.com/x' },
    }
    const response = await putTab(client, admin, 'contact', body, assert)
    response.assertStatus(302)
    assert.equal(response.flashMessage('success'), 'Réglages enregistrés.')

    const fresh = await AppSetting.findOrFail(row.id)
    assert.deepEqual(fresh.socialLinks, {
      facebook: null,
      twitter: null,
      linkedin: null,
      github: 'https://github.com/x',
    })
    const audits = await auditRows()
    assert.lengthOf(audits, 1)
    assert.sameMembers(Object.keys(audits[0].newValues!), ['socialLinks'])
  })

  test('unchanged contact save on a legacy row with empty links writes nothing', async ({
    client,
    assert,
  }) => {
    const admin = await createUser({ roles: ['admin'] })
    const empty = { facebook: '', twitter: '', linkedin: '', github: '' }
    await AppSetting.create({ ...AppSetting.DEFAULTS, socialLinks: empty })

    const body = { contactEmail: '', supportUrl: '', socialLinks: empty }
    const response = await putTab(client, admin, 'contact', body, assert)
    response.assertStatus(302)
    assert.equal(response.flashMessage('success'), 'Aucune modification à enregistrer.')
    assert.lengthOf(await auditRows(), 0)
  })

  test('lowercase colour equal to the stored one is not a change', async ({ client, assert }) => {
    const admin = await createUser({ roles: ['admin'] })
    await AppSetting.create({ ...AppSetting.DEFAULTS })

    const body = {
      appName: AppSetting.DEFAULTS.appName,
      appLogoUrl: '',
      appFaviconUrl: '',
      primaryColor: AppSetting.DEFAULTS.primaryColor.toLowerCase(),
    }
    const response = await putTab(client, admin, 'appearance', body, assert)
    assert.equal(response.flashMessage('success'), 'Aucune modification à enregistrer.')
    assert.lengthOf(await auditRows(), 0)
  })

  for (const invalid of INVALID_CASES) {
    test(`invalid input is refused: ${invalid.name}`, async ({ client, assert }) => {
      const admin = await createUser({ roles: ['admin'] })
      const row = await AppSetting.create({ ...AppSetting.DEFAULTS })
      const before = JSON.stringify((await AppSetting.findOrFail(row.id)).toJSON())

      const response = await putTab(client, admin, invalid.tab, invalid.body, assert)
      response.assertStatus(302)
      // Nested errors are flashed under the literal dotted key
      const errors = response.flashMessages().inputErrorsBag as Record<string, unknown>
      assert.isDefined(errors?.[invalid.field], invalid.field)
      if (invalid.message) assert.deepEqual(errors[invalid.field], [invalid.message])

      const after = JSON.stringify((await AppSetting.findOrFail(row.id)).toJSON())
      assert.equal(after, before)
      assert.lengthOf(await auditRows(), 0)
    })
  }

  test('unexposed fields in the payload are ignored', async ({ client, assert }) => {
    const admin = await createUser({ roles: ['admin'] })
    const row = await AppSetting.create({ ...AppSetting.DEFAULTS })

    const body = { ...VALID_APPEARANCE, headerHtml: '<script>alert(1)</script>', isActive: false }
    const response = await putTab(client, admin, 'appearance', body, assert)
    response.assertStatus(302)
    const fresh = await AppSetting.findOrFail(row.id)
    assert.equal(fresh.appName, 'Démo Edonis')
    assert.isNull(fresh.headerHtml)
    assert.strictEqual(fresh.isActive, true)
    assert.equal(await activeCount(), 1)
  })
})
