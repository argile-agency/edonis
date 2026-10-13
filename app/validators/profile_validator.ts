import vine from '@vinejs/vine'

/**
 * Validator pour la mise à jour du profil par l'utilisateur lui-même.
 * Exclut isActive et roleIds pour empêcher l'auto-escalade de privilèges.
 *
 * Note : l'avatar ne passe pas par ce validateur, voir updateAvatarValidator.
 */
export const updateProfileValidator = vine.compile(
  vine.object({
    firstName: vine.string().trim().maxLength(255).optional().nullable(),
    lastName: vine.string().trim().maxLength(255).optional().nullable(),
    email: vine.string().trim().email().normalizeEmail(),
    emailVisibility: vine.enum(['everyone', 'participants', 'private']).optional(),
    bio: vine.string().trim().maxLength(1000).optional().nullable(),
    phone: vine.string().trim().maxLength(20).optional().nullable(),
    mobilePhone: vine.string().trim().maxLength(20).optional().nullable(),
    city: vine.string().trim().maxLength(255).optional().nullable(),
    country: vine.string().trim().maxLength(2).optional().nullable(),
    address: vine.string().trim().maxLength(1000).optional().nullable(),
    timezone: vine.string().trim().maxLength(50).optional(),
    webUrl: vine.string().trim().maxLength(500).optional().nullable(),
    identificationNumber: vine.string().trim().maxLength(255).optional().nullable(),
    organization: vine.string().trim().maxLength(255).optional().nullable(),
    department: vine.string().trim().maxLength(255).optional().nullable(),
    avatarDescription: vine.string().trim().maxLength(500).optional().nullable(),
  })
)

/**
 * Validator pour le changement de mot de passe.
 * Exige le mot de passe actuel pour vérification.
 */
export const updatePasswordValidator = vine.compile(
  vine.object({
    currentPassword: vine.string(),
    newPassword: vine.string().minLength(8).maxLength(255).confirmed({
      confirmationField: 'newPasswordConfirmation',
    }),
  })
)

/**
 * Validator pour l'upload de l'avatar (mêmes limites qu'avant : 2 Mo, images uniquement).
 */
export const updateAvatarValidator = vine.compile(
  vine.object({
    avatar: vine.file({ size: '2mb', extnames: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }),
  })
)

/**
 * Validator pour la mise à jour des paramètres (page /user/settings).
 */
export const updateSettingsValidator = vine.compile(
  vine.object({
    locale: vine.string().trim().maxLength(10).optional(),
    timezone: vine.string().trim().maxLength(50).optional(),
    profileVisibility: vine.enum(['public', 'participants', 'private']).optional(),
  })
)
