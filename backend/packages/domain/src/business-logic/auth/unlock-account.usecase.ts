import { Result } from '@beauty-salon-backend/utility'
import {
  authMessages,
  entityMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { UserReadMapper } from '../../mappers/read/user.mapper'
import {
  type Actor,
  type ApiUserResponse,
  parseUserId,
} from '../../models/auth'
import { type DomainError, DomainErrors } from '../../shared'
import { mayAdministerAccounts } from './_shared/authorization'
import type { AuthUseCaseDependencies } from './_shared/dependencies'

export class UnlockAccountUseCase {
  constructor(private readonly dependencies: AuthUseCaseDependencies) {}

  /**
   * Lifts the lock that wrong guesses put on an account, for an
   * administrator: the user need not wait for it to run out. Not on the
   * administrator's own account: the lock also limits the guesses of
   * whoever holds a session of that account, and they must not be able to
   * lift it themselves.
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

    const { userRepository, clock } = this.dependencies
    const found = await userRepository.findById(userId.data)
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return Result.error(
        DomainErrors.notFound(entityMessages.user, userId.data),
      )
    }

    const unlocked = await userRepository.unlock(
      userId.data,
      clock().toISOString(),
    )
    if (unlocked.type === 'error') {
      return unlocked
    }
    if (unlocked.data === null) {
      return Result.error(DomainErrors.conflict(authMessages.accountNotLocked))
    }

    return UserReadMapper.toApiUser(unlocked.data)
  }
}
