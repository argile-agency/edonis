import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Course from '#models/course'
import User from '#models/user'

export default class CoursePermission extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare courseId: number

  @column()
  declare userId: number

  @column()
  declare permissionLevel: 'view' | 'edit' | 'manage'

  @column()
  declare roleInCourse: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => Course, {
    foreignKey: 'courseId',
  })
  declare course: BelongsTo<typeof Course>

  @belongsTo(() => User, {
    foreignKey: 'userId',
  })
  declare user: BelongsTo<typeof User>

  // Helper methods
  public canView(): boolean {
    return ['view', 'edit', 'manage'].includes(this.permissionLevel)
  }

  public canEdit(): boolean {
    return ['edit', 'manage'].includes(this.permissionLevel)
  }

  public canManage(): boolean {
    return this.permissionLevel === 'manage'
  }

  public serialize() {
    return {
      id: this.id,
      courseId: this.courseId,
      userId: this.userId,
      permissionLevel: this.permissionLevel,
      roleInCourse: this.roleInCourse,
      createdAt: this.createdAt.toISO(),
      updatedAt: this.updatedAt?.toISO(),
      user: this.user?.serialize(),
    }
  }
}
