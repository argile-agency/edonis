import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import CourseContent from '#models/course_content'

export type ProgressStatus = 'not_started' | 'in_progress' | 'completed'

export default class ContentProgress extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare contentId: number

  @column()
  declare status: ProgressStatus

  @column()
  declare timeSpent: number

  @column.dateTime()
  declare firstAccessedAt: DateTime | null

  @column.dateTime()
  declare lastAccessedAt: DateTime | null

  @column.dateTime()
  declare completedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => User, {
    foreignKey: 'userId',
  })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => CourseContent, {
    foreignKey: 'contentId',
  })
  declare content: BelongsTo<typeof CourseContent>

  // Helper methods
  public async markAsStarted(): Promise<void> {
    if (this.status === 'not_started') {
      this.status = 'in_progress'
      this.firstAccessedAt = DateTime.now()
    }
    this.lastAccessedAt = DateTime.now()
    await this.save()
  }

  public async markAsCompleted(): Promise<void> {
    this.status = 'completed'
    this.completedAt = DateTime.now()
    this.lastAccessedAt = DateTime.now()
    await this.save()
  }

  public async addTimeSpent(seconds: number): Promise<void> {
    this.timeSpent += seconds
    this.lastAccessedAt = DateTime.now()
    await this.save()
  }

  public isCompleted(): boolean {
    return this.status === 'completed'
  }

  public isInProgress(): boolean {
    return this.status === 'in_progress'
  }

  public isNotStarted(): boolean {
    return this.status === 'not_started'
  }

  public getFormattedTimeSpent(): string {
    const hours = Math.floor(this.timeSpent / 3600)
    const minutes = Math.floor((this.timeSpent % 3600) / 60)
    const seconds = this.timeSpent % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    } else {
      return `${seconds}s`
    }
  }

  // Custom serializer for additional computed properties
  public serializeExtras() {
    return {
      formattedTimeSpent: this.getFormattedTimeSpent(),
    }
  }

  // Static helper to get or create progress
  public static async getOrCreate(userId: number, contentId: number): Promise<ContentProgress> {
    let progress = await ContentProgress.query()
      .where('user_id', userId)
      .where('content_id', contentId)
      .first()

    if (!progress) {
      progress = await ContentProgress.create({
        userId,
        contentId,
        status: 'not_started',
        timeSpent: 0,
      })
    }

    return progress
  }
}
