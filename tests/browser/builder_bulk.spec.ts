import { test } from '@japa/runner'
import { AxeBuilder } from '@axe-core/playwright'
import { DateTime } from 'luxon'
import type { Page } from 'playwright'
import User from '#models/user'
import AuditLog from '#models/audit_log'
import type Course from '#models/course'
import CourseModule from '#models/course_module'
import CourseContent from '#models/course_content'
import { createCourse } from '#tests/functional/helpers/factories'

/**
 * Course builder bulk actions (phase 05, plan 10): selection, the bulk bar and
 * its dialogs, keyboard use, the checkbox/handle split and axe.
 * Fixture: S1 {c1 "Contenu A" published page, c2 "Contenu B" draft video,
 * S11 {c4 "Contenu D"}}, S2 {c3 "Contenu C"}.
 */

const CONFLICT_TEXT = 'modifié par un autre enseignant'

interface Fixture {
  course: Course
  s1: CourseModule
  s11: CourseModule
  s2: CourseModule
  c1: CourseContent
  c2: CourseContent
  c3: CourseContent
  c4: CourseContent
}

let fixture: Fixture | null = null

async function createFixture(): Promise<Fixture> {
  const owner = await User.findByOrFail('email', 'teacher@edonis.test')
  const course = await createCourse(owner)
  const section = (title: string, order: number, parentId: number | null = null) =>
    CourseModule.create({ courseId: course.id, title, order, parentId, isPublished: true })
  const s1 = await section('S1', 1)
  const s2 = await section('S2', 2)
  const s11 = await section('S11', 1, s1.id)
  const content = (
    moduleId: number,
    title: string,
    order: number,
    contentType: 'page' | 'video' = 'page',
    isPublished = true
  ) =>
    CourseContent.create({
      moduleId,
      contentType,
      title,
      content: 'Corps',
      externalUrl: contentType === 'video' ? 'https://example.com/video' : null,
      order,
      isPublished,
    })
  const c1 = await content(s1.id, 'Contenu A', 1)
  const c2 = await content(s1.id, 'Contenu B', 2, 'video', false)
  const c4 = await content(s11.id, 'Contenu D', 1)
  const c3 = await content(s2.id, 'Contenu C', 1)
  return { course, s1, s11, s2, c1, c2, c3, c4 }
}

async function login(page: Page, email: string) {
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill('password')
  await Promise.all([
    page.waitForURL('**/dashboard', { timeout: 5000 }),
    page.locator('button[type="submit"]').click(),
  ])
}

async function openBuilder(visit: (url: string) => Promise<Page>, f: Fixture) {
  const page = await visit('/login')
  await login(page, 'teacher@edonis.test')
  await page.goto(`/courses/${f.course.id}/builder`)
  await page.waitForLoadState('networkidle')
  return page
}

const status = (page: Page) => page.locator('#save-status').getByRole('status')

async function waitSaved(page: Page) {
  await status(page).filter({ hasText: 'Enregistré' }).waitFor({ timeout: 10_000 })
}

const checkbox = (page: Page, title: string) =>
  page.getByRole('checkbox', { name: `Sélectionner « ${title} »`, exact: true })
const selectAll = (page: Page) =>
  page.getByRole('checkbox', { name: 'Tout sélectionner', exact: true })
const bar = (page: Page) => page.getByRole('group', { name: 'Actions sur la sélection' })
const barButton = (page: Page, name: string) => bar(page).getByRole('button', { name, exact: true })
const count = (page: Page) => page.locator('#builder-selection-count')

async function tick(page: Page, ...titles: string[]) {
  for (const title of titles) await checkbox(page, title).click()
}

async function quick(page: Page, item: string) {
  await page.getByRole('button', { name: 'Sélection rapide' }).click()
  await page.getByRole('menuitem', { name: item, exact: true }).click()
}

async function rowKeys(page: Page): Promise<string[]> {
  return page
    .locator('[data-row-key]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-row-key') ?? ''))
}

/** Polls the DB until `check` holds; the UI may update before the request lands. */
async function until(check: () => Promise<boolean>, timeout = 5000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    if (await check()) return true
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return check()
}

const liveRegion = (page: Page) => page.locator('[id^="DndLiveRegion"]')

// String expressions: the backend tsconfig has no DOM lib.
async function activeId(page: Page): Promise<string> {
  return String(await page.evaluate('document.activeElement?.id ?? ""'))
}
async function activeText(page: Page): Promise<string> {
  return String(await page.evaluate('document.activeElement?.textContent?.trim() ?? ""'))
}

