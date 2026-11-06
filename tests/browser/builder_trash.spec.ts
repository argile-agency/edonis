import { test } from '@japa/runner'
import { AxeBuilder } from '@axe-core/playwright'
import { DateTime } from 'luxon'
import type { Page } from 'playwright'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import AppSetting from '#models/app_setting'
import ContentProgress from '#models/content_progress'
import type Course from '#models/course'
import CourseModule from '#models/course_module'
import CourseContent from '#models/course_content'
import TrashService from '#services/trash_service'
import { createCourse, createUser, grantPermission } from '#tests/functional/helpers/factories'

/**
 * Course trash page (phase 05.2, plan 08): list, restore (incl. the D-05 dialog),
 * permanent delete, empty, collaborator view, course-page link and axe.
 * Fixture: S1 {c1 "Contenu 1"}, S2 {c2 "Contenu 2"}. c1 is trashed first and aged to
 * about 2 days before purge, then S1 is trashed in its own batch: two roots, S1 first,
 * and c1 carries `sectionTrashed` = S1.
 */

interface Fixture {
  course: Course
  s1: CourseModule
  s2: CourseModule
  c1: CourseContent
  c2: CourseContent
  users: User[]
}

let fixture: Fixture | null = null

async function createFixture(): Promise<Fixture> {
  const owner = await User.findByOrFail('email', 'teacher@edonis.test')
  const course = await createCourse(owner)
  const section = (title: string, order: number) =>
    CourseModule.create({ courseId: course.id, title, order, parentId: null, isPublished: true })
  const s1 = await section('S1', 1)
  const s2 = await section('S2', 2)
  const content = (moduleId: number, title: string) =>
    CourseContent.create({
      moduleId,
      contentType: 'page',
      title,
      content: 'Corps',
      order: 1,
      isPublished: true,
    })
  const c1 = await content(s1.id, 'Contenu 1')
  const c2 = await content(s2.id, 'Contenu 2')

  const trash = (sectionIds: number[], contentIds: number[]) =>
    db.transaction((trx) =>
      TrashService.trash(trx, course.id, { sectionIds, contentIds }, owner.id)
    )
  await trash([], [c1.id])
  // ~1.5 days left: « Dans 2 jours » whether the server rounds or takes the ceiling.
  const { trashRetentionDays: retention } = await AppSetting.getOrCreateActive()
  const aged = DateTime.now().minus({ days: retention - 2, hours: 12 })
  await db
    .from('course_contents')
    .where('id', c1.id)
    .update({ deleted_at: TrashService.toDbDateTime(aged, db.connection()) })
  await trash([s1.id], [])

  return { course, s1, s2, c1, c2, users: [] }
}

async function login(page: Page, email: string) {
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill('password')
  await Promise.all([
    page.waitForURL('**/dashboard', { timeout: 5000 }),
    page.locator('button[type="submit"]').click(),
  ])
}

async function openTrash(
  visit: (url: string) => Promise<Page>,
  f: Fixture,
  email = 'teacher@edonis.test'
) {
  const page = await visit('/login')
  await login(page, email)
  await page.goto(`/courses/${f.course.id}/trash`)
  await page.waitForLoadState('networkidle')
  return page
}

const restoreButton = (page: Page, title: string) =>
  page.getByRole('button', { name: `Restaurer « ${title} »`, exact: true })
const purgeButton = (page: Page, title: string) =>
  page.getByRole('button', { name: `Supprimer définitivement « ${title} »`, exact: true })

async function flash(page: Page, text: string) {
  await page.getByText(text, { exact: true }).first().waitFor({ timeout: 10_000 })
}

/** Raw read: the model hooks hide trashed rows (Phase 5.2). */
async function rawContent(id: number) {
  return db.from('course_contents').where('id', id).select('module_id', 'deleted_at').first()
}

/** Polls until `check` holds; the UI may update before the request lands. */
async function until(check: () => Promise<boolean>, timeout = 5000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    if (await check()) return true
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return check()
}

// String expression: the backend tsconfig has no DOM lib.
async function activeId(page: Page): Promise<string> {
  return String(await page.evaluate('document.activeElement?.id ?? ""'))
}

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>

function assertNoSerious(results: AxeResults, state: string, assert: { equal: Function }) {
  const serious = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  )
  const details = serious.map((v) => `${v.id}: ${v.description} (${v.impact})`).join('; ')
  assert.equal(serious.length, 0, `${state}: ${details}`)
}

