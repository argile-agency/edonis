import { test } from '@japa/runner'
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
test.group('Accessibility', () => {
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

      const check = async (state: string) => {
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze()
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

      await check('at rest')

      await page
        .locator(`[data-row-key="c-${content.id}"]`)
        .getByRole('button', { name: 'Détails', exact: true })
        .click()
      await check('details panel open')

      await page.getByRole('button', { name: 'Actions pour « Contenu A11y »' }).click()
      await page.getByRole('menuitem', { name: 'Déplacer vers…' }).waitFor()
      await check('actions menu open')

      await page.getByRole('menuitem', { name: 'Déplacer vers…' }).click()
      await page.getByRole('dialog').waitFor()
      await check('move dialog open')

      await page.keyboard.press('Escape')
      await page.getByRole('dialog').waitFor({ state: 'hidden' })
      await page.getByRole('checkbox', { name: 'Tout sélectionner', exact: true }).click()
      await page.getByRole('group', { name: 'Actions sur la sélection' }).waitFor()
      await check('selection with bulk bar')
    } finally {
      await course.delete()
    }
  })
})
