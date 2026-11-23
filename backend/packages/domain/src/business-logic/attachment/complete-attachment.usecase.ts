import { Result } from '@beauty-salon-backend/utility'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  attachmentMessages,
  entityMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { AttachmentReadMapper } from '../../mappers/read/attachment.mapper'
import {
  type ApiAttachmentResponse,
  type DbAttachment,
  parseAttachmentId,
} from '../../models/attachment'
import type { Actor } from '../../models/auth'
import type { StoredFile } from '../../services/file-storage'
import { type DomainError, DomainErrors } from '../../shared'
import { attachmentReachOf } from './_shared/authorization'
import type { AttachmentUseCaseDependencies } from './_shared/dependencies'
import { beginsAs, SIGNATURE_LENGTH, storageKeyOf } from './_shared/file-rules'

/**
 * Why what is stored is not the file that was announced; null when it is.
 * The URL of the upload is signed for the size, so a file of another size
 * is one the storage should not have taken.
 */
const refusalOf = (
  attachment: DbAttachment,
  stored: StoredFile,
): LocalizedText | null => {
  if (stored.size !== attachment.size) {
    return attachmentMessages.uploadedFileNotOfSize(attachment.size)
  }
  if (!beginsAs(attachment.contentType, stored.head)) {
    return attachmentMessages.uploadedFileNotOfType(attachment.contentType)
  }

  return null
}

export class CompleteAttachmentUseCase {
  constructor(private readonly dependencies: AttachmentUseCaseDependencies) {}

  /**
   * Completes an upload: looks at what is stored and marks the attachment
   * uploaded. The file must be there, of the size that was announced, and
   * begin as a file of the announced kind does. As long as nothing is
   * stored the attachment stays pending. A file that is not what was
   * announced ends the attachment: it is deleted first and its file
   * removed then, so that no request that looked at another file before
   * marks it uploaded. The client announces the file anew.
   *
   * An attachment that is uploaded already is answered as it is: a client
   * that lost the answer asks again.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<ApiAttachmentResponse, DomainError>> {
    const reach = attachmentReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const attachmentId = parseAttachmentId(id)
    if (attachmentId.type === 'error') {
      return attachmentId
    }
    const gone = Result.error(
      DomainErrors.notFound(entityMessages.attachment, attachmentId.data),
    )

    const { attachmentRepository, fileStorage } = this.dependencies
    const found = await attachmentRepository.findById(reach, attachmentId.data)
    if (found.type === 'error') {
      return found
    }
    const attachment = found.data
    if (attachment === null) {
      return gone
    }
    if (attachment.status === 'uploaded') {
      return AttachmentReadMapper.toApiAttachment(attachment)
    }

    const key = storageKeyOf(attachment.id)
    const stored = await fileStorage.inspect(key, SIGNATURE_LENGTH)
    if (stored.type === 'error') {
      return stored
    }
    if (stored.data === null) {
      return Result.error(
        DomainErrors.conflict(attachmentMessages.noFileUploaded),
      )
    }
    const refusal = refusalOf(attachment, stored.data)
    if (refusal !== null) {
      const deleted = await attachmentRepository.markDeleted(attachmentId.data)
      if (deleted.type === 'error') {
        return deleted
      }
      // What stays stored when this fails goes with the row at the purge.
      const removed = await fileStorage.remove(key)

      return removed.type === 'error'
        ? removed
        : Result.error(DomainErrors.conflict(refusal))
    }

    const marked = await attachmentRepository.markUploaded(attachmentId.data)
    if (marked.type === 'error') {
      return marked
    }

    return marked.data === null
      ? gone
      : AttachmentReadMapper.toApiAttachment(marked.data)
  }
}
