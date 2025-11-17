import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Assignment from '#models/assignment'
import User from '#models/user'

export default class Submission extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare assignmentId: number

  @column()
  declare studentId: number

  @column()
  declare attemptNumber: number

  @column()
  declare textContent: string | null

  @column({
    prepare: (value: any) => JSON.stringify(value),
    consume: (value: string) => JSON.parse(value),
  })
  declare fileAttachments: string[] | null

  @column()
  declare status: 'draft' | 'submitted' | 'graded' | 'returned'

  @column.dateTime()
  declare submittedAt: DateTime | null

  @column()
  declare isLate: boolean

  @column()
  declare grade: number | null

  @column()
  declare pointsEarned: number | null

  @column()
  declare gradedBy: number | null

  @column.dateTime()
  declare gradedAt: DateTime | null

  @column()
  declare feedback: string | null

  @column({
    prepare: (value: any) => JSON.stringify(value),
    consume: (value: string) => JSON.parse(value),
  })
  declare feedbackAttachments: string[] | null

  @column({
    prepare: (value: any) => JSON.stringify(value),
    consume: (value: string) => JSON.parse(value),
  })
  declare rubricScores: any | null

  @column()
  declare requiresGrading: boolean

  @column.dateTime()
  declare lastModifiedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => Assignment)
  declare assignment: BelongsTo<typeof Assignment>

  @belongsTo(() => User, {
    foreignKey: 'studentId',
  })
  declare student: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'gradedBy',
  })
  declare grader: BelongsTo<typeof User>
}
