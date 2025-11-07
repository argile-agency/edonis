import { test } from '@japa/runner'

test.group('User Management', () => {
  test('admin can access users list', async ({ visit }) => {
    // Login as admin first
    const page = await visit('/login')
    await page.locator('input[type="email"]').fill('admin@edonis.test')
    await page.locator('input[type="password"]').fill('password')
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('/dashboard')

    // Navigate to users
    await page.locator('a[href="/admin/users"]').click()
    await page.waitForURL('/admin/users')

    await page.assertTextContains('h1', 'Gestion des utilisateurs')
    await page.assertExists('table')
  })

  test('can search for users', async ({ visit }) => {
    // Login as admin
    const page = await visit('/login')
    await page.locator('input[type="email"]').fill('admin@edonis.test')
    await page.locator('input[type="password"]').fill('password')
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('/dashboard')

    // Navigate to users
    await page.goto('/admin/users')

    // Search for a user
    await page.locator('input[placeholder*="Nom, email"]').fill('admin')
    await page.locator('button:has-text("Filtrer")').click()

    // Should show filtered results
    await page.assertExists('table tbody tr')
  })

  test('can filter users by role', async ({ visit }) => {
    // Login as admin
    const page = await visit('/login')
    await page.locator('input[type="email"]').fill('admin@edonis.test')
    await page.locator('input[type="password"]').fill('password')
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('/dashboard')

    // Navigate to users
    await page.goto('/admin/users')

    // Filter by role
    await page.locator('select#role').selectOption('admin')
    await page.locator('button:has-text("Filtrer")').click()

    // Should show filtered results
    await page.assertExists('table tbody tr')
  })

  test('can navigate to create user page', async ({ visit }) => {
    // Login as admin
    const page = await visit('/login')
    await page.locator('input[type="email"]').fill('admin@edonis.test')
    await page.locator('input[type="password"]').fill('password')
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('/dashboard')

    // Navigate to users
    await page.goto('/admin/users')

    // Click create user button
    await page.locator('a[href="/admin/users/create"]').click()
    await page.waitForURL('/admin/users/create')

    await page.assertTextContains('h1', 'Créer un utilisateur')
    await page.assertExists('input#fullName')
    await page.assertExists('input#email')
  })

  test('can view user details', async ({ visit }) => {
    // Login as admin
    const page = await visit('/login')
    await page.locator('input[type="email"]').fill('admin@edonis.test')
    await page.locator('input[type="password"]').fill('password')
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('/dashboard')

    // Navigate to users
    await page.goto('/admin/users')

    // Click first "Voir" button
    await page.locator('a:has-text("Voir")').first().click()

    // Should be on user detail page
    await page.assertUrlContains('/admin/users/')
    await page.assertTextContains('h2', 'Informations personnelles')
  })
})
