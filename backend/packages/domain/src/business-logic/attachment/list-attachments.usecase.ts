import { Result } from '@beauty-salon-backend/utility'
import { AttachmentReadMapper } from '../../mappers/read/attachment.mapper'
import type { ApiAttachmentResponse } from '../../models/attachment'
import type { Actor } from '../../models/auth'
import type { ApiPaginationMeta } from '../../models/salon'
import { attachmentSearchRequestSchema } from '../../schemas/attachment.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { attachmentReachOf, reachesFilesOf } from './_shared/authorization'
import type { AttachmentUseCaseDependencies } from './_shared/dependencies'

const DEFAULT_LIMIT = 20
const MESSAGE = 'Invalid attachment search'

export type AttachmentPage = {
  data: ApiAttachmentResponse[]
  meta: ApiPaginationMeta
}

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
  ): Promise<Result<AttachmentPage, DomainError>> {
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
    const { cursor, salonId } = request.data
    if (salonId !== undefined && !reachesFilesOf(reach, salonId)) {
      return Result.error(DomainErrors.forbidden())
    }
    const limit = request.data.limit ?? DEFAULT_LIMIT

    const listed = await this.dependencies.attachmentRepository.list({
      reach,
      limit,
      after: cursor ?? null,
      salonId: salonId ?? null,
    })
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

    const { attachments, total, hasMore } = listed.data
    const lastAttachmentId = attachments.at(-1)?.id ?? null

    return Result.map(
      AttachmentReadMapper.toApiAttachments(attachments),
      (data) => ({
        data,
        meta: {
          total,
          limit,
          hasMore,
          cursor: cursor ?? null,
          nextCursor: hasMore ? lastAttachmentId : null,
          // Pages are only walked forwards.
          prevCursor: null,
        },
      }),
    )
  }
}
