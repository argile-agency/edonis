import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import CourseModule from '#models/course_module'
import CourseContent from '#models/course_content'
import {
  createCourse,
  createUser,
  enrollUser,
  grantPermission,
  uniqueSuffix,
} from '#tests/functional/helpers/factories'

/**
 * CR-03: courses.show must not ship the module/content tree (unpublished
 * titles, page bodies, file and external URLs) to anyone but editors.
 */
async function treeFixture() {
  const owner = await createUser({ roles: ['teacher'] })
  const course = await createCourse(owner)
  const s = uniqueSuffix()
  const sentinels = {
    unpublishedModule: `UNPUB-MODULE-${s}`,
    childModule: `CHILD-MODULE-${s}`,
    body: `PAGE-BODY-${s}`,
    unpublishedContent: `UNPUB-CONTENT-${s}`,
    fileUrl: `https://files.test/FILE-URL-${s}.pdf`,
    externalUrl: `https://ext.test/EXT-URL-${s}`,
  }

  const published = await CourseModule.create({
    courseId: course.id,
    title: 'Week 1',
    isPublished: true,
  })
  await CourseModule.create({
    courseId: course.id,
    title: sentinels.unpublishedModule,
    isPublished: false,
  })
  const child = await CourseModule.create({
    courseId: course.id,
    parentId: published.id,
    title: sentinels.childModule,
    isPublished: true,
  })
  await CourseContent.create({
    moduleId: published.id,
    contentType: 'page',
    title: 'Intro',
    isPublished: true,
    content: sentinels.body,
  })
  await CourseContent.create({
    moduleId: published.id,
    contentType: 'page',
    title: sentinels.unpublishedContent,
    isPublished: false,
  })
  await CourseContent.create({
    moduleId: child.id,
    contentType: 'file',
    title: 'Slides',
    isPublished: true,
    fileUrl: sentinels.fileUrl,
  })
  await CourseContent.create({
    moduleId: published.id,
    contentType: 'link',
    title: 'Reading',
    isPublished: true,
    externalUrl: sentinels.externalUrl,
  })

  return { owner, course, sentinels: Object.values(sentinels) }
}

test.group('Courses - show page (CR-03)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('non-enrolled student gets no module tree', async ({ client, route, assert }) => {
    const { course, sentinels } = await treeFixture()
    const student = await createUser({ roles: ['student'] })

    const response = await client
      .get(route('courses.show', { id: course.id }))
      .withInertia()
      .loginAs(student)

    response.assertStatus(200)
    response.assertInertiaComponent('courses/show')
    assert.deepEqual(response.inertiaProps.modules, [])
    const serialized = JSON.stringify(response.inertiaProps)
    for (const sentinel of sentinels) assert.notInclude(serialized, sentinel)
  })

  test('enrolled student gets no module tree', async ({ client, route, assert }) => {
    const { course, sentinels } = await treeFixture()
    const student = await createUser({ roles: ['student'] })
    await enrollUser(course, student)

    const response = await client
      .get(route('courses.show', { id: course.id }))
      .withInertia()
      .loginAs(student)

    response.assertStatus(200)
    response.assertInertiaComponent('courses/show')
    assert.isTrue(response.inertiaProps.isEnrolled)
    assert.deepEqual(response.inertiaProps.modules, [])
    const serialized = JSON.stringify(response.inertiaProps)
    for (const sentinel of sentinels) assert.notInclude(serialized, sentinel)
  })

  test('owner still gets the full tree', async ({ client, route, assert }) => {
    const { owner, course, sentinels } = await treeFixture()

    const response = await client
      .get(route('courses.show', { id: course.id }))
      .withInertia()
      .loginAs(owner)

    response.assertStatus(200)
    const serialized = JSON.stringify(response.inertiaProps.modules)
    for (const sentinel of sentinels) assert.include(serialized, sentinel)
  })

  test('edit co-instructor and admin still get the full tree', async ({
    client,
    route,
    assert,
  }) => {
    const { course, sentinels } = await treeFixture()
    const editor = await createUser({ roles: ['teacher'] })
    await grantPermission(course, editor, 'edit')
    const admin = await createUser({ roles: ['admin'] })

    for (const user of [editor, admin]) {
      const response = await client
        .get(route('courses.show', { id: course.id }))
        .withInertia()
        .loginAs(user)

      response.assertStatus(200)
      const serialized = JSON.stringify(response.inertiaProps.modules)
      for (const sentinel of sentinels) assert.include(serialized, sentinel)
    }
  })
})
