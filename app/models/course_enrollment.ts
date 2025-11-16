import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Course from '#models/course'
import User from '#models/user'
import CourseEnrollmentMethod from '#models/course_enrollment_method'

export type CourseRole =
  | 'instructor'
  | 'teaching_assistant'
  | 'non_editing_teacher'
  | 'student'
  | 'observer'
  | 'guest'

export type EnrollmentStatus = 'active' | 'pending' | 'suspended' | 'completed' | 'expired'

export default class CourseEnrollment extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare courseId: number

  @column()
  declare userId: number

  @column()
  declare enrollmentMethodId: number | null

  @column()
  declare courseRole: CourseRole

  @column()
  declare status: EnrollmentStatus

  @column.dateTime()
  declare timeStart: DateTime | null

  @column.dateTime()
  declare timeEnd: DateTime | null

  @column()
  declare progressPercentage: number

  @column.dateTime()
  declare lastAccessAt: DateTime | null

  @column.dateTime()
  declare completedAt: DateTime | null

  @column.dateTime()
  declare enrolledAt: DateTime

  @column()
  declare enrolledBy: number | null

  @column()
  declare modifiedBy: number | null

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
    foreignKey: 'enrolledBy',
  })
  declare enrolledByUser: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'modifiedBy',
  })
  declare modifiedByUser: BelongsTo<typeof User>

  // Helper methods
  public isActive(): boolean {
    return this.status === 'active'
  }

  public isCompleted(): boolean {
    return this.status === 'completed'
  }

  public hasAccess(): boolean {
    if (!this.isActive()) return false

    const now = DateTime.now()

    if (this.timeStart && now < this.timeStart) {
      return false
    }

    if (this.timeEnd && now > this.timeEnd) {
      return false
    }

    return true
  }

  public async updateLastAccess(): Promise<void> {
    this.lastAccessAt = DateTime.now()
    await this.save()
  }

  public async updateProgress(percentage: number): Promise<void> {
    this.progressPercentage = Math.min(100, Math.max(0, percentage))

    if (this.progressPercentage >= 100 && !this.completedAt) {
      this.completedAt = DateTime.now()
      this.status = 'completed'
    }

    await this.save()
  }

  public isInstructor(): boolean {
    return this.courseRole === 'instructor'
  }

  public isTeachingAssistant(): boolean {
    return this.courseRole === 'teaching_assistant'
  }

  public isStudent(): boolean {
    return this.courseRole === 'student'
  }

  public canManageCourse(): boolean {
    return this.courseRole === 'instructor' || this.courseRole === 'teaching_assistant'
  }

  public canEditCourse(): boolean {
    return (
      this.courseRole === 'instructor' ||
      this.courseRole === 'teaching_assistant' ||
      this.courseRole === 'non_editing_teacher'
    )
  }
}
