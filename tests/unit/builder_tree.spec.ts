import { test } from '@japa/runner'
import {
  BULK_CONTENT_ROOT_MESSAGE,
  DEPTH_MESSAGE,
  MAX_SECTION_DEPTH,
  applyBulkMove,
  applyBulkPatch,
  applyContentMove,
  applySectionMove,
  buildRows,
  bulkDeleteBlockers,
  bulkDeletedIds,
  bulkMoveTargets,
  canDeleteSection,
  datePatch,
  mergeBulkResult,
  moveTargets,
  projectContentDrop,
  projectSectionDrop,
  pruneSelection,
  quickSelect,
  rowKey,
  sectionDepth,
  sectionRowsForDrag,
  sectionSubtreeHeight,
  selectedItems,
  siblingPlacement,
  topLevelItems,
  type BulkResult,
  type BuilderContent,
  type BuilderSection,
} from '../../inertia/lib/builder_tree.js'

/**
 * Fixture: S1 (root, order 1) holds c1, c2 and sub-section S11 (holding c3);
 * S2 (root, order 2) is empty. The legacy fixture adds S111 under S11 (depth 2).
 */
const S1 = 1
const S11 = 11
const S111 = 111
const S2 = 2

function section(
  id: number,
  parentId: number | null,
  order: number,
  title: string
): BuilderSection {
  return {
    id,
    parentId,
    title,
    description: null,
    order,
    isPublished: true,
    availableFrom: null,
    availableUntil: null,
    updatedAt: null,
  }
}

function content(id: number, moduleId: number, order: number): BuilderContent {
  return {
    id,
    moduleId,
    contentType: 'page',
    title: `c${id}`,
    description: null,
    order,
    isPublished: true,
    availableFrom: null,
    availableUntil: null,
    updatedAt: null,
  }
}

const sections: BuilderSection[] = [
  section(S2, null, 2, 'Section 2'),
  section(S11, S1, 1, 'Sous-section 1.1'),
  section(S1, null, 1, 'Section 1'),
]
const legacy: BuilderSection[] = [...sections, section(S111, S11, 1, 'Niveau 3')]
// Deliberately out of order: rows must sort by (order, id), not by array order.
const contents: BuilderContent[] = [content(102, S1, 2), content(103, S11, 1), content(101, S1, 1)]
const all = new Set([S1, S11, S111, S2])

const keys = (rows: { key: string }[]) => rows.map((r) => r.key)

test.group('Builder tree | contract', () => {
  test('the client module compiles and resolves from the backend runner', ({ assert }) => {
    assert.equal(MAX_SECTION_DEPTH, 1)
    assert.equal(rowKey({ kind: 'content', id: 12 }), 'c-12')
    assert.equal(rowKey({ kind: 'section', id: 12 }), 's-12')
  })
})

test.group('Builder tree | depth helpers', () => {
  test('sectionDepth(root) = 0, sub-section = 1, legacy third level = 2', ({ assert }) => {
    assert.equal(sectionDepth(legacy, S1), 0)
    assert.equal(sectionDepth(legacy, S11), 1)
    assert.equal(sectionDepth(legacy, S111), 2)
    assert.equal(sectionDepth(legacy, 999), 0)
  })

  test('sectionSubtreeHeight(leaf section) = 0, parent = 1, grand-parent = 2', ({ assert }) => {
    assert.equal(sectionSubtreeHeight(legacy, S2), 0)
    assert.equal(sectionSubtreeHeight(legacy, S11), 1)
    assert.equal(sectionSubtreeHeight(legacy, S1), 2)
  })

  test('depth helpers terminate on a corrupt cycle', ({ assert }) => {
    const cyclic = [section(5, 6, 1, 'A'), section(6, 5, 1, 'B')]
    assert.isAtLeast(sectionDepth(cyclic, 5), 0)
    assert.isAtLeast(sectionSubtreeHeight(cyclic, 5), 0)
  })
})

