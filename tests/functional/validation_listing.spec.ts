import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import router from '@adonisjs/core/services/router'
import type { ApiResponse } from '@japa/api-client'
import User from '#models/user'
import {
  assertNotCsrfRejected,
  createUser,
  ensureRole,
  uniqueSuffix,
} from '#tests/functional/helpers/factories'

/**
 * Array element errors are flashed under the literal key `roleIds.0`, so they
 * must be read from the bag directly rather than through a dotted
 * `flashMessage` path.
 */
function inputError(response: ApiResponse, field: string): unknown {
  const bag = response.flashMessages().inputErrorsBag as Record<string, unknown> | undefined
  return bag?.[field]
}

/**
 * Validation of the admin listings (V15 users.index limit, V16 audit-log
 * filters), role-id existence on users.store, the avatar VineJS file rule (V13),
 * the account password validator move, and the global numeric route-param
 * matchers.
 *
 * Every request uses `.withInertia()` or `.redirects(0)`, so no full-HTML
 * render (and no Vite manifest) is ever needed. Every rejected write asserts a
 * field-specific `inputErrorsBag` key or an exact flash, which a CSRF
 * rejection cannot produce.
 */
test.group('Listings, uploads and route params - validation', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('users.index rejects an unbounded limit and accepts a bounded one', async ({
    client,
    route,
    assert,
  }) => {
    const admin = await createUser({ roles: ['admin'] })

    const tooBig = await client
      .get(route('users.index'))
      .qs({ limit: 1000000 })
      .withInertia()
      .loginAs(admin)
      .redirects(0)

    tooBig.assertStatus(302)
    assert.isDefined(tooBig.flashMessage('inputErrorsBag.limit'))

    const bounded = await client
      .get(route('users.index'))
      .qs({ limit: 10 })
      .withInertia()
      .loginAs(admin)
      .redirects(0)

    bounded.assertStatus(200)
    bounded.assertInertiaComponent('users/index')
    assert.equal(bounded.inertiaProps.users.meta.perPage, 10)
  })

  test('users.index accepts the empty filters the listing page sends', async ({
    client,
    route,
  }) => {
    const admin = await createUser({ roles: ['admin'] })

    // The users page submits `?search=&role=&status=` when no filter is set.
    // Query strings are not converted to null by the bodyparser, so the
    // validator must treat '' as "no filter".
    const response = await client
      .get(route('users.index'))
      .qs({ search: '', role: '', status: '' })
      .withInertia()
      .loginAs(admin)
      .redirects(0)

    response.assertStatus(200)
    response.assertInertiaComponent('users/index')
  })

  test('audit-logs rejects a malformed dateFrom and echoes a valid one', async ({
    client,
    route,
    assert,
  }) => {
    const admin = await createUser({ roles: ['admin'] })

    const malformed = await client
      .get(route('admin.audit-logs'))
      .qs({ dateFrom: 'notadate' })
      .withInertia()
      .loginAs(admin)
      .redirects(0)

    malformed.assertStatus(302)
    assert.isDefined(malformed.flashMessage('inputErrorsBag.dateFrom'))

    const valid = await client
      .get(route('admin.audit-logs'))
      .qs({ dateFrom: '2026-01-01', dateTo: '2026-12-31' })
      .withInertia()
      .loginAs(admin)
      .redirects(0)

    valid.assertStatus(200)
    valid.assertInertiaComponent('admin/audit-logs')
    assert.equal(valid.inertiaProps.filters.dateFrom, '2026-01-01')
    assert.equal(valid.inertiaProps.filters.dateTo, '2026-12-31')
    assert.equal(valid.inertiaProps.filters.userId, '')
  })

  test('audit-logs rejects a non-numeric userId', async ({ client, route, assert }) => {
    const admin = await createUser({ roles: ['admin'] })

    const response = await client
      .get(route('admin.audit-logs'))
      .qs({ userId: 'abc' })
      .withInertia()
      .loginAs(admin)
      .redirects(0)

    response.assertStatus(302)
    assert.isDefined(response.flashMessage('inputErrorsBag.userId'))
  })

  test('users.store rejects a role id that does not exist', async ({ client, route, assert }) => {
    const admin = await createUser({ roles: ['admin'] })
    const email = `ghost-role-${uniqueSuffix()}@test.com`

    // JSON body, like the Inertia form: the urlencoded serializer flattens a
    // one-element array to a scalar, which would fail on "must be an array".
    const request = client.post(route('users.store')).withCsrfToken()
    const response = await request
      .loginAs(admin)
      .redirects(0)
      .json({
        fullName: 'Ghost Role',
        email,
        password: 'password123',
        roleIds: [999999],
      })

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.isDefined(inputError(response, 'roleIds.0'))
    assert.isNull(await User.findBy('email', email))
  })

  test('users.store with an existing role id creates the user', async ({
    client,
    route,
    assert,
  }) => {
    const admin = await createUser({ roles: ['admin'] })
    const studentRole = await ensureRole('student')
    const email = `real-role-${uniqueSuffix()}@test.com`

    const request = client.post(route('users.store')).withCsrfToken()
    const response = await request
      .loginAs(admin)
      .redirects(0)
      .json({
        fullName: 'Real Role',
        email,
        password: 'password123',
        roleIds: [studentRole.id],
      })

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.isUndefined(inputError(response, 'roleIds.0'))

    const created = await User.findBy('email', email)
    assert.isNotNull(created)
    await created!.load('roles')
    assert.deepEqual(
      created!.roles.map((role) => role.id),
      [studentRole.id]
    )
  })

  test('avatar upload rejects a non-image file', async ({ client, route, assert }) => {
    const user = await createUser({ roles: ['student'] })
    const before = user.avatarUrl

    const request = client.post(route('user.profile.avatar.update')).withCsrfToken()
    const response = await request
      .loginAs(user)
      .redirects(0)
      .file('avatar', Buffer.from('not an image'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.isDefined(response.flashMessage('inputErrorsBag.avatar'))

    await user.refresh()
    assert.equal(user.avatarUrl, before)
  })

  test('a non-numeric course id is a 404 at the router', async ({ client, route, assert }) => {
    const student = await createUser({ roles: ['student'] })

    // The route table itself rejects the param. On SQLite `where id = 'abc'`
    // already returned no row before the matchers, so the HTTP 404 alone does
    // not prove the matcher; this does.
    assert.isNull(router.match('/courses/abc', 'GET'))
    assert.equal(router.match('/courses/1', 'GET')?.route.name, 'courses.show')

    const response = await client
      .get(route('courses.index') + '/abc')
      .withInertia()
      .loginAs(student)

    response.assertStatus(404)
    response.assertInertiaComponent('errors/not_found')
  })

  test('account deletion with a wrong password is refused', async ({ client, route, assert }) => {
    const user = await createUser({ roles: ['student'] })

    const request = client.delete(route('user.account.delete')).withCsrfToken()
    const response = await request.loginAs(user).redirects(0).form({ password: 'wrong-password' })

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.equal(response.flashMessage('error'), 'Mot de passe incorrect')
    // Deletion anonymizes, so check the email too, not only that the row exists.
    const after = await User.find(user.id)
    assert.isNotNull(after)
    assert.equal(after!.email, user.email)
  })
})
