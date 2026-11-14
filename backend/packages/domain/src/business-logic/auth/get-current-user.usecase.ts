import { Result } from '@beauty-salon-backend/utility'
import { UserReadMapper } from '../../mappers/read/user.mapper'
import type { Actor, ApiUserResponse } from '../../models/auth'
import { type DomainError, DomainErrors } from '../../shared'
import type { AuthUseCaseDependencies } from './_shared/dependencies'

export class GetCurrentUserUseCase {
  constructor(private readonly dependencies: AuthUseCaseDependencies) {}

  /**
   * The user behind the actor. A user deleted since the request was
   * authenticated has no session any more.
   */
  async execute(actor: Actor): Promise<Result<ApiUserResponse, DomainError>> {
    const found = await this.dependencies.userRepository.findById(actor.userId)
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return Result.error(DomainErrors.unauthenticated('invalidToken'))
    }

    return UserReadMapper.toApiUser(found.data)
  }
}
