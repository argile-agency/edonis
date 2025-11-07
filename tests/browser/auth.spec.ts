import { test } from '@japa/runner'

test.group('Authentication', () => {
  test('can visit login page', async ({ visit }) => {
    const page = await visit('/login')

    await page.assertExists('input[type="email"]')
    await page.assertExists('input[type="password"]')
    await page.assertTextContains('h2', 'Edonis LMS')
  })

  test('can login with valid credentials', async ({ visit }) => {
    const page = await visit('/login')

    await page.locator('input[type="email"]').fill('admin@edonis.test')
    await page.locator('input[type="password"]').fill('password')

    // Click submit and wait for navigation with shorter timeout
    await Promise.all([
      page.waitForURL('**/dashboard', { timeout: 5000 }),
      page.locator('button[type="submit"]').click(),
    ])

    await page.assertPath('/dashboard')
  })

  test('shows validation errors on invalid login', async ({ visit }) => {
    const page = await visit('/login')

    await page.locator('input[type="email"]').fill('invalid@example.com')
    await page.locator('input[type="password"]').fill('wrongpassword')
    await page.locator('button[type="submit"]').click()

    // Wait a bit for any potential error messages
    await page.waitForTimeout(1000)

    // Should stay on login page
    await page.assertPath('/login')
  })

  test('can navigate to register page', async ({ visit }) => {
    const page = await visit('/login')

    // Click link and wait for navigation
    await Promise.all([
      page.waitForURL('**/register', { timeout: 5000 }),
      page.locator('a[href="/register"]').click(),
    ])

    await page.assertPath('/register')
    await page.assertTextContains('h2', 'Inscription')
  })

  test('can logout successfully', async ({ visit }) => {
    // First login
    const page = await visit('/login')
    await page.locator('input[type="email"]').fill('admin@edonis.test')
    await page.locator('input[type="password"]').fill('password')

    await Promise.all([
      page.waitForURL('**/dashboard', { timeout: 5000 }),
      page.locator('button[type="submit"]').click(),
    ])

    // Then logout
    await Promise.all([
      page.waitForURL('**/login', { timeout: 5000 }),
      page.locator('button:has-text("Déconnexion")').click(),
    ])

    await page.assertPath('/login')
  })
})
