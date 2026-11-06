import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import env from '#start/env'
import Assignment from '#models/assignment'
import ContentProgress from '#models/content_progress'
import Course from '#models/course'
import ContentFile from '#models/content_file'
import CourseModule from '#models/course_module'
import CourseContent from '#models/course_content'
import {
  createCourse,
  createUser,
  enrollUser,
  uniqueSuffix,
} from '#tests/functional/helpers/factories'

/**
 * Trash visibility (phase 05.2): trashed sections and contents are invisible to every
 * model query, while raw db.from() reads still see them.
 * Fixture: S1 {c1, S11 {c2}}, S2 {c3, c4}; one file linked to c3 and c4.
 * Trashed: S1, S11, c1, c2 (one batch) and c3 (another batch).
 */

async function createModule(
  course: Course,
  overrides: Partial<Pick<CourseModule, 'parentId' | 'order' | 'title'>> = {}
): Promise<CourseModule> {
  return CourseModule.create({
    courseId: course.id,
    title: 'Test Module',
    order: 1,
    isPublished: true,
    ...overrides,
  })
}

async function createContent(
  module: CourseModule,
  overrides: Partial<Pick<CourseContent, 'order' | 'title'>> = {}
): Promise<CourseContent> {
  return CourseContent.create({
    moduleId: module.id,
    contentType: 'page',
    title: 'Test Content',
    content: 'Body',
    order: 1,
    isPublished: true,
    ...overrides,
  })
}

async function trash(table: string, ids: number[], batch: string, userId: number) {
  await db
    .from(table)
    .whereIn('id', ids)
    .update({
      deleted_at: DateTime.now().toFormat(db.connection().dialect.dateTimeFormat),
      deleted_batch: batch,
      deleted_by_id: userId,
    })
}

async function fixture() {
  const owner = await createUser({ roles: ['teacher'] })
  const course = await createCourse(owner)
  const s1 = await createModule(course, { order: 1, title: 'S1' })
  const s2 = await createModule(course, { order: 2, title: 'S2' })
  const s11 = await createModule(course, { parentId: s1.id, order: 1, title: 'S11' })
  const c1 = await createContent(s1, { order: 1, title: 'c1' })
  const c2 = await createContent(s11, { order: 1, title: 'c2' })
  const c3 = await createContent(s2, { order: 1, title: 'c3' })
  const c4 = await createContent(s2, { order: 2, title: 'c4' })
  const file = await ContentFile.create({
    storagePath: `ab/${uniqueSuffix()}.txt`,
    size: 4,
    checksum: createHash('sha256').update(uniqueSuffix()).digest('hex'),
  })
  for (const c of [c3, c4]) {
    await c
      .related('files')
      .attach({ [file.id]: { filename: 'Notes.txt', mime_type: 'text/plain' } })
  }

  const batch = randomUUID()
  await trash('course_modules', [s1.id, s11.id], batch, owner.id)
  await trash('course_contents', [c1.id, c2.id], batch, owner.id)
  await trash('course_contents', [c3.id], randomUUID(), owner.id)

  return { owner, course, s1, s2, s11, c1, c2, c3, c4, file }
}

const ids = (rows: { id: number }[]) => rows.map((r) => r.id).sort((a, b) => a - b)

test.group('trash visibility | model hooks', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('query, find and findOrFail hide trashed sections', async ({ assert }) => {
    const f = await fixture()

    const modules = await CourseModule.query().where('course_id', f.course.id)
    assert.deepEqual(ids(modules), [f.s2.id])
    assert.isNull(await CourseModule.find(f.s1.id))
    await assert.rejects(() => CourseModule.findOrFail(f.s1.id))
  })

  test('query hides trashed contents', async ({ assert }) => {
    const f = await fixture()

    const contents = await CourseContent.query().whereIn('id', [f.c1.id, f.c2.id, f.c3.id, f.c4.id])
    assert.deepEqual(ids(contents), [f.c4.id])
  })

  test('preloads and related queries hide trashed rows', async ({ assert }) => {
    const f = await fixture()

    const course = await Course.query()
      .where('id', f.course.id)
      .preload('modules', (q) => q.preload('contents').preload('children'))
      .firstOrFail()
    assert.deepEqual(ids(course.modules), [f.s2.id])
    assert.deepEqual(ids(course.modules[0].contents), [f.c4.id])
    assert.deepEqual(course.modules[0].children, [])

    assert.deepEqual(ids(await f.s2.related('contents').query()), [f.c4.id])
  })

  test('paginate counts only live rows', async ({ assert }) => {
    const f = await fixture()

    const page = await CourseModule.query().where('course_id', f.course.id).paginate(1, 10)
    assert.equal(page.total, 1)
    assert.deepEqual(ids(page.all()), [f.s2.id])
  })

  test('many-to-many from ContentFile hides trashed contents', async ({ assert }) => {
    const f = await fixture()

    assert.deepEqual(ids(await f.file.related('contents').query()), [f.c4.id])
  })

  test('raw db.from() still sees trashed rows', async ({ assert }) => {
    const f = await fixture()

    const modules = await db.from('course_modules').where('course_id', f.course.id)
    assert.lengthOf(modules, 3)
    const contents = await db
      .from('course_contents')
      .whereIn('id', [f.c1.id, f.c2.id, f.c3.id, f.c4.id])
    assert.lengthOf(contents, 4)
  })

  test('a new section reads back live', async ({ assert }) => {
    const f = await fixture()

    const created = await createModule(f.course, { order: 3, title: 'S3' })
    const fresh = await CourseModule.findOrFail(created.id)
    assert.isNull(fresh.deletedAt)
  })
})

