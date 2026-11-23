import { Result } from '@beauty-salon-backend/utility'
import { entityMessages } from '@beauty-salon-shared/i18n/messages/api'
import { UserReadMapper } from '../../mappers/read/user.mapper'
import {
  type Actor,
  type ApiUserResponse,
  parseUserId,
} from '../../models/auth'
import { type DomainError, DomainErrors } from '../../shared'
import { mayAdministerAccounts } from './_shared/authorization'
import type { AuthUseCaseDependencies } from './_shared/dependencies'
import { twoFactorResetMail } from './_shared/mails'

export class ResetTwoFactorUseCase {
  constructor(private readonly dependencies: AuthUseCaseDependencies) {}

  /**
   * Turns two-factor authentication of a user off, for an administrator:
   * the way back for a user who lost both the authenticator app and the
   * backup codes, and so cannot turn it off themselves. The secret and the
   * backup codes are forgotten, and the user is told by mail. Not on the
   * administrator's own account: that would take the second factor off
   * with a session alone.
   *
   * Making sure that the person who asks for it is the user is up to the
   * administrator; nothing here can check it.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<ApiUserResponse, DomainError>> {
    if (!mayAdministerAccounts(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const userId = parseUserId(id)
    if (userId.type === 'error') {
      return userId
    }
    if (userId.data === actor.userId) {
      return Result.error(DomainErrors.forbidden())
    }

    const { userRepository, mailer } = this.dependencies
    const found = await userRepository.findById(userId.data)
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return Result.error(
        DomainErrors.notFound(entityMessages.user, userId.data),
      )
    }

    const disabled = await userRepository.disableTwoFactor(userId.data)
    if (disabled.type === 'error') {
      return disabled
    }
    if (!disabled.data) {
      return Result.error(
        DomainErrors.conflict('Two-factor authentication is not enabled'),
      )
    }
    mailer.deliver(twoFactorResetMail(found.data.email))

    const changed = await userRepository.findById(userId.data)
    if (changed.type === 'error') {
      return changed
    }
    if (changed.data === null) {
      return Result.error(
        DomainErrors.notFound(entityMessages.user, userId.data),
      )
    }

    return UserReadMapper.toApiUser(changed.data)
  }
}
