import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type { DbAttachment } from '../../models/attachment'
import type {
  ApiSharedFileResponse,
  ApiShareLinkResponse,
  DbShareLink,
} from '../../models/share-link'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { timestampSchema } from './columns'

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
  Result.mapError(
    Result.map(
      parseWith(convertedColumnsSchema, shareLink, 'Invalid stored share link'),
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
    ),
    // The request was fine; the stored row is not.
    (error) =>
      DomainErrors.database(
        `Stored share link ${shareLink.id} does not match the API model`,
        error,
      ),
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
}
