import type { HttpContext } from '@adonisjs/core/http'
import CourseCategory from '#models/course_category'
import vine from '@vinejs/vine'

// Validators
const createCategoryValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(255),
    slug: vine.string().trim().minLength(2).maxLength(255),
    description: vine.string().trim().optional(),
    parentId: vine.number().optional(),
    sortOrder: vine.number().optional(),
    isVisible: vine.boolean().optional(),
    icon: vine.string().trim().optional(),
    color: vine.string().trim().optional(),
  })
)

const updateCategoryValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(255).optional(),
    slug: vine.string().trim().minLength(2).maxLength(255).optional(),
    description: vine.string().trim().optional(),
    parentId: vine.number().optional().nullable(),
    sortOrder: vine.number().optional(),
    isVisible: vine.boolean().optional(),
    icon: vine.string().trim().optional(),
    color: vine.string().trim().optional(),
  })
)

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

    // Recalculate depth and path if parent changed
    if (data.parentId !== undefined) {
      if (data.parentId === null) {
        category.depth = 0
        category.path = `/${data.slug || category.slug}`
      } else {
        const parent = await CourseCategory.findOrFail(data.parentId)
        category.depth = parent.depth + 1
        category.path = `${parent.path}/${data.slug || category.slug}`
      }
    }

    category.merge(data)
    await category.save()

    // Update children paths if slug changed
    if (data.slug) {
      const children = await CourseCategory.query().where('parent_id', category.id)
      for (const child of children) {
        child.path = `${category.path}/${child.slug}`
        await child.save()
      }
    }

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
    const { categoryIds } = request.only(['categoryIds'])

    for (let i = 0; i < categoryIds.length; i++) {
      const category = await CourseCategory.find(categoryIds[i])
      if (category) {
        category.sortOrder = i
        await category.save()
      }
    }

    session.flash('success', 'Ordre des catégories mis à jour.')

    return response.redirect().back()
  }
}
