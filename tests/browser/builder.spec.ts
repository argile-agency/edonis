import { test } from '@japa/runner'
import type { Page } from 'playwright'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import type Course from '#models/course'
import CourseModule from '#models/course_module'
import CourseContent from '#models/course_content'
import { createCourse } from '#tests/functional/helpers/factories'

/**
 * Course builder without dragging (phase 05, plan 06): menu moves, inline
 * rename, details panel, deletes, add flows and the save indicator.
 * The save indicator is the `#save-status >> role=status` live region.
 */

const CONFLICT_TEXT = 'Cet élément a été modifié par un autre enseignant'

interface Fixture {
  course: Course
  s1: CourseModule
  s2: CourseModule
  s11: CourseModule
  c1: CourseContent
  c2: CourseContent
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
  const content = (title: string, order: number) =>
    CourseContent.create({
      moduleId: s1.id,
      contentType: 'page',
      title,
      content: 'Corps',
      order,
      isPublished: true,
    })
  const c1 = await content('Contenu A', 1)
  const c2 = await content('Contenu B', 2)
  return { course, s1, s2, s11, c1, c2 }
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

const row = (page: Page, key: string) => page.locator(`[data-row-key="${key}"]`)

/** Waits for the indicator to read "Enregistré" (only once the whole queue has drained). */
async function waitSaved(page: Page) {
  await page
    .locator('#save-status')
    .getByRole('status')
    .filter({ hasText: 'Enregistré' })
    .waitFor({ timeout: 10_000 })
}

async function rowKeys(page: Page): Promise<string[]> {
  return page
    .locator('[data-row-key]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-row-key') ?? ''))
}

async function openActions(page: Page, title: string) {
  await page.getByRole('button', { name: `Actions pour « ${title} »` }).click()
}

// String expressions: the backend tsconfig has no DOM lib.
async function scrollY(page: Page): Promise<number> {
  return Number(await page.evaluate('window.scrollY'))
}

/** Radix risk (05-05): a dialog opened from a menu must not leave the body unclickable. */
async function bodyPointerEvents(page: Page): Promise<string> {
  return String(await page.evaluate('getComputedStyle(document.body).pointerEvents'))
}

/** Polls the DB until `check` holds; the UI may show the row before the request lands. */
async function until(check: () => Promise<boolean>, timeout = 5000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    if (await check()) return true
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return check()
}

/** Polls until `get` returns a row, then returns it (fails the test after the timeout). */
async function eventually<T>(get: () => Promise<T | null>, timeout = 5000): Promise<T> {
  let found: T | null = null
  await until(async () => (found = await get()) !== null, timeout)
  if (found === null) throw new Error('Row not found in the database')
  return found
}

/** dnd-kit's announcement region (client-only portal). */
const liveRegion = (page: Page) => page.locator('[id^="DndLiveRegion"]')

/** Presses keys one by one; dnd-kit needs a moment to measure between steps. */
async function press(page: Page, ...keys: string[]) {
  for (const key of keys) {
    await page.keyboard.press(key)
    await page.waitForTimeout(150)
  }
}

/** Focuses a row's drag handle and picks it up with Space. */
async function grab(page: Page, title: string) {
  await page.getByRole('button', { name: `Déplacer « ${title} »` }).focus()
  await page.keyboard.press('Space')
  await page.waitForTimeout(150)
}

async function sectionParent(id: number) {
  const section = await CourseModule.findOrFail(id)
  return section.parentId
}

async function contentModule(id: number) {
  const content = await CourseContent.findOrFail(id)
  return content.moduleId
}

/** Raw read: the model hooks hide trashed rows (Phase 5.2). */
async function inTrash(table: 'course_modules' | 'course_contents', id: number) {
  const item = await db.from(table).where('id', id).select('deleted_at').first()
  return item !== null && item.deleted_at !== null
}

const toaster = (page: Page) => page.locator('[data-sonner-toaster]')
const trashButton = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

async function contentOrder(moduleId: number): Promise<number[]> {
  const items = await CourseContent.query()
    .where('module_id', moduleId)
    .orderBy('order', 'asc')
    .orderBy('id', 'asc')
  return items.map((c) => c.id)
}

