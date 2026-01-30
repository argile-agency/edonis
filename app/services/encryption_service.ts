import encryption from '@adonisjs/core/services/encryption'

/**
 * Service for encrypting/decrypting PII (Personally Identifiable Information).
 * Uses AdonisJS encryption (APP_KEY) for transparent field-level encryption.
 */
export default class EncryptionService {
  /**
   * Encrypt a value. Returns null if input is null/undefined.
   */
  static encrypt(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') {
      return value as string | null
    }
    return encryption.encrypt(value)
  }

  /**
   * Decrypt a value. Returns null if input is null/undefined or decryption fails.
   */
  static decrypt(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') {
      return value as string | null
    }
    try {
      return encryption.decrypt<string>(value) ?? value
    } catch {
      // If decryption fails, return the raw value (data may not be encrypted yet)
      return value
    }
  }
}
