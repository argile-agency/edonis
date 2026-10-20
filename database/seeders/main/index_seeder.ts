import { BaseSeeder } from '@adonisjs/lucid/seeders'
import app from '@adonisjs/core/services/app'

/**
 * Single entry point for `node ace db:seed` (see `seeders.paths` in
 * config/database.ts). Without it, Lucid runs every file in
 * database/seeders alphabetically, so dependent seeders (enrollments,
 * course contents, cohorts) ran before the users and courses they need.
 *
 * Keep this list in dependency order when adding a seeder.
 */
const SEEDERS = [
  () => import('../role_seeder.js'),
  () => import('../user_seeder.js'),
  () => import('../app_setting_seeder.js'),
  () => import('../menu_seeder.js'),
  () => import('../course_category_seeder.js'),
  () => import('../course_seeder.js'),
  () => import('../course_content_seeder.js'),
  () => import('../enrollment_method_seeder.js'),
  () => import('../cohort_seeder.js'),
  () => import('../student_enrollment_seeder.js'),
]

export default class IndexSeeder extends BaseSeeder {
  private async seed(loader: (typeof SEEDERS)[number]) {
    const { default: Seeder } = await loader()

    // Honour each seeder's own environment restriction, as db:seed would
    if (Seeder.environment && !Seeder.environment.includes(app.nodeEnvironment)) {
      return
    }

    await new Seeder(this.client).run()
  }

  async run() {
    for (const loader of SEEDERS) {
      await this.seed(loader)
    }
  }
}
