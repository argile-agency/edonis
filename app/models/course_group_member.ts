import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import CourseGroup from '#models/course_group'
import User from '#models/user'

export type GroupRole = 'leader' | 'member' | 'moderator'

export default class CourseGroupMember extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare groupId: number

  @column()
  declare userId: number

  @column()
  declare roleInGroup: GroupRole | null

  @column.dateTime()
  declare joinedAt: DateTime

  @column()
  declare addedBy: number | null

  // Relationships
  @belongsTo(() => CourseGroup, {
    foreignKey: 'groupId',
  })
  declare group: BelongsTo<typeof CourseGroup>

  @belongsTo(() => User, {
    foreignKey: 'userId',
  })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'addedBy',
  })
  declare addedByUser: BelongsTo<typeof User>

  // Helper methods
  public isLeader(): boolean {
    return this.roleInGroup === 'leader'
  }

  public isModerator(): boolean {
    return this.roleInGroup === 'moderator'
  }
}
