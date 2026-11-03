/**
 * Pure movement rules of the course builder (rows, drop projections, move
 * targets, optimistic apply, delete rule). No imports at all: the backend
 * Japa runner compiles this file for its unit tests, and the client imports it.
 * Every tree walk terminates on corrupt (cyclic) data.
 */

export type ContentType = 'page' | 'file' | 'video' | 'link' | 'assignment' | 'quiz'

export interface BuilderSection {
  id: number
  parentId: number | null
  title: string
  description: string | null
  order: number
  isPublished: boolean
  availableFrom: string | null
  availableUntil: string | null
  updatedAt: string | null
}

export interface BuilderContent {
  id: number
  moduleId: number
  contentType: ContentType
  title: string
  description: string | null
  order: number
  isPublished: boolean
  availableFrom: string | null
  availableUntil: string | null
  updatedAt: string | null
}

export type BuilderRow =
  | {
      kind: 'section'
      key: string
      id: number
      depth: number
      /** Effective parent: null for a root, or when the stored parent is missing. */
      parentId: number | null
      tooDeep: boolean
      collapsed: boolean
      /** Number of contents directly in the section (a collapsed drop lands at the end). */
      contentCount: number
      section: BuilderSection
    }
  | {
      kind: 'content'
      key: string
      id: number
      depth: number
      parentId: number
      content: BuilderContent
    }

export type ItemRef = { kind: 'section' | 'content'; id: number }

export type Placement = { parentId: number | null; position: number }

export type MoveTarget = {
  parentId: number | null
  label: string
  depth: number
  disabledReason: string | null
}

/** 0-based: root = 0, sub-section = 1 (D-02: 2 levels). */
export const MAX_SECTION_DEPTH = 1
export const DEPTH_MESSAGE = 'Profondeur maximale : 2 niveaux.'
export const NOT_EMPTY_MESSAGE = "Déplacez ou supprimez d'abord son contenu."

const CURRENT_MESSAGE = 'Emplacement actuel'
const SELF_MESSAGE =
  'Une section ne peut pas être placée dans elle-même ni dans une de ses sous-sections.'
const ROOT_LABEL = 'Racine du cours'

export function rowKey(ref: ItemRef): string {
  return `${ref.kind === 'section' ? 's' : 'c'}-${ref.id}`
}

type Ordered = { id: number; order: number }

function byOrder(a: Ordered, b: Ordered): number {
  return a.order - b.order || a.id - b.id
}

function arrayMove<T>(list: ReadonlyArray<T>, from: number, to: number): T[] {
  const copy = [...list]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}

/** Stored parent if it exists in the list, else null (treated as a root). */
function effectiveParent(ids: ReadonlySet<number>, section: BuilderSection): number | null {
  return section.parentId !== null && ids.has(section.parentId) ? section.parentId : null
}

/** Steps up to a root; stops on a missing parent or a revisit (cyclic data). */
export function sectionDepth(sections: ReadonlyArray<BuilderSection>, id: number): number {
  const parentById = new Map(sections.map((s) => [s.id, s.parentId]))
  const seen = new Set([id])
  let depth = 0
  let current = parentById.get(id) ?? null
  while (current !== null && parentById.has(current) && !seen.has(current)) {
    seen.add(current)
    depth += 1
    current = parentById.get(current) ?? null
  }
  return depth
}

/** Height of the sub-tree under `id` (a leaf gives 0), BFS by levels with a visited set. */
export function sectionSubtreeHeight(sections: ReadonlyArray<BuilderSection>, id: number): number {
  const childrenByParent = new Map<number, number[]>()
  for (const s of sections) {
    if (s.parentId === null) continue
    const siblings = childrenByParent.get(s.parentId)
    if (siblings) siblings.push(s.id)
    else childrenByParent.set(s.parentId, [s.id])
  }

  const visited = new Set([id])
  let level = [id]
  let height = 0
  while (true) {
    const next: number[] = []
    for (const parent of level) {
      for (const child of childrenByParent.get(parent) ?? []) {
        if (visited.has(child)) continue
        visited.add(child)
        next.push(child)
      }
    }
    if (next.length === 0) return height
    height += 1
    level = next
  }
}

