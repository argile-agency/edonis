import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Menu from '#models/menu'
import MenuItem from '#models/menu_item'
import MenuSeeder from '#database/seeders/menu_seeder'
import { createUser } from '#tests/functional/helpers/factories'

// Keep in sync with SECTIONS in inertia/pages/admin/index.tsx.
const HUB_URLS = [
  '/admin/settings?tab=appearance',
  '/admin/settings?tab=home',
  '/admin/settings?tab=access',
  '/admin/settings?tab=contact',
  '/admin/settings?tab=trash',
  '/admin/audit-logs',
  '/admin/users',
  '/admin/users/create',
  '/admin/courses',
  '/admin/courses/approval-queue',
  '/courses/create',
  '/admin/categories',
  '/admin/categories/create',
]

test.group('admin hub', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('visitors are redirected to /login', async ({ client }) => {
    const response = await client.get('/admin').redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/login')
  })

  for (const role of ['teacher', 'manager', 'student'] as const) {
    test(`${role} gets 403`, async ({ client }) => {
      const user = await createUser({ roles: [role] })
      const response = await client.get('/admin').withInertia().loginAs(user)
      response.assertStatus(403)
    })
  }

  test('admin sees the hub page', async ({ client }) => {
    const admin = await createUser({ roles: ['admin'] })
    const response = await client.get('/admin').withInertia().loginAs(admin)
    response.assertStatus(200)
    response.assertInertiaComponent('admin/index')
  })

  test('every hub link answers 200 for an admin', async ({ client, assert }) => {
    const admin = await createUser({ roles: ['admin'] })
    for (const url of HUB_URLS) {
      const response = await client.get(url).withInertia().loginAs(admin)
      assert.equal(response.status(), 200, url)
    }
  })

  test('menu seeder keeps a single /admin row and drops /admin/settings', async ({ assert }) => {
    await new MenuSeeder(db.connection()).run()
    await new MenuSeeder(db.connection()).run()

    const userMenu = await Menu.findByOrFail('slug', 'user-menu')
    const adminRows = await MenuItem.query().where('menuId', userMenu.id).where('url', '/admin')
    assert.lengthOf(adminRows, 1)
    assert.equal(adminRows[0].label, 'Administration du site')
    assert.equal(adminRows[0].icon, 'Wrench')

    const settingsRows = await MenuItem.query()
      .where('menuId', userMenu.id)
      .where('url', '/admin/settings')
    assert.lengthOf(settingsRows, 0)
  })
})
