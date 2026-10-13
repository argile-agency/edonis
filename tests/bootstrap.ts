import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import type { Config } from '@japa/runner/types'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import { browserClient } from '@japa/browser-client'
import testUtils from '@adonisjs/core/services/test_utils'
import { authApiClient } from '@adonisjs/auth/plugins/api_client'
import { sessionApiClient } from '@adonisjs/session/plugins/api_client'
import { inertiaApiClient } from '@adonisjs/inertia/plugins/api_client'

/**
 * This file is imported by the "bin/test.ts" entrypoint file
 */

/**
 * Configure Japa plugins in the plugins array.
 * Learn more - https://japa.dev/docs/runner-config#plugins-optional
 */
export const plugins: Config['plugins'] = [
  assert(),
  apiClient(),
  pluginAdonisJS(app),
  authApiClient(app),
  sessionApiClient(app),
  inertiaApiClient(app),
  browserClient({
    runInSuites: ['browser'],
    contextOptions: {
      baseURL: 'http://localhost:3333',
    },
  }),
]

/**
 * Configure lifecycle function to run before and after all the
 * tests.
 *
 * The setup functions are executed before all the tests
 * The teardown functions are executed after all the tests
 */
export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [
    () => {
      if (process.env.NODE_ENV !== 'test') {
        throw new Error(
          `Refusing to run tests: NODE_ENV is "${process.env.NODE_ENV}", expected "test". ` +
            'Run the suites via "node ace test" so .env.test isolates the database.'
        )
      }
    },
  ],
  teardown: [],
}

/**
 * Configure suites by tapping into the test suite instance.
 * Learn more - https://japa.dev/docs/test-suites#lifecycle-hooks
 *
 * The migrate hook is scoped to the "functional" suite only: its teardown runs
 * `migration:reset` (a full schema drop), so it must never run for the
 * database-free "unit" suite.
 */
export const configureSuite: Config['configureSuite'] = (suite) => {
  if (['browser', 'functional', 'e2e'].includes(suite.name)) {
    suite.setup(() => testUtils.httpServer().start())
  }

  if (suite.name === 'functional') {
    suite.setup(() => testUtils.db().migrate())
  }
}
