import { Result } from '@beauty-salon-backend/utility'
import type { Actor } from '../../models/auth'
import { parseShareLinkId } from '../../models/share-link'
import { type DomainError, DomainErrors } from '../../shared'
import { shareLinkReachOf } from './_shared/authorization'
import type { ShareLinkUseCaseDependencies } from './_shared/dependencies'

export class DeleteShareLinkUseCase {
  constructor(private readonly dependencies: ShareLinkUseCaseDependencies) {}

  /**
   * Revokes a link: its row is removed, and its token opens nothing from
   * then on. A download URL the link issued before works until it runs
   * out, minutes later at most.
   */
  async execute(actor: Actor, id: unknown): Promise<Result<null, DomainError>> {
    const reach = shareLinkReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const shareLinkId = parseShareLinkId(id)
    if (shareLinkId.type === 'error') {
      return shareLinkId
    }

    const removed = await this.dependencies.shareLinkRepository.remove(
      reach,
      shareLinkId.data,
    )
    if (removed.type === 'error') {
      return removed
    }

    return removed.data
      ? Result.success(null)
      : Result.error(DomainErrors.notFound('Share link', shareLinkId.data))
  }
}
