import { test } from '@japa/runner'

test.group('Navigation', () => {
  test('can visit home page', async ({ visit }) => {
    const page = await visit('/')

    await page.assertTextContains('h2', 'Edonis LMS')
    await page.assertExists('a[href="/login"]')
    await page.assertExists('a[href="/register"]')
  })

  test('guest can access public pages', async ({ visit }) => {
    // Home page
    const homePage = await visit('/')
    await homePage.assertStatus(200)

    // Login page
    await homePage.goto('/login')
    await homePage.assertPath('/login')

    // Register page
    await homePage.goto('/register')
    await homePage.assertPath('/register')
  })

  test('guest cannot access protected pages', async ({ visit }) => {
    const page = await visit('/dashboard')

    // Should redirect to login
    await page.waitForURL('/login')
    await page.assertPath('/login')
  })

  test('authenticated user can navigate dashboard', async ({ visit }) => {
    // Login
    const page = await visit('/login')
    await page.locator('input[type="email"]').fill('admin@edonis.test')
    await page.locator('input[type="password"]').fill('password')
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('/dashboard')

    // Should see dashboard content
    await page.assertTextContains('h1', 'Bienvenue')
    await page.assertExists('header')
  })

  test('role-based navigation visibility', async ({ visit }) => {
    // Login as admin
    const page = await visit('/login')
    await page.locator('input[type="email"]').fill('admin@edonis.test')
    await page.locator('input[type="password"]').fill('password')
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('/dashboard')

    // Admin should see user management link
    await page.assertExists('a[href="/admin/users"]')
  })
})