test.group('Course builder', (group) => {
  group.each.teardown(async () => {
    // Sections, contents and progress cascade with the course.
    await fixture?.course.delete()
    fixture = null
  })

  test('builder hydrates without dnd-kit mismatch', async ({ visit, assert }) => {
    const f = (fixture = await createFixture())
    const messages: string[] = []
    const page = await visit('/login')
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') messages.push(msg.text())
    })
    await login(page, 'teacher@edonis.test')
    await page.goto(`/courses/${f.course.id}/builder`)
    await page.waitForLoadState('networkidle')

    // The app header's own hydration warnings (phase 4) are known; only dnd-kit ones fail.
    const dndKit = messages.filter((m) =>
      /DndDescribedBy|DndLiveRegion|aria-roledescription/.test(m)
    )
    assert.deepEqual(dndKit, [])
    assert.isTrue(await page.getByRole('button', { name: 'Déplacer « Contenu A »' }).isVisible())
  })

  test('menu move to another section saves and persists (BUILD-02, BUILD-10)', async ({
    visit,
    assert,
  }) => {
    const f = (fixture = await createFixture())
    const page = await openBuilder(visit, f)

    await openActions(page, 'Contenu A')
    await page.getByRole('menuitem', { name: 'Déplacer vers…' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'S2', exact: true }).click()
    await waitSaved(page)
    // The modal layer holds pointer-events until its exit animation unmounts it.
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    assert.notEqual(await bodyPointerEvents(page), 'none')

    await page.reload()
    await page.waitForLoadState('networkidle')
    const keys = await rowKeys(page)
    assert.isAbove(keys.indexOf(`c-${f.c1.id}`), keys.indexOf(`s-${f.s2.id}`))
    const c1 = await CourseContent.findOrFail(f.c1.id)
    assert.equal(c1.moduleId, f.s2.id)
  })

  test('Monter moves a content item up (BUILD-01)', async ({ visit, assert }) => {
    const f = (fixture = await createFixture())
    const page = await openBuilder(visit, f)

    await openActions(page, 'Contenu B')
    await page.getByRole('menuitem', { name: 'Monter' }).click()
    await waitSaved(page)

    await page.reload()
    await page.waitForLoadState('networkidle')
    const keys = await rowKeys(page)
    assert.isBelow(keys.indexOf(`c-${f.c2.id}`), keys.indexOf(`c-${f.c1.id}`))
  })

  test('section move respects the depth rule (BUILD-03)', async ({ visit, assert }) => {
    const f = (fixture = await createFixture())
    const page = await openBuilder(visit, f)

    await openActions(page, 'S1')
    await page.getByRole('menuitem', { name: 'Déplacer vers…' }).click()
    const dialog = page.getByRole('dialog')
    const s2Target = dialog.getByRole('button', { name: /^S2/ })
    assert.equal(await s2Target.getAttribute('aria-disabled'), 'true')
    assert.include(await s2Target.textContent(), 'Profondeur maximale : 2 niveaux.')
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    assert.notEqual(await bodyPointerEvents(page), 'none')

    await openActions(page, 'S2')
    await page.getByRole('menuitem', { name: 'Déplacer vers…' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'S1', exact: true }).click()
    await waitSaved(page)
    const s2 = await CourseModule.findOrFail(f.s2.id)
    assert.equal(s2.parentId, f.s1.id)
  })

  test('inline rename saves on Enter and Escape restores (BUILD-05)', async ({ visit, assert }) => {
    const f = (fixture = await createFixture())
    const page = await openBuilder(visit, f)
    const titleId = `#s-${f.s1.id}-title`

    await page.locator(titleId).click()
    await page.locator(`${titleId}-input`).fill('Introduction')
    await page.keyboard.press('Enter')
    await waitSaved(page)

    await page.reload()
    await page.waitForLoadState('networkidle')
    assert.equal(await page.locator(titleId).textContent(), 'Introduction')

    await page.locator(titleId).click()
    await page.locator(`${titleId}-input`).fill('Autre titre')
    await page.keyboard.press('Escape')
    assert.equal(await page.locator(titleId).textContent(), 'Introduction')
  })

  test('details panel saves the description on blur (BUILD-08)', async ({ visit, assert }) => {
    const f = (fixture = await createFixture())
    const page = await openBuilder(visit, f)
    const details = row(page, `c-${f.c1.id}`).getByRole('button', { name: 'Détails', exact: true })

    await details.click()
    assert.equal(await details.getAttribute('aria-expanded'), 'true')
    await page.locator(`#c-${f.c1.id}-description`).fill('Nouvelle description')
    await page.locator(`#c-${f.c1.id}-description`).blur()
    await waitSaved(page)

    await eventually(() =>
      CourseContent.query()
        .where('id', f.c1.id)
        .where('description', 'Nouvelle description')
        .first()
    )
  })

  test('deletes go to the trash and « Annuler » restores them in place (BUILD-06, BUILD-09, TRASH-10)', async ({
    visit,
    assert,
  }) => {
    const f = (fixture = await createFixture())
    const page = await openBuilder(visit, f)
    const before = await rowKeys(page)
    await trashButton(page, 'Corbeille').waitFor()

    // A non-empty section is deletable (D-03): the dialog speaks of the trash and its delay.
    await openActions(page, 'S1')
    const item = page.getByRole('menuitem', { name: 'Supprimer', exact: true })
    assert.isNull(await item.getAttribute('aria-disabled'))
    await item.click()
    const dialog = page.getByRole('alertdialog')
    const text = (await dialog.textContent()) ?? ''
    assert.include(text, 'déplacée dans la corbeille')
    assert.include(text, 'jour')
    await dialog.getByRole('button', { name: 'Supprimer la section', exact: true }).click()
    await row(page, `s-${f.s1.id}`).waitFor({ state: 'detached' })
    for (const key of [`s-${f.s11.id}`, `c-${f.c1.id}`, `c-${f.c2.id}`]) {
      assert.equal(await row(page, key).count(), 0)
    }
    await toaster(page).getByText('« S1 » déplacé dans la corbeille.').waitFor()
    await trashButton(page, 'Corbeille (1)').waitFor()
    assert.isTrue(await until(() => inTrash('course_modules', f.s1.id)))
    assert.isTrue(await inTrash('course_contents', f.c1.id))

    // Undo restores the batch at the same place.
    await toaster(page).getByRole('button', { name: 'Annuler' }).click()
    await toaster(page).getByText('Restauration effectuée.').waitFor()
    await waitSaved(page)
    assert.deepEqual(await rowKeys(page), before)
    assert.isTrue(await until(async () => !(await inTrash('course_modules', f.s1.id)), 5000))
    assert.isFalse(await inTrash('course_modules', f.s11.id))
    assert.isFalse(await inTrash('course_contents', f.c2.id))
    await trashButton(page, 'Corbeille').waitFor()

    // A content: the dialog closes cleanly and focus lands on a neighbour.
    await openActions(page, 'Contenu B')
    await page.getByRole('menuitem', { name: 'Supprimer', exact: true }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Supprimer le contenu', exact: true })
      .click()
    await waitSaved(page)
    await row(page, `c-${f.c2.id}`).waitFor({ state: 'detached' })
    assert.notEqual(await bodyPointerEvents(page), 'none')
    const focusedId = String(await page.evaluate("document.activeElement?.id ?? ''"))
    assert.match(focusedId, /^[sc]-\d+-title$/)
    await toaster(page).getByText('« Contenu B » déplacé dans la corbeille.').waitFor()
    await trashButton(page, 'Corbeille (1)').waitFor()
    assert.isNull(await CourseContent.find(f.c2.id))
    assert.isTrue(await until(() => inTrash('course_contents', f.c2.id)))
  })

  test('only root sections offer a sub-section (D-02)', async ({ visit, assert }) => {
    const f = (fixture = await createFixture())
    const page = await openBuilder(visit, f)

    const subButton = (key: string) =>
      row(page, key).getByRole('button', { name: 'Sous-section', exact: true })
    assert.equal(await subButton(`s-${f.s11.id}`).count(), 0)
    assert.equal(await subButton(`s-${f.s1.id}`).count(), 1)
  })

  test('rapid move then rename does not conflict with itself (token race guard)', async ({
    visit,
    assert,
  }) => {
    const f = (fixture = await createFixture())
    const page = await openBuilder(visit, f)
    const titleId = `#c-${f.c2.id}-title`

    await openActions(page, 'Contenu B')
    await page.getByRole('menuitem', { name: 'Monter' }).click()
    await page.locator(titleId).click()
    await page.locator(`${titleId}-input`).fill('Contenu B2')
    await page.keyboard.press('Enter')
    await waitSaved(page)

    assert.equal(await page.getByText(CONFLICT_TEXT).count(), 0)
    await eventually(() =>
      CourseContent.query().where('id', f.c2.id).where('title', 'Contenu B2').first()
    )
    const ordered = await CourseContent.query()
      .where('module_id', f.s1.id)
      .orderBy('order', 'asc')
      .orderBy('id', 'asc')
    assert.equal(ordered[0].id, f.c2.id)
  })

  test('add a section, a sub-section and a typed content without scroll jump (BUILD-04, BUILD-07)', async ({
    visit,
    assert,
  }) => {
    const f = (fixture = await createFixture())
    const page = await openBuilder(visit, f)
    await page.setViewportSize({ width: 1280, height: 500 })
    const createIn = async (title: string) => {
      const dialog = page.getByRole('dialog')
      await dialog.locator('#title').fill(title)
      await dialog.getByRole('button', { name: 'Créer', exact: true }).click()
      await dialog.waitFor({ state: 'hidden' })
    }

    await page.getByRole('button', { name: 'Nouveau module', exact: true }).click()
    await createIn('Section créée')
    const section = await eventually(() =>
      CourseModule.query()
        .where('course_id', f.course.id)
        .where('title', 'Section créée')
        .whereNull('parent_id')
        .first()
    )
    await row(page, `s-${section.id}`).waitFor()

    await row(page, `s-${section.id}`)
      .getByRole('button', { name: 'Sous-section', exact: true })
      .click()
    await createIn('Sous-section créée')
    const sub = await eventually(() =>
      CourseModule.query()
        .where('course_id', f.course.id)
        .where('title', 'Sous-section créée')
        .first()
    )
    assert.equal(sub.parentId, section.id)
    const subRow = row(page, `s-${sub.id}`)
    await subRow.waitFor()
    assert.include(await subRow.getAttribute('style'), 'padding-left: 24px')

    await subRow.scrollIntoViewIfNeeded()
    let before = await scrollY(page)
    if (before === 0) {
      await page.evaluate('window.scrollBy(0, 200)')
      before = await scrollY(page)
    }
    assert.isAbove(before, 0)

    await subRow.getByRole('button', { name: 'Contenu', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('#contentType').click()
    await page.getByRole('option', { name: 'Vidéo' }).click()
    await dialog.locator('#contentTitle').fill('Contenu créé')
    await dialog.locator('#externalUrl').fill('https://example.com/video')
    await dialog.getByRole('button', { name: 'Créer', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })

    await page.locator('[data-row-key^="c-"]', { hasText: 'Contenu créé' }).waitFor()
    const after = await scrollY(page)
    assert.isAtMost(Math.abs(after - before), 40)

    const created = await eventually(() =>
      CourseContent.query().where('module_id', sub.id).where('title', 'Contenu créé').first()
    )
    assert.equal(created.contentType, 'video')
    assert.equal(created.moduleId, sub.id)
  })

  test('keyboard drag reorders a content within its section (BUILD-01)', async ({
    visit,
    assert,
  }) => {
    const f = (fixture = await createFixture())
    const page = await openBuilder(visit, f)

    await grab(page, 'Contenu A')
    assert.include(await liveRegion(page).textContent(), '« Contenu A » saisi.')
    await press(page, 'ArrowDown', 'Space')
    await waitSaved(page)

    const expected = `${f.c2.id},${f.c1.id}`
    assert.isTrue(
      await until(async () => {
        const order = await contentOrder(f.s1.id)
        return order.join() === expected
      })
    )
    await page.reload()
    await page.waitForLoadState('networkidle')
    const keys = await rowKeys(page)
    assert.isBelow(keys.indexOf(`c-${f.c2.id}`), keys.indexOf(`c-${f.c1.id}`))
  })

  test('keyboard drag moves a content into an empty section (BUILD-02)', async ({
    visit,
    assert,
  }) => {
    const f = (fixture = await createFixture())
    const page = await openBuilder(visit, f)

    // Rows: S1, Contenu A, Contenu B, S11, S2 → three steps put Contenu A right after S2.
    await grab(page, 'Contenu A')
    await press(page, 'ArrowDown', 'ArrowDown', 'ArrowDown')
    assert.include(await liveRegion(page).textContent(), 'Sera déposé dans « S2 », position 1.')
    await press(page, 'Space')
    await waitSaved(page)

    assert.isTrue(await until(async () => (await contentModule(f.c1.id)) === f.s2.id))
    await page.reload()
    await page.waitForLoadState('networkidle')
    const keys = await rowKeys(page)
    assert.isAbove(keys.indexOf(`c-${f.c1.id}`), keys.indexOf(`s-${f.s2.id}`))
  })

  test('keyboard ArrowRight nests a section, never past 2 levels (BUILD-03)', async ({
    visit,
    assert,
  }) => {
    const f = (fixture = await createFixture())
    const page = await openBuilder(visit, f)

    // Sections-only list during the drag: S1, S11, S2. ArrowRight puts S2 under S1, after S11.
    await grab(page, 'S2')
    await press(page, 'ArrowRight')
    assert.include(await liveRegion(page).textContent(), 'Sera déposé dans « S1 », position 2.')
    await press(page, 'Space')
    await waitSaved(page)
    assert.isTrue(await until(async () => (await sectionParent(f.s2.id)) === f.s1.id))

    // S1 has sub-sections: a third level is not offered, the drop stays at the root.
    await page.reload()
    await page.waitForLoadState('networkidle')
    await grab(page, 'S1')
    await press(page, 'ArrowRight', 'Space')
    await page.waitForTimeout(500)
    assert.notInclude(await page.locator('#save-status').innerText(), 'Enregistrement')
    assert.isNull(await sectionParent(f.s1.id))
    assert.equal(await sectionParent(f.s2.id), f.s1.id)
  })

  test('keyboard ArrowUp moves a section below content rows exactly one slot (reflow)', async ({
    visit,
    assert,
  }) => {
    const f = (fixture = await createFixture())
    const page = await openBuilder(visit, f)

    // S2 sits below S1's contents, which are hidden while a section is dragged.
    await grab(page, 'S2')
    await press(page, 'ArrowUp')
    assert.include(await liveRegion(page).textContent(), 'Sera déposé dans « S1 », position 1.')
    await press(page, 'Space')
    await waitSaved(page)

    assert.isTrue(await until(async () => (await sectionParent(f.s2.id)) === f.s1.id))
    const children = await CourseModule.query()
      .where('parent_id', f.s1.id)
      .orderBy('order', 'asc')
      .orderBy('id', 'asc')
    assert.deepEqual(
      children.map((s) => s.id),
      [f.s2.id, f.s11.id]
    )
  })

  test('Escape cancels a keyboard drag without saving', async ({ visit, assert }) => {
    const f = (fixture = await createFixture())
    const page = await openBuilder(visit, f)
    const before = await rowKeys(page)

    await grab(page, 'Contenu A')
    await press(page, 'ArrowDown')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    assert.include(await liveRegion(page).textContent(), 'Déplacement annulé.')
    assert.notInclude(await page.locator('#save-status').innerText(), 'Enregistrement')
    assert.deepEqual(await rowKeys(page), before)
    assert.deepEqual(await contentOrder(f.s1.id), [f.c1.id, f.c2.id])
  })
})