export function buildRows(
  sections: ReadonlyArray<BuilderSection>,
  contents: ReadonlyArray<BuilderContent>,
  expanded: ReadonlySet<number>
): BuilderRow[] {
  const ids = new Set(sections.map((s) => s.id))
  const childrenOf = new Map<number | null, BuilderSection[]>()
  for (const s of [...sections].sort(byOrder)) {
    const parent = effectiveParent(ids, s)
    childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), s])
  }
  const contentsOf = new Map<number, BuilderContent[]>()
  for (const c of [...contents].sort(byOrder)) {
    contentsOf.set(c.moduleId, [...(contentsOf.get(c.moduleId) ?? []), c])
  }

  const rows: BuilderRow[] = []
  const visited = new Set<number>()

  // Hidden sub-trees are still walked so they are marked visited and not promoted to roots below.
  const walk = (s: BuilderSection, depth: number, parentId: number | null, hidden: boolean) => {
    if (visited.has(s.id)) return
    visited.add(s.id)
    const collapsed = !expanded.has(s.id)
    const own = contentsOf.get(s.id) ?? []
    if (!hidden) {
      rows.push({
        kind: 'section',
        key: rowKey({ kind: 'section', id: s.id }),
        id: s.id,
        depth,
        parentId,
        tooDeep: depth > MAX_SECTION_DEPTH,
        collapsed,
        contentCount: own.length,
        section: s,
      })
      if (!collapsed) {
        for (const c of own) {
          rows.push({
            kind: 'content',
            key: rowKey({ kind: 'content', id: c.id }),
            id: c.id,
            depth: depth + 1,
            parentId: s.id,
            content: c,
          })
        }
      }
    }
    for (const child of childrenOf.get(s.id) ?? []) {
      walk(child, depth + 1, s.id, hidden || collapsed)
    }
  }

  for (const root of childrenOf.get(null) ?? []) walk(root, 0, null, false)
  // Sections caught in a parent cycle have no root: show them as roots so they stay movable.
  for (const s of [...sections].sort(byOrder)) walk(s, 0, null, false)
  return rows
}

export function sectionRowsForDrag(
  rows: ReadonlyArray<BuilderRow>,
  activeKey: string
): BuilderRow[] {
  const result: BuilderRow[] = []
  let skipBelowDepth: number | null = null
  for (const row of rows) {
    if (row.kind !== 'section') continue
    if (skipBelowDepth !== null && row.depth > skipBelowDepth) continue
    skipBelowDepth = row.key === activeKey ? row.depth : null
    result.push(row)
  }
  return result
}

export function projectContentDrop(
  rows: ReadonlyArray<BuilderRow>,
  activeKey: string,
  overKey: string
): Placement | null {
  const from = rows.findIndex((r) => r.key === activeKey)
  const to = rows.findIndex((r) => r.key === overKey)
  if (from < 0 || to < 0 || rows[from].kind !== 'content') return null

  const moved = arrayMove(rows, from, to)
  let position = 0
  for (let i = to - 1; i >= 0; i--) {
    const row = moved[i]
    if (row.kind === 'content') {
      position += 1
      continue
    }
    if (row.tooDeep) return null
    return { parentId: row.id, position: row.collapsed ? row.contentCount : position }
  }
  return null
}

export function projectSectionDrop(
  rows: ReadonlyArray<BuilderRow>,
  activeKey: string,
  overKey: string,
  depthOffset: number,
  sections: ReadonlyArray<BuilderSection>
): (Placement & { depth: number }) | null {
  const from = rows.findIndex((r) => r.key === activeKey)
  const to = rows.findIndex((r) => r.key === overKey)
  if (from < 0 || to < 0 || rows[from].kind !== 'section') return null

  const active = rows[from]
  const moved = arrayMove(rows, from, to)
  const previous = moved[to - 1]
  const next = moved[to + 1]
  const maxDepth = Math.min(
    previous ? previous.depth + 1 : 0,
    MAX_SECTION_DEPTH - sectionSubtreeHeight(sections, active.id)
  )
  const minDepth = next ? next.depth : 0
  if (maxDepth < minDepth || maxDepth < 0) return null

  const depth = Math.min(Math.max(active.depth + depthOffset, minDepth), maxDepth)
  let parentId: number | null = null
  if (depth > 0) {
    const parent = moved.slice(0, to).findLast((r) => r.depth === depth - 1)
    if (!parent) return null
    parentId = parent.id
  }
  const position = moved.slice(0, to).filter((r) => r.parentId === parentId).length
  return { parentId, position, depth }
}

