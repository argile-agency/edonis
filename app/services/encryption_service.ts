import encryption from '@adonisjs/core/services/encryption'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import DecryptionException from '#exceptions/decryption_exception'

/**
 * Where a decrypted value comes from. Only used for failure reports: it is
 * logged instead of the value.
 */
export interface DecryptContext {
  column?: string
  id?: unknown
}

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
   * True when PII_DECRYPT_STRICT is on. Read on every call (never cached at
   * import) so an operator change or a test toggle takes effect immediately.
   * `env.set` stores strings, so both `true` and `'true'` count as on.
   */
  static isStrict(): boolean {
    const raw: unknown = env.get('PII_DECRYPT_STRICT')
    return raw === true || raw === 'true'
  }

  /**
   * Decrypt a value.
   *
   * - null, undefined and '' are returned as-is.
   * - Valid ciphertext returns the plaintext.
   * - Anything that does not decrypt (legacy plaintext, truncated or
   *   foreign-key ciphertext) is logged with its column, record id and
   *   length, never its content. Then:
   *   - PII_DECRYPT_STRICT on: a DecryptionException is raised.
   *   - PII_DECRYPT_STRICT unset/false (default): null is returned.
   *
   * The stored raw value is never handed back to the caller in either mode.
   */
  static decrypt(value: string | null | undefined, context?: DecryptContext): string | null {
    if (value === null || value === undefined || value === '') {
      return value as string | null
    }

    const out = encryption.decrypt<string>(value)
    if (out !== null) {
      return out
    }

    const strict = EncryptionService.isStrict()
    logger.error(
      { column: context?.column, id: context?.id, length: value.length, strict },
      'PII decryption failed'
    )
    if (strict) {
      throw new DecryptionException(context?.column)
    }
    return null
  }
}
