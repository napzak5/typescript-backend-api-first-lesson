import { Result } from '@beauty-salon-backend/utility'
import {
  attachmentMessages,
  entityMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { addMinutes } from 'date-fns'
import { AttachmentReadMapper } from '../../mappers/read/attachment.mapper'
import { AttachmentWriteMapper } from '../../mappers/write/attachment.mapper'
import {
  type ApiAttachmentDownloadUrlResponse,
  parseAttachmentId,
} from '../../models/attachment'
import type { Actor } from '../../models/auth'
import { attachmentDownloadUrlRequestSchema } from '../../schemas/attachment.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { attachmentReachOf } from './_shared/authorization'
import type { AttachmentUseCaseDependencies } from './_shared/dependencies'
import {
  contentDispositionOf,
  DOWNLOAD_URL_MINUTES,
  storageKeyOf,
} from './_shared/file-rules'

export class IssueAttachmentDownloadUrlUseCase {
  constructor(private readonly dependencies: AttachmentUseCaseDependencies) {}

  /**
   * Issues a URL that downloads the file of an uploaded attachment for a
   * short while: saved under the name it was uploaded with, or shown in
   * the browser when the request asks for that. The file is answered as
   * the kind the attachment is of, whatever the storage holds as its
   * type.
   *
   * The query arrives as the caller decoded it: whether the actor reaches
   * any attachment and whether the ID is one are decided before it is
   * looked at.
   */
  async execute(
    actor: Actor,
    id: unknown,
    query: Result<unknown, DomainError>,
  ): Promise<Result<ApiAttachmentDownloadUrlResponse, DomainError>> {
    const reach = attachmentReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const attachmentId = parseAttachmentId(id)
    if (attachmentId.type === 'error') {
      return attachmentId
    }
    if (query.type === 'error') {
      return query
    }
    const request = parseWith(
      attachmentDownloadUrlRequestSchema,
      query.data,
      attachmentMessages.invalidAttachmentDownload,
    )
    if (request.type === 'error') {
      return request
    }
    const { inline } = AttachmentWriteMapper.fromDownloadUrlRequest(
      request.data,
    )

    const { attachmentRepository, fileStorage, clock } = this.dependencies
    const found = await attachmentRepository.findById(reach, attachmentId.data)
    if (found.type === 'error') {
      return found
    }
    const attachment = found.data
    if (attachment === null) {
      return Result.error(
        DomainErrors.notFound(entityMessages.attachment, attachmentId.data),
      )
    }
    if (attachment.status !== 'uploaded') {
      return Result.error(
        DomainErrors.conflict('The attachment has not been uploaded'),
      )
    }

    const expiresAt = addMinutes(clock(), DOWNLOAD_URL_MINUTES)
    const issued = await fileStorage.issueDownload(
      {
        key: storageKeyOf(attachment.id),
        contentType: attachment.contentType,
        contentDisposition: contentDispositionOf(attachment.filename, inline),
      },
      expiresAt,
    )

    return Result.map(issued, (downloadUrl) =>
      AttachmentReadMapper.toApiDownloadUrl(downloadUrl, expiresAt),
    )
  }
}