/** Every section in tree order, with its "Parent › Child" label. */
function sectionTargets(sections: ReadonlyArray<BuilderSection>) {
  const rows = buildRows(sections, [], new Set(sections.map((s) => s.id)))
  const labels = new Map<number, string>()
  for (const row of rows) {
    const parentLabel = row.parentId === null ? undefined : labels.get(row.parentId)
    const title = row.kind === 'section' ? row.section.title : ''
    labels.set(row.id, parentLabel ? `${parentLabel} › ${title}` : title)
  }
  return { rows, labels }
}

export function moveTargets(
  sections: ReadonlyArray<BuilderSection>,
  contents: ReadonlyArray<BuilderContent>,
  item: ItemRef
): MoveTarget[] {
  const { rows, labels } = sectionTargets(sections)
  const target = (row: BuilderRow, disabledReason: string | null): MoveTarget => ({
    parentId: row.id,
    label: labels.get(row.id) ?? '',
    depth: row.depth,
    disabledReason,
  })

  if (item.kind === 'content') {
    const current = contents.find((c) => c.id === item.id)?.moduleId
    return rows.map((row) =>
      target(
        row,
        row.id === current
          ? CURRENT_MESSAGE
          : row.kind === 'section' && row.tooDeep
            ? DEPTH_MESSAGE
            : null
      )
    )
  }

  const height = sectionSubtreeHeight(sections, item.id)
  const currentParent = rows.find((r) => r.id === item.id)?.parentId ?? null
  // Rows are in tree order, so a parent is always seen before its children.
  const selfAndDescendants = new Set([item.id])
  for (const row of rows) {
    if (row.parentId !== null && selfAndDescendants.has(row.parentId))
      selfAndDescendants.add(row.id)
  }

  const root: MoveTarget = {
    parentId: null,
    label: ROOT_LABEL,
    depth: 0,
    disabledReason:
      currentParent === null ? CURRENT_MESSAGE : height > MAX_SECTION_DEPTH ? DEPTH_MESSAGE : null,
  }
  return [
    root,
    ...rows.map((row) =>
      target(
        row,
        selfAndDescendants.has(row.id)
          ? SELF_MESSAGE
          : row.id === currentParent
            ? CURRENT_MESSAGE
            : row.depth + 1 + height > MAX_SECTION_DEPTH
              ? DEPTH_MESSAGE
              : null
      )
    ),
  ]
}

function step<T extends Ordered>(
  siblings: T[],
  id: number,
  parentId: number | null,
  direction: 'up' | 'down'
): Placement | null {
  // Positions exclude the item itself, so "down" is index + 1 in the list without it.
  const index = siblings.sort(byOrder).findIndex((s) => s.id === id)
  const position = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || position < 0 || position >= siblings.length) return null
  return { parentId, position }
}

export function siblingPlacement(
  sections: ReadonlyArray<BuilderSection>,
  contents: ReadonlyArray<BuilderContent>,
  item: ItemRef,
  direction: 'up' | 'down'
): Placement | null {
  if (item.kind === 'content') {
    const c = contents.find((x) => x.id === item.id)
    if (!c) return null
    const siblings = contents.filter((x) => x.moduleId === c.moduleId)
    return step(siblings, c.id, c.moduleId, direction)
  }
  const ids = new Set(sections.map((s) => s.id))
  const s = sections.find((x) => x.id === item.id)
  if (!s) return null
  const parent = effectiveParent(ids, s)
  const siblings = sections.filter((x) => effectiveParent(ids, x) === parent)
  return step(siblings, s.id, parent, direction)
}

