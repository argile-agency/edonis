import { randomBytes } from 'node:crypto'
import * as OTPAuth from 'otpauth'
import QRCode from 'qrcode'
import encryption from '@adonisjs/core/services/encryption'
import User from '#models/user'

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
    if (!decryptedSecret) return false

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
    if (!decryptedCodes) return false

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
   * Encrypt recovery codes for storage.
   */
  static encryptRecoveryCodes(codes: string[]): string {
    return encryption.encrypt(JSON.stringify(codes))
  }
}
