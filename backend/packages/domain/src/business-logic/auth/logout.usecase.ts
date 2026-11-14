import { Result } from '@beauty-salon-backend/utility'
import type { Actor } from '../../models/auth'
import type { DomainError } from '../../shared'
import type { AuthUseCaseDependencies } from './_shared/dependencies'

export class LogoutUseCase {
  constructor(private readonly dependencies: AuthUseCaseDependencies) {}

  /**
   * Ends the session of the request by removing it, which makes both of its
   * tokens useless. A session that is already gone is as ended as one can be.
   */
  async execute(actor: Actor): Promise<Result<null, DomainError>> {
    return Result.map(
      await this.dependencies.sessionRepository.delete(actor.sessionId),
      () => null,
    )
  }
}
