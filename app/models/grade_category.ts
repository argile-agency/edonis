import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Course from '#models/course'
import Assignment from '#models/assignment'

export default class GradeCategory extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare courseId: number

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare weight: number

  @column()
  declare dropLowest: boolean

  @column()
  declare dropLowestCount: number

  @column()
  declare position: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => Course)
  declare course: BelongsTo<typeof Course>

  @hasMany(() => Assignment)
  declare assignments: HasMany<typeof Assignment>
}