/** Mirrors the server: dense 1..n+1 in the destination, source renumbered 1..m when the parent changes. */
function applyMove<T extends Ordered>(
  items: ReadonlyArray<T>,
  id: number,
  placement: Placement,
  parentOf: (item: T) => number | null,
  withParent: (item: T, parentId: number | null) => T
): T[] {
  const item = items.find((t) => t.id === id)
  if (!item) return [...items]
  const from = parentOf(item)
  const updates = new Map<number, { parentId: number | null; order: number }>()

  const destination = items.filter((t) => t.id !== id && parentOf(t) === placement.parentId)
  destination.sort(byOrder)
  destination.splice(Math.min(Math.max(placement.position, 0), destination.length), 0, item)
  destination.forEach((t, i) => updates.set(t.id, { parentId: placement.parentId, order: i + 1 }))

  if (from !== placement.parentId) {
    items
      .filter((t) => t.id !== id && parentOf(t) === from)
      .sort(byOrder)
      .forEach((t, i) => updates.set(t.id, { parentId: from, order: i + 1 }))
  }

  return items.map((t) => {
    const update = updates.get(t.id)
    return update ? { ...withParent(t, update.parentId), order: update.order } : t
  })
}

export function applyContentMove(
  contents: ReadonlyArray<BuilderContent>,
  id: number,
  placement: Placement
): BuilderContent[] {
  if (placement.parentId === null) return [...contents]
  return applyMove(
    contents,
    id,
    placement,
    (c) => c.moduleId,
    (c, parentId) => ({ ...c, moduleId: parentId ?? c.moduleId })
  )
}

export function applySectionMove(
  sections: ReadonlyArray<BuilderSection>,
  id: number,
  placement: Placement
): BuilderSection[] {
  return applyMove(
    sections,
    id,
    placement,
    (s) => s.parentId,
    (s, parentId) => ({ ...s, parentId })
  )
}

export function canDeleteSection(
  sections: ReadonlyArray<BuilderSection>,
  contents: ReadonlyArray<BuilderContent>,
  id: number
): boolean {
  return !sections.some((s) => s.parentId === id) && !contents.some((c) => c.moduleId === id)
}

// --- Selection and bulk actions (05-10). Same tree order and normalisation as the 05-09 server. ---

export type QuickSelection =
  'all' | 'none' | 'published' | 'unpublished' | { contentType: ContentType }

type Ids = { sectionIds: number[]; contentIds: number[] }
type Structure = { sections: BuilderSection[]; contents: BuilderContent[] }

export interface BulkResult {
  sections: BuilderSection[]
  contents: BuilderContent[]
  affected: Ids
  deleted: Ids
}

export const BULK_CONTENT_ROOT_MESSAGE = 'Un contenu doit être placé dans une section.'
/** Same text as the server's E_NOT_EMPTY message. */
export const BULK_DELETE_BLOCKED_MESSAGE =
  'Sélectionnez aussi tout le contenu des sections à supprimer.'

const keyOf = (kind: ItemRef['kind'], id: number) => rowKey({ kind, id })

/** The given sections and all their sub-sections; terminates on cyclic data. */
function withDescendants(sections: ReadonlyArray<BuilderSection>, roots: number[]): Set<number> {
  const result = new Set(roots)
  const stack = [...roots]
  while (stack.length > 0) {
    const id = stack.pop()!
    for (const s of sections) {
      if (s.parentId === id && !result.has(s.id)) {
        result.add(s.id)
        stack.push(s.id)
      }
    }
  }
  return result
}

export function quickSelect(
  sections: ReadonlyArray<BuilderSection>,
  contents: ReadonlyArray<BuilderContent>,
  q: QuickSelection
): Set<string> {
  const match = (item: { isPublished: boolean }, type?: ContentType) =>
    q === 'all' ||
    (q === 'published' && item.isPublished) ||
    (q === 'unpublished' && !item.isPublished) ||
    (typeof q === 'object' && type === q.contentType)
  return new Set([
    ...sections.filter((s) => match(s)).map((s) => keyOf('section', s.id)),
    ...contents.filter((c) => match(c, c.contentType)).map((c) => keyOf('content', c.id)),
  ])
}

export function pruneSelection(
  selected: ReadonlySet<string>,
  sections: ReadonlyArray<BuilderSection>,
  contents: ReadonlyArray<BuilderContent>
): Set<string> {
  const existing = quickSelect(sections, contents, 'all')
  return new Set([...selected].filter((key) => existing.has(key)))
}

