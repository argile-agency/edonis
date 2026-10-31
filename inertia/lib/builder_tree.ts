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

export function moveTargets(
  sections: ReadonlyArray<BuilderSection>,
  contents: ReadonlyArray<BuilderContent>,
  item: ItemRef
): MoveTarget[] {
  const rows = buildRows(sections, [], new Set(sections.map((s) => s.id)))
  const labels = new Map<number, string>()
  for (const row of rows) {
    const parentLabel = row.parentId === null ? undefined : labels.get(row.parentId)
    const title = row.kind === 'section' ? row.section.title : ''
    labels.set(row.id, parentLabel ? `${parentLabel} › ${title}` : title)
  }
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
