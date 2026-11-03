import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'
import User from '#models/user'

/**
 * Platform settings (/admin/settings).
 */
export default class PlatformSettingsPolicy extends BasePolicy {
  /**
   * Admin only in v1 (D-01): managers excluded.
   */
  async manage(user: User): Promise<AuthorizerResponse> {
    return user.hasRole('admin')
  }
}
