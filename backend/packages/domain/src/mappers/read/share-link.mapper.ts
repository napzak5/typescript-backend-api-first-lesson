import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type { DbAttachment } from '../../models/attachment'
import type { ApiPage, Paging } from '../../models/page'
import type {
  ApiSharedFileResponse,
  ApiShareLinkCreateResponse,
  ApiShareLinkResponse,
  DbShareLink,
  ShareLinkId,
} from '../../models/share-link'
import type { ShareLinkList } from '../../repositories/share-link.repository'
import { type DomainError, parseStored } from '../../shared'
import { timestampSchema } from './columns'
import { toApiPage } from './page'

/**
 * A row of `share_links` → API response. Property names are the column
 * names, and only the times are written as the API writes them.
 *
 * Every property is named: the hashes of the token and of the password,
 * the count of wrong passwords and the lock are not shown, and a column
 * added to the table is not shown by itself. Of the password, a response
 * says whether the link has one.
 */

const convertedColumnsSchema = z.object({
  expiresAt: timestampSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}) satisfies z.ZodType<
  Pick<ApiShareLinkResponse, 'expiresAt' | 'createdAt' | 'updatedAt'>
>

const toApiShareLink = (
  shareLink: DbShareLink,
): Result<ApiShareLinkResponse, DomainError> =>
  Result.map(
    parseStored(
      convertedColumnsSchema,
      shareLink,
      `Stored share link ${shareLink.id} does not match the API model`,
    ),
    (converted) => ({
      id: shareLink.id,
      attachmentId: shareLink.attachmentId,
      expiresAt: converted.expiresAt,
      maxDownloads: shareLink.maxDownloads,
      downloadCount: shareLink.downloadCount,
      hasPassword: shareLink.passwordHash !== null,
      createdBy: shareLink.createdBy,
      createdAt: converted.createdAt,
      updatedAt: converted.updatedAt,
    }),
  )

export const ShareLinkReadMapper = {
  toApiShareLink,

  toApiShareLinks(
    shareLinks: DbShareLink[],
  ): Result<ApiShareLinkResponse[], DomainError> {
    const apiShareLinks: ApiShareLinkResponse[] = []
    for (const shareLink of shareLinks) {
      const mapped = toApiShareLink(shareLink)
      if (mapped.type === 'error') {
        return mapped
      }
      apiShareLinks.push(mapped.data)
    }
    return Result.success(apiShareLinks)
  },

  /**
   * What a viewer is shown of the attachment a link opens: what the file
   * is, and nothing of where it is kept or whose it is.
   */
  toApiSharedFile(attachment: DbAttachment): ApiSharedFileResponse {
    return {
      filename: attachment.filename,
      contentType: attachment.contentType,
      size: attachment.size,
    }
  },

  /** The links of a list as a page of it. */
  toApiShareLinkPage(
    { shareLinks, total, hasMore }: ShareLinkList,
    paging: Paging<ShareLinkId>,
  ): Result<ApiPage<ApiShareLinkResponse>, DomainError> {
    return Result.map(ShareLinkReadMapper.toApiShareLinks(shareLinks), (data) =>
      toApiPage(data, { total, hasMore }, paging),
    )
  },

  /** A new link with its token, which is answered this once. */
  toApiShareLinkCreate(
    shareLink: DbShareLink,
    token: string,
  ): Result<ApiShareLinkCreateResponse, DomainError> {
    return Result.map(toApiShareLink(shareLink), (created) => ({
      shareLink: created,
      token,
    }))
  },
}
