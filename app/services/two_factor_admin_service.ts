import User from '#models/user'

/**
 * Privileged two-factor reset, performed on behalf of a user who lost both
 * their authenticator device and their recovery codes.
 *
 * Shared by the admin endpoint (`POST /admin/users/:id/two-factor/reset`) and
 * the break-glass CLI (`node ace user:reset-2fa <email>`). Callers own the
 * audit row: the HTTP path logs `admin.user.2fa.reset`, the CLI logs
 * `cli.user.2fa.reset`.
 *
 * Clears the same four fields as `TwoFactorController.disable`. The user must
 * enrol again from `/user/two-factor`.
 */
export default class TwoFactorAdminService {
  static async reset(user: User): Promise<void> {
    user.twoFactorSecret = null
    user.twoFactorEnabled = false
    user.twoFactorRecoveryCodes = null
    user.twoFactorConfirmedAt = null
    await user.save()
  }
}
