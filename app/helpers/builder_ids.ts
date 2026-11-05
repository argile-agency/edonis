import type { loadBuilderStructure } from './builder_props.js'

// Pivot rows per INSERT (SQLite compiles multiInsert to a compound SELECT, 500 terms max)
export const PIVOT_CHUNK = 100

export type Kind = 'section' | 'content'
export type Item = { kind: Kind; id: number; updatedAt: string | null }
export type Ids = { sectionIds: number[]; contentIds: number[] }
export type Structure = Awaited<ReturnType<typeof loadBuilderStructure>>

export type Outcome = {
  auditAction: string
  extraMetadata?: Record<string, unknown>
  /** Rows this action saved or created. */
  affected: Ids
  deleted?: Ids
  /** Trash batch id of a delete. */
  batch?: string
  /** Renumbered sibling lists: section lists by parent (null = roots), content lists by section. */
  touchedParents?: (number | null)[]
  touchedSections?: number[]
}

/** A refusal thrown inside the transaction so it rolls back; turned into JSON outside it. */
export class BulkRefusal extends Error {
  constructor(
    public status: 404 | 409 | 422,
    public body: Record<string, unknown>
  ) {
    super(String(body.code ?? 'E_BULK_REFUSED'))
  }
}

export const emptyIds = (): Ids => ({ sectionIds: [], contentIds: [] })

export function push(ids: Ids, kind: Kind, id: number) {
  ;(kind === 'section' ? ids.sectionIds : ids.contentIds).push(id)
}

export function sorted(ids: Ids): Ids {
  const sort = (list: number[]) => [...new Set(list)].sort((a, b) => a - b)
  return { sectionIds: sort(ids.sectionIds), contentIds: sort(ids.contentIds) }
}

export function idsOf(items: Item[]): Ids {
  const ids = emptyIds()
  for (const item of items) push(ids, item.kind, item.id)
  return sorted(ids)
}

/** `affected` plus every row of the sibling lists the action renumbered (they need their new order). */
export function withRenumbered(outcome: Outcome, structure: Structure): Ids {
  const ids: Ids = {
    sectionIds: [...outcome.affected.sectionIds],
    contentIds: [...outcome.affected.contentIds],
  }
  const parents = new Set(outcome.touchedParents ?? [])
  const lists = new Set(outcome.touchedSections ?? [])
  for (const s of structure.sections) if (parents.has(s.parentId)) ids.sectionIds.push(s.id)
  for (const c of structure.contents) if (lists.has(c.moduleId)) ids.contentIds.push(c.id)
  return sorted(ids)
}
