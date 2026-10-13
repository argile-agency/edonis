import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import CourseCategory from '#models/course_category'
import {
  createCategoryValidator,
  updateCategoryValidator,
  reorderCategoriesValidator,
} from '#validators/category'
import { recomputeSubtree, wouldCreateCycle } from '../helpers/category_tree.js'

const CYCLE_ERROR =
  'Une catégorie ne peut pas être placée sous elle-même ou sous une de ses sous-catégories.'

export default class CategoriesController {
  /**
   * Display all categories (admin view)
   */
  async index({ inertia }: HttpContext) {
    const categories = await CourseCategory.query()
      .preload('parent')
      .preload('children')
      .preload('courses')
      .orderBy('depth', 'asc')
      .orderBy('sort_order', 'asc')

    // Build tree structure
    const rootCategories = categories.filter((c) => c.parentId === null)

    const buildTree = (category: CourseCategory): any => {
      const children = categories.filter((c) => c.parentId === category.id)
      return {
        ...category.serialize(),
        children: children.map(buildTree),
        courseCount: category.courses?.length || 0,
      }
    }

    const categoryTree = rootCategories.map(buildTree)

    return inertia.render('admin/categories/index', {
      categories: categoryTree,
      flatCategories: categories.map((c) => c.serialize()),
    })
  }

  /**
   * Show create category form
   */
  async create({ inertia }: HttpContext) {
    const categories = await CourseCategory.query().orderBy('name', 'asc')

    return inertia.render('admin/categories/create', {
      categories: categories.map((c) => c.serialize()),
    })
  }

  /**
   * Show create child category form
   */
  async createChild({ params, inertia }: HttpContext) {
    const parentCategory = await CourseCategory.findOrFail(params.id)
    const categories = await CourseCategory.query().orderBy('name', 'asc')

    return inertia.render('admin/categories/create', {
      categories: categories.map((c) => c.serialize()),
      parentCategory: parentCategory.serialize(),
    })
  }

  /**
   * Store a new category
   */
  async store({ request, response, session }: HttpContext) {
    const data = await request.validateUsing(createCategoryValidator)

    // Calculate depth and path
    let depth = 0
    let path = `/${data.slug}`

    if (data.parentId) {
      const parent = await CourseCategory.findOrFail(data.parentId)
      depth = parent.depth + 1
      path = `${parent.path}/${data.slug}`
    }

    await CourseCategory.create({
      ...data,
      depth,
      path,
      sortOrder: data.sortOrder ?? 0,
      isVisible: data.isVisible ?? true,
    })

    session.flash('success', 'Catégorie créée avec succès.')

    return response.redirect().toRoute('admin.categories.index')
  }

  /**
   * Show edit category form
   */
  async edit({ params, inertia }: HttpContext) {
    const category = await CourseCategory.query()
      .where('id', params.id)
      .preload('parent')
      .preload('children')
      .firstOrFail()

    const allCategories = await CourseCategory.query()
      .whereNot('id', category.id)
      .orderBy('name', 'asc')

    return inertia.render('admin/categories/edit', {
      category: category.serialize(),
      categories: allCategories.map((c) => c.serialize()),
    })
  }

  /**
   * Update a category
   */
  async update({ params, request, response, session }: HttpContext) {
    const category = await CourseCategory.findOrFail(params.id)
    const data = await request.validateUsing(updateCategoryValidator)

    // Load the whole hierarchy once: used for the cycle check and the subtree recompute.
    const all = await CourseCategory.query().select('id', 'parent_id', 'slug')
    const parentById = new Map<number, number | null>(all.map((c) => [c.id, c.parentId]))

    // Refuse the category itself or one of its descendants as the new parent:
    // the whole subtree would vanish from the tree while still holding courses.
    if (
      data.parentId !== undefined &&
      data.parentId !== null &&
      wouldCreateCycle(parentById, category.id, data.parentId)
    ) {
      session.flash('error', CYCLE_ERROR)
      return response.redirect().back()
    }

    const parentChanged = data.parentId !== undefined
    const slugChanged = data.slug !== undefined

    await db.transaction(async (trx) => {
      // Recompute the node's own depth and path when its parent or slug changes
      if (parentChanged || slugChanged) {
        const parentId = parentChanged ? data.parentId : category.parentId
        const slug = data.slug ?? category.slug

        if (parentId === null || parentId === undefined) {
          category.depth = 0
          category.path = `/${slug}`
        } else {
          const parent = await CourseCategory.findOrFail(parentId, { client: trx })
          category.depth = parent.depth + 1
          category.path = `${parent.path}/${slug}`
        }
      }

      category.useTransaction(trx)
      category.merge(data)
      await category.save()

      // Keep every descendant consistent (grandchildren included), atomically
      if (parentChanged || slugChanged) {
        const nodes = all.map((c) => ({ id: c.id, parentId: c.parentId, slug: c.slug }))
        const descendants = recomputeSubtree(
          nodes,
          category.id,
          category.path ?? `/${category.slug}`,
          category.depth
        )

        for (const d of descendants) {
          await CourseCategory.query({ client: trx })
            .where('id', d.id)
            .update({ path: d.path, depth: d.depth })
        }
      }
    })

    session.flash('success', 'Catégorie mise à jour avec succès.')

    return response.redirect().toRoute('admin.categories.index')
  }

  /**
   * Delete a category
   */
  async destroy({ params, response, session }: HttpContext) {
    const category = await CourseCategory.query()
      .where('id', params.id)
      .preload('children')
      .preload('courses')
      .firstOrFail()

    // Check if category has children
    if (category.children.length > 0) {
      session.flash('error', 'Impossible de supprimer une catégorie qui a des sous-catégories.')
      return response.redirect().back()
    }

    // Check if category has courses
    if (category.courses.length > 0) {
      session.flash(
        'error',
        "Impossible de supprimer une catégorie qui contient des cours. Déplacez d'abord les cours."
      )
      return response.redirect().back()
    }

    await category.delete()

    session.flash('success', 'Catégorie supprimée avec succès.')

    return response.redirect().toRoute('admin.categories.index')
  }

  /**
   * Reorder categories
   */
  async reorder({ request, response, session }: HttpContext) {
    const { categoryIds } = await request.validateUsing(reorderCategoriesValidator)

    await db.transaction(async (trx) => {
      for (const [index, categoryId] of categoryIds.entries()) {
        const category = await CourseCategory.find(categoryId, { client: trx })
        if (category) {
          category.sortOrder = index
          await category.save()
        }
      }
    })

    session.flash('success', 'Ordre des catégories mis à jour.')

    return response.redirect().back()
  }
}
