import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Course from '#models/course'
import CourseGroup from '#models/course_group'

export default class CourseGrouping extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare courseId: number

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => Course)
  declare course: BelongsTo<typeof Course>

  @hasMany(() => CourseGroup, {
    foreignKey: 'groupingId',
  })
  declare groups: HasMany<typeof CourseGroup>
}