/**
 * Read paths over HTTP (RESEARCH § Read-Path Inventory). Fixture: S1 {c1, S11 {c2}},
 * S2 {c3, c4}; progress on c2 and c4; F1 only on c2, F2 on c3 and c4; A1 in S1, A2
 * without section. Trashed: the S1 subtree and c3. Trashed titles start with TRASHED
 * so one substring check covers every serialized prop.
 */
const TRASHED = 'TRASHED'
const FILE_BODY = 'notes'
let storageRoot: string

async function storedFile(): Promise<ContentFile> {
  const name = `${uniqueSuffix()}.txt`
  await mkdir(join(storageRoot, 'ab'), { recursive: true })
  await writeFile(join(storageRoot, 'ab', name), FILE_BODY)
  return ContentFile.create({
    storagePath: `ab/${name}`,
    size: FILE_BODY.length,
    checksum: createHash('sha256').update(uniqueSuffix()).digest('hex'),
  })
}

async function readFixture() {
  const owner = await createUser({ roles: ['teacher'] })
  const student = await createUser({ roles: ['student'] })
  const course = await createCourse(owner)
  await enrollUser(course, student)
  const s1 = await createModule(course, { order: 1, title: `${TRASHED} S1` })
  const s2 = await createModule(course, { order: 2, title: 'S2' })
  const s11 = await createModule(course, { parentId: s1.id, order: 1, title: `${TRASHED} S11` })
  const c1 = await createContent(s1, { order: 1, title: `${TRASHED} c1` })
  const c2 = await createContent(s11, { order: 1, title: `${TRASHED} c2` })
  const c3 = await createContent(s2, { order: 1, title: `${TRASHED} c3` })
  const c4 = await createContent(s2, { order: 2, title: 'c4' })
  for (const c of [c2, c4]) {
    await ContentProgress.create({ userId: student.id, contentId: c.id, status: 'completed' })
  }
  const f1 = await storedFile()
  const f2 = await storedFile()
  const pivot = { filename: 'Notes.txt', mime_type: 'text/plain' }
  await c2.related('files').attach({ [f1.id]: pivot })
  await c3.related('files').attach({ [f2.id]: pivot })
  await c4.related('files').attach({ [f2.id]: pivot })
  const assignment = (title: string, moduleId: number | null) =>
    Assignment.create({
      courseId: course.id,
      moduleId,
      title,
      assignmentType: 'essay',
      maxPoints: 10,
      gradingType: 'points',
      isPublished: true,
    })
  const a1 = await assignment(`${TRASHED} A1`, s1.id)
  const a2 = await assignment('A2', null)

  await trash('course_modules', [s1.id, s11.id], randomUUID(), owner.id)
  await trash('course_contents', [c1.id, c2.id], randomUUID(), owner.id)
  await trash('course_contents', [c3.id], randomUUID(), owner.id)

  return { owner, student, course, s1, s2, s11, c1, c2, c3, c4, f1, f2, a1, a2 }
}

async function rawOrder(table: string, id: number) {
  const row = await db.from(table).where('id', id).firstOrFail()
  return Number(row.order)
}

