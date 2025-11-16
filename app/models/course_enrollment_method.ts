import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Course from '#models/course'
import CourseGroup from '#models/course_group'
import CourseEnrollment from '#models/course_enrollment'

export type EnrollmentMethodType = 'manual' | 'self' | 'key' | 'approval' | 'bulk' | 'cohort'
export type CourseRole =
  | 'instructor'
  | 'teaching_assistant'
  | 'non_editing_teacher'
  | 'student'
  | 'observer'
  | 'guest'

export default class CourseEnrollmentMethod extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare courseId: number

  @column()
  declare methodType: EnrollmentMethodType

  @column()
  declare isEnabled: boolean

  @column()
  declare sortOrder: number

  @column()
  declare name: string | null

  @column()
  declare maxEnrollments: number | null

  @column()
  declare currentEnrollments: number

  @column()
  declare defaultRole: CourseRole

  @column.dateTime()
  declare enrollmentStartDate: DateTime | null

  @column.dateTime()
  declare enrollmentEndDate: DateTime | null

  @column()
  declare enrollmentDurationDays: number | null

  @column()
  declare enrollmentKey: string | null

  @column()
  declare keyCaseSensitive: boolean

  @column()
  declare requiresApproval: boolean

  @column()
  declare approvalMessage: string | null

  @column()
  declare welcomeMessage: string | null

  @column()
  declare autoAssignGroupId: number | null

  @column()
  declare sendWelcomeEmail: boolean

  @column()
  declare notifyInstructor: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => Course)
  declare course: BelongsTo<typeof Course>

  @belongsTo(() => CourseGroup, {
    foreignKey: 'autoAssignGroupId',
  })
  declare autoAssignGroup: BelongsTo<typeof CourseGroup>

  @hasMany(() => CourseEnrollment, {
    foreignKey: 'enrollmentMethodId',
  })
  declare enrollments: HasMany<typeof CourseEnrollment>

  // Helper methods
  public isAvailable(): boolean {
    if (!this.isEnabled) return false

    const now = DateTime.now()

    if (this.enrollmentStartDate && now < this.enrollmentStartDate) {
      return false
    }

    if (this.enrollmentEndDate && now > this.enrollmentEndDate) {
      return false
    }

    if (this.maxEnrollments !== null && this.currentEnrollments >= this.maxEnrollments) {
      return false
    }

    return true
  }

  public validateKey(key: string): boolean {
    if (!this.enrollmentKey) return false

    if (this.keyCaseSensitive) {
      return key === this.enrollmentKey
    }

    return key.toLowerCase() === this.enrollmentKey.toLowerCase()
  }

  public canEnroll(): boolean {
    return this.isAvailable()
  }
}
