import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Course from '#models/course'
import CourseModule from '#models/course_module'
import CourseContent from '#models/course_content'

export default class extends BaseSeeder {
  async run() {
    // Get the first published course
    const course = await Course.query().where('status', 'published').first()

    if (!course) {
      console.log('No published courses found. Please run course seeder first.')
      return
    }

    console.log(`Adding content to course: ${course.title}`)

    // Module 1: Introduction
    const module1 = await CourseModule.create({
      courseId: course.id,
      title: 'Introduction au cours',
      description: 'Découvrez les objectifs et la structure du cours',
      order: 1,
      isPublished: true,
      estimatedTime: 30,
    })

    await CourseContent.create({
      moduleId: module1.id,
      contentType: 'page',
      title: 'Bienvenue dans le cours',
      description: 'Présentation générale du cours et de ses objectifs',
      content: `
        <h1>Bienvenue !</h1>
        <p>Nous sommes ravis de vous accueillir dans ce cours. Au cours des prochaines semaines, vous allez acquérir des compétences essentielles.</p>

        <h2>Objectifs du cours</h2>
        <ul>
          <li>Comprendre les concepts fondamentaux</li>
          <li>Appliquer les connaissances à des cas pratiques</li>
          <li>Développer des compétences professionnelles</li>
        </ul>

        <h2>Structure du cours</h2>
        <p>Le cours est organisé en modules progressifs. Chaque module contient des leçons, des vidéos et des exercices pratiques.</p>
      `,
      order: 1,
      isPublished: true,
      completionType: 'view',
      estimatedTime: 10,
    })

    await CourseContent.create({
      moduleId: module1.id,
      contentType: 'video',
      title: 'Vidéo de présentation',
      description: "Vidéo d'introduction par l'instructeur",
      externalUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      order: 2,
      isPublished: true,
      completionType: 'view',
      estimatedTime: 15,
    })

    await CourseContent.create({
      moduleId: module1.id,
      contentType: 'file',
      title: 'Plan du cours (PDF)',
      description: 'Téléchargez le plan détaillé du cours',
      fileUrl: '/files/course-plan.pdf',
      fileName: 'course-plan.pdf',
      order: 3,
      isPublished: true,
      completionType: 'manual',
      estimatedTime: 5,
    })

    // Module 2: Concepts fondamentaux
    const module2 = await CourseModule.create({
      courseId: course.id,
      title: 'Concepts fondamentaux',
      description: 'Apprenez les bases essentielles',
      order: 2,
      isPublished: true,
      estimatedTime: 120,
    })

    // Sous-module 2.1
    const subModule2Chapter1 = await CourseModule.create({
      courseId: course.id,
      parentId: module2.id,
      title: 'Chapitre 1: Les bases',
      description: 'Premiers pas avec les concepts de base',
      order: 1,
      isPublished: true,
      estimatedTime: 60,
    })

    await CourseContent.create({
      moduleId: subModule2Chapter1.id,
      contentType: 'page',
      title: 'Leçon 1: Introduction aux concepts',
      description: 'Découvrez les concepts de base',
      content: `
        <h1>Les concepts fondamentaux</h1>
        <p>Dans cette leçon, nous allons explorer les concepts de base qui constituent la fondation de tout le cours.</p>

        <h2>Concept 1: Les fondations</h2>
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>

        <h2>Concept 2: Les principes</h2>
        <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>

        <h2>Points clés à retenir</h2>
        <ul>
          <li>Point important numéro 1</li>
          <li>Point important numéro 2</li>
          <li>Point important numéro 3</li>
        </ul>
      `,
      order: 1,
      isPublished: true,
      completionRequired: true,
      completionType: 'view',
      estimatedTime: 20,
    })

    await CourseContent.create({
      moduleId: subModule2Chapter1.id,
      contentType: 'video',
      title: 'Vidéo explicative',
      description: 'Explication détaillée en vidéo',
      externalUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      order: 2,
      isPublished: true,
      completionRequired: true,
      completionType: 'view',
      estimatedTime: 25,
    })

    await CourseContent.create({
      moduleId: subModule2Chapter1.id,
      contentType: 'link',
      title: 'Ressources complémentaires',
      description: 'Articles et documentation externe',
      externalUrl: 'https://developer.mozilla.org/fr/',
      order: 3,
      isPublished: true,
      completionType: 'manual',
      estimatedTime: 15,
    })

    // Sous-module 2.2
    const subModule2Chapter2 = await CourseModule.create({
      courseId: course.id,
      parentId: module2.id,
      title: 'Chapitre 2: Applications pratiques',
      description: 'Mettez en pratique ce que vous avez appris',
      order: 2,
      isPublished: true,
      estimatedTime: 60,
    })

    await CourseContent.create({
      moduleId: subModule2Chapter2.id,
      contentType: 'page',
      title: 'Leçon 2: Exercices pratiques',
      description: 'Exercices pour mettre en pratique',
      content: `
        <h1>Exercices pratiques</h1>
        <p>Il est temps de mettre en pratique ce que vous avez appris dans les leçons précédentes.</p>

        <h2>Exercice 1</h2>
        <p>Réalisez la tâche suivante en appliquant les concepts appris...</p>

        <h2>Exercice 2</h2>
        <p>Créez un exemple pratique qui démontre votre compréhension...</p>

        <h2>Correction</h2>
        <p>Vous trouverez la correction dans la prochaine section.</p>
      `,
      order: 1,
      isPublished: true,
      completionRequired: true,
      completionType: 'view',
      estimatedTime: 30,
    })

    await CourseContent.create({
      moduleId: subModule2Chapter2.id,
      contentType: 'assignment',
      title: 'Devoir 1: Premier projet',
      description: 'Soumettez votre premier projet pratique',
      content: `
        <h1>Instructions du devoir</h1>
        <p>Créez un projet qui démontre votre compréhension des concepts suivants:</p>
        <ul>
          <li>Concept 1</li>
          <li>Concept 2</li>
          <li>Concept 3</li>
        </ul>
        <p><strong>Date limite:</strong> 2 semaines après le début du cours</p>
        <p><strong>Points:</strong> 100</p>
      `,
      order: 2,
      isPublished: true,
      completionRequired: true,
      completionType: 'submit',
      maxPoints: 100,
      estimatedTime: 120,
    })

    // Module 3: Concepts avancés
    const module3 = await CourseModule.create({
      courseId: course.id,
      title: 'Concepts avancés',
      description: 'Approfondissez vos connaissances',
      order: 3,
      isPublished: true,
      estimatedTime: 180,
    })

    await CourseContent.create({
      moduleId: module3.id,
      contentType: 'page',
      title: 'Techniques avancées',
      description: 'Explorez des techniques plus poussées',
      content: `
        <h1>Techniques avancées</h1>
        <p>Maintenant que vous maîtrisez les bases, explorons des techniques plus avancées.</p>

        <h2>Technique 1: Optimisation</h2>
        <p>Apprenez à optimiser vos processus pour une meilleure efficacité.</p>

        <h2>Technique 2: Cas complexes</h2>
        <p>Découvrez comment gérer des situations complexes.</p>
      `,
      order: 1,
      isPublished: true,
      completionType: 'view',
      estimatedTime: 45,
    })

    await CourseContent.create({
      moduleId: module3.id,
      contentType: 'quiz',
      title: 'Quiz final',
      description: 'Testez vos connaissances',
      content: 'Quiz interactif (à implémenter)',
      order: 2,
      isPublished: true,
      completionRequired: true,
      completionType: 'grade',
      maxPoints: 50,
      estimatedTime: 30,
    })

    // Module 4: Conclusion (draft)
    const module4 = await CourseModule.create({
      courseId: course.id,
      title: 'Conclusion et projet final',
      description: 'Projet de fin de cours',
      order: 4,
      isPublished: false,
      estimatedTime: 240,
    })

    await CourseContent.create({
      moduleId: module4.id,
      contentType: 'page',
      title: 'Instructions du projet final',
      description: 'Détails du projet final',
      content: `
        <h1>Projet final</h1>
        <p>Le projet final est l'occasion de démontrer toutes les compétences acquises.</p>
      `,
      order: 1,
      isPublished: false,
      completionType: 'submit',
      estimatedTime: 240,
    })

    console.log('✅ Course content seeded successfully!')
    console.log(`   - Created 4 modules with sub-modules`)
    console.log(`   - Created 13 content items of various types`)
    console.log(`   - Mix of published and draft content`)
  }
}
