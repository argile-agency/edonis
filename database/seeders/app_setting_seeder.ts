import { BaseSeeder } from '@adonisjs/lucid/seeders'
import AppSetting from '#models/app_setting'

export default class extends BaseSeeder {
  async run() {
    // firstOrCreate: never overwrite an admin's edits made on /admin/settings
    await AppSetting.firstOrCreate(
      { isActive: true },
      {
        ...AppSetting.DEFAULTS,
        welcomeMessage: "Bienvenue sur notre plateforme d'apprentissage",
        contactEmail: 'contact@edonis.org',
        announcementText: 'Environnement de démonstration — un projet pilote ? contact@edonis.org',
        socialLinks: null,
      }
    )
  }
}
