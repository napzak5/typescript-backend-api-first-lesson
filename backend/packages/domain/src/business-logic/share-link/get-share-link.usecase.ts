import { Result } from '@beauty-salon-backend/utility'
import { ShareLinkReadMapper } from '../../mappers/read/share-link.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiShareLinkResponse,
  parseShareLinkId,
} from '../../models/share-link'
import { type DomainError, DomainErrors } from '../../shared'
import { shareLinkReachOf } from './_shared/authorization'
import type { ShareLinkUseCaseDependencies } from './_shared/dependencies'

export class GetShareLinkUseCase {
  constructor(private readonly dependencies: ShareLinkUseCaseDependencies) {}

  /**
   * Reads one link, also one that has run out or issued every download it
   * may. The link of an attachment the actor does not reach, and of one
   * that was deleted, is one that does not exist.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<ApiShareLinkResponse, DomainError>> {
    const reach = shareLinkReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const shareLinkId = parseShareLinkId(id)
    if (shareLinkId.type === 'error') {
      return shareLinkId
    }

    const found = await this.dependencies.shareLinkRepository.findById(
      reach,
      shareLinkId.data,
    )
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return Result.error(DomainErrors.notFound('Share link', shareLinkId.data))
    }

    return ShareLinkReadMapper.toApiShareLink(found.data)
  }
}
