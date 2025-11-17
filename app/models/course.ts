import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import CoursePermission from '#models/course_permission'
import CourseCategory from '#models/course_category'
import CourseGrouping from '#models/course_grouping'
import CourseGroup from '#models/course_group'
import CourseEnrollmentMethod from '#models/course_enrollment_method'
import CourseEnrollment from '#models/course_enrollment'
import CourseModule from '#models/course_module'

export default class Course extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  // Basic information
  @column()
  declare code: string

  @column()
  declare title: string

  @column()
  declare description: string | null

  @column()
  declare objectives: string | null

  // Instructor/Owner
  @column()
  declare instructorId: number

  // Course settings
  @column()
  declare status: 'draft' | 'published' | 'archived'

  @column()
  declare visibility: 'public' | 'private' | 'unlisted'

  @column()
  declare maxStudents: number | null

  @column()
  declare allowEnrollment: boolean

  @column()
  declare isFeatured: boolean

  // Scheduling
  @column.date()
  declare startDate: DateTime | null

  @column.date()
  declare endDate: DateTime | null

  // Media
  @column()
  declare thumbnailUrl: string | null

  @column()
  declare coverImageUrl: string | null

  // Metadata
  @column()
  declare categoryId: number | null

  @column()
  declare level: string | null

  @column()
  declare language: string

  @column()
  declare estimatedHours: number | null

  @column({
    prepare: (value: string[] | null) => (value ? JSON.stringify(value) : null),
  })
  declare tags: string[] | null

  // Statistics
  @column()
  declare enrolledCount: number

  @column()
  declare completedCount: number

  @column()
  declare averageRating: number | null

  // Timestamps
  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @column.dateTime()
  declare publishedAt: DateTime | null

  @column.dateTime()
  declare archivedAt: DateTime | null

  // Approval workflow
  @column()
  declare approvalStatus: 'draft' | 'pending_approval' | 'approved' | 'rejected'

  @column()
  declare approvedBy: number | null

  @column.dateTime()
  declare approvedAt: DateTime | null

  @column.dateTime()
  declare submittedForApprovalAt: DateTime | null

  @column()
  declare rejectionReason: string | null

  // Relationships
  @belongsTo(() => User, {
    foreignKey: 'instructorId',
  })
  declare instructor: BelongsTo<typeof User>

  @belongsTo(() => CourseCategory, {
    foreignKey: 'categoryId',
  })
  declare courseCategory: BelongsTo<typeof CourseCategory>

  @belongsTo(() => User, {
    foreignKey: 'approvedBy',
  })
  declare approver: BelongsTo<typeof User>

  @hasMany(() => CoursePermission, {
    foreignKey: 'courseId',
  })
  declare permissions: HasMany<typeof CoursePermission>

  @hasMany(() => CourseGrouping, {
    foreignKey: 'courseId',
  })
  declare groupings: HasMany<typeof CourseGrouping>

  @hasMany(() => CourseGroup, {
    foreignKey: 'courseId',
  })
  declare groups: HasMany<typeof CourseGroup>

  @hasMany(() => CourseEnrollmentMethod, {
    foreignKey: 'courseId',
  })
  declare enrollmentMethods: HasMany<typeof CourseEnrollmentMethod>

  @hasMany(() => CourseEnrollment, {
    foreignKey: 'courseId',
  })
  declare enrollments: HasMany<typeof CourseEnrollment>

  @hasMany(() => CourseModule, {
    foreignKey: 'courseId',
  })
  declare modules: HasMany<typeof CourseModule>

  // Helper methods
  public async isInstructor(userId: number): Promise<boolean> {
    return this.instructorId === userId
  }

  public async hasPermission(
    userId: number,
    requiredLevel: 'view' | 'edit' | 'manage'
  ): Promise<boolean> {
    // Owner has all permissions
    if (this.instructorId === userId) {
      return true
    }

    const permission = await CoursePermission.query()
      .where('course_id', this.id)
      .where('user_id', userId)
      .first()

    if (!permission) {
      return false
    }

    const levels = ['view', 'edit', 'manage']
    const userLevelIndex = levels.indexOf(permission.permissionLevel)
    const requiredLevelIndex = levels.indexOf(requiredLevel)

    return userLevelIndex >= requiredLevelIndex
  }

  public async publish(): Promise<void> {
    this.status = 'published'
    this.publishedAt = DateTime.now()
    await this.save()
  }

  public async archive(): Promise<void> {
    this.status = 'archived'
    this.archivedAt = DateTime.now()
    await this.save()
  }

  public isPublished(): boolean {
    return this.status === 'published'
  }

  public isArchived(): boolean {
    return this.status === 'archived'
  }

  public isDraft(): boolean {
    return this.status === 'draft'
  }

  // Approval workflow methods
  public async submitForApproval(): Promise<void> {
    this.approvalStatus = 'pending_approval'
    this.submittedForApprovalAt = DateTime.now()
    await this.save()
  }

  public async approve(approvedBy: number): Promise<void> {
    this.approvalStatus = 'approved'
    this.approvedBy = approvedBy
    this.approvedAt = DateTime.now()
    this.rejectionReason = null
    await this.save()
  }

  public async reject(rejectedBy: number, reason: string): Promise<void> {
    this.approvalStatus = 'rejected'
    this.approvedBy = rejectedBy
    this.approvedAt = DateTime.now()
    this.rejectionReason = reason
    await this.save()
  }

  public isApproved(): boolean {
    return this.approvalStatus === 'approved'
  }

  public isPendingApproval(): boolean {
    return this.approvalStatus === 'pending_approval'
  }

  public isRejected(): boolean {
    return this.approvalStatus === 'rejected'
  }

  // Check if enrollment is open
  public canEnroll(): boolean {
    if (!this.allowEnrollment || this.status !== 'published') {
      return false
    }

    if (this.maxStudents && this.enrolledCount >= this.maxStudents) {
      return false
    }

    const now = DateTime.now()
    if (this.startDate && DateTime.fromJSDate(this.startDate as any) > now) {
      return false
    }

    if (this.endDate && DateTime.fromJSDate(this.endDate as any) < now) {
      return false
    }

    return true
  }

  // Serialize for JSON responses
  public serialize() {
    return {
      id: this.id,
      code: this.code,
      title: this.title,
      description: this.description,
      objectives: this.objectives,
      instructorId: this.instructorId,
      status: this.status,
      visibility: this.visibility,
      maxStudents: this.maxStudents,
      allowEnrollment: this.allowEnrollment,
      isFeatured: this.isFeatured,
      startDate: this.startDate?.toISODate(),
      endDate: this.endDate?.toISODate(),
      thumbnailUrl: this.thumbnailUrl,
      coverImageUrl: this.coverImageUrl,
      categoryId: this.categoryId,
      level: this.level,
      language: this.language,
      estimatedHours: this.estimatedHours,
      tags: this.tags,
      enrolledCount: this.enrolledCount,
      completedCount: this.completedCount,
      averageRating: this.averageRating,
      createdAt: this.createdAt.toISO(),
      updatedAt: this.updatedAt?.toISO(),
      publishedAt: this.publishedAt?.toISO(),
      archivedAt: this.archivedAt?.toISO(),
      approvalStatus: this.approvalStatus,
      approvedBy: this.approvedBy,
      approvedAt: this.approvedAt?.toISO(),
      submittedForApprovalAt: this.submittedForApprovalAt?.toISO(),
      rejectionReason: this.rejectionReason,
      canEnroll: this.canEnroll(),
      instructor: this.instructor?.serialize(),
      courseCategory: this.courseCategory?.serialize(),
    }
  }
}
