import { randomBytes } from 'node:crypto'
import * as OTPAuth from 'otpauth'
import QRCode from 'qrcode'
import encryption from '@adonisjs/core/services/encryption'
import logger from '@adonisjs/core/services/logger'
import User from '#models/user'
import AuditService from '#services/audit_service'

export default class TwoFactorService {
  /**
   * Generate a new TOTP secret and QR code for the user.
   */
  static async generateSecret(user: User) {
    const totp = new OTPAuth.TOTP({
      issuer: 'Edonis LMS',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: new OTPAuth.Secret({ size: 20 }),
    })

    const otpauthUrl = totp.toString()
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl)

    // Encrypt the secret before storage
    const encryptedSecret = encryption.encrypt(totp.secret.base32)

    return {
      secret: encryptedSecret,
      otpauthUrl,
      qrCodeDataUrl,
    }
  }

  /**
   * Verify a TOTP token against the user's stored secret.
   */
  static verifyToken(user: User, token: string): boolean {
    if (!user.twoFactorSecret) return false

    const decryptedSecret = encryption.decrypt<string>(user.twoFactorSecret)
    if (!decryptedSecret) {
      // verifyToken is synchronous: report fire-and-forget. The report never rejects.
      void TwoFactorService.reportDecryptFailure(user.id, 'secret')
      return false
    }

    const totp = new OTPAuth.TOTP({
      issuer: 'Edonis LMS',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(decryptedSecret),
    })

    const delta = totp.validate({ token, window: 1 })
    return delta !== null
  }

  /**
   * Generate 10 random recovery codes.
   */
  static generateRecoveryCodes(): string[] {
    const codes: string[] = []
    for (let i = 0; i < 10; i++) {
      const code = randomBytes(4).toString('hex').toUpperCase()
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`)
    }
    return codes
  }

  /**
   * Verify and consume a recovery code.
   * Returns true if the code was valid and consumed.
   */
  static async verifyRecoveryCode(user: User, code: string): Promise<boolean> {
    if (!user.twoFactorRecoveryCodes) return false

    const decryptedCodes = encryption.decrypt<string>(user.twoFactorRecoveryCodes)
    if (!decryptedCodes) {
      await TwoFactorService.reportDecryptFailure(user.id, 'recovery_codes')
      return false
    }

    const codes: string[] = JSON.parse(decryptedCodes)
    const normalizedCode = code.toUpperCase().trim()
    const index = codes.indexOf(normalizedCode)

    if (index === -1) return false

    // Remove the used code
    codes.splice(index, 1)
    user.twoFactorRecoveryCodes = encryption.encrypt(JSON.stringify(codes))
    await user.save()

    return true
  }

  /**
   * Logs and audits a 2FA secret / recovery-code decryption failure (for
   * example after an APP_KEY rotation). Only the user id and the field name
   * are recorded, never the stored value. Independent of PII_DECRYPT_STRICT:
   * the 2FA check always fails closed.
   *
   * Never rejects: an audit write error is logged and swallowed, so callers
   * can fire it without awaiting.
   */
  private static async reportDecryptFailure(
    userId: number,
    field: 'secret' | 'recovery_codes'
  ): Promise<void> {
    logger.error({ userId, field }, '2FA decryption failed')
    try {
      await AuditService.log({
        userId,
        action: 'user.2fa.decrypt_failed',
        resourceType: 'User',
        resourceId: userId,
        metadata: { field },
      })
    } catch (error) {
      logger.error(
        { userId, field, error: (error as Error).message },
        '2FA decryption failure audit write failed'
      )
    }
  }

  /**
   * Encrypt recovery codes for storage.
   */
  static encryptRecoveryCodes(codes: string[]): string {
    return encryption.encrypt(JSON.stringify(codes))
  }
}
