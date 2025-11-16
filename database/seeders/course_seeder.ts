import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Course from '#models/course'
import User from '#models/user'
import { DateTime } from 'luxon'

export default class extends BaseSeeder {
  async run() {
    // Get instructor/teacher users
    const instructors = await User.query()
      .whereHas('roles', (query) => {
        query.whereIn('slug', ['instructor', 'teacher'])
      })
      .limit(3)

    if (instructors.length === 0) {
      console.log('No instructors or teachers found. Please seed users first.')
      return
    }

    // Sample courses data
    const coursesData = [
      {
        code: 'CS101',
        title: 'Introduction à la Programmation',
        description:
          'Apprenez les bases de la programmation avec Python. Ce cours couvre les concepts fondamentaux comme les variables, les boucles, les fonctions et les structures de données.',
        objectives:
          '- Comprendre les concepts de base de la programmation\n- Maîtriser la syntaxe Python\n- Résoudre des problèmes avec du code\n- Créer des programmes simples',
        instructorId: instructors[0].id,
        status: 'published' as const,
        visibility: 'public' as const,
        maxStudents: 50,
        allowEnrollment: true,
        isFeatured: true,
        startDate: DateTime.now().minus({ days: 30 }),
        endDate: DateTime.now().plus({ days: 60 }),
        level: 'Beginner',
        language: 'fr',
        estimatedHours: 40,
        tags: ['programmation', 'python', 'débutant'],
        enrolledCount: 35,
        completedCount: 5,
        averageRating: 4.5,
      },
      {
        code: 'WEB201',
        title: 'Développement Web Moderne',
        description:
          'Maîtrisez les technologies web modernes incluant HTML5, CSS3, JavaScript ES6+, React et Node.js. Créez des applications web complètes de A à Z.',
        objectives:
          '- Créer des interfaces web responsive\n- Utiliser React pour des applications interactives\n- Développer des APIs avec Node.js\n- Déployer des applications en production',
        instructorId: instructors[0].id,
        status: 'published' as const,
        visibility: 'public' as const,
        maxStudents: 40,
        allowEnrollment: true,
        isFeatured: true,
        startDate: DateTime.now().minus({ days: 15 }),
        endDate: DateTime.now().plus({ days: 75 }),
        level: 'Intermediate',
        language: 'fr',
        estimatedHours: 60,
        tags: ['web', 'react', 'javascript', 'node.js'],
        enrolledCount: 28,
        completedCount: 2,
        averageRating: 4.8,
      },
      {
        code: 'MATH101',
        title: 'Mathématiques pour Data Science',
        description:
          'Explorez les concepts mathématiques essentiels pour la data science: algèbre linéaire, calcul, probabilités et statistiques. Avec des applications pratiques en Python.',
        objectives:
          '- Comprendre les matrices et vecteurs\n- Maîtriser le calcul différentiel\n- Appliquer les probabilités et statistiques\n- Utiliser NumPy et Pandas',
        instructorId: instructors.length > 1 ? instructors[1].id : instructors[0].id,
        status: 'published' as const,
        visibility: 'public' as const,
        maxStudents: null,
        allowEnrollment: true,
        isFeatured: false,
        startDate: DateTime.now(),
        endDate: DateTime.now().plus({ days: 90 }),
        level: 'Intermediate',
        language: 'fr',
        estimatedHours: 50,
        tags: ['mathématiques', 'data science', 'python', 'statistiques'],
        enrolledCount: 42,
        completedCount: 0,
        averageRating: 4.3,
      },
      {
        code: 'AI301',
        title: 'Intelligence Artificielle Avancée',
        description:
          "Plongez dans les techniques avancées d'IA: deep learning, réseaux de neurones, NLP et computer vision. Projets pratiques avec TensorFlow et PyTorch.",
        objectives:
          "- Comprendre l'architecture des réseaux de neurones\n- Implémenter des modèles de deep learning\n- Travailler sur des projets d'IA réels\n- Optimiser et déployer des modèles",
        instructorId: instructors.length > 2 ? instructors[2].id : instructors[0].id,
        status: 'draft' as const,
        visibility: 'private' as const,
        maxStudents: 25,
        allowEnrollment: false,
        isFeatured: false,
        startDate: DateTime.now().plus({ days: 30 }),
        endDate: DateTime.now().plus({ days: 120 }),
        level: 'Advanced',
        language: 'fr',
        estimatedHours: 80,
        tags: ['ia', 'machine learning', 'deep learning', 'tensorflow'],
        enrolledCount: 0,
        completedCount: 0,
        averageRating: null,
      },
      {
        code: 'BUS101',
        title: 'Fondamentaux du Marketing Digital',
        description:
          'Découvrez les stratégies de marketing digital: SEO, SEM, réseaux sociaux, email marketing et analytics. Apprenez à créer des campagnes efficaces.',
        objectives:
          '- Comprendre le marketing digital\n- Maîtriser le SEO et le SEM\n- Gérer les réseaux sociaux professionnellement\n- Analyser les performances marketing',
        instructorId: instructors.length > 1 ? instructors[1].id : instructors[0].id,
        status: 'published' as const,
        visibility: 'public' as const,
        maxStudents: 60,
        allowEnrollment: true,
        isFeatured: true,
        startDate: DateTime.now().minus({ days: 5 }),
        endDate: DateTime.now().plus({ days: 85 }),
        level: 'Beginner',
        language: 'fr',
        estimatedHours: 35,
        tags: ['marketing', 'digital', 'seo', 'réseaux sociaux'],
        enrolledCount: 55,
        completedCount: 8,
        averageRating: 4.6,
      },
      {
        code: 'SCI201',
        title: 'Introduction à la Physique Quantique',
        description:
          "Explorez les mystères de la physique quantique: dualité onde-particule, principe d'incertitude, intrication quantique et applications modernes.",
        objectives:
          '- Comprendre les principes quantiques\n- Résoudre des problèmes de mécanique quantique\n- Découvrir les applications technologiques\n- Analyser des expériences célèbres',
        instructorId: instructors.length > 2 ? instructors[2].id : instructors[0].id,
        status: 'archived' as const,
        visibility: 'unlisted' as const,
        maxStudents: 30,
        allowEnrollment: false,
        isFeatured: false,
        startDate: DateTime.now().minus({ days: 120 }),
        endDate: DateTime.now().minus({ days: 30 }),
        level: 'Advanced',
        language: 'fr',
        estimatedHours: 70,
        tags: ['physique', 'quantique', 'science'],
        enrolledCount: 18,
        completedCount: 15,
        averageRating: 4.9,
      },
    ]

    // Create courses
    for (const courseData of coursesData) {
      const exists = await Course.findBy('code', courseData.code)
      if (!exists) {
        await Course.create(courseData)
      }
    }

    console.log('✅ Courses seeded successfully!')
  }
}
