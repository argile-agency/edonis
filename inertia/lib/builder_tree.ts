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
      parentId: number | null
      tooDeep: boolean
      collapsed: boolean
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

export function rowKey(ref: ItemRef): string {
  return `${ref.kind === 'section' ? 's' : 'c'}-${ref.id}`
}

export function sectionDepth(_sections: ReadonlyArray<BuilderSection>, _id: number): number {
  throw new Error('not implemented')
}

export function sectionSubtreeHeight(
  _sections: ReadonlyArray<BuilderSection>,
  _id: number
): number {
  throw new Error('not implemented')
}

export function buildRows(
  _sections: ReadonlyArray<BuilderSection>,
  _contents: ReadonlyArray<BuilderContent>,
  _expanded: ReadonlySet<number>
): BuilderRow[] {
  throw new Error('not implemented')
}

export function sectionRowsForDrag(
  _rows: ReadonlyArray<BuilderRow>,
  _activeKey: string
): BuilderRow[] {
  throw new Error('not implemented')
}

export function projectContentDrop(
  _rows: ReadonlyArray<BuilderRow>,
  _activeKey: string,
  _overKey: string
): Placement | null {
  throw new Error('not implemented')
}

export function projectSectionDrop(
  _rows: ReadonlyArray<BuilderRow>,
  _activeKey: string,
  _overKey: string,
  _depthOffset: number,
  _sections: ReadonlyArray<BuilderSection>
): (Placement & { depth: number }) | null {
  throw new Error('not implemented')
}

export function moveTargets(
  _sections: ReadonlyArray<BuilderSection>,
  _contents: ReadonlyArray<BuilderContent>,
  _item: ItemRef
): MoveTarget[] {
  throw new Error('not implemented')
}

export function siblingPlacement(
  _sections: ReadonlyArray<BuilderSection>,
  _contents: ReadonlyArray<BuilderContent>,
  _item: ItemRef,
  _direction: 'up' | 'down'
): Placement | null {
  throw new Error('not implemented')
}

export function applyContentMove(
  _contents: ReadonlyArray<BuilderContent>,
  _id: number,
  _placement: Placement
): BuilderContent[] {
  throw new Error('not implemented')
}

export function applySectionMove(
  _sections: ReadonlyArray<BuilderSection>,
  _id: number,
  _placement: Placement
): BuilderSection[] {
  throw new Error('not implemented')
}

export function canDeleteSection(
  _sections: ReadonlyArray<BuilderSection>,
  _contents: ReadonlyArray<BuilderContent>,
  _id: number
): boolean {
  throw new Error('not implemented')
}
