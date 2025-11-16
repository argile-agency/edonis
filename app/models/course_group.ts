import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Course from '#models/course'
import CourseGrouping from '#models/course_grouping'
import CourseGroupMember from '#models/course_group_member'

export default class CourseGroup extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare courseId: number

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare groupingId: number | null

  @column()
  declare maxMembers: number | null

  @column()
  declare currentMembers: number

  @column()
  declare isVisibleToStudents: boolean

  @column()
  declare enableGroupMessaging: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => Course)
  declare course: BelongsTo<typeof Course>

  @belongsTo(() => CourseGrouping, {
    foreignKey: 'groupingId',
  })
  declare grouping: BelongsTo<typeof CourseGrouping>

  @hasMany(() => CourseGroupMember, {
    foreignKey: 'groupId',
  })
  declare members: HasMany<typeof CourseGroupMember>

  // Helper methods
  public isFull(): boolean {
    if (this.maxMembers === null) return false
    return this.currentMembers >= this.maxMembers
  }

  public canAddMembers(count: number = 1): boolean {
    if (this.maxMembers === null) return true
    return this.currentMembers + count <= this.maxMembers
  }
}
