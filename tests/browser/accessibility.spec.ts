import { test } from '@japa/runner'
import AxeBuilder from '@axe-core/playwright'

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
})
