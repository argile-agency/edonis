import vine from '@vinejs/vine'

/**
 * Password confirmation before a destructive account action (GDPR deletion).
 */
export const passwordConfirmValidator = vine.compile(
  vine.object({
    password: vine.string().minLength(1),
  })
)
