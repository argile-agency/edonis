import { BaseSeeder } from '@adonisjs/lucid/seeders'
import CourseCategory from '#models/course_category'

export default class extends BaseSeeder {
  async run() {
    // Clear existing categories
    await CourseCategory.query().delete()

    // Create root categories
    const sciences = await CourseCategory.create({
      name: 'Sciences',
      slug: 'sciences',
      description: 'Sciences fondamentales et appliquées',
      sortOrder: 1,
      depth: 0,
      path: '/sciences',
      isVisible: true,
      icon: 'Atom',
      color: '#3b82f6',
    })

    const humanities = await CourseCategory.create({
      name: 'Sciences Humaines',
      slug: 'sciences-humaines',
      description: 'Sciences sociales et humaines',
      sortOrder: 2,
      depth: 0,
      path: '/sciences-humaines',
      isVisible: true,
      icon: 'Users',
      color: '#8b5cf6',
    })

    const business = await CourseCategory.create({
      name: 'Commerce et Gestion',
      slug: 'commerce-gestion',
      description: 'Business, économie et management',
      sortOrder: 3,
      depth: 0,
      path: '/commerce-gestion',
      isVisible: true,
      icon: 'Briefcase',
      color: '#10b981',
    })

    const arts = await CourseCategory.create({
      name: 'Arts et Créativité',
      slug: 'arts-creativite',
      description: 'Arts, design et création',
      sortOrder: 4,
      depth: 0,
      path: '/arts-creativite',
      isVisible: true,
      icon: 'Palette',
      color: '#f59e0b',
    })

    const tech = await CourseCategory.create({
      name: 'Technologies',
      slug: 'technologies',
      description: 'Informatique, programmation et technologies',
      sortOrder: 5,
      depth: 0,
      path: '/technologies',
      isVisible: true,
      icon: 'Laptop',
      color: '#06b6d4',
    })

    // Sciences sub-categories
    await CourseCategory.createMany([
      {
        name: 'Mathématiques',
        slug: 'mathematiques',
        description: 'Algèbre, analyse, géométrie',
        parentId: sciences.id,
        sortOrder: 1,
        depth: 1,
        path: '/sciences/mathematiques',
        isVisible: true,
        icon: 'Calculator',
        color: '#3b82f6',
      },
      {
        name: 'Physique',
        slug: 'physique',
        description: 'Physique fondamentale et appliquée',
        parentId: sciences.id,
        sortOrder: 2,
        depth: 1,
        path: '/sciences/physique',
        isVisible: true,
        icon: 'Zap',
        color: '#3b82f6',
      },
      {
        name: 'Chimie',
        slug: 'chimie',
        description: 'Chimie organique et inorganique',
        parentId: sciences.id,
        sortOrder: 3,
        depth: 1,
        path: '/sciences/chimie',
        isVisible: true,
        icon: 'TestTube',
        color: '#3b82f6',
      },
      {
        name: 'Biologie',
        slug: 'biologie',
        description: 'Sciences de la vie',
        parentId: sciences.id,
        sortOrder: 4,
        depth: 1,
        path: '/sciences/biologie',
        isVisible: true,
        icon: 'Microscope',
        color: '#3b82f6',
      },
    ])

    // Technologies sub-categories
    await CourseCategory.createMany([
      {
        name: 'Programmation',
        slug: 'programmation',
        description: 'Langages de programmation',
        parentId: tech.id,
        sortOrder: 1,
        depth: 1,
        path: '/technologies/programmation',
        isVisible: true,
        icon: 'Code',
        color: '#06b6d4',
      },
      {
        name: 'Développement Web',
        slug: 'developpement-web',
        description: 'Frontend, backend, full-stack',
        parentId: tech.id,
        sortOrder: 2,
        depth: 1,
        path: '/technologies/developpement-web',
        isVisible: true,
        icon: 'Globe',
        color: '#06b6d4',
      },
      {
        name: 'Data Science',
        slug: 'data-science',
        description: 'Analyse de données et machine learning',
        parentId: tech.id,
        sortOrder: 3,
        depth: 1,
        path: '/technologies/data-science',
        isVisible: true,
        icon: 'BarChart',
        color: '#06b6d4',
      },
      {
        name: 'Cybersécurité',
        slug: 'cybersecurite',
        description: 'Sécurité informatique',
        parentId: tech.id,
        sortOrder: 4,
        depth: 1,
        path: '/technologies/cybersecurite',
        isVisible: true,
        icon: 'Shield',
        color: '#06b6d4',
      },
    ])

    // Business sub-categories
    await CourseCategory.createMany([
      {
        name: 'Management',
        slug: 'management',
        description: 'Gestion et leadership',
        parentId: business.id,
        sortOrder: 1,
        depth: 1,
        path: '/commerce-gestion/management',
        isVisible: true,
        icon: 'Target',
        color: '#10b981',
      },
      {
        name: 'Marketing',
        slug: 'marketing',
        description: 'Marketing digital et traditionnel',
        parentId: business.id,
        sortOrder: 2,
        depth: 1,
        path: '/commerce-gestion/marketing',
        isVisible: true,
        icon: 'TrendingUp',
        color: '#10b981',
      },
      {
        name: 'Finance',
        slug: 'finance',
        description: 'Finance et comptabilité',
        parentId: business.id,
        sortOrder: 3,
        depth: 1,
        path: '/commerce-gestion/finance',
        isVisible: true,
        icon: 'DollarSign',
        color: '#10b981',
      },
    ])

    // Humanities sub-categories
    await CourseCategory.createMany([
      {
        name: 'Psychologie',
        slug: 'psychologie',
        description: 'Psychologie et comportement humain',
        parentId: humanities.id,
        sortOrder: 1,
        depth: 1,
        path: '/sciences-humaines/psychologie',
        isVisible: true,
        icon: 'Brain',
        color: '#8b5cf6',
      },
      {
        name: 'Histoire',
        slug: 'histoire',
        description: 'Histoire et civilisations',
        parentId: humanities.id,
        sortOrder: 2,
        depth: 1,
        path: '/sciences-humaines/histoire',
        isVisible: true,
        icon: 'BookOpen',
        color: '#8b5cf6',
      },
      {
        name: 'Philosophie',
        slug: 'philosophie',
        description: 'Philosophie et éthique',
        parentId: humanities.id,
        sortOrder: 3,
        depth: 1,
        path: '/sciences-humaines/philosophie',
        isVisible: true,
        icon: 'Lightbulb',
        color: '#8b5cf6',
      },
    ])

    // Arts sub-categories
    await CourseCategory.createMany([
      {
        name: 'Design Graphique',
        slug: 'design-graphique',
        description: 'Design visuel et graphisme',
        parentId: arts.id,
        sortOrder: 1,
        depth: 1,
        path: '/arts-creativite/design-graphique',
        isVisible: true,
        icon: 'Pen',
        color: '#f59e0b',
      },
      {
        name: 'Photographie',
        slug: 'photographie',
        description: 'Photo et vidéo',
        parentId: arts.id,
        sortOrder: 2,
        depth: 1,
        path: '/arts-creativite/photographie',
        isVisible: true,
        icon: 'Camera',
        color: '#f59e0b',
      },
      {
        name: 'Musique',
        slug: 'musique',
        description: 'Théorie musicale et pratique',
        parentId: arts.id,
        sortOrder: 3,
        depth: 1,
        path: '/arts-creativite/musique',
        isVisible: true,
        icon: 'Music',
        color: '#f59e0b',
      },
    ])

    console.log('✅ Created course categories successfully!')
  }
}
