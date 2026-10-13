import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import User from '#models/user'
import AuditService from '#services/audit_service'
import TwoFactorAdminService from '#services/two_factor_admin_service'

/**
 * node ace user:reset-2fa <email>
 *
 * Break-glass reset for when no admin can log in (for example the only admin
 * lost their authenticator and recovery codes). Requires shell access to the
 * application host. Audited with no acting user (see the AuditService call).
 * Prints the user id only, never other PII.
 */
export default class UserResetTwoFactor extends BaseCommand {
  static commandName = 'user:reset-2fa'
  static description = 'Break-glass: reset two-factor authentication for a user by email'

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'User email' })
  declare email: string

  async run() {
    const user = await User.findBy('email', this.email.toLowerCase().trim())

    if (!user) {
      this.logger.error('User not found')
      this.exitCode = 1
      return
    }

    if (!user.twoFactorEnabled) {
      this.logger.info(`2FA is not enabled for user_id=${user.id}, nothing to reset`)
      return
    }

    await TwoFactorAdminService.reset(user)

    await AuditService.log({
      userId: null,
      action: 'cli.user.2fa.reset',
      resourceType: 'User',
      resourceId: user.id,
    })

    this.logger.success(`2FA reset for user_id=${user.id}`)
  }
}
