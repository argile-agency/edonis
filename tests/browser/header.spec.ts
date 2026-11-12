import { test } from '@japa/runner'
import limiter from '@adonisjs/limiter/services/main'
import type { Page } from 'playwright'
import User from '#models/user'
import { createCourse } from '#tests/functional/helpers/factories'

const DESKTOP = { width: 1440, height: 900 }
const MOBILE = { width: 375, height: 800 }

async function login(page: Page, email: string) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill('password')
  await Promise.all([
    page.waitForURL('**/dashboard', { timeout: 5000 }),
    page.locator('button[type="submit"]').click(),
  ])
  // Reload drops the « Connexion réussie » toast, which sits over the header controls
  await page.reload()
}

// Resolves once the named control holds keyboard focus
function waitForFocus(page: Page, role: 'button' | 'searchbox', name: string) {
  const tag = role === 'searchbox' ? 'input' : 'button'
  return page.locator(`header ${tag}:focus[aria-label="${name}"]`).waitFor()
}

/**
 * Header rebuilt on the Moodle model (Phase 5.3): user zone per role, search,
 * placeholders, avatar menu, edit-mode switch and the ☰ panel below lg.
 */
test.group('Header (Phase 5.3)', (group) => {
  // The server runs in this process: reset the per-IP loginThrottle (5/min) between tests.
  group.each.setup(() => limiter.clear())

  test('visitor sees theme and login only, no user zone (HEADER-01)', async ({ visit, assert }) => {
    const page = await visit('/')
    await page.setViewportSize(DESKTOP)
    const header = page.locator('header')

    assert.isTrue(await header.getByRole('button', { name: 'Changer le thème' }).isVisible())
    assert.isTrue(await header.getByRole('link', { name: 'Connexion' }).isVisible())
    assert.equal(await header.getByRole('button', { name: 'Rechercher des cours' }).count(), 0)
    assert.equal(await header.getByRole('button', { name: 'Menu du compte' }).count(), 0)
    assert.equal(
      await header.getByRole('button', { name: 'Notifications (bientôt disponible)' }).count(),
      0
    )
    assert.equal(await page.locator('header h1').count(), 0)
  })

  test('student has the user zone but no site administration (HEADER-05)', async ({
    visit,
    assert,
  }) => {
    const page = await visit('/')
    await page.setViewportSize(DESKTOP)
    await login(page, 'student@edonis.test')
    const header = page.locator('header')

    assert.isTrue(await header.getByRole('button', { name: 'Rechercher des cours' }).isVisible())
    assert.isTrue(
      await header.getByRole('button', { name: 'Notifications (bientôt disponible)' }).isVisible()
    )
    assert.isTrue(
      await header.getByRole('button', { name: 'Messages (bientôt disponible)' }).isVisible()
    )
    assert.isTrue(await header.getByRole('button', { name: 'Menu du compte' }).isVisible())
    assert.equal(await header.getByRole('link', { name: 'Administration du site' }).count(), 0)

    await header.getByRole('button', { name: 'Menu du compte' }).click()
    const messages = page.getByRole('menuitem', {
      name: 'Messages personnels (bientôt disponible)',
    })
    await messages.waitFor()
    assert.equal(await messages.getAttribute('aria-disabled'), 'true')
    assert.equal(await page.getByRole('menuitem', { name: 'Administration du site' }).count(), 0)
  })

  test('admin user zone order, wrench to /admin, avatar menu (HEADER-01, ADMINHUB-02)', async ({
    visit,
    assert,
  }) => {
    const page = await visit('/')
    await page.setViewportSize(DESKTOP)
    await login(page, 'admin@edonis.test')
    const header = page.locator('header')

    const zone = [
      header.getByRole('link', { name: 'Administration du site' }),
      header.getByRole('button', { name: 'Rechercher des cours' }),
      header.getByRole('button', { name: 'Changer le thème' }),
      header.getByRole('button', { name: 'Notifications (bientôt disponible)' }),
      header.getByRole('button', { name: 'Messages (bientôt disponible)' }),
      header.getByRole('button', { name: 'Menu du compte' }),
    ]
    const xs: number[] = []
    for (const control of zone) {
      const box = await control.boundingBox()
      assert.isNotNull(box)
      xs.push(box!.x)
    }
    assert.deepEqual(
      xs,
      [...xs].sort((a, b) => a - b),
      'wrench → search → theme → bell → messages → avatar'
    )

    await header.getByRole('button', { name: 'Menu du compte' }).click()
    await page.getByRole('menuitem', { name: 'Administration du site' }).waitFor()
    assert.equal(await page.getByRole('menuitem', { name: 'Réglages de la plateforme' }).count(), 0)
    await page.keyboard.press('Escape')

    await page.getByRole('menu').waitFor({ state: 'hidden' })
    await Promise.all([
      page.waitForURL('**/admin', { timeout: 5000 }),
      header.getByRole('link', { name: 'Administration du site' }).click(),
    ])
    await page.assertPath('/admin')
  })

  test('placeholders show a tooltip on keyboard focus and do nothing (HEADER-04)', async ({
    visit,
    assert,
  }) => {
    const page = await visit('/')
    await page.setViewportSize(DESKTOP)
    await login(page, 'student@edonis.test')

    const bell = page
      .locator('header')
      .getByRole('button', { name: 'Notifications (bientôt disponible)' })
    assert.equal(await bell.getAttribute('aria-disabled'), 'true')

    await bell.focus()
    await page.getByRole('tooltip', { name: 'Bientôt disponible' }).waitFor()

    const before = page.url()
    // force: Playwright treats aria-disabled controls as not actionable
    await bell.click({ force: true })
    await page.waitForTimeout(300)
    assert.equal(page.url(), before)
  })

  test('search round-trip, blank query, Escape returns focus (HEADER-03)', async ({
    visit,
    assert,
  }) => {
    const admin = await User.findByOrFail('email', 'admin@edonis.test')
    const title = `Recherche entête ${Date.now()}`
    const course = await createCourse(admin, { title })
    try {
      const page = await visit('/')
      await page.setViewportSize(DESKTOP)
      await login(page, 'admin@edonis.test')
      const header = page.locator('header')

      await header.getByRole('button', { name: 'Rechercher des cours' }).click()
      await waitForFocus(page, 'searchbox', 'Rechercher des cours')
      await header.getByRole('searchbox', { name: 'Rechercher des cours' }).fill(title)
      await Promise.all([
        page.waitForURL(/\/courses\?search=/, { timeout: 5000 }),
        page.keyboard.press('Enter'),
      ])
      await page.getByText(title).first().waitFor()

      await header.getByRole('button', { name: 'Rechercher des cours' }).click()
      await waitForFocus(page, 'searchbox', 'Rechercher des cours')
      const before = page.url()
      await header.getByRole('searchbox', { name: 'Rechercher des cours' }).fill('   ')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(300)
      assert.equal(page.url(), before)

      await page.keyboard.press('Escape')
      await waitForFocus(page, 'button', 'Rechercher des cours')
      assert.equal(await header.getByRole('searchbox', { name: 'Rechercher des cours' }).count(), 0)
    } finally {
      await course.delete()
    }
  })

  test('edit-mode switch flow for the course owner (HEADER-06)', async ({ visit, assert }) => {
    const teacher = await User.findByOrFail('email', 'teacher@edonis.test')
    const course = await createCourse(teacher, { title: `Mode édition ${Date.now()}` })
    try {
      const page = await visit('/')
      await page.setViewportSize(DESKTOP)
      await login(page, 'teacher@edonis.test')

      const editSwitch = page.getByRole('switch', { name: "Mode d'édition" })

      // No course on the page, no switch
      assert.equal(await editSwitch.count(), 0)

      await page.goto(`/courses/${course.id}`)
      await editSwitch.waitFor()
      assert.equal(await editSwitch.getAttribute('aria-checked'), 'false')

      await Promise.all([
        page.waitForURL(`**/courses/${course.id}/builder`, { timeout: 5000 }),
        editSwitch.click(),
      ])
      await page.locator('#edit-mode-switch[aria-checked="true"]').waitFor()

      // D-19: the course page does not redirect to the builder while the mode is on
      await page.goto(`/courses/${course.id}`)
      await page.waitForLoadState('networkidle')
      await page.assertPath(`/courses/${course.id}`)
      assert.equal(await editSwitch.getAttribute('aria-checked'), 'true')

      await page.goto(`/courses/${course.id}/builder`)
      await editSwitch.waitFor()
      await Promise.all([
        page.waitForURL(`**/courses/${course.id}/learn`, { timeout: 5000 }),
        editSwitch.click(),
      ])
      await page.locator('#edit-mode-switch[aria-checked="false"]').waitFor()
    } finally {
      await course.delete()
    }
  })

  test('student on a public course sees no edit-mode switch (HEADER-06)', async ({
    visit,
    assert,
  }) => {
    const teacher = await User.findByOrFail('email', 'teacher@edonis.test')
    const course = await createCourse(teacher, { title: `Sans bascule ${Date.now()}` })
    try {
      const page = await visit('/')
      await page.setViewportSize(DESKTOP)
      await login(page, 'student@edonis.test')
      await page.goto(`/courses/${course.id}`)
      await page.waitForLoadState('networkidle')
      await page.assertPath(`/courses/${course.id}`)
      await page.getByText(course.title).first().waitFor()
      assert.equal(await page.getByRole('switch', { name: "Mode d'édition" }).count(), 0)
    } finally {
      await course.delete()
    }
  })

  test('visitor at 375px: ☰ panel holds nav and registration (HEADER-02)', async ({
    visit,
    assert,
  }) => {
    const page = await visit('/')
    await page.setViewportSize(MOBILE)
    const header = page.locator('header')

    assert.isTrue(await header.getByRole('link', { name: 'Connexion' }).isVisible())
    await header.getByRole('button', { name: 'Ouvrir le menu' }).click()

    const mobileNav = header.getByRole('navigation', { name: 'Navigation principale (mobile)' })
    await mobileNav.waitFor()
    assert.isAbove(await mobileNav.getByRole('link').count(), 0)
    assert.isTrue(await header.getByRole('link', { name: 'Inscription' }).isVisible())
    assert.equal(await header.getByRole('searchbox', { name: 'Rechercher des cours' }).count(), 0)
    assert.equal(await header.getByRole('link', { name: 'Administration du site' }).count(), 0)
    assert.equal(await header.getByRole('switch').count(), 0)
    assert.isTrue(await header.getByRole('link', { name: 'Connexion' }).isVisible())
  })

  test('admin at 375px: ☰ disclosure, Escape, navigation closes it (HEADER-02)', async ({
    visit,
    assert,
  }) => {
    const page = await visit('/')
    await page.setViewportSize(MOBILE)
    await login(page, 'admin@edonis.test')
    const header = page.locator('header')

    const open = header.getByRole('button', { name: 'Ouvrir le menu' })
    assert.equal(await open.getAttribute('aria-expanded'), 'false')
    for (const name of [
      'Notifications (bientôt disponible)',
      'Messages (bientôt disponible)',
      'Menu du compte',
    ]) {
      assert.isTrue(await header.getByRole('button', { name }).isVisible(), name)
    }

    await open.click()
    const close = header.getByRole('button', { name: 'Fermer le menu' })
    assert.equal(await close.getAttribute('aria-expanded'), 'true')
    const mobileNav = header.getByRole('navigation', { name: 'Navigation principale (mobile)' })
    await mobileNav.waitFor()
    assert.isTrue(await header.getByRole('searchbox', { name: 'Rechercher des cours' }).isVisible())
    assert.isTrue(await header.getByRole('link', { name: 'Tableau de bord' }).isVisible())
    assert.isTrue(await header.getByRole('link', { name: 'Administration du site' }).isVisible())

    await page.keyboard.press('Escape')
    await mobileNav.waitFor({ state: 'hidden' })
    await waitForFocus(page, 'button', 'Ouvrir le menu')

    for (const name of [
      'Notifications (bientôt disponible)',
      'Messages (bientôt disponible)',
      'Menu du compte',
    ]) {
      assert.isTrue(await header.getByRole('button', { name }).isVisible(), name)
    }

    await open.click()
    await Promise.all([
      page.waitForURL('**/courses', { timeout: 5000 }),
      mobileNav.getByRole('link', { name: 'Cours', exact: true }).click(),
    ])
    await mobileNav.waitFor({ state: 'hidden' })
    assert.equal(
      await header.getByRole('button', { name: 'Ouvrir le menu' }).getAttribute('aria-expanded'),
      'false'
    )
  })
})
