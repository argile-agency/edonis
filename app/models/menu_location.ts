import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Menu from '#models/menu'
import MenuItem from '#models/menu_item'

export default class MenuLocation extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare location: string

  @column()
  declare description: string | null

  @column()
  declare menuId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Menu)
  declare menu: BelongsTo<typeof Menu>

  /**
   * Récupère le menu assigné à une location spécifique
   */
  static async getMenuForLocation(location: string) {
    const menuLocation = await this.query()
      .where('location', location)
      .preload('menu', (menuQuery) => {
        menuQuery.preload('items', (itemQuery) => {
          itemQuery.where('is_active', true).orderBy('order', 'asc')
        })
      })
      .first()

    if (!menuLocation || !menuLocation.menu) {
      return null
    }

    return menuLocation.menu
  }

  /**
   * Récupère l'arborescence du menu pour une location
   */
  static async getMenuTreeForLocation(location: string, user: any | null = null) {
    const menu = await this.getMenuForLocation(location)
    if (!menu) {
      return []
    }

    const tree = await menu.getMenuTree()

    // Filtrer selon la visibilité
    const filterByVisibility = (items: any[]): any[] => {
      return items
        .filter((item) => {
          const menuItem = new MenuItem()
          Object.assign(menuItem, item)
          return menuItem.isVisibleForUser(user)
        })
        .map((item) => ({
          ...item,
          children: item.children ? filterByVisibility(item.children) : [],
        }))
    }

    return filterByVisibility(tree)
  }
}
