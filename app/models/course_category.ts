import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import Course from '#models/course'

export default class CourseCategory extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare description: string | null

  // Hierarchy
  @column()
  declare parentId: number | null

  @column()
  declare sortOrder: number

  @column()
  declare depth: number

  @column()
  declare path: string | null

  // Visibility
  @column()
  declare isVisible: boolean

  // Metadata
  @column()
  declare icon: string | null

  @column()
  declare color: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => CourseCategory, {
    foreignKey: 'parentId',
  })
  declare parent: BelongsTo<typeof CourseCategory>

  @hasMany(() => CourseCategory, {
    foreignKey: 'parentId',
  })
  declare children: HasMany<typeof CourseCategory>

  @hasMany(() => Course, {
    foreignKey: 'categoryId',
  })
  declare courses: HasMany<typeof Course>

  // Helper methods
  public isRoot(): boolean {
    return this.parentId === null
  }

  public async getFullPath(): Promise<string> {
    if (this.path) return this.path

    const parts: string[] = [this.slug]
    let current = this

    while (current.parentId) {
      await current.load('parent' as any)
      current = current.parent as any
      parts.unshift(current.slug)
    }

    return '/' + parts.join('/')
  }

  // Serialize for JSON responses
  public serialize() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      description: this.description,
      parentId: this.parentId,
      sortOrder: this.sortOrder,
      depth: this.depth,
      path: this.path,
      isVisible: this.isVisible,
      icon: this.icon,
      color: this.color,
      createdAt: this.createdAt.toISO(),
      updatedAt: this.updatedAt?.toISO(),
    }
  }
}
