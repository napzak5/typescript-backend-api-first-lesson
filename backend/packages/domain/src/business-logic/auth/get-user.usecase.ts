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

export class GetUserUseCase {
  constructor(private readonly dependencies: AuthUseCaseDependencies) {}

  /** The account of any user, for an administrator. Deleted users are not found. */
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

    const found = await this.dependencies.userRepository.findById(userId.data)
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return Result.error(
        DomainErrors.notFound(entityMessages.user, userId.data),
      )
    }

    return UserReadMapper.toApiUser(found.data)
  }
}
