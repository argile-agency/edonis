import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Cohort from '#models/cohort'
import CohortMember from '#models/cohort_member'
import User from '#models/user'

export default class extends BaseSeeder {
  async run() {
    // Clear existing cohorts
    await CohortMember.query().delete()
    await Cohort.query().delete()

    // Create cohorts
    await Cohort.create({
      name: 'Promotion 2024',
      slug: 'promotion-2024',
      description: 'Étudiants de la promotion 2024',
      cohortType: 'manual',
      isVisible: true,
      memberCount: 0,
    })

    await Cohort.create({
      name: 'Promotion 2025',
      slug: 'promotion-2025',
      description: 'Étudiants de la promotion 2025',
      cohortType: 'manual',
      isVisible: true,
      memberCount: 0,
    })

    const l1Info = await Cohort.create({
      name: 'L1 Informatique',
      slug: 'l1-informatique',
      description: 'Licence 1 Informatique',
      cohortType: 'manual',
      isVisible: true,
      memberCount: 0,
    })

    const l2Info = await Cohort.create({
      name: 'L2 Informatique',
      slug: 'l2-informatique',
      description: 'Licence 2 Informatique',
      cohortType: 'manual',
      isVisible: true,
      memberCount: 0,
    })

    const l3Info = await Cohort.create({
      name: 'L3 Informatique',
      slug: 'l3-informatique',
      description: 'Licence 3 Informatique',
      cohortType: 'manual',
      isVisible: true,
      memberCount: 0,
    })

    await Cohort.create({
      name: 'Master IA',
      slug: 'master-ia',
      description: 'Master Intelligence Artificielle',
      cohortType: 'manual',
      isVisible: true,
      memberCount: 0,
    })

    await Cohort.create({
      name: 'Double Cursus Math-Info',
      slug: 'double-cursus-math-info',
      description: 'Étudiants en double cursus Mathématiques-Informatique',
      cohortType: 'manual',
      isVisible: true,
      memberCount: 0,
    })

    // Get students to assign to cohorts
    const students = await User.query()
      .whereHas('roles', (query) => {
        query.where('name', 'student')
      })
      .limit(10)

    if (students.length > 0) {
      // Assign first 3 students to L1 Info
      for (let i = 0; i < Math.min(3, students.length); i++) {
        await CohortMember.create({
          cohortId: l1Info.id,
          userId: students[i].id,
          addedBy: null,
        })
      }

      // Assign next 3 to L2 Info
      for (let i = 3; i < Math.min(6, students.length); i++) {
        await CohortMember.create({
          cohortId: l2Info.id,
          userId: students[i].id,
          addedBy: null,
        })
      }

      // Assign remaining to L3 Info
      for (let i = 6; i < students.length; i++) {
        await CohortMember.create({
          cohortId: l3Info.id,
          userId: students[i].id,
          addedBy: null,
        })
      }

      // Update member counts
      await l1Info.updateMemberCount()
      await l2Info.updateMemberCount()
      await l3Info.updateMemberCount()
    }

    console.log('✅ Created cohorts successfully!')
  }
}
