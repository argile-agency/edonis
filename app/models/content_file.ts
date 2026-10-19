import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import CourseContent from '#models/course_content'

/**
 * Per-attachment metadata stored on the content_content_files pivot.
 */
export interface ContentFileAttachment {
  /** Original client filename, used for display and Content-Disposition */
  filename: string
  mime_type: string
}

/**
 * A deduplicated file stored outside the webroot (content storage root).
 * Identified by its SHA-256 checksum; shared by any number of CourseContents.
 *
 * The client filename and MIME type are per attachment and live on the
 * content_content_files pivot (read them as `$extras.pivot_filename` and
 * `$extras.pivot_mime_type`), never on this shared row: the same bytes can be
 * uploaded under different names in different courses.
 */
export default class ContentFile extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  /** Path relative to the content storage root (POSIX separators) */
  @column({ serializeAs: null })
  declare storagePath: string

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
    pivotColumns: ['filename', 'mime_type'],
    pivotTimestamps: true,
  })
  declare contents: ManyToMany<typeof CourseContent>
}
