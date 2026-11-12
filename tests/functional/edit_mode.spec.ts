import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import type { ApiClient } from '@japa/api-client'
import type User from '#models/user'
import {
  assertNotCsrfRejected,
  createCourse,
  createUser,
  enrollUser,
  grantPermission,
} from '#tests/functional/helpers/factories'

const REFUSAL = 'Vous ne pouvez pas modifier ce cours. Contactez son responsable.'

async function fixture() {
  const owner = await createUser({ roles: ['teacher'] })
  const course = await createCourse(owner)
  const outsider = await createUser({ roles: ['teacher'] })
  const student = await createUser({ roles: ['student'] })
  await enrollUser(course, student)
  const admin = await createUser({ roles: ['admin'] })
  return { owner, course, outsider, student, admin }
}

function toggle(
  client: ApiClient,
  body: Record<string, unknown>,
  opts: { as?: User; session?: Record<string, unknown> } = {}
) {
  let req = client.post('/edit-mode').withCsrfToken()
  if (opts.session) req = req.withSession(opts.session)
  if (opts.as) req = req.loginAs(opts.as)
  return req.json(body).redirects(0)
}

test.group('edit mode | endpoint', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('owner turning it on lands on the builder with a user-bound flag', async ({
    client,
    route,
    assert,
  }) => {
    const { owner, course } = await fixture()
    const response = await toggle(
      client,
      { enabled: true, courseId: course.id, from: 'show' },
      { as: owner }
    )

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.equal(response.header('location'), route('courses.builder', { id: course.id }))
    response.assertSession('editMode', { userId: owner.id })
  })

  test('turning it off from the builder lands on the player and forgets the flag', async ({
    client,
    route,
    assert,
  }) => {
    const { owner, course } = await fixture()
    const response = await toggle(
      client,
      { enabled: false, courseId: course.id, from: 'builder' },
      { as: owner, session: { editMode: { userId: owner.id } } }
    )

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.equal(response.header('location'), route('courses.learn', { id: course.id }))
    response.assertSessionMissing('editMode')
  })

  test('turning it off from show or learn stays on the same page', async ({
    client,
    route,
    assert,
  }) => {
    const { owner, course } = await fixture()
    const fromShow = await toggle(
      client,
      { enabled: false, courseId: course.id, from: 'show' },
      { as: owner }
    )
    assertNotCsrfRejected(assert, fromShow)
    assert.equal(fromShow.header('location'), route('courses.show', { id: course.id }))

    const fromLearn = await toggle(
      client,
      { enabled: false, courseId: course.id, from: 'learn' },
      { as: owner }
    )
    assertNotCsrfRejected(assert, fromLearn)
    assert.equal(fromLearn.header('location'), route('courses.learn', { id: course.id }))
  })

  test('a teacher granted edit can turn it on (policy, not ownership)', async ({
    client,
    route,
    assert,
  }) => {
    const { course, outsider } = await fixture()
    await grantPermission(course, outsider, 'edit')
    const response = await toggle(
      client,
      { enabled: true, courseId: course.id, from: 'learn' },
      { as: outsider }
    )

    assertNotCsrfRejected(assert, response)
    assert.equal(response.header('location'), route('courses.builder', { id: course.id }))
    response.assertSession('editMode', { userId: outsider.id })
  })

  test('an admin can turn it on for any course', async ({ client, route, assert }) => {
    const { course, admin } = await fixture()
    const response = await toggle(
      client,
      { enabled: true, courseId: course.id, from: 'show' },
      { as: admin }
    )

    assertNotCsrfRejected(assert, response)
    assert.equal(response.header('location'), route('courses.builder', { id: course.id }))
    response.assertSession('editMode', { userId: admin.id })
  })

  test('a teacher without permission is refused with a French flash', async ({
    client,
    route,
    assert,
  }) => {
    const { course, outsider } = await fixture()
    const response = await toggle(
      client,
      { enabled: true, courseId: course.id, from: 'show' },
      { as: outsider }
    )

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.equal(response.header('location'), route('courses.show', { id: course.id }))
    assert.equal(response.flashMessage('error'), REFUSAL)
    response.assertSessionMissing('editMode')
  })

  test('a refusal from the builder goes back to the course page', async ({
    client,
    route,
    assert,
  }) => {
    const { course, outsider } = await fixture()
    const response = await toggle(
      client,
      { enabled: false, courseId: course.id, from: 'builder' },
      { as: outsider }
    )

    assertNotCsrfRejected(assert, response)
    assert.equal(response.header('location'), route('courses.show', { id: course.id }))
    assert.equal(response.flashMessage('error'), REFUSAL)
  })

  test('a student gets 403 and a visitor goes to login', async ({ client, assert }) => {
    const { course, student } = await fixture()
    const body = { enabled: true, courseId: course.id, from: 'show' }

    const asStudent = await toggle(client, body, { as: student })
    asStudent.assertStatus(403)
    asStudent.assertSessionMissing('editMode')

    const asVisitor = await toggle(client, body)
    asVisitor.assertStatus(302)
    assert.equal(asVisitor.header('location'), '/login')
  })

  test('invalid bodies are rejected without touching the session', async ({
    client,
    assert,
  }) => {
    const { owner, course } = await fixture()
    const bodies: Record<string, unknown>[] = [
      { enabled: true, courseId: course.id, from: 'evil' },
      { enabled: true, courseId: course.id, from: 'https://evil.test' },
      { enabled: true, courseId: -1, from: 'show' },
      { enabled: 'x', courseId: course.id, from: 'show' },
      { courseId: course.id, from: 'show' },
      { enabled: true, from: 'show' },
      { enabled: true, courseId: course.id },
    ]

    for (const body of bodies) {
      const response = await toggle(client, body, { as: owner })
      assert.isFalse(response.status() >= 200 && response.status() < 300, JSON.stringify(body))
      assert.notEqual(response.header('location'), 'https://evil.test')
      assert.notInclude(String(response.header('location') ?? ''), 'evil')
      response.assertSessionMissing('editMode')
    }
  })

  test('an unknown course is a 404', async ({ client }) => {
    const { owner } = await fixture()
    const response = await toggle(
      client,
      { enabled: true, courseId: 999_999_999, from: 'show' },
      { as: owner }
    )

    response.assertStatus(404)
    response.assertSessionMissing('editMode')
  })

  test('a POST without CSRF token is rejected', async ({ client, route, assert }) => {
    const { owner, course } = await fixture()
    const response = await client
      .post('/edit-mode')
      .json({ enabled: true, courseId: course.id, from: 'show' })
      .loginAs(owner)
      .redirects(0)

    assert.notEqual(response.header('location'), route('courses.builder', { id: course.id }))
    response.assertSessionMissing('editMode')
  })
})