function bulkRequests(page: Page) {
  const urls: string[] = []
  page.on('request', (req) => {
    if (req.url().includes('/builder/bulk/')) urls.push(req.url())
  })
  return urls
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

async function isoDate(id: number, field: 'availableFrom' | 'availableUntil') {
  const content = await CourseContent.findOrFail(id)
  return content[field]?.toISODate() ?? null
}

async function publishedNow(model: typeof CourseContent | typeof CourseModule, id: number) {
  const item = await model.findOrFail(id)
  return item.isPublished
}

async function countText(page: Page) {
  const text = await count(page).textContent()
  return text?.trim() ?? ''
}

test.group('Course builder - bulk actions', (group) => {
  group.each.teardown(async () => {
    // Sections, contents and progress cascade with the course.
    await fixture?.course.delete()
    fixture = null
  })

  test('selection: checkboxes, select all and quick selections (BUILD-11)', async ({
    visit,
    assert,
  }) => {
    const f = (fixture = await createFixture())
    const page = await openBuilder(visit, f)

    assert.equal(await countText(page), 'Aucun élément sélectionné')
    await tick(page, 'Contenu A', 'S2')
    assert.equal(await countText(page), '2 éléments sélectionnés')
    assert.equal(await count(page).getAttribute('aria-live'), 'polite')

    await selectAll(page).click()
    assert.equal(await countText(page), '7 éléments sélectionnés')

    await quick(page, 'Éléments non publiés')
    assert.isTrue(await checkbox(page, 'Contenu B').isChecked())
    assert.isFalse(await checkbox(page, 'Contenu A').isChecked())
    assert.isFalse(await checkbox(page, 'S1').isChecked())

    await quick(page, 'Vidéos')
    assert.isTrue(await checkbox(page, 'Contenu B').isChecked())
    assert.equal(await countText(page), '1 élément sélectionné')
  })

  test('select all then publish takes two interactions (BUILD-12)', async ({ visit, assert }) => {
    const f = (fixture = await createFixture())
    const page = await openBuilder(visit, f)

    await selectAll(page).click()
    await barButton(page, 'Publier').click()
    await waitSaved(page)
    assert.isTrue(await until(async () => await publishedNow(CourseContent, f.c2.id)))
    const contents = await CourseContent.query().whereIn('module_id', [f.s1.id, f.s11.id, f.s2.id])
    assert.isTrue(contents.every((c) => c.isPublished))

    await barButton(page, 'Dépublier').click()
    await waitSaved(page)
    assert.isTrue(await until(async () => !(await publishedNow(CourseModule, f.s2.id))))
    const after = await CourseContent.query().whereIn('module_id', [f.s1.id, f.s11.id, f.s2.id])
    assert.isTrue(after.every((c) => !c.isPublished))

    const audits = await AuditLog.query()
      .whereLike('action', 'course.bulk.%')
      .where('resource_id', String(f.course.id))
    assert.lengthOf(audits, 2)
  })

  test('availability dialog sets dates and refuses an end before the start (BUILD-13)', async ({
    visit,
    assert,
  }) => {
    const f = (fixture = await createFixture())
    const page = await openBuilder(visit, f)

    await tick(page, 'Contenu A', 'Contenu C')
    await barButton(page, 'Disponibilité…').click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Disponible à partir du', { exact: true }).fill('2026-09-01')
    await dialog.getByLabel("Disponible jusqu'au", { exact: true }).fill('2026-09-30')
    await dialog.getByRole('button', { name: 'Appliquer' }).click()
    await waitSaved(page)
    assert.isTrue(
      await until(async () => (await isoDate(f.c3.id, 'availableFrom')) === '2026-09-01')
    )
    assert.equal(await isoDate(f.c1.id, 'availableUntil'), '2026-09-30')

    const requests = bulkRequests(page)
    await barButton(page, 'Disponibilité…').click()
    await dialog.getByLabel('Disponible à partir du', { exact: true }).fill('2026-10-10')
    await dialog.getByLabel("Disponible jusqu'au", { exact: true }).fill('2026-10-01')
    await dialog.getByRole('button', { name: 'Appliquer' }).click()
    const message = dialog.getByText('La date de fin doit être postérieure à la date de début.')
    assert.isTrue(await message.isVisible())
    assert.equal(
      await dialog
        .getByLabel("Disponible jusqu'au", { exact: true })
        .getAttribute('aria-describedby'),
      'bulk-availability-error'
    )
    assert.deepEqual(requests, [])
    assert.include((await status(page).textContent()) ?? '', 'Enregistré')
  })

  test('date shift by days and by anchor dates keeps empty dates empty (BUILD-13)', async ({
    visit,
    assert,
  }) => {
    const f = (fixture = await createFixture())
    f.c1.availableFrom = DateTime.fromISO('2026-09-01')
    f.c1.availableUntil = DateTime.fromISO('2026-09-10')
    await f.c1.save()
    const page = await openBuilder(visit, f)

    await tick(page, 'Contenu A', 'Contenu C')
    await barButton(page, 'Décaler les dates…').click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel("D'un nombre de jours", { exact: true }).check()
    await dialog.getByLabel('Nombre de jours (négatif pour avancer)', { exact: true }).fill('7')
    await dialog.getByRole('button', { name: 'Appliquer' }).click()
    await waitSaved(page)
    assert.isTrue(
      await until(async () => (await isoDate(f.c1.id, 'availableFrom')) === '2026-09-08')
    )
    assert.equal(await isoDate(f.c1.id, 'availableUntil'), '2026-09-17')
    assert.isNull(await isoDate(f.c3.id, 'availableFrom'))
    assert.isNull(await isoDate(f.c3.id, 'availableUntil'))

    await barButton(page, 'Décaler les dates…').click()
    await dialog.getByLabel("D'une ancienne date de début à une nouvelle", { exact: true }).check()
    await dialog.getByLabel('Ancienne date de début', { exact: true }).fill('2026-09-08')
    await dialog.getByLabel('Nouvelle date de début', { exact: true }).fill('2026-09-01')
    await dialog.getByRole('button', { name: 'Appliquer' }).click()
    await waitSaved(page)
    assert.isTrue(
      await until(async () => (await isoDate(f.c1.id, 'availableFrom')) === '2026-09-01')
    )
    assert.equal(await isoDate(f.c1.id, 'availableUntil'), '2026-09-10')
  })

  test('move to another section appends in plan order (BUILD-14)', async ({ visit, assert }) => {
    const f = (fixture = await createFixture())
    const page = await openBuilder(visit, f)

    await tick(page, 'Contenu B', 'Contenu A')
    await barButton(page, 'Déplacer vers…').click()
    const dialog = page.getByRole('dialog')
    const root = dialog.getByRole('button', { name: /^Racine du cours/ })
    assert.equal(await root.getAttribute('aria-disabled'), 'true')
    assert.isTrue(
      await dialog.getByText('Un contenu doit être placé dans une section.').isVisible()
    )
    await dialog.getByRole('button', { name: 'S2', exact: true }).click()
    await waitSaved(page)

    const expected = [f.c3.id, f.c1.id, f.c2.id]
    assert.isTrue(
      await until(async () => {
        const rows = await CourseContent.query()
          .where('module_id', f.s2.id)
          .orderBy('order', 'asc')
          .orderBy('id', 'asc')
        return rows.map((c) => c.id).join() === expected.join()
      })
    )
    await page.reload()
    await page.waitForLoadState('networkidle')
    const keys = await rowKeys(page)
    const s2 = keys.indexOf(`s-${f.s2.id}`)
    assert.deepEqual(
      keys.slice(s2 + 1, s2 + 4),
      expected.map((id) => `c-${id}`)
    )
  })

  test('duplicate places a draft copy right after the original (BUILD-14, D-12)', async ({
    visit,
    assert,
  }) => {
    const f = (fixture = await createFixture())
    const page = await openBuilder(visit, f)

    await tick(page, 'Contenu A')
    await barButton(page, 'Dupliquer').click()
    await waitSaved(page)

    const copy = await CourseContent.query().where('copied_from_id', f.c1.id).firstOrFail()
    assert.equal(copy.title, 'Contenu A (copie)')
    assert.isFalse(copy.isPublished)
    const keys = await rowKeys(page)
    assert.equal(keys[keys.indexOf(`c-${f.c1.id}`) + 1], `c-${copy.id}`)
    const copyRow = page.locator(`[data-row-key="c-${copy.id}"]`)
    assert.isTrue(await copyRow.getByText('Contenu A (copie)').isVisible())
    assert.isTrue(await copyRow.getByText('Brouillon').isVisible())
  })

  test('delete is blocked until the sub-tree is selected, then confirmed (BUILD-14)', async ({
    visit,
    assert,
  }) => {
    const f = (fixture = await createFixture())
    const page = await openBuilder(visit, f)

    await tick(page, 'S1', 'Contenu A')
    const blocked = barButton(page, 'Supprimer…')
    assert.equal(await blocked.getAttribute('aria-disabled'), 'true')
    assert.equal(await blocked.getAttribute('aria-describedby'), 'bulk-delete-reason')
    assert.isTrue(
      await bar(page)
        .getByText('Sélectionnez aussi tout le contenu des sections à supprimer.')
        .isVisible()
    )
    await blocked.click()
    assert.equal(await page.getByRole('alertdialog').count(), 0)

    await tick(page, 'Contenu B', 'S11', 'Contenu D')
    await barButton(page, 'Supprimer…').click()
    const dialog = page.getByRole('alertdialog')
    assert.include((await dialog.textContent()) ?? '', 'progression des apprenants')
    await dialog.getByRole('button', { name: 'Supprimer', exact: true }).click()
    await waitSaved(page)

    const keys = await rowKeys(page)
    for (const key of [f.s1, f.s11].map((s) => `s-${s.id}`)) assert.notInclude(keys, key)
    for (const key of [f.c1, f.c2, f.c4].map((c) => `c-${c.id}`)) assert.notInclude(keys, key)
    assert.isNull(await CourseModule.find(f.s1.id))
    assert.isNull(await CourseModule.find(f.s11.id))
    assert.isNull(await CourseContent.find(f.c4.id))
    assert.isNotNull(await CourseContent.find(f.c3.id))
    assert.isTrue(await until(async () => (await activeId(page)) === 'bulk-select-all', 2000))
  })

  test('a rename queued after a bulk publish raises no false conflict', async ({
    visit,
    assert,
  }) => {
    const f = (fixture = await createFixture())
    const page = await openBuilder(visit, f)
    const titleId = `#c-${f.c2.id}-title`

    await tick(page, 'Contenu B')
    await barButton(page, 'Publier').click()
    // No wait: the rename is queued behind the bulk request and must use its fresh token.
    await page.locator(titleId).click()
    await page.locator(`${titleId}-input`).fill('Contenu B2')
    await page.keyboard.press('Enter')
    await waitSaved(page)

    assert.equal(await page.getByText(CONFLICT_TEXT).count(), 0)
    const c2 = await CourseContent.findOrFail(f.c2.id)
    assert.isTrue(c2.isPublished)
    assert.equal(c2.title, 'Contenu B2')
  })

  test('Space toggles a checkbox without dragging and grabs a handle without selecting (BUILD-16)', async ({
    visit,
    assert,
  }) => {
    const f = (fixture = await createFixture())
    const page = await openBuilder(visit, f)
    const before = await rowKeys(page)
    const statusBefore = await status(page).textContent()

    await checkbox(page, 'Contenu A').focus()
    await page.keyboard.press('Space')
    await page.waitForTimeout(150)
    assert.isTrue(await checkbox(page, 'Contenu A').isChecked())
    assert.notInclude((await liveRegion(page).textContent()) ?? '', 'saisi')
    assert.equal(await status(page).textContent(), statusBefore)

    await page.getByRole('button', { name: 'Déplacer « Contenu B »' }).focus()
    await page.keyboard.press('Space')
    await page.waitForTimeout(150)
    assert.include((await liveRegion(page).textContent()) ?? '', 'saisi')
    assert.isTrue(await checkbox(page, 'Contenu A').isChecked())
    assert.isFalse(await checkbox(page, 'Contenu B').isChecked())
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    assert.deepEqual(await rowKeys(page), before)
  })

  test('select all and publish from the keyboard only (BUILD-16)', async ({ visit, assert }) => {
    const f = (fixture = await createFixture())
    const page = await openBuilder(visit, f)

    // The selection controls follow the header actions in tab order.
    await page.getByRole('button', { name: 'Nouveau module' }).focus()
    await page.keyboard.press('Tab')
    assert.equal(await activeId(page), 'bulk-select-all')
    await page.keyboard.press('Space')
    assert.equal(await countText(page), '7 éléments sélectionnés')
    for (let i = 0; i < 5 && (await activeText(page)) !== 'Publier'; i++) {
      await page.keyboard.press('Tab')
    }
    assert.equal(await activeText(page), 'Publier')
    await page.keyboard.press('Enter')
    await waitSaved(page)
    assert.isTrue(await until(async () => await publishedNow(CourseContent, f.c2.id)))
  })

  test('selection controls, bar and dialogs have no serious axe violations (BUILD-16)', async ({
    visit,
    assert,
  }) => {
    const f = (fixture = await createFixture())
    const page = await openBuilder(visit, f)

    await tick(page, 'Contenu A', 'Contenu C')
    assertNoSerious(await new AxeBuilder({ page }).withTags(WCAG).analyze(), 'bar visible', assert)

    await barButton(page, 'Décaler les dates…').click()
    await page.getByRole('dialog').waitFor()
    assertNoSerious(
      await new AxeBuilder({ page }).withTags(WCAG).analyze(),
      'date shift dialog',
      assert
    )
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({ state: 'hidden' })

    await barButton(page, 'Déplacer vers…').click()
    await page.getByRole('dialog').waitFor()
    assertNoSerious(await new AxeBuilder({ page }).withTags(WCAG).analyze(), 'move dialog', assert)
  })
})
