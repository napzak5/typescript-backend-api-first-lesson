import { Result } from '@beauty-salon-backend/utility'
import { type Actor, parseSessionId } from '../../models/auth'
import { type DomainError, DomainErrors } from '../../shared'
import type { AuthUseCaseDependencies } from './_shared/dependencies'

export class RevokeSessionUseCase {
  constructor(private readonly dependencies: AuthUseCaseDependencies) {}

  /**
   * Ends one session of the actor by removing it, which makes both of its
   * tokens useless: the way to sign a lost or forgotten device out. It may
   * be the session of the request itself, which is then a logout. A session
   * of someone else is answered like one that does not exist, and so is one
   * that has ended.
   */
  async execute(actor: Actor, id: unknown): Promise<Result<null, DomainError>> {
    const sessionId = parseSessionId(id)
    if (sessionId.type === 'error') {
      return sessionId
    }

    const { sessionRepository, clock } = this.dependencies
    const deleted = await sessionRepository.deleteOfUser(
      sessionId.data,
      actor.userId,
      clock().toISOString(),
    )
    if (deleted.type === 'error') {
      return deleted
    }
    if (!deleted.data) {
      return Result.error(DomainErrors.notFound('Session', sessionId.data))
    }

    return Result.success(null)
  }
}
