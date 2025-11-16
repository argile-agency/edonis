import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import MenuItem from '#models/menu_item'

export default class Menu extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare description: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => MenuItem)
  declare items: HasMany<typeof MenuItem>

  /**
   * Récupère tous les items du menu triés par ordre
   */
  async getOrderedItems() {
    return await MenuItem.query().where('menu_id', this.id).orderBy('order', 'asc')
  }

  /**
   * Récupère l'arborescence complète du menu
   */
  async getMenuTree() {
    const items = await MenuItem.query()
      .where('menu_id', this.id)
      .where('is_active', true)
      .orderBy('order', 'asc')

    // Construire l'arborescence
    const itemsMap = new Map()
    const tree: any[] = []

    items.forEach((item) => {
      itemsMap.set(item.id, { ...item.toJSON(), children: [] })
    })

    items.forEach((item) => {
      const node = itemsMap.get(item.id)
      if (item.parentId) {
        const parent = itemsMap.get(item.parentId)
        if (parent) {
          parent.children.push(node)
        }
      } else {
        tree.push(node)
      }
    })

    return tree
  }
}
