import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import AppSetting from '#models/app_setting'
import Assignment from '#models/assignment'
import AuditLog from '#models/audit_log'
import ContentFile from '#models/content_file'
import type Course from '#models/course'
import CourseContent from '#models/course_content'
import CourseModule from '#models/course_module'
import FileStorageService from '#services/file_storage_service'
import TrashPurgeService from '#services/trash_purge_service'
import { createCourse, createUser, uniqueSuffix } from '#tests/functional/helpers/factories'

/**
 * Purge (phase 05.2, TRASH-08). Trash rows are crafted by raw updates; one fixed `now`
 * builds the deleted_at values and drives the purge, so day boundaries never flake.
 * Fixture: S1 {c1, c5, S11 {c2}} (S1, S11, c1, c2 trashed 31 days ago in one batch,
 * c5 trashed 40 days ago in another), S2 {c3 trashed 29 days ago, c4 live}.
 */

const NOW = DateTime.now().startOf('second')

function stamp(daysAgo: number): string {
  return NOW.minus({ days: daysAgo }).toFormat(db.connection().dialect.dateTimeFormat)
}

async function trashRaw(
  table: 'course_modules' | 'course_contents',
  id: number,
  opts: { daysAgo: number; batch: string }
) {
  await db
    .from(table)
    .where('id', id)
    .update({ deleted_at: stamp(opts.daysAgo), deleted_batch: opts.batch })
}

async function createModule(course: Course, title: string, parentId: number | null = null) {
  return CourseModule.create({ courseId: course.id, title, order: 1, isPublished: true, parentId })
}

async function createContent(module: CourseModule, title: string) {
  return CourseContent.create({
    moduleId: module.id,
    contentType: 'page',
    title,
    content: 'Body',
    order: 1,
    isPublished: true,
  })
}

async function storedFile(basePath: string, contents: CourseContent[]) {
  const storagePath = `ab/${uniqueSuffix()}.txt`
  const absolute = join(basePath, storagePath)
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, 'blob')
  const file = await ContentFile.create({
    storagePath,
    size: 4,
    checksum: createHash('sha256').update(uniqueSuffix()).digest('hex'),
  })
  for (const c of contents) {
    await c.related('files').attach({ [file.id]: { filename: 'f.txt', mime_type: 'text/plain' } })
  }
  return { file, absolute }
}

async function progress(userId: number, contentId: number) {
  const ts = NOW.toFormat(db.connection().dialect.dateTimeFormat)
  await db
    .table('content_progresses')
    .insert({ user_id: userId, content_id: contentId, created_at: ts, updated_at: ts })
}

async function setRetention(days: number) {
  await AppSetting.query().where('is_active', true).update({ trash_retention_days: days })
}

async function count(table: string, column: string, ids: number[]): Promise<number> {
  const row = await db.from(table).whereIn(column, ids).count('* as total').first()
  return Number(row?.total ?? 0)
}

async function fixture(basePath: string) {
  const owner = await createUser({ roles: ['teacher'] })
  const learner = await createUser({ roles: ['student'] })
  const course = await createCourse(owner)
  const s1 = await createModule(course, 'S1')
  const s2 = await createModule(course, 'S2')
  const s11 = await createModule(course, 'S11', s1.id)
  const c1 = await createContent(s1, 'c1')
  const c5 = await createContent(s1, 'c5')
  const c2 = await createContent(s11, 'c2')
  const c3 = await createContent(s2, 'c3')
  const c4 = await createContent(s2, 'c4')

  const sharedLive = await storedFile(basePath, [c1, c4])
  const sharedTrashed = await storedFile(basePath, [c2, c3])
  const orphan = await storedFile(basePath, [c2])

  for (const c of [c1, c2, c3]) await progress(learner.id, c.id)

  const batch = randomUUID()
  for (const id of [s1.id, s11.id]) await trashRaw('course_modules', id, { daysAgo: 31, batch })
  for (const id of [c1.id, c2.id]) await trashRaw('course_contents', id, { daysAgo: 31, batch })
  await trashRaw('course_contents', c5.id, { daysAgo: 40, batch: randomUUID() })
  await trashRaw('course_contents', c3.id, { daysAgo: 29, batch: randomUUID() })

  return { owner, learner, course, s1, s2, s11, c1, c2, c3, c4, c5, sharedLive, sharedTrashed, orphan }
}

const sorted = (ids: number[]) => [...ids].sort((a, b) => a - b)

