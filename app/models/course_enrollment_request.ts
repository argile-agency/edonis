import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Course from '#models/course'
import User from '#models/user'
import CourseEnrollmentMethod from '#models/course_enrollment_method'

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export default class CourseEnrollmentRequest extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare courseId: number

  @column()
  declare userId: number

  @column()
  declare enrollmentMethodId: number | null

  @column()
  declare status: RequestStatus

  @column()
  declare requestMessage: string | null

  @column()
  declare processedBy: number | null

  @column.dateTime()
  declare processedAt: DateTime | null

  @column()
  declare responseMessage: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => Course)
  declare course: BelongsTo<typeof Course>

  @belongsTo(() => User, {
    foreignKey: 'userId',
  })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => CourseEnrollmentMethod, {
    foreignKey: 'enrollmentMethodId',
  })
  declare enrollmentMethod: BelongsTo<typeof CourseEnrollmentMethod>

  @belongsTo(() => User, {
    foreignKey: 'processedBy',
  })
  declare processor: BelongsTo<typeof User>

  // Helper methods
  public isPending(): boolean {
    return this.status === 'pending'
  }

  public isApproved(): boolean {
    return this.status === 'approved'
  }

  public isRejected(): boolean {
    return this.status === 'rejected'
  }

  public async approve(processedBy: number, responseMessage?: string): Promise<void> {
    this.status = 'approved'
    this.processedBy = processedBy
    this.processedAt = DateTime.now()
    this.responseMessage = responseMessage || null
    await this.save()
  }

  public async reject(processedBy: number, responseMessage: string): Promise<void> {
    this.status = 'rejected'
    this.processedBy = processedBy
    this.processedAt = DateTime.now()
    this.responseMessage = responseMessage
    await this.save()
  }

  public async cancel(): Promise<void> {
    this.status = 'cancelled'
    await this.save()
  }
}
