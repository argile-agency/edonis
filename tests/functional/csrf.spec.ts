import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import AuditLog from '#models/audit_log'
import CourseModule from '#models/course_module'
import {
  assertNotCsrfRejected,
  createCourse,
  createUser,
} from '#tests/functional/helpers/factories'

/**
 * Proves the functional harness exercises real CSRF enforcement:
 * Shield (router middleware) rejects an un-tokened write before it reaches
 * the controller, and `.withCsrfToken()` lets the same write through.
 *
 * Route under test: POST /user/account/accept-terms (auth only, no other gate).
 */
test.group('CSRF - functional test harness', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('write without a CSRF token is rejected by Shield', async ({ client, route, assert }) => {
    const user = await createUser()
    const before = await User.findOrFail(user.id)
    assert.isNull(before.termsAcceptedAt)

    // redirects(0): Shield redirects back, and following it would render the
    // full Inertia HTML layout (needs a built Vite manifest).
    const request = client.post(route('user.account.accept-terms'))
    const response = await request.loginAs(user).redirects(0)

    response.assertStatus(302)
    assert.isDefined(response.flashMessage('errorsBag.E_BAD_CSRF_TOKEN'))

    const fresh = await User.findOrFail(user.id)
    assert.isNull(fresh.termsAcceptedAt)

    const audit = await AuditLog.query()
      .where('action', 'user.terms.accept')
      .where('user_id', user.id)
      .first()
    assert.isNull(audit)
  })

  test('write with a CSRF token reaches the controller', async ({ client, route, assert }) => {
    const user = await createUser()
    const before = await User.findOrFail(user.id)
    assert.isNull(before.termsAcceptedAt)

    const request = client.post(route('user.account.accept-terms')).withCsrfToken()
    const response = await request.loginAs(user).redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.equal(response.flashMessage('success'), 'Conditions acceptées. Merci.')

    const fresh = await User.findOrFail(user.id)
    assert.isNotNull(fresh.termsAcceptedAt)

    const audit = await AuditLog.query()
      .where('action', 'user.terms.accept')
      .where('user_id', user.id)
      .first()
    assert.isNotNull(audit)
  })
  test('a JSON caller without a token gets the 302, never a 200 JSON (BUILD-10)', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const module = await CourseModule.create({ courseId: course.id, title: 'Avant', order: 1 })

    const request = client.put(route('modules.update', { moduleId: module.id }))
    const response = await request
      .header('accept', 'application/json')
      .json({ title: 'Après' })
      .loginAs(owner)
      .redirects(0)

    response.assertStatus(302)
    assert.isDefined(response.flashMessage('errorsBag.E_BAD_CSRF_TOKEN'))
    const fresh = await CourseModule.findOrFail(module.id)
    assert.equal(fresh.title, 'Avant')
  })
})
