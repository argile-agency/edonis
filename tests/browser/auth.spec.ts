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
    await page.locator('button[type="submit"]').click()

    await page.waitForURL('/dashboard')
    await page.assertPath('/dashboard')
  })

  test('shows validation errors on invalid login', async ({ visit }) => {
    const page = await visit('/login')

    await page.locator('input[type="email"]').fill('invalid@example.com')
    await page.locator('input[type="password"]').fill('wrongpassword')
    await page.locator('button[type="submit"]').click()

    // Should stay on login page
    await page.assertPath('/login')
  })

  test('can navigate to register page', async ({ visit }) => {
    const page = await visit('/login')

    await page.locator('a[href="/register"]').click()
    await page.waitForURL('/register')
    await page.assertPath('/register')
    await page.assertTextContains('h2', 'Inscription')
  })

  test('can logout successfully', async ({ visit }) => {
    // First login
    const page = await visit('/login')
    await page.locator('input[type="email"]').fill('admin@edonis.test')
    await page.locator('input[type="password"]').fill('password')
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('/dashboard')

    // Then logout
    await page.locator('button:has-text("Déconnexion")').click()
    await page.waitForURL('/login')
    await page.assertPath('/login')
  })
})
