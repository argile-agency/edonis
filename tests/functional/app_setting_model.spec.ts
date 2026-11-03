import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import AppSetting from '#models/app_setting'
import AppSettingSeeder from '#database/seeders/app_setting_seeder'

async function activeCount() {
  const rows = await AppSetting.query().where('is_active', true)
  return rows.length
}

test.group('AppSetting model', (group) => {
  group.each.setup(async () => {
    const rollback = await testUtils.db().withGlobalTransaction()
    await AppSetting.query().delete()
    return rollback
  })

  test('getOrCreateActive creates the singleton once', async ({ assert }) => {
    const first = await AppSetting.getOrCreateActive()
    assert.equal(first.appName, 'Edonis LMS')
    const second = await AppSetting.getOrCreateActive()
    assert.equal(second.id, first.id)
    assert.equal(await activeCount(), 1)
  })

  test('boolean columns read back as real booleans', async ({ assert }) => {
    const created = await AppSetting.create({ ...AppSetting.DEFAULTS, allowRegistration: false })
    const row = await AppSetting.findOrFail(created.id)
    assert.strictEqual(row.allowRegistration, false)
    assert.strictEqual(row.isActive, true)
    assert.strictEqual(row.toJSON().allowRegistration, false)
  })

  test('socialLinks null is stored as SQL NULL', async ({ assert }) => {
    const created = await AppSetting.create({ ...AppSetting.DEFAULTS, socialLinks: null })
    const row = await AppSetting.findOrFail(created.id)
    assert.isNull(row.socialLinks)
    const raw = await db.from('app_settings').where('id', created.id).select('social_links').first()
    assert.isNull(raw.social_links)
  })

  test('seeder creates the demo row and never overwrites edits', async ({ assert }) => {
    await new AppSettingSeeder(db.connection()).run()
    const seeded = await AppSetting.getActiveSettings()
    assert.match(seeded!.announcementText!, /^Environnement de démonstration/)

    seeded!.announcementText = 'edited'
    await seeded!.save()

    await new AppSettingSeeder(db.connection()).run()
    const after = await AppSetting.getActiveSettings()
    assert.equal(after!.announcementText, 'edited')
    assert.equal(await activeCount(), 1)
  })
})
