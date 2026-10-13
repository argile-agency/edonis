import { test } from '@japa/runner'
import { AxeBuilder } from '@axe-core/playwright'
import User from '#models/user'
import Course from '#models/course'
import CourseEnrollment from '#models/course_enrollment'

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
})
