import { Result } from '@beauty-salon-backend/utility'
import { ShareLinkReadMapper } from '../../mappers/read/share-link.mapper'
import { parseAttachmentId } from '../../models/attachment'
import type { Actor } from '../../models/auth'
import type { ApiPaginationMeta } from '../../models/page'
import type { ApiShareLinkResponse } from '../../models/share-link'
import { shareLinkSearchRequestSchema } from '../../schemas/share-link.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { shareLinkReachOf } from './_shared/authorization'
import type { ShareLinkUseCaseDependencies } from './_shared/dependencies'

const DEFAULT_LIMIT = 20
const MESSAGE = 'Invalid share link search'

export type ShareLinkPage = {
  data: ApiShareLinkResponse[]
  meta: ApiPaginationMeta
}

export class ListShareLinksUseCase {
  constructor(private readonly dependencies: ShareLinkUseCaseDependencies) {}

  /**
   * Lists the links of an attachment, the one created last first, with
   * those that have run out or issued every download they may: the salon
   * sees what it has shared. The cursor of a page is the ID of its last
   * link, and one that names no link of the attachment is refused.
   *
   * Whether the actor manages share links is decided before the request
   * is looked at, which is why the query arrives as the caller decoded it.
   */
  async execute(
    actor: Actor,
    attachmentId: unknown,
    query: Result<unknown, DomainError>,
  ): Promise<Result<ShareLinkPage, DomainError>> {
    const reach = shareLinkReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const id = parseAttachmentId(attachmentId)
    if (id.type === 'error') {
      return id
    }
    if (query.type === 'error') {
      return query
    }
    const request = parseWith(shareLinkSearchRequestSchema, query.data, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const { cursor } = request.data
    const limit = request.data.limit ?? DEFAULT_LIMIT

    const { shareLinkRepository, attachmentRepository } = this.dependencies
    const found = await attachmentRepository.findById(reach, id.data)
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return Result.error(DomainErrors.notFound('Attachment', id.data))
    }

    const listed = await shareLinkRepository.list({
      attachmentId: id.data,
      limit,
      after: cursor ?? null,
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
            message: 'Must name a share link of the attachment',
          },
        ]),
      )
    }

    const { shareLinks, total, hasMore } = listed.data
    const lastShareLinkId = shareLinks.at(-1)?.id ?? null

    return Result.map(
      ShareLinkReadMapper.toApiShareLinks(shareLinks),
      (data) => ({
        data,
        meta: {
          total,
          limit,
          hasMore,
          cursor: cursor ?? null,
          nextCursor: hasMore ? lastShareLinkId : null,
          // Pages are only walked forwards.
          prevCursor: null,
        },
      }),
    )
  }
}
