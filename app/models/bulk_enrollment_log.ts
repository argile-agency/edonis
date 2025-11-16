import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Course from '#models/course'
import User from '#models/user'
import CourseEnrollmentMethod from '#models/course_enrollment_method'

export type BulkEnrollmentStatus = 'pending' | 'processing' | 'completed' | 'failed'

interface ErrorDetail {
  row: number
  email?: string
  error: string
  [key: string]: any
}

interface ImportOptions {
  autoCreateUsers?: boolean
  autoAssignGroups?: boolean
  defaultRole?: string
  groupColumn?: string
  cohortColumn?: string
  [key: string]: any
}

export default class BulkEnrollmentLog extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare courseId: number

  @column()
  declare enrollmentMethodId: number | null

  @column()
  declare importedBy: number

  @column()
  declare filename: string

  @column()
  declare filePath: string | null

  @column()
  declare totalRows: number

  @column()
  declare successfulEnrollments: number

  @column()
  declare failedEnrollments: number

  @column()
  declare skippedRows: number

  @column({
    prepare: (value: ErrorDetail[]) => JSON.stringify(value),
    consume: (value: string) => JSON.parse(value),
  })
  declare errorDetails: ErrorDetail[] | null

  @column({
    prepare: (value: ImportOptions) => JSON.stringify(value),
    consume: (value: string) => JSON.parse(value),
  })
  declare importOptions: ImportOptions | null

  @column()
  declare status: BulkEnrollmentStatus

  @column.dateTime()
  declare startedAt: DateTime

  @column.dateTime()
  declare completedAt: DateTime | null

  // Relationships
  @belongsTo(() => Course)
  declare course: BelongsTo<typeof Course>

  @belongsTo(() => CourseEnrollmentMethod, {
    foreignKey: 'enrollmentMethodId',
  })
  declare enrollmentMethod: BelongsTo<typeof CourseEnrollmentMethod>

  @belongsTo(() => User, {
    foreignKey: 'importedBy',
  })
  declare importer: BelongsTo<typeof User>

  // Helper methods
  public isProcessing(): boolean {
    return this.status === 'processing'
  }

  public isCompleted(): boolean {
    return this.status === 'completed'
  }

  public isFailed(): boolean {
    return this.status === 'failed'
  }

  public getSuccessRate(): number {
    if (this.totalRows === 0) return 0
    return (this.successfulEnrollments / this.totalRows) * 100
  }

  public async markAsProcessing(): Promise<void> {
    this.status = 'processing'
    await this.save()
  }

  public async markAsCompleted(): Promise<void> {
    this.status = 'completed'
    this.completedAt = DateTime.now()
    await this.save()
  }

  public async markAsFailed(): Promise<void> {
    this.status = 'failed'
    this.completedAt = DateTime.now()
    await this.save()
  }

  public addError(row: number, email: string | undefined, error: string): void {
    if (!this.errorDetails) {
      this.errorDetails = []
    }

    this.errorDetails.push({
      row,
      email,
      error,
    })
  }
}