test.group('Builder tree | buildRows', () => {
  test('all expanded: contents before sub-sections, with depths', ({ assert }) => {
    const rows = buildRows(sections, contents, all)
    assert.deepEqual(keys(rows), ['s-1', 'c-101', 'c-102', 's-11', 'c-103', 's-2'])
    assert.deepEqual(
      rows.map((r) => r.depth),
      [0, 1, 1, 1, 2, 0]
    )
    const s11 = rows[3]
    assert.equal(s11.kind === 'section' && s11.parentId, S1)
  })

  test('a collapsed section shows only its header row', ({ assert }) => {
    const rows = buildRows(sections, contents, new Set([S11, S2]))
    assert.deepEqual(keys(rows), ['s-1', 's-2'])
    assert.isTrue(rows[0].kind === 'section' && rows[0].collapsed)
    assert.isTrue(rows[0].kind === 'section' && rows[0].contentCount === 2)
  })

  test('legacy deep sections stay visible and are flagged tooDeep', ({ assert }) => {
    const rows = buildRows(legacy, contents, all)
    const deep = rows.find((r) => r.key === 's-111')
    assert.isTrue(deep?.kind === 'section' && deep.tooDeep && deep.depth === 2)
    const s11 = rows.find((r) => r.key === 's-11')
    assert.isTrue(s11?.kind === 'section' && !s11.tooDeep)
  })

  test('a section whose parent is missing becomes a root', ({ assert }) => {
    const rows = buildRows([section(7, 99, 1, 'Orphan')], [], all)
    assert.deepEqual(keys(rows), ['s-7'])
    assert.isTrue(rows[0].kind === 'section' && rows[0].parentId === null && rows[0].depth === 0)
  })

  test('a cyclic parentId pair does not hang and stays visible', ({ assert }) => {
    const rows = buildRows([section(5, 6, 1, 'A'), section(6, 5, 1, 'B')], [], new Set([5, 6]))
    assert.sameMembers(keys(rows), ['s-5', 's-6'])
  })
})

test.group('Builder tree | sectionRowsForDrag', () => {
  test('keeps section rows only, without the active section descendants', ({ assert }) => {
    const rows = buildRows(sections, contents, all)
    assert.deepEqual(keys(sectionRowsForDrag(rows, 's-1')), ['s-1', 's-2'])
    assert.deepEqual(keys(sectionRowsForDrag(rows, 's-11')), ['s-1', 's-11', 's-2'])
  })
})

test.group('Builder tree | projectContentDrop', () => {
  const rows = buildRows(sections, contents, all)

  test('S1, c1, c2, S11, c3, slot, S2 lands in S11 at position 1', ({ assert }) => {
    assert.deepEqual(projectContentDrop(rows, 'c-101', 'c-103'), { parentId: S11, position: 1 })
  })

  test('S1, c1, c2, slot, S11 lands in S1 at position 2 (dragging up)', ({ assert }) => {
    assert.deepEqual(projectContentDrop(rows, 'c-103', 's-11'), { parentId: S1, position: 2 })
  })

  test('a slot above the first section is refused', ({ assert }) => {
    assert.isNull(projectContentDrop(rows, 'c-101', 's-1'))
  })

  test('right after a collapsed section header lands at its end', ({ assert }) => {
    const withS2 = [...contents, content(104, S2, 1), content(105, S2, 2)]
    const collapsedRows = buildRows(sections, withS2, new Set([S1, S11]))
    assert.deepEqual(projectContentDrop(collapsedRows, 'c-101', 's-2'), {
      parentId: S2,
      position: 2,
    })
  })

  test('a tooDeep destination is refused', ({ assert }) => {
    const deepRows = buildRows(legacy, contents, all)
    assert.isNull(projectContentDrop(deepRows, 'c-101', 's-111'))
  })

  test('a section active key or unknown key is refused', ({ assert }) => {
    assert.isNull(projectContentDrop(rows, 's-2', 'c-101'))
    assert.isNull(projectContentDrop(rows, 'c-999', 'c-101'))
  })
})

