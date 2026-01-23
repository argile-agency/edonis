# Browser Tests

End-to-end browser tests using Japa Browser Client (powered by Playwright).

## Running Tests

```bash
# Run all browser tests
bun test browser

# Run all tests (unit + functional + browser)
bun test

# Run with headed browser (see the browser)
node ace test browser --headed

# Run specific browser
node ace test browser --browser=firefox
node ace test browser --browser=webkit

# Run with debugging
node ace test browser --debug
```

## Test Structure

- `auth.spec.ts` - Authentication flows (login, register, logout)
- `user_management.spec.ts` - Admin user management features
- `navigation.spec.ts` - Page navigation and access control

## Writing Browser Tests

```typescript
import { test } from '@japa/runner'

test.group('Feature Name', () => {
  test('test description', async ({ visit }) => {
    const page = await visit('/path')

    // Interact with elements
    await page.locator('button').click()
    await page.locator('input').fill('text')

    // Assertions
    await page.assertPath('/expected-path')
    await page.assertTextContains('selector', 'text')
    await page.assertExists('selector')
  })
})
```

## Available Assertions

- `assertPath(path)` - Assert current URL path
- `assertUrl(url)` - Assert full URL
- `assertUrlContains(text)` - Assert URL contains text
- `assertTextContains(selector, text)` - Assert element contains text
- `assertExists(selector)` - Assert element exists
- `assertNotExists(selector)` - Assert element doesn't exist
- `assertVisible(selector)` - Assert element is visible
- `assertHidden(selector)` - Assert element is hidden
- `assertStatus(code)` - Assert HTTP status code

## Tips

1. **Wait for navigation**: Use `await page.waitForURL('/path')` after clicks that navigate
2. **Selectors**: Use data-testid attributes for stable selectors
3. **Authentication**: Helper methods available in the future for quick login
4. **Cleanup**: Tests run in isolated browser contexts, auto-cleanup happens

## CI/CD

Browser tests run automatically in CI with headless browsers. Make sure to:

- Keep tests fast (< 30s per test)
- Use proper waiting strategies
- Avoid hardcoded sleeps, use `waitForURL` or `waitForSelector`

## Debugging Failed Tests

```bash
# Enable trace recording
node ace test browser --trace=on

# Take screenshots on failure (automatic in CI)
node ace test browser --screenshot=on

# Run in headed mode to see what's happening
node ace test browser --headed
```