test.group('Course trash page', (group) => {
  group.each.teardown(async () => {
    // Sections, contents and progress cascade with the course.
    await fixture?.course.delete()
    for (const user of fixture?.users ?? []) await user.delete()
    fixture = null
  })

  test('lists the roots most recent first with the near-purge warning (TRASH-04)', async ({
    visit,
    assert,
  }) => {
    const f = (fixture = await createFixture())
    const page = await openTrash(visit, f)

    assert.isTrue(await page.getByRole('heading', { name: 'Corbeille', level: 1 }).isVisible())
    const rows = page.locator('tbody tr')
    assert.equal(await rows.count(), 2)
    assert.include((await rows.nth(0).textContent()) ?? '', 'S1')
    const old = rows.nth(1)
    assert.include((await old.textContent()) ?? '', 'Contenu 1')
    assert.include((await old.textContent()) ?? '', '(dans la corbeille)')
    const badge = old.getByText('Dans 2 jours', { exact: true })
    assert.isTrue(await badge.isVisible())
    assert.include((await badge.getAttribute('class')) ?? '', 'bg-warning/10')
    assert.isTrue(await page.getByRole('button', { name: 'Vider la corbeille' }).isVisible())

    assertNoSerious(await new AxeBuilder({ page }).withTags(WCAG).analyze(), 'loaded', assert)
  })

  test('« Restaurer » restores a row in one click and moves focus on (TRASH-04)', async ({
    visit,
    assert,
  }) => {
    const f = (fixture = await createFixture())
    const page = await openTrash(visit, f)

    await restoreButton(page, 'S1').click()
    await flash(page, '« S1 » a été restauré.')
    assert.equal(await restoreButton(page, 'S1').count(), 0)
    assert.isNotNull(await CourseModule.find(f.s1.id))
    assert.isTrue(
      await until(async () => (await activeId(page)) === `trash-restore-content-${f.c1.id}`, 2000)
    )
  })

  test('a content whose section is trashed opens the D-05 dialog (TRASH-05)', async ({
    visit,
    assert,
  }) => {
    const f = (fixture = await createFixture())
    const page = await openTrash(visit, f)

    await restoreButton(page, 'Contenu 1').click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor()
    assert.include(
      (await dialog.textContent()) ?? '',
      'Sa section « S1 » est aussi dans la corbeille.'
    )
    assert.isTrue(
      await dialog.getByRole('button', { name: 'Restaurer aussi la section « S1 »' }).isVisible()
    )
    await dialog.getByRole('button', { name: 'Restaurer dans une autre section…' }).click()
    await dialog.getByRole('button', { name: 'S2', exact: true }).click()
    await flash(page, '« Contenu 1 » a été restauré dans « S2 ».')

    const row = await rawContent(f.c1.id)
    assert.equal(row.module_id, f.s2.id)
    assert.isNull(row.deleted_at)
    assert.equal(await restoreButton(page, 'Contenu 1').count(), 0)
  })

  test('« Supprimer définitivement » confirms with the learner count (TRASH-10)', async ({
    visit,
    assert,
  }) => {
    const f = (fixture = await createFixture())
    const student = await createUser({ roles: ['student'] })
    f.users.push(student)
    await ContentProgress.create({ userId: student.id, contentId: f.c1.id, status: 'completed' })
    const page = await openTrash(visit, f)

    await purgeButton(page, 'Contenu 1').click()
    const dialog = page.getByRole('alertdialog')
    await dialog
      .getByText('La progression de 1 apprenant sur ce contenu sera supprimée définitivement.')
      .waitFor()
    assert.include(
      (await dialog.textContent()) ?? '',
      'Ce contenu sera supprimé définitivement. Cette action est irréversible.'
    )
    const confirm = dialog.getByRole('button', { name: 'Supprimer définitivement', exact: true })
    assert.include((await confirm.getAttribute('class')) ?? '', 'bg-destructive')
    await confirm.click()
    await flash(page, '« Contenu 1 » a été supprimé définitivement.')
    assert.isTrue(await until(async () => (await rawContent(f.c1.id)) === null))
    assert.equal(await purgeButton(page, 'Contenu 1').count(), 0)
  })

  test('« Vider la corbeille » empties it and shows the empty state (TRASH-10)', async ({
    visit,
    assert,
  }) => {
    const f = (fixture = await createFixture())
    const page = await openTrash(visit, f)

    await page.getByRole('button', { name: 'Vider la corbeille' }).click()
    const dialog = page.getByRole('alertdialog')
    assert.include((await dialog.textContent()) ?? '', 'Les 2 éléments de la corbeille')
    await dialog.getByRole('button', { name: 'Vider la corbeille' }).click()
    await flash(page, 'Corbeille vidée.')

    await page.getByRole('heading', { name: 'La corbeille est vide' }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Vider la corbeille' }).count(), 0)
    assert.isTrue(await until(async () => (await activeId(page)) === 'trash-heading', 2000))
    assert.isNull(await db.from('course_modules').where('id', f.s1.id).first())

    assertNoSerious(await new AxeBuilder({ page }).withTags(WCAG).analyze(), 'empty', assert)
  })

  test('a collaborator restores but sees no purge action (TRASH-07)', async ({ visit, assert }) => {
    const f = (fixture = await createFixture())
    const collaborator = await createUser({ roles: ['teacher'] })
    f.users.push(collaborator)
    await grantPermission(f.course, collaborator, 'edit')
    const page = await openTrash(visit, f, collaborator.email)

    assert.isTrue(await restoreButton(page, 'S1').isVisible())
    assert.equal(await purgeButton(page, 'S1').count(), 0)
    assert.equal(await page.getByRole('button', { name: 'Vider la corbeille' }).count(), 0)
    assert.isTrue(
      await page
        .getByText(
          'Seuls le propriétaire du cours et les administrateurs peuvent supprimer définitivement des éléments.'
        )
        .isVisible()
    )
  })

  test('the course page « Contenu » tab links to the trash (TRASH-04)', async ({
    visit,
    assert,
  }) => {
    const f = (fixture = await createFixture())
    const page = await visit('/login')
    await login(page, 'teacher@edonis.test')
    await page.goto(`/courses/${f.course.id}`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('tab', { name: 'Contenu' }).click()
    const link = page.getByRole('link', { name: 'Corbeille', exact: true })
    assert.equal(await link.getAttribute('href'), `/courses/${f.course.id}/trash`)
    await link.click()
    await page.waitForURL(`**/courses/${f.course.id}/trash`)
    assert.isTrue(await page.getByRole('heading', { name: 'Corbeille', level: 1 }).isVisible())
  })
})
