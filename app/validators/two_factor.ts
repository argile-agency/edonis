import vine from '@vinejs/vine'

/**
 * 6-digit TOTP code (setup confirmation and login challenge).
 */
export const tokenValidator = vine.compile(
  vine.object({
    token: vine.string().fixedLength(6),
  })
)

/**
 * Current password, required to disable 2FA.
 */
export const passwordValidator = vine.compile(
  vine.object({
    password: vine.string().minLength(1),
  })
)

/**
 * Recovery code submitted on the login challenge.
 */
export const recoveryCodeValidator = vine.compile(
  vine.object({
    recoveryCode: vine.string().minLength(1),
  })
)
