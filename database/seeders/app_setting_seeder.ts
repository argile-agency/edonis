import { BaseSeeder } from '@adonisjs/lucid/seeders'
import AppSetting from '#models/app_setting'

export default class extends BaseSeeder {
  async run() {
    // Créer les paramètres par défaut de l'application
    await AppSetting.updateOrCreate(
      { isActive: true },
      {
        appName: 'Edonis LMS',
        appLogoUrl: null,
        appFaviconUrl: null,
        primaryColor: '#5046E5',
        secondaryColor: null,
        accentColor: null,
        headerHtml: null,
        footerHtml: null,
        welcomeMessage: "Bienvenue sur notre plateforme d'apprentissage",
        heroTitle: 'Apprenez à votre rythme',
        heroSubtitle:
          'Découvrez nos cours en ligne et développez vos compétences avec une plateforme moderne et intuitive.',
        heroImageUrl: null,
        showPublicCourses: true,
        allowRegistration: true,
        showStats: true,
        contactEmail: 'support@edonis.local',
        supportUrl: null,
        socialLinks: {
          facebook: '',
          twitter: '',
          linkedin: '',
          github: '',
        },
        isActive: true,
      }
    )
  }
}
