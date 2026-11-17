import { test } from '@japa/runner'
import limiter from '@adonisjs/limiter/services/main'

/**
 * Guards the fix for GHSA-6qvv-pj99-48qm (open redirect through the Referer
 * header in `response.redirect().back()`), shipped in @adonisjs/http-server
 * 7.8.1: a referrer from another host must fall back to "/".
 *
 * Route under test: POST /login with wrong credentials (redirects back).
 */
test.group('Redirect back - referrer validation', (group) => {
  // POST /login sits behind the per-IP loginThrottle (5/min)
  group.each.setup(() => limiter.clear())

  const failedLogin = (client: any, referer: string) =>
    client
      .post('/login')
      .withCsrfToken()
      .header('referer', referer)
      .form({ email: 'nobody@edonis.test', password: 'wrong-password' })
      .redirects(0)

  test('a referrer from another host falls back to /', async ({ client, assert }) => {
    const response = await failedLogin(client, 'https://evil.example/phish')

    response.assertStatus(302)
    assert.equal(response.header('location'), '/')
  })

  test('a same-host referrer is still honoured', async ({ client, assert }) => {
    const host = `${process.env.HOST}:${process.env.PORT}`
    const response = await failedLogin(client, `http://${host}/login`)

    response.assertStatus(302)
    assert.equal(response.header('location'), '/login')
  })
})
