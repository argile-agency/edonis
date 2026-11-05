import { DateTime } from 'luxon'
import {
  BaseModel,
  column,
  belongsTo,
  hasMany,
  manyToMany,
  beforeFind,
  beforeFetch,
  beforePaginate,
} from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import CourseModule from '#models/course_module'
import ContentProgress from '#models/content_progress'
import ContentFile from '#models/content_file'
import { jsonColumnConfig } from '../helpers/json_column.js'

export type ContentType = 'page' | 'file' | 'video' | 'link' | 'assignment' | 'quiz'
export type CompletionType = 'manual' | 'view' | 'submit' | 'grade'

export default class CourseContent extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare moduleId: number

  @column()
  declare copiedFromId: number | null

  @column()
  declare contentType: ContentType

  @column()
  declare title: string

  @column()
  declare description: string | null

  @column()
  declare content: string | null

  @column()
  declare fileUrl: string | null

  @column()
  declare fileName: string | null

  @column()
  declare fileSize: number | null

  @column()
  declare fileType: string | null

  @column()
  declare externalUrl: string | null

  @column(jsonColumnConfig)
  declare metadata: Record<string, any> | null

  @column()
  declare order: number

  @column()
  declare isPublished: boolean

  @column.dateTime()
  declare availableFrom: DateTime | null

  @column.dateTime()
  declare availableUntil: DateTime | null

  @column()
  declare completionRequired: boolean

  @column()
  declare completionType: CompletionType

  @column()
  declare minTimeRequired: number | null

  @column()
  declare maxPoints: number | null

  @column.dateTime()
  declare dueDate: DateTime | null

  @column()
  declare allowLateSubmissions: boolean

  @column()
  declare latePenaltyPercent: number | null

  @column()
  declare estimatedTime: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @column.dateTime()
  declare deletedAt: DateTime | null

  @column()
  declare deletedBatch: string | null

  @column()
  declare deletedById: number | null

  // Trashed rows (Phase 5.2) are invisible to every model query, preloads included.
  // Read them with trx.from(); group any orWhere on these models.
  @beforeFind()
  static hideTrashedOnFind(query: ModelQueryBuilderContract<typeof CourseContent>) {
    query.whereNull(`${CourseContent.table}.deleted_at`)
  }

  @beforeFetch()
  static hideTrashedOnFetch(query: ModelQueryBuilderContract<typeof CourseContent>) {
    query.whereNull(`${CourseContent.table}.deleted_at`)
  }

  @beforePaginate()
  static hideTrashedOnPaginate([countQuery, query]: [
    ModelQueryBuilderContract<typeof CourseContent>,
    ModelQueryBuilderContract<typeof CourseContent>,
  ]) {
    countQuery.whereNull(`${CourseContent.table}.deleted_at`)
    query.whereNull(`${CourseContent.table}.deleted_at`)
  }

  // Relationships
  @belongsTo(() => CourseModule, {
    foreignKey: 'moduleId',
  })
  declare module: BelongsTo<typeof CourseModule>

  @hasMany(() => ContentProgress, {
    foreignKey: 'contentId',
  })
  declare progresses: HasMany<typeof ContentProgress>

  @manyToMany(() => ContentFile, {
    pivotTable: 'content_content_files',
    localKey: 'id',
    pivotForeignKey: 'course_content_id',
    relatedKey: 'id',
    pivotRelatedForeignKey: 'content_file_id',
    // Per-attachment filename/MIME type (see ContentFileAttachment)
    pivotColumns: ['filename', 'mime_type'],
    pivotTimestamps: true,
  })
  declare files: ManyToMany<typeof ContentFile>

  // Helper methods
  public isAvailable(): boolean {
    if (!this.isPublished) {
      return false
    }

    const now = DateTime.now()

    if (this.availableFrom && this.availableFrom > now) {
      return false
    }

    if (this.availableUntil && this.availableUntil < now) {
      return false
    }

    return true
  }

  public isOverdue(): boolean {
    if (!this.dueDate) {
      return false
    }

    return DateTime.now() > this.dueDate
  }

  public canSubmitLate(): boolean {
    return this.allowLateSubmissions && this.isOverdue()
  }

  public getContentUrl(): string | null {
    switch (this.contentType) {
      case 'file':
      case 'video':
        return this.fileUrl
      case 'link':
        return this.externalUrl
      default:
        return null
    }
  }

  public async getUserProgress(userId: number): Promise<ContentProgress | null> {
    return await ContentProgress.query()
      .where('user_id', userId)
      .where('content_id', this.id)
      .first()
  }

  public async isCompletedBy(userId: number): Promise<boolean> {
    const progress = await this.getUserProgress(userId)
    return progress?.status === 'completed'
  }

  // Custom serializer for additional computed properties
  public serializeExtras() {
    return {
      isAvailable: this.isAvailable(),
      isOverdue: this.isOverdue(),
    }
  }
}
