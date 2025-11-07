import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Role from '#models/role'

export default class UserRole extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare roleId: number

  @column()
  declare courseId: number | null // Null = rôle global, sinon rôle contextuel au cours

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Role)
  declare role: BelongsTo<typeof Role>

  // Helper methods
  static async assignRole(userId: number, roleSlug: string, courseId?: number) {
    const role = await Role.findBySlug(roleSlug)
    if (!role) {
      throw new Error(`Role ${roleSlug} not found`)
    }

    return await UserRole.updateOrCreate(
      { userId, roleId: role.id, courseId: courseId || null },
      { userId, roleId: role.id, courseId: courseId || null }
    )
  }

  static async removeRole(userId: number, roleSlug: string, courseId?: number) {
    const role = await Role.findBySlug(roleSlug)
    if (!role) {
      throw new Error(`Role ${roleSlug} not found`)
    }

    const query = UserRole.query().where('user_id', userId).where('role_id', role.id)

    if (courseId) {
      query.where('course_id', courseId)
    } else {
      query.whereNull('course_id')
    }

    await query.delete()
  }

  static async getUserRoles(userId: number, courseId?: number) {
    const query = UserRole.query().where('user_id', userId).preload('role')

    if (courseId !== undefined) {
      query.where('course_id', courseId)
    }

    return await query
  }
}