export function selectedItems(
  sections: ReadonlyArray<BuilderSection>,
  contents: ReadonlyArray<BuilderContent>,
  selected: ReadonlySet<string>
): ItemRef[] {
  return buildRows(sections, contents, new Set(sections.map((s) => s.id)))
    .filter((row) => selected.has(row.key))
    .map((row) => ({ kind: row.kind, id: row.id }))
}

/** Drops every item that has a selected ancestor section (it travels with that ancestor). */
export function topLevelItems(
  sections: ReadonlyArray<BuilderSection>,
  contents: ReadonlyArray<BuilderContent>,
  items: ReadonlyArray<ItemRef>
): ItemRef[] {
  const selectedSections = new Set(items.filter((i) => i.kind === 'section').map((i) => i.id))
  const parentById = new Map(sections.map((s) => [s.id, s.parentId]))
  const moduleById = new Map(contents.map((c) => [c.id, c.moduleId]))
  const underSelected = (start: number | null) => {
    const seen = new Set<number>()
    let current = start
    while (current !== null && !seen.has(current)) {
      if (selectedSections.has(current)) return true
      seen.add(current)
      current = parentById.get(current) ?? null
    }
    return false
  }
  return items.filter((item) =>
    item.kind === 'content'
      ? !underSelected(moduleById.get(item.id) ?? null)
      : !underSelected(parentById.get(item.id) ?? null)
  )
}

export function bulkMoveTargets(
  sections: ReadonlyArray<BuilderSection>,
  contents: ReadonlyArray<BuilderContent>,
  items: ReadonlyArray<ItemRef>
): MoveTarget[] {
  const top = topLevelItems(sections, contents, items)
  const hasContent = top.some((i) => i.kind === 'content')
  const movedSections = top.filter((i) => i.kind === 'section').map((i) => i.id)
  const selfAndDescendants = withDescendants(sections, movedSections)
  const height =
    movedSections.length > 0
      ? Math.max(...movedSections.map((id) => sectionSubtreeHeight(sections, id)))
      : null
  const tooDeepFor = (parentDepth: number) =>
    height !== null && parentDepth + 1 + height > MAX_SECTION_DEPTH

  const { rows, labels } = sectionTargets(sections)
  const root: MoveTarget = {
    parentId: null,
    label: ROOT_LABEL,
    depth: 0,
    disabledReason: hasContent ? BULK_CONTENT_ROOT_MESSAGE : tooDeepFor(-1) ? DEPTH_MESSAGE : null,
  }
  return [
    root,
    ...rows.map((row) => ({
      parentId: row.id,
      label: labels.get(row.id) ?? '',
      depth: row.depth,
      disabledReason:
        hasContent && row.kind === 'section' && row.tooDeep
          ? DEPTH_MESSAGE
          : selfAndDescendants.has(row.id)
            ? SELF_MESSAGE
            : tooDeepFor(row.depth)
              ? DEPTH_MESSAGE
              : null,
    })),
  ]
}

/** Mirror of the server: contents first, then sections, each appended in tree order. */
export function applyBulkMove(
  sections: ReadonlyArray<BuilderSection>,
  contents: ReadonlyArray<BuilderContent>,
  items: ReadonlyArray<ItemRef>,
  parentId: number | null
): Structure {
  const ordered = selectedItems(sections, contents, new Set(items.map(rowKey)))
  const top = topLevelItems(sections, contents, ordered)
  let nextContents = [...contents]
  let nextSections = [...sections]
  for (const item of top) {
    if (item.kind !== 'content' || parentId === null) continue
    const position = nextContents.filter((c) => c.moduleId === parentId && c.id !== item.id).length
    nextContents = applyContentMove(nextContents, item.id, { parentId, position })
  }
  for (const item of top) {
    if (item.kind !== 'section') continue
    const position = nextSections.filter((s) => s.parentId === parentId && s.id !== item.id).length
    nextSections = applySectionMove(nextSections, item.id, { parentId, position })
  }
  return { sections: nextSections, contents: nextContents }
}

