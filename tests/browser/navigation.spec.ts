import { test } from '@japa/runner'

test.group('Navigation', () => {
  test('can visit home page', async ({ visit }) => {
    const page = await visit('/')

    // Check for elements that exist on the public home page
    await page.assertExists('h2:has-text("Pourquoi nous choisir")')
    await page.assertExists('a[href="/login"]')
    await page.assertExists('a[href="/register"]')
  })

  test('guest can access public pages', async ({ visit }) => {
    // Home page
    const homePage = await visit('/')
    await homePage.assertPath('/')

    // Login page
    await homePage.goto('/login')
    await homePage.waitForLoadState('networkidle')
    await homePage.assertPath('/login')

    // Register page
    await homePage.goto('/register')
    await homePage.waitForLoadState('networkidle')
    await homePage.assertPath('/register')
  })

  test('guest cannot access protected pages', async ({ visit }) => {
    const page = await visit('/dashboard')

    // Should redirect to login
    await page.waitForURL('**/login', { timeout: 5000 })
    await page.assertPath('/login')
  })

  test('authenticated user can navigate dashboard', async ({ visit }) => {
    // Login
    const page = await visit('/login')
    await page.locator('input[type="email"]').fill('admin@edonis.test')
    await page.locator('input[type="password"]').fill('password')

    await Promise.all([
      page.waitForURL('**/dashboard', { timeout: 5000 }),
      page.locator('button[type="submit"]').click(),
    ])

    // Should see dashboard content - use more specific selector to avoid ambiguity
    // The welcome message h1 is inside the user info section with class text-2xl
    await page.assertExists('h1.text-2xl:has-text("Bienvenue")')
    await page.assertExists('header')
  })

  test('role-based navigation visibility', async ({ visit }) => {
    // Login as admin
    const page = await visit('/login')
    await page.locator('input[type="email"]').fill('admin@edonis.test')
    await page.locator('input[type="password"]').fill('password')

    await Promise.all([
      page.waitForURL('**/dashboard', { timeout: 5000 }),
      page.locator('button[type="submit"]').click(),
    ])

    // Admin should see user management link
    await page.assertExists('a[href="/admin/users"]')
  })
})
