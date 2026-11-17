import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import CourseModule from '#models/course_module'
import CourseContent from '#models/course_content'
import { createCourse, createUser } from '#tests/functional/helpers/factories'

/**
 * courses/learn injects a page content's HTML with dangerouslySetInnerHTML:
 * the controller must hand it over sanitized (stored XSS otherwise).
 */
async function learnWith(contentType: 'page' | 'link', content: string) {
  const owner = await createUser({ roles: ['teacher'] })
  const course = await createCourse(owner)
  const section = await CourseModule.create({ courseId: course.id, title: 'S', isPublished: true })
  await CourseContent.create({
    moduleId: section.id,
    contentType,
    title: 'C',
    isPublished: true,
    content,
  })
  return { owner, course }
}

test.group('Courses - learn page content sanitizing', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('page HTML loses scripts, handlers, frames and unsafe links', async ({
    client,
    route,
    assert,
  }) => {
    const { owner, course } = await learnWith(
      'page',
      '<h2>Titre</h2><p onclick="x()">Texte <strong>gras</strong></p>' +
        '<img src="/uploads/a.png" onerror="alert(1)"><script>alert(1)</script>' +
        '<iframe src="https://evil.example"></iframe><a href="javascript:alert(1)">lien</a>'
    )

    const response = await client
      .get(route('courses.learn', { id: course.id }))
      .withInertia()
      .loginAs(owner)

    response.assertStatus(200)
    response.assertInertiaComponent('courses/learn')
    const html: string = response.inertiaProps.currentContent.content
    for (const kept of [
      '<h2>Titre</h2>',
      '<strong>gras</strong>',
      'src="/uploads/a.png"',
      'lien',
    ]) {
      assert.include(html, kept)
    }
    for (const dropped of ['onerror', 'onclick', '<script', 'alert', '<iframe', 'javascript:']) {
      assert.notInclude(html, dropped)
    }
  })

  test('inline formatting is kept, layout escapes and classes are dropped', async ({
    client,
    route,
    assert,
  }) => {
    const { owner, course } = await learnWith(
      'page',
      '<h2 style="text-align: center; color: #c00; position: fixed; z-index: 99" class="fixed inset-0">A</h2>' +
        '<p style="font-size: 1.25rem; margin-left: -500px; background: url(https://evil.example/x.png)">B</p>' +
        '<a href="https://x.org" target="_blank" rel="noopener" style="display: none">C</a>'
    )

    const response = await client
      .get(route('courses.learn', { id: course.id }))
      .withInertia()
      .loginAs(owner)

    response.assertStatus(200)
    assert.equal(
      response.inertiaProps.currentContent.content,
      '<h2 style="text-align:center;color:#c00">A</h2>' +
        '<p style="font-size:1.25rem">B</p>' +
        '<a href="https://x.org" target="_blank" rel="noopener">C</a>'
    )
  })

  test('content of other types is plain text and stays untouched', async ({
    client,
    route,
    assert,
  }) => {
    const { owner, course } = await learnWith('link', 'a < b & c')

    const response = await client
      .get(route('courses.learn', { id: course.id }))
      .withInertia()
      .loginAs(owner)

    response.assertStatus(200)
    assert.equal(response.inertiaProps.currentContent.content, 'a < b & c')
  })
})
