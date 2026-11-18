import { Result } from '@beauty-salon-backend/utility'
import { parseAttachmentId } from '../../models/attachment'
import type { Actor } from '../../models/auth'
import { type DomainError, DomainErrors } from '../../shared'
import { attachmentReachOf, mayRemoveAttachment } from './_shared/authorization'
import type { AttachmentUseCaseDependencies } from './_shared/dependencies'
import { storageKeyOf } from './_shared/file-rules'

export class DeleteAttachmentUseCase {
  constructor(private readonly dependencies: AttachmentUseCaseDependencies) {}

  /**
   * Deletes an attachment: removes its file, then marks the attachment
   * deleted. When the file cannot be removed nothing changes, and the
   * request can be made again. The row stays until the purge, because the
   * URL that took the upload may still work: what it would take then is
   * removed with the row.
   *
   * Among those who reach the attachment, the administrators, the owner
   * and the managers of its salon and whoever uploaded it delete it.
   */
  async execute(actor: Actor, id: unknown): Promise<Result<null, DomainError>> {
    const reach = attachmentReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const attachmentId = parseAttachmentId(id)
    if (attachmentId.type === 'error') {
      return attachmentId
    }
    const gone = Result.error(
      DomainErrors.notFound('Attachment', attachmentId.data),
    )

    const { attachmentRepository, fileStorage } = this.dependencies
    const found = await attachmentRepository.findById(reach, attachmentId.data)
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return gone
    }
    if (!mayRemoveAttachment(actor, found.data)) {
      return Result.error(DomainErrors.forbidden())
    }

    const removed = await fileStorage.remove(storageKeyOf(found.data.id))
    if (removed.type === 'error') {
      return removed
    }
    const deleted = await attachmentRepository.markDeleted(attachmentId.data)
    if (deleted.type === 'error') {
      return deleted
    }

    return deleted.data ? Result.success(null) : gone
  }
}
