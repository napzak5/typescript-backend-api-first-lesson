import { Result } from '@beauty-salon-backend/utility'
import { entityMessages } from '@beauty-salon-shared/i18n/messages/api'
import { AttachmentReadMapper } from '../../mappers/read/attachment.mapper'
import {
  type ApiAttachmentResponse,
  parseAttachmentId,
} from '../../models/attachment'
import type { Actor } from '../../models/auth'
import { type DomainError, DomainErrors } from '../../shared'
import { attachmentReachOf } from './_shared/authorization'
import type { AttachmentUseCaseDependencies } from './_shared/dependencies'

export class GetAttachmentUseCase {
  constructor(private readonly dependencies: AttachmentUseCaseDependencies) {}

  /**
   * Finds an attachment the actor reaches, a pending one too. An
   * attachment of another salon is, to a member of a salon, one that does
   * not exist.
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

    const found = await this.dependencies.attachmentRepository.findById(
      reach,
      attachmentId.data,
    )
    if (found.type === 'error') {
      return found
    }

    return found.data === null
      ? Result.error(
          DomainErrors.notFound(entityMessages.attachment, attachmentId.data),
        )
      : AttachmentReadMapper.toApiAttachment(found.data)
  }
}