test.group('trash | purge', (group) => {
  let root: string
  let storage: FileStorageService

  group.each.setup(async () => {
    root = await mkdtemp(join(tmpdir(), 'edonis-trash-purge-'))
    storage = new FileStorageService(join(root, 'content_files'))
    const rollback = await testUtils.db().withGlobalTransaction()
    await AppSetting.query().delete()
    await AppSetting.create({ ...AppSetting.DEFAULTS, trashRetentionDays: 30 })
    return async () => {
      await rollback()
      await rm(root, { recursive: true, force: true })
    }
  })

  test('purges expired sections with their subtree and keeps rows inside the window', async ({
    assert,
  }) => {
    const f = await fixture(storage.basePath)

    const reports = await TrashPurgeService.purgeExpired({
      courseId: f.course.id,
      trigger: 'cli',
      now: NOW,
      storage,
    })

    assert.lengthOf(reports, 1)
    assert.isUndefined(reports[0].error)
    assert.deepEqual(reports[0].sectionIds, sorted([f.s1.id, f.s11.id]))
    assert.deepEqual(reports[0].contentIds, sorted([f.c1.id, f.c2.id, f.c5.id]))
    assert.equal(await count('course_modules', 'id', [f.s1.id, f.s11.id]), 0)
    assert.equal(await count('course_contents', 'id', [f.c1.id, f.c2.id, f.c5.id]), 0)

    const c3 = await db.from('course_contents').where('id', f.c3.id).first()
    assert.isNotNull(c3.deleted_at)
    const c4 = await db.from('course_contents').where('id', f.c4.id).first()
    assert.isNull(c4.deleted_at)

    assert.equal(await count('content_progresses', 'content_id', [f.c1.id, f.c2.id]), 0)
    assert.equal(await count('content_progresses', 'content_id', [f.c3.id]), 1)
  })

  test('keeps rows at retention-1 days and purges rows at retention+1 days', async ({
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const s = await createModule(course, 'S')
    const young = await createContent(s, 'young')
    const old = await createContent(s, 'old')
    await trashRaw('course_contents', young.id, { daysAgo: 29, batch: randomUUID() })
    await trashRaw('course_contents', old.id, { daysAgo: 31, batch: randomUUID() })

    const reports = await TrashPurgeService.purgeExpired({
      courseId: course.id,
      trigger: 'cli',
      now: NOW,
      storage,
    })

    assert.deepEqual(reports[0].contentIds, [old.id])
    assert.equal(await count('course_contents', 'id', [young.id]), 1)
    assert.equal(await count('course_contents', 'id', [old.id]), 0)
  })

  test('detaches assignments of a purged section and keeps their submissions', async ({
    assert,
  }) => {
    const f = await fixture(storage.basePath)
    const assignment = await Assignment.create({
      courseId: f.course.id,
      moduleId: f.s1.id,
      title: 'Essay',
    })
    const ts = NOW.toFormat(db.connection().dialect.dateTimeFormat)
    const [inserted] = await db
      .table('submissions')
      .insert({
        assignment_id: assignment.id,
        student_id: f.learner.id,
        status: 'graded',
        grade: 15,
        created_at: ts,
        updated_at: ts,
      })
      .returning('id')
    const submissionId = typeof inserted === 'object' ? inserted.id : inserted

    await TrashPurgeService.purgeExpired({
      courseId: f.course.id,
      trigger: 'cli',
      now: NOW,
      storage,
    })

    const row = await db.from('assignments').where('id', assignment.id).first()
    assert.isNotNull(row)
    assert.isNull(row.module_id)
    const submission = await db.from('submissions').where('id', submissionId).first()
    assert.equal(Number(submission.grade), 15)
  })

  test('deletes a blob only when no remaining content references it', async ({ assert }) => {
    const f = await fixture(storage.basePath)

    const reports = await TrashPurgeService.purgeExpired({
      courseId: f.course.id,
      trigger: 'cli',
      now: NOW,
      storage,
    })

    assert.deepEqual(reports[0].fileIds, [f.orphan.file.id])
    assert.equal(await count('content_files', 'id', [f.orphan.file.id]), 0)
    assert.isFalse(existsSync(f.orphan.absolute))

    for (const kept of [f.sharedLive, f.sharedTrashed]) {
      assert.equal(await count('content_files', 'id', [kept.file.id]), 1)
      assert.isTrue(existsSync(kept.absolute))
    }
  })

  test('lowering the retention purges more at the next run', async ({ assert }) => {
    const f = await fixture(storage.basePath)
    await TrashPurgeService.purgeExpired({ courseId: f.course.id, trigger: 'cli', now: NOW, storage })
    assert.equal(await count('course_contents', 'id', [f.c3.id]), 1)

    await setRetention(10)
    const reports = await TrashPurgeService.purgeExpired({
      courseId: f.course.id,
      trigger: 'cli',
      now: NOW,
      storage,
    })

    assert.deepEqual(reports[0].contentIds, [f.c3.id])
    assert.equal(await count('course_contents', 'id', [f.c3.id]), 0)
    // c3 was the last trashed reference of the blob it shared with c2
    assert.isFalse(existsSync(f.sharedTrashed.absolute))
  })

  test('a second run finds nothing and writes one audit row per purged course', async ({
    assert,
  }) => {
    const f = await fixture(storage.basePath)

    await TrashPurgeService.purgeExpired({ trigger: 'cli', now: NOW, storage })
    const second = await TrashPurgeService.purgeExpired({ trigger: 'cli', now: NOW, storage })

    assert.notInclude(
      second.map((r) => r.courseId),
      f.course.id
    )
    const audits = await AuditLog.query()
      .where('action', 'course.trash.purge')
      .where('resource_id', String(f.course.id))
    assert.lengthOf(audits, 1)
    assert.isNull(audits[0].userId)
    assert.equal(audits[0].resourceType, 'Course')
    assert.sameMembers(Object.keys(audits[0].metadata ?? {}), [
      'courseId',
      'trigger',
      'sectionIds',
      'contentIds',
      'fileIds',
    ])
    assert.equal(audits[0].metadata?.trigger, 'cli')
  })

  test('dry run reports ids and deletes nothing', async ({ assert }) => {
    const f = await fixture(storage.basePath)

    const reports = await TrashPurgeService.purgeExpired({
      courseId: f.course.id,
      trigger: 'cli',
      dryRun: true,
      now: NOW,
      storage,
    })

    assert.deepEqual(reports[0].sectionIds, sorted([f.s1.id, f.s11.id]))
    assert.deepEqual(reports[0].fileIds, [f.orphan.file.id])
    assert.equal(await count('course_modules', 'id', [f.s1.id, f.s11.id]), 2)
    assert.equal(await count('course_contents', 'id', [f.c1.id, f.c2.id, f.c5.id]), 3)
    assert.isTrue(existsSync(f.orphan.absolute))
    const audits = await AuditLog.query().where('action', 'course.trash.purge')
    assert.lengthOf(audits, 0)
  })

  test('forceDelete ignores live ids and ids of another course', async ({ assert }) => {
    const f = await fixture(storage.basePath)
    const other = await createCourse(f.owner)
    const os = await createModule(other, 'OS')
    const oc = await createContent(os, 'oc')
    await trashRaw('course_modules', os.id, { daysAgo: 99, batch: randomUUID() })
    await trashRaw('course_contents', oc.id, { daysAgo: 99, batch: randomUUID() })

    const result = await db.transaction((trx) =>
      TrashPurgeService.forceDelete(trx, f.course.id, {
        sectionIds: [f.s2.id, os.id],
        contentIds: [f.c4.id, oc.id],
      })
    )

    assert.deepEqual(result.sectionIds, [])
    assert.deepEqual(result.contentIds, [])
    assert.equal(await count('course_modules', 'id', [f.s2.id, os.id]), 2)
    assert.equal(await count('course_contents', 'id', [f.c4.id, oc.id]), 2)
  })

  test('forceDelete skips a trashed section that still has a live descendant', async ({
    assert,
  }) => {
    const f = await fixture(storage.basePath)
    await db.from('course_contents').where('id', f.c1.id).update({ deleted_at: null })

    const result = await db.transaction((trx) =>
      TrashPurgeService.forceDelete(trx, f.course.id, { sectionIds: [f.s1.id], contentIds: [] })
    )

    assert.deepEqual(result.sectionIds, [])
    assert.equal(await count('course_contents', 'id', [f.c1.id]), 1)
  })

  test('deleteBlob refuses paths outside the storage root without throwing', async ({
    assert,
  }) => {
    const outside = join(root, 'outside.txt')
    await writeFile(outside, 'keep')

    await storage.deleteBlob('../outside.txt')
    await storage.deleteBlob(outside)
    await storage.deleteBlob('ab/missing.txt')

    assert.isTrue(existsSync(outside))
  })
})
