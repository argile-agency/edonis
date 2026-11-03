import { test } from '@japa/runner'
import edge from 'edge.js'

// Renders the partial directly: a full-page GET needs a built Vite manifest.
const render = (appSettings: unknown) =>
  edge.render('partials/favicon', { page: { props: { appSettings } } })

test.group('favicon partial', () => {
  test('emits the icon link when a favicon URL is set', async ({ assert }) => {
    const html = await render({ appFaviconUrl: '/icons/icon-192.png' })
    assert.include(html, '<link rel="icon" href="/icons/icon-192.png" />')
  })

  test('emits nothing without a favicon URL or without settings', async ({ assert }) => {
    assert.notInclude(await render({ appFaviconUrl: null }), 'rel="icon"')
    assert.notInclude(await render(null), 'rel="icon"')
  })

  test('escapes the URL', async ({ assert }) => {
    const html = await render({ appFaviconUrl: '/x"><script>alert(1)</script>' })
    assert.include(html, '&quot;')
    assert.notInclude(html, '<script>')
  })
})
