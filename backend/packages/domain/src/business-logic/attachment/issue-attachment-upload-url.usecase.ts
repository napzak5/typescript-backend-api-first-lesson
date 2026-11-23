import { Result } from '@beauty-salon-backend/utility'
import { attachmentMessages } from '@beauty-salon-shared/i18n/messages/api'
import { parseISO } from 'date-fns'
import { AttachmentReadMapper } from '../../mappers/read/attachment.mapper'
import { AttachmentWriteMapper } from '../../mappers/write/attachment.mapper'
import type { ApiAttachmentUploadUrlResponse } from '../../models/attachment'
import type { Actor } from '../../models/auth'
import { attachmentUploadUrlRequestSchema } from '../../schemas/attachment.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { attachmentReachOf, reachesFilesOf } from './_shared/authorization'
import type { AttachmentUseCaseDependencies } from './_shared/dependencies'
import { storageKeyOf, UPLOAD_URL_MINUTES } from './_shared/file-rules'

const MESSAGE = attachmentMessages.invalidAttachment

export class IssueAttachmentUploadUrlUseCase {
  constructor(private readonly dependencies: AttachmentUseCaseDependencies) {}

  /**
   * Announces a file: writes a pending attachment and issues the URL the
   * client sends the file to. The URL takes one upload, of the type and
   * the size the request states, until it runs out; the upload is
   * completed apart from it.
   *
   * Whether the actor reaches any attachment is decided before the request
   * is read; whether they reach the files of the salon the request names,
   * or those of no salon, once it is. A salon that does not exist is an
   * error of the request.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiAttachmentUploadUrlResponse, DomainError>> {
    const reach = attachmentReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const request = parseWith(attachmentUploadUrlRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const announced = AttachmentWriteMapper.fromUploadUrlRequest(
      request.data,
      actor.userId,
    )
    const { salonId } = announced
    if (!reachesFilesOf(reach, salonId)) {
      return Result.error(DomainErrors.forbidden())
    }

    const { attachmentRepository, salonRepository, fileStorage } =
      this.dependencies
    if (salonId !== null) {
      const exists = await salonRepository.exists(salonId)
      if (exists.type === 'error') {
        return exists
      }
      if (!exists.data) {
        return Result.error(
          DomainErrors.validation(MESSAGE, [
            {
              field: 'salonId',
              rule: 'not_found',
              message: 'Must name a salon',
            },
          ]),
        )
      }
    }

    const created = await attachmentRepository.create(
      announced,
      UPLOAD_URL_MINUTES,
    )
    if (created.type === 'error') {
      return created
    }
    const attachment = AttachmentReadMapper.toApiAttachment(created.data)
    if (attachment.type === 'error') {
      return attachment
    }

    // The URL works as long as the attachment says it does.
    const ticket = await fileStorage.issueUpload(
      {
        key: storageKeyOf(created.data.id),
        contentType: created.data.contentType,
        size: created.data.size,
      },
      parseISO(attachment.data.uploadExpiresAt),
    )

    return Result.map(ticket, (issued) =>
      AttachmentReadMapper.toApiUploadUrl(attachment.data, issued),
    )
  }
}