test.group('Builder tree | projectSectionDrop', () => {
  const rows = buildRows(sections, contents, all)

  test('leaf root dropped after S1 with +1 becomes its first sub-section', ({ assert }) => {
    const dragRows = sectionRowsForDrag(rows, 's-2')
    assert.deepEqual(projectSectionDrop(dragRows, 's-2', 's-11', 1, sections), {
      parentId: S1,
      position: 0,
      depth: 1,
    })
  })

  test('position counts the new siblings above the slot', ({ assert }) => {
    const dragRows = sectionRowsForDrag(rows, 's-2')
    assert.deepEqual(projectSectionDrop(dragRows, 's-2', 's-2', 1, sections), {
      parentId: S1,
      position: 1,
      depth: 1,
    })
  })

  test('S1 (height 1) with +1 is clamped to depth 0', ({ assert }) => {
    const dragRows = sectionRowsForDrag(rows, 's-1')
    assert.deepEqual(projectSectionDrop(dragRows, 's-1', 's-2', 1, sections), {
      parentId: null,
      position: 1,
      depth: 0,
    })
  })

  test('a slot whose next row has depth 1 while the max is 0 is refused', ({ assert }) => {
    const withS21 = [...sections, section(21, S2, 1, 'Sous-section 2.1')]
    const dragRows = sectionRowsForDrag(buildRows(withS21, [], new Set([...all, 21])), 's-1')
    assert.deepEqual(keys(dragRows), ['s-1', 's-2', 's-21'])
    assert.isNull(projectSectionDrop(dragRows, 's-1', 's-2', 0, withS21))
  })

  test('a negative offset is clamped to the minimum depth', ({ assert }) => {
    const dragRows = sectionRowsForDrag(rows, 's-11')
    assert.deepEqual(projectSectionDrop(dragRows, 's-11', 's-11', -1, sections), {
      parentId: null,
      position: 1,
      depth: 0,
    })
  })
})

test.group('Builder tree | moveTargets', () => {
  const reason = (
    targets: { parentId: number | null; disabledReason: string | null }[],
    id: number | null
  ) => targets.find((t) => t.parentId === id)?.disabledReason

  test('content: current section and tooDeep sections are disabled', ({ assert }) => {
    const targets = moveTargets(legacy, contents, { kind: 'content', id: 101 })
    assert.deepEqual(
      targets.map((t) => t.parentId),
      [S1, S11, S111, S2]
    )
    assert.equal(reason(targets, S1), 'Emplacement actuel')
    assert.isNull(reason(targets, S11))
    assert.equal(reason(targets, S111), DEPTH_MESSAGE)
    assert.isNull(reason(targets, S2))
    assert.deepEqual(
      targets.map((t) => t.label),
      [
        'Section 1',
        'Section 1 › Sous-section 1.1',
        'Section 1 › Sous-section 1.1 › Niveau 3',
        'Section 2',
      ]
    )
  })

  test('section with a sub-section: root current, self/descendant and depth refused', ({
    assert,
  }) => {
    const targets = moveTargets(sections, contents, { kind: 'section', id: S1 })
    assert.deepEqual(targets[0], {
      parentId: null,
      label: 'Racine du cours',
      depth: 0,
      disabledReason: 'Emplacement actuel',
    })
    assert.match(reason(targets, S1) ?? '', /elle-même/)
    assert.match(reason(targets, S11) ?? '', /elle-même/)
    assert.equal(reason(targets, S2), DEPTH_MESSAGE)
  })

  test('leaf section: a root is enabled, a sub-section is too deep', ({ assert }) => {
    const targets = moveTargets(sections, contents, { kind: 'section', id: S2 })
    assert.equal(reason(targets, null), 'Emplacement actuel')
    assert.isNull(reason(targets, S1))
    assert.equal(reason(targets, S11), DEPTH_MESSAGE)
  })

  test('sub-section: root enabled, current parent disabled', ({ assert }) => {
    const targets = moveTargets(sections, contents, { kind: 'section', id: S11 })
    assert.isNull(reason(targets, null))
    assert.equal(reason(targets, S1), 'Emplacement actuel')
    assert.isNull(reason(targets, S2))
  })
})

test.group('Builder tree | siblingPlacement', () => {
  test('one step up or down among siblings, null at the bounds', ({ assert }) => {
    const down = siblingPlacement(sections, contents, { kind: 'content', id: 101 }, 'down')
    assert.deepEqual(down, { parentId: S1, position: 1 })
    assert.isNull(siblingPlacement(sections, contents, { kind: 'content', id: 101 }, 'up'))
    assert.isNull(siblingPlacement(sections, contents, { kind: 'content', id: 102 }, 'down'))
    const up = siblingPlacement(sections, contents, { kind: 'section', id: S2 }, 'up')
    assert.deepEqual(up, { parentId: null, position: 0 })
    assert.isNull(siblingPlacement(sections, contents, { kind: 'section', id: S11 }, 'down'))
  })
})

