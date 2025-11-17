import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Menu from '#models/menu'

export default class MenuItem extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare menuId: number

  @column()
  declare label: string

  @column()
  declare url: string

  @column()
  declare icon: string | null

  @column()
  declare order: number

  @column()
  declare parentId: number | null

  @column()
  declare cssClasses: string | null

  @column()
  declare target: string

  @column()
  declare visibility: 'public' | 'authenticated' | 'guest' | 'admin' | 'instructor' | 'student'

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Menu)
  declare menu: BelongsTo<typeof Menu>

  /**
   * Vérifie si l'item est visible pour un utilisateur donné
   */
  isVisibleForUser(user: any | null): boolean {
    switch (this.visibility) {
      case 'public':
        return true
      case 'authenticated':
        return !!user
      case 'guest':
        return !user
      case 'admin':
        return user?.roles?.some((r: any) => r.slug === 'admin')
      case 'instructor':
        return user?.roles?.some((r: any) => ['admin', 'manager', 'teacher'].includes(r.slug))
      case 'student':
        return user?.roles?.some((r: any) =>
          ['admin', 'manager', 'teacher', 'student'].includes(r.slug)
        )
      default:
        return false
    }
  }
}