export function applyBulkPatch(
  sections: ReadonlyArray<BuilderSection>,
  contents: ReadonlyArray<BuilderContent>,
  items: ReadonlyArray<ItemRef>,
  patch: Partial<{
    isPublished: boolean
    availableFrom: string | null
    availableUntil: string | null
  }>
): Structure {
  const keys = new Set(items.map(rowKey))
  return {
    sections: sections.map((s) => (keys.has(keyOf('section', s.id)) ? { ...s, ...patch } : s)),
    contents: contents.map((c) => (keys.has(keyOf('content', c.id)) ? { ...c, ...patch } : c)),
  }
}

/** `yyyy-MM-dd` values of a details panel's date inputs ('' = no date). */
export type DateInputs = { from: string; until: string }

/**
 * Patch for a details-panel date edit: only the bounds that differ from what was
 * last sent or seeded (D-09: never re-send the other bound), so a bound held back
 * by the order check goes out once fixed. Null when start > end.
 */
export function datePatch(
  draft: DateInputs,
  sent: DateInputs
): Partial<{ availableFrom: string | null; availableUntil: string | null }> | null {
  if (draft.from !== '' && draft.until !== '' && draft.from > draft.until) return null
  const patch: Partial<{ availableFrom: string | null; availableUntil: string | null }> = {}
  if (draft.from !== sent.from) patch.availableFrom = draft.from || null
  if (draft.until !== sent.until) patch.availableUntil = draft.until || null
  return patch
}

/** Selected sections whose sub-tree (sections and contents) is not fully selected, ascending. */
export function bulkDeleteBlockers(
  sections: ReadonlyArray<BuilderSection>,
  contents: ReadonlyArray<BuilderContent>,
  selected: ReadonlySet<string>
): number[] {
  return sections
    .filter((s) => selected.has(keyOf('section', s.id)))
    .filter((s) => {
      const subtree = withDescendants(sections, [s.id])
      return (
        [...subtree].some((id) => !selected.has(keyOf('section', id))) ||
        contents.some((c) => subtree.has(c.moduleId) && !selected.has(keyOf('content', c.id)))
      )
    })
    .map((s) => s.id)
    .sort((a, b) => a - b)
}

export function bulkDeletedIds(
  sections: ReadonlyArray<BuilderSection>,
  contents: ReadonlyArray<BuilderContent>,
  items: ReadonlyArray<ItemRef>
): Ids {
  const sectionIds = withDescendants(
    sections,
    items.filter((i) => i.kind === 'section').map((i) => i.id)
  )
  const contentIds = new Set(items.filter((i) => i.kind === 'content').map((i) => i.id))
  for (const c of contents) if (sectionIds.has(c.moduleId)) contentIds.add(c.id)
  const asc = (set: Set<number>) => [...set].sort((a, b) => a - b)
  return { sectionIds: asc(sectionIds), contentIds: asc(contentIds) }
}

function mergeRows<T extends { id: number; title: string; description: string | null }>(
  local: ReadonlyArray<T>,
  server: ReadonlyArray<T>,
  affected: number[],
  deleted: number[],
  known: ReadonlyArray<T> | undefined
): T[] {
  const gone = new Set(deleted)
  const hit = new Set(affected)
  const serverById = new Map(server.map((r) => [r.id, r]))
  const localIds = new Set(local.map((r) => r.id))
  const knownIds = new Set((known ?? []).map((r) => r.id))
  const merged = local
    .filter((r) => !gone.has(r.id))
    .map((r) => {
      const fresh = hit.has(r.id) ? serverById.get(r.id) : undefined
      // A rename queued after the bulk op may already be applied locally.
      return fresh ? { ...fresh, title: r.title, description: r.description } : r
    })
  // New server rows (copies); a row known at enqueue time but gone locally was removed since.
  const added = server.filter((r) => hit.has(r.id) && !localIds.has(r.id) && !knownIds.has(r.id))
  return [...merged, ...added]
}

/** `known`: the structure when the op was queued, so rows removed locally since stay removed. */
export function mergeBulkResult(
  local: Structure,
  result: BulkResult,
  known?: Structure
): Structure {
  return {
    sections: mergeRows(
      local.sections,
      result.sections,
      result.affected.sectionIds,
      result.deleted.sectionIds,
      known?.sections
    ),
    contents: mergeRows(
      local.contents,
      result.contents,
      result.affected.contentIds,
      result.deleted.contentIds,
      known?.contents
    ),
  }
}
