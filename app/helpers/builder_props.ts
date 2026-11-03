import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'
import CourseModule from '#models/course_module'
import CourseContent from '#models/course_content'
import type { BuilderContent, BuilderSection } from '../../inertia/lib/builder_tree.js'

/**
 * The builder's flat structure of one course: every section and every content
 * item, mapped explicitly (no page bodies, no copy lineage). Shared by the
 * builder page props and the bulk action responses.
 */
export async function loadBuilderStructure(
  courseId: number,
  client?: QueryClientContract
): Promise<{ sections: BuilderSection[]; contents: BuilderContent[] }> {
  const options = client ? { client } : {}
  const modules = await CourseModule.query(options)
    .where('course_id', courseId)
    .select(
      'id',
      'parent_id',
      'title',
      'description',
      'order',
      'is_published',
      'available_from',
      'available_until',
      'updated_at'
    )
    .orderBy('order', 'asc')
    .orderBy('id', 'asc')
  const items = await CourseContent.query(options)
    .whereIn(
      'module_id',
      (client ?? db).from('course_modules').select('id').where('course_id', courseId)
    )
    .select(
      'id',
      'module_id',
      'content_type',
      'title',
      'description',
      'order',
      'is_published',
      'available_from',
      'available_until',
      'updated_at'
    )
    .orderBy('order', 'asc')
    .orderBy('id', 'asc')

  return {
    sections: modules.map((m) => ({
      id: m.id,
      parentId: m.parentId,
      title: m.title,
      description: m.description,
      order: m.order,
      // SQLite and MySQL return 0/1
      isPublished: Boolean(m.isPublished),
      availableFrom: m.availableFrom?.toISO() ?? null,
      availableUntil: m.availableUntil?.toISO() ?? null,
      updatedAt: m.updatedAt?.toISO() ?? null,
    })),
    contents: items.map((c) => ({
      id: c.id,
      moduleId: c.moduleId,
      contentType: c.contentType,
      title: c.title,
      description: c.description,
      order: c.order,
      isPublished: Boolean(c.isPublished),
      availableFrom: c.availableFrom?.toISO() ?? null,
      availableUntil: c.availableUntil?.toISO() ?? null,
      updatedAt: c.updatedAt?.toISO() ?? null,
    })),
  }
}
