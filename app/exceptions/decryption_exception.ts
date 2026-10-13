import { Exception } from '@adonisjs/core/exceptions'

/**
 * Raised when an encrypted PII cell cannot be decrypted and
 * `PII_DECRYPT_STRICT` is on. The HTTP exception handler renders it as the
 * 500 status page.
 *
 * The message only names the column. It never carries the stored value,
 * ciphertext or plaintext.
 */
export default class DecryptionException extends Exception {
  static status = 500
  static code = 'E_PII_DECRYPTION_FAILED'

  constructor(column?: string) {
    super(`Unable to decrypt ${column ?? 'value'}`)
  }
}
