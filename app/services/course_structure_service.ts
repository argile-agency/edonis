import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import CourseModule from '#models/course_module'
import CourseContent from '#models/course_content'
import { depthOf, subtreeHeight, wouldCreateCycle } from '../helpers/category_tree.js'

/**
 * Structural moves of a course (sections and contents), shared by the builder
 * move endpoints and the bulk move. Callers own the transaction, the
 * course-row lock and the conflict-token check; this service only checks the
 * destination and rewrites the order of the touched sibling lists.
 */

// 0-based: root = 0, sub-section = 1 (D-02: 2 levels)
export const MAX_SECTION_DEPTH = 1

/** A parent or destination outside the course, the section itself, or one of its descendants. */
export const PARENT_ERROR = 'Module parent invalide.'
export const DEPTH_ERROR = 'Profondeur maximale : 2 niveaux.'
export const CONFLICT_ERROR = 'Cet élément a été modifié par un autre enseignant.'

export type MoveOutcome =
  | { ok: true; fromParentId: number | null; toParentId: number | null; position: number }
  | { ok: false; code: 'E_INVALID_DESTINATION' | 'E_DEPTH'; message: string }

const INVALID_DESTINATION: MoveOutcome = {
  ok: false,
  code: 'E_INVALID_DESTINATION',
  message: PARENT_ERROR,
}
const TOO_DEEP: MoveOutcome = { ok: false, code: 'E_DEPTH', message: DEPTH_ERROR }

/**
 * Conflict token check: the stored `updated_at` and the client's ISO token
 * match to the second (SQLite and MySQL store seconds only). Both null match;
 * an unparseable token never matches.
 *
 * shortcut: same-second writes by two users are not detected; switch to a lock_version column if that ever matters
 */
export function sameSecond(stored: DateTime | null, expected: string | null): boolean {
  if (stored === null || expected === null) return stored === expected
  const parsed = DateTime.fromISO(expected)
  return parsed.isValid && parsed.toUnixInteger() === stored.toUnixInteger()
}

export default class CourseStructureService {
  /**
   * `rows` is a sibling list in its final display order: writes `order = i + 1`
   * through the query builder (no `updated_at` bump), only where it changed.
   */
  static async renumber(
    trx: TransactionClientContract,
    rows: { id: number; order: number }[],
    model: typeof CourseModule | typeof CourseContent
  ): Promise<void> {
    for (const [i, row] of rows.entries()) {
      if (row.order === i + 1) continue
      await trx
        .from(model.table)
        .where('id', row.id)
        .update({ order: i + 1 })
    }
  }

  /**
   * Moves `content` to `position` (0-based, clamped, item excluded) in section
   * `moduleId`, renumbering the destination and, if it changed, the source.
   * Precondition: the caller holds the course-row lock, re-read the row with `trx` and checked its token.
   */
  static async moveContent(
    trx: TransactionClientContract,
    courseId: number,
    content: CourseContent,
    moduleId: number,
    position: number
  ): Promise<MoveOutcome> {
    const dest = await CourseModule.query({ client: trx })
      .where('id', moduleId)
      .where('course_id', courseId)
      .first()
    if (!dest) return INVALID_DESTINATION

    // A section deeper than the limit is invisible to learners (legacy data)
    const parentById = await this.parentMap(trx, courseId)
    if (depthOf(parentById, dest.id) > MAX_SECTION_DEPTH) return TOO_DEEP

    const fromModuleId = content.moduleId
    const siblings = await CourseContent.query({ client: trx })
      .where('module_id', dest.id)
      .whereNot('id', content.id)
      .orderBy('order', 'asc')
      .orderBy('id', 'asc')
    const index = Math.min(position, siblings.length)
    const final = siblings.map((s) => ({ id: s.id, order: s.order }))
    final.splice(index, 0, { id: content.id, order: index + 1 })
    await this.renumber(trx, final, CourseContent)

    content.useTransaction(trx)
    await content.merge({ moduleId: dest.id, order: index + 1 }).save()

    if (fromModuleId !== dest.id) {
      const source = await CourseContent.query({ client: trx })
        .where('module_id', fromModuleId)
        .orderBy('order', 'asc')
        .orderBy('id', 'asc')
      await this.renumber(trx, source, CourseContent)
    }

    return { ok: true, fromParentId: fromModuleId, toParentId: dest.id, position: index }
  }

  /**
   * Moves `module` to `position` (0-based, clamped, item excluded) under
   * `parentId` (null = course root). Same-course and cycle checks run before
   * the depth check, which counts the moved section's own sub-sections.
   * Precondition: the caller holds the course-row lock, re-read the row with `trx` and checked its token.
   */
  static async moveModule(
    trx: TransactionClientContract,
    courseId: number,
    module: CourseModule,
    parentId: number | null,
    position: number
  ): Promise<MoveOutcome> {
    const parentById = await this.parentMap(trx, courseId)
    if (parentId !== null) {
      if (!parentById.has(parentId)) return INVALID_DESTINATION
      if (wouldCreateCycle(parentById, module.id, parentId)) return INVALID_DESTINATION
    }

    const newDepth = parentId === null ? 0 : depthOf(parentById, parentId) + 1
    if (newDepth + subtreeHeight(parentById, module.id) > MAX_SECTION_DEPTH) return TOO_DEEP

    const fromParentId = module.parentId
    const siblings = await this.siblingsOf(trx, courseId, parentId, module.id)
    const index = Math.min(position, siblings.length)
    const final = siblings.map((s) => ({ id: s.id, order: s.order }))
    final.splice(index, 0, { id: module.id, order: index + 1 })
    await this.renumber(trx, final, CourseModule)

    module.useTransaction(trx)
    await module.merge({ parentId, order: index + 1 }).save()

    if (fromParentId !== parentId) {
      const source = await this.siblingsOf(trx, courseId, fromParentId, module.id)
      await this.renumber(trx, source, CourseModule)
    }

    return { ok: true, fromParentId, toParentId: parentId, position: index }
  }

  /** Sections under `parentId` (null = roots) other than `excludeId`, in display order. */
  private static async siblingsOf(
    trx: TransactionClientContract,
    courseId: number,
    parentId: number | null,
    excludeId: number
  ): Promise<CourseModule[]> {
    const query = CourseModule.query({ client: trx })
      .where('course_id', courseId)
      .whereNot('id', excludeId)
    if (parentId === null) {
      query.whereNull('parent_id')
    } else {
      query.where('parent_id', parentId)
    }
    return query.orderBy('order', 'asc').orderBy('id', 'asc')
  }

  /** `id -> parent_id` of every section of the course. */
  private static async parentMap(
    trx: TransactionClientContract,
    courseId: number
  ): Promise<Map<number, number | null>> {
    const modules = await CourseModule.query({ client: trx })
      .where('course_id', courseId)
      .select('id', 'parent_id')
    return new Map(modules.map((m) => [m.id, m.parentId]))
  }
}
