import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import CourseContent from '#models/course_content'

/**
 * A deduplicated file stored outside the webroot (storage/content_files/).
 * Identified by its SHA-256 checksum; shared by any number of CourseContents.
 */
export default class ContentFile extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  /** Original client filename, used for display and Content-Disposition */
  @column()
  declare filename: string

  /** Path relative to storage/content_files/ (POSIX separators) */
  @column({ serializeAs: null })
  declare storagePath: string

  @column()
  declare mimeType: string

  /**
   * Size in bytes. Stored as BIGINT: the pg driver returns BIGINT as a string,
   * so normalise to a number on read.
   */
  @column({
    consume: (value: number | string | null) => (value == null ? value : Number(value)),
  })
  declare size: number

  /** SHA-256 hex digest (unique) */
  @column()
  declare checksum: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @manyToMany(() => CourseContent, {
    pivotTable: 'content_content_files',
    localKey: 'id',
    pivotForeignKey: 'content_file_id',
    relatedKey: 'id',
    pivotRelatedForeignKey: 'course_content_id',
    pivotTimestamps: true,
  })
  declare contents: ManyToMany<typeof CourseContent>
}