test.group('trash visibility | read paths', (group) => {
  group.each.setup(async () => {
    storageRoot = await mkdtemp(join(tmpdir(), 'edonis-trash-files-'))
    const previous = env.get('CONTENT_STORAGE_PATH')
    env.set('CONTENT_STORAGE_PATH', storageRoot)
    const cleanupDb = await testUtils.db().withGlobalTransaction()
    return async () => {
      await cleanupDb()
      env.set('CONTENT_STORAGE_PATH', previous ?? '')
      await rm(storageRoot, { recursive: true, force: true })
    }
  })

  test('builder props exclude trashed sections and contents', async ({ client, assert }) => {
    const f = await readFixture()

    const response = await client
      .get(`/courses/${f.course.id}/builder`)
      .withInertia()
      .loginAs(f.owner)

    response.assertStatus(200)
    const props = response.inertiaProps as {
      sections: { id: number }[]
      contents: { id: number }[]
    }
    assert.deepEqual(ids(props.sections), [f.s2.id])
    assert.deepEqual(ids(props.contents), [f.c4.id])
    assert.notInclude(JSON.stringify(props), TRASHED)
  })

  test('editor course page has no trashed rows', async ({ client, assert }) => {
    const f = await readFixture()

    const response = await client.get(`/courses/${f.course.id}`).withInertia().loginAs(f.owner)

    response.assertStatus(200)
    assert.deepEqual(ids(response.inertiaProps.modules as { id: number }[]), [f.s2.id])
    assert.notInclude(JSON.stringify(response.inertiaProps), TRASHED)
  })

  test('learn tree has no trashed rows', async ({ client, assert }) => {
    const f = await readFixture()

    const response = await client
      .get(`/courses/${f.course.id}/learn`)
      .withInertia()
      .loginAs(f.student)

    response.assertStatus(200)
    assert.deepEqual(ids(response.inertiaProps.modules as { id: number }[]), [f.s2.id])
    assert.equal((response.inertiaProps.currentContent as { id: number }).id, f.c4.id)
    assert.notInclude(JSON.stringify(response.inertiaProps), TRASHED)
  })

  test('learn?content=<trashed id> is a 404', async ({ client }) => {
    const f = await readFixture()

    const response = await client
      .get(`/courses/${f.course.id}/learn?content=${f.c2.id}`)
      .withInertia()
      .loginAs(f.student)

    response.assertStatus(404)
  })

  test('outline has no trashed rows', async ({ client, assert }) => {
    const f = await readFixture()

    const response = await client
      .get(`/courses/${f.course.id}/outline`)
      .withInertia()
      .loginAs(f.student)

    response.assertStatus(200)
    assert.deepEqual(ids(response.inertiaProps.modules as { id: number }[]), [f.s2.id])
    assert.notInclude(JSON.stringify(response.inertiaProps), TRASHED)
  })

  test('progress totals exclude trashed contents', async ({ client, assert }) => {
    const f = await readFixture()

    const response = await client.get(`/courses/${f.course.id}/progress`).loginAs(f.student)

    response.assertStatus(200)
    assert.deepEqual(response.body(), {
      totalContents: 1,
      completedCount: 1,
      progressPercentage: 100,
    })
  })

  test('update, move, create-into and complete by trashed id are 404', async ({ client }) => {
    const f = await readFixture()

    const update = await client
      .put(`/modules/${f.s1.id}`)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({ title: 'x' })
      .loginAs(f.owner)
    update.assertStatus(404)

    const move = await client
      .post(`/contents/${f.c3.id}/move`)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({ moduleId: f.s2.id, position: 0, updatedAt: null })
      .loginAs(f.owner)
    move.assertStatus(404)

    const create = await client
      .post(`/modules/${f.s1.id}/contents`)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({ moduleId: f.s1.id, contentType: 'page', title: 'x' })
      .loginAs(f.owner)
    create.assertStatus(404)

    const complete = await client
      .post(`/contents/${f.c2.id}/complete`)
      .withCsrfToken()
      .header('accept', 'application/json')
      .loginAs(f.student)
    complete.assertStatus(404)
  })

  test('moving a live content into a trashed section is refused', async ({ client, assert }) => {
    const f = await readFixture()

    const response = await client
      .post(`/contents/${f.c4.id}/move`)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({ moduleId: f.s1.id, position: 0, updatedAt: f.c4.updatedAt?.toISO() ?? null })
      .loginAs(f.owner)

    assert.oneOf(response.status(), [404, 422])
    const c4 = await CourseContent.findOrFail(f.c4.id)
    assert.equal(c4.moduleId, f.s2.id)
  })

  test('bulk publish with a trashed id is E_INVALID_ITEMS', async ({ client, assert }) => {
    const f = await readFixture()

    const response = await client
      .post(`/courses/${f.course.id}/builder/bulk/publish`)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({
        items: [{ kind: 'content', id: f.c3.id, updatedAt: f.c3.updatedAt?.toISO() ?? null }],
        isPublished: false,
      })
      .loginAs(f.owner)

    response.assertStatus(422)
    assert.equal(response.body().code, 'E_INVALID_ITEMS')
  })

  test('duplicating a section copies only its live contents', async ({ client, assert }) => {
    const f = await readFixture()

    const response = await client
      .post(`/courses/${f.course.id}/builder/bulk/duplicate`)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({
        items: [{ kind: 'section', id: f.s2.id, updatedAt: f.s2.updatedAt?.toISO() ?? null }],
      })
      .loginAs(f.owner)

    response.assertStatus(200)
    assert.notInclude(JSON.stringify(response.body()), TRASHED)
    const copy = await db.from('course_modules').where('copied_from_id', f.s2.id).firstOrFail()
    const copied = await db.from('course_contents').where('module_id', copy.id)
    assert.deepEqual(
      copied.map((c) => c.title),
      ['c4']
    )
  })

  test('reordering contents leaves a trashed content order unchanged', async ({
    client,
    assert,
  }) => {
    const f = await readFixture()

    const response = await client
      .post(`/modules/${f.s2.id}/contents/reorder`)
      .withCsrfToken()
      .json({
        contents: [
          { id: f.c4.id, order: 1 },
          { id: f.c3.id, order: 7 },
        ],
      })
      .loginAs(f.owner)
      .redirects(0)

    response.assertStatus(302)
    assert.equal(await rawOrder('course_contents', f.c3.id), 1)
    assert.equal(await rawOrder('course_contents', f.c4.id), 1)
  })

  test('reordering sections leaves a trashed section order unchanged', async ({
    client,
    assert,
  }) => {
    const f = await readFixture()

    const response = await client
      .post(`/courses/${f.course.id}/modules/reorder`)
      .withCsrfToken()
      .json({
        modules: [
          { id: f.s2.id, order: 1 },
          { id: f.s1.id, order: 7 },
        ],
      })
      .loginAs(f.owner)
      .redirects(0)

    response.assertStatus(302)
    assert.equal(await rawOrder('course_modules', f.s1.id), 1)
    assert.equal(await rawOrder('course_modules', f.s2.id), 1)
  })

  test('a file only attached to trashed contents is refused to the student', async ({
    client,
    assert,
  }) => {
    const f = await readFixture()

    const refused = await client.get(`/files/${f.f1.id}/download`).loginAs(f.student)
    refused.assertStatus(403)

    const shared = await client.get(`/files/${f.f2.id}/download`).loginAs(f.student)
    shared.assertStatus(200)
    assert.equal(shared.text(), FILE_BODY)
  })

  test('instructor gradebook hides assignments of trashed sections', async ({ client, assert }) => {
    const f = await readFixture()

    const response = await client
      .get(`/grades/courses/${f.course.id}`)
      .withInertia()
      .loginAs(f.owner)

    response.assertStatus(200)
    assert.deepEqual(ids(response.inertiaProps.assignments as { id: number }[]), [f.a2.id])
    assert.notInclude(JSON.stringify(response.inertiaProps), TRASHED)
  })

  test('student gradebook hides assignments of trashed sections', async ({ client, assert }) => {
    const f = await readFixture()

    const response = await client
      .get(`/grades/courses/${f.course.id}`)
      .withInertia()
      .loginAs(f.student)

    response.assertStatus(200)
    const grades = response.inertiaProps.grades as { assignment: { id: number } }[]
    assert.deepEqual(
      grades.map((g) => g.assignment.id),
      [f.a2.id]
    )
    assert.notInclude(JSON.stringify(response.inertiaProps), TRASHED)
  })

  test('grades overview counts only live assignments', async ({ client, assert }) => {
    const f = await readFixture()

    const response = await client.get('/grades').withInertia().loginAs(f.student)

    response.assertStatus(200)
    const grades = response.inertiaProps.grades as { assignmentCount: number }[]
    assert.deepEqual(
      grades.map((g) => g.assignmentCount),
      [1]
    )
  })

  test('assignments come back once their section leaves the trash', async ({ client, assert }) => {
    const f = await readFixture()
    await db.from('course_modules').where('id', f.s1.id).update({ deleted_at: null })

    const response = await client
      .get(`/grades/courses/${f.course.id}`)
      .withInertia()
      .loginAs(f.owner)

    response.assertStatus(200)
    assert.deepEqual(ids(response.inertiaProps.assignments as { id: number }[]), [f.a1.id, f.a2.id])
  })

  test('data export keeps progress on trashed contents', async ({ client, assert }) => {
    const f = await readFixture()

    const response = await client.post('/user/account/export').withCsrfToken().loginAs(f.student)

    response.assertStatus(200)
    const exported = JSON.parse(response.text()) as { contentProgress: { contentId: number }[] }
    assert.includeMembers(
      exported.contentProgress.map((p) => p.contentId),
      [f.c2.id, f.c4.id]
    )
  })
})
