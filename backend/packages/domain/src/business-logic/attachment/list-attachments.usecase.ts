import { Result } from '@beauty-salon-backend/utility'
import { AttachmentReadMapper } from '../../mappers/read/attachment.mapper'
import { AttachmentWriteMapper } from '../../mappers/write/attachment.mapper'
import type { ApiAttachmentResponse } from '../../models/attachment'
import type { Actor } from '../../models/auth'
import type { ApiPage } from '../../models/page'
import { attachmentSearchRequestSchema } from '../../schemas/attachment.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { attachmentReachOf, reachesFilesOf } from './_shared/authorization'
import type { AttachmentUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = 'Invalid attachment search'

export class ListAttachmentsUseCase {
  constructor(private readonly dependencies: AttachmentUseCaseDependencies) {}

  /**
   * Lists the uploaded attachments the actor reaches, the one uploaded
   * last first. The cursor of a page is the ID of its last attachment, and
   * one that names no attachment the list holds is refused.
   *
   * Whether the actor reaches any attachment is decided before the request
   * is looked at, which is why the query arrives as the caller decoded it.
   * A member of a salon is listed the attachments of that salon and is
   * refused when the query names another; an administrator is listed
   * those of every salon and of none, or of the salon the query names.
   */
  async execute(
    actor: Actor,
    query: Result<unknown, DomainError>,
  ): Promise<Result<ApiPage<ApiAttachmentResponse>, DomainError>> {
    const reach = attachmentReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    if (query.type === 'error') {
      return query
    }

    const request = parseWith(
      attachmentSearchRequestSchema,
      query.data,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const criteria = AttachmentWriteMapper.fromSearchRequest(
      request.data,
      reach,
    )
    if (criteria.salonId !== null && !reachesFilesOf(reach, criteria.salonId)) {
      return Result.error(DomainErrors.forbidden())
    }

    const listed = await this.dependencies.attachmentRepository.list(criteria)
    if (listed.type === 'error') {
      return listed
    }
    if (listed.data === null) {
      return Result.error(
        DomainErrors.validation(MESSAGE, [
          {
            field: 'cursor',
            rule: 'not_found',
            message: 'Must name an attachment of the list',
          },
        ]),
      )
    }

    return AttachmentReadMapper.toApiAttachmentPage(listed.data, criteria)
  }
}
