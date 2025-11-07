import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export interface RolePermissions {
  [key: string]: boolean
}

export default class Role extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare description: string | null

  @column({
    prepare: (value: RolePermissions | null) => {
      if (value === null || value === undefined) return null
      if (typeof value === 'string') return value
      return JSON.stringify(value)
    },
    consume: (value: string | null) => {
      if (value === null || value === undefined) return null
      if (typeof value === 'object') return value
      return JSON.parse(value)
    },
  })
  declare permissions: RolePermissions | null

  @column()
  declare isSystem: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @manyToMany(() => User, {
    pivotTable: 'user_roles',
    pivotForeignKey: 'role_id',
    pivotRelatedForeignKey: 'user_id',
    pivotTimestamps: true,
  })
  declare users: ManyToMany<typeof User>

  // Helper methods
  static async findBySlug(slug: string) {
    return await this.findBy('slug', slug)
  }

  hasPermission(permission: string): boolean {
    return this.permissions?.[permission] === true
  }
}
