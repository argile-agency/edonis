import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Menu from '#models/menu'
import MenuItem from '#models/menu_item'
import MenuLocation from '#models/menu_location'

export default class extends BaseSeeder {
  async run() {
    // Créer les locations de menu (définies par l'application)
    const headerLocation = await MenuLocation.updateOrCreate(
      { location: 'header' },
      {
        location: 'header',
        description: 'Menu principal du header',
      }
    )

    const footerLocation = await MenuLocation.updateOrCreate(
      { location: 'footer' },
      {
        location: 'footer',
        description: 'Menu du pied de page',
      }
    )

    const userMenuLocation = await MenuLocation.updateOrCreate(
      { location: 'user-menu' },
      {
        location: 'user-menu',
        description: 'Menu utilisateur (dropdown)',
      }
    )

    // Créer le menu principal
    const mainMenu = await Menu.updateOrCreate(
      { slug: 'main-menu' },
      {
        name: 'Menu Principal',
        slug: 'main-menu',
        description: 'Menu de navigation principal',
      }
    )

    // Assigner le menu principal au header
    headerLocation.menuId = mainMenu.id
    await headerLocation.save()

    // Créer les items du menu principal
    await MenuItem.updateOrCreate(
      { menuId: mainMenu.id, url: '/' },
      {
        menuId: mainMenu.id,
        label: 'Accueil',
        url: '/',
        icon: 'Home',
        order: 1,
        visibility: 'public',
        isActive: true,
        target: '_self',
      }
    )

    await MenuItem.updateOrCreate(
      { menuId: mainMenu.id, url: '/courses' },
      {
        menuId: mainMenu.id,
        label: 'Cours',
        url: '/courses',
        icon: 'BookOpen',
        order: 2,
        visibility: 'public',
        isActive: true,
        target: '_self',
      }
    )

    await MenuItem.updateOrCreate(
      { menuId: mainMenu.id, url: '/dashboard' },
      {
        menuId: mainMenu.id,
        label: 'Tableau de bord',
        url: '/dashboard',
        icon: 'LayoutDashboard',
        order: 3,
        visibility: 'authenticated',
        isActive: true,
        target: '_self',
      }
    )

    // Créer le menu footer
    const footerMenu = await Menu.updateOrCreate(
      { slug: 'footer-menu' },
      {
        name: 'Menu Footer',
        slug: 'footer-menu',
        description: 'Menu du pied de page',
      }
    )

    // Assigner le menu footer
    footerLocation.menuId = footerMenu.id
    await footerLocation.save()

    // Items du footer
    await MenuItem.updateOrCreate(
      { menuId: footerMenu.id, url: '/about' },
      {
        menuId: footerMenu.id,
        label: 'À propos',
        url: '/about',
        order: 1,
        visibility: 'public',
        isActive: true,
        target: '_self',
      }
    )

    await MenuItem.updateOrCreate(
      { menuId: footerMenu.id, url: '/contact' },
      {
        menuId: footerMenu.id,
        label: 'Contact',
        url: '/contact',
        order: 2,
        visibility: 'public',
        isActive: true,
        target: '_self',
      }
    )

    await MenuItem.updateOrCreate(
      { menuId: footerMenu.id, url: '/privacy' },
      {
        menuId: footerMenu.id,
        label: 'Confidentialité',
        url: '/privacy',
        order: 3,
        visibility: 'public',
        isActive: true,
        target: '_self',
      }
    )

    // Créer le menu utilisateur
    const userMenu = await Menu.updateOrCreate(
      { slug: 'user-menu' },
      {
        name: 'Menu Utilisateur',
        slug: 'user-menu',
        description: 'Menu dropdown pour utilisateurs connectés',
      }
    )

    // Assigner le menu utilisateur
    userMenuLocation.menuId = userMenu.id
    await userMenuLocation.save()

    // Items du menu utilisateur
    await MenuItem.updateOrCreate(
      { menuId: userMenu.id, url: '/profile' },
      {
        menuId: userMenu.id,
        label: 'Mon profil',
        url: '/profile',
        icon: 'User',
        order: 1,
        visibility: 'authenticated',
        isActive: true,
        target: '_self',
      }
    )

    await MenuItem.updateOrCreate(
      { menuId: userMenu.id, url: '/settings' },
      {
        menuId: userMenu.id,
        label: 'Paramètres',
        url: '/settings',
        icon: 'Settings',
        order: 2,
        visibility: 'authenticated',
        isActive: true,
        target: '_self',
      }
    )

    await MenuItem.updateOrCreate(
      { menuId: userMenu.id, url: '/admin' },
      {
        menuId: userMenu.id,
        label: 'Administration',
        url: '/admin',
        icon: 'Shield',
        order: 3,
        visibility: 'admin',
        isActive: true,
        target: '_self',
      }
    )
  }
}
