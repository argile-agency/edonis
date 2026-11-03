import AppSetting from '#models/app_setting'

export const REGISTRATION_CLOSED_MESSAGE =
  'Les inscriptions sont fermées sur cette plateforme. Contactez un administrateur pour obtenir un compte.'

/**
 * No settings row means open (matches the client fallback). Boolean() because
 * SQLite and MySQL/MariaDB read boolean columns back as 0/1.
 */
export async function isRegistrationOpen(): Promise<boolean> {
  const settings = await AppSetting.getActiveSettings()
  return !settings || Boolean(settings.allowRegistration)
}
