import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Cohort from '#models/cohort'
import User from '#models/user'

export default class CohortMember extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare cohortId: number

  @column()
  declare userId: number

  @column.dateTime()
  declare addedAt: DateTime

  @column()
  declare addedBy: number | null

  // Relationships
  @belongsTo(() => Cohort, {
    foreignKey: 'cohortId',
  })
  declare cohort: BelongsTo<typeof Cohort>

  @belongsTo(() => User, {
    foreignKey: 'userId',
  })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'addedBy',
  })
  declare addedByUser: BelongsTo<typeof User>
}
