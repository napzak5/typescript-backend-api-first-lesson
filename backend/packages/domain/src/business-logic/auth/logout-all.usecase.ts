import type { Result } from '@beauty-salon-backend/utility'
import type { Actor } from '../../models/auth'
import type { DomainError } from '../../shared'
import type { AuthUseCaseDependencies } from './_shared/dependencies'

export class LogoutAllUseCase {
  constructor(private readonly dependencies: AuthUseCaseDependencies) {}

  /** Ends every session of the actor, the one of the request included. */
  async execute(actor: Actor): Promise<Result<null, DomainError>> {
    return this.dependencies.sessionRepository.deleteAllOfUser(actor.userId)
  }
}
