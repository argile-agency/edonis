import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import CourseCategory from '#models/course_category'
import { assertNotCsrfRejected, createUser } from '#tests/functional/helpers/factories'

const CYCLE_FLASH =
  'Une catégorie ne peut pas être placée sous elle-même ou sous une de ses sous-catégories.'

/**
 * Fixture tree: A (/a, 0) -> B (/a/b, 1) -> C (/a/b/c, 2), plus root D (/d, 0).
 * Non-zero sort orders make the reorder assertions meaningful.
 */
async function createTree() {
  const a = await CourseCategory.create({
    name: 'Cat A',
    slug: 'a',
    parentId: null,
    path: '/a',
    depth: 0,
    sortOrder: 7,
    isVisible: true,
  })
  const b = await CourseCategory.create({
    name: 'Cat B',
    slug: 'b',
    parentId: a.id,
    path: '/a/b',
    depth: 1,
    sortOrder: 0,
    isVisible: true,
  })
  const c = await CourseCategory.create({
    name: 'Cat C',
    slug: 'c',
    parentId: b.id,
    path: '/a/b/c',
    depth: 2,
    sortOrder: 0,
    isVisible: true,
  })
  const d = await CourseCategory.create({
    name: 'Cat D',
    slug: 'd',
    parentId: null,
    path: '/d',
    depth: 0,
    sortOrder: 5,
    isVisible: true,
  })
  return { a, b, c, d }
}

test.group('Categories - hierarchy integrity', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('refuses a descendant as the new parent and changes nothing', async ({
    client,
    route,
    assert,
  }) => {
    const admin = await createUser({ roles: ['admin'] })
    const { a, c } = await createTree()

    const request = client.put(route('admin.categories.update', { id: a.id })).withCsrfToken()
    const response = await request.json({ parentId: c.id }).loginAs(admin).redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.equal(response.flashMessage('error'), CYCLE_FLASH)

    const fresh = await CourseCategory.findOrFail(a.id)
    assert.isNull(fresh.parentId)
    assert.equal(fresh.path, '/a')
    assert.equal(fresh.depth, 0)
  })

  test('refuses the category itself as its parent and changes nothing', async ({
    client,
    route,
    assert,
  }) => {
    const admin = await createUser({ roles: ['admin'] })
    const { a } = await createTree()

    const request = client.put(route('admin.categories.update', { id: a.id })).withCsrfToken()
    const response = await request.json({ parentId: a.id }).loginAs(admin).redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.equal(response.flashMessage('error'), CYCLE_FLASH)

    const fresh = await CourseCategory.findOrFail(a.id)
    assert.isNull(fresh.parentId)
    assert.equal(fresh.path, '/a')
    assert.equal(fresh.depth, 0)
  })

  test('moving a category recomputes path and depth for the whole subtree', async ({
    client,
    route,
    assert,
  }) => {
    const admin = await createUser({ roles: ['admin'] })
    const { b, c, d } = await createTree()

    const request = client.put(route('admin.categories.update', { id: b.id })).withCsrfToken()
    const response = await request.json({ parentId: d.id }).loginAs(admin).redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.equal(response.flashMessage('success'), 'Catégorie mise à jour avec succès.')

    const freshB = await CourseCategory.findOrFail(b.id)
    assert.equal(freshB.parentId, d.id)
    assert.equal(freshB.path, '/d/b')
    assert.equal(freshB.depth, 1)

    const freshC = await CourseCategory.findOrFail(c.id)
    assert.equal(freshC.path, '/d/b/c')
    assert.equal(freshC.depth, 2)
  })

  test('renaming a category recomputes paths for the whole subtree', async ({
    client,
    route,
    assert,
  }) => {
    const admin = await createUser({ roles: ['admin'] })
    const { a, b, c } = await createTree()

    // The update validator requires a slug of at least 2 characters.
    const request = client.put(route('admin.categories.update', { id: a.id })).withCsrfToken()
    const response = await request.json({ slug: 'zz' }).loginAs(admin).redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.equal(response.flashMessage('success'), 'Catégorie mise à jour avec succès.')

    const freshA = await CourseCategory.findOrFail(a.id)
    assert.equal(freshA.path, '/zz')
    assert.equal(freshA.depth, 0)

    const freshB = await CourseCategory.findOrFail(b.id)
    assert.equal(freshB.path, '/zz/b')
    assert.equal(freshB.depth, 1)

    const freshC = await CourseCategory.findOrFail(c.id)
    assert.equal(freshC.path, '/zz/b/c')
    assert.equal(freshC.depth, 2)
  })

  test('reorder without a payload fails validation instead of crashing', async ({
    client,
    route,
    assert,
  }) => {
    const admin = await createUser({ roles: ['admin'] })
    const { a, d } = await createTree()

    const request = client.post(route('admin.categories.reorder')).withCsrfToken()
    const response = await request.json({}).loginAs(admin).redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.isDefined(response.flashMessage('inputErrorsBag.categoryIds'))

    const freshA = await CourseCategory.findOrFail(a.id)
    const freshD = await CourseCategory.findOrFail(d.id)
    assert.equal(freshA.sortOrder, 7)
    assert.equal(freshD.sortOrder, 5)
  })

  test('reorder applies the array index as sort order', async ({ client, route, assert }) => {
    const admin = await createUser({ roles: ['admin'] })
    const { a, d } = await createTree()

    const request = client.post(route('admin.categories.reorder')).withCsrfToken()
    const response = await request
      .json({ categoryIds: [d.id, a.id] })
      .loginAs(admin)
      .redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.equal(response.flashMessage('success'), 'Ordre des catégories mis à jour.')

    const freshD = await CourseCategory.findOrFail(d.id)
    const freshA = await CourseCategory.findOrFail(a.id)
    assert.equal(freshD.sortOrder, 0)
    assert.equal(freshA.sortOrder, 1)
  })
})
