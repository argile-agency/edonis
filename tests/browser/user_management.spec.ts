import { test } from '@japa/runner'

test.group('User Management', () => {
  test('admin can access users list', async ({ visit }) => {
    // Login as admin first
    const page = await visit('/login')
    await page.locator('input[type="email"]').fill('admin@edonis.test')
    await page.locator('input[type="password"]').fill('password')

    await Promise.all([
      page.waitForURL('**/dashboard', { timeout: 5000 }),
      page.locator('button[type="submit"]').click(),
    ])

    // Navigate to users
    await Promise.all([
      page.waitForURL('**/admin/users', { timeout: 5000 }),
      page.locator('a[href="/admin/users"]').click(),
    ])

    await page.assertTextContains('h1', 'Gestion des utilisateurs')
    await page.assertExists('table')
  })

  test('can search for users', async ({ visit }) => {
    // Login as admin
    const page = await visit('/login')
    await page.locator('input[type="email"]').fill('admin@edonis.test')
    await page.locator('input[type="password"]').fill('password')

    await Promise.all([
      page.waitForURL('**/dashboard', { timeout: 5000 }),
      page.locator('button[type="submit"]').click(),
    ])

    // Navigate to users
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')

    // Search for a user
    await page.locator('input[placeholder*="Nom, email"]').fill('admin')
    await page.locator('button:has-text("Filtrer")').click()
    await page.waitForTimeout(500)

    // Should show filtered results
    await page.assertExists('table tbody tr')
  })

  test('can filter users by role', async ({ visit }) => {
    // Login as admin
    const page = await visit('/login')
    await page.locator('input[type="email"]').fill('admin@edonis.test')
    await page.locator('input[type="password"]').fill('password')

    await Promise.all([
      page.waitForURL('**/dashboard', { timeout: 5000 }),
      page.locator('button[type="submit"]').click(),
    ])

    // Navigate to users
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')

    // Filter by role - shadcn/ui uses Radix UI Select, not native select
    // Click on the role select trigger to open the dropdown
    await page.locator('button#role').click()
    // Wait for dropdown to appear and select "Administrateur"
    await page.locator('[role="option"]:has-text("Administrateur")').click()
    await page.locator('button:has-text("Filtrer")').click()
    await page.waitForTimeout(500)

    // Should show filtered results
    await page.assertExists('table tbody tr')
  })

  test('can navigate to create user page', async ({ visit }) => {
    // Login as admin
    const page = await visit('/login')
    await page.locator('input[type="email"]').fill('admin@edonis.test')
    await page.locator('input[type="password"]').fill('password')

    await Promise.all([
      page.waitForURL('**/dashboard', { timeout: 5000 }),
      page.locator('button[type="submit"]').click(),
    ])

    // Navigate to users
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')

    // Click create user button
    await Promise.all([
      page.waitForURL('**/admin/users/create', { timeout: 5000 }),
      page.locator('a[href="/admin/users/create"]').click(),
    ])

    await page.assertTextContains('h1', 'Créer un utilisateur')
    await page.assertExists('input#fullName')
    await page.assertExists('input#email')
  })

  test('can view user details', async ({ visit }) => {
    // Login as admin
    const page = await visit('/login')
    await page.locator('input[type="email"]').fill('admin@edonis.test')
    await page.locator('input[type="password"]').fill('password')

    await Promise.all([
      page.waitForURL('**/dashboard', { timeout: 5000 }),
      page.locator('button[type="submit"]').click(),
    ])

    // Navigate to users
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')

    // Click first "Voir" button and wait for navigation
    await page.locator('a:has-text("Voir")').first().click()
    await page.waitForTimeout(1000)

    // Should be on user detail page
    await page.assertUrlContains('/admin/users/')
    await page.assertTextContains('h2', 'Informations personnelles')
  })
})
