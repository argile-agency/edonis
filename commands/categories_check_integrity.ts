import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import { recomputeSubtree, wouldCreateCycle } from '../app/helpers/category_tree.js'

interface CategoryRow {
  id: number
  parent_id: number | null
  slug: string
  path: string | null
  depth: number | null
}

/**
 * Read-only audit of the course category hierarchy.
 *
 * Reports (a) categories on, or hanging below, a parent cycle and (b) rows
 * whose stored path/depth differ from the values derived from the tree.
 * Never writes to the database. Exits with code 1 when any issue is found.
 */
export default class CategoriesCheckIntegrity extends BaseCommand {
  static commandName = 'categories:check-integrity'
  static description =
    'Read-only report of course category cycles and stale path/depth values (exit 1 on issues)'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const rows: CategoryRow[] = await db
      .from('course_categories')
      .select('id', 'parent_id', 'slug', 'path', 'depth')

    const parentById = new Map<number, number | null>(
      rows.map((row) => [Number(row.id), row.parent_id === null ? null : Number(row.parent_id)])
    )

    // (a) Cycles: walking up from the parent reaches the node, or revisits a node
    const cyclic: number[] = []
    for (const [id, parentId] of parentById) {
      if (parentId !== null && wouldCreateCycle(parentById, id, parentId)) {
        cyclic.push(id)
      }
    }

    // (b) Stale path/depth: recompute from every root and compare with stored values
    const nodes = rows.map((row) => ({
      id: Number(row.id),
      parentId: parentById.get(Number(row.id)) ?? null,
      slug: row.slug,
    }))
    const byId = new Map(rows.map((row) => [Number(row.id), row]))

    const expected: Array<{ id: number; path: string; depth: number }> = []
    for (const node of nodes) {
      if (node.parentId !== null) continue
      const rootPath = `/${node.slug}`
      expected.push({ id: node.id, path: rootPath, depth: 0 })
      expected.push(...recomputeSubtree(nodes, node.id, rootPath, 0))
    }

    const stale: string[] = []
    for (const exp of expected) {
      const row = byId.get(exp.id)
      if (!row) continue
      const storedDepth = row.depth === null ? null : Number(row.depth)
      if (row.path !== exp.path || storedDepth !== exp.depth) {
        stale.push(
          `${exp.id} ${row.path ?? 'null'} (depth ${storedDepth ?? 'null'})` +
            ` → ${exp.path} (depth ${exp.depth})`
        )
      }
    }

    this.logger.info(`Checked ${rows.length} categories`)

    if (cyclic.length > 0) {
      this.logger.error(
        `${cyclic.length} categories on or below a parent cycle: ${cyclic.sort((x, y) => x - y).join(', ')}`
      )
    } else {
      this.logger.success('0 categories on or below a parent cycle')
    }

    if (stale.length > 0) {
      this.logger.error(
        `${stale.length} categories with a stale path/depth (id stored → expected):`
      )
      for (const line of stale) {
        this.logger.log(`  ${line}`)
      }
    } else {
      this.logger.success('0 categories with a stale path/depth')
    }

    if (cyclic.length > 0 || stale.length > 0) {
      this.exitCode = 1
    }
  }
}
