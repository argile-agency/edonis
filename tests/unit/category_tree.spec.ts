import { test } from '@japa/runner'
import {
  depthOf,
  recomputeSubtree,
  subtreeHeight,
  wouldCreateCycle,
} from '../../app/helpers/category_tree.js'

/**
 * Pure tree helpers: no database, no framework. Every case must terminate,
 * including on corrupt (cyclic) input.
 *
 * Tree: 1 (root) -> 2 -> 3, and 4 is a separate root.
 */
const tree: ReadonlyMap<number, number | null> = new Map<number, number | null>([
  [1, null],
  [2, 1],
  [3, 2],
  [4, null],
])

test.group('Category tree helpers', () => {
  test('wouldCreateCycle rejects a node as its own parent', ({ assert }) => {
    assert.isTrue(wouldCreateCycle(tree, 2, 2))
  })

  test('wouldCreateCycle rejects a child as parent', ({ assert }) => {
    assert.isTrue(wouldCreateCycle(tree, 1, 2))
  })

  test('wouldCreateCycle rejects a grandchild as parent', ({ assert }) => {
    assert.isTrue(wouldCreateCycle(tree, 1, 3))
  })

  test('wouldCreateCycle accepts an unrelated parent', ({ assert }) => {
    assert.isFalse(wouldCreateCycle(tree, 3, 4))
  })

  test('wouldCreateCycle accepts making a node a root', ({ assert }) => {
    assert.isFalse(wouldCreateCycle(tree, 2, null))
  })

  test('wouldCreateCycle terminates on a pre-existing corrupt cycle', ({ assert }) => {
    const corrupt = new Map<number, number | null>([
      [5, 6],
      [6, 5],
      [7, null],
    ])

    assert.isTrue(wouldCreateCycle(corrupt, 7, 5))
  })

  test('recomputeSubtree rebuilds path and depth for every descendant', ({ assert }) => {
    const nodes = [
      { id: 1, parentId: null, slug: 'a' },
      { id: 2, parentId: 1, slug: 'b' },
      { id: 3, parentId: 2, slug: 'c' },
    ]

    const result = recomputeSubtree(nodes, 1, '/a', 0)

    assert.sameDeepMembers(result, [
      { id: 2, path: '/a/b', depth: 1 },
      { id: 3, path: '/a/b/c', depth: 2 },
    ])
  })

  test('recomputeSubtree terminates on cyclic input and never revisits a node', ({ assert }) => {
    // 1 -> 2 -> 3 -> 2 (corrupt: 2 and 3 point at each other below 1)
    const nodes = [
      { id: 1, parentId: null, slug: 'a' },
      { id: 2, parentId: 3, slug: 'b' },
      { id: 3, parentId: 2, slug: 'c' },
      { id: 4, parentId: 1, slug: 'd' },
    ]

    const fromRoot = recomputeSubtree(nodes, 1, '/a', 0)
    assert.sameDeepMembers(fromRoot, [{ id: 4, path: '/a/d', depth: 1 }])

    const fromCycle = recomputeSubtree(nodes, 2, '/x/b', 1)
    const ids = fromCycle.map((d) => d.id)
    assert.equal(new Set(ids).size, ids.length)
    assert.notInclude(ids, 2)
  })

  test('depthOf(root) = 0', ({ assert }) => {
    assert.equal(depthOf(tree, 1), 0)
    assert.equal(depthOf(tree, 4), 0)
  })

  test('depthOf counts levels below the root, legacy third level included', ({ assert }) => {
    assert.equal(depthOf(tree, 2), 1)
    assert.equal(depthOf(tree, 3), 2)
  })

  test('depthOf treats an unknown id as a root', ({ assert }) => {
    assert.equal(depthOf(tree, 99), 0)
  })

  test('depthOf terminates on a corrupt cycle', ({ assert }) => {
    const corrupt = new Map<number, number | null>([
      [5, 6],
      [6, 5],
    ])
    const depth = depthOf(corrupt, 5)
    assert.isTrue(Number.isFinite(depth) && depth >= 0)
  })

  test('subtreeHeight(leaf section) = 0', ({ assert }) => {
    assert.equal(subtreeHeight(tree, 4), 0)
    assert.equal(subtreeHeight(tree, 3), 0)
  })

  test('subtreeHeight counts the levels under a section', ({ assert }) => {
    assert.equal(subtreeHeight(tree, 2), 1)
    assert.equal(subtreeHeight(tree, 1), 2)
  })

  test('subtreeHeight terminates on a corrupt cycle', ({ assert }) => {
    const corrupt = new Map<number, number | null>([
      [5, 6],
      [6, 5],
    ])
    const height = subtreeHeight(corrupt, 5)
    assert.isTrue(Number.isFinite(height) && height >= 0)
  })
})
