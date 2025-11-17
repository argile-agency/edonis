import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Course from '#models/course'
import CourseModule from '#models/course_module'
import GradeCategory from '#models/grade_category'
import Submission from '#models/submission'

export default class Assignment extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare courseId: number

  @column()
  declare moduleId: number | null

  @column()
  declare title: string

  @column()
  declare description: string | null

  @column()
  declare instructions: string | null

  @column()
  declare assignmentType: 'essay' | 'file_upload' | 'online_text' | 'offline'

  @column()
  declare maxPoints: number

  @column()
  declare maxFileSize: number | null

  @column()
  declare allowedFileTypes: string | null

  @column()
  declare maxFiles: number

  @column.dateTime()
  declare availableFrom: DateTime | null

  @column.dateTime()
  declare dueDate: DateTime | null

  @column.dateTime()
  declare cutOffDate: DateTime | null

  @column()
  declare gradeCategoryId: number | null

  @column()
  declare useRubric: boolean

  @column({
    prepare: (value: any) => JSON.stringify(value),
    consume: (value: string) => JSON.parse(value),
  })
  declare rubricData: any | null

  @column()
  declare gradingType: 'points' | 'percentage' | 'letter' | 'pass_fail'

  @column()
  declare passingGrade: number | null

  @column()
  declare allowLateSubmissions: boolean

  @column()
  declare latePenaltyPercent: number | null

  @column()
  declare maxAttempts: number

  @column()
  declare requireSubmissionStatement: boolean

  @column()
  declare isPublished: boolean

  @column()
  declare position: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => Course)
  declare course: BelongsTo<typeof Course>

  @belongsTo(() => CourseModule)
  declare module: BelongsTo<typeof CourseModule>

  @belongsTo(() => GradeCategory)
  declare gradeCategory: BelongsTo<typeof GradeCategory>

  @hasMany(() => Submission)
  declare submissions: HasMany<typeof Submission>
}
