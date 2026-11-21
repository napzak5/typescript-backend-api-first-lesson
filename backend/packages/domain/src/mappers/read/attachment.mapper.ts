import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiAttachmentResponse,
  DbAttachment,
} from '../../models/attachment'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { timestampSchema } from './columns'

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
}
