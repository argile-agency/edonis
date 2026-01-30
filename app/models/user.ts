import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, beforeSave, column, manyToMany } from '@adonisjs/lucid/orm'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import Role from '#models/role'
import EncryptionService from '#services/encryption_service'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare fullName: string | null

  @column()
  declare firstName: string | null

  @column()
  declare lastName: string | null

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare avatarUrl: string | null

  @column()
  declare avatarDescription: string | null

  @column()
  declare bio: string | null

  @column({
    prepare: (value: string | null) => EncryptionService.encrypt(value),
    consume: (value: string | null) => EncryptionService.decrypt(value),
  })
  declare phone: string | null

  @column({
    prepare: (value: string | null) => EncryptionService.encrypt(value),
    consume: (value: string | null) => EncryptionService.decrypt(value),
  })
  declare mobilePhone: string | null

  @column()
  declare studentId: string | null

  @column()
  declare department: string | null

  @column()
  declare organization: string | null

  @column()
  declare city: string | null

  @column()
  declare country: string | null

  @column({
    prepare: (value: string | null) => EncryptionService.encrypt(value),
    consume: (value: string | null) => EncryptionService.decrypt(value),
  })
  declare address: string | null

  @column({
    prepare: (value: string | null) => EncryptionService.encrypt(value),
    consume: (value: string | null) => EncryptionService.decrypt(value),
  })
  declare identificationNumber: string | null

  @column()
  declare webUrl: string | null

  @column()
  declare emailVisibility: string

  @column()
  declare profileVisibility: string

  @column()
  declare locale: string

  @column()
  declare timezone: string

  @column()
  declare isActive: boolean

  @column({ serializeAs: null })
  declare twoFactorSecret: string | null

  @column()
  declare twoFactorEnabled: boolean

  @column({ serializeAs: null })
  declare twoFactorRecoveryCodes: string | null

  @column.dateTime()
  declare twoFactorConfirmedAt: DateTime | null

  @column.dateTime()
  declare termsAcceptedAt: DateTime | null

  @column()
  declare termsAcceptedVersion: string | null

  @column.dateTime()
  declare lastLoginAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @beforeSave()
  static syncFullName(user: User) {
    if (user.$dirty.firstName !== undefined || user.$dirty.lastName !== undefined) {
      const parts = [user.firstName, user.lastName].filter(Boolean)
      if (parts.length > 0) {
        user.fullName = parts.join(' ')
      }
    }
  }

  // Relations
  @manyToMany(() => Role, {
    pivotTable: 'user_roles',
    pivotForeignKey: 'user_id',
    pivotRelatedForeignKey: 'role_id',
    pivotTimestamps: true,
    pivotColumns: ['course_id'], // Pour les rôles contextuels
  })
  declare roles: ManyToMany<typeof Role>

  // Helper methods
  async hasRole(roleSlug: string, _courseId?: number): Promise<boolean> {
    if (!this.roles || this.roles.length === 0) {
      await this.load('roles' as any)
    }
    return this.roles.some((role) => role.slug === roleSlug)
  }

  async hasAnyRole(roleSlugs: string[]): Promise<boolean> {
    if (!this.roles || this.roles.length === 0) {
      await this.load('roles' as any)
    }
    return this.roles.some((role) => roleSlugs.includes(role.slug))
  }

  async isAdmin(): Promise<boolean> {
    return this.hasRole('admin')
  }

  async isTeacher(): Promise<boolean> {
    return this.hasRole('teacher')
  }

  async isStudent(): Promise<boolean> {
    return this.hasRole('student')
  }

  async getRoleNames(): Promise<string[]> {
    if (!this.roles || this.roles.length === 0) {
      await this.load('roles' as any)
    }
    return this.roles.map((role) => role.name)
  }

  async updateLastLogin(): Promise<void> {
    this.lastLoginAt = DateTime.now()
    await this.save()
  }
}
