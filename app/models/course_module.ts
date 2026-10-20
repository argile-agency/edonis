import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Course from '#models/course'
import CourseContent from '#models/course_content'

export default class CourseModule extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare courseId: number

  @column()
  declare parentId: number | null

  @column()
  declare title: string

  @column()
  declare description: string | null

  @column()
  declare order: number

  @column()
  declare isPublished: boolean

  @column.dateTime()
  declare availableFrom: DateTime | null

  @column.dateTime()
  declare availableUntil: DateTime | null

  @column()
  declare requirePreviousCompletion: boolean

  @column()
  declare estimatedTime: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => Course, {
    foreignKey: 'courseId',
  })
  declare course: BelongsTo<typeof Course>

  @belongsTo(() => CourseModule, {
    foreignKey: 'parentId',
  })
  declare parent: BelongsTo<typeof CourseModule>

  @hasMany(() => CourseModule, {
    foreignKey: 'parentId',
  })
  declare children: HasMany<typeof CourseModule>

  @hasMany(() => CourseContent, {
    foreignKey: 'moduleId',
  })
  declare contents: HasMany<typeof CourseContent>

  // Helper methods
  public isAvailable(): boolean {
    if (!this.isPublished) {
      return false
    }

    const now = DateTime.now()

    if (this.availableFrom && this.availableFrom > now) {
      return false
    }

    if (this.availableUntil && this.availableUntil < now) {
      return false
    }

    return true
  }

  /**
   * Whether learners can reach this module: it and every ancestor module must
   * be available. Unpublishing (or scheduling) a parent hides its whole
   * subtree in the learner player, so access checks must follow the same
   * rule. Fails closed on a missing ancestor or a parent_id cycle.
   */
  public async isEffectivelyAvailable(): Promise<boolean> {
    const visited = new Set<number>()
    let current: CourseModule | null = this

    while (current) {
      if (visited.has(current.id) || !current.isAvailable()) {
        return false
      }
      visited.add(current.id)

      if (!current.parentId) {
        return true
      }

      current = await CourseModule.query()
        .where('id', current.parentId)
        .where('course_id', this.courseId)
        .first()
    }

    // parent_id points to a missing module (or one in another course)
    return false
  }

  public async getDepth(): Promise<number> {
    if (!this.parentId) {
      return 0
    }

    const parent = await CourseModule.find(this.parentId)
    if (!parent) {
      return 0
    }

    return (await parent.getDepth()) + 1
  }

  // Custom serializer for additional computed properties
  public serializeExtras() {
    return {
      isAvailable: this.isAvailable(),
    }
  }
}
