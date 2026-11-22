import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiAttachmentDownloadUrlResponse,
  ApiAttachmentPurgeResponse,
  ApiAttachmentResponse,
  ApiAttachmentUploadUrlResponse,
  AttachmentId,
  DbAttachment,
} from '../../models/attachment'
import type { ApiPage, Paging } from '../../models/page'
import type { AttachmentList } from '../../repositories/attachment.repository'
import type { UploadTicket } from '../../services/file-storage'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { timestampSchema } from './columns'
import { toApiPage } from './page'

/**
 * A row of `attachments` → API response. Property names are the column
 * names, and only the times are written as the API writes them.
 *
 * Every property is named: the time an attachment was deleted is not
 * shown, and a column added to the table is not shown by itself.
 */

const convertedColumnsSchema = z.object({
  uploadExpiresAt: timestampSchema,
  uploadedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}) satisfies z.ZodType<
  Pick<
    ApiAttachmentResponse,
    'uploadExpiresAt' | 'uploadedAt' | 'createdAt' | 'updatedAt'
  >
>

const toApiAttachment = (
  attachment: DbAttachment,
): Result<ApiAttachmentResponse, DomainError> =>
  Result.mapError(
    Result.map(
      parseWith(
        convertedColumnsSchema,
        attachment,
        'Invalid stored attachment',
      ),
      (converted) => ({
        id: attachment.id,
        salonId: attachment.salonId,
        filename: attachment.filename,
        contentType: attachment.contentType,
        size: attachment.size,
        status: attachment.status,
        uploadedBy: attachment.uploadedBy,
        uploadExpiresAt: converted.uploadExpiresAt,
        uploadedAt: converted.uploadedAt,
        createdAt: converted.createdAt,
        updatedAt: converted.updatedAt,
      }),
    ),
    // The request was fine; the stored row is not.
    (error) =>
      DomainErrors.database(
        `Stored attachment ${attachment.id} does not match the API model`,
        error,
      ),
  )

export const AttachmentReadMapper = {
  toApiAttachment,

  toApiAttachments(
    attachments: DbAttachment[],
  ): Result<ApiAttachmentResponse[], DomainError> {
    const apiAttachments: ApiAttachmentResponse[] = []
    for (const attachment of attachments) {
      const mapped = toApiAttachment(attachment)
      if (mapped.type === 'error') {
        return mapped
      }
      apiAttachments.push(mapped.data)
    }
    return Result.success(apiAttachments)
  },

  /** The attachments of a list as a page of it. */
  toApiAttachmentPage(
    { attachments, total, hasMore }: AttachmentList,
    paging: Paging<AttachmentId>,
  ): Result<ApiPage<ApiAttachmentResponse>, DomainError> {
    return Result.map(
      AttachmentReadMapper.toApiAttachments(attachments),
      (data) => toApiPage(data, { total, hasMore }, paging),
    )
  },

  /** A pending attachment, and where and how its file is sent. */
  toApiUploadUrl(
    attachment: ApiAttachmentResponse,
    { url, headers }: UploadTicket,
  ): ApiAttachmentUploadUrlResponse {
    return { attachment, uploadUrl: url, uploadHeaders: headers }
  },

  /** A URL that downloads a file, and the moment it stops working. */
  toApiDownloadUrl(
    downloadUrl: string,
    expiresAt: Date,
  ): ApiAttachmentDownloadUrlResponse {
    return { downloadUrl, expiresAt: expiresAt.toISOString() }
  },

  /** How many attachments a purge removed. */
  toApiPurge(purgedCount: number): ApiAttachmentPurgeResponse {
    return { purgedCount }
  },
}
