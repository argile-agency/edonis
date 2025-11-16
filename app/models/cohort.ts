import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import CohortMember from '#models/cohort_member'

export type CohortType = 'manual' | 'automatic'

export default class Cohort extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare description: string | null

  @column()
  declare cohortType: CohortType

  @column()
  declare isVisible: boolean

  @column()
  declare memberCount: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @hasMany(() => CohortMember, {
    foreignKey: 'cohortId',
  })
  declare members: HasMany<typeof CohortMember>

  // Helper methods
  public async updateMemberCount(): Promise<void> {
    await this.load('members' as any)
    this.memberCount = this.members.length
    await this.save()
  }

  public isManual(): boolean {
    return this.cohortType === 'manual'
  }

  public isAutomatic(): boolean {
    return this.cohortType === 'automatic'
  }
}
