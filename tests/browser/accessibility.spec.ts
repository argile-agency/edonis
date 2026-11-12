import { test } from '@japa/runner'
import type { Assert } from '@japa/assert'
import type { Page } from 'playwright'
import limiter from '@adonisjs/limiter/services/main'
import { AxeBuilder } from '@axe-core/playwright'
import User from '#models/user'
import Course from '#models/course'
import CourseEnrollment from '#models/course_enrollment'
import CourseModule from '#models/course_module'
import CourseContent from '#models/course_content'
import { createCourse } from '#tests/functional/helpers/factories'

/**
 * Accessibility tests using axe-core.
 * Checks critical and serious WCAG violations on key pages.
 */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

async function loginAs(page: Page, email: string) {
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

async function assertNoSeriousViolations(page: Page, assert: Assert, state: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze()
  const critical = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  )
  if (critical.length > 0) {
    console.log(
      `${state} a11y violations:`,
      critical.map((v) => `${v.id}: ${v.description} (${v.impact})`)
    )
  }
  assert.equal(critical.length, 0, `${state}: ${critical.length} critical/serious a11y violations`)
}

test.group('Accessibility', (group) => {
  // The server runs in this process: reset the per-IP loginThrottle (5/min) between tests.
  group.each.setup(() => limiter.clear())

  test('login page has no critical a11y violations', async ({ visit, assert }) => {
    const page = await visit('/login')
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )

    if (critical.length > 0) {
      console.log(
        'Login a11y violations:',
        critical.map((v) => `${v.id}: ${v.description} (${v.impact})`)
      )
    }

    assert.equal(critical.length, 0, `Found ${critical.length} critical/serious a11y violations`)
  })

  test('register page has no critical a11y violations', async ({ visit, assert }) => {
    const page = await visit('/register')
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )

    if (critical.length > 0) {
      console.log(
        'Register a11y violations:',
        critical.map((v) => `${v.id}: ${v.description} (${v.impact})`)
      )
    }

    assert.equal(critical.length, 0, `Found ${critical.length} critical/serious a11y violations`)
  })

  test('dashboard has no critical a11y violations', async ({ visit, assert }) => {
    // Login first
    const page = await visit('/login')
    await page.locator('input[type="email"]').fill('admin@edonis.test')
    await page.locator('input[type="password"]').fill('password')
    await Promise.all([
      page.waitForURL('**/dashboard', { timeout: 5000 }),
      page.locator('button[type="submit"]').click(),
    ])

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )

    if (critical.length > 0) {
      console.log(
        'Dashboard a11y violations:',
        critical.map((v) => `${v.id}: ${v.description} (${v.impact})`)
      )
    }

    assert.equal(critical.length, 0, `Found ${critical.length} critical/serious a11y violations`)
  })

  test('profile page has no critical a11y violations', async ({ visit, assert }) => {
    // Login first
    const page = await visit('/login')
    await page.locator('input[type="email"]').fill('admin@edonis.test')
    await page.locator('input[type="password"]').fill('password')
    await Promise.all([
      page.waitForURL('**/dashboard', { timeout: 5000 }),
      page.locator('button[type="submit"]').click(),
    ])

    await page.goto('/user/profile')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )

    if (critical.length > 0) {
      console.log(
        'Profile a11y violations:',
        critical.map((v) => `${v.id}: ${v.description} (${v.impact})`)
      )
    }

    assert.equal(critical.length, 0, `Found ${critical.length} critical/serious a11y violations`)
  })

  test('courses page has no critical a11y violations', async ({ visit, assert }) => {
    // Login first
    const page = await visit('/login')
    await page.locator('input[type="email"]').fill('admin@edonis.test')
    await page.locator('input[type="password"]').fill('password')
    await Promise.all([
      page.waitForURL('**/dashboard', { timeout: 5000 }),
      page.locator('button[type="submit"]').click(),
    ])

    await page.goto('/courses')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )

    if (critical.length > 0) {
      console.log(
        'Courses a11y violations:',
        critical.map((v) => `${v.id}: ${v.description} (${v.impact})`)
      )
    }

    assert.equal(critical.length, 0, `Found ${critical.length} critical/serious a11y violations`)
  })

  test('forbidden page has no critical a11y violations', async ({ visit, assert }) => {
    // Pick a seeded course the student neither owns nor is enrolled in
    const student = await User.findByOrFail('email', 'student@edonis.test')
    const enrollments = await CourseEnrollment.query().where('user_id', student.id)
    const enrolledIds = enrollments.map((enrollment) => enrollment.courseId)
    const forbiddenCourse = await Course.query()
      .whereNot('instructor_id', student.id)
      .whereNotIn('id', enrolledIds)
      .orderBy('id', 'asc')
      .first()

    if (!forbiddenCourse) {
      assert.fail(
        'No seeded course found that student@edonis.test neither owns nor is enrolled in. ' +
          'Run course_seeder and student_enrollment_seeder (node ace db:seed) first.'
      )
      return
    }

    // Login first
    const page = await visit('/login')
    await page.locator('input[type="email"]').fill('student@edonis.test')
    await page.locator('input[type="password"]').fill('password')
    await Promise.all([
      page.waitForURL('**/dashboard', { timeout: 5000 }),
      page.locator('button[type="submit"]').click(),
    ])

    await page.goto('/grades/courses/' + forbiddenCourse.id)
    await page.waitForLoadState('networkidle')

    const bodyText = await page.locator('body').innerText()
    assert.include(bodyText, '403')
    // Proves the Inertia errors/forbidden page rendered, not the Edge fallback
    assert.include(bodyText, 'Accès refusé')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )

    if (critical.length > 0) {
      console.log(
        'Forbidden page a11y violations:',
        critical.map((v) => `${v.id}: ${v.description} (${v.impact})`)
      )
    }

    assert.equal(critical.length, 0, `Found ${critical.length} critical/serious a11y violations`)
  })

  test('course builder has no critical a11y violations', async ({ visit, assert }) => {
    // Own fixture course (seeded users untouched); sections and contents cascade on delete.
    const teacher = await User.findByOrFail('email', 'teacher@edonis.test')
    const course = await createCourse(teacher)
    try {
      const section = await CourseModule.create({
        courseId: course.id,
        title: 'Section A11y',
        order: 1,
        isPublished: true,
      })
      await CourseModule.create({
        courseId: course.id,
        title: 'Section vide',
        order: 2,
        isPublished: true,
      })
      const content = await CourseContent.create({
        moduleId: section.id,
        contentType: 'page',
        title: 'Contenu A11y',
        content: 'Corps',
        order: 1,
        isPublished: true,
      })

      const page = await visit('/login')
      await page.locator('input[type="email"]').fill('teacher@edonis.test')
      await page.locator('input[type="password"]').fill('password')
      await Promise.all([
        page.waitForURL('**/dashboard', { timeout: 5000 }),
        page.locator('button[type="submit"]').click(),
      ])
      await page.goto(`/courses/${course.id}/builder`)
      await page.waitForLoadState('networkidle')

      const wcag = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
      const check = (state: string, results: Awaited<ReturnType<AxeBuilder['analyze']>>) => {
        const critical = results.violations.filter(
          (v) => v.impact === 'critical' || v.impact === 'serious'
        )
        if (critical.length > 0) {
          console.log(
            `Builder (${state}) a11y violations:`,
            critical.map((v) => `${v.id}: ${v.description} (${v.impact})`)
          )
        }
        assert.equal(
          critical.length,
          0,
          `Builder (${state}): ${critical.length} critical/serious a11y violations`
        )
      }

      check('at rest', await new AxeBuilder({ page }).withTags(wcag).analyze())

      await page
        .locator(`[data-row-key="c-${content.id}"]`)
        .getByRole('button', { name: 'Détails', exact: true })
        .click()
      check('details panel open', await new AxeBuilder({ page }).withTags(wcag).analyze())

      await page.getByRole('button', { name: 'Actions pour « Contenu A11y »' }).click()
      await page.getByRole('menuitem', { name: 'Déplacer vers…' }).waitFor()
      check('actions menu open', await new AxeBuilder({ page }).withTags(wcag).analyze())

      await page.getByRole('menuitem', { name: 'Déplacer vers…' }).click()
      await page.getByRole('dialog').waitFor()
      check('move dialog open', await new AxeBuilder({ page }).withTags(wcag).analyze())

      await page.keyboard.press('Escape')
      await page.getByRole('dialog').waitFor({ state: 'hidden' })
      await page.getByRole('checkbox', { name: 'Tout sélectionner', exact: true }).click()
      await page.getByRole('group', { name: 'Actions sur la sélection' }).waitFor()
      check('selection with bulk bar', await new AxeBuilder({ page }).withTags(wcag).analyze())
    } finally {
      await course.delete()
    }
  })

  test('admin settings page has no critical a11y violations', async ({ visit, assert }) => {
    const page = await visit('/login')
    await page.locator('input[type="email"]').fill('admin@edonis.test')
    await page.locator('input[type="password"]').fill('password')
    await Promise.all([
      page.waitForURL('**/dashboard', { timeout: 5000 }),
      page.locator('button[type="submit"]').click(),
    ])
    // Read-only: nothing is saved, so seeded allowRegistration stays true for other specs.
    await page.goto('/admin/settings')
    await page.waitForLoadState('networkidle')

    const wcag = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
    const check = (state: string, results: Awaited<ReturnType<AxeBuilder['analyze']>>) => {
      const critical = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      )
      if (critical.length > 0) {
        console.log(
          `Settings (${state}) a11y violations:`,
          critical.map((v) => `${v.id}: ${v.description} (${v.impact})`)
        )
      }
      assert.equal(
        critical.length,
        0,
        `Settings (${state}): ${critical.length} critical/serious a11y violations`
      )
    }

    check('Apparence', await new AxeBuilder({ page }).withTags(wcag).analyze())

    await page.getByRole('tab', { name: "Page d'accueil" }).click()
    await page.getByRole('tab', { name: "Page d'accueil", selected: true }).waitFor()
    check("Page d'accueil", await new AxeBuilder({ page }).withTags(wcag).analyze())

    await page.getByRole('tab', { name: 'Accès' }).click()
    await page.getByRole('tab', { name: 'Accès', selected: true }).waitFor()
    check('Accès', await new AxeBuilder({ page }).withTags(wcag).analyze())

    await page.getByRole('tab', { name: 'Contact et support' }).click()
    await page.getByRole('tab', { name: 'Contact et support', selected: true }).waitFor()
    check('Contact et support', await new AxeBuilder({ page }).withTags(wcag).analyze())

    await page.getByRole('tab', { name: 'Corbeille' }).click()
    await page.getByRole('tab', { name: 'Corbeille', selected: true }).waitFor()
    check('Corbeille', await new AxeBuilder({ page }).withTags(wcag).analyze())
  })

  test('site administration hub has no critical a11y violations', async ({ visit, assert }) => {
    const page = await visit('/')
    await page.setViewportSize({ width: 1440, height: 900 })
    await loginAs(page, 'admin@edonis.test')
    await page.goto('/admin')
    await page.getByRole('heading', { name: 'Administration du site', level: 1 }).waitFor()

    await assertNoSeriousViolations(page, assert, 'Hub (Général)')
    for (const tab of ['Utilisateurs', 'Cours']) {
      await page.getByRole('tab', { name: tab }).click()
      await page.getByRole('tab', { name: tab, selected: true }).waitFor()
      await assertNoSeriousViolations(page, assert, `Hub (${tab})`)
    }
  })

  test('course page with the edit-mode switch has no critical a11y violations', async ({
    visit,
    assert,
  }) => {
    const teacher = await User.findByOrFail('email', 'teacher@edonis.test')
    const course = await createCourse(teacher)
    try {
      const page = await visit('/')
      await page.setViewportSize({ width: 1440, height: 900 })
      await loginAs(page, 'admin@edonis.test')
      await page.goto(`/courses/${course.id}`)
      await page.getByRole('switch', { name: "Mode d'édition" }).waitFor()
      await assertNoSeriousViolations(page, assert, 'Course page with switch')
    } finally {
      await course.delete()
    }
  })

  test('header with the search open has no critical a11y violations', async ({ visit, assert }) => {
    const page = await visit('/')
    await page.setViewportSize({ width: 1440, height: 900 })
    await loginAs(page, 'admin@edonis.test')
    await page.locator('header').getByRole('button', { name: 'Rechercher des cours' }).click()
    await page.locator('header').getByRole('searchbox', { name: 'Rechercher des cours' }).waitFor()
    await assertNoSeriousViolations(page, assert, 'Search open')
  })

  test('375px header panel on a course page has no critical a11y violations', async ({
    visit,
    assert,
  }) => {
    const teacher = await User.findByOrFail('email', 'teacher@edonis.test')
    const course = await createCourse(teacher)
    try {
      const page = await visit('/')
      await page.setViewportSize({ width: 375, height: 800 })
      await loginAs(page, 'admin@edonis.test')
      await page.goto(`/courses/${course.id}`)
      await page.getByRole('button', { name: 'Ouvrir le menu' }).click()
      const panel = page.locator('#mobile-menu')
      await panel.getByRole('link', { name: 'Administration du site' }).waitFor()
      await panel.getByRole('switch', { name: "Mode d'édition" }).waitFor()
      await assertNoSeriousViolations(page, assert, 'Mobile panel open')
    } finally {
      await course.delete()
    }
  })
})
