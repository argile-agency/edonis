/**
 * Pure tree helpers for self-referencing hierarchies.
 *
 * Generic over `{ id, parentId }`: no framework or model imports, so they work
 * for course categories as well as course-module parents (plan 02-10 reuses
 * `wouldCreateCycle`). Every helper terminates on corrupt (cyclic) input.
 */

/**
 * Returns `true` when attaching `nodeId` under `newParentId` would create a
 * cycle: the new parent is the node itself or one of its descendants.
 *
 * Walks up from `newParentId` using `parentById`. A revisit, or more steps
 * than there are nodes, means the stored data is already cyclic: that is
 * reported as `true` so callers refuse the write instead of hanging.
 */
export function wouldCreateCycle(
  parentById: ReadonlyMap<number, number | null>,
  nodeId: number,
  newParentId: number | null
): boolean {
  const seen = new Set<number>()
  const maxSteps = parentById.size + 1
  let current: number | null = newParentId
  let steps = 0

  while (current !== null) {
    if (current === nodeId) return true
    if (seen.has(current)) return true
    seen.add(current)

    steps += 1
    if (steps > maxSteps) return true

    current = parentById.get(current) ?? null
  }

  return false
}

export interface TreeNode {
  id: number
  parentId: number | null
  slug: string
}

export interface RecomputedNode {
  id: number
  path: string
  depth: number
}

/**
 * Recomputes `path` and `depth` for every descendant of `rootId` (the root
 * itself is excluded), breadth-first. Each child gets
 * `path = parentPath + '/' + slug` and `depth = parentDepth + 1`.
 *
 * A visited set guarantees termination and that no node is returned twice,
 * even when the input already contains a cycle.
 */
export function recomputeSubtree(
  nodes: ReadonlyArray<TreeNode>,
  rootId: number,
  rootPath: string,
  rootDepth: number
): RecomputedNode[] {
  const childrenByParent = new Map<number, TreeNode[]>()
  for (const node of nodes) {
    if (node.parentId === null) continue
    const siblings = childrenByParent.get(node.parentId)
    if (siblings) {
      siblings.push(node)
    } else {
      childrenByParent.set(node.parentId, [node])
    }
  }

  const result: RecomputedNode[] = []
  const visited = new Set<number>([rootId])
  const queue: RecomputedNode[] = [{ id: rootId, path: rootPath, depth: rootDepth }]

  while (queue.length > 0) {
    const parent = queue.shift()!
    for (const child of childrenByParent.get(parent.id) ?? []) {
      if (visited.has(child.id)) continue
      visited.add(child.id)

      const recomputed = {
        id: child.id,
        path: `${parent.path}/${child.slug}`,
        depth: parent.depth + 1,
      }
      result.push(recomputed)
      queue.push(recomputed)
    }
  }

  return result
}