test.group('Builder tree | optimistic apply', () => {
  const sparse = [content(1, S1, 1), content(2, S1, 5), content(3, S1, 9)]
  const orders = (list: BuilderContent[]) =>
    Object.fromEntries(list.map((c) => [c.id, [c.moduleId, c.order]]))

  test('non-dense orders are renumbered densely; c3 at 0 gives 1, 2, 3', ({ assert }) => {
    const snapshot = structuredClone(sparse)
    const result = applyContentMove(sparse, 3, { parentId: S1, position: 0 })
    assert.deepEqual(orders(result), { 1: [S1, 2], 2: [S1, 3], 3: [S1, 1] })
    assert.deepEqual(sparse, snapshot)
  })

  test('position 99 clamps to last', ({ assert }) => {
    const result = applyContentMove(sparse, 1, { parentId: S1, position: 99 })
    assert.deepEqual(orders(result), { 1: [S1, 3], 2: [S1, 1], 3: [S1, 2] })
  })

  test('cross-section move renumbers source and destination', ({ assert }) => {
    const snapshot = structuredClone(contents)
    const result = applyContentMove(contents, 101, { parentId: S11, position: 0 })
    assert.deepEqual(orders(result), { 101: [S11, 1], 102: [S1, 1], 103: [S11, 2] })
    assert.deepEqual(contents, snapshot)
  })

  test('section move updates parentId and renumbers both parents', ({ assert }) => {
    const snapshot = structuredClone(sections)
    const result = applySectionMove(sections, S2, { parentId: S1, position: 0 })
    const byId = Object.fromEntries(result.map((s) => [s.id, [s.parentId, s.order]]))
    assert.deepEqual(byId, { [S1]: [null, 1], [S2]: [S1, 1], [S11]: [S1, 2] })
    assert.deepEqual(sections, snapshot)
  })
})

test.group('Builder tree | canDeleteSection', () => {
  test('only an empty section without sub-sections can be deleted', ({ assert }) => {
    assert.isTrue(canDeleteSection(sections, contents, S2))
    assert.isFalse(canDeleteSection(sections, contents, S1))
    assert.isFalse(canDeleteSection(sections, [], S1))
  })
})

/**
 * Bulk fixture: S1 published {c1 page published, c2 video draft, S11 published
 * {c4 video published}}, S2 draft {c3 link published}.
 */
