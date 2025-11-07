import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'

/**
 * Validator pour la création d'un utilisateur
 */
export const createUserValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(2).maxLength(255),
    email: vine.string().trim().email().normalizeEmail(),
    password: vine.string().minLength(8).maxLength(255),
    avatarUrl: vine.string().trim().url().optional().nullable(),
    bio: vine.string().trim().maxLength(1000).optional().nullable(),
    phone: vine.string().trim().maxLength(20).optional().nullable(),
    studentId: vine.string().trim().maxLength(50).optional().nullable(),
    department: vine.string().trim().maxLength(255).optional().nullable(),
    organization: vine.string().trim().maxLength(255).optional().nullable(),
    locale: vine.string().trim().maxLength(10).optional(),
    timezone: vine.string().trim().maxLength(50).optional(),
    isActive: vine.boolean().optional(),
    roleIds: vine.array(vine.number()).optional(),
  })
)

/**
 * Validator pour la mise à jour d'un utilisateur
 */
export const updateUserValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(2).maxLength(255).optional(),
    email: vine.string().trim().email().normalizeEmail().optional(),
    password: vine.string().minLength(8).maxLength(255).optional().nullable(),
    avatarUrl: vine.string().trim().url().optional().nullable(),
    bio: vine.string().trim().maxLength(1000).optional().nullable(),
    phone: vine.string().trim().maxLength(20).optional().nullable(),
    studentId: vine.string().trim().maxLength(50).optional().nullable(),
    department: vine.string().trim().maxLength(255).optional().nullable(),
    organization: vine.string().trim().maxLength(255).optional().nullable(),
    locale: vine.string().trim().maxLength(10).optional(),
    timezone: vine.string().trim().maxLength(50).optional(),
    isActive: vine.boolean().optional(),
    roleIds: vine.array(vine.number()).optional(),
  })
)

/**
 * Validation manuelle de l'unicité de l'email
 */
export async function validateEmailUnique(email: string, excludeUserId?: number): Promise<boolean> {
  const query = db.from('users').where('email', email)

  if (excludeUserId) {
    query.whereNot('id', excludeUserId)
  }

  const user = await query.first()
  return !user
}

/**
 * Validation manuelle de l'unicité du matricule
 */
export async function validateStudentIdUnique(
  studentId: string,
  excludeUserId?: number
): Promise<boolean> {
  if (!studentId) return true

  const query = db.from('users').where('student_id', studentId)

  if (excludeUserId) {
    query.whereNot('id', excludeUserId)
  }

  const user = await query.first()
  return !user
}
