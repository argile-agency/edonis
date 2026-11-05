import { randomUUID } from 'node:crypto'
import type { QueryClientContract, TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import { loadBuilderStructure } from '../helpers/builder_props.js'
import { PIVOT_CHUNK, sorted, type Ids } from '../helpers/builder_ids.js'

export type TrashedRow = {
  kind: 'section' | 'content'
  id: number
  title: string
  type: string | null
  /** `parent_id` for a section, `module_id` for a content. */
  parentId: number | null
  order: number
  deletedAt: DateTime
  batch: string
  deletedById: number | null
}

const nullableNumber = (value: unknown) => (value === null ? null : Number(value))

/**
 * The builder trash (D-01, D-07). Raw trx.from() reads/writes on purpose: the
 * model hooks hide trashed rows.
 */
export default class TrashService {
  /**
   * Moves `roots` and their whole live subtree to the trash under one new batch.
   * Keeps `order`, progress and file pivots; conflict tokens stay as they are, no renumbering.
   * Rows already trashed are left as they are.
   */
  static async trash(
    trx: TransactionClientContract,
    courseId: number,
    roots: Ids,
    userId: number
  ): Promise<{ batch: string; deleted: Ids }> {
    const structure = await loadBuilderStructure(courseId, trx)
    const childrenOf = new Map<number, number[]>()
    for (const s of structure.sections) {
      if (s.parentId !== null)
        childrenOf.set(s.parentId, [...(childrenOf.get(s.parentId) ?? []), s.id])
    }
    const contentsOf = new Map<number, number[]>()
    for (const c of structure.contents) {
      contentsOf.set(c.moduleId, [...(contentsOf.get(c.moduleId) ?? []), c.id])
    }

    const liveSections = new Set(structure.sections.map((s) => s.id))
    const liveContents = new Set(structure.contents.map((c) => c.id))
    const sectionIds = new Set<number>()
    const contentIds = new Set(roots.contentIds.filter((id) => liveContents.has(id)))
    const stack = roots.sectionIds.filter((id) => liveSections.has(id))
    while (stack.length > 0) {
      const s = stack.pop()!
      if (sectionIds.has(s)) continue
      sectionIds.add(s)
      for (const c of contentsOf.get(s) ?? []) contentIds.add(c)
      stack.push(...(childrenOf.get(s) ?? []))
    }

    const batch = randomUUID()
    const values = {
      deleted_at: this.toDbDateTime(DateTime.now(), trx),
      deleted_batch: batch,
      deleted_by_id: userId,
    }
    const write = async (table: string, ids: number[]) => {
      for (let i = 0; i < ids.length; i += PIVOT_CHUNK) {
        await trx
          .from(table)
          .whereIn('id', ids.slice(i, i + PIVOT_CHUNK))
          .whereNull('deleted_at')
          .update(values)
      }
    }
    await write('course_modules', [...sectionIds])
    await write('course_contents', [...contentIds])

    return { batch, deleted: sorted({ sectionIds: [...sectionIds], contentIds: [...contentIds] }) }
  }

  /** Every trashed section and content of the course, any batch. */
  static async trashedRows(client: QueryClientContract, courseId: number): Promise<TrashedRow[]> {
    const sections = await client
      .from('course_modules')
      .where('course_id', courseId)
      .whereNotNull('deleted_at')
      .select('id', 'title', 'parent_id', 'order', 'deleted_at', 'deleted_batch', 'deleted_by_id')
    const contents = await client
      .from('course_contents')
      .join('course_modules', 'course_modules.id', 'course_contents.module_id')
      .where('course_modules.course_id', courseId)
      .whereNotNull('course_contents.deleted_at')
      .select(
        'course_contents.id',
        'course_contents.title',
        'course_contents.content_type',
        'course_contents.module_id',
        'course_contents.order',
        'course_contents.deleted_at',
        'course_contents.deleted_batch',
        'course_contents.deleted_by_id'
      )

    const common = (row: Record<string, any>) => ({
      id: Number(row.id),
      title: row.title as string,
      order: Number(row.order),
      deletedAt: this.fromDbDateTime(row.deleted_at),
      batch: row.deleted_batch as string,
      deletedById: nullableNumber(row.deleted_by_id),
    })
    return [
      ...sections.map((row) => ({
        ...common(row),
        kind: 'section' as const,
        type: null,
        parentId: nullableNumber(row.parent_id),
      })),
      ...contents.map((row) => ({
        ...common(row),
        kind: 'content' as const,
        type: row.content_type as string,
        parentId: Number(row.module_id),
      })),
    ]
  }

  /** Batch roots: trashed rows whose parent is not a trashed row of the same batch. */
  static rootsOf(rows: TrashedRow[]): TrashedRow[] {
    const batchOfSection = new Map(
      rows.filter((r) => r.kind === 'section').map((r) => [r.id, r.batch])
    )
    return rows.filter((r) => r.parentId === null || batchOfSection.get(r.parentId) !== r.batch)
  }

  /** `client`: `db` outside a transaction, `trx` inside (SQLite has one connection). */
  static async countRoots(courseId: number, client: QueryClientContract): Promise<number> {
    return this.rootsOf(await this.trashedRows(client, courseId)).length
  }

  /** Dialect format: SQLite stores and compares timestamps as text. */
  static toDbDateTime(dt: DateTime, client: QueryClientContract): string {
    return dt.toFormat(client.dialect.dateTimeFormat)
  }

  /** pg/mysql2 return a Date, SQLite a string; both read in the app zone. */
  static fromDbDateTime(value: Date | string): DateTime {
    return value instanceof Date ? DateTime.fromJSDate(value) : DateTime.fromSQL(value)
  }
}