test.group('builder_tree - selection and bulk', () => {
  const bs = (id: number, parentId: number | null, order: number, isPublished: boolean) => ({
    ...section(id, parentId, order, `S${id}`),
    isPublished,
  })
  const bc = (
    id: number,
    moduleId: number,
    order: number,
    contentType: BuilderContent['contentType'],
    isPublished: boolean
  ) => ({ ...content(id, moduleId, order), contentType, isPublished })

  const C1 = 201
  const C2 = 202
  const C3 = 203
  const C4 = 204
  const bSections: BuilderSection[] = [
    bs(S2, null, 2, false),
    bs(S11, S1, 1, true),
    bs(S1, null, 1, true),
  ]
  const bContents: BuilderContent[] = [
    bc(C3, S2, 1, 'link', true),
    bc(C4, S11, 1, 'video', true),
    bc(C2, S1, 2, 'video', false),
    bc(C1, S1, 1, 'page', true),
  ]
  const s = (id: number) => rowKey({ kind: 'section', id })
  const c = (id: number) => rowKey({ kind: 'content', id })
  const sorted = (set: Set<string>) => [...set].sort()
  const reasonOf = (
    targets: { parentId: number | null; disabledReason: string | null }[],
    id: number | null
  ) => targets.find((t) => t.parentId === id)?.disabledReason

  test('quickSelect is data-based and filters by state and type', ({ assert }) => {
    const every = quickSelect(bSections, bContents, 'all')
    assert.equal(every.size, 7)
    assert.isTrue(every.has(c(C4)))
    assert.equal(quickSelect(bSections, bContents, 'none').size, 0)
    assert.deepEqual(
      sorted(quickSelect(bSections, bContents, 'published')),
      [s(S1), s(S11), c(C1), c(C4), c(C3)].sort()
    )
    assert.deepEqual(
      sorted(quickSelect(bSections, bContents, 'unpublished')),
      [s(S2), c(C2)].sort()
    )
    assert.deepEqual(
      sorted(quickSelect(bSections, bContents, { contentType: 'video' })),
      [c(C2), c(C4)].sort()
    )
  })

  test('selectedItems returns tree order whatever the insertion order', ({ assert }) => {
    const reversed = new Set([...quickSelect(bSections, bContents, 'all')].reverse())
    assert.deepEqual(selectedItems(bSections, bContents, reversed).map(rowKey), [
      s(S1),
      c(C1),
      c(C2),
      s(S11),
      c(C4),
      s(S2),
      c(C3),
    ])
  })

  test('topLevelItems drops items under a selected section', ({ assert }) => {
    const items = selectedItems(bSections, bContents, new Set([s(S11), c(C4), c(C1)]))
    assert.deepEqual(topLevelItems(bSections, bContents, items).map(rowKey), [c(C1), s(S11)])
  })

  test('bulkMoveTargets: first applicable reason wins', ({ assert }) => {
    const mixed = bulkMoveTargets(bSections, bContents, [
      { kind: 'content', id: C1 },
      { kind: 'section', id: S11 },
    ])
    assert.equal(reasonOf(mixed, null), BULK_CONTENT_ROOT_MESSAGE)
    assert.match(reasonOf(mixed, S11) ?? '', /elle-même/)
    assert.isNull(reasonOf(mixed, S2))

    const parent = bulkMoveTargets(bSections, bContents, [{ kind: 'section', id: S1 }])
    assert.equal(reasonOf(parent, S2), DEPTH_MESSAGE)
    assert.isNull(reasonOf(parent, null))

    // c3 travels with its selected section: it does not block the root.
    const withChild = bulkMoveTargets(bSections, bContents, [
      { kind: 'section', id: S2 },
      { kind: 'content', id: C3 },
    ])
    assert.isNull(reasonOf(withChild, null))
  })

  test('applyBulkMove appends in tree order, like the server', ({ assert }) => {
    const result = applyBulkMove(
      bSections,
      bContents,
      [
        { kind: 'content', id: C3 },
        { kind: 'content', id: C1 },
      ],
      S2
    )
    const inS2 = result.contents
      .filter((x) => x.moduleId === S2)
      .sort((a, b) => a.order - b.order)
      .map((x) => [x.id, x.order])
    assert.deepEqual(inS2, [
      [C1, 1],
      [C3, 2],
    ])
    const inS1 = result.contents.filter((x) => x.moduleId === S1).map((x) => [x.id, x.order])
    assert.deepEqual(inS1, [[C2, 1]])
  })

  test('bulkDeleteBlockers lists sections whose sub-tree is not fully selected', ({ assert }) => {
    assert.deepEqual(bulkDeleteBlockers(bSections, bContents, new Set([s(S1), c(C1)])), [S1])
    assert.deepEqual(
      bulkDeleteBlockers(bSections, bContents, new Set([s(S1), c(C1), c(C2), s(S11), c(C4)])),
      []
    )
    assert.deepEqual(bulkDeleteBlockers(bSections, bContents, new Set([c(C2)])), [])
  })

  test('bulkDeletedIds covers the selected rows and their sub-trees', ({ assert }) => {
    assert.deepEqual(
      bulkDeletedIds(bSections, bContents, [
        { kind: 'section', id: S11 },
        { kind: 'content', id: C4 },
      ]),
      { sectionIds: [S11], contentIds: [C4] }
    )
    const deep = bulkDeletedIds(
      bSections,
      bContents,
      selectedItems(bSections, bContents, new Set([s(S1), c(C1), c(C2), s(S11), c(C4)]))
    )
    assert.includeMembers(deep.sectionIds, [S1, S11])
    assert.includeMembers(deep.contentIds, [C1, C2, C4])
  })

  test('mergeBulkResult keeps local titles, adds copies, drops deleted rows', ({ assert }) => {
    const local = {
      sections: bSections,
      contents: bContents.map((x) => (x.id === C1 ? { ...x, title: 'Renommé' } : x)),
    }
    const result: BulkResult = {
      sections: bSections.map((x) => ({ ...x, title: 'server' })),
      contents: [
        ...bContents
          .filter((x) => x.id !== C3)
          .map((x) => ({ ...x, isPublished: true, title: 'server', updatedAt: 'fresh' })),
        { ...bc(299, S1, 3, 'page', false), title: 'c1 (copie)' },
      ],
      affected: { sectionIds: [], contentIds: [C1, 299] },
      deleted: { sectionIds: [], contentIds: [C3] },
    }
    const merged = mergeBulkResult(local, result)
    const byId = new Map(merged.contents.map((x) => [x.id, x]))
    assert.equal(byId.get(C1)?.title, 'Renommé')
    assert.equal(byId.get(C1)?.updatedAt, 'fresh')
    assert.equal(byId.get(299)?.title, 'c1 (copie)')
    assert.isFalse(byId.has(C3))
    // Neither affected nor deleted: untouched although the server row differs.
    assert.equal(byId.get(C2)?.title, `c${C2}`)
    assert.isFalse(byId.get(C2)?.isPublished)
    assert.deepEqual(merged.sections, bSections)

    // A row known when the op was queued but removed locally since stays removed.
    const removed = mergeBulkResult(
      { sections: bSections, contents: local.contents.filter((x) => x.id !== C1) },
      result,
      local
    )
    assert.isFalse(removed.contents.some((x) => x.id === C1))
    assert.isTrue(removed.contents.some((x) => x.id === 299))
  })

  test('applyBulkPatch changes exactly the given items', ({ assert }) => {
    const result = applyBulkPatch(
      bSections,
      bContents,
      [
        { kind: 'section', id: S2 },
        { kind: 'content', id: C2 },
      ],
      { isPublished: true, availableFrom: '2026-09-01' }
    )
    const sec = new Map(result.sections.map((x) => [x.id, x]))
    const con = new Map(result.contents.map((x) => [x.id, x]))
    assert.isTrue(sec.get(S2)?.isPublished)
    assert.equal(sec.get(S2)?.availableFrom, '2026-09-01')
    assert.isTrue(con.get(C2)?.isPublished)
    assert.isNull(con.get(C1)?.availableFrom)
    assert.strictEqual(
      sec.get(S1),
      bSections.find((x) => x.id === S1)
    )
  })

  test('pruneSelection drops keys of rows that no longer exist', ({ assert }) => {
    const pruned = pruneSelection(
      new Set([s(S2), c(C3), c(999), s(999)]),
      bSections,
      bContents.filter((x) => x.id !== C3)
    )
    assert.deepEqual(sorted(pruned), [s(S2)])
  })
})

test.group('builder_tree - details panel dates (CR-01)', () => {
  test('datePatch sends only the bound that changed', ({ assert }) => {
    const sent = { from: '2026-11-01', until: '2026-11-15' }
    assert.deepEqual(datePatch({ from: '2026-11-03', until: '2026-11-15' }, sent), {
      availableFrom: '2026-11-03',
    })
    assert.deepEqual(datePatch({ from: '2026-11-01', until: '' }, sent), { availableUntil: null })
    assert.deepEqual(datePatch(sent, sent), {})
  })

  test('datePatch holds an inverted range back, then sends both bounds once fixed', ({
    assert,
  }) => {
    const sent = { from: '2026-11-01', until: '2026-11-15' }
    assert.isNull(datePatch({ from: '2026-11-20', until: '2026-11-15' }, sent))
    assert.deepEqual(datePatch({ from: '2026-11-20', until: '2026-11-30' }, sent), {
      availableFrom: '2026-11-20',
      availableUntil: '2026-11-30',
    })
    // Same day on both bounds is a one-day window, not an inversion.
    assert.deepEqual(datePatch({ from: '2026-11-15', until: '2026-11-15' }, sent), {
      availableFrom: '2026-11-15',
    })
  })
})
