import { Result } from '@beauty-salon-backend/utility'
import type { ApiAttachmentPurgeResponse } from '../../models/attachment'
import type { Actor } from '../../models/auth'
import { type DomainError, DomainErrors } from '../../shared'
import { mayPurgeAttachments } from './_shared/authorization'
import type { AttachmentUseCaseDependencies } from './_shared/dependencies'
import { PENDING_KEPT_HOURS, storageKeyOf } from './_shared/file-rules'

export class PurgeAttachmentsUseCase {
  constructor(private readonly dependencies: AttachmentUseCaseDependencies) {}

  /**
   * Removes what is left of the attachments that are over: those deleted,
   * once their upload URL has run out, and the uploads that were never
   * completed, a day after theirs did. The file goes first, if one is
   * stored, and then the row. At the first error it stops: what came
   * before is purged, and running it again purges the rest. Only
   * administrators run it.
   */
  async execute(
    actor: Actor,
  ): Promise<Result<ApiAttachmentPurgeResponse, DomainError>> {
    if (!mayPurgeAttachments(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const { attachmentRepository, fileStorage } = this.dependencies

    const purgeable = await attachmentRepository.purgeable(PENDING_KEPT_HOURS)
    if (purgeable.type === 'error') {
      return purgeable
    }

    let purgedCount = 0
    for (const id of purgeable.data) {
      const purged = await attachmentRepository.purge(
        id,
        PENDING_KEPT_HOURS,
        (attachment) => fileStorage.remove(storageKeyOf(attachment.id)),
      )
      if (purged.type === 'error') {
        return purged
      }
      if (purged.data.type === 'purged') {
        purgedCount += 1
      }
    }

    return Result.success({ purgedCount })
  }
}
