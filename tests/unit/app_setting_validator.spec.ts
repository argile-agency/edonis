import { test } from '@japa/runner'
import { errors } from '@vinejs/vine'
import {
  appSettingValidators,
  COLOR_MESSAGE,
  IMAGE_URL_MESSAGE,
  LINK_URL_MESSAGE,
  RETENTION_MESSAGE,
} from '../../app/validators/app_setting.js'

const meta = { appHost: 'demo.edonis.org' }
const REQUIRED = 'Ce champ est obligatoire.'
const EMAIL = 'Saisissez une adresse e-mail valide (ex. contact@exemple.org).'

const validAppearance = { appName: 'Edonis', primaryColor: '#5046E5' }
const validHome = { heroTitle: 'Bienvenue' }

/** Validates and returns the error message reported on `field`, or null if valid. */
async function errorOn(tab: keyof typeof appSettingValidators, data: object, field: string) {
  try {
    await appSettingValidators[tab].validate(data, { meta })
    return null
  } catch (error) {
    if (!(error instanceof errors.E_VALIDATION_ERROR)) throw error
    const messages = error.messages as { field: string; message: string }[]
    return messages.find((m) => m.field === field)?.message ?? `no error on ${field}`
  }
}

test.group('app_setting validators', () => {
  test('appearance: valid input passes and the colour is upper-cased', async ({ assert }) => {
    const out = await appSettingValidators.appearance.validate(
      {
        appName: 'Edonis',
        appLogoUrl: '/uploads/logo.png',
        appFaviconUrl: null,
        primaryColor: '#5046e5',
      },
      { meta }
    )
    assert.equal(out.primaryColor, '#5046E5')
  })

  test('appearance: bad colour, too long and missing name', async ({ assert }) => {
    assert.equal(
      await errorOn('appearance', { ...validAppearance, primaryColor: 'red' }, 'primaryColor'),
      COLOR_MESSAGE
    )
    assert.equal(
      await errorOn('appearance', { ...validAppearance, appName: 'x'.repeat(101) }, 'appName'),
      'Ce champ ne doit pas dépasser 100 caractères.'
    )
    assert.equal(
      await errorOn('appearance', { ...validAppearance, appName: null }, 'appName'),
      REQUIRED
    )
    assert.equal(
      await errorOn('appearance', { ...validAppearance, appName: '   ' }, 'appName'),
      REQUIRED
    )
  })

  test('image URLs: same host passes', async ({ assert }) => {
    assert.isNull(
      await errorOn(
        'appearance',
        { ...validAppearance, appLogoUrl: 'https://demo.edonis.org/uploads/a.png' },
        'appLogoUrl'
      )
    )
  })

  test('image URLs: {$self} is refused')
    .with([
      'https://evil.example/a.png',
      '//evil.example/a.png',
      '/\\evil.example/a.png',
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      '/a b.png',
    ])
    .run(async ({ assert }, url) => {
      assert.equal(
        await errorOn('appearance', { ...validAppearance, appLogoUrl: url }, 'appLogoUrl'),
        IMAGE_URL_MESSAGE
      )
      assert.equal(
        await errorOn('home', { ...validHome, heroImageUrl: url }, 'heroImageUrl'),
        IMAGE_URL_MESSAGE
      )
    })

  test('contact: support URL accepts paths and http(s) only', async ({ assert }) => {
    assert.isNull(await errorOn('contact', { supportUrl: '/aide' }, 'supportUrl'))
    assert.isNull(
      await errorOn('contact', { supportUrl: 'https://aide.example.org' }, 'supportUrl')
    )
    assert.equal(
      await errorOn('contact', { supportUrl: 'javascript:alert(1)' }, 'supportUrl'),
      LINK_URL_MESSAGE
    )
    assert.equal(
      await errorOn('contact', { supportUrl: 'ftp://x.org' }, 'supportUrl'),
      LINK_URL_MESSAGE
    )
    assert.equal(await errorOn('contact', { contactEmail: 'nope' }, 'contactEmail'), EMAIL)
  })

  test('contact: social links refuse paths and drop unknown keys', async ({ assert }) => {
    assert.equal(
      await errorOn('contact', { socialLinks: { github: '/x' } }, 'socialLinks.github'),
      LINK_URL_MESSAGE
    )
    const out = await appSettingValidators.contact.validate(
      { socialLinks: { github: 'https://github.com/edonis', evil: 'https://x' } },
      { meta }
    )
    assert.equal(out.socialLinks?.github, 'https://github.com/edonis')
    assert.notProperty(out.socialLinks, 'evil')
  })

  test('home: announcement limited to 280 characters, title required', async ({ assert }) => {
    assert.equal(
      await errorOn(
        'home',
        { ...validHome, announcementText: 'a'.repeat(281) },
        'announcementText'
      ),
      'Ce champ ne doit pas dépasser 280 caractères.'
    )
    assert.isNull(
      await errorOn('home', { ...validHome, announcementText: 'a'.repeat(280) }, 'announcementText')
    )
    assert.equal(await errorOn('home', { heroTitle: null }, 'heroTitle'), REQUIRED)
    assert.equal(await errorOn('home', { heroTitle: '   ' }, 'heroTitle'), REQUIRED)
  })

  test('access: allowRegistration false is kept', async ({ assert }) => {
    const out = await appSettingValidators.access.validate({ allowRegistration: false }, { meta })
    assert.strictEqual(out.allowRegistration, false)
  })

  test('trash: retention {$self} is refused')
    .with([0, 366, 1.5, 'abc', null, undefined])
    .run(async ({ assert }, days) => {
      assert.equal(
        await errorOn('trash', { trashRetentionDays: days }, 'trashRetentionDays'),
        RETENTION_MESSAGE
      )
    })

  test('trash: retention {$self} passes as a number')
    .with([1, 30, 365])
    .run(async ({ assert }, days) => {
      const out = await appSettingValidators.trash.validate({ trashRetentionDays: days }, { meta })
      assert.strictEqual(out.trashRetentionDays, days)
    })

  test('every tab drops headerHtml and isActive', async ({ assert }) => {
    const valid = {
      appearance: validAppearance,
      home: validHome,
      access: { allowRegistration: true },
      contact: {},
      trash: { trashRetentionDays: 30 },
    }
    for (const [tab, data] of Object.entries(valid)) {
      const out = await appSettingValidators[tab as keyof typeof valid].validate(
        { ...data, headerHtml: '<script>x</script>', isActive: false },
        { meta }
      )
      assert.notProperty(out, 'headerHtml')
      assert.notProperty(out, 'isActive')
    }
  })
})
